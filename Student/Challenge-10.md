# Challenge 10 — Persistent Storage

[< Previous Challenge](./Challenge-09.md) — **[Home](../README.md)** — [Next Challenge >](./Challenge-11.md)

## Introduction

Kubernetes pods are ephemeral — when a pod dies, its local data is gone. In this challenge
you will configure **persistent storage** for the FabTechOps database using:

- **Azure Disk** (block storage — for single-node, high-performance workloads like databases)
- **Azure Files** (shared file storage — for multi-pod access, e.g., file uploads)
- **Dynamic provisioning** — AKS automatically creates the underlying storage resource
- **Azure Backup for AKS** — snapshot and restore PersistentVolumeClaims

## Description

### Part 1: Deploy PostgreSQL with Persistent Storage (Azure Disk)

Replace the in-memory database from Challenge 03 with a StatefulSet backed by an Azure Disk:

```yaml
# postgres-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: fabtech
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:16
        env:
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: fabtech-db-secret
              key: password
        - name: POSTGRES_DB
          value: fabtech
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: managed-csi-premium
      resources:
        requests:
          storage: 10Gi
```

```bash
kubectl apply -f postgres-statefulset.yaml -n fabtech
kubectl get pvc -n fabtech
kubectl get pv
```

Verify the Azure Disk was created:

```bash
# The PV name contains the disk resource ID
kubectl describe pv $(kubectl get pv -o jsonpath='{.items[0].metadata.name}') | grep VolumeHandle
```

### Part 2: Verify Data Persistence

Write data to the database, then delete the pod and verify data survives:

```bash
# Write some data
POSTGRES_POD=$(kubectl get pod -n fabtech -l app=postgres -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n fabtech $POSTGRES_POD -- \
  psql -U postgres -d fabtech -c "CREATE TABLE test (id SERIAL, value TEXT); INSERT INTO test (value) VALUES ('persistence-test');"

# Delete the pod (StatefulSet will recreate it)
kubectl delete pod $POSTGRES_POD -n fabtech

# Wait for the new pod to be ready
kubectl get pods -n fabtech -w

# Verify data survived
NEW_POD=$(kubectl get pod -n fabtech -l app=postgres -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n fabtech $NEW_POD -- psql -U postgres -d fabtech -c "SELECT * FROM test;"
```

### Part 3: Azure Files — Shared Storage for Multi-Pod Access

Azure Disk uses `ReadWriteOnce` — only one pod can mount it at a time. For shared storage,
use Azure Files with `ReadWriteMany`:

```yaml
# shared-pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: fabtech-uploads
  namespace: fabtech
spec:
  accessModes:
  - ReadWriteMany
  storageClassName: azurefile-csi-premium
  resources:
    requests:
      storage: 5Gi
```

```bash
kubectl apply -f shared-pvc.yaml
kubectl get pvc fabtech-uploads -n fabtech
```

Mount the shared volume in both the API and web deployments:

```yaml
# Add to the deployment spec:
volumes:
- name: uploads
  persistentVolumeClaim:
    claimName: fabtech-uploads
containers:
- name: api
  volumeMounts:
  - name: uploads
    mountPath: /app/uploads
```

Verify multiple pods can write simultaneously:

```bash
API_POD=$(kubectl get pod -n fabtech -l app=fabtech-api -o jsonpath='{.items[0].metadata.name}')
WEB_POD=$(kubectl get pod -n fabtech -l app=fabtech-web -o jsonpath='{.items[0].metadata.name}')

kubectl exec -n fabtech $API_POD -- sh -c "echo 'from-api' > /app/uploads/test.txt"
kubectl exec -n fabtech $WEB_POD -- cat /app/uploads/test.txt
# Expected output: from-api
```

### Part 4: Storage Classes and Premium SSD v2

List available storage classes:

```bash
kubectl get storageclass
```

Key storage classes on AKS:

| Storage Class | Type | Access Mode | Best For |
|--------------|------|-------------|----------|
| `managed-csi` | Azure Disk Standard SSD | RWO | Dev/test databases |
| `managed-csi-premium` | Azure Disk Premium SSD | RWO | Production databases |
| `azurefile-csi` | Azure Files Standard | RWX | Shared file access |
| `azurefile-csi-premium` | Azure Files Premium | RWX | High-performance shared files |

### Part 5: Azure Backup for AKS

Enable AKS Backup to protect PersistentVolumeClaims:

```bash
# Create a backup vault
az dataprotection backup-vault create \
  --resource-group $RG \
  --vault-name bv-frontier \
  --location eastus \
  --storage-settings "[{type:LocallyRedundant,datastore-type:VaultStore}]"

# Enable trusted access for the backup vault on AKS
az aks trustedaccess rolebinding create \
  --resource-group $RG \
  --cluster-name $CLUSTER_NAME \
  --name backup-access \
  --source-resource-id \
  $(az dataprotection backup-vault show --resource-group $RG --vault-name bv-frontier --query id -o tsv) \
  --roles Microsoft.DataProtection/backupVaults/backup-operator
```

Create a backup policy targeting the `fabtech` namespace PVCs:

```bash
# In the Azure Portal: Backup center → + Backup → AKS → Select cluster and namespace
# Or use the az dataprotection backup-policy create CLI
```

Simulate a restore by deleting a PVC and restoring from backup.

## Success Criteria

1. PostgreSQL runs as a `StatefulSet` with an Azure Disk PVC — show `kubectl get pvc -n fabtech`.
2. Data **persists** after deleting and recreating the PostgreSQL pod.
3. Azure Files PVC is created with `ReadWriteMany` access mode — show both pods writing to it.
4. Explain to your coach when to use **Azure Disk** vs **Azure Files** vs **in-cluster storage**.

## Learning Resources

- [Storage options in AKS](https://learn.microsoft.com/azure/aks/concepts-storage)
- [Azure Disk CSI driver](https://learn.microsoft.com/azure/aks/azure-disk-csi)
- [Azure Files CSI driver](https://learn.microsoft.com/azure/aks/azure-files-csi)
- [Azure Backup for AKS](https://learn.microsoft.com/azure/backup/azure-kubernetes-service-backup-overview)
- [StatefulSets in Kubernetes](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
