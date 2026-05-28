# Coach Guide — Frontier AKS Hackathon

This guide provides solutions, tips, and common pitfalls for each challenge.
Share this only with coaches — not students.

---

## General Notes for Coaches

- **Duration:** The full core track (Ch 00–12) takes ~2 days for an expert team.
  A focused 1-day event should cover Ch 00–08.
- **Subscription:** Each team needs an Azure subscription with **Owner** role and enough
  quota for ~16 vCPUs (Standard D-series) plus optional GPU quota.
- **Region:** Use `eastus` or `eastus2` for best service availability.
- **Resources:** Provide a `Resources.zip` with the FabTechOps source code.
  The `whatthehackmsft/web` and `whatthehackmsft/api` Docker Hub images are public fallbacks.
- **Cleanup:** Remind teams to delete resource groups at the end!
  `az group delete --name rg-frontier-aks --no-wait`

---

## Challenge 00 — Prerequisites

### Common Issues

- **WSL2 issues on Windows:** Ensure WSL2 (not WSL1) is configured:
  `wsl --set-default-version 2`
- **Azure CLI too old:** Run `az upgrade` to update.
- **`kubelogin` missing:** After `az aks get-credentials`, running `kubectl` may fail with
  an auth error. Fix: `az aks install-cli` installs both `kubectl` and `kubelogin`.
- **Resource provider not registered:** Some providers (e.g., `Microsoft.Dashboard`) may take
  a few minutes to register. Check: `az provider show --namespace Microsoft.Dashboard`.

---

## Challenge 01 — Containers & ACR

### Solution

```bash
RG=rg-frontier-aks
LOCATION=eastus
ACR_NAME=acrfrontier$RANDOM

az group create --name $RG --location $LOCATION
az acr create --resource-group $RG --name $ACR_NAME --sku Premium

# Build via ACR Tasks (no local Docker needed)
az acr build --registry $ACR_NAME --image fabtech-api:v1 ./api/
az acr build --registry $ACR_NAME --image fabtech-web:v1 ./web/
```

### Coach Tips

- If students don't have Docker Desktop, steer them to ACR Tasks immediately.
- Emphasize the `--sku Premium` choice — they'll need geo-replication and private endpoints later.
- The `whatthehackmsft/api` and `whatthehackmsft/web` public images can be imported into ACR:
  `az acr import --name $ACR_NAME --source docker.io/whatthehackmsft/api:latest --image fabtech-api:v1`

---

## Challenge 02 — AKS Cluster Deployment

### Solution (Standard)

```bash
az aks create \
  --resource-group $RG \
  --name aks-frontier \
  --location $LOCATION \
  --network-plugin azure \
  --network-plugin-mode overlay \
  --network-dataplane cilium \
  --enable-oidc-issuer \
  --enable-workload-identity \
  --node-count 3 \
  --zones 1 2 3 \
  --os-sku AzureLinux \
  --node-vm-size Standard_D4ds_v5 \
  --attach-acr $ACR_NAME \
  --generate-ssh-keys
```

### Coach Tips

- **Quota:** `Standard_D4ds_v5` requires D-series quota. Check with:
  `az vm list-usage --location eastus --query "[?contains(name.value,'standardDDSv5Family')]" -o table`
- **AKS Automatic:** Some teams may not have `--sku automatic` available in their subscription
  (still preview in some regions). Standard is the safe fallback.
- **`--attach-acr` ownership issue:** Requires Owner role. If the team only has Contributor,
  they can manually run:
  `az role assignment create --role AcrPull --assignee-object-id <cluster-identity-object-id> --scope <acr-id>`
- Verify OIDC: `az aks show -n aks-frontier -g $RG --query "oidcIssuerProfile.enabled"`

---

## Challenge 03 — Helm & App Routing Ingress

### App Routing Add-on

```bash
az aks addon enable --resource-group $RG --name aks-frontier --addon web_application_routing
```

### Minimal Helm Values

