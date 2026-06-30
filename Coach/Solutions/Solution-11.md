# Challenge 11 — Enterprise Networking — Coach Solution

[< Previous Solution](./Solution-10.md) | [Home](../../README.md) | [Next Solution >](./Solution-12.md)

## Notes & Guidance

- **Private cluster creation takes 10–15 minutes longer** than public clusters — set
  expectations before teams start this challenge.
- Teams without budget for Azure Firewall can use **NAT Gateway** as a simpler egress
  option (cheaper, less flexible).
- `az aks command invoke` is the essential tool for running `kubectl` commands against a
  private cluster without a jumpbox or VPN. Coaches should demo this early.
- **NAT Gateway order matters:** Create and attach the NAT Gateway to the subnet BEFORE
  creating the AKS cluster and use `--outbound-type userAssignedNATGateway` at cluster
  creation time. Attaching the NAT GW post-creation will route egress traffic through it at
  the subnet level, but the AKS control plane will still report `outboundType: loadBalancer`.
  The functional egress works either way, but the cleanest approach is pre-cluster setup.
- **App Routing is auto-enabled** on clusters provisioned with newer AKS versions — you do
  not need to run `az aks enable-addons --addons http_application_routing`. Use
  `az aks approuting update` to switch between nginx modes.
- **ACR private endpoint creates two IPs** (registry + data). Both DNS A records must be
  added manually when using the CLI approach (the CLI does not auto-create a DNS zone group).
- **Disabling public ACR access breaks existing clusters** that are not on the same VNet.
  If you have an existing cluster (`aks-frontier`) using the same ACR, do NOT run
  `az acr update --public-network-enabled false` until the existing cluster is decommissioned
  or also configured to use the private endpoint.

### Common Issues

- **`kubectl` not working after private cluster creation:** Expected. The API server is
  only reachable from within the VNet. Use `az aks command invoke` or create a jumpbox VM.
- **ACR pull failing in private cluster:** The cluster cannot reach the public ACR endpoint.
  Teams must create a Private Endpoint for ACR and configure the cluster to use it.
- **DNS resolution for private endpoint:** Private endpoints require a Private DNS Zone
  (`privatelink.azurecr.io`) linked to the VNet. The CLI does NOT automatically create the
  DNS zone group when using `az network private-endpoint create` — you must create the zone,
  link it to the VNet, and add **two** A records manually (registry + data endpoint).
- **ACR data endpoint DNS record missing:** ACR private link allocates two private IPs — one
  for the registry endpoint and one for the regional data endpoint (`<name>.<region>.data`).
  Both records are required for image pulls to succeed. See Part 2 for the corrected commands.
- **App Routing nginx mode:** The `az aks approuting update --nginx Internal` CLI option only
  affects **new** LoadBalancer services provisioned after the change. Existing nginx services
  are updated within ~60 seconds.

## Solution

### Part 1: Create Private AKS Cluster

```bash
RG=rg-frontier-aks
LOCATION=swedencentral
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

# ⚠️ IMPORTANT: Create NAT Gateway BEFORE the cluster so you can set --outbound-type correctly.
# See Part 3 for NAT Gateway creation commands. After creating it, attach it:
az network vnet subnet update \
  --resource-group $RG \
  --vnet-name $VNET_NAME \
  --name aks-subnet \
  --nat-gateway nat-gateway

# Create private cluster
# NOTE: node-count 2 is sufficient for the challenge (saves cost vs 3)
# NOTE: --service-cidr must not overlap with VNet address space (10.0.0.0/8)
# NOTE: App Routing is auto-enabled by AKS — no need to enable it separately
az aks create \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --location $LOCATION \
  --enable-private-cluster \
  --network-plugin azure \
  --network-plugin-mode overlay \
  --network-dataplane cilium \
  --vnet-subnet-id $SUBNET_ID \
  --service-cidr 192.168.0.0/16 \
  --dns-service-ip 192.168.0.10 \
  --enable-oidc-issuer \
  --enable-workload-identity \
  --node-count 2 \
  --os-sku AzureLinux \
  --node-vm-size Standard_D4ds_v5 \
  --attach-acr $ACR_NAME \
  --generate-ssh-keys

# Run kubectl via command invoke (no VPN/jumpbox needed)
# Direct kubectl WILL NOT work — the API server is private
az aks command invoke \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --command "kubectl get nodes"
```

### Part 2: Private Endpoint for ACR

> ⚠️ **Do NOT disable public ACR access** if an existing cluster (`aks-frontier`) is still
> using the same registry — it will break image pulls on that cluster. Only disable public
> access once all clusters are on the same private VNet.

