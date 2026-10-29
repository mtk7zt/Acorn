export type PlatformAvailability =
  | "live-infrastructure"
  | "prototype"
  | "planned"
  | "platform-dependent";

export interface PlatformSurfaceConfig {
  id: "telegram" | "web" | "acorn-app" | "whatsapp" | "instagram" | "messages";
  name: string;
  status: string;
  availability: PlatformAvailability;
  tagline: string;
  guardrailNote: string;
  sampleExchange: {
    acornIntro: string;
    roleCard: {
      title: string;
      company: string;
      location: string;
      postedAt: string;
      reason: string;
    };
    userReply: string;
    acornFollowUp: string;
  };
}

export const ACORN_PLATFORMS: PlatformSurfaceConfig[] = [
  {
    id: "telegram",
    name: "Telegram",
    status: "Private beta",
    availability: "live-infrastructure",
    tagline: "Real-time early signals and natural conversation powered by Acorn's Cloudflare V8 edge worker.",
    guardrailNote: "Currently operating in founder/private beta (@Acorn_ai_Bot) with zero-trust sender allowlisting.",
    sampleExchange: {
      acornIntro: "I found one worth looking at.",
      roleCard: {
        title: "Cloud Engineer",
        company: "Example Labs (Demo)",
        location: "Toronto, ON",
        postedAt: "Posted 11 min ago",
        reason: "The AWS + Python requirements line up closely with what you're watching for.",
      },
      userReply: "Add junior DevOps roles too, and check my fit for this one.",
      acornFollowUp: "Added Junior DevOps Engineer to your watch list. Ready when you want to paste your resume—personal identifiers are stripped first.",
    },
  },
  {
    id: "web",
    name: "Web",
    status: "Product experience",
    availability: "prototype",
    tagline: "Morning briefings, interactive Fit Check with in-browser PII scrubbing, and full watch preferences.",
    guardrailNote: "Interactive product prototype running in client-side demo mode.",
    sampleExchange: {
      acornIntro: "Good morning. I kept watch overnight.",
      roleCard: {
        title: "Software Engineer",
        company: "Northstar Labs (Demo)",
        location: "Toronto, ON · Hybrid",
        postedAt: "Posted 8 min ago",
        reason: "Strong alignment with the TypeScript, AWS and product engineering work you're targeting.",
      },
      userReply: "Why did you send me this?",
      acornFollowUp: "It opened 8 minutes ago in Toronto, matches 4 of your core backend skills, and explicitly welcomes early-career engineers.",
    },
  },
  {
    id: "acorn-app",
    name: "Acorn App",
    status: "Planned",
    availability: "planned",
    tagline: "Dedicated iOS and Android home for your Morning Briefing, saved Signals, and career memory.",
    guardrailNote: "Mobile product specification completed; responsive web shell available to test today.",
    sampleExchange: {
      acornIntro: "Two early signals arrived while you were offline.",
      roleCard: {
        title: "Platform Developer",
        company: "Portage Cloud Systems (Demo)",
        location: "Mississauga, ON · Hybrid",
        postedAt: "Discovered early",
        reason: "Matches your Docker, Python, and CI/CD focus inside Core GTA.",
      },
      userReply: "Save this for tonight.",
      acornFollowUp: "Saved to your Signals. I'll keep the fit notes ready for this evening.",
    },
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    status: "Planned",
    availability: "platform-dependent",
    tagline: "Quiet check-ins and timely opportunity nudges inside your daily messaging flow.",
    guardrailNote: "Adapter scaffolded. Production deployment is gated on Meta WhatsApp Business Platform third-party AI agent policy validation.",
    sampleExchange: {
      acornIntro: "I found one worth looking at while it's still early.",
      roleCard: {
        title: "Backend Engineer",
        company: "Kestrel Telemetry (Demo)",
        location: "Remote Canada",
        postedAt: "Posted 14 min ago",
        reason: "True-remote Canadian team using PostgreSQL, Python, and REST APIs.",
      },
      userReply: "Check my fit.",
      acornFollowUp: "Your API and SQL projects align well. Want to open Fit Check to prepare a Terraform bullet?",
    },
  },
  {
    id: "instagram",
    name: "Instagram",
    status: "Planned",
    availability: "planned",
    tagline: "Discovery, quick career check-ins, and seamless deep links back into your Acorn workspace.",
    guardrailNote: "Designed for discovery and lightweight DM deep-linking rather than full autonomous background notifications.",
    sampleExchange: {
      acornIntro: "Your morning briefing has 3 signals waiting.",
      roleCard: {
        title: "Junior Cloud Developer",
        company: "Vespera Civic Tech (Demo)",
        location: "Toronto, ON",
        postedAt: "Early signal",
        reason: "Entry-compatible cloud role aligned with your AWS and Linux background.",
      },
      userReply: "Open in Acorn",
      acornFollowUp: "Here is your direct link to review the role and run Fit Check.",
    },
  },
  {
    id: "messages",
    name: "Messages",
    status: "Planned companion",
    availability: "planned",
    tagline: "iOS app companion with rich push notifications, Signal sharing, and interactive iMessage cards.",
    guardrailNote: "Designed as an iOS app + Messages extension companion (Apple does not expose a public autonomous bot API like Telegram).",
    sampleExchange: {
      acornIntro: "Shared via Acorn iOS Companion",
      roleCard: {
        title: "Software Engineer",
        company: "Northstar Labs (Demo)",
        location: "Toronto, ON",
        postedAt: "Posted 8 min ago",
        reason: "Early opening matching TypeScript, AWS, and REST APIs.",
      },
      userReply: "Tap to open Fit Check in Acorn",
      acornFollowUp: "Opened in Acorn companion view.",
    },
  },
];
