# Challenge 04 — Workload Identity & Secrets — Coach Solution

[< Previous Solution](./Solution-03.md) | [Home](../../README.md) | [Next Solution >](./Solution-05.md)

## Notes & Guidance

- The most common failure is forgetting to **annotate the Kubernetes ServiceAccount** with
  `azure.workload.identity/client-id`. The pod gets a token but it belongs to no identity.
- The `SecretProviderClass` requires the exact `tenantId` and `clientID` — teams copy-paste
  errors here constantly. A `describe` on the pod shows the mount error clearly.
- `syncSecret.enabled=true` in the CSI Helm values is required to sync Key Vault secrets as
  Kubernetes Secret objects. Without it, secrets are only available as mounted files.
- The `azure.workload.identity/use: "true"` label must be on the **Pod** (not Deployment
  selector labels alone) — it flows via the pod template spec labels.
- Verify CSI driver running: `kubectl get pods -n kube-system | grep secrets-store`

## Solution

### Part 1: Key Vault and Secret

```bash
RG=rg-frontier-aks
LOCATION=eastus
KV_NAME=kv-frontier-$RANDOM

az keyvault create \
  --resource-group $RG \
  --name $KV_NAME \
  --location $LOCATION \
  --enable-rbac-authorization true

# Store the secret
az keyvault secret set \
  --vault-name $KV_NAME \
  --name "db-connection-string" \
  --value "Server=<DB_HOST>;Database=fabtech;User Id=fabadmin;Password=<DB_PASS>;"

echo "Key Vault: $KV_NAME"
```

### Part 2: Managed Identity and Federated Credential

```bash
CLUSTER_NAME=aks-frontier
NAMESPACE=fabtech
SA_NAME=fabtech-api-sa
MI_NAME=mi-fabtech-api

# Create the identity
MI=$(az identity create --resource-group $RG --name $MI_NAME)
MI_CLIENT_ID=$(echo $MI | jq -r '.clientId')
MI_OBJECT_ID=$(echo $MI | jq -r '.principalId')

# Grant Key Vault Secrets User role
KV_ID=$(az keyvault show --name $KV_NAME --query id -o tsv)
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee-object-id $MI_OBJECT_ID \
  --assignee-principal-type ServicePrincipal \
  --scope $KV_ID

# Get cluster OIDC issuer
OIDC_ISSUER=$(az aks show \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --query "oidcIssuerProfile.issuerUrl" -o tsv)

# Create Kubernetes ServiceAccount
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
kubectl create serviceaccount $SA_NAME --namespace $NAMESPACE

# Annotate it
kubectl annotate serviceaccount $SA_NAME \
  --namespace $NAMESPACE \
  "azure.workload.identity/client-id=$MI_CLIENT_ID"

# Create federated credential
az identity federated-credential create \
  --name fc-fabtech-api \
  --identity-name $MI_NAME \
  --resource-group $RG \
  --issuer $OIDC_ISSUER \
  --subject "system:serviceaccount:${NAMESPACE}:${SA_NAME}" \
  --audience api://AzureADTokenExchange
```

### Part 3: Secrets Store CSI Driver

```bash
helm repo add csi-secrets-store-provider-azure \
  https://azure.github.io/secrets-store-csi-driver-provider-azure/charts
helm repo update

helm install csi-secrets-store \
  csi-secrets-store-provider-azure/csi-secrets-store-provider-azure \
  --namespace kube-system \
  --set secrets-store-csi-driver.syncSecret.enabled=true
```

`SecretProviderClass` manifest:

```yaml
# secretproviderclass.yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: fabtech-secrets
  namespace: fabtech
spec:
  provider: azure
  parameters:
    usePodIdentity: "false"
    useVMManagedIdentity: "false"
    clientID: "<MI_CLIENT_ID>"
    keyvaultName: "<KV_NAME>"
    cloudName: ""
    objects: |
      array:
        - |
          objectName: db-connection-string
          objectType: secret
    tenantId: "<TENANT_ID>"
  secretObjects:
    - data:
        - key: connectionString
          objectName: db-connection-string
      secretName: fabtech-db-secret
      type: Opaque
```

```bash
TENANT_ID=$(az account show --query tenantId -o tsv)
sed -e "s/<MI_CLIENT_ID>/$MI_CLIENT_ID/g" \
    -e "s/<KV_NAME>/$KV_NAME/g" \
    -e "s/<TENANT_ID>/$TENANT_ID/g" \
    secretproviderclass.yaml | kubectl apply -f -
```

### Part 4: Update Deployment

Key additions to the deployment pod spec:

```yaml
spec:
  serviceAccountName: fabtech-api-sa
  labels:
    azure.workload.identity/use: "true"
  volumes:
  - name: secrets-store
    csi:
      driver: secrets-store.csi.k8s.io
      readOnly: true
      volumeAttributes:
        secretProviderClass: fabtech-secrets
  containers:
  - name: api
    volumeMounts:
    - name: secrets-store
      mountPath: /mnt/secrets
      readOnly: true
    env:
    - name: DB_CONNECTION_STRING
      valueFrom:
        secretKeyRef:
          name: fabtech-db-secret
          key: connectionString
```

### Verify

```bash
POD=$(kubectl get pod -n fabtech -l app=fabtech-api -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n fabtech $POD -- cat /mnt/secrets/db-connection-string
```
