# Challenge 03 — App Deployment, Ingress & Gateway API

[< Previous Challenge](./Challenge-02.md) — **[Home](../README.md)** — [Next Challenge >](./Challenge-04.md)

## Introduction

With a cluster running, it is time to deploy the **FabTechOps** application and expose it
to the internet. You will package the application as a Helm chart and explore three traffic
routing approaches AKS supports today: **NGINX via App Routing**, **Kubernetes Gateway API**,
and **Application Gateway for Containers (AGC)**.

## Description

- Enable the **App Routing add-on** on your cluster to get a managed NGINX ingress controller.
- Deploy a **database** for the FabTechOps application. You may use Azure Database for
  PostgreSQL Flexible Server (recommended) or an in-cluster PostgreSQL deployment for development.
- Package the FabTechOps **API** and **Web** components as a **Helm chart** and deploy them
  to a dedicated namespace in your cluster.
  - The configuration should support changing the image tag and replica count without editing the templates.
  - **NOTE:** Sample YAML templates are provided in the `Resources.zip` from your coach.
- Expose the application using **one of the following approaches** (or all three for extra credit):

  **Option A — NGINX Ingress (App Routing add-on)**
  - Create an `Ingress` resource using `ingressClassName: webapprouting.kubernetes.azure.com`.

  **Option B — Kubernetes Gateway API (App Routing add-on)**
  - Enable Gateway API support on the App Routing add-on.
  - Create a `Gateway` resource and an `HTTPRoute` that forwards traffic to the web service.
  - **Hint:** The App Routing add-on supports `gateway.networking.k8s.io/v1` natively.

  **Option C — Application Gateway for Containers (AGC)**
  - Deploy the ALB Controller on your cluster using Workload Identity.
  - Create an `ApplicationLoadBalancer` custom resource and an `HTTPRoute` targeting the web service.
  - **Hint:** AGC uses the same `HTTPRoute` CRD from the Gateway API spec.

- Verify the application is accessible from a browser.
- Demonstrate a **Helm upgrade** (e.g., change the replica count) and a **Helm rollback**.

## Success Criteria

1. Both `fabtech-api` and `fabtech-web` deployments have at least 2 pods running.
2. The application is accessible from a browser via the ingress address or AGC frontend.
3. For Option A: Ingress resource uses `ingressClassName: webapprouting.kubernetes.azure.com`.
4. For Option B: A `Gateway` and `HTTPRoute` resource are present and the route status shows `Accepted`.
5. For Option C: An `ApplicationLoadBalancer` resource exists and the AGC frontend resolves correctly.
6. Show a successful `helm upgrade` and `helm rollback`.

## Learning Resources

- [App Routing add-on for AKS](https://learn.microsoft.com/azure/aks/app-routing)
- [Gateway API with App Routing add-on](https://learn.microsoft.com/azure/aks/app-routing-gateway-api)
- [Application Gateway for Containers](https://learn.microsoft.com/azure/application-gateway/for-containers/overview)
- [AGC — ALB Controller install](https://learn.microsoft.com/azure/application-gateway/for-containers/quickstart-deploy-application-gateway-for-containers-alb-controller)
- [Kubernetes Gateway API](https://gateway-api.sigs.k8s.io/)
- [Helm quickstart guide](https://helm.sh/docs/intro/quickstart/)
- [Azure Database for PostgreSQL Flexible Server](https://learn.microsoft.com/azure/postgresql/flexible-server/overview)
