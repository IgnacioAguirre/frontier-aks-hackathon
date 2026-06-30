# Solution 13 — FinOps & Cost Management

[< Previous Solution](./Solution-12.md) | [Home](../../README.md) | [Next Solution (Optional) >](./Solution-AI-01.md)

## Overview

This solution covers:
1. Enabling the AKS Cost Analysis add-on
2. Tagging resources for chargeback
3. Adding a spot node pool with the correct tolerations
4. Setting resource requests and limits on fabtech workloads
5. Reviewing Advisor cost recommendations

> ⚠️ **Important:** Every `az aks update` command triggers a full cluster reconciliation
> taking **7–10 minutes** each. Only one cluster operation can run at a time — attempting
> concurrent operations returns `OperationNotAllowed`. Chain them sequentially or combine
> flags into a single `az aks update` call where possible.

---

## Part 1: Enable the AKS Cost Analysis Add-on

The Cost Analysis add-on exports per-namespace / per-workload billing data to Azure
Cost Management. It requires AKS Standard or Premium tier (not Free).

```bash
RG=rg-frontier-aks
CLUSTER_NAME=aks-frontier

# Upgrade to Standard tier AND enable cost analysis in one operation (saves ~7 min)
az aks update \
  --name $CLUSTER_NAME \
  --resource-group $RG \
  --tier standard \
  --enable-cost-analysis
```

Wait ~10 minutes, then navigate to:
**Azure Portal → Your AKS cluster → Cost Analysis**

You should see a cost breakdown by namespace and by workload (Deployment/DaemonSet etc.).

> **Coach note:** To confirm cost analysis is active from the CLI:
> ```bash
> az aks show -n $CLUSTER_NAME -g $RG --query "metricsProfile.costAnalysis.enabled"
> ```
> Note: the field is `metricsProfile.costAnalysis.enabled`, NOT `addonProfiles.costAnalysis.enabled`.
> Cost data may take up to 24 hours to appear in the portal.

---

## Part 2: Tag Resources for Chargeback

> ⚠️ Wait for the `az aks update` in Part 1 to complete before running tagging —
> concurrent cluster operations fail with `OperationNotAllowed`.

```bash
# Tag the cluster resource group (instant — no cluster operation)
az group update \
  --name $RG \
  --tags environment=hackathon team=platform

# Tag the AKS cluster resource itself (~7-10 min)
az aks update \
  --name $CLUSTER_NAME \
  --resource-group $RG \
  --tags environment=hackathon team=platform
```

In Azure Cost Management, create a **cost allocation rule** (Cost Management →
Cost Allocation) to distribute shared cluster costs by tag:
- Split by `team` tag
- Assign cluster-level infrastructure costs proportionally to consumer namespaces

---

## Part 3: Add a Spot Node Pool

> **NAP/Karpenter note:** If your cluster has Node Autoprovision (NAP) enabled, Karpenter
> may already provision spot nodes from its `general` NodePool (labels:
> `karpenter.sh/capacity-type=spot`, `kubernetes.azure.com/scalesetpriority=spot`).
> The manual `spotnp` VMSS nodepool coexists with NAP and gives you a stable, predictable
> spot node for the demo. Target it with `nodeSelector: agentpool: spotnp`.

```bash
# Wait for any in-progress cluster operation to finish before adding nodepool
az aks nodepool add \
  --name spotnp \
  --cluster-name $CLUSTER_NAME \
  --resource-group $RG \
  --node-count 1 \
  --priority Spot \
  --eviction-policy Delete \
  --spot-max-price -1 \
  --node-vm-size Standard_D4s_v5 \
  --os-sku AzureLinux \
  --labels "spot=true"
```

Verify the node pool and its taint:
```bash
kubectl get nodes -l agentpool=spotnp --show-labels
# Spot nodes automatically receive the taint:
# kubernetes.azure.com/scalesetpriority=spot:NoSchedule
kubectl describe node -l agentpool=spotnp | grep Taint
```

### Deploy a Spot-Tolerant Workload

