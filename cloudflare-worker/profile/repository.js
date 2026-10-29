/**
 * Acorn User Profile & Portability Repository
 * ===========================================
 * Handles per-user career profiles, target roles, search preferences,
 * scan request tracking, and portable export/import operations on Cloudflare D1.
 */

export class ProfileRepository {
  constructor(env) {
    this.env = env;
  }

  async getProfile(acornUserId) {
    const db = this.env.ACORN_DB;
    if (!db) return null;
    return db
      .prepare("SELECT * FROM user_profiles WHERE acorn_user_id = ?")
      .bind(acornUserId)
      .first();
  }

  async setOnboardingStatus(acornUserId, status) {
    const db = this.env.ACORN_DB;
    if (!db) return;
    const now = new Date().toISOString();
    await db
      .prepare("UPDATE user_profiles SET onboarding_status = ?, updated_at = ? WHERE acorn_user_id = ?")
      .bind(status, now, acornUserId)
      .run();
  }

  async getUserRoles(acornUserId) {
    const db = this.env.ACORN_DB;
    if (!db) return [];
    const { results } = await db
      .prepare(
        "SELECT role_title, normalized_role, priority FROM user_target_roles WHERE acorn_user_id = ? ORDER BY priority ASC, created_at ASC"
      )
      .bind(acornUserId)
      .all();
    return results || [];
  }

  async setUserRoles(acornUserId, rolesArray) {
    const db = this.env.ACORN_DB;
    if (!db) return;
    const now = new Date().toISOString();

    const statements = [
      db.prepare("DELETE FROM user_target_roles WHERE acorn_user_id = ?").bind(acornUserId),
    ];

    for (let i = 0; i < rolesArray.length; i++) {
      const rawTitle = rolesArray[i].trim();
      if (!rawTitle) continue;
      const normalized = rawTitle.toLowerCase();
      const roleId = crypto.randomUUID();
      statements.push(
        db
          .prepare(
            "INSERT INTO user_target_roles (id, acorn_user_id, role_title, normalized_role, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
          )
          .bind(roleId, acornUserId, rawTitle, normalized, i + 1, now, now)
      );
    }

    if (rolesArray.length > 0) {
      statements.push(
        db
          .prepare("UPDATE user_profiles SET onboarding_status = 'completed', updated_at = ? WHERE acorn_user_id = ?")
          .bind(now, acornUserId)
      );
    }

    await db.batch(statements);
  }

  async getSearchPreferences(acornUserId) {
    const db = this.env.ACORN_DB;
    if (!db) {
      return {
        preferred_locations: ["Toronto", "Remote"],
        work_arrangement: "any",
        seniority: "any",
        employment_types: ["full_time"],
        min_salary: 0,
        skills: [],
        notification_cadence: "instant",
      };
    }
    const row = await db
      .prepare("SELECT * FROM user_search_preferences WHERE acorn_user_id = ?")
      .bind(acornUserId)
      .first();

    if (!row) return null;

    return {
      preferred_locations: JSON.parse(row.preferred_locations || '["Toronto", "Remote"]'),
      work_arrangement: row.work_arrangement || "any",
      seniority: row.seniority || "any",
      employment_types: JSON.parse(row.employment_types || '["full_time"]'),
      min_salary: row.min_salary || 0,
      skills: JSON.parse(row.skills || '[]'),
      notification_cadence: row.notification_cadence || "instant",
      timezone: row.timezone || "America/Toronto",
    };
  }

