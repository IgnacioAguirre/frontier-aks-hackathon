# Challenge 00 — Prerequisites: Ready, Set, GO!

**[Home](../README.md)** — [Next Challenge >](./Challenge-01.md)

## Introduction

Before you can hack, you need the right tools. This challenge ensures your workstation (or
cloud shell) is ready with a modern cloud-native toolset for working with Azure and AKS.

## Description

Set up a working environment with all the tools required for this hackathon:

- **Azure CLI** (version 2.65 or later)
- **kubectl** — the Kubernetes CLI
- **kubelogin** — needed for Entra ID authentication with AKS
- **Helm** (version 3.14 or later) — the Kubernetes package manager
- **Flux CLI v2** — for GitOps challenges
- **Visual Studio Code** (recommended)
- **Docker Desktop** (optional — only needed for local container builds in Challenge 01)

You may complete all challenges using a local workstation (**WSL2** on Windows, macOS, or
Linux), **GitHub Codespaces**, or **Azure Cloud Shell**.

> **Hint:** `kubectl` and `kubelogin` can both be installed with a single Azure CLI command.
> Flux CLI has an official install script at [fluxcd.io/flux/installation](https://fluxcd.io/flux/installation/).

Once tools are installed, log in to your Azure subscription and verify you have the right
access level. You will also need to ensure the required Azure resource providers are registered
in your subscription.

Your coach will provide a **`Resources.zip`** file containing source code and manifests used
in later challenges. Unpack it and keep it handy.

## Success Criteria

1. Running `az --version` shows Azure CLI **>= 2.65.0**
2. Running `kubectl version --client` returns a client version
3. Running `helm version` shows Helm **>= 3.14**
4. Running `flux --version` shows Flux **v2.x**
5. `az account show` returns your target subscription
6. All required resource providers are in `Registered` state

## Learning Resources

- [Install Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
- [Install kubectl and kubelogin](https://learn.microsoft.com/azure/aks/learn/quick-kubernetes-deploy-cli)
- [Install Helm](https://helm.sh/docs/intro/install/)
- [Install Flux CLI](https://fluxcd.io/flux/installation/)
- [Azure Cloud Shell overview](https://learn.microsoft.com/azure/cloud-shell/overview)
- [Azure resource providers](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-providers-and-types)
