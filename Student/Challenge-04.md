# Challenge 04 — Workload Identity & Secrets Management

[< Previous Challenge](./Challenge-03.md) — **[Home](../README.md)** — [Next Challenge >](./Challenge-05.md)

## Introduction

Hardcoded passwords and connection strings in Kubernetes manifests are a serious security
anti-pattern. **Never commit secrets to Git.** In this challenge you will eliminate all
hardcoded credentials from your deployments using Azure-native identity and secret management.

You will use **Workload Identity** (Entra ID Federated Credentials) — the current standard
for pod-level Azure access. It requires no DaemonSets, no CRDs for identity injection, and
no static credentials in pods.

## Description

- Create an **Azure Key Vault** with RBAC authorization enabled and store the database
  connection string as a secret.
- Create a **User-Assigned Managed Identity** in Azure and grant it `Key Vault Secrets User`
  access to the Key Vault.
- Configure **Workload Identity federation**: link the managed identity to a Kubernetes
  `ServiceAccount` using the cluster's OIDC issuer URL.
  - **Hint:** This requires creating a *federated credential* on the managed identity, specifying
    the OIDC issuer URL from your AKS cluster and the Kubernetes service account subject.
- Install the **Secrets Store CSI driver** and the Azure Key Vault provider, then configure
  a `SecretProviderClass` resource that references your Key Vault and the secret.
- Update your API deployment to:
  - Use the annotated `ServiceAccount` (with `azure.workload.identity/client-id` annotation)
  - Mount the Key Vault secret as a volume via the CSI driver
  - Read the connection string from the mounted path — **no environment variables with hardcoded values**

> **NOTE:** Sample `SecretProviderClass` YAML is provided in your `Resources.zip`.

## Success Criteria

1. Azure Key Vault contains the `db-connection-string` secret.
2. A Managed Identity with a federated credential exists, bound to the Kubernetes `ServiceAccount`.
3. The API pod reads the secret from the mounted CSI volume — no hardcoded secrets in any manifest.
4. Show that the Kubernetes `ServiceAccount` has the required annotation.
5. Explain to your coach why secrets should never be stored in Kubernetes Secret objects or environment variables for sensitive values, and what **Workload Identity** + Key Vault offers instead.

## Advanced Challenges (Optional)

- Sync the Key Vault secret as a Kubernetes Secret object using the `secretObjects` field in `SecretProviderClass`.
- Enable SSL on the ingress controller and supply the TLS certificate from Key Vault.

## Learning Resources

- [Workload Identity on AKS](https://learn.microsoft.com/azure/aks/workload-identity-overview)
- [Use the Secrets Store CSI driver with AKS](https://learn.microsoft.com/azure/aks/csi-secrets-store-driver)
- [Azure Key Vault RBAC guide](https://learn.microsoft.com/azure/key-vault/general/rbac-guide)
- [Configure federated identity credentials](https://learn.microsoft.com/azure/active-directory/workload-identities/workload-identity-federation-create-trust)
- [Secrets Store CSI driver overview](https://learn.microsoft.com/azure/aks/csi-secrets-store-overview)
