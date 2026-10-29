# Acorn Cross-Platform Strategy & Telegram UX Evolution

### 1. One Acorn, Everywhere You Communicate
Acorn maintains a single conversational identity and shared career context across surfaces. Whether a user interacts via Telegram, the Web Product Experience, or future mobile companions, Acorn speaks with the same calm, observant voice.

### 2. Migration from Legacy Telegram Slash Commands to Conversational Acorn UX
Acorn Engine v1 (`cloudflare-worker/index.js` and `src/acorn/infrastructure/notifiers/telegram.py`) already supports deterministic slash commands (`/roles`, `/scan`, `/ats`, `/forget`) and Gemini natural-language tool calling.

In the evolved Acorn product language, slash commands remain operational underneath for power users and engineering diagnostics, while primary user interactions use natural conversation and rich inline actions:

| Legacy Command | Evolved Conversational Prompt | Underlying Engine Action |
| :--- | :--- | :--- |
| `/roles` | “What are you watching for me?” | Reads `roles_config.json` via GitHub REST API |
| `Add <Role>` | “Add junior DevOps roles.” / “Stop watching Help Desk.” | Optimistic Concurrency Control (OCC) commit to `roles_config.json` |
| `/scan` | “Check again.” | Dispatches `workflow_dispatch` on `.github/workflows/job_tracker.yml` |
| `/ats` | “Check my fit.” | Arms 5-minute in-memory PII-redacted resume evaluation |
| `/forget` | “Forget my resume.” / “Delete my data.” | Purges conversational turns and temporary state from Cloudflare KV |

### 3. Private Beta Bot Governance (`@Acorn_ai_Bot`)
- `@Acorn_ai_Bot` operates as a founder/private beta service protected by `ALLOWED_CHAT_IDS` and `X-Telegram-Bot-Api-Secret-Token`.
- The public web experience does not expose unauthorized direct bot mutation links; visitors use **Request Access** or explore the sandboxed interactive prototype.
