# Challenge 11 — Enterprise Networking

[< Previous Challenge](./Challenge-10.md) — **[Home](../README.md)** — [Next Challenge >](./Challenge-12.md)

## Introduction

Enterprise clusters must meet strict networking requirements: no public API server, no
unrestricted egress, private connectivity to PaaS services.

In this challenge you will:
1. Make the AKS API server **private**
2. Configure **egress control** with Azure Firewall (or NAT Gateway)
3. Enable **private endpoints** for ACR and Key Vault
4. Explore advanced **Cilium network policies**

> **Note:** This challenge works best with a fresh cluster. If modifying your existing
> cluster is not possible, work through the architecture design and CLI commands with
> your coach, then apply the changes to a secondary cluster.

## Description

### Part 1: Private AKS Cluster

A private cluster exposes the Kubernetes API server only via a private IP, reachable only
from within the VNet (or peered networks).

```bash
RG=rg-frontier-aks
LOCATION=eastus

# Create a VNet with subnets
az network vnet create \
  --resource-group $RG \
  --name vnet-frontier \
  --address-prefix 10.0.0.0/16 \
  --subnet-name snet-aks \
  --subnet-prefix 10.0.0.0/22

AKS_SUBNET_ID=$(az network vnet subnet show \
  --resource-group $RG \
  --vnet-name vnet-frontier \
  --name snet-aks \
  --query id -o tsv)

# Deploy a private cluster
az aks create \
  --resource-group $RG \
  --name aks-frontier-private \
  --location $LOCATION \
  --enable-private-cluster \
  --vnet-subnet-id $AKS_SUBNET_ID \
  --network-plugin azure \
  --network-plugin-mode overlay \
  --network-dataplane cilium \
  --enable-oidc-issuer \
  --enable-workload-identity \
  --zones 1 2 3 \
  --generate-ssh-keys
```

> With a private cluster, `kubectl` commands from outside the VNet will fail.
> Connect via Azure Bastion, a jump server in the VNet, or Azure Cloud Shell with VNet injection.

Run commands against the private cluster using the Azure CLI's built-in tunnel:

```bash
az aks command invoke \
  --resource-group $RG \
  --name aks-frontier-private \
  --command "kubectl get nodes"
```

### Part 2: Private Endpoints for ACR and Key Vault

```bash
ACR_NAME=<your-acr-name>
KV_NAME=<your-keyvault-name>

# Create a subnet for private endpoints
az network vnet subnet create \
  --resource-group $RG \
  --vnet-name vnet-frontier \
  --name snet-pe \
  --address-prefix 10.0.4.0/26 \
  --disable-private-endpoint-network-policies true

# Private endpoint for ACR
az network private-endpoint create \
  --resource-group $RG \
  --name pe-acr \
  --vnet-name vnet-frontier \
  --subnet snet-pe \
  --private-connection-resource-id \
  $(az acr show --name $ACR_NAME --query id -o tsv) \
  --group-id registry \
  --connection-name conn-acr

# Private DNS zone for ACR
az network private-dns zone create \
  --resource-group $RG \
  --name privatelink.azurecr.io

az network private-dns link vnet create \
  --resource-group $RG \
  --zone-name privatelink.azurecr.io \
  --name link-acr \
  --virtual-network vnet-frontier \
  --registration-enabled false

az network private-endpoint dns-zone-group create \
  --resource-group $RG \
  --endpoint-name pe-acr \
  --name acr-zone-group \
  --private-dns-zone privatelink.azurecr.io \
  --zone-name registry

# Disable public network access on ACR (optional)
az acr update --name $ACR_NAME --public-network-enabled false
```

Repeat the same pattern for Key Vault using `--group-id vault` and DNS zone `privatelink.vaultcore.azure.net`.

### Part 3: Egress Control with Azure Firewall

Create a dedicated subnet for Azure Firewall:

```bash
az network vnet subnet create \
  --resource-group $RG \
  --vnet-name vnet-frontier \
  --name AzureFirewallSubnet \
  --address-prefix 10.0.5.0/26

# Create Firewall (Standard tier)
az network firewall create \
  --resource-group $RG \
  --name fw-frontier \
  --location $LOCATION \
  --sku-tier Standard

# Add public IP
az network public-ip create \
  --resource-group $RG \
  --name pip-fw \
  --sku Standard

az network firewall ip-config create \
  --firewall-name fw-frontier \
  --resource-group $RG \
  --name fw-config \
  --public-ip-address pip-fw \
  --vnet-name vnet-frontier

FW_PRIVATE_IP=$(az network firewall show \
  --resource-group $RG \
  --name fw-frontier \
  --query "ipConfigurations[0].privateIPAddress" -o tsv)
```

Add AKS required FQDN rules:

```bash
az network firewall application-rule create \
  --resource-group $RG \
  --firewall-name fw-frontier \
  --collection-name aks-required \
  --priority 100 \
  --action Allow \
  --name aks-fqdns \
  --source-addresses "*" \
  --protocols Https=443 \
  --target-fqdns \
    "*.hcp.${LOCATION}.azmk8s.io" \
    "mcr.microsoft.com" \
    "*.data.mcr.microsoft.com" \
    "management.azure.com" \
    "login.microsoftonline.com" \
    "packages.microsoft.com" \
    "acs-mirror.azureedge.net"
```

Create a UDR to route AKS egress through the Firewall:

```bash
az network route-table create --resource-group $RG --name rt-aks
az network route-table route create \
  --resource-group $RG \
  --route-table-name rt-aks \
  --name default \
  --address-prefix 0.0.0.0/0 \
  --next-hop-type VirtualAppliance \
  --next-hop-ip-address $FW_PRIVATE_IP

az network vnet subnet update \
  --resource-group $RG \
  --vnet-name vnet-frontier \
  --name snet-aks \
  --route-table rt-aks
```

### Part 4: Advanced Cilium Network Policies (Layer 7)

With Cilium, you can enforce L7 HTTP policies:

```yaml
# cilium-l7-policy.yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: allow-api-get-only
  namespace: fabtech
spec:
  endpointSelector:
    matchLabels:
      app: fabtech-api
  ingress:
  - fromEndpoints:
    - matchLabels:
        app: fabtech-web
    toPorts:
    - ports:
      - port: "3001"
        protocol: TCP
      rules:
        http:
        - method: GET
          path: /api/.*
```

```bash
kubectl apply -f cilium-l7-policy.yaml

# Test: POST should be blocked
kubectl exec -n fabtech $WEB_POD -- \
  curl -s -X POST http://fabtech-api:3001/api/speakers -d '{"name":"test"}'
# Expected: 403 Access Denied
```

## Success Criteria

1. A private AKS cluster exists with no public API server endpoint — show that `kubectl get nodes`
   fails from outside the VNet but succeeds via `az aks command invoke`.
2. Private endpoints are configured for ACR and Key Vault — show that DNS resolves to private IPs.
3. Explain to your coach how a UDR + Azure Firewall prevents unrestricted egress from AKS nodes.
4. *(Optional)* Show a Cilium L7 policy blocking POST requests while allowing GET.

## Learning Resources

- [Private AKS cluster](https://learn.microsoft.com/azure/aks/private-cluster)
- [Restrict egress traffic in AKS](https://learn.microsoft.com/azure/aks/limit-egress-traffic)
- [Private endpoints for ACR](https://learn.microsoft.com/azure/container-registry/container-registry-private-link)
- [Azure Private Link overview](https://learn.microsoft.com/azure/private-link/private-link-overview)
- [Cilium network policies](https://learn.microsoft.com/azure/aks/azure-cni-powered-by-cilium)
