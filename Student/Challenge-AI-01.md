# Challenge AI-01 — AI on AKS: GPU Foundations

**[Home](../README.md)** — [Next Challenge >](./Challenge-AI-02.md)

> ⚠️ **This is an optional advanced challenge.** You need GPU quota in your Azure
> subscription before starting. Check quota with:
> `az vm list-usage --location eastus --query "[?contains(name.value,'NCA')]" -o table`
>
> If you do not have GPU quota, [request an increase](https://learn.microsoft.com/azure/quotas/per-vm-quota-requests)
> for the `Standard NCADsA100v4 Family vCPUs` (A100) or `Standard_NCas_T4_v3` family.

## Introduction

AKS can run GPU-accelerated workloads by adding GPU node pools. In this challenge you will:

1. Add a GPU node pool to your existing cluster
2. Verify the NVIDIA device plugin is installed and GPUs are visible to Kubernetes
3. Understand GPU resource requests, node taints, and pod tolerations
4. Run a simple GPU-accelerated workload

## Description

### Part 1: Add a GPU Node Pool

```bash
RG=rg-frontier-aks
CLUSTER_NAME=aks-frontier

# Add a GPU node pool (T4 GPUs — cost-effective for inference)
az aks nodepool add \
  --resource-group $RG \
  --cluster-name $CLUSTER_NAME \
  --name gpunodes \
  --node-count 1 \
  --node-vm-size Standard_NC4as_T4_v3 \
  --node-taints sku=gpu:NoSchedule \
  --labels accelerator=nvidia \
  --os-sku AzureLinux \
  --no-wait
```

> **Node Taints:** The `sku=gpu:NoSchedule` taint prevents non-GPU workloads from being
> scheduled on GPU nodes, preventing waste of expensive GPU resources.

Wait for the node pool to be ready:

```bash
az aks nodepool show \
  --resource-group $RG \
  --cluster-name $CLUSTER_NAME \
  --name gpunodes \
  --query "provisioningState" -o tsv
# Wait until: Succeeded

kubectl get nodes --label-columns accelerator
```

### Part 2: Verify NVIDIA Device Plugin

AKS automatically installs the **NVIDIA device plugin** on GPU nodes. Verify it is running:

```bash
kubectl get pods -n kube-system | grep nvidia
kubectl get daemonset aks-gpu-nvidia-device-plugin-daemonset -n kube-system
```

Check that GPUs are exposed as an allocatable resource on the node:

```bash
GPU_NODE=$(kubectl get nodes -l accelerator=nvidia -o jsonpath='{.items[0].metadata.name}')
kubectl describe node $GPU_NODE | grep -A5 "Allocatable"
# Should show: nvidia.com/gpu: 1
```

### Part 3: Run a GPU Test Workload

```yaml
# gpu-test.yaml
apiVersion: v1
kind: Pod
metadata:
  name: gpu-test
spec:
  tolerations:
  - key: sku
    value: gpu
    effect: NoSchedule
  nodeSelector:
    accelerator: nvidia
  restartPolicy: OnFailure
  containers:
  - name: cuda-test
    image: mcr.microsoft.com/azuredocs/samples-tf-mnist-demo:gpu
    resources:
      limits:
        nvidia.com/gpu: 1
    command: ["python", "mnist_deep.py"]
```

```bash
kubectl apply -f gpu-test.yaml
kubectl get pod gpu-test -w
kubectl logs gpu-test
# Expected: training accuracy output, GPU device visible
```

### Part 4: GPU Node Autoscaling

Configure the cluster autoscaler to scale GPU nodes in and out:

```bash
az aks nodepool update \
  --resource-group $RG \
  --cluster-name $CLUSTER_NAME \
  --name gpunodes \
  --enable-cluster-autoscaler \
  --min-count 0 \
  --max-count 3
```

> **Scale to zero:** Setting `--min-count 0` allows the GPU node pool to scale down to zero
> when no GPU workloads are running, significantly reducing costs.

Verify the node pool scales down after the GPU test pod completes:

```bash
kubectl delete pod gpu-test
# Wait ~10 minutes for the autoscaler to scale down
kubectl get nodes --label-columns accelerator
```

### Part 5: Node Feature Discovery (Optional)

**Node Feature Discovery (NFD)** labels nodes with their hardware capabilities, enabling
fine-grained scheduling:

```bash
kubectl apply -k https://github.com/kubernetes-sigs/node-feature-discovery/deployment/overlays/default

# Check GPU feature labels
kubectl describe node $GPU_NODE | grep nvidia
```

## Success Criteria

1. A GPU node pool (`Standard_NC*` series) exists in your cluster — show `kubectl get nodes`.
2. The NVIDIA device plugin DaemonSet is running on GPU nodes.
3. `kubectl describe node <gpu-node>` shows `nvidia.com/gpu: 1` under **Allocatable**.
4. The GPU test pod runs successfully and logs show GPU usage.
5. Explain to your coach why GPU node taints + pod tolerations are important for cost control.

## Learning Resources

- [GPU-optimized VMs on AKS](https://learn.microsoft.com/azure/aks/gpu-cluster)
- [NVIDIA device plugin for Kubernetes](https://github.com/NVIDIA/k8s-device-plugin)
- [Node Feature Discovery](https://learn.microsoft.com/azure/aks/node-feature-discovery)
- [AKS cluster autoscaler](https://learn.microsoft.com/azure/aks/cluster-autoscaler)
- [GPU quota requests](https://learn.microsoft.com/azure/quotas/per-vm-quota-requests)
