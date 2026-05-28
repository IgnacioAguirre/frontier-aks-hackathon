# Coach Guide — Frontier AKS Hackathon

> **COACHES ONLY — Do not share with participants.**

This guide provides an index of all solution files, coaching philosophy, Azure
requirements, and a suggested agenda.

---

## Solution Index

| Challenge | Title | Solution File |
|-----------|-------|---------------|
| 00 | Prerequisites | [Solution-00.md](./Solutions/Solution-00.md) |
| 01 | Containers & ACR | [Solution-01.md](./Solutions/Solution-01.md) |
| 02 | AKS Cluster Deployment | [Solution-02.md](./Solutions/Solution-02.md) |
| 03 | App Deployment & Helm Ingress | [Solution-03.md](./Solutions/Solution-03.md) |
| 04 | Workload Identity & Secrets | [Solution-04.md](./Solutions/Solution-04.md) |
| 05 | Observability | [Solution-05.md](./Solutions/Solution-05.md) |
| 06 | Autoscaling | [Solution-06.md](./Solutions/Solution-06.md) |
| 07 | GitOps with Flux v2 | [Solution-07.md](./Solutions/Solution-07.md) |
| 08 | AKS Security Hardening | [Solution-08.md](./Solutions/Solution-08.md) |
| 09 | Service Mesh with AKS Istio | [Solution-09.md](./Solutions/Solution-09.md) |
| 10 | Storage | [Solution-10.md](./Solutions/Solution-10.md) |
| 11 | Enterprise Networking | [Solution-11.md](./Solutions/Solution-11.md) |
| 12 | AKS Fleet Manager | [Solution-12.md](./Solutions/Solution-12.md) |
| AI-01 | AI on AKS Foundations *(optional)* | [Solution-AI-01.md](./Solutions/Solution-AI-01.md) |
| AI-02 | LLM Inference with KAITO *(optional)* | [Solution-AI-02.md](./Solutions/Solution-AI-02.md) |

Also see: [Deprecation-Cheatsheet.md](./Deprecation-Cheatsheet.md)

---

## Azure Requirements

| Resource | Requirement |
|----------|-------------|
| **Role** | Owner on the subscription (required for `--attach-acr`, RBAC assignments) |
| **Region** | `eastus` or `eastus2` recommended (best service availability) |
| **vCPU quota** | ~16 Standard D-series vCPUs per team (D4ds_v5 × 4 nodes minimum) |
| **GPU quota** *(AI track)* | `Standard_NC4as_T4_v3` — must request 24–48 hours in advance |
| **Resource providers** | `Microsoft.ContainerService`, `Microsoft.Monitor`, `Microsoft.Dashboard`, `Microsoft.KubernetesConfiguration`, `Microsoft.ContainerRegistry` |

Resource providers to pre-register:
```bash
for ns in Microsoft.ContainerService Microsoft.Monitor Microsoft.Dashboard \
           Microsoft.KubernetesConfiguration Microsoft.ContainerRegistry; do
  az provider register --namespace $ns --accept-terms
done
```

---

## Suggested Agenda

### Full 2-Day Event (Expert Track)

| Day | Challenges | Focus |
|-----|-----------|-------|
| Day 1 AM | Ch 00–02 | Setup, Containers, Cluster |
| Day 1 PM | Ch 03–06 | App Deployment, Identity, Observability, Autoscaling |
| Day 2 AM | Ch 07–09 | GitOps, Security, Service Mesh |
| Day 2 PM | Ch 10–12 | Storage, Networking, Fleet |
| Day 2 PM (optional) | AI-01, AI-02 | GPU, KAITO — for teams that finish early |

### Focused 1-Day Event

Challenges 00–08 cover the core AKS lifecycle. Challenges 09–12 are recommended for
teams with strong Kubernetes experience.

---

## Coaching Philosophy

1. **Don't give away answers.** When a team is stuck, ask guiding questions:
   - "What does `kubectl describe` tell you about that pod?"
   - "Have you checked the Azure Policy assignment status?"
   - "Is the namespace label set correctly for sidecar injection?"

2. **Use the solution files for yourself, not for participants.** Show CLI output
   and error messages — not the commands to fix them — unless a team is truly blocked
   and time is running out.

3. **Let teams choose their path.** AKS Automatic vs Standard in Ch 02, PostgreSQL
   managed vs in-cluster in Ch 03, NAT Gateway vs Firewall in Ch 11 — both paths
   are valid. The solution files cover the primary path; coaches decide when to steer.

4. **Timebox each challenge.** Suggested max times:
   - Ch 00: 30 min | Ch 01–02: 45 min each | Ch 03–06: 60 min each
   - Ch 07–12: 45–60 min each | AI-01–02: 60 min each

5. **The AI track is optional.** GPU quota issues should not block the core track.
   Teams without GPU quota can read the challenge and discuss the concepts.

---

## Cleanup

Remind all teams to delete resources at the end:

```bash
az group delete --name rg-frontier-aks --no-wait --yes
```

---

## Deprecation Reference

See [Deprecation-Cheatsheet.md](./Deprecation-Cheatsheet.md) for the full list of
deprecated items found across the source hackathons (001, 023, 039) and their
modern replacements. If a team tries to use any of these deprecated approaches,
redirect them to the cheatsheet.
