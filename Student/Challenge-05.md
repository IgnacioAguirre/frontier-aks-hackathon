# Challenge 05 — Observability

[< Previous Challenge](./Challenge-04.md) — **[Home](../README.md)** — [Next Challenge >](./Challenge-06.md)

## Introduction

You cannot operate what you cannot see. In this challenge you will build a complete
observability stack:

- **Azure Managed Prometheus** — metrics collection (replaces the deprecated Container Insights metrics path)
- **Azure Managed Grafana** — visualization dashboards
- **Container Insights** — log collection and query via Log Analytics
- **OpenTelemetry** — distributed tracing (optional advanced)

> **Deprecated:** The old `az aks enable-addons --addons monitoring` Container Insights path
> is being replaced by the Prometheus-first model. Use `az aks update --enable-azure-monitor-metrics`.

## Description

### Part 1: Enable Azure Managed Prometheus

Create an Azure Monitor workspace and link it to the cluster:

```bash
RG=rg-frontier-aks
CLUSTER_NAME=aks-frontier
MONITOR_WS=amw-frontier

# Create Azure Monitor workspace (Managed Prometheus)
az monitor account create \
  --name $MONITOR_WS \
  --resource-group $RG \
  --location eastus

# Link cluster to the workspace
az aks update \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --enable-azure-monitor-metrics \
  --azure-monitor-workspace-resource-id \
  $(az monitor account show --name $MONITOR_WS --resource-group $RG --query id -o tsv)
```

Verify the Prometheus components are running:

```bash
kubectl get pods -n kube-system | grep ama-metrics
```

### Part 2: Deploy Azure Managed Grafana

```bash
GRAFANA_NAME=grafana-frontier

az grafana create \
  --name $GRAFANA_NAME \
  --resource-group $RG \
  --location eastus

# Link Grafana to the Prometheus workspace
az aks update \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --enable-azure-monitor-metrics \
  --grafana-resource-id \
  $(az grafana show --name $GRAFANA_NAME --resource-group $RG --query id -o tsv)
```

Get the Grafana endpoint:

```bash
az grafana show --name $GRAFANA_NAME --resource-group $RG --query properties.endpoint -o tsv
```

Open the Grafana endpoint in your browser. Navigate to **Dashboards** and explore the
pre-built **Kubernetes / Compute Resources** dashboards.

### Part 3: Enable Container Insights (Log Collection)

```bash
LOG_WS_NAME=law-frontier

# Create a Log Analytics workspace
az monitor log-analytics workspace create \
  --resource-group $RG \
  --workspace-name $LOG_WS_NAME

# Enable Container Insights on the cluster
az aks enable-addons \
  --resource-group $RG \
  --name $CLUSTER_NAME \
  --addons monitoring \
  --workspace-resource-id \
  $(az monitor log-analytics workspace show \
    --resource-group $RG \
    --workspace-name $LOG_WS_NAME \
    --query id -o tsv)
```

### Part 4: Query Logs

In the Azure Portal, navigate to your Log Analytics workspace → **Logs**.

Run a sample KQL query:

```kusto
// Show all container logs from the last 10 minutes
ContainerLogV2
| where TimeGenerated > ago(10m)
| where Namespace == "fabtech"
| project TimeGenerated, PodName, ContainerName, LogMessage
| order by TimeGenerated desc
| limit 50
```

```kusto
// Find error-level log entries
ContainerLogV2
| where TimeGenerated > ago(1h)
| where LogLevel == "Error"
| summarize count() by ContainerName, bin(TimeGenerated, 5m)
```

### Part 5: Build a Custom Grafana Dashboard

In Azure Managed Grafana, create a new dashboard with the following panels:

1. **CPU Usage by Namespace** — `sum(rate(container_cpu_usage_seconds_total[5m])) by (namespace)`
2. **Memory Usage by Pod** — `sum(container_memory_working_set_bytes) by (pod, namespace)`
3. **HTTP Request Rate** — query the ingress controller metrics
4. **Pod Restart Count** — `sum(kube_pod_container_status_restarts_total) by (namespace, pod)`

### Part 6 (Optional): OpenTelemetry Distributed Tracing

Install the OpenTelemetry Collector via Helm:

```bash
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm install otel-collector open-telemetry/opentelemetry-collector \
  --namespace monitoring --create-namespace \
  --values otel-values.yaml
```

Configure the collector to export traces to **Azure Monitor Application Insights**:

```bash
# Create Application Insights resource
az monitor app-insights component create \
  --app fabtech-insights \
  --resource-group $RG \
  --location eastus \
  --workspace $(az monitor log-analytics workspace show \
    --resource-group $RG --workspace-name $LOG_WS_NAME --query id -o tsv)
```

## Success Criteria

1. Azure Managed Prometheus is scraping cluster metrics — show live data in the Grafana
   **Kubernetes / Compute Resources / Cluster** dashboard.
2. Container Insights is collecting logs — run the KQL query above and show results.
3. Show a custom Grafana dashboard with at least **CPU usage** and **pod restart count** panels.
4. Explain to your coach the difference between **metrics** (Prometheus/Grafana) and
   **logs** (Container Insights/Log Analytics).

## Learning Resources

- [Azure Monitor managed service for Prometheus](https://learn.microsoft.com/azure/azure-monitor/essentials/prometheus-overview)
- [Azure Managed Grafana](https://learn.microsoft.com/azure/managed-grafana/overview)
- [Container Insights overview](https://learn.microsoft.com/azure/azure-monitor/containers/container-insights-overview)
- [Enable Prometheus metrics in AKS](https://learn.microsoft.com/azure/azure-monitor/containers/kubernetes-monitoring-enable)
- [KQL quick reference](https://learn.microsoft.com/azure/data-explorer/kql-quick-reference)
- [OpenTelemetry on AKS](https://learn.microsoft.com/azure/azure-monitor/app/opentelemetry-enable)
