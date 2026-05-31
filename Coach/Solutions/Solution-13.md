# Solution 13 — FinOps & Cost Management

[< Previous Solution](./Solution-12.md) | [Home](../../README.md) | [Next Solution (Optional) >](./Solution-AI-01.md)

## Overview

This solution covers:
1. Enabling the AKS Cost Analysis add-on
2. Tagging resources for chargeback
3. Adding a spot node pool with the correct tolerations
4. Setting resource requests and limits on fabtech workloads
5. Reviewing Advisor cost recommendations

---

## Part 1: Enable the AKS Cost Analysis Add-on

The Cost Analysis add-on exports per-namespace / per-workload billing data to Azure
Cost Management. It requires AKS Standard or Premium tier (not Free).

```bash
# Upgrade to Standard tier if not already done
az aks update \
  --name $CLUSTER_NAME \
  --resource-group $RG \
  --tier standard

# Enable cost analysis
az aks update \
  --name $CLUSTER_NAME \
  --resource-group $RG \
  --enable-cost-analysis
```

Wait ~5 minutes, then navigate to:
**Azure Portal → Your AKS cluster → Cost Analysis**

You should see a cost breakdown by namespace and by workload (Deployment/DaemonSet etc.).

> **Coach note:** If the portal blade is empty, confirm the add-on is reporting:
> `az aks show -n $CLUSTER_NAME -g $RG --query "addonProfiles.costAnalysis.enabled"`

---

## Part 2: Tag Resources for Chargeback

```bash
# Tag the cluster resource group
az group update \
  --name $RG \
  --tags environment=hackathon team=platform

# Tag the AKS cluster resource itself
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

```bash
az aks nodepool add \
  --name spotnp \
  --cluster-name $CLUSTER_NAME \
  --resource-group $RG \
  --node-count 1 \
  --priority Spot \
  --eviction-policy Delete \
  --spot-max-price -1 \
  --node-vm-size Standard_D4s_v5 \
  --labels "spot=true" \
  --no-wait
```

Verify the node pool and its taint:
```bash
kubectl get nodes --show-labels | grep spot
# Spot nodes automatically receive the taint:
# kubernetes.azure.com/scalesetpriority=spot:NoSchedule
```

### Deploy a Spot-Tolerant Workload

Add tolerations and nodeAffinity to your Helm values or an example manifest:

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
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
              - matchExpressions:
                  - key: "kubernetes.azure.com/scalesetpriority"
                    operator: In
                    values:
                      - "spot"
      terminationGracePeriodSeconds: 30
      containers:
        - name: api
          image: <your-acr>.azurecr.io/fabtech-api:v1
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
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
kubectl get pods -n fabtech -o wide   # pod should land on a spot node
```

---

## Part 4: Set Resource Requests and Limits on fabtech Deployments

Without resource requests, the scheduler cannot make accurate placement decisions
and NAP/Karpenter may provision over-sized nodes. Patch existing deployments:

```bash
# Patch fabtech-api
kubectl set resources deployment fabtech-api \
  -n fabtech \
  --requests="cpu=100m,memory=128Mi" \
  --limits="cpu=500m,memory=256Mi"

# Patch fabtech-web
kubectl set resources deployment fabtech-web \
  -n fabtech \
  --requests="cpu=100m,memory=64Mi" \
  --limits="cpu=250m,memory=128Mi"
```

Verify:
```bash
kubectl describe deployment fabtech-api -n fabtech | grep -A4 "Limits\|Requests"
```

> **Coach note:** A common mistake is setting `limits` but not `requests`. When
> only `limits` is set, requests default to equal limits, which causes over-reservation.
> Guide teams to set requests to the *typical* usage and limits to the *peak* usage.

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
