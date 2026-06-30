# Challenge 02 — AKS Cluster Deployment — Coach Solution

[< Previous Solution](./Solution-01.md) | [Home](../../README.md) | [Next Solution >](./Solution-03.md)

## Notes & Guidance

- Teams should pick either **AKS Automatic** or **AKS Standard** — document both paths.
- **Quota check first:** `Standard_D2s_v3` requires D-series vCPU quota. If unavailable,
  `Standard_D2ds_v5` (2 vCPU) is a viable substitute.
- **`--attach-acr` requires Owner role.** If the team only has Contributor, they must
  create the `AcrPull` role assignment manually after cluster creation.
- OIDC issuer is critical for Challenge 04 (Workload Identity). Verify it is enabled
  before teams move on.
- Azure Linux (`AzureLinux`) is the recommended OS SKU.

### Common Issues

- **AKS Automatic not available:** Still preview in some regions. Fall back to Standard path.
- **Cilium + Overlay not available:** Requires K8s >= 1.30. Confirm your cluster is running
  1.30 or later.
- **`--network-dataplane cilium` vs `--network-policy cilium`:** `--network-dataplane cilium`
  replaces the Linux iptables/kube-proxy dataplane with Cilium's eBPF engine. When this flag
  is set, Cilium automatically handles NetworkPolicy enforcement — there is no need to also
  pass `--network-policy cilium`. Use `--network-policy cilium` only when you want Cilium for
  policy enforcement while keeping the iptables dataplane (a legacy combination).
- **`kubelogin` token error after `az aks get-credentials`:** Ensure `kubelogin` is installed
  and run `kubelogin convert-kubeconfig -l azurecli`.

## Solution — AKS Standard (Primary Path)

```bash
RG=rg-frontier-aks
LOCATION=swedencentral
CLUSTER_NAME=aks-frontier
ACR_NAME=<ACR_NAME_FROM_CHALLENGE_01>

# Enable Node Auto-Provisioning (Karpenter-based) for Challenge 06.
# This requires --network-dataplane cilium and --network-plugin-mode overlay.
az aks create \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --location $LOCATION \
  --network-plugin azure \
  --network-plugin-mode overlay \
  --network-dataplane cilium \
  --node-provisioning-mode Auto \
  --enable-oidc-issuer \
  --enable-workload-identity \
  --node-count 3 \
  --zones 1 2 3 \
  --os-sku AzureLinux \
  --node-vm-size Standard_D2s_v3 \
  --attach-acr $ACR_NAME \
  --auto-upgrade-channel stable \
  --node-os-upgrade-channel NodeImage \
  --generate-ssh-keys

# Add a user node pool for application workloads
az aks nodepool add \
  --resource-group $RG \
  --cluster-name $CLUSTER_NAME \
  --name apppool \
  --node-count 2 \
  --node-vm-size Standard_D2s_v3 \
  --os-sku AzureLinux \
  --zones 1 2 3 \
  --mode User
```

## Solution — AKS Automatic (Alternative)

```bash
az aks create \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --location $LOCATION \
  --sku automatic \
  --attach-acr $ACR_NAME \
  --generate-ssh-keys
```

> AKS Automatic pre-configures OIDC, Workload Identity, Cilium, cluster autoscaler,
> Defender, and Azure Policy by default.

### Configure kubectl

```bash
az aks get-credentials \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --overwrite-existing

# Convert kubeconfig for Entra ID auth
kubelogin convert-kubeconfig -l azurecli

# Verify
kubectl get nodes -o wide
```

### Verify OIDC and Workload Identity

```bash
az aks show \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --query "{oidcEnabled:oidcIssuerProfile.enabled, wiEnabled:securityProfile.workloadIdentity.enabled}" \
  -o table
```
