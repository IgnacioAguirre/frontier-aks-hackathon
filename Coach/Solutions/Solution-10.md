# Challenge 10 — Storage — Coach Solution

[< Previous Solution](./Solution-09.md) | [Home](../../README.md) | [Next Solution >](./Solution-11.md)

## Notes & Guidance

- Key concept to drive home: **ReadWriteOnce (RWO)** for Azure Disk (one pod at a time,
  not shareable across nodes); **ReadWriteMany (RWX)** for Azure Files (multiple pods,
  multiple nodes).
- `StatefulSet` with `volumeClaimTemplates` creates one PVC per pod replica. This is
  fundamentally different from a Deployment with one PVC — emphasize this pattern for
  stateful workloads (databases, message queues).
- Azure Backup for AKS is relatively new. The Portal wizard is easier than pure CLI.
  Good to show for completeness but not a blocker for the challenge.
- The `managed-csi-premium` storage class (Premium SSD) is preferred for production
  database workloads; `managed-csi` (Standard SSD) is fine for the hackathon.

### Common Issues

- **Pod stuck in Pending due to PVC not bound:** Check `kubectl describe pvc`. Common causes:
  wrong storage class name, zone mismatch between PVC and node.
- **Azure Files RWX mount failing:** Ensure the `azurefile-csi` or `azurefile-csi-premium`
  storage class is used. The NFS-based `azurefile-csi-premium` requires Premium SKU.
- **Data lost after pod deletion:** Usually means the pod was using `emptyDir` instead of a
  PVC, or the PVC was deleted along with the pod (StatefulSet `--cascade=orphan` avoids this).

## Solution

### Storage Classes Reference

```bash
kubectl get storageclass
# Key classes:
# managed-csi              → Standard SSD Azure Disk (RWO)
# managed-csi-premium      → Premium SSD Azure Disk (RWO)
# azurefile-csi            → Standard Azure Files (RWX)
# azurefile-csi-premium    → Premium Azure Files NFS (RWX)
```

### Part 1: PostgreSQL StatefulSet with Azure Disk (RWO)

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
        - name: data
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: managed-csi-premium
      resources:
        requests:
          storage: 10Gi
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: fabtech
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
  clusterIP: None
```

```bash
kubectl apply -f postgres-statefulset.yaml
kubectl get pvc -n fabtech
kubectl get pods -n fabtech -l app=postgres
```

### Part 2: Data Persistence Test

```bash
# Insert test data
kubectl exec -n fabtech postgres-0 -- \
  psql -U postgres -d fabtech -c "CREATE TABLE test (id serial, val text);"
kubectl exec -n fabtech postgres-0 -- \
  psql -U postgres -d fabtech -c "INSERT INTO test (val) VALUES ('persistent-data');"

# Delete the pod (StatefulSet will recreate it)
kubectl delete pod postgres-0 -n fabtech
kubectl wait --for=condition=Ready pod/postgres-0 -n fabtech --timeout=60s

# Verify data survived
kubectl exec -n fabtech postgres-0 -- \
  psql -U postgres -d fabtech -c "SELECT * FROM test;"
```

### Part 3: Azure Files Share for Shared Config (RWX)

```yaml
# shared-config-pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: shared-config
  namespace: fabtech
spec:
  accessModes:
  - ReadWriteMany
  storageClassName: azurefile-csi
  resources:
    requests:
      storage: 5Gi
```

```bash
kubectl apply -f shared-config-pvc.yaml
kubectl get pvc shared-config -n fabtech
# STATUS should be Bound
```

Mount in the API deployment to demonstrate shared access:

```yaml
volumes:
- name: shared-config
  persistentVolumeClaim:
    claimName: shared-config
containers:
- name: api
  volumeMounts:
  - name: shared-config
    mountPath: /app/config
```

### Part 4: Azure Backup for AKS (Optional)

```bash
# Enable Backup extension on the cluster
az k8s-extension create \
  --name azure-aks-backup \
  --extension-type microsoft.dataprotection.kubernetes \
  --scope cluster \
  --cluster-type managedClusters \
  --cluster-name $CLUSTER_NAME \
  --resource-group $RG \
  --release-train stable \
  --configuration-settings blobContainer=backup storageAccount=<STORAGE_ACCOUNT> \
    storageAccountResourceGroup=$RG storageAccountSubscriptionId=<SUB_ID>
```

Or use the Azure Portal: **AKS cluster > Backup > Enable backup**.
