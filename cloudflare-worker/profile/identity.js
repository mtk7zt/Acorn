/**
 * Acorn Canonical User Identity Management
 * ========================================
 * Maps external provider identities (Telegram, Web, Mobile) to immutable
 * internal Acorn users (usr_<uuid>) ensuring transport-independent identity.
 */

export class IdentityService {
  constructor(env) {
    this.env = env;
  }

  /**
   * Resolves or provisions a canonical Acorn user from a verified Telegram identity.
   * @param {string|number} telegramId - Verified Telegram Chat/User ID
   * @returns {Promise<{ acornUserId: string, isNew: boolean }>}
   */
  async getOrCreateUserByTelegram(telegramId) {
    const tgIdStr = String(telegramId).trim();
    if (!tgIdStr) {
      throw new Error("Invalid Telegram identifier provided for identity resolution");
    }

    const db = this.env.ACORN_DB;
    const now = new Date().toISOString();

    // 1. In-memory/local mock mode if D1 is unconfigured
    if (!db) {
      const mockId = `usr_mock_${tgIdStr}`;
      return { acornUserId: mockId, isNew: false };
    }

    // 2. Check for existing mapping
    const existing = await db
      .prepare(
        "SELECT acorn_user_id FROM user_external_identities WHERE provider = ? AND provider_user_id = ?"
      )
      .bind("telegram", tgIdStr)
      .first();

    if (existing && existing.acorn_user_id) {
      return { acornUserId: existing.acorn_user_id, isNew: false };
    }

    // 3. Create canonical user and external identity binding atomically
    const acornUserId = `usr_${crypto.randomUUID().replace(/-/g, "")}`;
    const profileId = crypto.randomUUID();
    const bindingId = crypto.randomUUID();
    const prefId = crypto.randomUUID();

    const batch = [
      db
        .prepare("INSERT INTO acorn_users (id, status, created_at, updated_at) VALUES (?, ?, ?, ?)")
        .bind(acornUserId, "active", now, now),
      db
        .prepare(
          "INSERT INTO user_external_identities (id, acorn_user_id, provider, provider_user_id, verified_at, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(bindingId, acornUserId, "telegram", tgIdStr, now, now),
      db
        .prepare(
          "INSERT INTO user_profiles (id, acorn_user_id, career_stage, experience_level, onboarding_status, schema_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(profileId, acornUserId, "mid", "mid", "pending", "1.0", now, now),
      db
        .prepare(
          "INSERT INTO user_search_preferences (id, acorn_user_id, preferred_locations, work_arrangement, seniority, employment_types, min_salary, skills, notification_cadence, timezone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          prefId,
          acornUserId,
          JSON.stringify(["Toronto", "Remote"]),
          "any",
          "any",
          JSON.stringify(["full_time"]),
          0,
          JSON.stringify([]),
          "instant",
          "America/Toronto",
          now,
          now
        ),
    ];

    await db.batch(batch);

    return { acornUserId, isNew: true };
  }
}
