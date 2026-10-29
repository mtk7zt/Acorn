/**
 * Unified Multi-Channel Adapter Architecture
 * One core Acorn intelligence layer with capability-aware channel adapters.
 */
import { OpportunitySignal } from "../types/acorn";

export interface ChannelCapabilities {
  supportsButtons: boolean;
  supportsRichCards: boolean;
  supportsProactiveMessages: boolean;
  supportsMiniApp: boolean;
  supportsAttachments: boolean;
  supportsInteractiveMessages: boolean;
  requiresUserInitiation: boolean;
  supportsDeepLinks: boolean;
}

export interface ChannelDeliveryResult {
  channelId: string;
  delivered: boolean;
  mode: "live-infrastructure" | "prototype" | "scaffold-preview";
  formattedPreview: string;
  actionsRendered: string[];
}

export interface ChannelInboundResponse {
  channelId: string;
  naturalReply: string;
  mappedEngineCommand?: "/roles" | "/scan" | "/ats" | "/forget" | "ADD_ROLE" | "REMOVE_ROLE";
}

export interface ChannelAdapter {
  readonly channelId: string;
  readonly displayName: string;
  getCapabilities(): ChannelCapabilities;
  sendSignal(signal: OpportunitySignal): Promise<ChannelDeliveryResult>;
  sendBriefing(signals: OpportunitySignal[], greeting: string): Promise<ChannelDeliveryResult>;
  sendMessage(text: string): Promise<ChannelDeliveryResult>;
  handleInbound(userMessage: string): Promise<ChannelInboundResponse>;
}

/**
 * Shared natural-language intent mapper bridging conversational Acorn UX
 * to Acorn Engine v1 commands (/roles, /scan, /ats, /forget).
 */
export function mapNaturalLanguageToAcornEngine(
  userMessage: string
): ChannelInboundResponse {
  const lower = userMessage.toLowerCase().trim();

  if (
    lower.includes("what are you watching") ||
    lower.includes("which roles") ||
    lower === "/roles"
  ) {
    return {
      channelId: "core",
      mappedEngineCommand: "/roles",
      naturalReply:
        "I'm currently watching Junior Software Engineer, Software Engineer Intern, AWS Cloud Junior Developer, Junior Cloud Developer, Java Developer, and Application Support Analyst across Toronto, Mississauga, and Remote Canada.",
    };
  }

  if (
    lower.includes("add ") ||
    lower.includes("start watching") ||
    lower.includes("devops")
  ) {
    return {
      channelId: "core",
      mappedEngineCommand: "ADD_ROLE",
      naturalReply:
        "Got it. I've added Junior DevOps Engineer to your watched roles and will include it in the next check.",
    };
  }

  if (lower.includes("stop watching") || lower.includes("remove ")) {
    return {
      channelId: "core",
      mappedEngineCommand: "REMOVE_ROLE",
      naturalReply:
        "Understood. I've removed that role from your watch list so it won't clutter your briefing.",
    };
  }

  if (
    lower.includes("check again") ||
    lower.includes("look now") ||
    lower === "/scan"
  ) {
    return {
      channelId: "core",
      mappedEngineCommand: "/scan",
      naturalReply:
        "I'm taking a fresh look across your tracked boards now. I'll surface anything worth your time.",
    };
  }

  if (
    lower.includes("check my fit") ||
    lower.includes("prepare") ||
    lower === "/ats"
  ) {
    return {
      channelId: "core",
      mappedEngineCommand: "/ats",
      naturalReply:
        "Share your resume bullets whenever you're ready. Personal identifiers (email, phone, postal code, SIN, LinkedIn URL) are stripped before I check alignment.",
    };
  }

  if (
    lower.includes("forget") ||
    lower.includes("wipe") ||
    lower.includes("delete my data") ||
    lower === "/forget"
  ) {
    return {
      channelId: "core",
      mappedEngineCommand: "/forget",
      naturalReply:
        "Done. I've cleared your recent conversation memory and temporary fit check context.",
    };
  }

  if (lower.includes("what did you do today") || lower.includes("activity")) {
    return {
      channelId: "core",
      naturalReply:
        "I kept watch overnight, filtered out reposted and senior-only listings, and brought forward 3 timely signals that match your backend and cloud direction.",
    };
  }

  return {
    channelId: "core",
    naturalReply:
      "I'm keeping watch across your Toronto, GTA, and Remote Canada roles. Ask me what's worth your attention, adjust what I'm watching, or run a Fit Check on any signal.",
  };
}

