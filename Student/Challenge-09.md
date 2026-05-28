# Challenge 09 — AKS Managed Istio Service Mesh

[< Previous Challenge](./Challenge-08.md) — **[Home](../README.md)** — [Next Challenge >](./Challenge-10.md)

## Introduction

A service mesh adds secure service-to-service communication, traffic control, and deep observability without changing application code. In this challenge you will use the AKS managed Istio add-on to bring the FabTech namespace into the mesh and apply production-style traffic and security controls.

## Description

- Enable the AKS managed Istio add-on for your cluster.
- Bring the FabTech namespace into the mesh so the application workloads run with Istio sidecars.
- Enforce mutual TLS in strict mode so service-to-service traffic inside the mesh is encrypted and authenticated.
- Define traffic management rules that support a canary release between version 1 and version 2 of the API.
- Verify that traffic splitting behaves as expected and that you can reason about the rollout path.
- Use mesh observability to inspect service traffic and health through Grafana or an equivalent service graph experience such as Kiali when available.

## Hints

- Focus on the managed Istio add-on for AKS rather than a self-installed control plane.
- Sidecar injection is a namespace onboarding task as much as a workload task.
- PeerAuthentication, DestinationRule, and VirtualService are the key service mesh concepts for this challenge.
- Observability should help you confirm both traffic direction and canary weighting.

## Notes

- NOTE: Open Service Mesh is deprecated and is not the target technology for this challenge.
- NOTE: Strict mTLS should prevent plaintext communication from workloads that are outside the mesh.
- NOTE: The managed AKS observability path centers on Prometheus and Grafana. Kiali may depend on how your environment is configured.

## Optional Advanced

- Add an AuthorizationPolicy that limits which workloads are allowed to call the API.
- Extend the canary rollout into a full promotion plan from a small percentage to all traffic.
- Compare the operational trade-offs between the AKS managed add-on and a fully self-managed Istio installation.

## Success Criteria

1. FabTech workloads are running with Istio sidecars in the mesh-enabled namespace.
2. Mutual TLS is enforced in strict mode for service-to-service communication.
3. Traffic management rules send a controlled portion of requests to the canary API version.
4. Mesh observability shows service traffic and helps verify the rollout behavior.
5. You can explain to your coach why you chose the AKS managed Istio add-on and how it fits the production-ready posture of this cluster.

## Learning Resources

- [Istio-based service mesh add-on for Azure Kubernetes Service](https://learn.microsoft.com/azure/aks/istio-about)
- [Deploy the Istio-based service mesh add-on for AKS](https://learn.microsoft.com/azure/aks/istio-deploy-addon)
- [Configure the Istio-based service mesh add-on for AKS](https://learn.microsoft.com/azure/aks/istio-meshconfig)
- [Collect metrics for Istio service mesh add-on workloads](https://learn.microsoft.com/azure/aks/istio-metrics-managed-prometheus)
- [Use Grafana with Kubernetes](https://learn.microsoft.com/azure/azure-monitor/visualize/grafana-kubernetes)
