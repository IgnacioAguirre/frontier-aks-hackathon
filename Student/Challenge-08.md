# Challenge 08 — AKS Security

[< Previous Challenge](./Challenge-07.md) — **[Home](../README.md)** — [Next Challenge >](./Challenge-09.md)

## Introduction

A secure AKS platform uses layered controls rather than a single feature. In this challenge you will strengthen identity, authorization, admission control, and east-west traffic restrictions for the FabTech workload.

## Description

- Integrate the AKS cluster with Microsoft Entra ID and Azure RBAC for Kubernetes authorization.
- Create a developer access pattern that is limited to the FabTech namespace and supports read and troubleshooting tasks without broad cluster administration.
- Create an operator access pattern with the broader permissions needed to manage platform operations.
- Enable the Azure Policy add-on and apply guardrails that restrict workloads to trusted images from Azure Container Registry.
- Add policy enforcement that denies privileged containers and other high-risk pod configurations.
- Define network isolation so that only the web workload can reach the API workload and other unnecessary paths are denied.
- Validate that the resulting design enforces least privilege at the identity, admission, and network layers.

## Hints

- Use built-in AKS RBAC roles where they fit before designing anything custom.
- Azure Policy on AKS extends Gatekeeper concepts for admission control.
- Start with a deny-by-default network posture, then add only the traffic paths the application needs.
- Trusted registry controls are most useful when paired with a clear image publishing path.

## Notes

- NOTE: Keep this challenge focused on AKS security controls. Flux v1 migration is not part of this exercise.
- NOTE: AAD Pod Identity is deprecated. If identity for workloads comes up, the modern pattern is Workload Identity.
- NOTE: Namespace-scoped access should be demonstrably different from cluster-wide operator access.

## Optional Advanced

- Enable Microsoft Defender for Containers and review the protections it adds for images, runtime signals, and cluster posture.
- Compare the security signals from Azure Policy and Defender to understand prevention versus detection.
- Extend the network controls to include egress restrictions for application pods.

## Success Criteria

1. A developer identity can view and troubleshoot resources in the FabTech namespace without broad cluster-wide access.
2. An operator identity has the permissions required to manage the cluster and its workloads.
3. Azure Policy blocks privileged pod configurations and restricts workloads to trusted registry sources.
4. Network policy enforcement allows web-to-api traffic and blocks disallowed paths.
5. You can explain to your coach how RBAC, policy, network policy, and Defender work together as defense in depth.

## Learning Resources

- [Use Azure RBAC for Kubernetes authorization in AKS](https://learn.microsoft.com/azure/aks/manage-azure-rbac)
- [Azure Policy for Kubernetes](https://learn.microsoft.com/azure/governance/policy/concepts/policy-for-kubernetes)
- [Secure traffic between pods using network policies in AKS](https://learn.microsoft.com/azure/aks/use-network-policies)
- [Microsoft Defender for Containers](https://learn.microsoft.com/azure/defender-for-cloud/defender-for-containers-introduction)
- [Workload identity overview for AKS](https://learn.microsoft.com/azure/aks/workload-identity-overview)
