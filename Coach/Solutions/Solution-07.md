# Challenge 07 — GitOps with Flux v2 — Coach Solution

[< Previous Solution](./Solution-06.md) | [Home](../../README.md) | [Next Solution >](./Solution-08.md)

## Notes & Guidance

- **Flux v1 commands do not exist in Flux v2.** `fluxctl`, `HelmRelease` v1 CRDs, and the
  `flux-get-started` repository are all obsolete. Redirect any v1 attempts immediately.
- The `microsoft.flux` extension installs Flux v2 controllers in the `flux-system` namespace.
  Teams can verify with `flux check` and `kubectl get pods -n flux-system`.
- Default reconciliation interval is **10 minutes**. For the drift detection demo, force
  immediate sync: `flux reconcile source git cluster-config`
- For the pull request demo, tell teams to also force reconcile after merging to avoid
  waiting 10 minutes.
- The AKS extension approach (`az k8s-configuration flux create`) is preferred over
  `flux bootstrap github` in enterprise environments because it is managed via ARM/Bicep
  and visible in the Azure portal.

### Common Issues

- **GitHub PAT permissions:** Token needs `repo` scope. Fine-grained tokens need
  Contents (read/write) and Metadata (read) on the target repo.
- **Flux not picking up changes:** Check `flux get sources git -A` for errors. Often a
  credentials issue or wrong branch name.
- **HelmRelease not reconciling:** Check `flux get helmreleases -A`. Common cause:
  the `HelmRepository` source is not Ready.
- **`cross-namespace references are not allowed`:** The HelmRelease **must be in the same
  namespace as the GitRepository** (`cluster-config`). Use `spec.targetNamespace: fabtech`
  to deploy the Helm release into the app namespace. A HelmRelease in `fabtech` cannot
  reference a GitRepository in `cluster-config`.
- **Drift not remediated after deleting a resource:** Helm only upgrades when chart
  version or values change. Add `spec.driftDetection.mode: enabled` to the HelmRelease
  so Flux restores resources that are deleted outside of Git.
- **Template changes not applied after git commit:** If only template files changed (not
  `values`) and the chart `version` in `Chart.yaml` is unchanged, Helm considers the
  release "in-sync" and skips the upgrade. Bump `Chart.yaml` version to trigger a re-render.
- **`<ACR_NAME>` placeholder in HelmRelease:** Replace with the actual ACR login server
  (`<acr-name>.azurecr.io`) before committing. Students can also use a Kustomize patch
  to avoid hardcoding the ACR name in the shared repo.

## Solution

### Part 1: Prepare Fleet Repository

```bash
# No new repository needed — use the team's fork of this hackathon repo.
# Clone the fork if not already local:
git clone https://github.com/<your-github-username>/frontier_aks_hackathon.git
cd frontier_aks_hackathon
```

Update the `gitops/clusters/production/fabtech-helmrelease.yaml` file with your ACR name and image tags. The HelmRelease should point to the images pushed in previous challenges.

```bash
# Commit and push the changes to your fork:
git add gitops/clusters/production/fabtech-helmrelease.yaml
git commit -m "Update HelmRelease with ACR image references"
git push origin main
```

### Part 2: Bootstrap Flux v2 via AKS Extension

```bash
RG=rg-frontier-aks
CLUSTER_NAME=aks-frontier
REPO_URL=https://github.com/<your-github-username>/frontier_aks_hackathon

# Pull credentials directly from the active gh CLI session
# Run `gh auth login` first if not already authenticated.
# Ensure the session has 'repo' scope: `gh auth status`
GITHUB_USERNAME=$(gh api user --jq '.login')
GITHUB_PAT=$(gh auth token)

# Create a Kubernetes secret from the environment variables
kubectl create namespace cluster-config
kubectl create secret generic flux-git-credentials \
  --namespace cluster-config \
  --from-literal=username="$GITHUB_USERNAME" \
  --from-literal=password="$GITHUB_PAT"

az k8s-configuration flux create \
  --resource-group $RG \
  --cluster-name $CLUSTER_NAME \
  --cluster-type managedClusters \
  --name cluster-config \
  --namespace cluster-config \
  --scope cluster \
  --url $REPO_URL \
  --branch main \
  --https-user "$GITHUB_USERNAME" \
  --https-key "$GITHUB_PAT" \
  --kustomization name=apps path=./Coach/Solutions/Resources/gitops/clusters/production/fabtech-helmrelease.yaml prune=true interval=1m

# Clear credentials from memory
unset GITHUB_USERNAME GITHUB_PAT

# Verify
flux check
flux get sources git
flux get kustomizations
```

### Part 3: Reconcile and Verify

```bash
# Force reconcile
flux reconcile source git cluster-config -n cluster-config
flux reconcile kustomization cluster-config-apps -n cluster-config

# Verify the HelmRelease is applied and the FabTech pods are running
flux get helmreleases -A
kubectl get pods -n fabtech
```

### Part 4: Drift Detection Demo

```bash
# Delete a deployment
kubectl delete deployment fabtech-api -n fabtech

# Wait or force reconcile
flux reconcile helmrelease fabtech -n cluster-config --with-source
kubectl get deployments -n fabtech
# Should be restored
```
