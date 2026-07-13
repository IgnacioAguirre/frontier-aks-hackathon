# Challenge 03 — App Deployment & Gateway API

[< Previous Challenge](./Challenge-02.md) — **[Home](../README.md)** — [Next Challenge >](./Challenge-04.md)

## Introduction

With a cluster running, it is time to deploy the **FabTechOps** application and expose it
to the internet. You will package the application as a Helm chart and choose between two
modern Gateway API-based traffic routing approaches AKS supports today:
**Gateway API via App Routing** and **Gateway API via Application Gateway for Containers (AGC)**.

## Description

- Enable the **App Routing add-on** on your cluster (with `--enable-app-routing-istio`) if the
  `approuting-istio` `GatewayClass` is not already available.
- Deploy an **in-cluster PostgreSQL database** for the FabTechOps application using both charts
  from [cloudnative-pg/charts](https://github.com/cloudnative-pg/charts):
  - [`cnpg/cloudnative-pg`](https://github.com/cloudnative-pg/charts/blob/main/charts/cloudnative-pg/README.md) — the operator (install into `cnpg-system`)
  - [`cnpg/cluster`](https://github.com/cloudnative-pg/charts/blob/main/charts/cluster/README.md) — a `Cluster` CR (deploy into the `fabtech` namespace)
- Package the FabTechOps **API** and **Web** components as a **Helm chart** and deploy them
  to a dedicated namespace in your cluster.
  - The configuration should support changing the image tag and replica count without editing the templates.
  - **NOTE:** A Helm chart skeleton is provided in [`Student/Resources/src/manifests/chart/`](./Resources/src/manifests/chart/).
- Expose the application using **one of the following approaches** (or both for extra credit):

  **Option A — Gateway API via App Routing add-on**
  - Enable the App Routing add-on on your cluster (with `--enable-app-routing-istio`) if
    `kubectl get gatewayclass` does not already show `approuting-istio` (AKS Automatic may already have it).
  - Verify the `approuting-istio` `GatewayClass` exists before applying the
    `Gateway` resource.
  - Create a `Gateway` resource and an `HTTPRoute` that forwards traffic to the web service.
  - **Hint:** The App Routing add-on supports `gateway.networking.k8s.io/v1` natively — no manual CRD install needed.

  **Option B — Gateway API via Application Gateway for Containers (AGC)**
  - Deploy the ALB Controller on your cluster using Workload Identity.
  - Create an `ApplicationLoadBalancer` custom resource and an `HTTPRoute` targeting the web service.
  - **Hint:** AGC uses the same `HTTPRoute` CRD (`gateway.networking.k8s.io/v1`) from the Gateway API spec.

- Verify the application is accessible from a browser.
- Demonstrate a **Helm upgrade** (e.g., change the replica count) and a **Helm rollback**.
- Add a **`PodDisruptionBudget`** for each workload to protect availability during node drains.
- Configure **`topologySpreadConstraints`** on each Deployment so pods are spread across availability zones.

## Success Criteria

1. An in-cluster **PostgreSQL** pod is running and ready in the `fabtech` namespace. Note the connection string — it will be used in Challenge 04.
2. Both `fabtech-api` and `fabtech-web` deployments have at least 2 pods running.
3. The application is accessible from a browser via the Gateway frontend.
4. For Option A: A `Gateway` and `HTTPRoute` resource are present and the route status shows `Accepted`.
5. For Option B: An `ApplicationLoadBalancer` resource exists and the AGC frontend resolves correctly.
6. Show a successful `helm upgrade` and `helm rollback`.
7. A `PodDisruptionBudget` exists for `fabtech-api` and `fabtech-web` with `minAvailable: 1`.
8. Each Deployment uses `topologySpreadConstraints` to distribute pods across availability zones.
9. The database connection string is available and will be stored in Key Vault in Challenge 04.

## Learning Resources

- [App Routing add-on for AKS](https://learn.microsoft.com/azure/aks/app-routing)
- [Gateway API with App Routing add-on](https://learn.microsoft.com/azure/aks/app-routing-gateway-api)
- [Application Gateway for Containers](https://learn.microsoft.com/azure/application-gateway/for-containers/overview)
- [AGC — ALB Controller install](https://learn.microsoft.com/azure/application-gateway/for-containers/quickstart-deploy-application-gateway-for-containers-alb-controller)
- [Kubernetes Gateway API](https://gateway-api.sigs.k8s.io/)
- [Helm quickstart guide](https://helm.sh/docs/intro/quickstart/)
- [CloudNativePG Operator chart (`cnpg/cloudnative-pg`)](https://github.com/cloudnative-pg/charts/blob/main/charts/cloudnative-pg/README.md)
- [CloudNativePG Cluster chart (`cnpg/cluster`)](https://github.com/cloudnative-pg/charts/blob/main/charts/cluster/README.md)
