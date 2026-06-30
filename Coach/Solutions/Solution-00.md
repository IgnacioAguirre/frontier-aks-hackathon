# Challenge 00 — Prerequisites — Coach Solution

[Home](../../README.md) | [Next Solution >](./Solution-01.md)

## Notes & Guidance

- **Duration:** 20–30 minutes. Teams should not spend more than 45 minutes here.
- Ensure all tools are **exactly** at the minimum versions listed. Tool version mismatches
  cause hard-to-debug failures in later challenges.
- Point teams to **Azure Cloud Shell** or **GitHub Codespaces** as an escape hatch if local
  tool installs are causing problems.
- If teams use Cloud Shell, `az`, `kubectl`, and `helm` are pre-installed; they only need
  to install `flux` and `kubelogin`.

### Common Issues

- **`az upgrade` fails silently:** Run `az --version` to confirm the version after upgrading.
- **WSL1 vs WSL2:** On Windows, confirm WSL2 with `wsl --status`. WSL1 causes Docker
  networking issues.
- **`kubelogin` missing:** After `az aks get-credentials`, `kubectl` fails with an Entra ID auth
  error until `kubelogin` is installed. Fix: `az aks install-cli`.
- **Resource provider not registered:** `Microsoft.Dashboard` (Grafana), `Microsoft.Monitor`,
  and `Microsoft.KubernetesConfiguration` may need to be registered.
  Check: `az provider show --namespace Microsoft.Dashboard --query registrationState`
- **GPU quota (AI track only):** Must be requested 24–48 hours in advance.
  Minimum: `Standard_NC4as_T4_v3` (4 vCPUs, T4 GPU).

## Solution

### Tool Installation (Linux / WSL2 / macOS)

```bash
# Azure CLI (latest)
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
az --version  # Confirm >= 2.65.0

# kubectl
az aks install-cli  # installs both kubectl and kubelogin

# Helm 3
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
helm version

# Flux v2 CLI
curl -s https://fluxcd.io/install.sh | sudo bash
flux --version  # Confirm >= 2.0.0

# Verify all required providers are registered
for ns in Microsoft.ContainerService Microsoft.Monitor Microsoft.Dashboard \
           Microsoft.KubernetesConfiguration Microsoft.ContainerRegistry; do
  az provider register --namespace $ns
  echo "Registered: $ns"
done
```

### Azure Login and Subscription Verification

```bash
az login
az account set --subscription "<SUBSCRIPTION_ID>"
az account show --query "{Name:name, Id:id, State:state}"

# Verify Owner role
az role assignment list --assignee $(az account show --query user.name -o tsv) \
  --role Owner --query "[].{scope:scope}" -o table
```

### GPU Quota Check (AI Track)

```bash
az vm list-usage --location swedencentral \
  --query "[?contains(name.value,'NC')]" \
  -o table
# If quota = 0, request an increase for the exact GPU family shown in the Portal/CLI.
```

> **Quota naming note:** Portal display names and programmatic quota family names do not
> always match exactly. For example, the Portal may show **Standard NCASv3_T4 Family**
> while CLI/API workflows use `StandardNCAsv3_T4Family`. Other GPU SKUs may use a different
> family, such as `Standard_NC_A100_v4_Family`. Verify the exact family in the Azure Portal
> before filing quota tickets.
