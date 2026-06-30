# Challenge 08 — AKS Security Hardening — Coach Solution

[< Previous Solution](./Solution-07.md) | [Home](../../README.md) | [Next Solution >](./Solution-09.md)

## Notes & Guidance

- **Azure Policy enforcement delay:** After assigning a policy, allow up to 15–20 minutes
  before enforcement begins while Gatekeeper syncs. Teams testing immediately may not see
  the block yet.
- `az aks enable-addons --addons azure-policy` installs OPA Gatekeeper into
  `gatekeeper-system`. Pods should appear within 2–3 minutes.
- **Azure Policy add-on does NOT assign any policies by default.** The add-on only installs
  Gatekeeper. You must explicitly assign built-in or custom policies via `az policy assignment create`.
- **Two separate constraints may exist for the same policy** — one from `SecurityCenterBuiltIn`
  (Microsoft Defender initiative, `dryrun`/audit) and one from your custom assignment (`deny`).
  This is expected. Test by trying to create a privileged pod; the `deny` constraint will block it.
- For the network policy demo, Cilium policies allow L7 HTTP filtering — this is a powerful
  differentiator from standard Kubernetes NetworkPolicy.
- **Entra ID group creation** may require Azure AD permissions the team doesn't have.
  An alternative: use `--aad-admin-group-object-ids` with an existing group they belong to.
- **`kubectl auth can-i --as-group` note:** When impersonating a group with `--as-group`, you
  must also provide `--as <any-username>`. The command may print a warning about non-AAD users
  when using `--as` impersonation — this is expected; the result (yes/no) is still correct for
  testing Kubernetes RBAC RoleBindings.
- **Istio Gateway network policy:** The fabtech Gateway pod runs inside the `fabtech` namespace
  (not `app-routing-system`) with label `gateway.networking.k8s.io/gateway-name: fabtech-gateway`.
  A default-deny policy will also block external traffic into the gateway itself. See the updated
  network policy manifests below which account for this.

### Common Issues

- **`kubectl auth can-i` always returns yes even for non-admin:** The cluster may not have
  Entra ID integration enabled. Verify: `az aks show --query "aadProfile"`
- **Network policy blocks the gateway (app unreachable after applying default-deny):**
  The Istio gateway pod runs inside the `fabtech` namespace. The `default-deny-ingress` policy
  blocks all inbound traffic including external LB traffic to the gateway pod. Apply the
  `allow-external-to-gateway` policy (shown below) to restore access.
- **Network policy not blocking traffic:** Check that the cluster was created with a network
  policy engine (`--network-policy cilium` or `--network-policy azure`). Network policies
  applied to a cluster without a policy engine are silently ignored.
- **OPA Gatekeeper constraint shows `dryrun` even after assigning with `effect=deny`:**
  The `dryrun` constraint is from the `SecurityCenterBuiltIn` initiative (Microsoft Defender).
  Wait 5–10 minutes — a second constraint with `deny` will appear. Test with a privileged pod to
  confirm the deny is active. Check both constraints: `kubectl get k8sazurev2noprivilege -o wide`
- **Privileged pod not blocked immediately:** The azure-policy controller syncs in ~5 minute
  cycles. If testing right after assignment, wait and retry.
- **OPA Gatekeeper constraint not showing:** The `ConstraintTemplate` must be created before
  the `Constraint`. Azure Policy installs both, but check `kubectl get constrainttemplates`.

## Solution

### Part 1: Entra ID Integration & RBAC

```bash
RG=rg-frontier-aks
CLUSTER_NAME=aks-frontier

# Create Entra ID groups
ADMIN_GROUP_ID=$(az ad group create --display-name "AKS-Admins" \
  --mail-nickname "aks-admins" --query id -o tsv)
DEVELOPER_GROUP_ID=$(az ad group create --display-name "AKS-Developers" \
  --mail-nickname "aks-developers" --query id -o tsv)

# IMPORTANT: Add yourself to the admin group BEFORE enabling AAD,
# or you will lose kubectl access to the cluster
MY_USER_ID=$(az ad signed-in-user show --query id -o tsv)
az ad group member add --group $ADMIN_GROUP_ID --member-id $MY_USER_ID

# Enable Entra ID + Azure RBAC
az aks update \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --enable-aad \
  --enable-azure-rbac \
  --aad-admin-group-object-ids $ADMIN_GROUP_ID

AKS_ID=$(az aks show --resource-group $RG --name $CLUSTER_NAME --query id -o tsv)

# Assign Azure RBAC Reader to the developer group at cluster scope
az role assignment create \
  --assignee-object-id $DEVELOPER_GROUP_ID \
  --assignee-principal-type Group \
  --role "Azure Kubernetes Service RBAC Reader" \
  --scope $AKS_ID

# Refresh credentials — required after enabling AAD
az aks get-credentials --resource-group $RG --name $CLUSTER_NAME --overwrite-existing
kubelogin convert-kubeconfig -l azurecli
```

- `--enable-aad`: enables Entra authentication (**who you are**).
- `--enable-azure-rbac`: enables Azure RBAC for Kubernetes authorization (**what you can do**),
  using Azure role assignments instead of or alongside Kubernetes RoleBindings.

