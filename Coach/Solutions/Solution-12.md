# Challenge 12 — AKS Fleet Manager — Coach Solution

[< Previous Solution](./Solution-11.md) | [Home](../../README.md) | [Next Solution (Optional) >](./Solution-13.md)

## Notes & Guidance

- **Fleet hub creation takes ~5 minutes.** Set expectations early.
- `ClusterResourcePlacement` resources are applied on the **Fleet hub cluster** kubeconfig,
  not the member cluster kubeconfig. Teams frequently apply to the wrong cluster.
- The `placement.kubernetes-fleet.io` CRDs only exist on the Fleet hub cluster.
- For teams with only one cluster: use `aks-frontier-private` from Challenge 11 as the second
  member — no need to create a new cluster.
- The **upgrade run** demo is impressive — show the staged strategy even if not fully
  executing it (describing it is sufficient for the success criterion).
- **RBAC required before `kubectl get memberclusters` works.** After creating the fleet hub
  and getting credentials, you must assign **two** roles to yourself on the fleet resource:
  1. `Azure Kubernetes Fleet Manager RBAC Cluster Admin` (Kubernetes RBAC on the hub)
  2. `Azure Kubernetes Fleet Manager Contributor Role` (ARM-level access to the hub API)
  Without both, all `kubectl` commands against the hub return `403 Forbidden`.
- **`az fleet get-credentials` does not support `--admin`** — there is only one credential
  type. Always run `kubelogin convert-kubeconfig -l azurecli` after getting credentials.
- **`az fleet member list` group field:** The `updateGroup` property does not appear in the
  `--query` with the property name `updateGroup`. Use `-o json` and parse the `group` field.

### Common Issues

- **`kubectl get memberclusters` returns `403 Forbidden`:** Assign both
  `Azure Kubernetes Fleet Manager RBAC Cluster Admin` AND
  `Azure Kubernetes Fleet Manager Contributor Role` to your user on the fleet resource scope.
  Wait ~30 seconds for role propagation, then re-run `az fleet get-credentials`.
- **`az fleet` commands not found:** Requires `az fleet` extension:
  `az extension add --name fleet`
- **Member cluster join fails:** The Fleet hub and member clusters must be in the same or
  peered subscription. Cross-subscription requires additional RBAC.
- **ClusterResourcePlacement stuck in Scheduled but not Applied:** Check the member cluster
  has the required CRDs. Simple resources (ConfigMap, Namespace) are safest for the demo.
- **`az fleet updaterun create` requires a start command:** Creating the run does NOT start it.
  After creation, run `az fleet updaterun start` separately. The run state will be `NotStarted`
  until you explicitly start it.

## Solution

### Part 1: Create Fleet Hub

```bash
RG=rg-frontier-aks
LOCATION=swedencentral
FLEET_NAME=fleet-frontier

az extension add --name fleet --upgrade

az fleet create \
  --resource-group $RG \
  --name $FLEET_NAME \
  --location $LOCATION \
  --enable-hub

echo "Fleet hub created: $FLEET_NAME"

# ⚠️ REQUIRED: Assign RBAC before kubectl will work against the hub
MY_ID=$(az ad signed-in-user show --query id -o tsv)
FLEET_ID=$(az fleet show --resource-group $RG --name $FLEET_NAME --query id -o tsv)

az role assignment create \
  --role "Azure Kubernetes Fleet Manager RBAC Cluster Admin" \
  --assignee $MY_ID \
  --scope $FLEET_ID

az role assignment create \
  --role "Azure Kubernetes Fleet Manager Contributor Role" \
  --assignee $MY_ID \
  --scope $FLEET_ID

# Wait ~30s for role propagation, then get credentials
sleep 30
az fleet get-credentials \
  --resource-group $RG \
  --name $FLEET_NAME \
  --overwrite-existing
```

### Part 2: Join Member Clusters

