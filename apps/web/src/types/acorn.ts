export type AcornMascotState =
  | "idle"
  | "watching"
  | "thinking"
  | "found"
  | "briefing"
  | "fitCheck"
  | "privacy"
  | "sleepWatch"
  | "celebrate"
  | "concerned"
  | "travel"
  | "searching"
  | "empty"
  | "error"
  | "onboarding";

export type VelocitySignalType =
  | "Early signal"
  | "Timely window"
  | "Active window";

export type FreshnessConfidence = "high" | "medium" | "observed";

export type SignalStatus = "unread" | "saved" | "dismissed" | "reviewed";

/**
 * Typed OpportunitySignal Model
 * CRITICAL TRUTHFULNESS RULE:
 * - applicantCount is nullable/optional.
 * - Only render applicantCount when applicantCountObserved === true and typeof applicantCount === 'number'.
 * - Never invent an applicant count from freshness.
 */
export interface OpportunitySignal {
  id: string;
  title: string;
  company: string;
  location: string;
  workMode: "Hybrid" | "Remote" | "On-site";
  source: string;
  sourceUrl: string;
  postedAt: string;
  discoveredAt: string;
  applicantCount?: number;
  applicantCountObserved: boolean;
  applicantCountSource?: string;
  velocitySignal: VelocitySignalType;
  velocityReason: string;
  freshnessConfidence: FreshnessConfidence;
  summary: string;
  fitReasons: string[];
  skillsMatched: string[];
  skillsMissing: string[];
  isRepost: boolean;
  status: SignalStatus;
  fingerprint: string;
  demo: boolean;
}

export interface ActivityItem {
  id: string;
  timestamp: string;
  action: string;
  reason: string;
  userVisibleSummary: string;
  channel: "Acorn Engine" | "Telegram" | "Web" | "You";
  status: "completed" | "user-approved" | "filtered";
  demo: boolean;
}

export interface WatchPreferencesModel {
  userName: string;
  roles: string[];
  locations: string[];
  remotePreference: "Hybrid & Remote Canada" | "Remote Only" | "GTA On-site / Hybrid";
  seniority: "Intern / New Grad / Junior" | "Junior / Intermediate";
  skillsContext: string[];
  excludedKeywords: string[];
  notificationCadence: "Immediate early signals + Morning Briefing" | "Morning Briefing only";
  personality: "calm" | "encouraging";
}

export interface PiiRedactionMatch {
  category: "Email" | "Phone" | "Canadian Postal Code" | "SIN / Identifier" | "LinkedIn URL";
  placeholder: string;
  count: number;
}

export interface PiiRedactionResult {
  originalLength: number;
  redactedText: string;
  totalRedacted: number;
  matches: PiiRedactionMatch[];
}

export interface TruthfulBulletSuggestion {
  skill: string;
  status: "evidence-found" | "needs-confirmation";
  templateBullet: string;
  userGuidance: string;
}

export interface FitCheckEvaluation {
  headlineVerdict: string;
  reasoningSummary: string;
  strongAlignment: string[];
  worthStrengthening: string[];
  piiReport: PiiRedactionResult;
  truthfulSuggestions: TruthfulBulletSuggestion[];
}

/* ============================================================================
 * PHASE 2–6 EVOLUTION MODELS: SCOUTS, AUTH, INVITES, TELEGRAM LINK, LEGAL
 * ========================================================================== */

export interface IncomingSignalBatchEvent {
  batchId: string;
  count: number;
  headline: string;
  triggeredAt: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: "founder" | "member";
  sessionMode: "demo-preview" | "live-session";
  telegramLinked: boolean;
  telegramHandle?: string;
  telegramLinkedAt?: string;
}

export interface AccessRequestRecord {
  id: string;
  email: string;
  careerStage: string;
  roleInterest: string;
  preferredLocations: string;
  goalsContext: string;
  status: "pending" | "approved" | "declined";
  createdAt: string;
  reviewedAt?: string;
  invitationId?: string;
}

export interface InvitationKeyRecord {
  id: string;
  recipientEmail: string;
  role: "member" | "founder";
  keyPreview: string; // e.g. "acrn_inv_7f9a...c412" (full token shown only once on creation)
  tokenHash: string;
  status: "active" | "redeemed" | "revoked" | "expired";
  expiresAt: string;
  createdAt: string;
  redeemedAt?: string;
}

export interface TelegramLinkSession {
  linkToken: string;
  botHandle: string;
  deepLinkUrl: string;
  expiresAt: string;
  status: "pending" | "confirmed" | "expired" | "unlinked";
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action:
    | "ACCESS_REQUEST_APPROVED"
    | "ACCESS_REQUEST_DECLINED"
    | "INVITE_CREATED"
    | "INVITE_REDEEMED"
    | "INVITE_REVOKED"
    | "TELEGRAM_LINK_STARTED"
    | "TELEGRAM_LINK_CONFIRMED"
    | "TELEGRAM_UNLINKED"
    | "FOUNDER_LOGIN";
  target: string;
}

export type LegalModalDocument = "privacy" | "terms" | "cookies" | "contact" | null;
