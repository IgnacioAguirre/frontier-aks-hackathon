# Challenge 00 — Prerequisites: Ready, Set, GO!

**[Home](../README.md)** — [Next Challenge >](./Challenge-01.md)

## Introduction

Before you can hack, you need the right tools. This challenge ensures your workstation (or
cloud shell) is ready with a modern cloud-native toolset.

> **Tip:** You can complete most challenges using **Azure Cloud Shell**, which already has
> `az`, `kubectl`, and `helm` installed. However, setting up a local environment gives you
> the best experience and mirrors real-world workflows.

## Description

### Option A — Local Workstation Setup

Install the following tools:

| Tool | Minimum Version | Install Guide |
|------|----------------|---------------|
| Azure CLI | **>= 2.65.0** | [learn.microsoft.com](https://learn.microsoft.com/cli/azure/install-azure-cli) |
| kubectl | Latest stable | `az aks install-cli` |
| kubelogin | Latest | `az aks install-cli` or [GitHub](https://github.com/Azure/kubelogin) |
| Helm | **>= 3.14** | [helm.sh](https://helm.sh/docs/intro/install/) |
| Flux CLI v2 | Latest | [fluxcd.io](https://fluxcd.io/flux/installation/) |
| Docker Desktop (optional) | Latest | [docker.com](https://www.docker.com/products/docker-desktop) |
| Visual Studio Code | Latest | [code.visualstudio.com](https://code.visualstudio.com/) |
| k9s (optional but recommended) | Latest | [k9scli.io](https://k9scli.io/topics/install/) |

**Windows users:** Install all tools inside **WSL2** (Ubuntu 22.04+) or use GitHub Codespaces.
Do NOT install Azure CLI for Windows and then run it inside WSL — install the Linux version directly in WSL.

**macOS users:** Use Homebrew:

```bash
brew install azure-cli helm fluxcd/tap/flux k9s
az aks install-cli
```

### Option B — GitHub Codespaces / Dev Container

If you prefer not to install anything locally, open this repository in GitHub Codespaces
or a VS Code Dev Container — all required tools are pre-installed.

### Option C — Azure Cloud Shell

Navigate to [shell.azure.com](https://shell.azure.com) and select **Bash**. 

```bash
# Azure Cloud Shell already has az, kubectl, helm.
# Install Flux CLI:
curl -s https://fluxcd.io/install.sh | sudo bash
# Install kubelogin:
az aks install-cli
```

> **Note:** Cloud Shell sessions are ephemeral. You will need to re-install Flux CLI each session.

### Verify Your Tools

Run the following commands to confirm all tools are installed:

```bash
az --version
kubectl version --client
kubelogin --version
helm version
flux --version
```

### Student Resources

Your coach will provide a `Resources.zip` file with manifests and source code used in
later challenges. Download and unpack it in your working directory:

```bash
unzip Resources.zip -d ~/hackathon
cd ~/hackathon
```

### Azure Login

Log in to Azure and confirm your subscription:

```bash
az login
az account show
az account set --subscription "<your-subscription-id>"
```

### Register Required Resource Providers

```bash
az provider register --namespace Microsoft.ContainerService
az provider register --namespace Microsoft.ContainerRegistry
az provider register --namespace Microsoft.KeyVault
az provider register --namespace Microsoft.Monitor
az provider register --namespace Microsoft.Dashboard
az provider register --namespace Microsoft.AlertsManagement
```

## Success Criteria

1. Running `az --version` shows Azure CLI **>= 2.65.0**
2. Running `kubectl version --client` shows a client version
3. Running `helm version` shows Helm **>= 3.14**
4. Running `flux --version` shows Flux **v2.x**
5. You are logged into Azure with `az account show` returning your subscription
6. All resource providers above are registered (state: `Registered`)

## Learning Resources

- [Install Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
- [Install kubectl and kubelogin](https://learn.microsoft.com/azure/aks/learn/quick-kubernetes-deploy-cli#install-kubectl)
- [Install Helm](https://helm.sh/docs/intro/install/)
- [Install Flux CLI](https://fluxcd.io/flux/installation/)
- [Azure Cloud Shell overview](https://learn.microsoft.com/azure/cloud-shell/overview)
