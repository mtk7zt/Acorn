# Multi-Channel Adapter Architecture & Capability Matrix

### 1. Unified `ChannelAdapter` Contract
All communication surfaces implement the `ChannelAdapter` interface (`apps/web/src/channels/adapters.ts`) so core career intelligence never duplicates business logic per messaging app:
- `sendSignal(signal: OpportunitySignal): Promise<ChannelDeliveryResult>`
- `sendBriefing(signals: OpportunitySignal[], greeting: string): Promise<ChannelDeliveryResult>`
- `sendMessage(text: string): Promise<ChannelDeliveryResult>`
- `handleInbound(rawMessage: string): Promise<ChannelInboundResponse>`
- `getCapabilities(): ChannelCapabilities`

### 2. Channel Capability & Availability Matrix

| Channel | Current Status | Availability Tier | Buttons | Rich Cards | Proactive Push | Mini App | Deep Links |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Telegram** (`TelegramAdapter`) | Private beta | `live-infrastructure` | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Web Experience** (`WebAdapter`) | Product experience | `prototype` | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Acorn App** (`ProductPrototypeShell`) | Planned | `planned` | ✅ | ✅ | ✅ | ✅ | ✅ |
| **WhatsApp** (`WhatsAppAdapter`) | Planned | `platform-dependent` | ✅ | ⚠️ (Templates) | ⚠️ (24h Window) | ❌ | ✅ |
| **Instagram** (`InstagramAdapter`) | Planned | `planned` | ⚠️ (Quick Reply) | ❌ | ❌ | ❌ | ✅ |
| **Apple Messages** (`AppleMessagesAdapter`) | Planned companion | `planned` | ❌ (iOS Ext) | ✅ (Bubble) | ❌ (Via App Push) | ✅ (iMessage App) | ✅ |

### 3. Platform Policy & Technical Guardrails
1. **WhatsApp Guardrail:** Marked strictly as `Planned` / `platform-dependent`. Production deployment requires validation against current Meta WhatsApp Business Platform policies regarding general-purpose AI agents and 24-hour customer service windows.
2. **Instagram Guardrail:** Treated as discovery, lightweight check-ins, and deep-linking into the primary Acorn web/app experience.
3. **Apple Messages / iMessage Guardrail:** Apple does not provide a public autonomous server-to-user bot webhook API comparable to Telegram. The Apple Messages strategy is an iOS companion extension paired with the native Acorn iOS app and APNs push notifications.
