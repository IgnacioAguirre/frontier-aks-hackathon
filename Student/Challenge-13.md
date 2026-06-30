# Challenge 13 — FinOps & Cost Management *(Optional)*

[< Previous Challenge](./Challenge-12.md) — **[Home](../README.md)**

## Introduction

Running Kubernetes at scale on AKS can generate significant cloud spend — but most
teams lack visibility into *who* is consuming *what* resources. This challenge applies
FinOps practices to your AKS cluster: enable the **AKS Cost Analysis add-on**, allocate
costs to namespaces and teams, and identify opportunities to reduce waste with spot node
pools and right-sizing.

## Description

- Enable the **AKS Cost Analysis add-on** and explore the cost breakdown by namespace
  and workload in the Azure Portal.
- Tag your AKS resource group and individual workloads with `team` and `environment`
  tags so costs can be attributed in Azure Cost Management.
- Add a **spot node pool** to the cluster and configure your application deployment to
  tolerate spot evictions (using the `kubernetes.azure.com/scalesetpriority=spot:NoSchedule`
  taint).
- Set **resource requests and limits** on your fabtech deployments and explain to your coach
  why missing requests cause Karpenter/NAP to over-provision nodes.
- Review the **Azure Advisor cost recommendations** for your cluster and discuss at least
  one actionable item.


## Success Criteria

1. The **AKS Cost Analysis** view in the Azure Portal shows cost breakdown by namespace.
2. The cluster has a spot node pool and at least one pod is scheduled on a spot node.
3. Your spot-tolerant deployment has the correct `tolerations` and `nodeSelector` or
   `nodeAffinity` for spot nodes.
4. All fabtech containers have both `resources.requests` and `resources.limits` set.
5. Explain to your coach: what happens to a spot node when Azure reclaims it, and how
   PodDisruptionBudgets and `terminationGracePeriodSeconds` help manage the eviction.

## Advanced Challenges (Optional)

- Use **Azure Cost Management** tags + a cost allocation rule to split costs between
  the `fabtech` and `cluster-config` namespaces by team.
- Configure a **budget alert** in Azure Cost Management that fires when the resource
  group spend exceeds a threshold you define.
- Use `kubectl-cost` (open-source CLI) to query namespace cost from your terminal.

## Learning Resources

- [AKS Cost Analysis add-on](https://learn.microsoft.com/azure/aks/cost-analysis)
- [Spot node pools in AKS](https://learn.microsoft.com/azure/aks/spot-node-pool)
- [Azure Cost Management overview](https://learn.microsoft.com/azure/cost-management-billing/cost-management-billing-overview)
- [Right-size resources with Vertical Pod Autoscaler](https://learn.microsoft.com/azure/aks/vertical-pod-autoscaler)
- [OpenCost / kubectl-cost](https://www.opencost.io/)
