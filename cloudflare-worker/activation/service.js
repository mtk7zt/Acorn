/**
 * Acorn Beta Activation Service
 * Coordinates cryptographic key issuance, atomic redemption, and grant lifecycles.
 */

import { generateActivationKey, computeKeyHash, isValidKeyFormat } from "./crypto.js";
import { ActivationRepository } from "./repository.js";

export class ActivationService {
  constructor(env) {
    this.env = env;
    this.repo = new ActivationRepository(env.ACORN_DB, env.CHAT_HISTORY);
    this.pepper = env.ACTIVATION_PEPPER || env.TELEGRAM_SECRET_TOKEN || "acorn_default_pepper_v2";
  }

  /**
   * Generates a new Type A (single-use) or Type B (capacity-limited) activation key.
   * Returns the raw key string EXACTLY ONCE to the caller.
   */
  async createKey({
    label,
    capacity = 1,
    redeemExpiresDays = 14,
    accessExpiresDays = null,
    createdBy = "founder",
  }) {
    const safeCapacity = Math.max(1, Math.min(parseInt(capacity, 10) || 1, 1000));
    const rawKey = generateActivationKey();
    const keyHash = await computeKeyHash(rawKey, this.pepper);
    const keyId = `key_${crypto.randomUUID()}`;

    const redeemExpiresAt = redeemExpiresDays
      ? new Date(Date.now() + redeemExpiresDays * 86400 * 1000).toISOString()
      : null;

    const accessExpiresAt = accessExpiresDays
      ? new Date(Date.now() + accessExpiresDays * 86400 * 1000).toISOString()
      : null;

    await this.repo.createKey({
      id: keyId,
      label: String(label || "Acorn Beta Key").slice(0, 100),
      keyHash,
      maxRedemptions: safeCapacity,
      createdBy,
      redeemExpiresAt,
      accessExpiresAt,
    });

    return {
      keyId,
      rawKey,
      label,
      capacity: safeCapacity,
      redeemExpiresAt,
      accessExpiresAt,
    };
  }

  /**
   * Atomically validates and redeems a submitted key.
   */
  async redeemKey(rawKey, telegramUserId) {
    if (!isValidKeyFormat(rawKey)) {
      return { success: false, reason: "INVALID_FORMAT" };
    }

    const keyHash = await computeKeyHash(rawKey, this.pepper);
    return this.repo.atomicRedeemKey(keyHash, telegramUserId);
  }

  /**
   * Directly authorizes a Telegram user ID without requiring an activation key.
   */
  async grantAccessDirect(telegramUserId, actorId) {
    return this.repo.grantAccessDirect(telegramUserId, actorId, "tester");
  }

  /**
   * Revokes user access.
   */
  async revokeUser(telegramUserId, actorId) {
    return this.repo.revokeUser(telegramUserId, actorId);
  }

  /**
   * Revokes future redemptions on an activation key.
   */
  async revokeKey(keyId, actorId) {
    return this.repo.revokeKey(keyId, actorId);
  }

  /**
   * Lists active keys for founder inspection.
   */
  async listKeys(limit = 20) {
    return this.repo.listKeys(limit);
  }

  /**
   * Fetches tester overview counts.
   */
  async getTesterStats() {
    return this.repo.getTesterStats();
  }
}
