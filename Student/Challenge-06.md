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
- Use **Node Auto Provisioning (Karpenter)** on your cluster so nodes are provisioned
  just-in-time when pods are pending.
  - **Hint:** This may already be enabled if you used AKS Automatic in Challenge 02.
  - **Important:** For AKS Standard, NAP/Karpenter only works if the cluster was created in
    Challenge 02 with `--node-provisioning-mode Auto`, `--network-dataplane cilium`, and
    `--network-plugin-mode overlay`. These prerequisites cannot be added later.
  - Verify with: `az aks show --query agentPoolProfiles[].nodeProvisioningMode`
  - Create a `NodePool` resource and **trigger provisioning** by deploying a workload whose
    CPU requests exceed what fits on the existing nodes. Observe a new node appear, then
    delete the workload and watch Karpenter consolidate the idle node away.
- *(Optional)* Deploy a **Vertical Pod Autoscaler (VPA)** in recommendation mode and
  review the suggested CPU/memory requests for the API deployment.

> **Note:** HPA and a KEDA `ScaledObject` should not manage the same Deployment simultaneously in
> this challenge. Use HPA first for CPU-based autoscaling, then remove the HPA and replace it with
> a KEDA `ScaledObject` for the event-driven scale-to-zero scenario.

## Success Criteria

1. **Part 1 — CPU-based autoscaling:** Configure an HPA for `fabtech-api` and show it scaling up
   under load with `kubectl get hpa`.
2. **Part 2 — Event-driven autoscaling:** Remove the HPA, enable the KEDA add-on, and replace it
   with a `ScaledObject` for `fabtech-api` that scales to **0 replicas** when the queue is empty
   and scales up when messages are queued.
3. **Part 3 — Node Auto Provisioning:** Apply a `NodePool`, trigger NAP by scaling up a
   CPU-heavy workload, show a new node appearing with `kubectl get nodes -w` and
   `kubectl get nodeclaims`, then delete the workload and show the node being consolidated away.
4. Explain to your coach: when would you use **HPA**, **KEDA**, **VPA**, and **Karpenter**? What
   problem does each solve?

## Learning Resources

- [Horizontal Pod Autoscaler in AKS](https://learn.microsoft.com/azure/aks/concepts-scale#horizontal-pod-autoscaler)
- [KEDA add-on for AKS](https://learn.microsoft.com/azure/aks/keda-about)
- [KEDA with Workload Identity](https://learn.microsoft.com/azure/aks/keda-workload-identity)
- [Node Auto Provisioning (Karpenter) on AKS](https://learn.microsoft.com/azure/aks/node-autoprovision)
- [Vertical Pod Autoscaler](https://learn.microsoft.com/azure/aks/vertical-pod-autoscaler)
