# Challenge 09 — Service Mesh with AKS Istio — Coach Solution

[< Previous Solution](./Solution-08.md) | [Home](../../README.md) | [Next Solution >](./Solution-10.md)

## Notes & Guidance

- The Istio revision label format is `asm-1-XX` — get the exact value with:
  `az aks mesh get-revisions --location $LOCATION`
- After enabling the namespace label for sidecar injection, **all pods must be restarted**
  to get the Envoy sidecar injected. Teams forget this step.
- The canary traffic split via `VirtualService` is the most visually engaging demo.
  Set up two Deployments (`v1` and `v2`) with different `version` labels and a
  `DestinationRule` that defines the subsets.
- `istioctl manifest apply` was **removed in Istio 1.7**. Never use it — use `istioctl install`
  or (better) the AKS managed add-on.
- **App Routing Istio + Mesh add-on cannot coexist.** If the cluster was set up with
  `--enable-app-routing-istio` (from Challenge 03), this must be disabled before enabling the
  Istio mesh add-on. See Part 1 for the required pre-step.
- **Enable the Istio external ingress gateway** (`az aks mesh enable-ingress-gateway`) to expose
  your application once the mesh add-on replaces App Routing's Istio implementation.
- **Multi-arch clusters:** If using NAP/Karpenter with default settings, spot nodes may be
  provisioned on ARM64 (e.g., `Standard_Dxxxpls_v6`). Application images built on AMD64 will
  crash on ARM64 nodes. Restrict the NodePool: `requirements: [{key: kubernetes.io/arch, operator: In, values: [amd64]}]`

### Common Issues

- **`az aks mesh enable` fails with "AppRouting Istio Gateway API implementation must be disabled":**
  Run `az aks update --disable-app-routing-istio` first, then retry `az aks mesh enable`.
- **App not accessible after enabling mesh (gateway pods crash with "istiod not found"):**
  The App Routing Istio gateway pods rely on `istiod.aks-istio-system.svc` which is replaced
  by `istiod-asm-1-XX.aks-istio-system.svc` after the mesh add-on is enabled. The old gateway
  pods lose their xDS control plane connection and stop routing traffic. Solution:
  enable the Istio ingress gateway and switch the Gateway resource to use GatewayClass `istio`.
- **Pods crash with `exec format error` after sidecar injection:** Karpenter provisioned ARM64
  nodes. The app images are AMD64-only. Delete the ARM64 nodes and restrict the NodePool to
  `kubernetes.io/arch: amd64`. Also add a `nodeSelector` to the deployments.
- **Sidecars not injecting:** Verify the namespace label:
  `kubectl get namespace fabtech --show-labels | grep istio.io/rev`
  Then restart pods: `kubectl rollout restart deployment -n fabtech`
- **mTLS blocking traffic from the Gateway:** The Istio Gateway pod runs with
  `sidecar.istio.io/inject=false` so it communicates with the mesh via Envoy (not a sidecar).
  STRICT mTLS is compatible with the Istio-managed gateway. The gateway pod itself handles
  the mTLS handshake.
- **Kiali not available in AKS managed Istio:** Managed Istio ships without Kiali by default.
  Teams can observe traffic via the Istio metrics in Grafana (Managed Prometheus integration).
  Alternatively, use `kubectl exec ... -- wget -qO- http://localhost:15020/stats/prometheus`
  to read raw Istio metrics from any sidecar-injected pod.

## Solution

### Part 1: Enable AKS Managed Istio

```bash
RG=rg-frontier-aks
CLUSTER_NAME=aks-frontier
LOCATION=swedencentral

# PRE-STEP: If the cluster was set up with App Routing Istio (Challenge 03),
# the App Routing Istio integration must be disabled before enabling the mesh add-on.
# This is required — the two implementations cannot coexist.
az aks update \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --disable-app-routing-istio

# Check available revisions
az aks mesh get-revisions --location $LOCATION -o table

# Enable managed Istio (use the latest asm revision shown above)
az aks mesh enable \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --revision asm-1-29

# Verify istiod pods are running
kubectl get pods -n aks-istio-system

# Enable the external ingress gateway (replaces the old App Routing gateway)
az aks mesh enable-ingress-gateway \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --ingress-gateway-type External

# Get the new external IP
kubectl get svc -n aks-istio-ingress
```

