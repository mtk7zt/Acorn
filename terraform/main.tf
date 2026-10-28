terraform {
  required_version = ">= 1.5.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.30.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# 1. Cloudflare Workers KV Namespace for Conversation History (50 turns)
resource "cloudflare_workers_kv_namespace" "chat_history" {
  account_id = var.cloudflare_account_id
  title      = "acorn_chat_history_${var.environment}"
}

# 2. Cloudflare Worker Script (acorn-bot)
resource "cloudflare_worker_script" "acorn_bot" {
  account_id = var.cloudflare_account_id
  name       = var.worker_name
  content    = file("${path.module}/../cloudflare-worker/index.js")
  module     = true

  compatibility_date  = "2024-11-01"
  compatibility_flags = ["nodejs_compat"]

  # Bind Workers KV Namespace
  kv_namespace_binding {
    name         = "CHAT_HISTORY"
    namespace_id = cloudflare_workers_kv_namespace.chat_history.id
  }

  # Plain text environment variables
  plain_text_binding {
    name = "ENVIRONMENT"
    text = var.environment
  }

  # Secret environment variables (Injected via Terraform sensitive inputs)
  secret_text_binding {
    name = "TELEGRAM_BOT_TOKEN"
    text = var.telegram_bot_token
  }

  secret_text_binding {
    name = "TELEGRAM_SECRET_TOKEN"
    text = var.telegram_secret_token
  }

  secret_text_binding {
    name = "GEMINI_API_KEY"
    text = var.gemini_api_key
  }

  secret_text_binding {
    name = "GITHUB_PAT"
    text = var.github_pat
  }

  secret_text_binding {
    name = "ALLOWED_CHAT_IDS"
    text = var.allowed_chat_ids != "" ? var.allowed_chat_ids : var.allowed_chat_id
  }
}

# 3. Cloudflare Worker Domain / Route
resource "cloudflare_worker_route" "worker_route" {
  count       = var.zone_id != "" ? 1 : 0
  zone_id     = var.zone_id
  pattern     = var.route_pattern
  script_name = cloudflare_worker_script.acorn_bot.name
}
