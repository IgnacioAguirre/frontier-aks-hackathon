# Challenge AI-01 — AI on AKS Foundations — Coach Solution

[< Previous Solution](./Solution-13.md) | [Home](../../README.md) | [Next Solution >](./Solution-AI-02.md)

## Notes & Guidance

- **GPU quota MUST be requested in advance** (24–48 hours). `Standard_NC4as_T4_v3`
  (T4, 4 vCPUs) is the minimum viable option and cheapest in swedencentral.
- If quota is not available, teams can still complete the conceptual portions and review
  the NVIDIA device plugin manifest — just skip the actual GPU workload deployment.
- The NVIDIA device plugin DaemonSet is automatically deployed by AKS when a GPU node pool
  is created. Teams do not need to install it manually unless using a custom node pool.
- **Cost alert:** A single T4 node (`Standard_NC4as_T4_v3`) costs ~$0.50–$0.75/hour.
  Scale the GPU node pool to 0 when not in use: `az aks nodepool scale --node-count 0`.
- GPU time-slicing is a more advanced topic; the reference docs are sufficient for teams
  that want to explore it.

### Common Issues

- **GPU node pool takes 10–15 minutes to provision.**
- **NVIDIA device plugin not starting:** Check the `nvidia-device-plugin` pods in the
  `kube-system` namespace with `kubectl get pods -n kube-system -l name=nvidia-device-plugin-ds`.
  Usually a quota or node sizing issue.
- **CUDA test job fails:** Confirm the pod is scheduled on the GPU node:
  `kubectl get pod -o wide` and verify the node name.

## Solution

### Part 1: Create GPU Node Pool

```bash
RG=rg-frontier-aks
CLUSTER_NAME=aks-frontier
LOCATION=swedencentral

# Check available GPU quota first
az vm list-usage --location $LOCATION \
  --query "[?contains(name.value,'NC')]" -o table

# Add GPU node pool
az aks nodepool add \
  --resource-group $RG \
  --cluster-name $CLUSTER_NAME \
  --name gpupool \
  --node-count 1 \
  --node-vm-size Standard_NC4as_T4_v3 \
  --os-sku AzureLinux \
  --node-taints sku=gpu:NoSchedule \
  --labels sku=gpu

# Verify GPU node is Ready
kubectl get nodes -l sku=gpu
```

### Part 2: Verify NVIDIA Device Plugin

```bash
# AKS installs the device plugin automatically — verify
kubectl get pods -n kube-system -l name=nvidia-device-plugin-ds
kubectl describe node <GPU_NODE_NAME> | grep -A5 "Allocatable"
# Should show: nvidia.com/gpu: 1
```

### Part 3: CUDA Validation Job

```yaml
# cuda-test-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: cuda-vector-add
spec:
  template:
    spec:
      nodeSelector:
        sku: gpu
      tolerations:
      - key: sku
        value: gpu
        operator: Equal
        effect: NoSchedule
      restartPolicy: OnFailure
      containers:
      - name: cuda-vector-add
        image: "nvcr.io/nvidia/k8s/cuda-sample:vectoradd-cuda12.5.0"
        securityContext:
          runAsNonRoot: true
          allowPrivilegeEscalation: false
          capabilities:
            drop: ["ALL"]
        resources:
          limits:
            nvidia.com/gpu: 1
```

```bash
kubectl apply -f cuda-test-job.yaml
kubectl wait --for=condition=Complete job/cuda-vector-add --timeout=120s
kubectl logs job/cuda-vector-add
# Expected: Test PASSED
```

### Part 4: Deploy a Small Inference Endpoint (Hugging Face)

```yaml
# hf-inference-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hf-inference
  namespace: fabtech
spec:
  replicas: 1
  selector:
    matchLabels:
      app: hf-inference
  template:
    metadata:
      labels:
        app: hf-inference
    spec:
      nodeSelector:
        sku: gpu
      tolerations:
      - key: sku
        value: gpu
        operator: Equal
        effect: NoSchedule
      containers:
      - name: inference
        image: ghcr.io/huggingface/text-generation-inference:2.0
        securityContext:
          runAsNonRoot: true
          runAsUser: 100
          allowPrivilegeEscalation: false
          capabilities:
            drop: ["ALL"]
        args:
        - --model-id
        - microsoft/phi-2
        env:
        - name: HUGGING_FACE_HUB_TOKEN
          valueFrom:
            secretKeyRef:
              name: hf-token
              key: token
        volumeMounts:
        - name: model-cache
          mountPath: /data
        - name: tmp
          mountPath: /tmp
        resources:
          limits:
            nvidia.com/gpu: 1
            memory: "12Gi"
          requests:
            memory: "8Gi"
        ports:
        - containerPort: 80
      volumes:
      - name: model-cache
        emptyDir: {}
      - name: tmp
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: hf-inference
  namespace: fabtech
spec:
  selector:
    app: hf-inference
  ports:
  - port: 80
    targetPort: 80
```

```bash
# Create HuggingFace token secret
# Get your HuggingFace token from https://huggingface.co/settings/tokens
# (create a Read token)
# Use `read -rs` to avoid exposing the token in shell history
read -rs HF_TOKEN && echo "HF_TOKEN set"
kubectl create secret generic hf-token \
  --namespace fabtech \
  --from-literal=token="$HF_TOKEN"
unset HF_TOKEN

kubectl apply -f hf-inference-deployment.yaml

# Test inference
kubectl port-forward svc/hf-inference 8080:80 -n fabtech &
curl http://localhost:8080/generate \
  -H "Content-Type: application/json" \
  --data '{"inputs": "What is Kubernetes?", "parameters": {"max_new_tokens": 50}}'
```

### Scale GPU Node Pool to Zero When Done

```bash
az aks nodepool scale \
  --resource-group $RG \
  --cluster-name $CLUSTER_NAME \
  --name gpupool \
  --node-count 0
```
