variable "cloudflare_api_token" {
  type        = string
  description = "Cloudflare API Token with Workers Scripts:Edit and Workers KV:Edit permissions."
  sensitive   = true
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare Account ID."
}

variable "worker_name" {
  type        = string
  description = "Name of the Cloudflare Worker."
  default     = "acorn-bot"
}

variable "environment" {
  type        = string
  description = "Deployment environment (production or staging)."
  default     = "production"
}

variable "zone_id" {
  type        = string
  description = "Optional Cloudflare DNS Zone ID for custom domain routing."
  default     = ""
}

variable "route_pattern" {
  type        = string
  description = "Route pattern if custom domain zone_id is specified (e.g., bot.example.com/*)."
  default     = ""
}

# Secret bindings
variable "telegram_bot_token" {
  type        = string
  description = "Telegram Bot Token obtained from @BotFather."
  sensitive   = true
}

variable "telegram_secret_token" {
  type        = string
  description = "Secret token for Telegram webhook validation (X-Telegram-Bot-Api-Secret-Token)."
  sensitive   = true
}

variable "gemini_api_key" {
  type        = string
  description = "Google Gemini API Key from Google AI Studio."
  sensitive   = true
}

variable "github_pat" {
  type        = string
  description = "GitHub Personal Access Token with repo Contents:Write and Actions:Write scopes."
  sensitive   = true
}

variable "allowed_chat_ids" {
  type        = string
  description = "Comma-separated allowlist of authorized Telegram Chat IDs (e.g. '1234567,9876543')."
  default     = ""
  sensitive   = true
}

variable "allowed_chat_id" {
  type        = string
  description = "Authorized single Telegram Chat ID (fallback if allowed_chat_ids is not set)."
  default     = ""
  sensitive   = true
}
