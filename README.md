# What The Hack — Frontier AKS

## Introduction

This expert-level hack takes you through the full lifecycle of running a production-grade
application on **Azure Kubernetes Service (AKS)** using current 2025 best practices.

You will start from zero — containerizing an application, deploying an AKS cluster, and
progressively hardening, scaling, observing, and operating it. Every challenge reflects
technologies that are **generally available and actively supported** today:
no deprecated add-ons, no retired APIs, no stale tooling.

By the end of the hack you will have hands-on experience with:

- AKS Automatic and Standard cluster modes
- Workload Identity (Entra ID federated credentials)
- Azure Managed Prometheus and Grafana
- KEDA event-driven autoscaling + Karpenter node provisioning
- GitOps with Flux v2 via the AKS Flux extension
- AKS managed Istio service mesh
- Azure Policy for Kubernetes (OPA Gatekeeper)
- AKS Fleet Manager for multi-cluster operations
- *(Optional)* AI inference on AKS with KAITO

## Learning Objectives

1. Deploy and configure a production-ready AKS cluster with Azure CNI Overlay and Workload Identity
2. Package and deliver applications using Helm and the App Routing ingress add-on
3. Eliminate secret sprawl with Azure Key Vault and the Secrets Store CSI driver
4. Achieve full-stack observability with Managed Prometheus, Grafana, and OpenTelemetry
5. Build resilient, auto-scaling workloads using HPA, VPA, KEDA, and Karpenter
6. Implement GitOps continuous delivery with Flux v2
7. Harden cluster security using Entra RBAC, Azure Policy, and Microsoft Defender for Containers
8. Manage traffic and secure service-to-service communication with AKS managed Istio
9. Operate a fleet of clusters with AKS Fleet Manager

## Challenges

### Core Track

- Challenge 00: **[Prerequisites — Ready, Set, GO!](Student/Challenge-00.md)**
  - Prepare your workstation with a modern cloud-native toolset
- Challenge 01: **[Containers & Azure Container Registry](Student/Challenge-01.md)**
  - Containerize the sample application and publish it to ACR using Workload Identity
- Challenge 02: **[AKS Cluster Deployment](Student/Challenge-02.md)**
  - Deploy a production-ready AKS cluster with Azure CNI Overlay, Workload Identity, and availability zones
- Challenge 03: **[App Deployment & Helm Ingress](Student/Challenge-03.md)**
  - Package the application as a Helm chart and expose it via the App Routing add-on
- Challenge 04: **[Workload Identity & Secrets Management](Student/Challenge-04.md)**
  - Replace hardcoded secrets with Azure Key Vault + Secrets Store CSI and Entra federated credentials
- Challenge 05: **[Observability](Student/Challenge-05.md)**
  - Build a full observability stack with Azure Managed Prometheus, Grafana, and Container Insights
- Challenge 06: **[Autoscaling](Student/Challenge-06.md)**
  - Scale applications and nodes dynamically with HPA, KEDA, VPA, and Karpenter
- Challenge 07: **[GitOps with Flux v2](Student/Challenge-07.md)**
  - Implement continuous delivery using the AKS Flux v2 extension and Git as the source of truth
- Challenge 08: **[AKS Security](Student/Challenge-08.md)**
  - Enforce policies, harden RBAC, and activate Microsoft Defender for Containers
- Challenge 09: **[AKS Managed Istio Service Mesh](Student/Challenge-09.md)**
  - Secure and control service-to-service traffic with the AKS-managed Istio add-on
- Challenge 10: **[Persistent Storage](Student/Challenge-10.md)**
  - Configure dynamic persistent storage with Azure Disks and Azure Files
- Challenge 11: **[Enterprise Networking](Student/Challenge-11.md)**
  - Harden cluster networking with private API server, Cilium network policies, and egress control
- Challenge 12: **[AKS Fleet Manager](Student/Challenge-12.md)**
  - Manage multiple clusters at scale with AKS Fleet Manager

### Optional AI Track

- Challenge AI-01: **[AI on AKS — GPU Foundations](Student/Challenge-AI-01.md)**
  - Add GPU node pools and verify GPU availability for AI workloads
- Challenge AI-02: **[LLM Inference with KAITO](Student/Challenge-AI-02.md)**
  - Deploy an open-source LLM using the Kubernetes AI Toolchain Operator (KAITO)

## Prerequisites

- Access to an Azure subscription with **Owner** role
  - [Sign up for a free Azure account](https://azure.microsoft.com/free/)
- **Azure CLI** >= 2.65.0  — [Install](https://learn.microsoft.com/cli/azure/install-azure-cli)
- **kubectl** — install via `az aks install-cli`
- **kubelogin** — install via `az aks install-cli` or [GitHub releases](https://github.com/Azure/kubelogin)
- **Helm** >= 3.14 — [Install](https://helm.sh/docs/intro/install/)
- **Flux CLI** v2 — [Install](https://fluxcd.io/flux/installation/)
- A **bash-compatible shell**: WSL2 (Windows), macOS Terminal, Linux, GitHub Codespaces, or Azure Cloud Shell
- **Visual Studio Code** (recommended) — [Install](https://code.visualstudio.com/)
- *(Optional — AI track)* GPU quota: at least 4 vCPUs of `Standard_NC` or `Standard_ND` family in your target region

## Sample Application

**FabTechOps** is a three-tier web application used throughout this hack:

| Tier | Image | Description |
|------|-------|-------------|
| Frontend | `whatthehackmsft/web` | React-based conference info site |
| API | `whatthehackmsft/api` | Node.js REST API backed by a database |
| Database | Azure SQL / PostgreSQL | Managed PaaS database |

Pre-built images are available on Docker Hub at `whatthehackmsft/web` and `whatthehackmsft/api`.
Coaches can provide a `Resources.zip` with source code for Challenge 01.

## Contributors

- Carlos Mendible
- (your name here — contributions welcome!)

## Acknowledgements

This hackathon builds on the foundations of:
- [001-IntroToKubernetes](https://github.com/microsoft/WhatTheHack/tree/master/001-IntroToKubernetes)
- [023-AdvancedKubernetes](https://github.com/microsoft/WhatTheHack/tree/master/023-AdvancedKubernetes)
- [039-AKSEnterpriseGrade](https://github.com/microsoft/WhatTheHack/tree/master/039-AKSEnterpriseGrade)
