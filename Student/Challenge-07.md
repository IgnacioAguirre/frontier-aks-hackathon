# Challenge 07 — GitOps with Flux v2

[< Previous Challenge](./Challenge-06.md) — **[Home](../README.md)** — [Next Challenge >](./Challenge-08.md)

## Introduction

GitOps treats Git as the **single source of truth** for cluster state. Any change to the
cluster must go through Git — no `kubectl apply` in production.

In this challenge you will implement GitOps using **Flux v2** via the AKS `microsoft.flux`
extension. Flux v2 is the only supported GitOps tool on AKS — Flux v1 is end-of-life.

> **Flux v1 is retired.** `fluxctl`, `HelmRelease` v1 CRDs, and the `flux-get-started` repository
> no longer work. Use `flux` CLI v2 and `az k8s-configuration flux`.

## Description

### Part 1: Fork the GitOps Repository

1. Fork the sample GitOps repository to your GitHub account:
   `https://github.com/Azure-Samples/gitops-flux2-kustomize-helm-mt`

   Or create your own repo with this structure:
   ```
   clusters/
     dev/
       kustomization.yaml
     prod/
       kustomization.yaml
   apps/
     base/
       fabtech-api/
         deployment.yaml
         service.yaml
         kustomization.yaml
     overlays/
       dev/
         kustomization.yaml   # patch: replicas=1
       prod/
         kustomization.yaml   # patch: replicas=3
   ```

2. Create a **Personal Access Token (PAT)** with `repo` scope on GitHub (or use a deploy key).

### Part 2: Enable the Flux Extension on AKS

```bash
RG=rg-frontier-aks
CLUSTER_NAME=aks-frontier

# Install the Flux extension
az k8s-extension create \
  --cluster-type managedClusters \
  --cluster-name $CLUSTER_NAME \
  --resource-group $RG \
  --name flux \
  --extension-type microsoft.flux

# Verify
kubectl get pods -n flux-system
```

### Part 3: Create a Flux Configuration

```bash
GITHUB_USER=<your-github-username>
GITHUB_PAT=<your-github-pat>
REPO_URL=https://github.com/$GITHUB_USER/your-gitops-repo

# Create the GitOps configuration pointing to the dev environment
az k8s-configuration flux create \
  --cluster-type managedClusters \
  --cluster-name $CLUSTER_NAME \
  --resource-group $RG \
  --name fabtech-gitops \
  --namespace flux-system \
  --scope cluster \
  --url $REPO_URL \
  --branch main \
  --https-user $GITHUB_USER \
  --https-key $GITHUB_PAT \
  --kustomization name=dev path=./clusters/dev prune=true
```

Verify the configuration is syncing:

```bash
az k8s-configuration flux show \
  --cluster-type managedClusters \
  --cluster-name $CLUSTER_NAME \
  --resource-group $RG \
  --name fabtech-gitops

kubectl get gitrepository -n flux-system
kubectl get kustomization -n flux-system
```

### Part 4: Make a Change via Git (No kubectl apply!)

1. Edit a file in your Git repository — for example, increase the replica count in
   `apps/overlays/dev/kustomization.yaml`.
2. Commit and push to `main`.
3. Watch Flux detect and apply the change:

```bash
# Force immediate reconciliation (optional — Flux polls every minute by default)
flux reconcile source git flux-system --namespace flux-system

# Watch kustomization status
kubectl get kustomization -n flux-system -w

# Confirm the deployment was updated
kubectl get deployment fabtech-api -n fabtech
```

> **Tip:** In Flux v2 the equivalent of `fluxctl sync` is:
> `flux reconcile source git <source-name>`

### Part 5: Drift Detection

Manually change a resource with `kubectl` (simulating unauthorized drift):

```bash
kubectl scale deployment fabtech-api --replicas=99 -n fabtech
```

Wait for the next Flux reconciliation (or force it). Observe Flux reverting the change back
to the Git-declared state.

### Part 6: Secrets via Key Vault (No Secrets in Git!)

Use the `secretRef` in your Flux `GitRepository` source if your repo is private. For
application secrets, continue using the **Secrets Store CSI driver** from Challenge 04 —
never commit secrets to Git.

For encrypting secrets in Git, consider **Sealed Secrets** (Bitnami) or **SOPS**.

## Success Criteria

1. The `microsoft.flux` extension is installed and Flux controllers are running in `flux-system`.
2. A `GitConfiguration` exists linking the cluster to your Git repo.
3. Show that a commit to the Git repo (e.g., replica count change) is automatically applied
   to the cluster within 2 minutes — **without running `kubectl apply`**.
4. Demonstrate drift detection: manually change a resource and show Flux reverting it.
5. Explain to your coach why you should **never commit secrets** to a GitOps repository.

## Learning Resources

- [GitOps with Flux v2 on AKS](https://learn.microsoft.com/azure/aks/gitops-flux-v2)
- [Flux v2 documentation](https://fluxcd.io/flux/)
- [AKS Flux extension configuration](https://learn.microsoft.com/azure/azure-arc/kubernetes/tutorial-use-gitops-flux2)
- [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
- [SOPS — Secrets OPerationS](https://github.com/getsops/sops)
