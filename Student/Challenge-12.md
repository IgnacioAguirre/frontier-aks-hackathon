# Challenge 12 — AKS Fleet Manager

[< Previous Challenge](./Challenge-11.md) — **[Home](../README.md)** — [Next Challenge (Optional) >](./Challenge-13.md)

## Introduction

Operating many Kubernetes clusters one at a time does not scale well. In this challenge you will use AKS Fleet Manager to coordinate workload placement and staged platform operations across multiple clusters.

## Description

- Create an AKS Fleet Manager resource with a hub that can coordinate multi-cluster operations.
- Join at least two AKS clusters to the fleet as member clusters.
- Use the fleet hub to define a placement strategy for FabTech workloads across the member clusters.
- Apply a ClusterResourcePlacement so selected resources are propagated to the member clusters.
- Validate that propagated resources arrive where you expect and remain consistent across the selected clusters.
- Define a staged rollout strategy so one member cluster is updated before the others.
- Review how Fleet can coordinate Kubernetes version upgrades more safely than performing cluster upgrades independently.

## Hints

- Think of the hub as the control point and the member clusters as the execution targets.
- ClusterResourcePlacement is the core concept for workload propagation in this challenge.
- Staged rollout is most useful when you separate canary and broader production groups.
- Fleet adds value when you can prove consistent multi-cluster behavior rather than one-off manual changes.

## Notes

- NOTE: Use two or more member clusters so the fleet scenarios are meaningful.
- NOTE: Resource propagation and staged upgrades solve different problems and should both be demonstrated.
- NOTE: The workload propagation outcome should be visible on the member clusters, not only on the hub.

## Optional Advanced

- Create separate update groups for canary and production members and describe the promotion logic between them.
- Explore how fleet-wide governance can complement workload placement and upgrades.
- Compare the fleet approach with managing each cluster independently through separate operational runbooks.

## Success Criteria

1. A fleet hub exists and at least two member AKS clusters are joined to it.
2. A ClusterResourcePlacement propagates selected FabTech resources to member clusters.
3. A staged rollout strategy is defined so one cluster can be updated ahead of the others.
4. Fleet is prepared to coordinate Kubernetes version upgrades across the member clusters.
5. You can explain to your coach how Fleet reduces operational risk and duplicated effort in multi-cluster environments.

## Learning Resources

- [Azure Kubernetes Fleet Manager overview](https://learn.microsoft.com/azure/kubernetes-fleet/overview)
- [Update orchestration with Fleet Manager](https://learn.microsoft.com/azure/kubernetes-fleet/update-orchestration)
- [Resource propagation with Fleet Manager](https://learn.microsoft.com/azure/kubernetes-fleet/concepts-resource-propagation)
- [Resource propagation in Fleet Manager — concepts](https://learn.microsoft.com/azure/kubernetes-fleet/concepts-resource-propagation)