Update the Gateway resource to use the `istio` GatewayClass (the mesh add-on's Gateway controller):

```yaml
# fabtech-gateway.yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: fabtech-gateway
  namespace: fabtech
spec:
  gatewayClassName: istio
  listeners:
  - name: http
    protocol: HTTP
    port: 80
    allowedRoutes:
      namespaces:
        from: Same
```

```bash
kubectl apply -f fabtech-gateway.yaml

# Get the new gateway IP (different from the old App Routing IP)
kubectl get gateway fabtech-gateway -n fabtech
# Note: The Gateway controller creates a new LoadBalancer service and IP.
# Update DNS or client configurations to use the new IP.
```

### Part 2: Enable Sidecar Injection

```bash
# Label the namespace for automatic injection
# Get the exact revision label first:
REVISION=$(az aks mesh get-revisions --location $LOCATION -o tsv --query 'meshRevisions[-1].revision')
echo "REVISION=$REVISION"
kubectl label namespace fabtech istio.io/rev=$REVISION

# Restart application deployments ONLY (not the gateway deployment)
kubectl rollout restart deployment/fabtech-api deployment/fabtech-web -n fabtech

# Verify sidecars — each pod should now show 2/2 containers (app + istio-proxy)
kubectl get pods -n fabtech
```

> **Note:** `kubectl rollout restart deployment -n fabtech` restarts ALL deployments in the
> namespace, including the Gateway deployment. If Flux GitOps is active, the deployments may
> revert to a placeholder image during the rollout. Prefer restarting only the app deployments
> explicitly, and ensure Flux GitOps is suspended (or images are correct) before restarting.

### Part 3: Configure mTLS (STRICT Mode)

```yaml
# peer-auth.yaml
apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata:
  name: default
  namespace: fabtech
spec:
  mtls:
    mode: STRICT
```

```bash
kubectl apply -f peer-auth.yaml

# Verify — traffic from a non-mesh pod should fail.
# Run this from the default namespace so the pod is outside the mesh (no sidecar);
# pods outside the mesh cannot reach a service protected by STRICT mTLS.
kubectl run test-plain -n default --image=curlimages/curl --restart=Never -- \
  curl -s http://fabtech-api.fabtech.svc.cluster.local:3001/api/health
# Expected: connection reset or SSL handshake failure
```

### Part 4: Canary Traffic Split

First, patch the existing `fabtech-api` deployment to add the `version: v1` label:

```bash
kubectl patch deployment fabtech-api -n fabtech --type=merge -p \
  '{"spec":{"template":{"metadata":{"labels":{"version":"v1"}}}}}'
```

> **Coach Note:** The `version: v1` label is not in the Helm chart. A subsequent Helm upgrade
> or Flux reconciliation will revert this. Ensure Flux is suspended or the chart values include
> this label before proceeding with the canary.

Then deploy a v2 of the API (`app: fabtech-api`, `version: v2` labels):

```yaml
# fabtech-api-v2-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fabtech-api-v2
  namespace: fabtech
spec:
  replicas: 1
  selector:
    matchLabels:
      app: fabtech-api
      version: v2
  template:
    metadata:
      labels:
        app: fabtech-api
        version: v2
    spec:
      nodeSelector:
        kubernetes.io/arch: amd64
      serviceAccountName: fabtech-api-sa
      containers:
      - name: api
        image: <ACR_NAME>.azurecr.io/fabtech-api:v2
        securityContext:
          runAsNonRoot: true
          runAsUser: 100
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop: ["ALL"]
        volumeMounts:
        - name: secrets-store
          mountPath: /mnt/secrets
          readOnly: true
      volumes:
      - name: secrets-store
        csi:
          driver: secrets-store.csi.k8s.io
          readOnly: true
          volumeAttributes:
            secretProviderClass: fabtech-secrets
```

```yaml
# destination-rule.yaml
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: fabtech-api
  namespace: fabtech
spec:
  host: fabtech-api
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
---
# virtual-service.yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: fabtech-api
  namespace: fabtech
spec:
  hosts:
  - fabtech-api
  http:
  - route:
    - destination:
        host: fabtech-api
        subset: v1
      weight: 80
    - destination:
        host: fabtech-api
        subset: v2
      weight: 20
```

```bash
kubectl apply -f destination-rule.yaml
kubectl apply -f virtual-service.yaml

# Generate traffic and observe split in Grafana
for i in {1..50}; do
  kubectl exec -n fabtech deploy/fabtech-web -- \
    curl -s http://fabtech-api:3001/api/version
done
```