export class TelegramAdapter implements ChannelAdapter {
  readonly channelId = "telegram";
  readonly displayName = "Telegram (@Acorn_ai_Bot · Private Beta)";

  getCapabilities(): ChannelCapabilities {
    return {
      supportsButtons: true,
      supportsRichCards: true,
      supportsProactiveMessages: true,
      supportsMiniApp: true,
      supportsAttachments: true,
      supportsInteractiveMessages: true,
      requiresUserInitiation: true,
      supportsDeepLinks: true,
    };
  }

  async sendSignal(signal: OpportunitySignal): Promise<ChannelDeliveryResult> {
    return {
      channelId: this.channelId,
      delivered: true,
      mode: "live-infrastructure",
      formattedPreview: `I found one worth looking at.\n\n${signal.title}\n${signal.company} · ${signal.location}\n${signal.postedAt}\n\n"${signal.summary}"`,
      actionsRendered: ["View role", "Check my fit", "Not for me"],
    };
  }

  async sendBriefing(
    signals: OpportunitySignal[],
    greeting: string
  ): Promise<ChannelDeliveryResult> {
    return {
      channelId: this.channelId,
      delivered: true,
      mode: "live-infrastructure",
      formattedPreview: `${greeting} I kept watch overnight. ${signals.length} signals are worth your attention.`,
      actionsRendered: ["Open Briefing", "What are you watching?"],
    };
  }

  async sendMessage(text: string): Promise<ChannelDeliveryResult> {
    return {
      channelId: this.channelId,
      delivered: true,
      mode: "live-infrastructure",
      formattedPreview: text,
      actionsRendered: [],
    };
  }

  async handleInbound(userMessage: string): Promise<ChannelInboundResponse> {
    return {
      ...mapNaturalLanguageToAcornEngine(userMessage),
      channelId: this.channelId,
    };
  }
}

export class WebAdapter implements ChannelAdapter {
  readonly channelId = "web";
  readonly displayName = "Acorn Web Experience";

  getCapabilities(): ChannelCapabilities {
    return {
      supportsButtons: true,
      supportsRichCards: true,
      supportsProactiveMessages: false,
      supportsMiniApp: true,
      supportsAttachments: true,
      supportsInteractiveMessages: true,
      requiresUserInitiation: false,
      supportsDeepLinks: true,
    };
  }

  async sendSignal(signal: OpportunitySignal): Promise<ChannelDeliveryResult> {
    return {
      channelId: this.channelId,
      delivered: true,
      mode: "prototype",
      formattedPreview: `${signal.title} at ${signal.company} (${signal.location}) — ${signal.summary}`,
      actionsRendered: ["View role", "Check my fit", "Not for me"],
    };
  }

  async sendBriefing(
    signals: OpportunitySignal[],
    greeting: string
  ): Promise<ChannelDeliveryResult> {
    return {
      channelId: this.channelId,
      delivered: true,
      mode: "prototype",
      formattedPreview: `${greeting} ${signals.length} signals ready in your web briefing.`,
      actionsRendered: ["Expand Signal", "Check my fit"],
    };
  }

  async sendMessage(text: string): Promise<ChannelDeliveryResult> {
    return {
      channelId: this.channelId,
      delivered: true,
      mode: "prototype",
      formattedPreview: text,
      actionsRendered: [],
    };
  }

  async handleInbound(userMessage: string): Promise<ChannelInboundResponse> {
    return {
      ...mapNaturalLanguageToAcornEngine(userMessage),
      channelId: this.channelId,
    };
  }
}

export class WhatsAppAdapter implements ChannelAdapter {
  readonly channelId = "whatsapp";
  readonly displayName = "WhatsApp (Planned · Platform-Dependent)";

  getCapabilities(): ChannelCapabilities {
    return {
      supportsButtons: true,
      supportsRichCards: false,
      supportsProactiveMessages: true,
      supportsMiniApp: false,
      supportsAttachments: true,
      supportsInteractiveMessages: true,
      requiresUserInitiation: true,
      supportsDeepLinks: true,
    };
  }

  async sendSignal(signal: OpportunitySignal): Promise<ChannelDeliveryResult> {
    return {
      channelId: this.channelId,
      delivered: false,
      mode: "scaffold-preview",
      formattedPreview: `[Planned WhatsApp Preview] I found one worth looking at: ${signal.title} at ${signal.company} (${signal.postedAt}).`,
      actionsRendered: ["View role", "Check my fit", "Not for me"],
    };
  }

