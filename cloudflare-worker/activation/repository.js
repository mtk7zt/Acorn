/**
 * Acorn Beta Activation Repository (D1 & KV Engine)
 * Manages atomic capacity reservations, access grants, and audit events.
 */

export class ActivationRepository {
  constructor(db, kv) {
    this.db = db;
    this.kv = kv;
  }

  /**
   * Resolves active user grant for a Telegram user ID.
   */
  async getAccessGrant(telegramUserId) {
    const tgIdStr = String(telegramUserId).trim();
    if (!tgIdStr) return null;

    // 1. Try D1 if bound
    if (this.db) {
      try {
        const row = await this.db
          .prepare(
            `SELECT id, telegram_user_id, role, status, grant_source, expires_at, revoked_at
             FROM user_access_grants
             WHERE telegram_user_id = ?1`
          )
          .bind(tgIdStr)
          .first();

        if (row) {
          // Check expiration
          if (row.expires_at && new Date(row.expires_at) < new Date()) {
            return { ...row, status: "expired" };
          }
          return row;
        }
      } catch (err) {
        console.warn("D1 getAccessGrant failed, falling back to KV:", err?.message || err);
      }
    }

    // 2. Fallback to KV cache
    if (this.kv) {
      try {
        const cached = await this.kv.get(`grant:${tgIdStr}`, "json");
        if (cached) {
          if (cached.expires_at && new Date(cached.expires_at) < new Date()) {
            return { ...cached, status: "expired" };
          }
          return cached;
        }
      } catch (err) {
        console.warn("KV getAccessGrant failed:", err?.message || err);
      }
    }

    return null;
  }

  /**
   * Inserts an activation key record.
   */
  async createKey({
    id,
    label,
    keyHash,
    maxRedemptions = 1,
    createdBy,
    redeemExpiresAt = null,
    accessExpiresAt = null,
  }) {
    if (this.db) {
      await this.db
        .prepare(
          `INSERT INTO activation_keys (
             id, label, key_hash, max_redemptions, redemption_count, created_by,
             redeem_expires_at, access_expires_at
           ) VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?7)`
        )
        .bind(
          id,
          label,
          keyHash,
          maxRedemptions,
          createdBy,
          redeemExpiresAt,
          accessExpiresAt
        )
        .run();
    }

    if (this.kv) {
      await this.kv.put(
        `key:${keyHash}`,
        JSON.stringify({
          id,
          label,
          maxRedemptions,
          redemptionCount: 0,
          createdBy,
          redeemExpiresAt,
          accessExpiresAt,
          revokedAt: null,
        })
      );
    }
  }

