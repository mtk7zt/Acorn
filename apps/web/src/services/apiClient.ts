import { ACORN_API_BASE_URL, DEMO_MODE } from "../config/env";
import {
  AccessRequestRecord,
  AuditLogEntry,
  AuthenticatedUser,
  InvitationKeyRecord,
  OpportunitySignal,
  TelegramLinkSession,
  WatchPreferencesModel,
} from "../types/acorn";

export class AcornApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly isOfflineOrUnconfigured: boolean = false
  ) {
    super(message);
    this.name = "AcornApiError";
  }
}

/**
 * Computes SHA-256 hex digest in browser Web Crypto API so raw invitation keys
 * are never stored in plain text.
 */
export async function sha256HexBrowser(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input.trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generates a cryptographically random single-use invitation key or linking token.
 */
export function generateCryptographicToken(prefix: "acrn_inv" | "acrn_tg"): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}_${hex}`;
}

async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 8000
): Promise<T> {
  if (!ACORN_API_BASE_URL) {
    throw new AcornApiError(
      "VITE_ACORN_API_BASE_URL is not configured for live backend requests.",
      503,
      true
    );
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${ACORN_API_BASE_URL.replace(/\/$/, "")}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new AcornApiError(
        errBody.error || `API request failed with HTTP ${res.status}`,
        res.status
      );
    }

    return (await res.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Typed Acorn API Client (/api/v1/*)
 * CRITICAL PRODUCTION RULE:
 * When DEMO_MODE is false, API failures throw explicit errors and NEVER silently
 * fall back to fabricated opportunities.
 */
export const acornApiClient = {
  isDemoMode(): boolean {
    return DEMO_MODE;
  },

  async getMe(): Promise<AuthenticatedUser> {
    return requestJson<AuthenticatedUser>("/api/v1/me");
  },

  async getSignals(): Promise<{ signals: OpportunitySignal[] }> {
    return requestJson<{ signals: OpportunitySignal[] }>("/api/v1/signals");
  },

  async updateSignalStatus(
    signalId: string,
    status: OpportunitySignal["status"]
  ): Promise<{ ok: boolean }> {
    return requestJson<{ ok: boolean }>(`/api/v1/signals/${encodeURIComponent(signalId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  async updatePreferences(
    preferences: Partial<WatchPreferencesModel>
  ): Promise<{ ok: boolean; preferences: WatchPreferencesModel }> {
    return requestJson<{ ok: boolean; preferences: WatchPreferencesModel }>(
      "/api/v1/preferences",
      {
        method: "PATCH",
        body: JSON.stringify(preferences),
      }
    );
  },

  async redeemInvitation(
    invitationKey: string,
    email: string,
    displayName: string
  ): Promise<{ user: AuthenticatedUser }> {
    return requestJson<{ user: AuthenticatedUser }>("/api/v1/invitations/redeem", {
      method: "POST",
      body: JSON.stringify({ invitationKey: invitationKey.trim(), email, displayName }),
    });
  },

  async startTelegramLink(): Promise<TelegramLinkSession> {
    return requestJson<TelegramLinkSession>("/api/v1/telegram/link/start", {
      method: "POST",
    });
  },

  async unlinkTelegram(): Promise<{ ok: boolean }> {
    return requestJson<{ ok: boolean }>("/api/v1/telegram/link", {
      method: "DELETE",
    });
  },

  async listAdminAccessRequests(): Promise<{ requests: AccessRequestRecord[] }> {
    return requestJson<{ requests: AccessRequestRecord[] }>(
      "/api/v1/admin/access-requests"
    );
  },

  async createAdminInvitation(input: {
    recipientEmail: string;
    expiresInHours: number;
  }): Promise<{ invitation: InvitationKeyRecord; rawKeyOnce: string; audit: AuditLogEntry }> {
    return requestJson("/api/v1/admin/invitations", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async revokeAdminInvitation(invitationId: string): Promise<{ ok: boolean }> {
    return requestJson(
      `/api/v1/admin/invitations/${encodeURIComponent(invitationId)}/revoke`,
      { method: "POST" }
    );
  },
};