  async updateSearchPreferences(acornUserId, updates) {
    const db = this.env.ACORN_DB;
    if (!db) return;
    const now = new Date().toISOString();
    const current = (await this.getSearchPreferences(acornUserId)) || {};
    const merged = { ...current, ...updates };

    await db
      .prepare(
        `INSERT INTO user_search_preferences (
          id, acorn_user_id, preferred_locations, work_arrangement, seniority, 
          employment_types, min_salary, skills, notification_cadence, timezone, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(acorn_user_id) DO UPDATE SET
          preferred_locations = excluded.preferred_locations,
          work_arrangement = excluded.work_arrangement,
          seniority = excluded.seniority,
          employment_types = excluded.employment_types,
          min_salary = excluded.min_salary,
          skills = excluded.skills,
          notification_cadence = excluded.notification_cadence,
          timezone = excluded.timezone,
          updated_at = excluded.updated_at`
      )
      .bind(
        crypto.randomUUID(),
        acornUserId,
        JSON.stringify(merged.preferred_locations),
        merged.work_arrangement,
        merged.seniority,
        JSON.stringify(merged.employment_types),
        merged.min_salary,
        JSON.stringify(merged.skills),
        merged.notification_cadence,
        merged.timezone || "America/Toronto",
        now,
        now
      )
      .run();
  }

  async recordScanRequest({ acornUserId, correlationId, recipientAddress }) {
    const db = this.env.ACORN_DB;
    if (!db) return null;
    const scanId = `scn_${crypto.randomUUID().replace(/-/g, "")}`;
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO user_scan_requests (
          id, acorn_user_id, status, preferences_version, correlation_id, 
          recipient_channel, recipient_address, requested_at
        ) VALUES (?, ?, 'pending', 1, ?, 'telegram', ?, ?)`
      )
      .bind(scanId, acornUserId, correlationId, String(recipientAddress), now)
      .run();
    return scanId;
  }

  async getResumeMetadata(acornUserId) {
    const db = this.env.ACORN_DB;
    if (!db) return null;
    return db
      .prepare("SELECT * FROM user_resume_assets WHERE acorn_user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1")
      .bind(acornUserId)
      .first();
  }

  async deleteResume(acornUserId) {
    const db = this.env.ACORN_DB;
    if (!db) return;
    const now = new Date().toISOString();
    await db
      .prepare("UPDATE user_resume_assets SET deleted_at = ?, updated_at = ? WHERE acorn_user_id = ? AND deleted_at IS NULL")
      .bind(now, now, acornUserId)
      .run();
  }

  /**
   * Generates a portable, versioned Acorn profile export document (acorn-profile v1.0).
   */
  async exportProfile(acornUserId) {
    const profile = await this.getProfile(acornUserId);
    const roles = await this.getUserRoles(acornUserId);
    const prefs = await this.getSearchPreferences(acornUserId);
    const resume = await this.getResumeMetadata(acornUserId);

    return {
      format: "acorn-profile",
      schema_version: "1.0",
      exported_at: new Date().toISOString(),
      acorn_user_id: acornUserId,
      profile: {
        career_stage: profile?.career_stage || "mid",
        experience_level: profile?.experience_level || "mid",
        onboarding_status: profile?.onboarding_status || "completed",
      },
      target_roles: roles.map((r) => ({
        role_title: r.role_title,
        priority: r.priority,
      })),
      search_preferences: prefs || {},
      resume_manifest: resume
        ? [
            {
              id: resume.id,
              content_type: resume.content_type,
              file_size: resume.file_size,
              checksum: resume.checksum,
              security_status: resume.security_status,
              created_at: resume.created_at,
            },
          ]
        : [],
    };
  }

  /**
   * Imports an acorn-profile v1.0 export into the user's account safely.
   */
  async importProfile(acornUserId, profileData) {
    if (!profileData || profileData.format !== "acorn-profile" || profileData.schema_version !== "1.0") {
      throw new Error("Invalid or unsupported acorn-profile format");
    }

    if (Array.isArray(profileData.target_roles) && profileData.target_roles.length > 0) {
      const titles = profileData.target_roles.map((r) => r.role_title || r).filter(Boolean);
      await this.setUserRoles(acornUserId, titles);
    }

    if (profileData.search_preferences) {
      await this.updateSearchPreferences(acornUserId, profileData.search_preferences);
    }

    return { success: true };
  }
}