  /**
   * Atomically redeems a key for a Telegram user with strict capacity checks.
   */
  async atomicRedeemKey(keyHash, telegramUserId) {
    const tgId = String(telegramUserId).trim();
    const nowIso = new Date().toISOString();

    if (this.db) {
      // Step A: Fetch key details
      const keyRow = await this.db
        .prepare(
          `SELECT id, label, max_redemptions, redemption_count, redeem_expires_at, access_expires_at, revoked_at
           FROM activation_keys
           WHERE key_hash = ?1`
        )
        .bind(keyHash)
        .first();

      if (!keyRow) {
        return { success: false, reason: "NOT_FOUND" };
      }
      if (keyRow.revoked_at) {
        return { success: false, reason: "KEY_REVOKED" };
      }
      if (keyRow.redeem_expires_at && new Date(keyRow.redeem_expires_at) < new Date()) {
        return { success: false, reason: "KEY_EXPIRED" };
      }
      if (keyRow.redemption_count >= keyRow.max_redemptions) {
        return { success: false, reason: "CAPACITY_EXHAUSTED" };
      }

      // Step B: Check if this user already redeemed this key
      const priorRedemption = await this.db
        .prepare(
          `SELECT id FROM activation_redemptions
           WHERE activation_key_id = ?1 AND telegram_user_id = ?2`
        )
        .bind(keyRow.id, tgId)
        .first();

      if (priorRedemption) {
        return { success: true, alreadyRedeemed: true, keyId: keyRow.id };
      }

      // Step C: Check if user already has an active grant
      const existingGrant = await this.db
        .prepare(
          `SELECT id, status FROM user_access_grants WHERE telegram_user_id = ?1`
        )
        .bind(tgId)
        .first();

      if (existingGrant && existingGrant.status === "active") {
        return { success: true, alreadyActive: true, keyId: keyRow.id };
      }
      if (existingGrant && existingGrant.status === "revoked") {
        return { success: false, reason: "USER_REVOKED_REQUIRES_FOUNDER" };
      }

      const grantId = `grnt_${crypto.randomUUID()}`;
      const redempId = `rdm_${crypto.randomUUID()}`;
      const auditId = `aud_${crypto.randomUUID()}`;

      // Step D: Execute atomic batch mutation with conditional counter increment
      const results = await this.db.batch([
        // 1. Conditional counter increment (guarantees capacity never oversubscribes)
        this.db
          .prepare(
            `UPDATE activation_keys
             SET redemption_count = redemption_count + 1
             WHERE id = ?1 AND redemption_count < max_redemptions AND revoked_at IS NULL`
          )
          .bind(keyRow.id),

        // 2. Record individual user redemption
        this.db
          .prepare(
            `INSERT INTO activation_redemptions (id, activation_key_id, telegram_user_id)
             VALUES (?1, ?2, ?3)`
          )
          .bind(redempId, keyRow.id, tgId),

        // 3. Create or replace active user access grant
        this.db
          .prepare(
            `INSERT INTO user_access_grants (
               id, telegram_user_id, role, status, grant_source, activation_key_id, granted_at, expires_at
             ) VALUES (?1, ?2, 'tester', 'active', 'activation_key', ?3, ?4, ?5)
             ON CONFLICT(telegram_user_id) DO UPDATE SET
               status = 'active',
               grant_source = 'activation_key',
               activation_key_id = excluded.activation_key_id,
               granted_at = excluded.granted_at,
               expires_at = excluded.expires_at,
               revoked_at = NULL,
               revoked_by = NULL`
          )
          .bind(grantId, tgId, keyRow.id, nowIso, keyRow.access_expires_at),

        // 4. Record audit event
        this.db
          .prepare(
            `INSERT INTO activation_audit_events (id, event_type, actor_id, subject_id, activation_key_id)
             VALUES (?1, 'KEY_REDEEMED', ?2, ?2, ?3)`
          )
          .bind(auditId, tgId, keyRow.id),
      ]);

      // Verify the first statement affected 1 row
      const updateResult = results[0];
      if (updateResult.meta && updateResult.meta.changes === 0) {
        return { success: false, reason: "CONCURRENT_CAPACITY_EXHAUSTED" };
      }

      // Sync to KV cache
      if (this.kv) {
        await this.kv.put(
          `grant:${tgId}`,
          JSON.stringify({
            id: grantId,
            telegram_user_id: tgId,
            role: "tester",
            status: "active",
            grant_source: "activation_key",
            activation_key_id: keyRow.id,
            expires_at: keyRow.access_expires_at,
          })
        );
      }

      return {
        success: true,
        keyId: keyRow.id,
        label: keyRow.label,
        accessExpiresAt: keyRow.access_expires_at,
      };
    }

    // KV-only fallback for testing or non-D1 runtimes
    if (this.kv) {
      const keyData = await this.kv.get(`key:${keyHash}`, "json");
      if (!keyData) return { success: false, reason: "NOT_FOUND" };
      if (keyData.revokedAt) return { success: false, reason: "KEY_REVOKED" };
      if (keyData.redeemExpiresAt && new Date(keyData.redeemExpiresAt) < new Date()) {
        return { success: false, reason: "KEY_EXPIRED" };
      }
      if (keyData.redemptionCount >= keyData.maxRedemptions) {
        return { success: false, reason: "CAPACITY_EXHAUSTED" };
      }

      keyData.redemptionCount += 1;
      await this.kv.put(`key:${keyHash}`, JSON.stringify(keyData));

      const grant = {
        id: `grnt_${crypto.randomUUID()}`,
        telegram_user_id: tgId,
        role: "tester",
        status: "active",
        grant_source: "activation_key",
        activation_key_id: keyData.id,
        expires_at: keyData.accessExpiresAt,
      };
      await this.kv.put(`grant:${tgId}`, JSON.stringify(grant));

      return {
        success: true,
        keyId: keyData.id,
        label: keyData.label,
        accessExpiresAt: keyData.accessExpiresAt,
      };
    }

    return { success: false, reason: "NO_STORAGE_AVAILABLE" };
  }

