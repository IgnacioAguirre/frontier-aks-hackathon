# Challenge 03 — App Deployment & Helm Ingress

[< Previous Challenge](./Challenge-02.md) — **[Home](../README.md)** — [Next Challenge >](./Challenge-04.md)

## Introduction

With a cluster running, it is time to deploy the **FabTechOps** application. You will:

1. Deploy the application using **Helm** — the Kubernetes package manager.
2. Expose it to the internet using the **App Routing add-on** (NGINX-based, GA) — the
   modern replacement for the deprecated HTTP Application Routing preview add-on.
3. Add a DNS label and configure host-based routing.

## Description

### Part 1: Enable the App Routing Add-on

The App Routing add-on provides a managed, production-grade NGINX ingress controller.

```bash
RG=rg-frontier-aks
CLUSTER_NAME=aks-frontier

az aks addon enable \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --addon web_application_routing
```

Verify the ingress controller pods are running:

```bash
kubectl get pods -n app-routing-system
```

Get the public IP address assigned to the ingress controller:

```bash
kubectl get service nginx -n app-routing-system -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
INGRESS_IP=$(kubectl get service nginx -n app-routing-system -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "Ingress IP: $INGRESS_IP"
```

### Part 2: Deploy a Database

Deploy a PostgreSQL instance. You can use either:

**Option A — Azure Database for PostgreSQL Flexible Server (recommended)**

```bash
DB_NAME=fabtech-db-$RANDOM
DB_USER=fabadmin
DB_PASSWORD=$(openssl rand -base64 24)

az postgres flexible-server create \
  --resource-group $RG \
  --name $DB_NAME \
  --admin-user $DB_USER \
  --admin-password "$DB_PASSWORD" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --public-access 0.0.0.0
```

> **Note:** Challenge 04 will harden this by moving to private endpoints.

**Option B — In-cluster PostgreSQL (for development only)**

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install postgres bitnami/postgresql \
  --namespace fabtech --create-namespace \
  --set auth.postgresPassword=changeme
```

### Part 3: Create a Helm Chart for FabTechOps

Create a minimal Helm chart structure:

```bash
helm create fabtech
```

Update `fabtech/values.yaml` with the following key values (replace placeholders):

```yaml
api:
  image:
    repository: <ACR_LOGIN_SERVER>/fabtech-api
    tag: v1
  replicaCount: 2

web:
  image:
    repository: <ACR_LOGIN_SERVER>/fabtech-web
    tag: v1
  replicaCount: 2

ingress:
  enabled: true
  className: webapprouting.kubernetes.azure.com
  hosts:
    - host: fabtech.<INGRESS_IP>.nip.io
      paths:
        - path: /
          pathType: Prefix
```

> **Important:** Use `ingressClassName: webapprouting.kubernetes.azure.com` (the App Routing
> add-on class). Do **not** use `extensions/v1beta1` — that API was removed in Kubernetes 1.22.

### Part 4: Deploy with Helm

```bash
helm upgrade --install fabtech ./fabtech \
  --namespace fabtech \
  --create-namespace \
  --set api.image.repository=$ACR_LOGIN_SERVER/fabtech-api \
  --set web.image.repository=$ACR_LOGIN_SERVER/fabtech-web
```

Verify all pods are running:

```bash
kubectl get pods -n fabtech
kubectl get ingress -n fabtech
```

Access the application in a browser at `http://fabtech.<INGRESS_IP>.nip.io`.

### Part 5: Rolling Updates

Simulate a new version deployment:

```bash
# Update the image tag
helm upgrade fabtech ./fabtech \
  --namespace fabtech \
  --set api.image.tag=v2 \
  --set web.image.tag=v2
```

Watch the rollout:

```bash
kubectl rollout status deployment/fabtech-api -n fabtech
```

Roll back if needed:

```bash
helm rollback fabtech --namespace fabtech
```

## Success Criteria

1. The App Routing add-on is enabled and the NGINX ingress controller is running.
2. Both `fabtech-api` and `fabtech-web` deployments have at least 2 replicas running.
3. The application is accessible from a browser via the ingress IP or hostname.
4. Demonstrate a Helm upgrade (change the replica count) and a Helm rollback.
5. Show the Ingress resource uses `ingressClassName: webapprouting.kubernetes.azure.com`
   (not `extensions/v1beta1`).

## Learning Resources

- [App Routing add-on overview](https://learn.microsoft.com/azure/aks/app-routing)
- [Helm quickstart](https://helm.sh/docs/intro/quickstart/)
- [Kubernetes Ingress (networking.k8s.io/v1)](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [Kubernetes rolling updates](https://learn.microsoft.com/azure/aks/tutorial-kubernetes-app-update)
- [Azure Database for PostgreSQL Flexible Server](https://learn.microsoft.com/azure/postgresql/flexible-server/overview)
