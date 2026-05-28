# Challenge 04 — Workload Identity & Secrets Management

[< Previous Challenge](./Challenge-03.md) — **[Home](../README.md)** — [Next Challenge >](./Challenge-05.md)

## Introduction

Hardcoded passwords and connection strings in Kubernetes manifests are a security anti-pattern.
In this challenge you will eliminate secrets from your deployments by:

1. Using **Entra ID Workload Identity** so pods authenticate to Azure services without credentials.
2. Storing secrets in **Azure Key Vault** and mounting them into pods using the
   **Secrets Store CSI driver**.

> **No more Pod Identity.** The legacy AAD Pod Identity add-on is deprecated. Workload Identity
> uses standard Kubernetes service accounts federated with Entra ID — no DaemonSets required.

## Description

### Part 1: Create an Azure Key Vault

```bash
RG=rg-frontier-aks
LOCATION=eastus
KV_NAME=kv-frontier-$RANDOM

az keyvault create \
  --resource-group $RG \
  --name $KV_NAME \
  --location $LOCATION \
  --enable-rbac-authorization true

echo "Key Vault: $KV_NAME"
```

Store the database connection string as a secret:

```bash
az keyvault secret set \
  --vault-name $KV_NAME \
  --name "db-connection-string" \
  --value "Server=<DB_SERVER>;Database=fabtech;User Id=<DB_USER>;Password=<DB_PASSWORD>;"
```

### Part 2: Configure Workload Identity

#### 2a — Create a Managed Identity

```bash
MI_NAME=mi-fabtech-api
MI=$(az identity create --resource-group $RG --name $MI_NAME)
MI_CLIENT_ID=$(echo $MI | jq -r '.clientId')
MI_OBJECT_ID=$(echo $MI | jq -r '.principalId')
echo "Client ID: $MI_CLIENT_ID"
```

#### 2b — Grant Key Vault Secrets Access

```bash
KV_ID=$(az keyvault show --name $KV_NAME --query id -o tsv)

az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee-object-id $MI_OBJECT_ID \
  --assignee-principal-type ServicePrincipal \
  --scope $KV_ID
```

#### 2c — Create a Kubernetes Service Account with Federated Credential

```bash
CLUSTER_NAME=aks-frontier
NAMESPACE=fabtech
SA_NAME=fabtech-api-sa

# Get the OIDC issuer URL from the cluster
OIDC_ISSUER=$(az aks show --resource-group $RG --name $CLUSTER_NAME \
  --query "oidcIssuerProfile.issuerUrl" -o tsv)

# Create the Kubernetes service account
kubectl create serviceaccount $SA_NAME --namespace $NAMESPACE

# Create the federated credential (links Entra ID identity → K8s service account)
az identity federated-credential create \
  --name fc-fabtech-api \
  --identity-name $MI_NAME \
  --resource-group $RG \
  --issuer $OIDC_ISSUER \
  --subject "system:serviceaccount:${NAMESPACE}:${SA_NAME}" \
  --audience api://AzureADTokenExchange
```

Annotate the Kubernetes service account:

```bash
kubectl annotate serviceaccount $SA_NAME \
  --namespace $NAMESPACE \
  "azure.workload.identity/client-id=$MI_CLIENT_ID"
```

### Part 3: Mount Secrets via Secrets Store CSI Driver

Install the Secrets Store CSI driver and the Azure Key Vault provider:

```bash
helm repo add csi-secrets-store-provider-azure \
  https://azure.github.io/secrets-store-csi-driver-provider-azure/charts

helm install csi-secrets-store csi-secrets-store-provider-azure/csi-secrets-store-provider-azure \
  --namespace kube-system \
  --set secrets-store-csi-driver.syncSecret.enabled=true
```

Create a `SecretProviderClass` resource:

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

Update your API deployment to:
- Use the `$SA_NAME` service account
- Mount the CSI volume
- Add the `azure.workload.identity/use: "true"` label

Key deployment snippet:

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

### Part 4: Verify

```bash
# Get the API pod name
POD=$(kubectl get pod -n fabtech -l app=fabtech-api -o jsonpath='{.items[0].metadata.name}')

# Check the mounted secret
kubectl exec -n fabtech $POD -- cat /mnt/secrets/db-connection-string
```

## Success Criteria

1. Azure Key Vault exists with the `db-connection-string` secret.
2. A Managed Identity with a federated credential exists, linked to the `fabtech-api-sa` service account.
3. The `SecretProviderClass` is applied and the CSI driver mounts the secret.
4. The API pod reads the connection string from the mounted volume — **no hardcoded secrets in any manifest or environment variable**.
5. Explain to your coach why Workload Identity is superior to AAD Pod Identity.

## Learning Resources

- [Workload Identity on AKS](https://learn.microsoft.com/azure/aks/workload-identity-overview)
- [Use the Secrets Store CSI driver with AKS](https://learn.microsoft.com/azure/aks/csi-secrets-store-driver)
- [Azure Key Vault RBAC overview](https://learn.microsoft.com/azure/key-vault/general/rbac-guide)
- [Migrate from Pod Identity to Workload Identity](https://learn.microsoft.com/azure/aks/workload-identity-migrate-from-pod-identity)
