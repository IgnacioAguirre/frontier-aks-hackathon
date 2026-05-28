# Challenge AI-02 — LLM Inference with KAITO

[< Previous Challenge](./Challenge-AI-01.md) — **[Home](../README.md)**

## Introduction

KAITO simplifies the experience of running supported open-source language models on Kubernetes. In this challenge you will use the KAITO operator or the AKS AI Toolchain add-on to deploy a model workspace, wait for it to become ready, and validate live inference on AKS.

## Description

- Install the KAITO operator or enable the AKS AI Toolchain add-on in your cluster.
- Deploy a supported model such as Phi-3-mini or Mistral-7B by defining a KAITO Workspace.
- Choose a model that matches the GPU capacity available in your cluster.
- Wait for the model download, initialization, and readiness process to complete before testing inference.
- Send inference requests to the deployed model endpoint and evaluate the responses.
- Scale the inference deployment and observe how the workload behaves as demand changes.
- Review how the operator manages model lifecycle concerns that would otherwise require substantial manual platform work.

## Hints

- Model choice should follow GPU memory limits first, then latency and quality goals.
- Workspace readiness can take noticeable time because model artifacts must be downloaded and prepared.
- Validate both endpoint readiness and a successful prompt-response interaction.
- Scaling behavior is easier to understand when you watch both workload state and node capacity together.

## Notes

- NOTE: Complete the GPU foundations challenge first so the cluster is already prepared for accelerated workloads.
- NOTE: Model downloads can take several minutes. Plan your lab time accordingly.
- NOTE: Workload Identity is relevant when model artifacts or registries require Azure-backed access control.

## Optional Advanced

- Configure the deployment to use Workload Identity for access to an Azure-hosted model registry or related dependency.
- Compare a smaller model on T4-class hardware with a larger model on a higher-capacity GPU SKU.
- Describe the difference between KAITO as the orchestration layer and the underlying inference engine used by the model runtime.

## Success Criteria

1. The KAITO operator or AKS AI Toolchain add-on is installed and healthy.
2. A supported model workspace reaches a ready state on the cluster.
3. The deployed endpoint returns successful inference responses.
4. Scaling the inference deployment produces an observable behavior change in the running workload.
5. You can explain to your coach how KAITO simplifies model deployment and operations on AKS.

## Learning Resources

- [Use the AI toolchain operator add-on in AKS](https://learn.microsoft.com/azure/aks/ai-toolchain-operator)
- [Use GPU-enabled node pools in AKS](https://learn.microsoft.com/azure/aks/gpu-cluster)
- [Workload identity overview for AKS](https://learn.microsoft.com/azure/aks/workload-identity-overview)
- [Deploy Phi family models in Azure AI Foundry](https://learn.microsoft.com/azure/ai-studio/how-to/deploy-models-phi-3)
