# Challenge 12 — AKS Fleet Manager

[< Previous Challenge](./Challenge-11.md) — **[Home](../README.md)**

## Introduction

Large organizations run dozens or hundreds of Kubernetes clusters. Managing updates, policies,
and workload placement across all of them individually is operationally unsustainable.

**AKS Fleet Manager** provides a control plane for multi-cluster operations:
- Staged Kubernetes version upgrades across clusters
- Workload propagation from a hub to member clusters
- Consistent Azure Policy enforcement at fleet scope

## Description

### Part 1: Create an AKS Fleet

```bash
RG=rg-frontier-aks
LOCATION=eastus
FLEET_NAME=fleet-frontier

az fleet create \
  --resource-group $RG \
  --name $FLEET_NAME \
  --location $LOCATION \
  --enable-hub
```

The `--enable-hub` flag creates a **hub cluster** — a managed Kubernetes cluster that acts
as the Fleet control plane. Workloads deployed to the hub are propagated to member clusters.

Get credentials for the hub:

```bash
az fleet get-credentials \
  --resource-group $RG \
  --name $FLEET_NAME \
  --file ~/.kube/fleet-hub
export KUBECONFIG=~/.kube/fleet-hub
kubectl get nodes
```

### Part 2: Add Member Clusters

Register your existing clusters as fleet members:

```bash
CLUSTER_1_ID=$(az aks show --resource-group $RG --name aks-frontier --query id -o tsv)

az fleet member create \
  --resource-group $RG \
  --fleet-name $FLEET_NAME \
  --name member-1 \
  --member-cluster-id $CLUSTER_1_ID

# If you created the private cluster in Challenge 11:
CLUSTER_2_ID=$(az aks show --resource-group $RG --name aks-frontier-private --query id -o tsv)
az fleet member create \
  --resource-group $RG \
  --fleet-name $FLEET_NAME \
  --name member-2 \
  --member-cluster-id $CLUSTER_2_ID
```

List members:

```bash
az fleet member list --resource-group $RG --fleet-name $FLEET_NAME -o table
```

### Part 3: Staged Kubernetes Upgrade

Create an upgrade run with multiple stages (canary → production):

```bash
# Check what Kubernetes versions are available
az aks get-versions --location $LOCATION -o table

TARGET_K8S_VERSION=<new-version>  # e.g., 1.30.5

# Create update groups
az fleet updategroup create \
  --resource-group $RG \
  --fleet-name $FLEET_NAME \
  --name canary-group

az fleet updategroup create \
  --resource-group $RG \
  --fleet-name $FLEET_NAME \
  --name production-group

# Assign members to groups
az fleet member update \
  --resource-group $RG \
  --fleet-name $FLEET_NAME \
  --name member-1 \
  --update-group canary-group

az fleet member update \
  --resource-group $RG \
  --fleet-name $FLEET_NAME \
  --name member-2 \
  --update-group production-group
```

Create an update run strategy:

```bash
az fleet updaterun create \
  --resource-group $RG \
  --fleet-name $FLEET_NAME \
  --name upgrade-run-1 \
  --upgrade-type Full \
  --kubernetes-version $TARGET_K8S_VERSION \
  --stages '[
    {
      "name": "stage-canary",
      "groups": [{"name": "canary-group"}],
      "afterStageWaitInSeconds": 300
    },
    {
      "name": "stage-production",
      "groups": [{"name": "production-group"}]
    }
  ]'
```

Start the upgrade run:

```bash
az fleet updaterun start \
  --resource-group $RG \
  --fleet-name $FLEET_NAME \
  --name upgrade-run-1

# Monitor progress
az fleet updaterun show \
  --resource-group $RG \
  --fleet-name $FLEET_NAME \
  --name upgrade-run-1 \
  --query "status" -o jsonc
```

### Part 4: Workload Propagation to Member Clusters

The Fleet hub cluster supports **Kubernetes Fleet Placement** — deploy once to the hub,
and resources propagate to selected member clusters.

Apply a `ClusterResourcePlacement` on the hub:

```yaml
# placement.yaml
apiVersion: placement.kubernetes-fleet.io/v1beta1
kind: ClusterResourcePlacement
metadata:
  name: fabtech-placement
spec:
  resourceSelectors:
  - group: ""
    version: v1
    kind: Namespace
    name: fabtech
  - group: apps
    version: v1
    kind: Deployment
    name: fabtech-web
  policy:
    placementType: PickAll   # deploy to ALL member clusters
```

```bash
kubectl apply -f placement.yaml --kubeconfig ~/.kube/fleet-hub

# Check placement status
kubectl get clusterresourceplacement fabtech-placement -o yaml --kubeconfig ~/.kube/fleet-hub
```

Switch to a member cluster context and verify the workload arrived:

```bash
az aks get-credentials --resource-group $RG --name aks-frontier
kubectl get pods -n fabtech
```

### Part 5: Fleet-Wide Azure Policy

Apply an Azure Policy initiative at the Fleet (subscription/management group) scope to
enforce consistent security standards across all member clusters.

```bash
# Assign a policy at subscription scope (applies to all AKS clusters in the subscription)
az policy assignment create \
  --name "fleet-no-privileged" \
  --display-name "Fleet: Deny Privileged Containers" \
  --policy "95edb821-ddaf-4404-9732-666045e70341" \
  --scope "/subscriptions/$(az account show --query id -o tsv)" \
  --enforcement-mode Default
```

## Success Criteria

1. A Fleet with at least **2 member clusters** exists — show `az fleet member list` output.
2. An upgrade run is created (it does not need to complete if clusters are already on the
   latest version) — show the run's definition and stages.
3. A `ClusterResourcePlacement` is deployed from the hub and resources appear on a member
   cluster — show `kubectl get pods -n fabtech` on both clusters.
4. Explain to your coach how AKS Fleet Manager reduces operational overhead compared to
   managing each cluster individually with `az aks upgrade`.

## Learning Resources

- [AKS Fleet Manager overview](https://learn.microsoft.com/azure/kubernetes-fleet/overview)
- [Kubernetes version upgrades with Fleet](https://learn.microsoft.com/azure/kubernetes-fleet/update-orchestration)
- [Workload propagation with Fleet](https://learn.microsoft.com/azure/kubernetes-fleet/concepts-resource-propagation)
- [Fleet-wide Azure Policy](https://learn.microsoft.com/azure/governance/policy/overview)
