# Challenge 03 — App Deployment, Ingress & Gateway API — Coach Solution

[< Previous Solution](./Solution-02.md) | [Home](../../README.md) | [Next Solution >](./Solution-04.md)

## Notes & Guidance

- Teams must complete the Helm chart and get the app running before choosing a routing option.
- Option A (NGINX/App Routing) is the fastest path — good for teams short on time.
- Option B (Gateway API via App Routing) is the recommended stretch: same add-on, no extra infra.
- Option C (AGC) requires a Managed Identity and ALB Controller install — allow 20–30 extra minutes.
- Ensure teams use `spec.ingressClassName: webapprouting.kubernetes.azure.com` for Option A.
- For the database, steer teams toward **Azure Database for PostgreSQL Flexible Server** unless
  time is tight.
- If teams use `nip.io` for the hostname, the ingress IP is the public IP of the NGINX controller
  in the `app-routing-system` namespace.

### Common Issues

- **App Routing already enabled:** AKS Automatic clusters may have it on by default.
  Check: `az aks addon show --addon web_application_routing`.
- **Helm chart rendering errors:** Run `helm template ./fabtech` to debug before installing.
- **Ingress not reachable:** Check `kubectl get ingress -n fabtech` for ADDRESS. If empty,
  check `kubectl get pods -n app-routing-system`.
- **Gateway API — route not accepted:** Confirm the `parentRef` gateway name matches exactly
  and the `allowedRoutes.namespaces` selector includes the `fabtech` namespace.
- **AGC — frontend not resolving:** ALB Controller pods must be running in `azure-alb-system`
  before the `ApplicationLoadBalancer` resource is created.

## Solution

### Part 1 — Enable App Routing & Deploy the Helm Chart

```bash
RG=rg-frontier-aks
CLUSTER_NAME=aks-frontier
ACR_NAME=<ACR_NAME>
NAMESPACE=fabtech

# Enable App Routing (skip if already enabled)
az aks addon enable \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --addon web_application_routing

ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)

helm upgrade --install fabtech ./fabtech \
  --namespace $NAMESPACE \
  --create-namespace \
  --set api.image.repository=$ACR_LOGIN_SERVER/fabtech-api \
  --set web.image.repository=$ACR_LOGIN_SERVER/fabtech-web

kubectl get pods,svc,ingress -n $NAMESPACE
```

Reference `values.yaml`:

```yaml
api:
  image:
    repository: <ACR_LOGIN_SERVER>/fabtech-api
    tag: v1
  replicaCount: 2
  service:
    port: 3001

web:
  image:
    repository: <ACR_LOGIN_SERVER>/fabtech-web
    tag: v1
  replicaCount: 2
  service:
    port: 3000

ingress:
  enabled: true
  className: webapprouting.kubernetes.azure.com
  hosts:
    - host: ""
      paths:
        - path: /
          pathType: Prefix
```

### Part 2 — Option A: NGINX Ingress (App Routing)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: fabtech-ingress
  namespace: fabtech
spec:
  ingressClassName: webapprouting.kubernetes.azure.com
  rules:
  - http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: fabtech-web
            port:
              number: 3000
```

### Part 3 — Option B: Gateway API via App Routing

Enable Gateway API support on the add-on:

```bash
az aks approuting update \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --enable-keda  # not needed; use gateway flag
```

> **Note:** Gateway API CRDs are installed automatically by the App Routing add-on when the
> cluster has `--enable-app-routing`. No manual CRD install needed.

```yaml
# gateway.yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: fabtech-gateway
  namespace: fabtech
  annotations:
    service.beta.kubernetes.io/azure-load-balancer-internal: "false"
spec:
  gatewayClassName: webapprouting.kubernetes.azure.com
  listeners:
  - name: http
    protocol: HTTP
    port: 80
    allowedRoutes:
      namespaces:
        from: Same
---
# httproute.yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: fabtech-route
  namespace: fabtech
spec:
  parentRefs:
  - name: fabtech-gateway
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /
    backendRefs:
    - name: fabtech-web
      port: 3000
```

```bash
kubectl apply -f gateway.yaml
kubectl get gateway -n fabtech          # wait for READY=True
kubectl get httproute -n fabtech        # confirm status: Accepted
```

### Part 4 — Option C: Application Gateway for Containers (AGC)

```bash
# Install the ALB Controller via Helm with Workload Identity
IDENTITY_NAME=alb-controller-identity
CLUSTER_RG=$(az aks show -g $RG -n $CLUSTER_NAME \
  --query nodeResourceGroup -o tsv)

az identity create -g $RG -n $IDENTITY_NAME
IDENTITY_CLIENT_ID=$(az identity show -g $RG -n $IDENTITY_NAME \
  --query clientId -o tsv)
IDENTITY_RESOURCE_ID=$(az identity show -g $RG -n $IDENTITY_NAME \
  --query id -o tsv)

# Assign AppGw for Containers Configuration Manager role
az role assignment create \
  --assignee-object-id $(az identity show -g $RG -n $IDENTITY_NAME \
    --query principalId -o tsv) \
  --role "AppGw for Containers Configuration Manager" \
  --scope $(az group show -g $RG --query id -o tsv)

# Federate the identity
OIDC_ISSUER=$(az aks show -g $RG -n $CLUSTER_NAME \
  --query oidcIssuerProfile.issuerUrl -o tsv)

az identity federated-credential create \
  --name alb-controller \
  --identity-name $IDENTITY_NAME \
  --resource-group $RG \
  --issuer $OIDC_ISSUER \
  --subject "system:serviceaccount:azure-alb-system:alb-controller-sa"

# Install ALB Controller
helm install alb-controller oci://mcr.microsoft.com/application-lb/charts/alb-controller \
  --namespace azure-alb-system \
  --create-namespace \
  --set albController.namespace=azure-alb-system \
  --set albController.podIdentity.clientID=$IDENTITY_CLIENT_ID

kubectl wait --namespace azure-alb-system \
  --for=condition=ready pod \
  --selector=app=alb-controller \
  --timeout=90s
```

```yaml
# agc.yaml — ApplicationLoadBalancer + HTTPRoute
apiVersion: alb.networking.azure.io/v1
kind: ApplicationLoadBalancer
metadata:
  name: fabtech-alb
  namespace: fabtech
spec:
  associations:
  - /subscriptions/<SUB_ID>/resourceGroups/<NODE_RG>/providers/Microsoft.Network/virtualNetworks/<VNET>/subnets/<AGC_SUBNET>
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: fabtech-agc-route
  namespace: fabtech
spec:
  parentRefs:
  - name: fabtech-alb
    namespace: fabtech
    group: alb.networking.azure.io
    kind: ApplicationLoadBalancer
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /
    backendRefs:
    - name: fabtech-web
      port: 3000
```

### Helm Upgrade & Rollback

```bash
helm upgrade fabtech ./fabtech \
  --namespace $NAMESPACE \
  --set api.replicaCount=4

kubectl rollout status deployment/fabtech-api -n $NAMESPACE

helm rollback fabtech --namespace $NAMESPACE
helm history fabtech --namespace $NAMESPACE
```
