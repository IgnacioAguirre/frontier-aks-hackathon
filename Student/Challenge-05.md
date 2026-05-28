# Challenge 05 — Observability

[< Previous Challenge](./Challenge-04.md) — **[Home](../README.md)** — [Next Challenge >](./Challenge-06.md)

## Introduction

You cannot operate what you cannot see. A production AKS cluster needs metrics, logs, and
traces. In this challenge you will build a complete observability stack using Azure-native
managed services.

> **Note:** The old `az aks enable-addons --addons monitoring` Container Insights path for
> metrics is being replaced by a Prometheus-first model. Use Azure Managed Prometheus for
> metrics and Container Insights for log collection.

## Description

- Enable **Azure Managed Prometheus** on your cluster by creating an Azure Monitor workspace
  and linking it to the cluster.
  - **Hint:** Look for `az aks update --enable-azure-monitor-metrics` to link a cluster to an Azure Monitor workspace.
- Deploy **Azure Managed Grafana** and link it to the Prometheus workspace.
  - Explore the pre-built Kubernetes dashboards that appear automatically.
- Enable **Container Insights** log collection to a Log Analytics workspace.
- Use **KQL queries** in Log Analytics to query container logs from the `fabtech` namespace.
- Build a **custom Grafana dashboard** with at least two panels showing cluster health metrics
  (e.g., CPU usage by namespace, pod restart count).
- Generate some load on the application and observe the metrics change in Grafana.
- *(Optional)* Explore **OpenTelemetry** instrumentation by connecting an OTel Collector
  to Azure Monitor Application Insights for distributed tracing.

> **Hint:** After enabling Managed Prometheus on the cluster, the `ama-metrics-*` pods
> in `kube-system` are your confirmation that scraping is active.

## Success Criteria

1. Azure Managed Prometheus is scraping cluster metrics — show the built-in
   **Kubernetes / Compute Resources / Cluster** dashboard in Grafana with live data.
2. Container Insights is collecting logs — show a KQL query result returning container
   log entries from the `fabtech` namespace.
3. A custom Grafana dashboard shows at least **CPU usage** and **pod restart count** panels.
4. Explain to your coach the difference between **metrics** (Prometheus/Grafana) and
   **logs** (Container Insights/Log Analytics) and when you would use each.

## Learning Resources

- [Azure Monitor managed service for Prometheus](https://learn.microsoft.com/azure/azure-monitor/essentials/prometheus-overview)
- [Azure Managed Grafana](https://learn.microsoft.com/azure/managed-grafana/overview)
- [Enable Prometheus metrics collection in AKS](https://learn.microsoft.com/azure/azure-monitor/containers/kubernetes-monitoring-enable)
- [Container Insights overview](https://learn.microsoft.com/azure/azure-monitor/containers/container-insights-overview)
- [KQL quick reference](https://learn.microsoft.com/azure/data-explorer/kql-quick-reference)
- [OpenTelemetry on Azure](https://learn.microsoft.com/azure/azure-monitor/app/opentelemetry-enable)
