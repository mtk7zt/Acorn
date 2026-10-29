/**
 * Acorn AI — Cloudflare Worker /api/v1/* REST Router
 * Coexists alongside the existing Telegram webhook handler in cloudflare-worker/index.js.
 * Requires D1 binding `ACORN_DB` and KV binding `CHAT_HISTORY`.
 */

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text.trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function jsonResponse(body, status = 200, origin = "*") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

async function getAuthenticatedUser(request, env) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/acorn_session=([a-zA-Z0-9_-]+)/);
  const bearer = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const rawToken = match?.[1] || bearer;
  if (!rawToken || !env.ACORN_DB) return null;

  const sessionHash = await sha256Hex(rawToken);
  const nowIso = new Date().toISOString();

  const row = await env.ACORN_DB.prepare(
    `SELECT u.id, u.email, u.display_name, u.role, u.telegram_chat_id, u.telegram_handle, u.telegram_linked_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.session_id_hash = ?1 AND s.expires_at > ?2`
  )
    .bind(sessionHash, nowIso)
    .first();

  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    sessionMode: "live-session",
    telegramLinked: Boolean(row.telegram_chat_id),
    telegramHandle: row.telegram_handle || undefined,
    telegramLinkedAt: row.telegram_linked_at || undefined,
  };
}

export async function handleAcornApiV1(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin") || "*";

  if (request.method === "OPTIONS") {
    return jsonResponse({ ok: true }, 200, origin);
  }

  // 1. Public endpoint: POST /api/v1/access-requests
  if (url.pathname === "/api/v1/access-requests" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body?.email || !String(body.email).includes("@")) {
      return jsonResponse({ error: "Valid email is required." }, 400, origin);
    }
    const id = `req_${crypto.randomUUID()}`;
    if (env.ACORN_DB) {
      await env.ACORN_DB.prepare(
        `INSERT INTO access_requests (id, email, career_stage, role_interest, preferred_locations, goals_context)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
      )
        .bind(
          id,
          String(body.email).trim().toLowerCase(),
          String(body.careerStage || "Candidate").slice(0, 120),
          String(body.roleInterest || "").slice(0, 200),
          String(body.preferredLocations || "Canada").slice(0, 160),
          String(body.goalsContext || "").slice(0, 500)
        )
        .run();
    }
    return jsonResponse({ ok: true, id }, 201, origin);
  }

  // 2. Public endpoint: POST /api/v1/invitations/redeem
  if (url.pathname === "/api/v1/invitations/redeem" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    const rawKey = String(body?.invitationKey || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const displayName = String(body?.displayName || "Member").trim();

    if (!rawKey.startsWith("acrn_inv_") || !email.includes("@")) {
      return jsonResponse({ error: "Invalid invitation key or email." }, 400, origin);
    }

    const tokenHash = await sha256Hex(rawKey);
    const nowIso = new Date().toISOString();

    const inv = await env.ACORN_DB.prepare(
      `SELECT id, role, status, expires_at FROM invitations WHERE token_hash = ?1`
    )
      .bind(tokenHash)
      .first();

    if (!inv || inv.status !== "active" || inv.expires_at <= nowIso) {
      return jsonResponse({ error: "Invitation key is invalid, expired, or already used." }, 403, origin);
    }

    const userId = `usr_${crypto.randomUUID()}`;
    await env.ACORN_DB.batch([
      env.ACORN_DB.prepare(
        `INSERT INTO users (id, email, display_name, role) VALUES (?1, ?2, ?3, ?4)`
      ).bind(userId, email, displayName, inv.role),
      env.ACORN_DB.prepare(
        `UPDATE invitations SET status = 'redeemed', redeemed_by_user_id = ?1, redeemed_at = ?2 WHERE id = ?3`
      ).bind(userId, nowIso, inv.id),
      env.ACORN_DB.prepare(
        `INSERT INTO audit_logs (id, actor_email, action, target) VALUES (?1, ?2, 'INVITE_REDEEMED', ?3)`
      ).bind(`aud_${crypto.randomUUID()}`, email, inv.id),
    ]);

    return jsonResponse(
      {
        user: {
          id: userId,
          email,
          displayName,
          role: inv.role,
          sessionMode: "live-session",
          telegramLinked: false,
        },
      },
      200,
      origin
    );
  }

  // All remaining /api/v1/* endpoints require an authenticated user
  const user = await getAuthenticatedUser(request, env);
  if (!user) {
    return jsonResponse({ error: "Authentication required." }, 401, origin);
  }

  if (url.pathname === "/api/v1/me" && request.method === "GET") {
    return jsonResponse(user, 200, origin);
  }

  // Telegram Single-Use Link Start
  if (url.pathname === "/api/v1/telegram/link/start" && request.method === "POST") {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    const rawLinkToken =
      "acrn_tg_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    const tokenHash = await sha256Hex(rawLinkToken);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await env.ACORN_DB.prepare(
      `INSERT INTO telegram_link_tokens (token_hash, user_id, expires_at) VALUES (?1, ?2, ?3)`
    )
      .bind(tokenHash, user.id, expiresAt)
      .run();

    return jsonResponse(
      {
        linkToken: rawLinkToken,
        botHandle: "@Acorn_ai_Bot",
        deepLinkUrl: `https://t.me/Acorn_ai_Bot?start=${rawLinkToken}`,
        expiresAt,
        status: "pending",
      },
      200,
      origin
    );
  }

  // Founder Admin Authorization Gate
  if (url.pathname.startsWith("/api/v1/admin/")) {
    if (user.role !== "founder") {
      return jsonResponse({ error: "Founder authorization required." }, 403, origin);
    }

    if (url.pathname === "/api/v1/admin/access-requests" && request.method === "GET") {
      const { results } = await env.ACORN_DB.prepare(
        `SELECT * FROM access_requests ORDER BY created_at DESC LIMIT 100`
      ).all();
      return jsonResponse({ requests: results }, 200, origin);
    }

    if (url.pathname === "/api/v1/admin/invitations" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const recipientEmail = String(body.recipientEmail || "").trim().toLowerCase();
      const expiresInHours = Number(body.expiresInHours || 72);

      const bytes = new Uint8Array(18);
      crypto.getRandomValues(bytes);
      const rawKeyOnce =
        "acrn_inv_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      const tokenHash = await sha256Hex(rawKeyOnce);
      const keyPreview = `${rawKeyOnce.slice(0, 13)}…${rawKeyOnce.slice(-4)}`;
      const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString();
      const invId = `inv_${crypto.randomUUID()}`;

      await env.ACORN_DB.batch([
        env.ACORN_DB.prepare(
          `INSERT INTO invitations (id, recipient_email, role, key_preview, token_hash, expires_at, created_by_user_id)
           VALUES (?1, ?2, 'member', ?3, ?4, ?5, ?6)`
        ).bind(invId, recipientEmail, keyPreview, tokenHash, expiresAt, user.id),
        env.ACORN_DB.prepare(
          `INSERT INTO audit_logs (id, actor_email, action, target) VALUES (?1, ?2, 'INVITE_CREATED', ?3)`
        ).bind(`aud_${crypto.randomUUID()}`, user.email, `${recipientEmail} (${keyPreview})`),
      ]);

      return jsonResponse(
        {
          invitation: {
            id: invId,
            recipientEmail,
            role: "member",
            keyPreview,
            tokenHash,
            status: "active",
            expiresAt,
          },
          rawKeyOnce,
        },
        201,
        origin
      );
    }
  }

  return jsonResponse({ error: "Not found" }, 404, origin);
}
