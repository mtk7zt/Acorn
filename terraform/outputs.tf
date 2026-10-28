output "kv_namespace_id" {
  description = "ID of the provisioned Workers KV namespace for chat history."
  value       = cloudflare_workers_kv_namespace.chat_history.id
}

output "worker_name" {
  description = "Name of the provisioned Cloudflare Worker."
  value       = cloudflare_worker_script.acorn_bot.name
}

output "webhook_endpoint_guidance" {
  description = "Instructions for registering the Telegram webhook."
  value       = "Run `python setup_webhook.py` using your Cloudflare workers.dev subdomain URL to link Telegram."
}
