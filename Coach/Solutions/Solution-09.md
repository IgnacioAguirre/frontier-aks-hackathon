# Challenge 09 — Service Mesh with AKS Istio — Coach Solution

[< Previous Solution](./Solution-08.md) | [Home](../../README.md) | [Next Solution >](./Solution-10.md)

## Notes & Guidance

- **Use AKS managed Istio (`az aks mesh enable`)** — the supported service mesh add-on for AKS.
  Any reference to `osm` CLI or `openservicemesh.io` annotations should be corrected immediately.
- The Istio revision label format is `asm-1-XX` — get the exact value with:
  `az aks mesh get-revisions --location $LOCATION`
- After enabling the namespace label for sidecar injection, **all pods must be restarted**
  to get the Envoy sidecar injected. Teams forget this step.
- The canary traffic split via `VirtualService` is the most visually engaging demo.
  Set up two Deployments (`v1` and `v2`) with different `version` labels and a 
  `DestinationRule` that defines the subsets.
- `istioctl manifest apply` was **removed in Istio 1.7**. Never use it — use `istioctl install`
  or (better) the AKS managed add-on.

### Common Issues

- **Sidecars not injecting:** Verify the namespace label:
  `kubectl get namespace fabtech --show-labels | grep istio-injection`
  Then restart pods: `kubectl rollout restart deployment -n fabtech`
- **mTLS blocking traffic from ingress:** The App Routing ingress controller is not
  part of the mesh. Create an exception in the `PeerAuthentication` or configure the ingress
  to go through an Istio ingress gateway.
- **Kiali not available in AKS managed Istio:** Managed Istio ships without Kiali by default.
  Teams can observe traffic via the Istio metrics in Grafana (Managed Prometheus integration).

## Solution

### Part 1: Enable AKS Managed Istio

```bash
RG=rg-frontier-aks
CLUSTER_NAME=aks-frontier
LOCATION=eastus

# Check available revisions
az aks mesh get-revisions --location $LOCATION -o table

# Enable managed Istio (use the latest asm revision)
az aks mesh enable \
  --resource-group $RG \
  --name $CLUSTER_NAME

# Verify
kubectl get pods -n aks-istio-system
```

### Part 2: Enable Sidecar Injection

```bash
# Label the namespace for automatic injection
kubectl label namespace fabtech istio.io/rev=asm-1-23  # Use actual revision from above

# Restart all pods to inject sidecars
kubectl rollout restart deployment -n fabtech

# Verify sidecars
kubectl get pods -n fabtech
# Each pod should now show 2/2 or 3/3 containers (app + istio-proxy)
```

### Part 3: Configure mTLS (STRICT Mode)

```yaml
# peer-auth.yaml
apiVersion: security.istio.io/v1beta1
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

# Verify — traffic from a non-mesh pod should fail
kubectl run test-plain --image=curlimages/curl --restart=Never -- \
  curl -s http://fabtech-api.fabtech.svc.cluster.local:3001/api/health
# Expected: connection reset or SSL handshake failure
```

### Part 4: Canary Traffic Split

Deploy a v2 of the API (can be same image, different label):

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
      containers:
      - name: api
        image: <ACR>/fabtech-api:v2
```

```yaml
# destination-rule.yaml
apiVersion: networking.istio.io/v1alpha3
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
apiVersion: networking.istio.io/v1alpha3
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

### Part 5 (Optional): AuthorizationPolicy

```yaml
# authz-policy.yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-web-to-api
  namespace: fabtech
spec:
  selector:
    matchLabels:
      app: fabtech-api
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/fabtech/sa/fabtech-web-sa"]
```
