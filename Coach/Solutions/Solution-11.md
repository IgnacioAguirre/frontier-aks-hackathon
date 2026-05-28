# Challenge 11 — Enterprise Networking — Coach Solution

[< Previous Solution](./Solution-10.md) | [Home](../../README.md) | [Next Solution >](./Solution-12.md)

## Notes & Guidance

- **Private cluster creation takes 10–15 minutes longer** than public clusters — set
  expectations before teams start this challenge.
- Teams without budget for Azure Firewall can use **NAT Gateway** as a simpler egress
  option (cheaper, less flexible).
- `az aks command invoke` is the essential tool for running `kubectl` commands against a
  private cluster without a jumpbox or VPN. Coaches should demo this early.
- **VM Availability Sets are retiring September 30, 2025.** Do not allow teams to create
  node pools with `--vm-set-type AvailabilitySet`. All new node pools must use VMSS.

### Common Issues

- **`kubectl` not working after private cluster creation:** Expected. The API server is
  only reachable from within the VNet. Use `az aks command invoke` or create a jumpbox VM.
- **ACR pull failing in private cluster:** The cluster cannot reach the public ACR endpoint.
  Teams must create a Private Endpoint for ACR and configure the cluster to use it.
- **DNS resolution for private endpoint:** Private endpoints require a Private DNS Zone
  (`privatelink.azurecr.io`) linked to the VNet. The CLI creates this automatically, but
  verify: `az network private-endpoint dns-zone-group list`.

## Solution

### Part 1: Create Private AKS Cluster

```bash
RG=rg-frontier-aks
LOCATION=eastus
VNET_NAME=vnet-frontier
CLUSTER_NAME=aks-frontier-private
ACR_NAME=<ACR_FROM_CHALLENGE_01>

# Create VNet with dedicated subnets
az network vnet create \
  --resource-group $RG \
  --name $VNET_NAME \
  --address-prefix 10.0.0.0/8 \
  --subnet-name aks-subnet \
  --subnet-prefix 10.1.0.0/16

az network vnet subnet create \
  --resource-group $RG \
  --vnet-name $VNET_NAME \
  --name AzureFirewallSubnet \
  --address-prefix 10.2.0.0/26

SUBNET_ID=$(az network vnet subnet show \
  --resource-group $RG \
  --vnet-name $VNET_NAME \
  --name aks-subnet \
  --query id -o tsv)

# Create private cluster
az aks create \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --location $LOCATION \
  --enable-private-cluster \
  --network-plugin azure \
  --network-plugin-mode overlay \
  --network-dataplane cilium \
  --vnet-subnet-id $SUBNET_ID \
  --enable-oidc-issuer \
  --enable-workload-identity \
  --node-count 3 \
  --os-sku AzureLinux \
  --node-vm-size Standard_D4ds_v5 \
  --generate-ssh-keys

# Run kubectl via command invoke (no VPN/jumpbox needed)
az aks command invoke \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --command "kubectl get nodes"
```

### Part 2: Private Endpoint for ACR

```bash
ACR_ID=$(az acr show --name $ACR_NAME --query id -o tsv)
VNET_ID=$(az network vnet show --resource-group $RG --name $VNET_NAME --query id -o tsv)

# Disable public access on ACR
az acr update --name $ACR_NAME --public-network-enabled false

# Create private endpoint
az network private-endpoint create \
  --resource-group $RG \
  --name pe-acr \
  --vnet-name $VNET_NAME \
  --subnet aks-subnet \
  --private-connection-resource-id $ACR_ID \
  --group-id registry \
  --connection-name acr-connection

# Create Private DNS Zone
az network private-dns zone create \
  --resource-group $RG \
  --name privatelink.azurecr.io

az network private-dns link vnet create \
  --resource-group $RG \
  --zone-name privatelink.azurecr.io \
  --name acr-dns-link \
  --virtual-network $VNET_NAME \
  --registration-enabled false

# Add DNS record for the private endpoint
ENDPOINT_NIC=$(az network private-endpoint show \
  --resource-group $RG --name pe-acr \
  --query "networkInterfaces[0].id" -o tsv)

PRIVATE_IP=$(az network nic show --ids $ENDPOINT_NIC \
  --query "ipConfigurations[0].privateIPAddress" -o tsv)

az network private-dns record-set a add-record \
  --resource-group $RG \
  --zone-name privatelink.azurecr.io \
  --record-set-name $ACR_NAME \
  --ipv4-address $PRIVATE_IP
```

### Part 3: Egress via NAT Gateway (Budget Option)

```bash
# Create NAT Gateway
az network public-ip create \
  --resource-group $RG \
  --name nat-public-ip \
  --sku Standard \
  --allocation-method Static

az network nat gateway create \
  --resource-group $RG \
  --name nat-gateway \
  --location $LOCATION \
  --public-ip-addresses nat-public-ip

# Attach to AKS subnet
az network vnet subnet update \
  --resource-group $RG \
  --vnet-name $VNET_NAME \
  --name aks-subnet \
  --nat-gateway nat-gateway

# Verify egress IP
az aks command invoke \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --command "curl -s ifconfig.me"
# Should match the NAT Gateway public IP
```

### Part 4: Internal Load Balancer for Ingress

```yaml
# internal-ingress-annotation.yaml
# Add this annotation to the App Routing Ingress Service or use an IngressClass
apiVersion: v1
kind: Service
metadata:
  name: nginx-internal
  namespace: app-routing-system
  annotations:
    service.beta.kubernetes.io/azure-load-balancer-internal: "true"
spec:
  type: LoadBalancer
  selector:
    app: nginx
  ports:
  - port: 80
    targetPort: 80
```