```yaml
# values.yaml
api:
  image:
    repository: acrfrontierXXXX.azurecr.io/fabtech-api
    tag: v1
  service:
    port: 3001
  replicaCount: 2

web:
  image:
    repository: acrfrontierXXXX.azurecr.io/fabtech-web
    tag: v1
  service:
    port: 3000
  replicaCount: 2

ingress:
  enabled: true
  className: webapprouting.kubernetes.azure.com
  hosts:
    - host: fabtech.X.X.X.X.nip.io
      paths:
        - path: /
          pathType: Prefix
          backend:
            service:
              name: fabtech-web
              port: 3000
```

### Coach Tips

- Common mistake: using `kubernetes.io/ingress.class` annotation instead of `spec.ingressClassName`.
  The annotation is deprecated — use `spec.ingressClassName: webapprouting.kubernetes.azure.com`.
- Remind students: never use `apiVersion: extensions/v1beta1` — use `networking.k8s.io/v1`.

---

## Challenge 04 — Workload Identity & Secrets

### Key Commands

```bash
# Get tenant ID
TENANT_ID=$(az account show --query tenantId -o tsv)

# Grant Key Vault access
KV_ID=$(az keyvault show --name $KV_NAME --query id -o tsv)
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee-object-id $MI_OBJECT_ID \
  --assignee-principal-type ServicePrincipal \
  --scope $KV_ID
```

### Coach Tips

- The `SecretProviderClass` YAML requires exact `tenantId` and `clientID` — common typo source.
- Students often forget to annotate the Kubernetes `ServiceAccount` with the managed identity client ID.
- Verify the CSI driver is running: `kubectl get pods -n kube-system | grep secrets-store`
- The `syncSecret.enabled=true` Helm flag is required to sync secrets as Kubernetes Secrets.

---

## Challenge 05 — Observability

### Key Commands

```bash
# Enable Managed Prometheus on existing cluster
az aks update \
  --resource-group $RG \
  --name aks-frontier \
  --enable-azure-monitor-metrics \
  --azure-monitor-workspace-resource-id <workspace-id>
```

### Coach Tips

- Data takes 3–5 minutes to appear in Grafana after enabling.
- Pre-built dashboards are available under **Dashboards > Azure Managed Prometheus**.
- For KQL queries, the `ContainerLogV2` table is newer and better than `ContainerLog`.
- Common issue: `az monitor account create` is a new command — requires az CLI >= 2.50.

---

## Challenge 06 — Autoscaling

### KEDA ScaledObject with Workload Identity

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: keda-serviceaccount
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
```

### Coach Tips

- KEDA scale-to-zero is the most impressive demo — queue empty = 0 pods, send messages = pods appear.
- VPA in `Off` mode (recommendation only) is safe for demos; `Auto` mode can cause pod disruption.
- Karpenter/NAP is a preview feature — may not be available in all regions.

---

## Challenge 07 — GitOps with Flux v2

### Verify Flux Configuration

```bash
az k8s-configuration flux show \
  --cluster-type managedClusters \
  --cluster-name aks-frontier \
  --resource-group $RG \
  --name fabtech-gitops
```

### Coach Tips

- Flux v1 commands (`fluxctl`, `helm-operator`) do not exist in Flux v2.
- The `microsoft.flux` extension installs Flux v2 controllers in the `flux-system` namespace.
- Default reconciliation interval is 10 minutes. Force sync: `flux reconcile source git flux-system`
- For the drift detection demo, Flux reverts in max 10 minutes — tell students to wait or force reconcile.

---

## Challenge 08 — Security

### Verify Policy is Blocking Privileged Pods

```bash
# Should be denied:
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: priv-test
  namespace: fabtech
spec:
  containers:
  - name: c
    image: nginx
    securityContext:
      privileged: true
