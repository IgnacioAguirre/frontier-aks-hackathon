# Challenge AI-02 — LLM Inference with KAITO

[< Previous Challenge](./Challenge-AI-01.md) — **[Home](../README.md)**

> ⚠️ **This is an optional advanced challenge.** Complete Challenge AI-01 before starting.
> You need a GPU node pool and available GPU quota.

## Introduction

**KAITO (Kubernetes AI Toolchain Operator)** is a CNCF sandbox project that simplifies
running open-source large language models on Kubernetes. Instead of writing complex YAML
for GPU deployments, you declare a `Workspace` resource and KAITO handles:

- Automatic GPU node provisioning (via Karpenter integration)
- Model download and caching
- Deployment with proper GPU resource requests
- Inference endpoint exposure

## Description

### Part 1: Install the KAITO Operator

```bash
RG=rg-frontier-aks
CLUSTER_NAME=aks-frontier

# Enable KAITO via the AKS AI Toolchain add-on (preview)
az aks update \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --enable-ai-toolchain-operator

# Verify KAITO pods are running
kubectl get pods -n kaito-workspace
```

Alternatively, install KAITO via Helm for non-preview environments:

```bash
helm repo add kaito https://azure.github.io/kaito/charts
helm repo update
helm install kaito kaito/kaito-workspace \
  --namespace kaito-workspace \
  --create-namespace
```

### Part 2: Deploy a Small Language Model

KAITO supports several open-source models. For this hack, use **Phi-3.5-mini** (the most
resource-efficient option for a T4 GPU):

```yaml
# kaito-workspace-phi3.yaml
apiVersion: kaito.sh/v1alpha1
kind: Workspace
metadata:
  name: workspace-phi3-mini
  namespace: kaito-workspace
  annotations:
    kaito.sh/enablelocalmodel: "false"
spec:
  resource:
    instanceType: "Standard_NC4as_T4_v3"
    labelSelector:
      matchLabels:
        apps: phi3-mini
  inference:
    preset:
      name: phi-3.5-mini-instruct
```

```bash
kubectl apply -f kaito-workspace-phi3.yaml

# Watch the workspace status (model download takes 5-15 minutes)
kubectl get workspace -n kaito-workspace -w
# Wait for READY: True
```

Check what KAITO created:

```bash
kubectl get pods -n kaito-workspace
kubectl get service -n kaito-workspace
```

### Part 3: Test Inference

Forward the inference service port:

```bash
kubectl port-forward service/workspace-phi3-mini 8080:80 -n kaito-workspace &
```

Send a test prompt to the OpenAI-compatible API endpoint:

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "phi-3.5-mini-instruct",
    "messages": [
      {
        "role": "system",
        "content": "You are a helpful assistant for a Kubernetes hackathon."
      },
      {
        "role": "user",
        "content": "In one sentence, what is the difference between a Deployment and a StatefulSet in Kubernetes?"
      }
    ],
    "max_tokens": 150,
    "temperature": 0.7
  }'
```

### Part 4: Explore the KAITO Workspace

```bash
# View the full workspace spec including GPU allocation
kubectl describe workspace workspace-phi3-mini -n kaito-workspace

# Check model inference pod logs
kubectl logs -n kaito-workspace -l app=workspace-phi3-mini --tail=50

# Check GPU utilization on the node
GPU_NODE=$(kubectl get nodes -l apps=phi3-mini -o jsonpath='{.items[0].metadata.name}')
kubectl top node $GPU_NODE
```

### Part 5: Try a Different Model (Optional)

KAITO supports multiple preset models. List available presets:

```bash
kubectl get workspacepreset -n kaito-workspace -o table
# Or check the KAITO GitHub: https://github.com/azure/kaito
```

Try **Mistral-7B** (requires A100 GPU):

```yaml
apiVersion: kaito.sh/v1alpha1
kind: Workspace
metadata:
  name: workspace-mistral
  namespace: kaito-workspace
spec:
  resource:
    instanceType: "Standard_NC24ads_A100_v4"
    labelSelector:
      matchLabels:
        apps: mistral7b
  inference:
    preset:
      name: mistral-7b-instruct
```

### Part 6: Clean Up (Important — GPU nodes are expensive!)

```bash
# Delete the workspace (stops the GPU deployment)
kubectl delete workspace workspace-phi3-mini -n kaito-workspace

# Scale down the GPU node pool to zero
az aks nodepool update \
  --resource-group $RG \
  --cluster-name $CLUSTER_NAME \
  --name gpunodes \
  --min-count 0 \
  --max-count 3

# Wait for scale-down (~10 minutes)
kubectl get nodes --label-columns accelerator
```

## Success Criteria

1. KAITO operator is installed and running in the cluster.
2. A `Workspace` for Phi-3.5-mini (or another model) reaches `READY: True` status.
3. A successful inference request returns a coherent response from the model.
4. GPU node scales down to zero after deleting the workspace.
5. Explain to your coach the difference between **KAITO** (model orchestration) and
   **vLLM** (inference engine), and how they complement each other.

## Learning Resources

- [KAITO overview](https://learn.microsoft.com/azure/aks/ai-toolchain-operator)
- [KAITO GitHub (model catalog)](https://github.com/azure/kaito)
- [AI Toolchain Operator on AKS](https://learn.microsoft.com/azure/aks/ai-toolchain-operator)
- [Phi-3 model family](https://learn.microsoft.com/azure/ai-studio/how-to/deploy-models-phi-3)
- [vLLM on Kubernetes](https://docs.vllm.ai/en/latest/serving/deploying-with-k8s.html)
- [GPU cost optimization on AKS](https://learn.microsoft.com/azure/aks/gpu-cluster#run-a-gpu-enabled-workload)
