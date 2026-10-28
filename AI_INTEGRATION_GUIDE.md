# 🌰 Acorn AI — Real-Time Chat & Pipeline Integration Guide

This guide explains how to deploy the always-on **Cloudflare Worker** that gives your Acorn Telegram bot:
- **Instant AI replies** (< 3–5 seconds) powered by Google Gemini 1.5 Flash
- **50-message conversational memory** via Cloudflare Workers KV
- **Full pipeline control** (add/remove tracked roles, trigger instant scans, pause/resume, toggle personality between `professional` and `encouraging`)

---

## 🛠 Prerequisites

Make sure you have:
1. **Google Gemini API Key** (Free) from [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. **Cloudflare Account** (Free) from [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
3. **GitHub Personal Access Token** (Fine-grained or Classic) with:
   - Repository: `mtk7zt/Acorn`
   - Permissions: `Contents: Read and write`, `Actions: Read and write`
   - Created at [github.com/settings/tokens](https://github.com/settings/tokens)

---

## 🚀 Step 1: Deploy the Cloudflare Worker

Open your terminal in the `cloudflare-worker/` directory:

```bash
cd cloudflare-worker
```

### 1.1 Log in to Cloudflare (one-time)
```bash
npx wrangler login
```
*(A browser window will open — click **Authorize**).*

### 1.2 Create the KV Namespace for Conversation Memory
```bash
npx wrangler kv namespace create CHAT_HISTORY
```
Copy the output `id = "..."` and update `cloudflare-worker/wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "CHAT_HISTORY"
id = "PASTE_YOUR_KV_ID_HERE"
```

### 1.3 Add Required Secrets
Run each command and paste the corresponding secret when prompted:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
# Paste your Telegram Bot Token (from @BotFather)

npx wrangler secret put TELEGRAM_SECRET_TOKEN
# Paste a random secret string (e.g., acorn_secret_9981)

npx wrangler secret put GEMINI_API_KEY
# Paste your Gemini API key from Google AI Studio

npx wrangler secret put GITHUB_PAT
# Paste your GitHub Personal Access Token

npx wrangler secret put ALLOWED_CHAT_ID
# Paste your Telegram Chat ID (Enforces zero-trust authorization)
```

### 1.4 Deploy the Worker
```bash
npx wrangler deploy
```

At the end of deployment, Wrangler will output your live URL:
`https://acorn-bot.<your-cloudflare-subdomain>.workers.dev`

---

## 🔗 Step 2: Register the Webhook with Telegram

From the root of the `Acorn` project:

```bash
# On Windows PowerShell:
$env:TELEGRAM_BOT_TOKEN="your_bot_token_here"
python setup_webhook.py

# On macOS/Linux:
TELEGRAM_BOT_TOKEN="your_bot_token_here" python3 setup_webhook.py
```

Enter:
1. Your Cloudflare Worker URL (`https://acorn-bot...workers.dev`)
2. The `TELEGRAM_SECRET_TOKEN` you set in step 1.3

You will see: `✅ Webhook set successfully!`

---

## 💬 Step 3: Test in Telegram

Open your bot in Telegram and try these:

| What to say | What happens |
|-------------|--------------|
| `"Hello! What can you do?"` | Instant response explaining its capabilities |
| `"What roles am I tracking?"` | Returns all 13 active tracked roles |
| `"Track Junior DevOps Engineer"` | Adds the role to `roles_config.json` via GitHub API |
| `"Remove Helpdesk"` | Removes role from `roles_config.json` |
| `"Run a job scan now"` | Triggers the GitHub Actions workflow instantly |
| `"Pause the bot"` | Disables scraping until resumed |
| `"Resume the bot"` | Re-enables scraping |
| `"Switch to encouraging mode"` | Switches AI tone to upbeat & motivational |
| `"Switch to professional mode"` | Switches AI tone to concise & factual |
| `"Give me advice for junior dev interviews in Toronto"` | Customized GTA career advice |

---

## 🔄 How the System Works Together

```
                   Telegram User
                         │
             ┌───────────┴───────────┐
             │                       │
      (Chat & Controls)       (Job Alerts)
             ▼                       ▲
     Cloudflare Worker               │
    (Instant AI / Gemini)            │
             │                       │
      GitHub REST API                │
             ▼                       │
   roles_config.json / bot_config.json
             │
             ▼
     GitHub Actions (Every 10 min)
    Scrapes 5 Canadian Job Boards ───┘
```
