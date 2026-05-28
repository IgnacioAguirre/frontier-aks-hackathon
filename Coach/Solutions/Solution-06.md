# Challenge 06 — Autoscaling — Coach Solution

[< Previous Solution](./Solution-05.md) | [Home](../../README.md) | [Next Solution >](./Solution-07.md)

## Notes & Guidance

- **Scale-to-zero with KEDA** is the most impressive demo — queue empty = 0 pods, enqueue
  messages = pods appear. Time this to show within the challenge window.
- HPA and KEDA can coexist on the same deployment only if the HPA targets a **different**
  metric (e.g., CPU) and KEDA is set as the primary scaler. In practice, for event-driven
  workloads, remove the HPA and let KEDA own all scaling.
- VPA in `Off` mode is safe for demos and shows useful recommendations. `Auto` mode causes
  pod restarts and is risky during a hackathon.
- **Karpenter / NAP** may be preview in some regions. AKS Automatic includes it by default.
  For Standard clusters, enable with `--node-provisioning-mode Auto`.

### Common Issues

- **HPA shows `<unknown>` for CPU:** Metrics Server must be running. Check:
  `kubectl get deployment metrics-server -n kube-system`. Also verify that resource
  **requests** (not just limits) are set on the target containers.
- **KEDA scale-to-zero not working:** Ensure `minReplicaCount: 0` is set in the ScaledObject.
  KEDA defaults to 1 if not specified.
- **Service Bus TriggerAuthentication:** Teams often skip the federated credential step for
  the KEDA service account. Without it, KEDA cannot poll the queue.

## Solution

### Part 1: Horizontal Pod Autoscaler

```bash
# Ensure resource requests are set (HPA requires them)
kubectl set resources deployment/fabtech-api \
  --namespace fabtech \
  --requests=cpu=250m,memory=256Mi \
  --limits=cpu=500m,memory=512Mi

# Create HPA
kubectl autoscale deployment fabtech-api \
  --namespace fabtech \
  --cpu-percent=50 \
  --min=2 \
  --max=10

kubectl get hpa -n fabtech -w
```

Generate load in a separate terminal:

```bash
kubectl run -it --rm load-test \
  --image=busybox \
  --restart=Never \
  --namespace=fabtech \
  -- sh -c "while true; do wget -q -O- http://fabtech-api:3001/api/health; done"
```

### Part 2: KEDA Add-on

```bash
RG=rg-frontier-aks
CLUSTER_NAME=aks-frontier

az aks update \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --enable-keda

kubectl get pods -n kube-system | grep keda
```

### Service Bus Setup

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

### KEDA Workload Identity Auth for Service Bus

```bash
MI_NAME=mi-keda-servicebus
MI=$(az identity create --resource-group $RG --name $MI_NAME)
MI_CLIENT_ID=$(echo $MI | jq -r '.clientId')
MI_OBJECT_ID=$(echo $MI | jq -r '.principalId')

SB_ID=$(az servicebus namespace show --resource-group $RG --name $SB_NS --query id -o tsv)
az role assignment create \
  --role "Azure Service Bus Data Receiver" \
  --assignee-object-id $MI_OBJECT_ID \
  --assignee-principal-type ServicePrincipal \
  --scope $SB_ID

# Federated credential for KEDA service account
OIDC_ISSUER=$(az aks show --resource-group $RG --name $CLUSTER_NAME \
  --query "oidcIssuerProfile.issuerUrl" -o tsv)

az identity federated-credential create \
  --name fc-keda-servicebus \
  --identity-name $MI_NAME \
  --resource-group $RG \
  --issuer $OIDC_ISSUER \
  --subject "system:serviceaccount:kube-system:keda-operator" \
  --audience api://AzureADTokenExchange
```

KEDA `TriggerAuthentication` and `ScaledObject`:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: keda-operator
  namespace: kube-system
  annotations:
    azure.workload.identity/client-id: "<MI_CLIENT_ID>"
---
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: keda-trigger-auth-servicebus
  namespace: fabtech
spec:
  podIdentity:
    provider: azure-workload
    identityId: "<MI_CLIENT_ID>"
---
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

Send test messages to trigger scale-up:

```bash
for i in {1..20}; do
  az servicebus queue message send \
    --resource-group $RG \
    --namespace-name $SB_NS \
    --queue-name fabtech-jobs \
    --body "job-$i"
done

kubectl get pods -n fabtech -w
```

### Part 3: Node Auto Provisioning (Karpenter)

```bash
az aks update \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --node-provisioning-mode Auto
```

`NodePool` manifest:

```yaml
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
