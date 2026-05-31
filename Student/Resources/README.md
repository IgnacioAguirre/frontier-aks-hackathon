# Student Resources — Frontier AKS Hackathon

This folder contains the source code and supporting files students need to complete
the hack challenges.

## How to Get These Resources

Your coach will package the contents of this folder into a **`Resources.zip`** file
and distribute it at the start of the event (via Microsoft Teams, email, or a shared
drive). **Do not clone or browse this repository** — working from the zip keeps the
focus on learning, not copy-pasting answers.

## Contents

| Folder / File | Used In | Description |
|---------------|---------|-------------|
| `FabTechOps/web/` | Challenge 01 | React frontend source code and Dockerfile |
| `FabTechOps/api/` | Challenge 01 | Node.js REST API source code and Dockerfile |
| `FabTechOps/manifests/` | Challenge 03–04 | Sample Kubernetes manifests and Helm chart skeleton |
| `FabTechOps/gitops/` | Challenge 07 | Sample Flux `GitRepository` and `Kustomization` manifests |

## Pre-built Images (Fallback)

If you run into issues building the images locally in Challenge 01, pre-built public
images are available on Docker Hub and can be imported directly into your ACR:

```bash
# Import pre-built images into your ACR (replace <ACR_NAME> with yours)
az acr import --name <ACR_NAME> --source docker.io/whatthehackmsft/api:latest --image fabtech-api:v1
az acr import --name <ACR_NAME> --source docker.io/whatthehackmsft/web:latest --image fabtech-web:v1
```

## Sample Application — FabTechOps

**FabTechOps** is a three-tier web application used throughout this hack:

| Tier | Description |
|------|-------------|
| **Frontend** (`web`) | React-based conference info site |
| **API** (`api`) | Node.js REST API backed by a database |
| **Database** | Azure SQL / PostgreSQL (managed PaaS) |
