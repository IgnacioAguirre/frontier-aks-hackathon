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
- **Flux not picking up changes:** Check `flux get sources git` for errors. Often a
  credentials issue or wrong branch name.
- **HelmRelease not reconciling:** Check `flux get helmreleases -A`. Common cause:
  the `HelmRepository` source is not Ready.

## Solution

### Part 1: Create Fleet Repository

```bash
# Using GitHub CLI
gh repo create frontier-aks-fleet --private --add-readme
git clone https://github.com/<your-org>/frontier-aks-fleet.git
cd frontier-aks-fleet
mkdir -p clusters/production apps/fabtech
```

### Part 2: Bootstrap Flux v2 via AKS Extension

```bash
RG=rg-frontier-aks
CLUSTER_NAME=aks-frontier
REPO_URL=https://github.com/<your-org>/frontier-aks-fleet

# Create a GitHub PAT and store as a Kubernetes secret
kubectl create namespace cluster-config
kubectl create secret generic flux-git-credentials \
  --namespace cluster-config \
  --from-literal=username=<GITHUB_USERNAME> \
  --from-literal=password=<GITHUB_PAT>

az k8s-configuration flux create \
  --resource-group $RG \
  --cluster-name $CLUSTER_NAME \
  --cluster-type managedClusters \
  --name cluster-config \
  --namespace cluster-config \
  --scope cluster \
  --url $REPO_URL \
  --branch main \
  --https-user <GITHUB_USERNAME> \
  --https-key <GITHUB_PAT> \
  --kustomization name=apps path=./clusters/production prune=true interval=1m

# Verify
flux check
flux get sources git
flux get kustomizations
```

### Part 3: Commit App Config to Git

```yaml
# clusters/production/fabtech-helmrelease.yaml
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: fabtech
  namespace: fabtech
spec:
  interval: 5m
  chart:
    spec:
      chart: ./charts/fabtech
      sourceRef:
        kind: GitRepository
        name: cluster-config
        namespace: cluster-config
  values:
    api:
      image:
        tag: v1
    web:
      image:
        tag: v1
```

```bash
cd frontier-aks-fleet
git add clusters/production/
git commit -m "feat: add FabTechOps HelmRelease"
git push

# Force immediate reconcile
flux reconcile source git cluster-config
flux reconcile kustomization apps
```

### Part 4: Drift Detection Demo

```bash
# Delete a deployment
kubectl delete deployment fabtech-api -n fabtech

# Wait or force reconcile
flux reconcile kustomization apps --with-source
kubectl get deployments -n fabtech
# Should be restored
```

### Part 5: Progressive Delivery via Pull Request

```bash
# Create feature branch
cd frontier-aks-fleet
git checkout -b update-api-v2

# Edit image tag from v1 to v2 in clusters/production/fabtech-helmrelease.yaml

git add .
git commit -m "chore: bump api image to v2"
git push -u origin update-api-v2

# Create and merge PR via GitHub CLI
gh pr create --title "Bump API to v2" --body "" --base main
gh pr merge --squash

# Force reconcile and watch
flux reconcile source git cluster-config
flux get helmreleases -n fabtech -w
kubectl rollout status deployment/fabtech-api -n fabtech
```

### Part 6 (Optional): Multi-Environment

```yaml
# clusters/staging/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../production
patches:
  - target:
      kind: HelmRelease
      name: fabtech
    patch: |
      - op: replace
        path: /spec/values/api/image/tag
        value: v2-rc1
```

Flux `Kustomization` with dependency:

```yaml
# clusters/production-flux-kustomization.yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: production
spec:
  dependsOn:
    - name: staging
  interval: 10m
  path: ./clusters/production
  prune: true
  sourceRef:
    kind: GitRepository
    name: cluster-config
```
