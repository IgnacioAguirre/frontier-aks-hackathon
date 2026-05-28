# Challenge 08 — AKS Security

[< Previous Challenge](./Challenge-07.md) — **[Home](../README.md)** — [Next Challenge >](./Challenge-09.md)

## Introduction

Security in Kubernetes is multi-layered. In this challenge you will:

1. Configure **Entra ID RBAC** for fine-grained cluster access control
2. Enforce pod security standards with **Azure Policy for Kubernetes** (OPA Gatekeeper)
3. Apply **network policies** to restrict pod-to-pod traffic
4. Enable **Microsoft Defender for Containers** for runtime threat detection

## Description

### Part 1: Entra ID RBAC

Enable Entra ID integration and Kubernetes RBAC:

```bash
RG=rg-frontier-aks
CLUSTER_NAME=aks-frontier

# Enable Entra ID RBAC (if not already enabled)
az aks update \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --enable-aad \
  --enable-azure-rbac
```

Create namespace-scoped roles for your team:

```bash
# Get your Entra user's Object ID
MY_ID=$(az ad signed-in-user show --query id -o tsv)

# Grant Azure Kubernetes Service RBAC Reader on the fabtech namespace
az role assignment create \
  --role "Azure Kubernetes Service RBAC Reader" \
  --assignee $MY_ID \
  --scope \
  "$(az aks show --resource-group $RG --name $CLUSTER_NAME --query id -o tsv)/namespaces/fabtech"

# Grant yourself cluster admin (required to set up the rest of this challenge)
az role assignment create \
  --role "Azure Kubernetes Service RBAC Cluster Admin" \
  --assignee $MY_ID \
  --scope $(az aks show --resource-group $RG --name $CLUSTER_NAME --query id -o tsv)
```

Re-authenticate and test:

```bash
az aks get-credentials --resource-group $RG --name $CLUSTER_NAME --overwrite-existing
kubectl get pods -n fabtech         # should work (reader)
kubectl get pods -n kube-system     # should be denied (no cluster-wide access)
```

### Part 2: Azure Policy for Kubernetes (OPA Gatekeeper)

Enable the Azure Policy add-on:

```bash
az aks enable-addons \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --addons azure-policy
```

Verify Gatekeeper pods are running:

```bash
kubectl get pods -n gatekeeper-system
kubectl get pods -n kube-system | grep policy
```

Assign built-in policies to prevent privileged containers and enforce resource limits:

```bash
CLUSTER_ID=$(az aks show --resource-group $RG --name $CLUSTER_NAME --query id -o tsv)

# Deny privileged containers
az policy assignment create \
  --name "deny-privileged-containers" \
  --display-name "Deny Privileged Containers in AKS" \
  --policy "95edb821-ddaf-4404-9732-666045e70341" \
  --scope $CLUSTER_ID \
  --enforcement-mode Default

# Require resource limits
az policy assignment create \
  --name "require-resource-limits" \
  --display-name "Require Resource Limits in AKS" \
  --policy "e345eecc-fa47-480f-9e88-67dcc122b164" \
  --scope $CLUSTER_ID \
  --enforcement-mode Default
```

Test that a privileged pod is rejected:

```bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: privileged-test
  namespace: fabtech
spec:
  containers:
  - name: test
    image: nginx
    securityContext:
      privileged: true
EOF
# Expected: admission webhook denied the request
```

### Part 3: Network Policies with Cilium

With Cilium as the network dataplane (enabled in Challenge 02), you have access to both
standard Kubernetes `NetworkPolicy` and advanced `CiliumNetworkPolicy`.

Create a default-deny policy for the `fabtech` namespace:

```yaml
# default-deny.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: fabtech
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

Allow only specific traffic:

```yaml
# allow-api-to-db.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-ingress
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
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
    ports:
    - protocol: UDP
      port: 53   # DNS
```

```bash
kubectl apply -f default-deny.yaml
kubectl apply -f allow-api-to-db.yaml
```

Test connectivity:

```bash
# This should FAIL (blocked by network policy)
kubectl run -it --rm test --image=busybox --restart=Never -- wget -qO- http://fabtech-api.fabtech.svc.cluster.local

# This should SUCCEED (from a web pod)
WEB_POD=$(kubectl get pod -n fabtech -l app=fabtech-web -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n fabtech $WEB_POD -- wget -qO- http://fabtech-api.fabtech.svc.cluster.local/api/health
```

### Part 4: Microsoft Defender for Containers

Enable Defender for Containers:

```bash
az security pricing create \
  --name Containers \
  --tier Standard
```

Verify the Defender sensor is installed:

```bash
kubectl get pods -n kube-system | grep microsoft-defender
```

Simulate a suspicious activity to trigger an alert (this is safe):

```bash
# Defender detects cryptomining tooling
kubectl run -it --rm crypto-test --image=ubuntu --restart=Never -- \
  bash -c "apt-get install -y -q xmrig 2>/dev/null; echo done"
```

Wait a few minutes, then check Microsoft Defender for Cloud in the Azure Portal →
**Security Alerts** to see if an alert was generated.

## Success Criteria

1. Show that a team member (or a second Entra ID user) has read-only access to `fabtech`
   namespace but cannot access `kube-system`.
2. Show that deploying a privileged pod is **denied** by Azure Policy / OPA Gatekeeper.
3. Apply network policies and demonstrate that pods outside the allow list **cannot** reach
   the API (show the blocked connection attempt).
4. Microsoft Defender for Containers is enabled — show the sensor pod running.
5. Explain to your coach the defense-in-depth layers: **RBAC → Policy → NetworkPolicy → Defender**.

## Learning Resources

- [Entra ID RBAC for AKS](https://learn.microsoft.com/azure/aks/manage-azure-rbac)
- [Azure Policy for Kubernetes](https://learn.microsoft.com/azure/governance/policy/concepts/policy-for-kubernetes)
- [Network policies in AKS](https://learn.microsoft.com/azure/aks/use-network-policies)
- [Cilium network policies](https://learn.microsoft.com/azure/aks/azure-cni-powered-by-cilium)
- [Microsoft Defender for Containers](https://learn.microsoft.com/azure/defender-for-cloud/defender-for-containers-introduction)
