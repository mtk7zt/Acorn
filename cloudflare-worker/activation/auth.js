/**
 * Central Authorization Guard (Zero-Trust Tiered Access)
 * Enforces access controls across all Telegram updates:
 *   1. Verified Founder (Full administrative & feature access)
 *   2. Active Beta Tester (Full opportunity tracking & ATS access)
 *   3. Public Onboarding (/start, /activate, /about)
 *   4. Revoked / Unauthorized (DENY)
 */

import { ActivationRepository } from "./repository.js";

export const AuthRole = {
  FOUNDER: "FOUNDER",
  TESTER: "TESTER",
  PUBLIC: "PUBLIC",
  UNAUTHORIZED: "UNAUTHORIZED",
  REVOKED: "REVOKED",
};

/**
 * Checks whether a Telegram sender is the verified founder.
 */
export function isFounder(chatId, env) {
  const tgIdStr = String(chatId).trim();
  if (!tgIdStr) return false;

  // 1. Explicit Founder ID
  const founderId = env.ACORN_FOUNDER_TELEGRAM_ID || env.TELEGRAM_CHAT_ID;
  if (founderId && String(founderId).trim() === tgIdStr) {
    return true;
  }

  // 2. Allowlist matching
  const allowlistRaw = env.ALLOWED_CHAT_IDS || env.ALLOWED_CHAT_ID || "";
  const allowed = allowlistRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (allowed.length > 0 && allowed[0] === tgIdStr) {
    return true;
  }

  return false;
}

/**
 * Resolves the authorization role of an inbound Telegram user.
 */
export async function resolveAuthRole(chatId, env) {
  const tgIdStr = String(chatId).trim();
  if (!tgIdStr) return AuthRole.UNAUTHORIZED;

  // 1. Founder bypass
  if (isFounder(tgIdStr, env)) {
    return AuthRole.FOUNDER;
  }

  // 2. Static Allowlist (backward compatibility / legacy allowlist)
  const allowlistRaw = env.ALLOWED_CHAT_IDS || env.ALLOWED_CHAT_ID || "";
  const allowedSet = new Set(
    allowlistRaw.split(",").map((s) => s.trim()).filter(Boolean)
  );
  if (allowedSet.has(tgIdStr)) {
    return AuthRole.TESTER;
  }

  // 3. Dynamic Beta User Grant (D1 / KV)
  const repo = new ActivationRepository(env.ACORN_DB, env.CHAT_HISTORY);
  const grant = await repo.getAccessGrant(tgIdStr);

  if (grant) {
    if (grant.status === "revoked") {
      return AuthRole.REVOKED;
    }
    if (grant.status === "active") {
      return AuthRole.TESTER;
    }
    if (grant.status === "expired") {
      return AuthRole.UNAUTHORIZED;
    }
  }

  return AuthRole.UNAUTHORIZED;
}