Optional Kubernetes RBAC example (**not** an Azure RBAC role assignment):

```yaml
# developer-rbac.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: developer
  namespace: fabtech
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log", "services", "configmaps"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["pods/exec"]
  verbs: ["create"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: developer-binding
  namespace: fabtech
subjects:
- kind: Group
  name: "<DEVELOPER_GROUP_ID>"
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: developer
  apiGroup: rbac.authorization.k8s.io
```

```bash
kubectl apply -f developer-rbac.yaml

# Test Kubernetes RBAC RoleBinding behavior
# Note: --as-group requires --as <username> as well; the warning about non-AAD user is expected
kubectl auth can-i delete pods -n fabtech --as-group="$DEVELOPER_GROUP_ID" --as="devuser"
# Expected: no
kubectl auth can-i get pods -n fabtech --as-group="$DEVELOPER_GROUP_ID" --as="devuser"
# Expected: yes
```

### Part 2: Azure Policy Add-on

```bash
# Install the Azure Policy add-on (installs OPA Gatekeeper — no policies enforced yet)
az aks enable-addons \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --addons azure-policy

kubectl get pods -n kube-system | grep azure-policy
kubectl get pods -n gatekeeper-system

# Wait 2-3 min for Gatekeeper pods to be Running, then assign a policy.
# The add-on alone does NOT enforce anything — you must assign policies explicitly.

AKS_ID=$(az aks show --resource-group $RG --name $CLUSTER_NAME --query id -o tsv)

# Assign built-in policy: "Kubernetes cluster should not allow privileged containers"
# effect=deny → Gatekeeper enforces as 'deny' (blocks admission)
az policy assignment create \
  --name "deny-privileged-containers" \
  --display-name "Deny privileged containers in AKS" \
  --policy "95edb821-ddaf-4404-9732-666045e056b4" \
  --scope $AKS_ID \
  --params '{"effect": {"value": "deny"}}'

# Wait 5-10 min for the azure-policy controller to create the Gatekeeper Constraint.
# You will see TWO k8sazurev2noprivilege constraints:
#   - one from SecurityCenterBuiltIn (dryrun/audit) — from Microsoft Defender
#   - one from your assignment (deny) — this is the one that blocks
kubectl get k8sazurev2noprivilege -o custom-columns="NAME:.metadata.name,ACTION:.spec.enforcementAction"
```

```bash
# Test policy blocking privileged pods (once the deny constraint is active):
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: priv-test
  namespace: fabtech
spec:
  containers:
  - name: c
    image: nginx
    securityContext:
      privileged: true
EOF
# Expected: Error from server: admission webhook "validation.gatekeeper.sh" denied the request
# If the pod is created instead of blocked, the deny constraint hasn't synced yet — wait and retry.
```

### Part 3: Network Policy

> **Important for App Routing with Istio:** When using the `approuting-istio` GatewayClass, the
> Istio Gateway pod is deployed **inside the `fabtech` namespace** (not in `app-routing-system`).
> A default-deny policy blocks ALL inbound traffic, including external LoadBalancer traffic to the
> gateway itself. You must allow both: external traffic into the gateway pod, and gateway-to-web
> traffic using the gateway pod's label selector.

```yaml
# network-policies.yaml
---
# Default deny all ingress traffic in fabtech namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: fabtech
spec:
  podSelector: {}
  policyTypes:
  - Ingress
---
# Allow external LoadBalancer traffic into the Istio Gateway pod (port 80)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-external-to-gateway
  namespace: fabtech
spec:
  podSelector:
    matchLabels:
      gateway.networking.k8s.io/gateway-name: fabtech-gateway
  ingress:
  - ports:
    - protocol: TCP
      port: 80
    - protocol: TCP
      port: 15021
---
# Allow Gateway → web (gateway pod is in fabtech ns, uses gateway-name label)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-gateway-to-web
  namespace: fabtech
spec:
  podSelector:
    matchLabels:
      app: fabtech-web
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: app-routing-system
    - podSelector:
        matchLabels:
          gateway.networking.k8s.io/gateway-name: fabtech-gateway
---
# Allow web → api
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-web-to-api
  namespace: fabtech
spec:
  podSelector:
    matchLabels:
      app: fabtech-api
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: fabtech-web
    ports:
    - protocol: TCP
      port: 3001
```

```bash
kubectl apply -f network-policies.yaml

# Verify app is still reachable via the gateway
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://<GATEWAY_IP>
# Expected: HTTP Status: 200

# Test: unauthorized pod (no app=fabtech-web label) cannot reach API
kubectl run -it --rm test-pod --image=busybox:1.36 --restart=Never -n fabtech -- \
  wget -qO- --timeout=5 http://fabtech-api:3001/api/health
# Expected: connection refused or timeout (pod exits with error)
```

### Part 4: Microsoft Defender for Containers (Optional)

```bash
az security pricing create \
  --name Containers \
  --tier Standard

# Review recommendations
az security assessment list \
  --query "[?displayName.contains(@,'container')]" -o table
```