```bash
CLUSTER_1=aks-frontier
CLUSTER_2=aks-frontier-private  # from Challenge 11

# Join cluster 1
az fleet member create \
  --resource-group $RG \
  --fleet-name $FLEET_NAME \
  --name member1 \
  --member-cluster-id \
    $(az aks show -g $RG -n $CLUSTER_1 --query id -o tsv)

# Join cluster 2
az fleet member create \
  --resource-group $RG \
  --fleet-name $FLEET_NAME \
  --name member2 \
  --member-cluster-id \
    $(az aks show -g $RG -n $CLUSTER_2 --query id -o tsv)

# List members — both should show JOINED=True
kubectl get memberclusters
```

### Part 3: Workload Propagation with ClusterResourcePlacement

First, create the resource to propagate on the fleet hub:

```yaml
# fabtech-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: fabtech
  labels:
    fleet.azure.com/managed: "true"
```

```bash
kubectl apply -f fabtech-namespace.yaml
```

`ClusterResourcePlacement` to propagate to all members:

```yaml
# crp-fabtech.yaml
apiVersion: placement.kubernetes-fleet.io/v1beta1
kind: ClusterResourcePlacement
metadata:
  name: fabtech-namespace
spec:
  resourceSelectors:
  - group: ""
    kind: Namespace
    version: v1
    name: fabtech
  policy:
    placementType: PickAll
```

```bash
kubectl apply -f crp-fabtech.yaml

# Watch propagation — should reach Available=True within ~30s
kubectl get clusterresourceplacement fabtech-namespace -w

# Verify on member clusters
# member1 (aks-frontier): switch context
kubectl config use-context aks-frontier
kubectl get namespace fabtech

# member2 (aks-frontier-private): use command invoke (private cluster, no direct kubectl)
az aks command invoke \
  --resource-group $RG \
  --name $CLUSTER_2 \
  --command "kubectl get namespace fabtech"
```

### Part 4: Staged Rollout Strategy for Upgrades

```bash
# Assign members to DIFFERENT update groups for true staged rollout
# member1 = canary (first), member2 = production (second)
az fleet member update \
  --resource-group $RG \
  --fleet-name $FLEET_NAME \
  --name member1 \
  --update-group canary

az fleet member update \
  --resource-group $RG \
  --fleet-name $FLEET_NAME \
  --name member2 \
  --update-group production

# Verify group assignments
az fleet member list --resource-group $RG --fleet-name $FLEET_NAME -o json | \
  python3 -c "import sys,json; [print(m['name'],'->', m.get('group','?')) for m in json.load(sys.stdin)]"

# Create a stages definition file — canary stage first with 60s wait, then production
cat > stages.json << 'EOF'
{
  "stages": [
    {
      "name": "canary",
      "groups": [
        {
          "name": "canary"
        }
      ],
      "afterStageWaitInSeconds": 60
    },
    {
      "name": "production",
      "groups": [
        {
          "name": "production"
        }
      ]
    }
  ]
}
EOF

# Create the upgrade run (NodeImageOnly is safe — no K8s version change needed)
# For a full K8s version upgrade, use --upgrade-type Full --kubernetes-version <version>
az fleet updaterun create \
  --resource-group $RG \
  --fleet-name $FLEET_NAME \
  --name staged-nodeimage \
  --upgrade-type NodeImageOnly \
  --stages @stages.json

# Show the run configuration
az fleet updaterun show \
  --resource-group $RG \
  --fleet-name $FLEET_NAME \
  --name staged-nodeimage \
  --query "{name:name, upgradeType:managedClusterUpdate.upgrade.type, stages:strategy.stages[].{name:name, groups:groups[].name, waitSeconds:afterStageWaitInSeconds}}" -o json

# ⚠️ NOTE: Creating the run does NOT start it.
# To start the run (this will begin updating member1/canary first):
# az fleet updaterun start --resource-group $RG --fleet-name $FLEET_NAME --name staged-nodeimage
```

> **For K8s version upgrades:** Use `--upgrade-type Full --kubernetes-version <version>` instead
> of `NodeImageOnly`. Check available versions first:
> ```bash
> az aks get-versions -l swedencentral --query "values[].version" -o tsv
> ```
