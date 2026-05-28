# Challenge 01 — Containers & Azure Container Registry

[< Previous Challenge](./Challenge-00.md) — **[Home](../README.md)** — [Next Challenge >](./Challenge-02.md)

## Introduction

Every cloud-native journey starts with a container. In this challenge you will package the
**FabTechOps** application into Docker images, deploy an Azure Container Registry (ACR),
and push your images — all without storing credentials in environment variables.

## Description

### Part 1: Build Container Images

Your coach will provide a `Resources.zip` with the application source code.

Pre-built images are also available on Docker Hub if you want to skip the build step:
- `whatthehackmsft/web:latest`
- `whatthehackmsft/api:latest`

To build locally:

```bash
# Build the API image
cd api/
docker build -t fabtech-api:v1 .

# Build the Web image
cd ../web/
docker build -t fabtech-web:v1 .
```

Run both containers locally and verify they start:

```bash
docker run -d -p 3001:3001 --name api fabtech-api:v1
docker run -d -p 3000:3000 --name web fabtech-web:v1
```

> **Note:** Docker Desktop is optional. In later challenges AKS will pull images from
> ACR — you do not need Docker locally to complete the rest of the hack.

### Part 2: Deploy Azure Container Registry

Create a resource group and an ACR instance:

```bash
LOCATION=eastus
RG=rg-frontier-aks
ACR_NAME=acrfrontier$RANDOM   # must be globally unique

az group create --name $RG --location $LOCATION

az acr create \
  --resource-group $RG \
  --name $ACR_NAME \
  --sku Premium \
  --location $LOCATION
```

> **Why Premium?** Premium unlocks geo-replication, private endpoints, and content trust
> — features you will use in later challenges.

### Part 3: Authenticate and Push Images

Use the ACR login server to tag and push:

```bash
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)

# Tag images
docker tag fabtech-api:v1 $ACR_LOGIN_SERVER/fabtech-api:v1
docker tag fabtech-web:v1 $ACR_LOGIN_SERVER/fabtech-web:v1

# Login and push
az acr login --name $ACR_NAME
docker push $ACR_LOGIN_SERVER/fabtech-api:v1
docker push $ACR_LOGIN_SERVER/fabtech-web:v1
```

Verify the images are in the registry:

```bash
az acr repository list --name $ACR_NAME -o table
```

### Part 4: Build Without a Local Docker Daemon (ACR Tasks)

As an alternative to building locally, use **ACR Tasks** to build images in the cloud:

```bash
az acr build --registry $ACR_NAME --image fabtech-api:v1 ./api/
az acr build --registry $ACR_NAME --image fabtech-web:v1 ./web/
```

> **Tip:** ACR Tasks are perfect for CI/CD scenarios where no local Docker daemon is available
> (e.g., GitHub Actions runners, Cloud Shell).

## Success Criteria

1. An Azure Container Registry exists in your resource group.
2. At least one of the following images is in ACR (built locally or via ACR Tasks):
   - `fabtech-api:v1`
   - `fabtech-web:v1`
3. Show `az acr repository list` returning both images.
4. Explain to your coach how ACR Tasks differ from a local `docker build + push` workflow.

## Learning Resources

- [Azure Container Registry overview](https://learn.microsoft.com/azure/container-registry/container-registry-intro)
- [Build container images in the cloud with ACR Tasks](https://learn.microsoft.com/azure/container-registry/container-registry-tutorial-quick-task)
- [ACR authentication overview](https://learn.microsoft.com/azure/container-registry/container-registry-authentication)
- [ACR Premium tier features](https://learn.microsoft.com/azure/container-registry/container-registry-skus)
