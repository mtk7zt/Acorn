# Acorn Privacy UX & Data Sovereignty Specification

### 1. Core Privacy Principle
“Your career is personal. Acorn is designed to learn only what it needs to help you move.”

### 2. Deterministic In-Memory PII Redaction
Both the Python backend (`src/acorn/domain/security.py`), the Cloudflare Edge Worker (`cloudflare-worker/index.js`), and the TypeScript client (`apps/web/src/services/piiRedactor.ts`) enforce identical deterministic regex scrubbing prior to resume fit evaluation:
- **Email Addresses** → `[REDACTED_EMAIL]`
- **Phone Numbers (North American)** → `[REDACTED_PHONE]`
- **Canadian Postal Codes (`A1A 1A1`)** → `[REDACTED_POSTAL_CODE]`
- **Social Insurance Numbers (`123-456-789`)** → `[REDACTED_IDENTIFIER]`
- **LinkedIn Profile URLs** → `[REDACTED_LINKEDIN_URL]`

### 3. Truthful Privacy Claims
- **In Demo Mode (Web Prototype):** All Fit Check and PII redaction operations execute 100% locally in the user's browser JavaScript runtime; zero resume text is transmitted over the network.
- **In Production Edge Mode (Telegram / Worker):** Personal identifiers are stripped in transient V8 isolate memory before keyword evaluation, and `/forget` (`Delete my data`) purges stored conversational turns from Cloudflare Workers KV.
- Acorn never claims “no data can ever leave your device” for server-assisted modes; instead it transparently discloses what happens locally vs. in transient edge memory.
