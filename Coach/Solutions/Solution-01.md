# Challenge 01 — Containers & ACR — Coach Solution

[< Previous Solution](./Solution-00.md) | [Home](../../README.md) | [Next Solution >](./Solution-02.md)

## Notes & Guidance

- Teams without Docker Desktop should use **ACR Tasks** immediately — no local Docker required.
- Emphasize `--sku Premium` for ACR. Geo-replication and private endpoints (Challenge 11)
  require Premium SKU. Standard will cause a failure later.
- The `whatthehackmsft/api` and `whatthehackmsft/web` images can be imported directly into ACR
  if teams run into trouble building from source — good unblocking strategy.
- Encourage teams to also push a `v2` tag at this point (even identical to `v1`) so they
  have multiple tags available for the rolling-update demo in Challenge 03.

### Common Issues

- **ACR name must be globally unique** — add `$RANDOM` or a team identifier suffix.
- **ACR Tasks timeout:** Large images can take >10 min. The `--no-wait` flag helps for
  parallel builds; use `az acr task logs` to monitor.
- **`az acr login` fails on CI / Cloud Shell:** Use `az acr build` (ACR Tasks) instead.

## Solution

```bash
RG=rg-frontier-aks
LOCATION=swedencentral
ACR_NAME=acrfrontier$RANDOM

# Create resource group and ACR
az group create --name $RG --location $LOCATION
az acr create \
  --resource-group $RG \
  --name $ACR_NAME \
  --sku Premium \
  --admin-enabled false

echo "ACR Login Server: $(az acr show --name $ACR_NAME --query loginServer -o tsv)"
```

### Option A — Build with ACR Tasks (recommended, no local Docker)

```bash
# Source code lives under Student/Resources/src/
az acr build \
  --registry $ACR_NAME \
  --image fabtech-api:v1 \
  --file Coach/Solutions/Resources/docker/Dockerfile.api \
  Student/Resources/src/content-api/

az acr build \
  --registry $ACR_NAME \
  --image fabtech-web:v1 \
  --file Coach/Solutions/Resources/docker/Dockerfile.web \
  Student/Resources/src/content-web/

# Tag v2 for rolling-update demo later
az acr import \
  --name $ACR_NAME \
  --source $ACR_NAME.azurecr.io/fabtech-api:v1 \
  --image fabtech-api:v2

az acr import \
  --name $ACR_NAME \
  --source $ACR_NAME.azurecr.io/fabtech-web:v1 \
  --image fabtech-web:v2
```

### Option B — Import public reference images

```bash
# Use pre-built WhatTheHack images as fallback
az acr import \
  --name $ACR_NAME \
  --source docker.io/whatthehackmsft/api:latest \
  --image fabtech-api:v1

az acr import \
  --name $ACR_NAME \
  --source docker.io/whatthehackmsft/web:latest \
  --image fabtech-web:v1
```

### Verify

```bash
az acr repository list --name $ACR_NAME --output table
az acr repository show-tags --name $ACR_NAME --repository fabtech-api
```
