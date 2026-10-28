# 🌰 Acorn AI: Multi-Board Canadian Job Tracker & Edge Conversational Assistant

[![CI/CD Job Tracker](https://github.com/mtk7zt/Acorn/actions/workflows/job_tracker.yml/badge.svg)](https://github.com/mtk7zt/Acorn/actions/workflows/job_tracker.yml)
[![Python Version](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Cloudflare Workers](https://img.shields.io/badge/cloudflare-workers-orange.svg)](https://workers.cloudflare.com/)
[![LLM](https://img.shields.io/badge/gemini-1.5%20flash-8E75B2.svg)](https://deepmind.google/technologies/gemini/)
[![Architecture](https://img.shields.io/badge/architecture-clean%20%2F%20DDD-green.svg)](docs/PROJECTED_ARCHITECTURE_SPECIFICATION.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Acorn** is an intelligent, dual-engine job discovery and tracking ecosystem engineered specifically for the Canadian technology sector. It pairs a scheduled, distributed multi-board scraping pipeline with an always-on Cloudflare Worker edge AI assistant powered by Google Gemini 1.5 Flash.

---

## 📑 Architectural Documentation & Academic Publications

This repository adheres to the **ISO/IEC/IEEE 42010:2022** architectural description standards and follows formal Harvard-style referencing:

* 📄 **[Baseline Architecture Specification (`docs/CURRENT_SYSTEM_SPECIFICATION.md`)](docs/CURRENT_SYSTEM_SPECIFICATION.md)**: Master's-level baseline report analyzing the initial prototype, technical debt, procedural anti-patterns, and STRIDE security audit.
* 📄 **[Target Architecture & Engineering Specification (`docs/PROJECTED_ARCHITECTURE_SPECIFICATION.md`)](docs/PROJECTED_ARCHITECTURE_SPECIFICATION.md)**: Publication-grade systems design paper detailing the Domain-Driven Design (DDD) model, SOLID principles realization, Gang of Four (GoF) patterns, DREAD risk mitigations, and formal algorithmic complexity proofs.
* 🛠️ **[Deployment & Cloudflare Worker Guide (`AI_INTEGRATION_GUIDE.md`)](AI_INTEGRATION_GUIDE.md)**: Operational guide for provisioning Workers KV, configuring secrets, and binding Telegram webhooks.

---

## 🏛️ System Architecture

Acorn solves the fundamental trade-off between **high-throughput background scraping** and **low-latency real-time conversational messaging** by bifurcating responsibilities into two distinct, asynchronous runtimes:

```
                          Telegram User (Job Seeker)
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            │ (Real-Time Inquiries & Remote Pipeline Controls)  │ (Real-Time Push Alerts)
            ▼                                                   ▲
 ┌──────────────────────────────┐                ┌──────────────────────────────┐
 │  Cloudflare Worker (Edge)    │                │  GitHub Actions (Batch VM)   │
 │                              │                │                              │
 │  • Sub-5s response latency   │                │  • Scheduled 10-minute cron  │
 │  • Google Gemini 1.5 Flash   │                │  • Multi-source scrapers     │
 │  • 50-turn KV chat memory    │                │  • 3-Tier GTA location rank  │
 │  • Optimistic GitHub REST OCC│                │  • Seniority title filters   │
 └──────────────┬───────────────┘                └──────────────▲───────────────┘
                │                                               │
                │ Mutates config & dispatches scans             │ Reads state & filters
                ▼                                               │
        ┌───────────────────────────────────────────────────────────────┐
        │               GitHub Git Store (mtk7zt/Acorn)                 │
        │   roles_config.json  •  bot_config.json  •  seen_jobs.json    │
        └───────────────────────────────────────────────────────────────┘
```

---

## 🌟 Key Capabilities

### 1. 🔍 Multi-Board Real-Time Ingestion
Harvests fresh postings ($T \le 60\text{ minutes}$) across 5 primary Canadian portals:
- **LinkedIn Canada:** Direct guest API scraping (`f_TPR=r3600`) with minute-level freshness.
- **Indeed Canada:** Multi-board scraping with localized Canadian regional parameters.
- **Job Bank Canada (`jobbank.gc.ca`):** Official Government of Canada portal sorted by newest postings (`sort=D`).
- **Glassdoor Canada:** National technology job board index.
- **Google Jobs Canada:** Aggregating Workopolis, Monster.ca, Eluta, and employer applicant tracking systems (ATS).

### 2. 🎯 Geographic Priority Tiers & Seniority Filtering
- **🔥 Priority 1 (Mississauga / Toronto Core):** Mississauga, Toronto, Etobicoke, North York, Scarborough, East York, York.
- **📍 Priority 2 (Surrounding Greater Toronto Area):** Brampton, Oakville, Burlington, Milton, Vaughan, Markham, Richmond Hill, Pickering, Ajax, Whitby, Oshawa, Newmarket, Aurora, Hamilton, Halton, Peel, Durham.
- **🌐 Priority 3 (Remote Canada):** Telework / Remote positions across Canada.
- **Seniority Exclusion with Junior Override:** Automatically rejects titles containing `Senior`, `Lead`, `Manager`, `Director`, `Principal`, or `Architect` unless explicitly counterbalanced by `Junior`, `Intern`, `Co-op`, `Associate`, or `Entry-level`.

### 3. 🤖 Edge Conversational AI Assistant
Chat directly with the bot on Telegram with near-instant response times ($<3\text{ seconds}$):
- **Conversational Memory:** Retains the last 50 conversational turns using Cloudflare Workers KV.
- **Pipeline Governance:** Instruct the bot in plain English to add roles, remove roles, trigger instant scans, pause the scheduler, or update freshness thresholds.
- **Dual Personality:** Toggle between `professional` (concise, factual) and `encouraging` (supportive, motivational job search coach).

---

## 💬 Sample Telegram Interactions

```
You: "What roles am I currently tracking?"
Acorn: 📋 You are currently tracking 13 roles:
       1. Junior Software Engineer
       2. Software Engineer Intern
       3. IT Support
       ...
       Would you like to add or remove any designations?

You: "Add Junior DevOps Engineer and Cloud Analyst"
Acorn: ✅ Added 2 new roles to tracking:
       • Junior DevOps Engineer
       • Cloud Analyst
       Updated total: 15 active roles.

You: "Run a job scan right now"
Acorn: 🔄 Job scan triggered on GitHub Actions! Check back in ~60 seconds for fresh alert notifications.

You: "Switch to encouraging mode"
Acorn: 🌟 Personality set to ENCOURAGING! You're doing amazing in your job search, let's land that dream role! 🚀
```

---

## 🚀 Quick Start & Installation

### Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/mtk7zt/Acorn.git
   cd Acorn
   ```

2. **Set up virtual environment & install dependencies:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Execute dry-run pipeline test:**
   ```bash
   python job_tracker_bot.py --dry-run
   ```

---

## ⚙️ Configuration & Secrets

### 1. GitHub Actions Secrets
In your GitHub repository, navigate to **Settings → Secrets and variables → Actions** and add:

| Secret Name | Description | Source |
|:---|:---|:---|
| `TELEGRAM_BOT_TOKEN` | Bot authentication token | Telegram `@BotFather` |
| `TELEGRAM_CHAT_ID` | Your authorized Telegram chat ID | Telegram `@userinfobot` |

### 2. Cloudflare Worker Secrets
Navigate to `cloudflare-worker/` and bind production secrets:

```bash
cd cloudflare-worker
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_SECRET_TOKEN   # Random secret string
npx wrangler secret put GEMINI_API_KEY          # From https://aistudio.google.com/app/apikey
npx wrangler secret put GITHUB_PAT              # GitHub PAT (Contents: Read/Write, Actions: Read/Write)
npx wrangler secret put ALLOWED_CHAT_ID         # Your Telegram chat ID (Enforces zero-trust auth)
```

---

## 🏗️ Infrastructure as Code (Terraform)

Deploy the Cloudflare Worker and KV storage declaratively using HashiCorp Terraform:

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Populate terraform.tfvars with your Cloudflare API token and Account ID

terraform init
terraform plan
terraform apply
```

---

## 🔒 Security & Vulnerability Policy

Acorn implements defense-in-depth security principles:
* **Strict Sender Authorization (`ALLOWED_CHAT_ID`):** Webhook drops any interaction not originating from the verified repository owner.
* **Fail-Closed Secret Validation:** Rejects requests lacking the cryptographic `X-Telegram-Bot-Api-Secret-Token` header.
* **Deterministic HTML Sanitization:** All incoming job metadata is escaped before injection into Telegram HTML DOM formatting, eliminating formatting truncation and XSS risks.
* **Optimistic Concurrency Control:** GitHub API commits utilize SHA verification with exponential backoff to prevent race condition write corruption.

---

## 📄 License

This project is licensed under the terms of the **MIT License**. See the [LICENSE](LICENSE) file for complete details.

---

## 📚 Academic Citation

If utilizing this software architecture or system specification in academic research or technical reporting, please cite conforming to the Harvard referencing standard:

```text
Emokpae, S. (2026) Acorn: Multi-Board Canadian Job Tracker and Edge Conversational Assistant. 
[Source code]. Available at: https://github.com/mtk7zt/Acorn (Accessed: 27 October 2026).
```
