# Challenge 11 — Enterprise Networking

[< Previous Challenge](./Challenge-10.md) — **[Home](../README.md)** — [Next Challenge >](./Challenge-12.md)

## Introduction

Enterprise AKS environments often require private management access, controlled outbound connectivity, and private access to supporting platform services. In this challenge you will design and validate a more locked-down networking posture for a production-style cluster.

## Description

- Create or use an AKS cluster with a private API server endpoint so cluster management stays on the private network path.
- Ensure your cluster design uses Virtual Machine Scale Sets for node pools.
- Provide a controlled outbound path for cluster and workload egress through Azure Firewall or NAT Gateway.
- Document the required outbound dependencies so the cluster can function without unrestricted internet access.
- Enable private connectivity for Azure Container Registry so image pulls do not rely on the public internet.
- Configure the ingress path to use an internal load balancer rather than a public entry point.
- Review how the application and platform traffic flows change when private endpoints and controlled egress are introduced.

## Hints

- Private clusters affect both day-to-day administration and troubleshooting workflows.
- Egress control is about choosing and governing the approved outbound path, not simply blocking everything.
- Private DNS is an important part of making private endpoints work consistently.
- Internal ingress is often paired with private front-end patterns elsewhere in the architecture.

## Notes

- NOTE: VM Availability Sets for AKS node pools are retiring in September 2025. Use VMSS-based node pools.
- NOTE: Private AKS clusters require a management path from within the network boundary or an approved remote access pattern.
- NOTE: Private endpoints for registry access are especially valuable when image supply chain control is part of the security posture.

## Optional Advanced

- Use Cilium layer 7 policy to restrict API traffic by HTTP behavior rather than only by port and source.
- Compare Azure Firewall and NAT Gateway as egress strategies for this design.
- Extend the private endpoint model to additional services used by the platform, such as Key Vault.

## Success Criteria

1. The AKS control plane is private and is not exposed through a public API server endpoint.
2. Cluster and workload egress follow an intentional path through Azure Firewall or NAT Gateway.
3. Azure Container Registry is reachable through a private endpoint for image pulls.
4. The ingress controller uses an internal load balancer.
5. You can explain to your coach how private access, controlled egress, and private registry connectivity improve the enterprise security posture.

## Learning Resources

- [Create a private AKS cluster](https://learn.microsoft.com/azure/aks/private-clusters)
- [Establish network connectivity to a private AKS cluster](https://learn.microsoft.com/azure/aks/private-cluster-connect)
- [AKS outbound types and egress design](https://learn.microsoft.com/azure/aks/egress-outboundtype)
- [Use Azure Container Registry with Private Link](https://learn.microsoft.com/azure/container-registry/container-registry-private-link)
- [Azure Private Link overview](https://learn.microsoft.com/azure/private-link/private-link-overview)
