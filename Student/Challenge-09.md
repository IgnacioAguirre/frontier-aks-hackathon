# Challenge 09 — AKS Managed Istio Service Mesh

[< Previous Challenge](./Challenge-08.md) — **[Home](../README.md)** — [Next Challenge >](./Challenge-10.md)

## Introduction

A service mesh provides traffic management, mutual TLS, and observability between services
without changing application code.

In this challenge you will use the **AKS managed Istio add-on** — a Microsoft-supported,
fully-managed Istio deployment. No manual `istioctl install` required.

> **Deprecated:** The Open Service Mesh (OSM) AKS add-on is deprecated. The SMI spec
> has been archived by CNCF. Use the **AKS managed Istio add-on** (`az aks mesh enable`).

## Description

### Part 1: Enable the AKS Istio Add-on

```bash
RG=rg-frontier-aks
CLUSTER_NAME=aks-frontier

# Enable Istio service mesh
az aks mesh enable \
  --resource-group $RG \
  --name $CLUSTER_NAME

# Verify the Istio control plane is running
kubectl get pods -n aks-istio-system
```

Enable sidecar injection for the `fabtech` namespace:

```bash
kubectl label namespace fabtech istio.io/rev=asm-1-23 --overwrite
# Note: replace asm-1-23 with the revision installed — check with:
# az aks mesh get-revisions --location eastus -o table

# Restart pods to inject sidecars
kubectl rollout restart deployment -n fabtech
```

Verify sidecars were injected (each pod should now have 2 containers):

```bash
kubectl get pods -n fabtech
# READY column should show 2/2 per pod
```

### Part 2: Enable Mutual TLS (mTLS)

Enforce strict mTLS within the `fabtech` namespace:

```yaml
# mtls-strict.yaml
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
kubectl apply -f mtls-strict.yaml
```

Verify mTLS is active by attempting plaintext communication:

```bash
# Create a test pod WITHOUT the Istio sidecar (bypasses mesh)
kubectl run -it --rm no-mesh-test \
  --image=curlimages/curl \
  --restart=Never \
  --labels="sidecar.istio.io/inject=false" \
  -- curl -s http://fabtech-api.fabtech.svc.cluster.local/api/health
# Expected: connection refused or reset (mTLS STRICT blocks plaintext)
```

### Part 3: Traffic Management — Canary Release

Deploy a v2 version of the API alongside v1:

```bash
kubectl apply -f - <<EOF
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
        image: whatthehackmsft/api:v2
        ports:
        - containerPort: 3001
EOF
```

Create a `DestinationRule` to define subsets and a `VirtualService` to split traffic:

```yaml
# traffic-split.yaml
apiVersion: networking.istio.io/v1beta1
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
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: fabtech-api
  namespace: fabtech
spec:
  hosts:
  - fabtech-api
  http:
  - match:
    - headers:
        x-canary:
          exact: "true"
    route:
    - destination:
        host: fabtech-api
        subset: v2
  - route:
    - destination:
        host: fabtech-api
        subset: v1
      weight: 90
    - destination:
        host: fabtech-api
        subset: v2
      weight: 10
```

```bash
kubectl apply -f traffic-split.yaml
```

Test traffic splitting:

```bash
# Run 20 requests from inside the cluster and count v1 vs v2 responses
kubectl run -it --rm traffic-test --image=curlimages/curl --restart=Never -- \
  sh -c 'for i in $(seq 1 20); do curl -s http://fabtech-api.fabtech.svc.cluster.local/api/version; echo; done'
```

Gradually shift all traffic to v2 by updating the `VirtualService` weights to `0/100`.

### Part 4: Enable Istio Ingress Gateway

Create an external ingress gateway for the Istio mesh:

```bash
az aks mesh enable-ingress-gateway \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --ingress-gateway-type external
```

Verify:

```bash
kubectl get service aks-istio-ingressgateway-external -n aks-istio-ingress
```

### Part 5: Observability with Kiali (Optional)

Kiali is a management console for Istio. Enable it via the AKS managed add-on:

```bash
# Kiali is included with the AKS Istio add-on
kubectl get pods -n aks-istio-system | grep kiali
# Access via port-forward
kubectl port-forward svc/kiali 20001:20001 -n aks-istio-system
```

Open `http://localhost:20001` and explore the traffic graph.

## Success Criteria

1. Istio sidecar containers (`istio-proxy`) are running in all `fabtech` pods.
2. mTLS is in `STRICT` mode — show that a pod without a sidecar **cannot** communicate
   with a mesh-enabled pod over plaintext.
3. The canary `VirtualService` routes ~10% of traffic to v2 — demonstrate with a script
   counting responses from each version.
4. Explain to your coach the difference between the **AKS managed Istio add-on** and
   a self-installed Istio, and why OSM is deprecated.

## Learning Resources

- [AKS managed Istio add-on overview](https://learn.microsoft.com/azure/aks/istio-about)
- [Enable the AKS Istio add-on](https://learn.microsoft.com/azure/aks/istio-deploy-addon)
- [Istio mTLS](https://istio.io/latest/docs/tasks/security/authentication/mtls-migration/)
- [Istio traffic management concepts](https://istio.io/latest/docs/concepts/traffic-management/)
- [Canary deployments with Istio](https://learn.microsoft.com/azure/aks/istio-canary-weighted-routing)
