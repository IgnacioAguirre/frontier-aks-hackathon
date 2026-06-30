# Challenge 07 — GitOps with Flux v2

[< Previous Challenge](./Challenge-06.md) — **[Home](../README.md)** — [Next Challenge >](./Challenge-08.md)

## Introduction

GitOps turns your Git repository into the source of truth for cluster state. In this challenge you will connect AKS to a repository, let Flux v2 reconcile the desired state, and prove that changes flow through Git instead of direct cluster edits.

## Description

- Use your **fork of this hackathon repository** as the fleet repository for your AKS workload definitions — no new repository is needed. Create a `gitops/clusters/production/` directory within your fork to hold the Flux manifests.
- Connect your AKS cluster to that repository by enabling the Flux v2 extension and creating a Flux configuration.
- Store the application release definition for FabTech in Git, including the Helm-based deployment settings that represent the desired state.
- Verify that Flux reconciles the repository contents into the cluster and keeps the deployed state aligned with Git.
- Make an application change in Git, such as updating an image tag or replica setting, and use the Git history as the change record.
- Demonstrate drift detection by removing or changing a deployed resource outside Git and confirming that Flux restores the declared state.
- Use a pull request to represent progressive delivery of an application update before it reaches the cluster.

## Hints

- Look for the AKS Flux extension and Flux configuration resources in Azure.
- Think in terms of source repository, kustomization or Helm release, and reconciliation status.
- The cluster should show evidence that Git is driving the deployment, not ad hoc runtime changes.
- A pull request is the right place to review image tag updates before merge.

## Notes

- NOTE: Use the `microsoft.flux` AKS extension (`az k8s-configuration flux`) — not a manual Flux bootstrap.
- NOTE: Do not store application secrets in the GitOps repository. Continue using secure secret management patterns from earlier challenges.
- NOTE: Reconciliation can take a short time. Validate the observed state after Flux has had time to process the latest commit.

## Success Criteria

1. A Git repository is connected to the AKS cluster through a Flux v2 configuration.
2. The FabTech release definition is stored in Git and is reconciled into the cluster.
3. A committed change in Git results in a visible deployment change in AKS.
4. A manual drift event is corrected automatically by Flux.
5. You can explain to your coach why GitOps improves auditability, consistency, and recovery.

## Learning Resources

- [GitOps with Flux v2 on AKS](https://learn.microsoft.com/azure/azure-arc/kubernetes/conceptual-gitops-flux2)
- [Tutorial: Deploy applications using GitOps with Flux v2 on AKS](https://learn.microsoft.com/azure/azure-arc/kubernetes/tutorial-use-gitops-flux2)
- [Flux v2 concepts on AKS](https://learn.microsoft.com/azure/azure-arc/kubernetes/conceptual-gitops-flux2)
- [Flux v2 supported parameters for AKS](https://learn.microsoft.com/azure/azure-arc/kubernetes/gitops-flux2-parameters)
- [Monitor GitOps (Flux v2) on AKS](https://learn.microsoft.com/azure/azure-arc/kubernetes/monitor-gitops-flux2-status)
- [Flux v2 documentation](https://fluxcd.io/flux/)