  /**
   * Directly grants access to a Telegram user (Founder action).
   */
  async grantAccessDirect(telegramUserId, actorId, role = "tester") {
    const tgId = String(telegramUserId).trim();
    const grantId = `grnt_${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();

    if (this.db) {
      await this.db
        .prepare(
          `INSERT INTO user_access_grants (
             id, telegram_user_id, role, status, grant_source, granted_at
           ) VALUES (?1, ?2, ?3, 'active', 'founder_direct', ?4)
           ON CONFLICT(telegram_user_id) DO UPDATE SET
             status = 'active',
             role = excluded.role,
             grant_source = 'founder_direct',
             granted_at = excluded.granted_at,
             revoked_at = NULL,
             revoked_by = NULL`
        )
        .bind(grantId, tgId, role, nowIso)
        .run();

      await this.db
        .prepare(
          `INSERT INTO activation_audit_events (id, event_type, actor_id, subject_id)
           VALUES (?1, 'ACCESS_GRANTED', ?2, ?3)`
        )
        .bind(`aud_${crypto.randomUUID()}`, actorId, tgId)
        .run();
    }

    if (this.kv) {
      await this.kv.put(
        `grant:${tgId}`,
        JSON.stringify({
          id: grantId,
          telegram_user_id: tgId,
          role,
          status: "active",
          grant_source: "founder_direct",
        })
      );
    }

    return { ok: true, telegramUserId: tgId, role };
  }

  /**
   * Revokes an existing user's access.
   */
  async revokeUser(telegramUserId, actorId) {
    const tgId = String(telegramUserId).trim();
    const nowIso = new Date().toISOString();

    if (this.db) {
      await this.db
        .prepare(
          `UPDATE user_access_grants
           SET status = 'revoked', revoked_at = ?1, revoked_by = ?2
           WHERE telegram_user_id = ?3`
        )
        .bind(nowIso, actorId, tgId)
        .run();

      await this.db
        .prepare(
          `INSERT INTO activation_audit_events (id, event_type, actor_id, subject_id)
           VALUES (?1, 'ACCESS_REVOKED', ?2, ?3)`
        )
        .bind(`aud_${crypto.randomUUID()}`, actorId, tgId)
        .run();
    }

    if (this.kv) {
      await this.kv.put(
        `grant:${tgId}`,
        JSON.stringify({
          telegram_user_id: tgId,
          status: "revoked",
          revoked_at: nowIso,
          revoked_by: actorId,
        })
      );
    }

    return { ok: true };
  }

  /**
   * Revokes an activation key from future redemptions.
   */
  async revokeKey(keyId, actorId) {
    const nowIso = new Date().toISOString();
    if (this.db) {
      await this.db
        .prepare(
          `UPDATE activation_keys
           SET revoked_at = ?1, revoked_by = ?2
           WHERE id = ?3`
        )
        .bind(nowIso, actorId, keyId)
        .run();

      await this.db
        .prepare(
          `INSERT INTO activation_audit_events (id, event_type, actor_id, subject_id, activation_key_id)
           VALUES (?1, 'KEY_REVOKED', ?2, ?3, ?3)`
        )
        .bind(`aud_${crypto.randomUUID()}`, actorId, keyId)
        .run();
    }

    return { ok: true };
  }

  /**
   * Lists active keys for founder inspection.
   */
  async listKeys(limit = 20) {
    if (!this.db) return [];
    const { results } = await this.db
      .prepare(
        `SELECT id, label, max_redemptions, redemption_count, created_at,
                redeem_expires_at, access_expires_at, revoked_at
         FROM activation_keys
         ORDER BY created_at DESC
         LIMIT ?1`
      )
      .bind(limit)
      .all();
    return results || [];
  }

  /**
   * Gets tester overview counts for founder.
   */
  async getTesterStats() {
    if (!this.db) {
      return { activeTesters: 0, revokedTesters: 0, totalCapacity: 0, redeemedCapacity: 0 };
    }

    const [grants, keys] = await Promise.all([
      this.db
        .prepare(
          `SELECT
             COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
             COUNT(CASE WHEN status = 'revoked' THEN 1 END) as revoked_count,
             COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_count
           FROM user_access_grants`
        )
        .first(),
      this.db
        .prepare(
          `SELECT
             SUM(max_redemptions) as total_cap,
             SUM(redemption_count) as used_cap
           FROM activation_keys
           WHERE revoked_at IS NULL`
        )
        .first(),
    ]);

    return {
      activeTesters: grants?.active_count || 0,
      revokedTesters: grants?.revoked_count || 0,
      expiredTesters: grants?.expired_count || 0,
      totalCapacity: keys?.total_cap || 0,
      redeemedCapacity: keys?.used_cap || 0,
    };
  }
}
