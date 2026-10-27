# 🌰 Acorn AI (The Job Tracker you can count on) — Real-Time Canadian Job Tracker & Zero-PII ATS Co-Pilot


![CI Status](https://img.shields.io/github/actions/workflow/status/mtk7zt/Acorn/job_tracker.yml?label=Job%20Tracker%20CI&logo=github)
![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Edge-Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white)
![Privacy](https://img.shields.io/badge/Privacy-Zero--PII%20%2F%20Right%20to%20Erasure-2EA44F)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)


**Acorn AI** is an autonomous, privacy-first job intelligence engine and Telegram co-pilot built for software engineers, cloud developers, and IT professionals. It polls **LinkedIn**, **Indeed Canada**, **Job Bank Canada (`jobbank.gc.ca`)**, **Glassdoor**, and **Google Jobs** every 10 minutes, filters out stale reposts (`>30 applicants`) and foreign false-positives, and delivers prioritized alerts with one-tap **Zero-PII ATS Resume Scoring**.


### ✨ Why Acorn AI?


| Feature | Typical Job Board Alerts | 🌰 Acorn AI |
| :--- | :--- | :--- |
| **Alert Latency** | 6–24 hours delayed digest | **10-minute polling (`f_TPR=r3600`)** |
| **Repost & Saturation Filtering** | Floods inbox with "Reposted" jobs & 200+ applicant listings | **Automatically drops `"Reposted"` jobs & listings with `>30 applicants`** |
| **Cross-Board Deduplication** | Sends duplicate alerts for LinkedIn + Indeed | **Canonical SHA-256 fingerprinting (`company \| title \| city`)** |
| **Remote Geofencing** | Mixes US-only (`San Francisco, CA`) & foreign onsite jobs into Remote | **Strict Canadian jurisdiction & true-remote verification** |
| **ATS & Resume Tailoring** | Requires uploading full PII resume to third-party servers | **Zero-PII in-memory redaction + `/forget` instant data erasure** |
| **Hosting Cost** | $15–$49/month SaaS subscription | **$0.00/month on GitHub Actions + Cloudflare Workers** |


### 🏗️ System Architecture


1. **Multi-Board Discovery Plane (`src/acorn/infrastructure/scrapers/`)**: Concurrent adapters query LinkedIn Guest APIs, Job Bank Canada, Indeed CA, Glassdoor CA, and Google Jobs.
2. **Verification & Deduplication Engine (`src/acorn/application/pipeline.py`)**: Enforces Role-Title Token Alignment, Applicant Velocity Guard ($\le 30$ applicants), Canadian Geofencing, and SHA-256 content fingerprinting.
3. **Zero-PII ATS Co-Pilot & Edge Webhook (`cloudflare-worker/` & `telegram.py`)**: Delivers rich HTML alerts with inline `[🚀 Apply]`, `[➕ Add Job Role]`, `[📋 Manage Roles]`, `[📄 ATS Resume Check]`, and `[🗑️ Wipe My Data]` buttons.


### 🚀 3-Minute Quick Start


1. **Fork & Clone `mtk7zt/Acorn`**.
2. **Create a Telegram Bot**: Message `@BotFather` on Telegram (`/newbot`) to get your `TELEGRAM_BOT_TOKEN`, and message `@userinfobot` to get your `TELEGRAM_CHAT_ID`.
3. **Add GitHub Repository Secrets**: Under **Settings → Secrets and variables → Actions**, add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.
4. **Enable GitHub Actions**: Open the **Actions** tab, select **Multi-Board Job Tracker Bot**, and click **Run workflow** with `test_telegram = true`.
