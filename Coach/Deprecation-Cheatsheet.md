# Deprecation Cheat Sheet — AKS WhatTheHack Hackathons

> **For coaches and authors.** Use this reference when updating the source hackathons
> (001-IntroToKubernetes, 023-AdvancedKubernetes, 039-AKSEnterpriseGrade) or when a
> participant asks "why doesn't this command/feature work?"

---

## Deprecated / Retired Items and Their Replacements

### 1. Flux v1

| | Detail |
|-|--------|
| **Status** | ❌ End-of-life (Flux community: Nov 2022; AKS managed support: early 2024) |
| **Appears in** | 023-AdvancedKubernetes Challenge-05 |
| **Symptoms** | `fluxctl` not found; `flux-get-started` repo has no active CI; `HelmRelease` CRDs missing |
| **Replacement** | **Flux v2** via the AKS `microsoft.flux` extension |
| **Migrate** | `az k8s-extension create --extension-type microsoft.flux` + `az k8s-configuration flux create` |
| **Docs** | [GitOps with Flux v2 on AKS](https://learn.microsoft.com/azure/aks/gitops-flux-v2) |
| **Key CLI change** | `fluxctl sync` → `flux reconcile source git <name>` |

---

### 2. AKS Engine (`aks-engine`)

| | Detail |
|-|--------|
| **Status** | ❌ Retired February 29, 2024 |
| **Appears in** | 039-AKSEnterpriseGrade Challenge-08 (non-AKS cluster for Arc) |
| **Symptoms** | GitHub repo archived; binary downloads removed |
| **Replacement** | Use `kind`, `k3s`, or an AKS cluster for Arc testing |
| **Docs** | [Migrate from AKS Engine](https://learn.microsoft.com/azure/aks/engine-migrate) |

---

### 3. `extensions/v1beta1` Ingress API

| | Detail |
|-|--------|
| **Status** | ❌ Removed in Kubernetes 1.22 |
| **Appears in** | 023-AdvancedKubernetes Challenge-05 GitOps (inline YAML snippet) |
| **Symptoms** | `no matches for kind "Ingress" in version "extensions/v1beta1"` |
| **Replacement** | `apiVersion: networking.k8s.io/v1` with `spec.rules[].http.paths[].pathType` required |

```yaml
# OLD — broken on K8s >= 1.22
apiVersion: extensions/v1beta1
kind: Ingress

# NEW — correct
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-ingress
spec:
  ingressClassName: webapprouting.kubernetes.azure.com
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: my-service
            port:
              number: 80
```

---

### 4. Azure Monitor for Containers (Container Insights — old path)

| | Detail |
|-|--------|
| **Status** | ⚠️ Deprecating — migrating to Prometheus-first model |
| **Appears in** | 001 Challenge-11, 039 Challenge-03 |
| **Symptoms** | `az aks enable-addons --addons monitoring` still works but the experience is being replaced |
| **Replacement** | **Azure Managed Prometheus** + **Azure Managed Grafana** for metrics; Container Insights retained for logs |
| **Docs** | [Azure Monitor managed service for Prometheus](https://learn.microsoft.com/azure/azure-monitor/essentials/prometheus-overview) |
| **Docs** | [Azure Managed Grafana](https://learn.microsoft.com/azure/managed-grafana/overview) |

---

### 5. HTTP Application Routing Add-on (Preview)

| | Detail |
|-|--------|
| **Status** | ❌ Retired March 3, 2025 |
| **Appears in** | 039 references; 001 Challenge-10 NGINX setup |
| **Symptoms** | `az aks enable-addons --addons http_application_routing` fails on new clusters |
| **Replacement** | **App Routing add-on (GA)**: `az aks addon enable --addon web_application_routing` |
| **Docs** | [App Routing add-on](https://learn.microsoft.com/azure/aks/app-routing) |

---

### 6. Open Service Mesh (OSM) AKS Add-on

| | Detail |
|-|--------|
| **Status** | ❌ Deprecated 2024 |
| **Appears in** | 039 Challenge-07 |
| **Symptoms** | Extension install fails; no active development |
| **Replacement** | **AKS managed Istio add-on**: `az aks mesh enable` |
| **Docs** | [AKS managed Istio](https://learn.microsoft.com/azure/aks/istio-about) |

---

### 7. AAD Pod Identity (Pod Identity)

| | Detail |
|-|--------|
| **Status** | ❌ Deprecated (maintenance-only, no new features) |
| **Appears in** | Various 039 hints |
| **Symptoms** | NMI DaemonSet may still run but is not recommended |
| **Replacement** | **Workload Identity** (Entra ID Federated Credentials) |
| **Docs** | [Workload Identity on AKS](https://learn.microsoft.com/azure/aks/workload-identity-overview) |
| **Migrate** | [Migrate from Pod Identity to Workload Identity](https://learn.microsoft.com/azure/aks/workload-identity-migrate-from-pod-identity) |

---

### 8. `docs.microsoft.com` URLs

| | Detail |
|-|--------|
| **Status** | ⚠️ Redirects work but mark content as stale |
| **Appears in** | All three hackathons — every learning resources section |
| **Replacement** | Replace `docs.microsoft.com` with `learn.microsoft.com` in all links |

---

### 9. VM Availability Sets Node Pools

| | Detail |
|-|--------|
| **Status** | ❌ Retiring September 30, 2025 |
| **Appears in** | Old cluster creation examples |
| **Replacement** | VMSS-based node pools (default since AKS 1.18+) |
| **Docs** | [Migrate from Availability Sets](https://learn.microsoft.com/azure/aks/availability-sets-on-aks) |

---

### 10. `istioctl manifest apply`

| | Detail |
|-|--------|
| **Status** | ❌ Removed in Istio >= 1.7 |
| **Appears in** | 023 Challenge-06 hint |
| **Replacement** | `istioctl install` (or better: `az aks mesh enable` for managed Istio) |

---

### 11. Kubernetes Dashboard (AKS default add-on)

| | Detail |
|-|--------|
| **Status** | ❌ Removed as default AKS add-on (security concerns) |
| **Appears in** | 001 Challenge-11 |
| **Replacement** | **Headlamp** (CNCF open-source) or Azure Portal Workloads blade |
| **Docs** | [Headlamp](https://headlamp.dev/) |

---

### 12. Bridge to Kubernetes (VS Code Extension)

| | Detail |
|-|--------|
| **Status** | ❌ Retired April 30, 2025 |
| **Appears in** | Optional dev workflow hints |
| **Replacement** | Telepresence, Skaffold, DevSpace, or remote debugging via `kubectl port-forward` |

---

### 13. Azure Linux 2.0 Node Images

| | Detail |
|-|--------|
| **Status** | ❌ Security updates stop November 30, 2025; can't scale node pools after March 31, 2026 |
| **Appears in** | Cluster creation examples specifying `--os-sku AzureLinux` (v2) |
| **Replacement** | `--os-sku AzureLinux` maps to v3 on new clusters — verify with `az aks nodepool show` |

---

### 14. `fluxctl sync`

| | Detail |
|-|--------|
| **Status** | ❌ Flux v1 tool — does not exist in Flux v2 |
| **Appears in** | 023 Challenge-05 |
| **Replacement** | `flux reconcile source git <name>` |

---

### 15. SMI (Service Mesh Interface) Spec References

| | Detail |
|-|--------|
| **Status** | ❌ CNCF archived in 2023 |
| **Appears in** | 023 Challenge-06 introduction text |
| **Replacement** | [Kubernetes Gateway API](https://gateway-api.sigs.k8s.io/) for cross-mesh abstraction |

---

### 16. Kibana / Fluentd / ELK Stack

| | Detail |
|-|--------|
| **Status** | ⚠️ Still functional but operationally heavy for an AKS hack |
| **Appears in** | 001 Challenge-11 |
| **Replacement** | Azure Monitor Logs + Log Analytics; or OpenTelemetry Collector → Azure Monitor |
| **Docs** | [Container Insights log collection](https://learn.microsoft.com/azure/azure-monitor/containers/container-insights-log-query) |

---

### 17. WASI Node Pools (Preview)

| | Detail |
|-|--------|
| **Status** | ❌ Retired May 5, 2025 |
| **Replacement** | SpinKube for WASM workloads |
| **Docs** | [SpinKube](https://www.spinkube.dev/) |

---

### 18. AGIC (Application Gateway Ingress Controller) as Default Recommendation

| | Detail |
|-|--------|
| **Status** | ⚠️ Still supported but complex; App Routing add-on is the simpler default |
| **Appears in** | 039 Challenge-02 |
| **Recommendation** | Use **App Routing add-on** (NGINX GA) for most scenarios; use **Azure Application Gateway for Containers** or **Gateway API** for L7 advanced routing |
| **Docs** | [App Routing add-on](https://learn.microsoft.com/azure/aks/app-routing) |

---

### 19. Empty Challenge Stubs in 023-AdvancedKubernetes

The following files exist but are **empty (0 bytes)**:

- `Student/08-gpu.md`
- `Student/09-observability.md`
- `Student/10-github-actions.md`
- `Student/11-configs-secrets.md`
- `Student/12-operators.md`

These topics are covered as full challenges in the **Frontier AKS Hackathon**.

---

### 20. Azure CLI Minimum Version Requirement

| | Detail |
|-|--------|
| **Old requirement** | `>= 2.7.x` (stated in 001 Challenge-00) |
| **Current requirement** | `>= 2.65.x` (as of mid-2025) |
| **Impact** | Old versions lack `az aks mesh`, `az k8s-configuration flux`, `az aks nodepool`, etc. |

---

## Quick Reference: Modern Equivalents

| Old | Modern Replacement |
|-----|--------------------|
| Flux v1 / `fluxctl` | Flux v2 / `flux` CLI + `az k8s-configuration flux` |
| AAD Pod Identity | Workload Identity (Entra) |
| OSM add-on | AKS managed Istio (`az aks mesh`) |
| Container Insights metrics | Azure Managed Prometheus + Grafana |
| HTTP App Routing add-on | App Routing add-on (GA) |
| AGIC (primary) | App Routing add-on or Gateway API |
| AKS Engine | AKS / `kind` / `k3s` |
| `extensions/v1beta1` Ingress | `networking.k8s.io/v1` Ingress |
| Kubernetes Dashboard | Headlamp / Azure Portal |
| Bridge to Kubernetes | Telepresence / port-forward |
| Azure Linux 2.0 | AzureLinux 3.0 |
| `docs.microsoft.com/...` | `learn.microsoft.com/...` |
| `istioctl manifest apply` | `istioctl install` or `az aks mesh enable` |
| `az aks enable-addons --addons monitoring` (old) | `az aks update --enable-azure-monitor-metrics` |
| SMI spec | Kubernetes Gateway API |
| ELK/Kibana/Fluentd | Azure Monitor Logs + OTEL Collector |
| VM Availability Sets | VMSS node pools |
