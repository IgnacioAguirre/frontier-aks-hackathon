# Challenge AI-01 — AI on AKS: GPU Foundations

**[Home](../README.md)** — [Next Challenge >](./Challenge-AI-02.md)

## Introduction

GPU-enabled AKS clusters let you run AI inference and other accelerated workloads close to your existing platform services. In this challenge you will prepare AKS for GPU workloads, validate that the cluster can schedule and expose GPU resources correctly, and deploy a small model-serving scenario.

## Description

- Add a GPU node pool to your AKS cluster using at least a Standard_NC4as_T4_v3 sized node or a larger compatible GPU SKU.
- Ensure the GPU node pool is clearly separated from general-purpose workloads so expensive nodes are used intentionally.
- Verify that the NVIDIA device plugin is running and that GPU capacity is visible to Kubernetes as a schedulable resource.
- Deploy a sample CUDA-based workload to prove that the cluster can grant GPU access to a container.
- Deploy a small open-source model endpoint suitable for a single T4-class GPU and confirm that it serves inference traffic.
- Review the scheduling model for GPU requests, node isolation, and cost-aware placement.
- Explore GPU sharing concepts such as time-slicing and understand when they are useful.

## Hints

- GPU readiness is a combination of node pool capability, device plugin health, and pod scheduling signals.
- Taints, tolerations, and labels help keep non-AI workloads away from GPU nodes.
- A lightweight model is a better fit for this foundation challenge than a large multi-GPU model.
- Validate both infrastructure readiness and application-level inference behavior.

## Notes

- NOTE: GPU quota approval is required before you start. Request the needed quota during Challenge 00 if it is not already available.
- NOTE: A T4-class node is the minimum target for this challenge, but larger GPU SKUs are acceptable if quota and budget allow.
- NOTE: GPU sharing and time-slicing are advanced optimization topics. Understand the trade-offs before using them in production.

## Optional Advanced

- Configure autoscaling behavior for the GPU node pool and describe how to reduce idle cost.
- Compare dedicated GPU allocation with time-sliced sharing for small inference workloads.
- Review node hardware labeling options that help place specialized AI workloads more precisely.

## Success Criteria

1. An AKS GPU node pool exists with a supported GPU SKU.
2. The NVIDIA device plugin is healthy and the cluster reports available GPU resources.
3. A sample CUDA workload successfully uses the GPU.
4. A small open-source model endpoint runs on AKS and returns inference responses.
5. You can explain to your coach how node isolation, GPU requests, and sharing options affect cost and scheduling.

## Learning Resources

- [Use GPU-enabled node pools in AKS](https://learn.microsoft.com/azure/aks/gpu-cluster)
- [Node feature discovery in AKS](https://learn.microsoft.com/azure/aks/node-feature-discovery)
- [Cluster autoscaler in AKS](https://learn.microsoft.com/azure/aks/cluster-autoscaler)
- [Request Azure VM quota increases](https://learn.microsoft.com/azure/quotas/per-vm-quota-requests)
- [Use the AI toolchain operator add-on in AKS](https://learn.microsoft.com/azure/aks/ai-toolchain-operator)