```bash
ACR_ID=$(az acr show --name $ACR_NAME --query id -o tsv)

# OPTIONAL: Disable public access on ACR (only safe if no other cluster uses it publicly)
# az acr update --name $ACR_NAME --public-network-enabled false

# Create private endpoint
az network private-endpoint create \
  --resource-group $RG \
  --name pe-acr \
  --vnet-name $VNET_NAME \
  --subnet aks-subnet \
  --private-connection-resource-id $ACR_ID \
  --group-id registry \
  --connection-name acr-connection

# Create Private DNS Zone and link to VNet
az network private-dns zone create \
  --resource-group $RG \
  --name "privatelink.azurecr.io"

az network private-dns link vnet create \
  --resource-group $RG \
  --zone-name "privatelink.azurecr.io" \
  --name acr-dns-link \
  --virtual-network $VNET_NAME \
  --registration-enabled false

# ACR private endpoint allocates TWO IPs — registry + data endpoint
# Get both IPs from the NIC
ENDPOINT_NIC=$(az network private-endpoint show \
  --resource-group $RG --name pe-acr \
  --query "networkInterfaces[0].id" -o tsv)

PRIVATE_IP_REGISTRY=$(az network nic show --ids $ENDPOINT_NIC \
  --query "ipConfigurations[0].privateIPAddress" -o tsv)

PRIVATE_IP_DATA=$(az network nic show --ids $ENDPOINT_NIC \
  --query "ipConfigurations[1].privateIPAddress" -o tsv)

echo "Registry IP: $PRIVATE_IP_REGISTRY"
echo "Data IP:     $PRIVATE_IP_DATA"

# DNS record for registry endpoint: <name>.azurecr.io -> <name>.privatelink.azurecr.io
az network private-dns record-set a add-record \
  --resource-group $RG \
  --zone-name "privatelink.azurecr.io" \
  --record-set-name $ACR_NAME \
  --ipv4-address $PRIVATE_IP_REGISTRY

# DNS record for data endpoint: <name>.<region>.data.azurecr.io -> <name>.<region>.data.privatelink.azurecr.io
az network private-dns record-set a add-record \
  --resource-group $RG \
  --zone-name "privatelink.azurecr.io" \
  --record-set-name "${ACR_NAME}.${LOCATION}.data" \
  --ipv4-address $PRIVATE_IP_DATA
```

### Part 3: Egress via NAT Gateway (Budget Option)

> ⚠️ **Create the NAT Gateway BEFORE the AKS cluster** for the cleanest setup. If you
> already created the cluster, attaching NAT GW to the subnet still routes traffic through
> it at the network level, but `outboundType` in AKS will remain `loadBalancer`.

```bash
# Create public IP for NAT Gateway
az network public-ip create \
  --resource-group $RG \
  --name nat-public-ip \
  --sku Standard \
  --allocation-method Static \
  --location $LOCATION

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

# Verify egress IP matches NAT Gateway public IP
NAT_IP=$(az network public-ip show --resource-group $RG --name nat-public-ip --query ipAddress -o tsv)
echo "Expected egress IP: $NAT_IP"

az aks command invoke \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --command "curl -s --max-time 10 ifconfig.me"
# Output should match $NAT_IP
```

### Part 4: Internal Load Balancer for the Gateway

> **Note:** The private cluster (`aks-frontier-private`) uses App Routing in **nginx mode**
> by default (Gateway API CRDs are not installed). Use Option 2 (CLI) as the primary path.
> Option 1 (Gateway annotation) only applies if you have enabled Gateway API via
> `az aks approuting update --enable-gateway`.

**Option 2: Configure App Routing from the CLI (recommended for this challenge)**

```bash
az aks approuting update \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --nginx Internal
```

**Verify the internal load balancer**

```bash
az aks command invoke \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --command "kubectl get svc -n app-routing-system"
# nginx service EXTERNAL-IP should be a RFC 1918 address (e.g. 10.1.0.9)
```

After ~60 seconds the nginx Service should show an **internal RFC 1918 IP**
(e.g. `10.1.x.x`) rather than a public IP.

---

**Option 1: Annotate the Gateway resource (only if Gateway API is enabled)**

If students have enabled Gateway API, they can control internal LB per-Gateway:

```yaml
# gateway-internal.yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: fabtech-gateway
  namespace: fabtech
  annotations:
    service.beta.kubernetes.io/azure-load-balancer-internal: "true"
spec:
  gatewayClassName: webapprouting.kubernetes.azure.com
  listeners:
    - name: http
      port: 80
      protocol: HTTP
      allowedRoutes:
        namespaces:
          from: Same
```

```bash
az aks command invoke \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --command "kubectl apply -f /mnt/gateway-internal.yaml" \
  --file gateway-internal.yaml
```
