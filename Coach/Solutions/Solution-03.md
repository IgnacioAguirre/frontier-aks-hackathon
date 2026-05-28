# Challenge 03 — App Deployment & Helm Ingress — Coach Solution

[< Previous Solution](./Solution-02.md) | [Home](../../README.md) | [Next Solution >](./Solution-04.md)

## Notes & Guidance

- The most common mistake is using `apiVersion: extensions/v1beta1` for Ingress — this was
  **removed in Kubernetes 1.22**. Only `networking.k8s.io/v1` is valid.
- Another common error: using the annotation `kubernetes.io/ingress.class: nginx` instead of
  the spec field `spec.ingressClassName: webapprouting.kubernetes.azure.com`. The annotation
  is deprecated — enforce use of `spec.ingressClassName`.
- For the database, steer teams toward **Azure Database for PostgreSQL Flexible Server** unless
  time is tight. The in-cluster option is fine for a quick demo but should not be used as a
  production pattern.
- If teams use `nip.io` for the hostname, the ingress IP is the public IP of the NGINX controller
  in the `app-routing-system` namespace.

### Common Issues

- **App Routing add-on already enabled:** If using AKS Automatic, the App Routing add-on may
  already be enabled. Check: `az aks addon show --addon web_application_routing`.
- **Helm chart rendering errors:** Run `helm template ./fabtech` to debug before installing.
- **Ingress not reachable:** Check `kubectl get ingress -n fabtech` for ADDRESS. If empty,
  the App Routing add-on is not fully ready — check `kubectl get pods -n app-routing-system`.

## Solution

### Enable App Routing Add-on

```bash
RG=rg-frontier-aks
CLUSTER_NAME=aks-frontier

az aks addon enable \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --addon web_application_routing

# Get the public IP of the ingress controller
INGRESS_IP=$(kubectl get service nginx \
  --namespace app-routing-system \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "Ingress IP: $INGRESS_IP"
```

### Create the Helm Chart

```bash
ACR_NAME=<ACR_NAME>
NAMESPACE=fabtech

helm create fabtech
```

Reference `values.yaml` for the Helm chart:

```yaml
# values.yaml
api:
  image:
    repository: <ACR_LOGIN_SERVER>/fabtech-api
    tag: v1
  replicaCount: 2
  resources:
    requests:
      cpu: 250m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 512Mi
  service:
    port: 3001

web:
  image:
    repository: <ACR_LOGIN_SERVER>/fabtech-web
    tag: v1
  replicaCount: 2
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 200m
      memory: 256Mi
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

Reference Ingress template (`templates/ingress.yaml`):

```yaml
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "fabtech.fullname" . }}
  namespace: {{ .Release.Namespace }}
spec:
  ingressClassName: {{ .Values.ingress.className }}
  rules:
  {{- range .Values.ingress.hosts }}
  - host: {{ .host | quote }}
    http:
      paths:
      {{- range .paths }}
      - path: {{ .path }}
        pathType: {{ .pathType }}
        backend:
          service:
            name: {{ include "fabtech.fullname" $ }}-web
            port:
              number: {{ $.Values.web.service.port }}
      {{- end }}
  {{- end }}
{{- end }}
```

### Deploy

```bash
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)

helm upgrade --install fabtech ./fabtech \
  --namespace $NAMESPACE \
  --create-namespace \
  --set api.image.repository=$ACR_LOGIN_SERVER/fabtech-api \
  --set web.image.repository=$ACR_LOGIN_SERVER/fabtech-web

# Verify
kubectl get pods,svc,ingress -n $NAMESPACE
```

### Demonstrate Helm Upgrade and Rollback

```bash
# Upgrade — scale up replicas
helm upgrade fabtech ./fabtech \
  --namespace $NAMESPACE \
  --set api.replicaCount=4

kubectl rollout status deployment/fabtech-api -n $NAMESPACE

# Rollback
helm rollback fabtech --namespace $NAMESPACE
helm history fabtech --namespace $NAMESPACE
```
