# Challenge 02 — AKS Cluster Deployment

[< Previous Challenge](./Challenge-01.md) — **[Home](../README.md)** — [Next Challenge >](./Challenge-03.md)

## Introduction

Time to provision the Kubernetes cluster that will power the rest of the hack. This is not
just any cluster — you need to deploy it with a specific set of production-ready features
enabled from the start, as later challenges depend on them.

## Description

Deploy an AKS cluster that meets the following requirements:

- Uses **Azure CNI Overlay** networking — pods must have IPs from an overlay network, not from the VNet address space
- Uses **Cilium** as the network dataplane
- Has **Node Auto Provisioning** enabled — required for Challenge 06, depends on **Cilium** plus **Azure CNI Overlay**, and **cannot be enabled after cluster creation**
- Has **Workload Identity** (OIDC issuer) enabled — required for Challenge 04
- Nodes are spread across **all available Availability Zones** for the region
- Uses **VMSS-based node pools** with **AzureLinux** as the node OS
- Is **attached to your ACR** from Challenge 01 so it can pull images without credentials
- Has a **system node pool** with at least 3 nodes
- Sets **`--auto-upgrade-channel stable`** and **`--node-os-upgrade-channel NodeImage`** for automated patching

> **Hint:** You have two deployment paths: **AKS Standard** (you configure everything)
> or **AKS Automatic** (production defaults pre-configured, including monitoring and security).
> Discuss the trade-offs with your team before choosing.

Once the cluster is running:
- Configure your local `kubectl` to connect to it
- Confirm nodes are running across multiple availability zones
- Verify the networking configuration matches the requirements above
- *(Optional)* Explore the cluster's workload view in the Azure Portal

> **Note:** The classic Kubernetes Dashboard is no longer available in AKS. Use the Azure Portal workloads view or a tool like Headlamp.

## Success Criteria

1. A running AKS cluster exists with at least 3 nodes in multiple availability zones.
2. The cluster uses **Azure CNI Overlay** — pod CIDRs are from an overlay range, not the VNet CIDR.
3. Workload Identity / OIDC issuer is enabled on the cluster.
4. Auto-upgrade channel is set to **stable** and node OS upgrade channel is set to **NodeImage**.
5. *(AKS Standard only)* `az aks show --query 'agentPoolProfiles[].nodeProvisioningMode'` returns `Auto`.
6. Explain to your coach the difference between **AKS Standard** and **AKS Automatic**, and which one you chose and why.

## Learning Resources

- [AKS quickstart with CLI](https://learn.microsoft.com/azure/aks/learn/quick-kubernetes-deploy-cli)
- [Azure CNI Overlay networking](https://learn.microsoft.com/azure/aks/azure-cni-overlay)
- [AKS and availability zones](https://learn.microsoft.com/azure/aks/availability-zones)
- [Workload Identity overview](https://learn.microsoft.com/azure/aks/workload-identity-overview)
- [AKS Automatic overview](https://learn.microsoft.com/azure/aks/intro-aks-automatic)
- [Cilium dataplane on AKS](https://learn.microsoft.com/azure/aks/azure-cni-powered-by-cilium)
- [Connect an ACR to an AKS cluster](https://learn.microsoft.com/azure/aks/cluster-container-registry-integration)
