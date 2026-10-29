# Acorn Implementation Status Matrix

This document provides an unambiguous engineering audit distinguishing live backend infrastructure, features implemented in this build, interactive demo components, scaffolded adapters, and planned/policy-gated channels.

| Subsystem / Feature | Status Classification | Location / Evidence |
| :--- | :--- | :--- |
| **Python Multi-Board Job Harvester (LinkedIn, Job Bank CA, JobSpy)** | `LIVE / EXISTING` | `src/acorn/`, `job_tracker_bot.py` (Preserved untouched) |
| **4 Mandatory Algorithmic Rules (Geofence, Role Tokens, Velocity, SHA-256 Dedup)** | `LIVE / EXISTING` | `src/acorn/domain/`, `tests/` (18 unit tests passing) |
| **Cloudflare Worker Edge Gateway & KV Memory** | `LIVE / EXISTING` | `cloudflare-worker/`, `terraform/` (Preserved untouched) |
| **Telegram Private Beta Bot (`@Acorn_ai_Bot`)** | `LIVE / EXISTING` | Operational in private beta (`ALLOWED_CHAT_IDS` guarded) |
| **Legacy Web Simulator Playground** | `LIVE / EXISTING` | `web/index.html` (Preserved untouched as legacy reference) |
| **New Character-Led Product & Brand Web Experience** | `IMPLEMENTED IN THIS BUILD` | `apps/web/` |
| **11-State `<AcornMascot />` SVG & Motion State Machine** | `IMPLEMENTED IN THIS BUILD` | `apps/web/src/components/mascot/AcornMascot.tsx` |
| **Brand Mark, Wordmark, Favicon & App Icon Variants (`<AcornLogo />`)** | `IMPLEMENTED IN THIS BUILD` | `apps/web/src/components/mascot/AcornLogo.tsx` |
| **Client-Side PII Redaction Preview & Truthful Fit Check Engine** | `IMPLEMENTED IN THIS BUILD` | `apps/web/src/services/piiRedactor.ts`, `FitCheckExperience.tsx` |
| **Showable 5-Tab Acorn Product Prototype (Desktop & Mobile App Shells)** | `IMPLEMENTED IN THIS BUILD` | `apps/web/src/components/product/ProductPrototypeShell.tsx` |
| **`/design-system` Interactive Brand & Component Route** | `IMPLEMENTED IN THIS BUILD` | `apps/web/src/pages/DesignSystemPage.tsx` |
| **Synthetic Morning Briefing & Opportunity Signals (`demo: true`)** | `DEMO` | `apps/web/src/data/demoData.ts` (Fictional companies, explicit `Demo signal` badge) |
| **Request Access Form Submission (Default Local Mode)** | `DEMO` / `SCAFFOLDED` | `apps/web/src/services/accessEndpoint.ts` (Uses `VITE_ACCESS_WEBHOOK_URL` when configured; otherwise clearly reports Demo Mode) |
| **Multi-Channel Adapter Layer (`ChannelAdapter`)** | `SCAFFOLDED` | `apps/web/src/channels/adapters.ts` |
| **Native iOS / Android Mobile App** | `PLANNED` | Specified in `docs/MOBILE_PRODUCT_SPEC.md` |
| **Instagram & Apple Messages Companion Extensions** | `PLANNED` | Configured in `apps/web/src/config/platforms.ts` |
| **WhatsApp Autonomous Agent Integration** | `BLOCKED BY PLATFORM / POLICY` | Marked `Planned` / `platform-dependent` pending Meta WhatsApp Business policy validation |