EOF
```

Expected: `Error from server: admission webhook denied request`

### Coach Tips

- Azure Policy takes 5–10 minutes after assignment before enforcement begins.
- `az aks enable-addons --addons azure-policy` requires the cluster to be running.
- Cilium network policies go beyond Kubernetes NetworkPolicy — L7 filtering is a powerful demo.

---

## Challenge 09 — Istio Service Mesh

### Verify mTLS

```bash
# Check PeerAuthentication
kubectl get peerauthentication -n fabtech
kubectl describe peerauthentication default -n fabtech
```

### Coach Tips

- The Istio revision label format is `asm-1-XX` — get the exact value with:
  `az aks mesh get-revisions --location $LOCATION`
- After enabling the namespace label, pods must be **restarted** to inject sidecars.
- Canary routing via `VirtualService` is the most engaging demo — show real traffic split.
- Note: AKS managed Istio is updated independently from the cluster — check revision availability.

---

## Challenge 10 — Storage

### Storage Class Reference

```bash
kubectl get storageclass
# Key classes:
# managed-csi          → Standard SSD (Azure Disk)
# managed-csi-premium  → Premium SSD (Azure Disk)
# azurefile-csi        → Standard Azure Files
# azurefile-csi-premium → Premium Azure Files (NFS)
```

### Coach Tips

- `ReadWriteOnce` (Azure Disk) = one pod at a time; `ReadWriteMany` (Azure Files) = multiple pods.
- StatefulSet `volumeClaimTemplates` creates one PVC per pod replica — emphasize this differs from Deployment.
- Azure Backup for AKS is a relatively new feature — the portal wizard is easier than pure CLI.

---

## Challenge 11 — Enterprise Networking

### Quick Validation

```bash
# Verify private cluster API endpoint
az aks show --resource-group $RG --name aks-frontier-private \
  --query "apiServerAccessProfile.enablePrivateCluster"
# Expected: true

# Use az aks command invoke for private clusters
az aks command invoke \
  --resource-group $RG \
  --name aks-frontier-private \
  --command "kubectl get nodes"
```

### Coach Tips

- Private cluster creation takes 10–15 minutes longer than public clusters.
- Teams without full Firewall setup can use **NAT Gateway** as a simpler egress option.
- `az aks command invoke` is the key tool for working with private clusters without a jumpbox.

---

## Challenge 12 — Fleet Manager

### Common Issues

- Fleet hub creation takes ~5 minutes.
- `ClusterResourcePlacement` requires the Fleet hub kubeconfig (not the member cluster kubeconfig).
- The `placement.kubernetes-fleet.io` CRDs are only available on the fleet hub cluster.

### Coach Tips

- For teams with only 1 cluster, they can create a second cheap cluster (1 node, B-series) just for Fleet demo.
- The upgrade run demo is impressive even if not executed — showing the staged strategy is sufficient.
- Fleet-wide Azure Policy assignment is at subscription scope — requires Owner on the subscription.

---

## Challenge AI-01 — GPU Foundations

### GPU Quota Check

```bash
az vm list-usage --location eastus \
  --query "[?contains(name.value,'NC')]" \
  -o table
```

### Common Issues

- **No GPU quota:** Students need to request quota increases 24–48 hours in advance.
  Use `Standard_NC4as_T4_v3` (T4, 4 vCPUs) as the minimum viable option.
- **NVIDIA device plugin not starting:** Usually a quota or node pool sizing issue.

---

## Challenge AI-02 — KAITO

### Workspace Status

```bash
kubectl describe workspace workspace-phi3-mini -n kaito-workspace
# Look for: Status.Conditions[*].Type == Ready
```

### Common Issues

- Model download takes 5–15 minutes (Phi-3.5-mini is ~4 GB).
- KAITO requires the AI Toolchain Operator preview feature — register in advance:
  `az feature register --namespace Microsoft.ContainerService --name AIToolchainOperatorPreview`
- **Cost alert:** A single T4 GPU node costs ~$0.50–$0.75/hour. Ensure students scale down after the challenge.

---

## Deprecation Reference

See [Deprecation-Cheatsheet.md](./Deprecation-Cheatsheet.md) for a full list of deprecated
features found in the source WhatTheHack hackathons (001, 023, 039) and their modern replacements.
