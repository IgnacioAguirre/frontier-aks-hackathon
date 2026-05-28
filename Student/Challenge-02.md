# Challenge 02 — AKS Cluster Deployment

[< Previous Challenge](./Challenge-01.md) — **[Home](../README.md)** — [Next Challenge >](./Challenge-03.md)

## Introduction

Time to provision the Kubernetes cluster that will power the rest of the hack.
You will deploy a production-grade AKS cluster with:

- **Azure CNI Overlay** networking (scalable, no IP exhaustion)
- **Workload Identity** enabled (no Pod Identity, no secrets in pods)
- **Availability Zones** for node resilience
- **VMSS node pools** (Availability Sets are retired Sept 2025)
- **AzureLinux 3** as the node OS

You can choose between **AKS Standard** (full control) and **AKS Automatic** (opinionated,
production-ready defaults). Both paths are described below.

## Description

### Part 1: Choose Your Deployment Mode

#### Option A — AKS Standard (Full Control)

```bash
# Variables from Challenge 01
LOCATION=eastus
RG=rg-frontier-aks
ACR_NAME=<your-acr-name>
CLUSTER_NAME=aks-frontier

az aks create \
  --resource-group $RG \
  --name $CLUSTER_NAME \
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

> **Key flags explained:**
> - `--network-plugin-mode overlay`: Azure CNI Overlay — pods get IPs from a private overlay
>   network, not from the VNet CIDR. No more IP exhaustion.
> - `--network-dataplane cilium`: Cilium as the dataplane for advanced network policies.
> - `--enable-oidc-issuer` + `--enable-workload-identity`: Enables Entra ID Workload Identity
>   federation. Required for Challenge 04.
> - `--zones 1 2 3`: Spreads nodes across all availability zones.
> - `--attach-acr`: Grants the cluster's managed identity `AcrPull` permission on ACR.

#### Option B — AKS Automatic (Opinionated)

AKS Automatic pre-configures production defaults: Karpenter node provisioning, Workload Identity,
managed Prometheus/Grafana, and Azure Policy.

```bash
az aks create \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --location $LOCATION \
  --sku automatic \
  --attach-acr $ACR_NAME
```

> **Note:** With AKS Automatic you cannot choose `--node-count` or `--zones` directly — the
> cluster auto-provisions nodes as needed. Monitoring and security are enabled by default.

### Part 2: Connect to the Cluster

```bash
az aks get-credentials --resource-group $RG --name $CLUSTER_NAME
kubectl get nodes -o wide
```

Verify nodes are spread across availability zones:

```bash
kubectl get nodes --label-columns topology.kubernetes.io/zone
```

### Part 3: Explore the Cluster

```bash
# Check Kubernetes version
kubectl version

# Check node OS and VM size
kubectl get nodes -o custom-columns=NAME:.metadata.name,OS:.status.nodeInfo.osImage,ZONE:.metadata.labels.'topology\.kubernetes\.io/zone'

# Check system pods
kubectl get pods -n kube-system

# Confirm CNI Overlay is active
kubectl get nodes -o jsonpath='{.items[0].spec.podCIDR}'
```

### Part 4 (Optional): Enable the AKS Portal Workloads View

```bash
az aks browse --resource-group $RG --name $CLUSTER_NAME
```

> **Note:** This opens the cluster's workloads view in the Azure portal. This is the
> modern replacement for the deprecated Kubernetes Dashboard.

## Success Criteria

1. A running, multi-node AKS cluster exists in your resource group.
2. Nodes are spread across at least **2 availability zones**.
3. The cluster uses **Azure CNI Overlay** (verify with `kubectl get nodes -o wide` — pod CIDRs
   are in the overlay range, not your VNet CIDR).
4. Workload Identity is enabled: `az aks show --name $CLUSTER_NAME --resource-group $RG --query "oidcIssuerProfile.enabled"` returns `true`.
5. The cluster is attached to ACR: `az aks show ... --query "identityProfile"` shows an identity with `acrPullRole`.
6. Explain to your coach the difference between **AKS Standard** and **AKS Automatic**.

## Learning Resources

- [AKS quickstart with CLI](https://learn.microsoft.com/azure/aks/learn/quick-kubernetes-deploy-cli)
- [Azure CNI Overlay networking](https://learn.microsoft.com/azure/aks/azure-cni-overlay)
- [AKS and availability zones](https://learn.microsoft.com/azure/aks/availability-zones)
- [Workload Identity overview](https://learn.microsoft.com/azure/aks/workload-identity-overview)
- [AKS Automatic overview](https://learn.microsoft.com/azure/aks/automatic/overview)
- [Cilium dataplane on AKS](https://learn.microsoft.com/azure/aks/azure-cni-powered-by-cilium)
