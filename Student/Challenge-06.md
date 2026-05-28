# Challenge 06 — Autoscaling

[< Previous Challenge](./Challenge-05.md) — **[Home](../README.md)** — [Next Challenge >](./Challenge-07.md)

## Introduction

Production workloads have variable demand. In this challenge you will configure multiple
layers of autoscaling:

- **HPA (Horizontal Pod Autoscaler)** — scale pods based on CPU/memory or custom metrics
- **VPA (Vertical Pod Autoscaler)** — right-size pod resource requests automatically
- **KEDA** — event-driven pod autoscaling (scale to zero, Azure Service Bus queue depth)
- **Karpenter / Node Auto Provision** — just-in-time node provisioning (AKS Automatic or NAP)

## Description

### Part 1: Horizontal Pod Autoscaler (HPA)

Set resource requests and limits on the API deployment (required for HPA):

```bash
kubectl set resources deployment/fabtech-api \
  --namespace fabtech \
  --requests=cpu=250m,memory=256Mi \
  --limits=cpu=500m,memory=512Mi
```

Create an HPA:

```bash
kubectl autoscale deployment fabtech-api \
  --namespace fabtech \
  --cpu-percent=50 \
  --min=2 \
  --max=10
```

Watch the HPA:

```bash
kubectl get hpa -n fabtech -w
```

Generate load to trigger scaling:

```bash
# Run a load test (requires a pod in the cluster)
kubectl run -it --rm load-test --image=busybox --restart=Never -- \
  sh -c "while true; do wget -q -O- http://fabtech-api.fabtech.svc.cluster.local/api/health; done"
```

Watch pods scale up in a second terminal:

```bash
kubectl get pods -n fabtech -w
```

### Part 2: KEDA — Event-Driven Autoscaling

Enable the KEDA managed add-on (uses Workload Identity for Azure scalers):

```bash
RG=rg-frontier-aks
CLUSTER_NAME=aks-frontier

az aks update \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --enable-keda
```

Verify KEDA is running:

```bash
kubectl get pods -n kube-system | grep keda
```

Create an Azure Service Bus namespace and queue:

```bash
SB_NS=sb-frontier-$RANDOM

az servicebus namespace create \
  --resource-group $RG \
  --name $SB_NS \
  --sku Standard

az servicebus queue create \
  --resource-group $RG \
  --namespace-name $SB_NS \
  --name fabtech-jobs
```

Create a `ScaledObject` to scale the API based on queue depth:

```yaml
# keda-scaledobject.yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: fabtech-api-scaler
  namespace: fabtech
spec:
  scaleTargetRef:
    name: fabtech-api
  minReplicaCount: 0
  maxReplicaCount: 20
  pollingInterval: 15
  cooldownPeriod: 60
  triggers:
  - type: azure-servicebus
    metadata:
      queueName: fabtech-jobs
      namespace: <SB_NS>
      messageCount: "5"
    authenticationRef:
      name: keda-trigger-auth-servicebus
```

> **Tip:** Use KEDA's Workload Identity authentication (`TriggerAuthentication` with
> `identityId`) instead of connection string secrets.
> See: [KEDA Workload Identity](https://learn.microsoft.com/azure/aks/keda-workload-identity)

Apply and watch KEDA scale pods to zero when the queue is empty:

```bash
kubectl apply -f keda-scaledobject.yaml
kubectl get scaledobject -n fabtech
kubectl get pods -n fabtech  # should show 0 replicas
```

Send messages to the queue and observe pods spinning up:

```bash
az servicebus queue message send \
  --resource-group $RG \
  --namespace-name $SB_NS \
  --queue-name fabtech-jobs \
  --body "job1"
```

### Part 3: Node Autoprovision / Karpenter (AKS Automatic or NAP)

If you deployed **AKS Automatic** in Challenge 02, Karpenter is already enabled.

For **AKS Standard**, enable Node Auto Provisioning (NAP):

```bash
az aks update \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --node-provisioning-mode Auto
```

Create a `NodePool` manifest to define node constraints:

```yaml
# nodepool.yaml
apiVersion: karpenter.azure.com/v1alpha2
kind: AKSNodeClass
metadata:
  name: default
spec:
  osSKU: AzureLinux
---
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: general
spec:
  template:
    spec:
      nodeClassRef:
        name: default
      requirements:
        - key: "karpenter.sh/capacity-type"
          operator: In
          values: ["on-demand", "spot"]
        - key: "karpenter.azure.com/sku-family"
          operator: In
          values: ["D", "E"]
  limits:
    cpu: "100"
    memory: 400Gi
  disruption:
    consolidationPolicy: WhenEmptyOrUnderutilized
```

```bash
kubectl apply -f nodepool.yaml
```

Deploy a workload that requires more resources than current nodes can provide and watch
Karpenter provision new nodes automatically.

### Part 4: Vertical Pod Autoscaler (VPA)

Install VPA:

```bash
git clone https://github.com/kubernetes/autoscaler.git
cd autoscaler/vertical-pod-autoscaler
./hack/vpa-up.sh
```

Create a VPA object in recommendation mode:

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: fabtech-api-vpa
  namespace: fabtech
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: fabtech-api
  updatePolicy:
    updateMode: "Off"  # Recommendation only — do not auto-apply
```

After a few minutes:

```bash
kubectl describe vpa fabtech-api-vpa -n fabtech
```

Review the `Recommendation` section to see suggested CPU/memory requests.

## Success Criteria

1. HPA scales the `fabtech-api` deployment up under load (show `kubectl get hpa` with
   `REPLICAS` increasing).
2. KEDA is enabled; a `ScaledObject` exists; pods scale to **0 replicas** when the queue
   is empty and scale up when messages arrive.
3. Explain to your coach the difference between HPA, VPA, KEDA, and Karpenter/NAP —
   when would you use each?
4. *(Optional)* Show a VPA recommendation for `fabtech-api`.

## Learning Resources

- [Horizontal Pod Autoscaler](https://learn.microsoft.com/azure/aks/concepts-scale#horizontal-pod-autoscaler)
- [KEDA add-on for AKS](https://learn.microsoft.com/azure/aks/keda-about)
- [KEDA with Workload Identity](https://learn.microsoft.com/azure/aks/keda-workload-identity)
- [Node Auto Provisioning (Karpenter)](https://learn.microsoft.com/azure/aks/node-autoprovision)
- [Vertical Pod Autoscaler](https://learn.microsoft.com/azure/aks/vertical-pod-autoscaler)