The key is: tolerate the spot taint AND use `nodeSelector: agentpool: spotnp` to
target the manual spot pool specifically (not the NAP-managed spot nodes).

```yaml
# spot-demo.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fabtech-api-spot
  namespace: fabtech
spec:
  replicas: 1
  selector:
    matchLabels:
      app: fabtech-api-spot
  template:
    metadata:
      labels:
        app: fabtech-api-spot
    spec:
      tolerations:
        - key: "kubernetes.azure.com/scalesetpriority"
          operator: "Equal"
          value: "spot"
          effect: "NoSchedule"
      nodeSelector:
        kubernetes.io/arch: amd64
        agentpool: spotnp
      terminationGracePeriodSeconds: 30
      containers:
        - name: api
          image: <ACR_NAME>.azurecr.io/fabtech-api:v2
          securityContext:
            runAsNonRoot: true
            runAsUser: 100
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
```

```bash
kubectl apply -f spot-demo.yaml
# Verify pod landed on the spotnp node (not a Karpenter node)
kubectl get pods -n fabtech -l app=fabtech-api-spot -o wide
```

---

## Part 4: Set Resource Requests and Limits on fabtech Deployments

Without resource requests, the scheduler cannot make accurate placement decisions
and NAP/Karpenter may provision over-sized nodes. Patch existing deployments:

```bash
# Patch fabtech-api (--containers flag avoids ambiguity when multiple containers exist)
kubectl set resources deployment fabtech-api \
  -n fabtech \
  --containers="api" \
  --requests="cpu=100m,memory=128Mi" \
  --limits="cpu=500m,memory=256Mi"

# Patch fabtech-web
kubectl set resources deployment fabtech-web \
  -n fabtech \
  --requests="cpu=100m,memory=64Mi" \
  --limits="cpu=250m,memory=128Mi"

# Also patch the canary deployment if it exists
kubectl set resources deployment fabtech-api-v2 \
  -n fabtech \
  --containers="api" \
  --requests="cpu=100m,memory=128Mi" \
  --limits="cpu=500m,memory=256Mi" 2>/dev/null || true
```

Verify:
```bash
for dep in fabtech-api fabtech-web fabtech-api-v2; do
  echo "=== $dep ==="
  kubectl get deployment $dep -n fabtech \
    -o jsonpath='{.spec.template.spec.containers[0].resources}' 2>/dev/null | python3 -m json.tool
done
```

> **Coach note:** A common mistake is setting `limits` but not `requests`. When
> only `limits` is set, requests default to equal limits, which causes over-reservation.
> Guide teams to set requests to the *typical* usage and limits to the *peak* usage.
> Also note: if the cluster uses Istio sidecars (2/2 pods), the sidecar container also
> consumes resources — this is outside the deployment spec but affects node capacity.

---

## Part 5: Azure Advisor Cost Recommendations

```bash
# List cost recommendations for the cluster's resource group
az advisor recommendation list \
  --resource-group $RG \
  --query "[?category=='Cost'].{Impact:impact,Title:shortDescription.problem}" \
  -o table
```

Common recommendations coaches should be ready to discuss:
- **Underutilized VMs** — suggests downsizing or deallocating nodes
- **Reserved Instances** — suggests 1-yr or 3-yr reservations for stable workloads
- **Orphaned disks** — PVCs from deleted pods whose PVs were not reclaimed

---

## Discussion Points

| Question | Expected Answer |
|----------|----------------|
| What happens when Azure reclaims a spot node? | AKS gets 30 s notice; kubelet evicts pods; PodDisruptionBudget limits simultaneous evictions; `terminationGracePeriodSeconds` gives the app time to drain connections. |
| Why is having only spot nodes risky? | If Azure reclaims all spot capacity in a zone, workloads have nowhere to run. Mix spot with on-demand for the critical path. |
| What is FinOps? | A cultural practice combining finance, engineering, and operations to control cloud spend. The three phases: Inform → Optimize → Operate. |
| How does namespace-level cost visibility help? | Teams can be shown their own spend, creating accountability and incentive to right-size. |