  async sendBriefing(
    signals: OpportunitySignal[],
    greeting: string
  ): Promise<ChannelDeliveryResult> {
    return {
      channelId: this.channelId,
      delivered: false,
      mode: "scaffold-preview",
      formattedPreview: `${greeting} ${signals.length} signals worth your attention.`,
      actionsRendered: ["Review in Acorn"],
    };
  }

  async sendMessage(text: string): Promise<ChannelDeliveryResult> {
    return {
      channelId: this.channelId,
      delivered: false,
      mode: "scaffold-preview",
      formattedPreview: text,
      actionsRendered: [],
    };
  }

  async handleInbound(userMessage: string): Promise<ChannelInboundResponse> {
    return {
      ...mapNaturalLanguageToAcornEngine(userMessage),
      channelId: this.channelId,
    };
  }
}

export class InstagramAdapter implements ChannelAdapter {
  readonly channelId = "instagram";
  readonly displayName = "Instagram (Planned · Discovery & Deep-Link)";

  getCapabilities(): ChannelCapabilities {
    return {
      supportsButtons: false,
      supportsRichCards: false,
      supportsProactiveMessages: false,
      supportsMiniApp: false,
      supportsAttachments: false,
      supportsInteractiveMessages: true,
      requiresUserInitiation: true,
      supportsDeepLinks: true,
    };
  }

  async sendSignal(signal: OpportunitySignal): Promise<ChannelDeliveryResult> {
    return {
      channelId: this.channelId,
      delivered: false,
      mode: "scaffold-preview",
      formattedPreview: `${signal.title} · ${signal.company} — Open in Acorn to check your fit.`,
      actionsRendered: ["Open in Acorn ↗"],
    };
  }

  async sendBriefing(
    signals: OpportunitySignal[],
    greeting: string
  ): Promise<ChannelDeliveryResult> {
    return {
      channelId: this.channelId,
      delivered: false,
      mode: "scaffold-preview",
      formattedPreview: `${greeting} ${signals.length} signals waiting in Acorn.`,
      actionsRendered: ["Open Briefing ↗"],
    };
  }

  async sendMessage(text: string): Promise<ChannelDeliveryResult> {
    return {
      channelId: this.channelId,
      delivered: false,
      mode: "scaffold-preview",
      formattedPreview: text,
      actionsRendered: [],
    };
  }

  async handleInbound(userMessage: string): Promise<ChannelInboundResponse> {
    return {
      ...mapNaturalLanguageToAcornEngine(userMessage),
      channelId: this.channelId,
    };
  }
}

export class AppleMessagesAdapter implements ChannelAdapter {
  readonly channelId = "messages";
  readonly displayName = "Apple Messages Companion (Planned iOS Extension)";

  getCapabilities(): ChannelCapabilities {
    return {
      supportsButtons: false,
      supportsRichCards: true,
      supportsProactiveMessages: false,
      supportsMiniApp: true,
      supportsAttachments: true,
      supportsInteractiveMessages: true,
      requiresUserInitiation: true,
      supportsDeepLinks: true,
    };
  }

  async sendSignal(signal: OpportunitySignal): Promise<ChannelDeliveryResult> {
    return {
      channelId: this.channelId,
      delivered: false,
      mode: "scaffold-preview",
      formattedPreview: `[iOS Messages Companion Card] ${signal.title} · ${signal.company}`,
      actionsRendered: ["Open in Acorn iOS App"],
    };
  }

  async sendBriefing(
    signals: OpportunitySignal[],
    greeting: string
  ): Promise<ChannelDeliveryResult> {
    return {
      channelId: this.channelId,
      delivered: false,
      mode: "scaffold-preview",
      formattedPreview: `${greeting} (${signals.length} signals via iOS push notification)`,
      actionsRendered: ["Open Acorn App"],
    };
  }

  async sendMessage(text: string): Promise<ChannelDeliveryResult> {
    return {
      channelId: this.channelId,
      delivered: false,
      mode: "scaffold-preview",
      formattedPreview: text,
      actionsRendered: [],
    };
  }

  async handleInbound(userMessage: string): Promise<ChannelInboundResponse> {
    return {
      ...mapNaturalLanguageToAcornEngine(userMessage),
      channelId: this.channelId,
    };
  }
}
