# Challenge 03 — App Deployment & Helm Ingress

[< Previous Challenge](./Challenge-02.md) — **[Home](../README.md)** — [Next Challenge >](./Challenge-04.md)

## Introduction

With a cluster running, it is time to deploy the **FabTechOps** application and expose it
to the internet. You will package the application as a Helm chart and route external traffic
to it using the AKS **App Routing** add-on — the modern, production-grade replacement for
the deprecated HTTP Application Routing preview add-on.

## Description

- Enable the **App Routing add-on** on your cluster to get a managed NGINX ingress controller.
  - **Hint:** This is an AKS add-on you can enable via Azure CLI or Portal.
- Deploy a **database** for the FabTechOps application. You may use Azure Database for
  PostgreSQL Flexible Server (recommended) or an in-cluster PostgreSQL deployment for development.
- Package the FabTechOps **API** and **Web** components as a **Helm chart** and deploy them
  to a dedicated namespace in your cluster.
  - The configuration should support changing the image tag and replica count without editing the templates.
  - **NOTE:** Sample YAML templates are provided in the `Resources.zip` from your coach.
- Create an **Ingress resource** to route external HTTP traffic to the web component.
  - Use `ingressClassName: webapprouting.kubernetes.azure.com` — the App Routing add-on class.
  - **NOTE:** The deprecated `extensions/v1beta1` Ingress API was removed in Kubernetes 1.22. Use `networking.k8s.io/v1`.
- Verify the application is accessible from a browser.
- Demonstrate a **Helm upgrade** (e.g., change the replica count) and a **Helm rollback**.

## Success Criteria

1. The App Routing add-on is running and an NGINX ingress controller pod is visible.
2. Both `fabtech-api` and `fabtech-web` deployments have at least 2 pods running.
3. The application is accessible from a browser via the ingress IP or hostname.
4. The Ingress resource uses `ingressClassName: webapprouting.kubernetes.azure.com`.
5. Show a successful `helm upgrade` and `helm rollback`.

## Learning Resources

- [App Routing add-on for AKS](https://learn.microsoft.com/azure/aks/app-routing)
- [Helm quickstart guide](https://helm.sh/docs/intro/quickstart/)
- [Kubernetes Ingress (networking.k8s.io/v1)](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [AKS rolling updates and rollbacks](https://learn.microsoft.com/azure/aks/tutorial-kubernetes-app-update)
- [Azure Database for PostgreSQL Flexible Server](https://learn.microsoft.com/azure/postgresql/flexible-server/overview)
