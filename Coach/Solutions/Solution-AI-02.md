# Challenge AI-02 — LLM Inference with KAITO — Coach Solution

[< Previous Solution](./Solution-AI-01.md) | [Home](../../README.md)

## Notes & Guidance

- **KAITO requires the AI Toolchain Operator add-on or the KAITO operator to be installed.**
  The AKS add-on (`--enable-ai-toolchain-operator`) is in preview — register the feature
  flag in advance: `az feature register --namespace Microsoft.ContainerService --name AIToolchainOperatorPreview`
- **Model download takes 5–15 minutes** (Phi-3.5-mini is ~4 GB). Teams must plan for this
  wait time during the challenge.
- **Cost alert:** GPU nodes for KAITO (Standard_NC6s_v3 or NC4as_T4_v3) cost
  $0.50–$2.00/hour. Scale down immediately after the challenge.
- If the AI Toolchain Operator preview is not available in the team's region, teams can
  install KAITO manually via Helm.

### Common Issues

- **Workspace stuck in Pending:** Check `kubectl describe workspace`. Common cause: no GPU
  nodes available or taint/toleration mismatch.
- **Model download OOMKilled:** Node does not have enough memory. Minimum: 16 GiB RAM
  plus GPU VRAM for the model.
- **KAITO feature flag not registered:** The `AIToolchainOperatorPreview` feature can take
  30–60 minutes to propagate after registration.

### Workspace Status Check

```bash
kubectl describe workspace workspace-phi3-mini -n kaito-workspace
# Look for: Status.Conditions[*].Type == Ready
# Model is downloading when: WorkspaceConditionTypeResourceProvisioned == True but Ready != True
```

## Solution

### Part 1: Enable KAITO via AKS Add-on (Preview)

```bash
RG=rg-frontier-aks
CLUSTER_NAME=aks-frontier

# Register preview feature (do this in advance — takes up to 1 hour)
az feature register \
  --namespace Microsoft.ContainerService \
  --name AIToolchainOperatorPreview

# Wait for registration
az feature show \
  --namespace Microsoft.ContainerService \
  --name AIToolchainOperatorPreview \
  --query "properties.state"

# Enable the add-on
az aks update \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --enable-ai-toolchain-operator

# Verify KAITO pods
kubectl get pods -n kube-system | grep kaito
```

### Alternative: Install KAITO via Helm (if add-on not available)

```bash
helm repo add kaito https://azure.github.io/kaito/
helm repo update

helm install kaito kaito/kaito-workspace \
  --namespace kaito-workspace \
  --create-namespace
```

### Part 2: Deploy Phi-3-mini with KAITO Workspace

```yaml
# workspace-phi3-mini.yaml
apiVersion: kaito.sh/v1alpha1
kind: Workspace
metadata:
  name: workspace-phi3-mini
  namespace: kaito-workspace
spec:
  resource:
    instanceType: "Standard_NC4as_T4_v3"
    labelSelector:
      matchLabels:
        app: workspace-phi3-mini
  inference:
    preset:
      name: phi-3-mini-4k-instruct
```

```bash
kubectl apply -f workspace-phi3-mini.yaml

# Watch workspace status (model downloading)
kubectl get workspace workspace-phi3-mini -n kaito-workspace -w

# Detailed status
kubectl describe workspace workspace-phi3-mini -n kaito-workspace
```

### Part 3: Test Inference

```bash
# Get the inference service endpoint
SVC_IP=$(kubectl get svc workspace-phi3-mini \
  -n kaito-workspace \
  -o jsonpath='{.spec.clusterIP}')

# Port-forward for testing
kubectl port-forward svc/workspace-phi3-mini 8080:80 -n kaito-workspace &

# Send an inference request
curl -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Explain Kubernetes in 3 sentences."}
    ],
    "max_length": 200
  }'
```

### Part 4: Scale Inference Deployment

```bash
# Scale up replicas for higher throughput
kubectl patch workspace workspace-phi3-mini \
  -n kaito-workspace \
  --type=merge \
  -p '{"spec":{"resource":{"count":2}}}'

kubectl get workspace workspace-phi3-mini -n kaito-workspace

# Scale GPU node pool to 0 after challenge
az aks nodepool scale \
  --resource-group $RG \
  --cluster-name $CLUSTER_NAME \
  --name gpupool \
  --node-count 0
```

### Part 5 (Optional): KAITO with Workload Identity

```yaml
# workspace-with-identity.yaml
apiVersion: kaito.sh/v1alpha1
kind: Workspace
metadata:
  name: workspace-phi3-private
  namespace: kaito-workspace
  annotations:
    azure.workload.identity/client-id: "<MANAGED_IDENTITY_CLIENT_ID>"
spec:
  resource:
    instanceType: "Standard_NC4as_T4_v3"
    labelSelector:
      matchLabels:
        app: workspace-phi3-private
  inference:
    preset:
      name: phi-3-mini-4k-instruct
    # For models from Azure model catalog / private registry
    # template:
    #   spec:
    #     serviceAccountName: kaito-sa
```
