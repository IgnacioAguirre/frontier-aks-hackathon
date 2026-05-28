# Challenge 06 — Autoscaling

[< Previous Challenge](./Challenge-05.md) — **[Home](../README.md)** — [Next Challenge >](./Challenge-07.md)

## Introduction

Production workloads have variable demand. Kubernetes and AKS offer several complementary
autoscaling mechanisms. In this challenge you will configure and demonstrate each one,
understanding when and why to use it.

## Description

- Configure a **Horizontal Pod Autoscaler (HPA)** for the `fabtech-api` deployment to
  scale pods based on CPU utilization.
  - Make sure resource requests and limits are set on the container — HPA requires them.
  - Generate load and watch pods scale up, then remove the load and watch them scale back down.
- Enable **KEDA** (Kubernetes Event-driven Autoscaling) as an AKS managed add-on.
  - **Hint:** KEDA is available as a first-class AKS add-on, no manual install required.
  - Create an **Azure Service Bus** namespace and queue, then configure a `ScaledObject`
    to scale the API deployment based on queue message depth.
  - Demonstrate **scale-to-zero** (0 replicas when the queue is empty) and scale-up when
    messages are queued.
  - **NOTE:** Use KEDA's Workload Identity authentication — no connection strings in Kubernetes.
- Enable **Node Auto Provisioning (Karpenter)** on your cluster so nodes are provisioned
  just-in-time when pods are pending.
  - **Hint:** This may already be enabled if you used AKS Automatic in Challenge 02.
- *(Optional)* Deploy a **Vertical Pod Autoscaler (VPA)** in recommendation mode and
  review the suggested CPU/memory requests for the API deployment.

> **Note:** HPA and KEDA can coexist but must target the same deployment with care.
> Read the docs to understand how they interact.

## Success Criteria

1. HPA is active and scales up `fabtech-api` pods under load — show `kubectl get hpa` with increasing replica count.
2. KEDA add-on is running in the cluster; a `ScaledObject` exists; pods scale to **0 replicas** when the queue is empty.
3. Explain to your coach: when would you use **HPA**, **KEDA**, **VPA**, and **Karpenter**? What problem does each solve?

## Learning Resources

- [Horizontal Pod Autoscaler in AKS](https://learn.microsoft.com/azure/aks/concepts-scale#horizontal-pod-autoscaler)
- [KEDA add-on for AKS](https://learn.microsoft.com/azure/aks/keda-about)
- [KEDA with Workload Identity](https://learn.microsoft.com/azure/aks/keda-workload-identity)
- [Node Auto Provisioning (Karpenter) on AKS](https://learn.microsoft.com/azure/aks/node-autoprovision)
- [Vertical Pod Autoscaler](https://learn.microsoft.com/azure/aks/vertical-pod-autoscaler)
