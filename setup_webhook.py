#!/usr/bin/env python3
"""
Acorn Bot — Setup Webhook Script
=================================
Run this ONCE after deploying the Cloudflare Worker to register
the webhook with Telegram.

Usage:
    python setup_webhook.py

Reads TELEGRAM_BOT_TOKEN from environment, prompts for Worker URL.
"""

import os
import sys
import requests

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
if not BOT_TOKEN:
    print("❌ TELEGRAM_BOT_TOKEN environment variable not set.")
    print("   Set it first: set TELEGRAM_BOT_TOKEN=your_token_here")
    sys.exit(1)

print("🌰 Acorn Bot — Webhook Setup")
print("=" * 40)
print()

# Get Worker URL
worker_url = input("Enter your Cloudflare Worker URL (e.g. https://acorn-bot.YOUR_SUBDOMAIN.workers.dev): ").strip()
if not worker_url.startswith("https://"):
    print("❌ URL must start with https://")
    sys.exit(1)

# Secret token for webhook validation (enforces fail-closed authenticity)
secret = input("Enter a secret token (or press Enter to auto-generate a cryptographically secure token): ").strip()
if not secret:
    import secrets
    secret = secrets.token_urlsafe(32)
    print(f"🔑 Auto-generated secret token: {secret}")

# Remove any existing webhook first
print("\n⏳ Removing existing webhook...")
r = requests.get(f"https://api.telegram.org/bot{BOT_TOKEN}/deleteWebhook", timeout=10)
print(f"   {r.json()}")

# Set new webhook
print(f"\n⏳ Setting webhook → {worker_url}")
payload = {
    "url": worker_url,
    "allowed_updates": ["message", "callback_query"],
    "drop_pending_updates": True,
    "secret_token": secret,
}

r = requests.post(
    f"https://api.telegram.org/bot{BOT_TOKEN}/setWebhook",
    json=payload,
    timeout=10,
)
data = r.json()

if data.get("ok"):
    print(f"\n✅ Webhook set successfully!")
    print(f"   URL: {worker_url}")
    print(f"   Secret Token: {secret}")
    print(f"\n⚠️  CRITICAL: Add these secrets to your Cloudflare Worker:")
    print(f"   npx wrangler secret put TELEGRAM_SECRET_TOKEN  (value: {secret})")
    print(f"   npx wrangler secret put ALLOWED_CHAT_ID        (value: your Telegram user ID)")
else:
    print(f"\n❌ Failed to configure webhook: {data}")
    sys.exit(1)

# Verify
print("\n⏳ Verifying webhook info...")
r = requests.get(f"https://api.telegram.org/bot{BOT_TOKEN}/getWebhookInfo", timeout=10)
info = r.json().get("result", {})
print(f"   URL: {info.get('url')}")
print(f"   Pending updates: {info.get('pending_update_count', 0)}")
print(f"   Last error: {info.get('last_error_message', 'None')}")

print("\n🎉 Done! Your Acorn Bot is now live with instant AI responses.")
print("   Send any message to your bot in Telegram to test it!")
