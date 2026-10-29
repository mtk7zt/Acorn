/**
 * Acorn Bot — Enterprise Cloudflare Worker Gateway
 * ==================================================
 * Always-on Telegram webhook handler engineered with:
 *   - Google Gemini 1.5 Flash conversational intelligence (<3s response)
 *   - 50-message conversational memory via Cloudflare Workers KV
 *   - Multi-User Authorization allowlist (ALLOWED_CHAT_IDS / TELEGRAM_CHAT_ID)
 *   - Fail-closed cryptographic secret token verification (VULN-02)
 *   - Zero-PII Grounded ATS Resume Co-Pilot & Data Sovereignty (/ats, /forget)
 *   - Optimistic Concurrency Control (OCC) for GitHub REST API writes (VULN-05)
 */

const REPO = 'mtk7zt/Acorn';
const GITHUB_API = 'https://api.github.com';
const CANDIDATE_GEMINI_ENDPOINTS = [
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent',
];
let activeGeminiEndpoint = null;
const MAX_HISTORY_PAIRS = 50;
const ROLE_NAME_REGEX = /^[a-zA-Z0-9\s\+\#\.\,\-\/\(\)]{3,50}$/;

// Canonical tech keywords for edge ATS matching
const CANONICAL_TECH_KEYWORDS = [
  'python', 'java', 'javascript', 'typescript', 'c++', 'c#', '.net', 'golang', 'sql',
  'postgresql', 'mongodb', 'redis', 'aws', 'azure', 'gcp', 'cloud', 'docker',
  'kubernetes', 'ci/cd', 'github actions', 'terraform', 'linux', 'bash', 'rest',
  'api', 'graphql', 'microservices', 'git', 'agile', 'scrum', 'react', 'node.js',
  'active directory', 'help desk', 'it support', 'troubleshooting', 'network',
  'powershell', 'servicenow', 'jira'
];

import { handleAcornApiV1 } from './api_v1_routes.js';
import { resolveAuthRole, isFounder, AuthRole } from './activation/auth.js';
import { ActivationService } from './activation/service.js';
import { FounderAdminController } from './activation/admin.js';
import { ProfileController } from './profile/controller.js';
import { IdentityService } from './profile/identity.js';
import { ProfileRepository } from './profile/repository.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. HTTP GATEWAY & ACCESS CONTROL
// ─────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route /api/v1/* requests to the D1-backed REST API router
    if (url.pathname.startsWith('/api/v1/')) {
      return handleAcornApiV1(request, env);
    }

    if (request.method !== 'POST') {
      return new Response('🌰 Acorn AI Edge Worker Active (V8 Isolate)', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // Fail-Closed Secret Token Validation (VULN-02 Remediation)
    const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (!env.TELEGRAM_SECRET_TOKEN || secret !== env.TELEGRAM_SECRET_TOKEN) {
      console.warn('Unauthorized webhook invocation: invalid or missing secret token.');
      return new Response('Unauthorized', { status: 401 });
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response('Bad Request: Invalid JSON', { status: 400 });
    }

    ctx.waitUntil(processUpdate(update, env));
    return new Response('OK', { status: 200 });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. MULTI-USER AUTHORIZATION GUARD
// ─────────────────────────────────────────────────────────────────────────────

function isAuthorizedSender(chatId, env) {
  const allowlistRaw = env.ALLOWED_CHAT_IDS || env.ALLOWED_CHAT_ID || env.TELEGRAM_CHAT_ID || '';
  const allowedSet = new Set(
    allowlistRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );

  if (allowedSet.size === 0) {
    console.error('CRITICAL: No authorized chat IDs configured in environment.');
    return false;
  }

  return allowedSet.has(String(chatId).trim());
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ZERO-PII SCRUBBING & DETERMINISTIC ATS ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function redactPII(text) {
  if (!text) return '';
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g, '[REDACTED_EMAIL]')
    .replace(/(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]')
    .replace(/\b[A-CEGHJ-NPRSTVXYa-ceghj-nprstvxy]\d[A-Za-z][ -]?\d[A-Za-z]\d\b/g, '[REDACTED_POSTAL_CODE]')
    .replace(/\b\d{3}[-\s]?\d{3}[-\s]?\d{3}\b/g, '[REDACTED_IDENTIFIER]')
    .replace(/https?:\/\/(?:www\.)?linkedin\.com\/(?:in|profile)\/[A-Za-z0-9_\-\./]+/g, '[REDACTED_LINKEDIN_URL]');
}

function analyzeJobDescription(cleanJDText) {
  const lower = cleanJDText.toLowerCase();
  const matched = CANONICAL_TECH_KEYWORDS.filter((kw) => {
    const escaped = kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(lower);
  });

  const skills = matched.length > 0 ? matched : ['troubleshooting', 'python', 'sql', 'api', 'git'];
  const topSkills = skills.slice(0, 4);

  const bullets = topSkills.map((kw) => {
    const title = kw.charAt(0).toUpperCase() + kw.slice(1);
    if (['aws', 'gcp', 'azure', 'cloud', 'docker', 'kubernetes'].includes(kw)) {
      return `• <b>Accomplished 99.9% application uptime and reduced cloud compute costs by 22%</b> as measured by Prometheus monitoring, by deploying <b>${title}</b> cloud microservices and automated health-check pipelines.`;
    } else if (['python', 'java', 'sql', 'api', 'rest', 'microservices'].includes(kw)) {
      return `• <b>Accelerated query execution latency by 35% and scaled backend capacity</b> for 10,000+ peak daily requests as measured by APM logs, by developing optimized <b>${title}</b> backend endpoints and database schemas.`;
    } else if (['help desk', 'it support', 'troubleshooting', 'active directory', 'servicenow'].includes(kw)) {
      return `• <b>Resolved 45+ daily technical tickets maintaining a 98% first-contact SLA</b> and 4.9/5 satisfaction, by standardizing <b>${title}</b> triage runbooks and remote diagnostic workflows.`;
    } else if (['ci/cd', 'github actions', 'terraform', 'linux', 'bash'].includes(kw)) {
      return `• <b>Reduced deployment cycle times by 40% and eliminated release defects</b> as measured by sprint velocity, by implementing <b>${title}</b> automated CI/CD pipelines and infrastructure as code.`;
    }
    return `• <b>Enhanced workflow efficiency by 20% across team deliverables</b> as measured by sprint milestone reviews, by integrating <b>${title}</b> into core operational processes and documentation.`;
  });

  const skillsLine = skills.map((k) => k.charAt(0).toUpperCase() + k.slice(1)).join(' • ');

  return { skills, bullets, skillsLine };
}

function evaluateATSResume(cleanResumeText, targetRole = 'Software / IT Support Engineer') {
  const lower = cleanResumeText.toLowerCase();
  const matched = CANONICAL_TECH_KEYWORDS.filter((kw) => {
    const escaped = kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(lower);
  });
  const missing = CANONICAL_TECH_KEYWORDS.filter((kw) => {
    const escaped = kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    return !new RegExp(`\\b${escaped}\\b`, 'i').test(lower);
  }).slice(0, 5);

  const score = Math.min(100, Math.round((matched.length / Math.max(1, matched.length + missing.length)) * 100));

  const edits = [];
  if (missing.length > 0) {
    edits.push(`1. <b>Add Critical Missing Keywords to Skills Section:</b> <code>${missing.slice(0, 4).map((k) => k.toUpperCase()).join(', ')}</code>`);
    edits.push(`2. <b>Swap Passive Statements for Impact Bullets:</b> Replace routine job descriptions with the quantified Google XYZ bullets below.`);
  } else {
    edits.push(`1. <b>High Keyword Coverage!</b> Retain clean single-column formatting and standard headings (Skills, Experience, Projects).`);
  }

  const bullets = (missing.length > 0 ? missing.slice(0, 3) : matched.slice(0, 3)).map((kw) => {
    const title = kw.charAt(0).toUpperCase() + kw.slice(1);
    if (['aws', 'gcp', 'azure', 'cloud', 'docker', 'kubernetes'].includes(kw)) {
      return `• <b>Accomplished 99.9% application uptime and reduced cloud costs by 22%</b> as measured by Prometheus monitoring, by deploying <b>${title}</b> cloud microservices and automated health checks.`;
    } else if (['python', 'java', 'sql', 'api', 'rest', 'microservices'].includes(kw)) {
      return `• <b>Accelerated query execution latency by 35% and scaled backend capacity</b> for 10,000+ peak requests as measured by APM logs, by developing optimized <b>${title}</b> backend endpoints and database schemas.`;
    } else if (['help desk', 'it support', 'troubleshooting', 'active directory', 'servicenow'].includes(kw)) {
      return `• <b>Resolved 45+ daily technical tickets maintaining a 98% first-contact SLA</b> and 4.9/5 user satisfaction, by standardizing <b>${title}</b> triage runbooks and remote diagnostics.`;
    } else if (['ci/cd', 'github actions', 'terraform', 'linux', 'bash'].includes(kw)) {
      return `• <b>Reduced deployment cycle times by 40% and eliminated release defects</b> as measured by release velocity, by implementing <b>${title}</b> automated CI/CD pipelines and infrastructure as code.`;
    }
    return `• <b>Enhanced workflow efficiency by 20% across team deliverables</b> as measured by sprint milestone reviews, by integrating <b>${title}</b> into core operational processes and documentation.`;
  });

  return { score, matched, missing, edits, bullets };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. TELEGRAM API HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function tgPost(method, body, env) {
  const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error(`Telegram API error on ${method}:`, JSON.stringify(data));
  }
  return data;
}

function sendMessage(chatId, text, env, extra = {}) {
  return tgPost('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...extra,
  }, env);
}

function sendTyping(chatId, env) {
  return tgPost('sendChatAction', { chat_id: chatId, action: 'typing' }, env);
}

function answerCallback(callbackQueryId, text, env) {
  return tgPost('answerCallbackQuery', { callback_query_id: callbackQueryId, text }, env);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. GITHUB REST CLIENT (OPTIMISTIC CONCURRENCY CONTROL)
// ─────────────────────────────────────────────────────────────────────────────

async function ghGet(path, env) {
  let resolvedPath = path;
  let res = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${resolvedPath}`, {
    headers: {
      Authorization: `token ${env.GITHUB_PAT}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Acorn-Edge-Worker/2.0',
    },
  });

  // Backward-compatible fallback for runtime files relocated in BETA-02
  if (!res.ok && res.status === 404 && !path.startsWith('data/')) {
    const fallbackPath = path === 'seen_jobs.json'
      ? `data/runtime/ingestion/${path}`
      : `data/runtime/config/${path}`;
    const fallbackRes = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${fallbackPath}`, {
      headers: {
        Authorization: `token ${env.GITHUB_PAT}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Acorn-Edge-Worker/2.0',
      },
    });
    if (fallbackRes.ok) {
      res = fallbackRes;
      resolvedPath = fallbackPath;
    }
  }

  if (!res.ok) throw new Error(`GitHub GET ${resolvedPath} HTTP ${res.status}`);
  const data = await res.json();
  const decoded = atob(data.content.replace(/\s/g, ''));
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  const text = new TextDecoder().decode(bytes);
  return { content: JSON.parse(text), sha: data.sha, path: resolvedPath };
}

async function ghPutWithRetry(path, mutateFn, message, env, maxRetries = 3) {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    const { content, sha, path: resolvedPath } = await ghGet(path, env);
    const updatedContent = mutateFn(content);
    if (!updatedContent) return;

    const actualPath = resolvedPath || path;
    const json = JSON.stringify(updatedContent, null, 2);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    const encoded = btoa(binary);

    const res = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${actualPath}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${env.GITHUB_PAT}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Acorn-Edge-Worker/2.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: `${message} [skip ci]`, content: encoded, sha }),
    });

    if (res.status === 409) {
      console.warn(`GitHub PUT 409 SHA conflict on ${actualPath}. Retrying attempt ${attempt}...`);
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 200 + 100));
      continue;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`GitHub PUT ${actualPath} HTTP ${res.status}: ${JSON.stringify(err)}`);
    }

    return res.json();
  }
  throw new Error(`Max retries exceeded updating ${path}`);
}

async function ghDispatchWorkflow(env, options = {}) {
  const inputs = {};
  if (options.targetChatId) inputs.target_chat_id = String(options.targetChatId);
  if (options.targetRoles) inputs.target_roles = Array.isArray(options.targetRoles) ? options.targetRoles.join(', ') : String(options.targetRoles);
  if (options.userId) inputs.user_id = String(options.userId);

  // Default to Dev branch where the BETA-02 workflow inputs are defined
  const ref = env.GITHUB_BRANCH || options.ref || 'Dev';
  const body = { ref };
  if (Object.keys(inputs).length > 0) {
    body.inputs = inputs;
  }

  try {
    const res = await fetch(
      `${GITHUB_API}/repos/${REPO}/actions/workflows/job_tracker.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `token ${env.GITHUB_PAT}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Acorn-Edge-Worker/2.0',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (res.status === 204) {
      return { ok: true, status: 204 };
    }

    const errText = await res.text().catch(() => '');
    console.error(`GitHub Actions dispatch error [ref: ${ref}]: HTTP ${res.status}: ${errText}`);
    return { ok: false, status: res.status, error: errText };
  } catch (netErr) {
    console.error(`GitHub Actions network error:`, netErr);
    return { ok: false, status: 500, error: netErr?.message || String(netErr) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. DISTRIBUTED CONVERSATION MEMORY (WORKERS KV)
// ─────────────────────────────────────────────────────────────────────────────

async function loadHistory(chatId, env) {
  try {
    return (await env.CHAT_HISTORY.get(`history:${chatId}`, 'json')) || [];
  } catch {
    return [];
  }
}

async function saveHistory(chatId, history, env) {
  const maxEntries = MAX_HISTORY_PAIRS * 2;
  if (history.length > maxEntries) history = history.slice(-maxEntries);
  await env.CHAT_HISTORY.put(`history:${chatId}`, JSON.stringify(history));
}

async function wipeUserData(chatId, env) {
  await env.CHAT_HISTORY.delete(`history:${chatId}`);
  await env.CHAT_HISTORY.delete(`awaiting_ats:${chatId}`);
  await env.CHAT_HISTORY.delete(`personality:${chatId}`);
}

async function getPersonality(chatId, env) {
  return (await env.CHAT_HISTORY.get(`personality:${chatId}`)) || 'professional';
}

async function setPersonality(chatId, value, env) {
  const safe = value === 'encouraging' ? 'encouraging' : 'professional';
  await env.CHAT_HISTORY.put(`personality:${chatId}`, safe);
  return safe;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. GEMINI 1.5 FLASH PROMPT & AGENT
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(rolesConfig, botConfig, personality) {
  const tone =
    personality === 'encouraging'
      ? `Tone: Warm, motivating, and energetic. Encourage the job seeker, celebrate their proactive attitude, and provide actionable Canadian tech hiring insights.`
      : `Tone: Professional, direct, and concise. Provide crisp, factual labor market intelligence and direct execution feedback.`;

  return `You are Acorn 🌰, an intelligent Canadian tech career and job-hunting assistant embedded directly within a Telegram bot.

${tone}

━━━ RUNTIME SYSTEM STATE ━━━
• Active Tracked Roles (${rolesConfig.roles.length}): ${rolesConfig.roles.join(', ')}
• Ingestion Frequency: Every 10 minutes via GitHub Actions
• Freshness Horizon: ${Math.round(botConfig.max_age_seconds / 60)} minutes
• Batch Pipeline: ${botConfig.cron_enabled ? '▶️ Active' : '⏸️ Paused'}
• Priority 1 (Core GTA) 🔥: Mississauga, Toronto, Etobicoke, North York, Scarborough, East York, York
• Priority 2 (Outer GTA) 📍: Brampton, Oakville, Burlington, Milton, Vaughan, Markham, Richmond Hill, Thornhill, Pickering, Ajax, Whitby, Oshawa, Newmarket, Aurora, Hamilton
• Priority 3 (Remote) 🌐: Telework / Canada-wide

━━━ TOOL INVOCATION CAPABILITIES ━━━
You have direct programmatic control over the scraping pipeline. If the user instructs you to change tracking, schedule a scan, or adjust settings, output the corresponding action objects in your JSON "actions" array:
  • Add role: {"type": "ADD_ROLE", "value": "Junior Cloud Architect"}
  • Remove role: {"type": "REMOVE_ROLE", "value": "Helpdesk"}
  • Immediate scan: {"type": "TRIGGER_SCAN"}
  • Pause tracking: {"type": "PAUSE_CRON"}
  • Resume tracking: {"type": "RESUME_CRON"}
  • Update freshness window: {"type": "UPDATE_MAX_AGE", "value": 1800}
  • Set tone: {"type": "SET_PERSONALITY", "value": "professional"|"encouraging"}
  • Reset memory: {"type": "CLEAR_HISTORY"}

━━━ STRICT SCHEMA ENFORCEMENT ━━━
Output ONLY a raw JSON object complying with this structure (no markdown fences, no leading/trailing prose):
{
  "message": "HTML formatted response string for Telegram. Use tags: <b>bold</b>, <i>italic</i>, <code>code</code>",
  "actions": []
}`;
}

let discoveredModelEndpoints = null;

async function getAvailableGeminiEndpoints(apiKey) {
  if (discoveredModelEndpoints && discoveredModelEndpoints.length > 0) {
    return discoveredModelEndpoints;
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (res.ok) {
      const data = await res.json();
      const models = (data.models || []).filter(
        (m) =>
          m.supportedGenerationMethods &&
          m.supportedGenerationMethods.includes('generateContent') &&
          !m.name.includes('-tts') &&
          !m.name.includes('-audio') &&
          !m.name.includes('embedding') &&
          !m.name.includes('2.5-flash') &&
          !m.name.includes('image')
      );
      if (models.length > 0) {
        // Prioritize stable alias and modern high-availability flash models
        models.sort((a, b) => {
          const rank = (name) => {
            if (name.includes('flash-latest')) return 1;
            if (name.includes('3.7-flash')) return 2;
            if (name.includes('3.5-flash')) return 3;
            if (name.includes('3.8-flash')) return 4;
            if (name.includes('flash-lite-latest')) return 5;
            if (name.includes('flash')) return 6;
            return 10;
          };
          return rank(a.name) - rank(b.name);
        });

        // Retain top 4 responsive candidate models to guarantee fast response
        const topModels = models.slice(0, 4);
        console.log(`Ranked responsive text models:`, topModels.map((m) => m.name).join(', '));
        discoveredModelEndpoints = topModels.map(
          (m) => `https://generativelanguage.googleapis.com/v1beta/${m.name}:generateContent`
        );
        return discoveredModelEndpoints;
      }
    } else {
      console.error(`ListModels failed HTTP ${res.status}:`, (await res.text()).slice(0, 300));
    }
  } catch (err) {
    console.warn('Dynamic model discovery failed, using fallback list:', err?.message || err);
  }

  return CANDIDATE_GEMINI_ENDPOINTS;
}

async function callGemini(history, newMessage, systemPrompt, env) {
  const apiKey = String(env.GEMINI_API_KEY || '').trim();
  const contents = [...history, { role: 'user', parts: [{ text: newMessage }] }];

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.7,
      responseMimeType: 'application/json',
    },
  };

  const discovered = await getAvailableGeminiEndpoints(apiKey);
  const endpointsToTry = activeGeminiEndpoint
    ? [activeGeminiEndpoint, ...discovered.filter((u) => u !== activeGeminiEndpoint)]
    : discovered;

  let lastError = null;
  for (const endpoint of endpointsToTry) {
    try {
      const res = await fetch(`${endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(6000), // Prevent Cloudflare Worker waitUntil expiration
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`Gemini endpoint ${endpoint} returned HTTP ${res.status}: ${errText.slice(0, 250)}`);
        lastError = new Error(`HTTP ${res.status} for ${endpoint}: ${errText.slice(0, 150)}`);
        continue;
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty candidate response from Gemini API.');

      activeGeminiEndpoint = endpoint;
      return text;
    } catch (err) {
      lastError = err;
      if (err.message?.includes('HTTP') || err.name === 'TimeoutError' || err.message?.includes('aborted')) continue;
      throw err;
    }
  }

  throw lastError || new Error('All candidate Gemini model endpoints failed.');
}

function parseGeminiResponse(raw) {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : raw);
  } catch {
    return { message: raw, actions: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. PIPELINE ACTION EXECUTOR
// ─────────────────────────────────────────────────────────────────────────────

async function executePipelineActions(actions, chatId, env) {
  if (!Array.isArray(actions) || actions.length === 0) return;

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'ADD_ROLE': {
          const role = String(action.value || '').trim();
          if (!ROLE_NAME_REGEX.test(role)) break;
          await ghPutWithRetry(
            'roles_config.json',
            (data) => {
              const exists = data.roles.some((r) => r.toLowerCase() === role.toLowerCase());
              if (exists) return null;
              data.roles.push(role);
              return data;
            },
            `feat(roles): add tracked role ${role}`,
            env
          );
          break;
        }

        case 'REMOVE_ROLE': {
          const role = String(action.value || '').trim();
          await ghPutWithRetry(
            'roles_config.json',
            (data) => {
              const idx = data.roles.findIndex((r) => r.toLowerCase() === role.toLowerCase());
              if (idx === -1) return null;
              data.roles.splice(idx, 1);
              return data;
            },
            `feat(roles): remove tracked role ${role}`,
            env
          );
          break;
        }

        case 'TRIGGER_SCAN':
          await ghDispatchWorkflow(env);
          break;

        case 'PAUSE_CRON':
          await ghPutWithRetry(
            'bot_config.json',
            (data) => {
              data.cron_enabled = false;
              return data;
            },
            'chore(pipeline): pause scheduled batch scraping',
            env
          );
          break;

        case 'RESUME_CRON':
          await ghPutWithRetry(
            'bot_config.json',
            (data) => {
              data.cron_enabled = true;
              return data;
            },
            'chore(pipeline): resume scheduled batch scraping',
            env
          );
          break;

        case 'UPDATE_MAX_AGE': {
          const seconds = parseInt(action.value, 10);
          if (seconds >= 600 && seconds <= 86400) {
            await ghPutWithRetry(
              'bot_config.json',
              (data) => {
                data.max_age_seconds = seconds;
                return data;
              },
              `chore(config): set max_age_seconds to ${seconds}`,
              env
            );
          }
          break;
        }

        case 'SET_PERSONALITY':
          await setPersonality(chatId, action.value, env);
          break;

        case 'CLEAR_HISTORY':
          await wipeUserData(chatId, env);
          break;
      }
    } catch (err) {
      console.error(`Action execution failure (${action.type}):`, err?.message || err);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. CONVERSATIONAL MESSAGE CONTROLLER (/ats, /forget, Chat)
// ─────────────────────────────────────────────────────────────────────────────

async function handleMessage(message, env) {
  const chatId = message.chat.id;
  const rawText = message.text || '';
  const textTrim = rawText.trim();

  const role = await resolveAuthRole(chatId, env);

  // 1. Founder Administrative Command Dispatcher
  if (role === AuthRole.FOUNDER && textTrim.startsWith('/')) {
    const adminCtrl = new FounderAdminController(env, { sendMessage, sendTyping });
    const handled = await adminCtrl.handleAdminCommand(chatId, textTrim, env);
    if (handled) return;
  }

  // 2. Public Command: /start or /help (Adaptive onboarding)
  if (textTrim === '/start' || textTrim === '/help') {
    await sendTyping(chatId, env);

    // If already authorized (Founder or Active Tester), present full Acorn control hub
    if (role === AuthRole.FOUNDER || role === AuthRole.TESTER) {
      const welcomeText = (
        '🌰 <b>Acorn Job Tracker & Career Intelligence Engine</b>\n\n' +
        'Always-on edge intelligence for early Canadian tech job discovery and ATS resume tailoring.\n\n' +
        '<b>⚡ Commands & Capabilities:</b>\n' +
        '• <code>/profile</code> — View and manage your personal career profile\n' +
        '• <code>/setroles</code> — Customize your target job search positions\n' +
        '• <code>/scan</code> — Scan all Canadian job boards for your target roles\n' +
        '• <code>/jd</code> — Upload a JD to get ATS passing statements & extracted skills\n' +
        '• <code>/ats</code> — Upload your resume to get your ATS score & actionable edits\n' +
        '• <code>/roles</code> — View currently tracked roles\n' +
        '• <code>/forget</code> — Wipe your session data from edge KV\n\n' +
        '<i>Or send any question in natural language to chat with Acorn!</i>'
      );
      await sendMessage(chatId, welcomeText, env, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '👤 My Profile & Roles', callback_data: 'prof_view' },
              { text: '🔍 Scan Target Roles', callback_data: 'scan_roles' },
            ],
            [
              { text: '📋 Breakdown JD (ATS Statements & Skills)', callback_data: 'jd_prompt' },
            ],
            [
              { text: '📄 Scan Resume for ATS Score & Edits', callback_data: 'ats_prompt' },
            ],
            [
              { text: '🗑️ Wipe Data', callback_data: 'wipe_prompt' },
            ],
          ],
        },
      });
      return;
    }

    // Unauthorized or Revoked: Present Warm Public Onboarding Flow (Stage BETA-01)
    if (role === AuthRole.REVOKED) {
      await sendMessage(
        chatId,
        '⚠️ <b>Access Deactivated:</b> Your beta tester access has been revoked. Contact Acorn support for assistance.\n\n<i>You may still use /forget to purge your conversation data.</i>',
        env
      );
      return;
    }

    const publicWelcome = (
      '🌰 <b>Welcome to Acorn!</b>\n\n' +
      'Your personal career scout is currently welcoming a small group of early testers.\n\n' +
      'Have an activation key? You can use it to unlock Acorn.'
    );
    await sendMessage(chatId, publicWelcome, env, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🌱 Activate Acorn', callback_data: 'activate_prompt' },
            { text: '🌰 About Acorn', callback_data: 'about_acorn' },
          ],
        ],
      },
    });
    return;
  }

  // 3. Public Command: /activate or Key Input Flow
  const awaitingActivation = await env.CHAT_HISTORY.get(`awaiting_activation:${chatId}`);
  const isDirectActivationCmd = textTrim.startsWith('/activate');

  if (isDirectActivationCmd || awaitingActivation === 'true') {
    await env.CHAT_HISTORY.delete(`awaiting_activation:${chatId}`);
    const keyCandidate = isDirectActivationCmd
      ? textTrim.replace('/activate', '').trim()
      : textTrim;

    if (!keyCandidate) {
      await env.CHAT_HISTORY.put(`awaiting_activation:${chatId}`, 'true', { expirationTtl: 300 });
      await sendMessage(
        chatId,
        '🔑 <b>Acorn Beta Activation:</b>\n\nPlease send your activation key in this private chat:\n(Format: <code>ACRN-BETA-...</code>)',
        env
      );
      return;
    }

    await sendTyping(chatId, env);
    const service = new ActivationService(env);
    const redeemRes = await service.redeemKey(keyCandidate, chatId);

    if (redeemRes.success) {
      const successMsg = (
        '🌱 <b>You\'re in!</b>\n\n' +
        'Acorn is now active for you.\n\n' +
        'Your personal career scout is ready to help you discover opportunities worth your attention.'
      );
      await sendMessage(chatId, successMsg, env, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔍 Scan Target Roles', callback_data: 'scan_roles' }],
            [{ text: '📋 Breakdown Job Description (JD)', callback_data: 'jd_prompt' }],
            [{ text: '📄 Scan Resume for ATS Score', callback_data: 'ats_prompt' }],
          ],
        },
      });
      return;
    }

    const errorMsg = 'That activation key couldn\'t be accepted. Check the key and try again, or request another invitation.';
    await sendMessage(chatId, errorMsg, env);
    return;
  }

  // 4. Data Sovereignty (/forget) remains public for all users
  if (textTrim === '/forget' || textTrim.toLowerCase() === 'wipe my data') {
    await wipeUserData(chatId, env);
    await sendMessage(
      chatId,
      '🗑️ <b>Data Sovereignty Confirmed:</b> All conversation turns and cached resume data have been wiped from edge memory.',
      env
    );
    return;
  }

  // 5. Gate all remaining protected commands and conversational AI
  if (role !== AuthRole.FOUNDER && role !== AuthRole.TESTER) {
    console.warn(`Protected feature access denied for unauthorized user: ${chatId}`);
    const deniedText = (
      '🌰 <b>Acorn Beta Access Required</b>\n\n' +
      'This feature is reserved for active beta testers.\n' +
      'Please tap <b>🌱 Activate Acorn</b> below and enter your key.'
    );
    await sendMessage(chatId, deniedText, env, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌱 Activate Acorn', callback_data: 'activate_prompt' }],
        ],
      },
    });
    return;
  }

  // Visual feedback
  await sendTyping(chatId, env);

  // Profile management & Onboarding commands (/profile, /setroles, /setlocations, /preferences, /exportprofile, /uploadresume, /deleteresume)
  const profileController = new ProfileController(env, { sendMessage, sendTyping });
  const handledProfile = await profileController.handleProfileCommand(chatId, textTrim, env);
  if (handledProfile) return;

  // Command: /roles (Personalized user target roles)
  if (textTrim === '/roles') {
    try {
      const identityService = new IdentityService(env);
      const profileRepo = new ProfileRepository(env);
      const { acornUserId } = await identityService.getOrCreateUserByTelegram(chatId);
      const userRoles = await profileRepo.getUserRoles(acornUserId);

      if (userRoles && userRoles.length > 0) {
        const list = userRoles.map((r, i) => `${i + 1}. <b>${r.role_title}</b>`).join('\n');
        await sendMessage(
          chatId,
          `📋 <b>Your Active Target Roles (${userRoles.length}):</b>\n\n${list}\n\n<i>Use /scan to trigger a search, or /setroles to update!</i>`,
          env
        );
      } else {
        await sendMessage(
          chatId,
          '📋 <b>No Target Roles Set Yet</b>\n\nUse <code>/setroles &lt;Role 1, Role 2&gt;</code> to choose what jobs Acorn tracks for you!',
          env,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎯 Set Target Roles', callback_data: 'prof_set_roles' }],
              ],
            },
          }
        );
      }
    } catch {
      await sendMessage(chatId, '⚠️ Unable to fetch roles.', env);
    }
    return;
  }

  // Command: /scan (Strictly user-isolated scanning)
  if (textTrim === '/scan') {
    try {
      const identityService = new IdentityService(env);
      const profileRepo = new ProfileRepository(env);
      const { acornUserId } = await identityService.getOrCreateUserByTelegram(chatId);
      const userRoles = await profileRepo.getUserRoles(acornUserId);

      let targetRoles = [];
      if (userRoles && userRoles.length > 0) {
        targetRoles = userRoles.map((r) => r.role_title);
      } else {
        // Prompt onboarding if user has not set target roles
        const promptMsg = (
          '🎯 <b>Before scanning, tell Acorn what roles you want to find!</b>\n\n' +
          'You have not configured your target roles yet.\n\n' +
          'Reply with <code>/setroles</code> followed by comma-separated titles. For example:\n' +
          '<code>/setroles Junior Software Engineer, Cloud Support, Data Analyst</code>\n\n' +
          '<i>Once set, /scan will search specifically for your positions!</i>'
        );
        await sendMessage(chatId, promptMsg, env, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎯 Set Target Roles', callback_data: 'prof_set_roles' }],
            ],
          },
        });
        return;
      }

      await profileRepo.recordScanRequest({
        acornUserId,
        correlationId: crypto.randomUUID(),
        recipientAddress: chatId,
      });

      const dispatchRes = await ghDispatchWorkflow(env, {
        targetChatId: chatId,
        targetRoles,
        userId: acornUserId,
      });

      if (dispatchRes.ok) {
        const rolesList = targetRoles.map((r) => `• <b>${r}</b>`).join('\n');
        await sendMessage(
          chatId,
          `🚀 <b>Personalized Job Scan Triggered!</b>\n\n<b>Searching for your target roles:</b>\n${rolesList}\n\n<i>Qualified matching opportunities will be delivered directly to you here!</i>`,
          env
        );
      } else {
        const statusSnippet = dispatchRes.status ? ` (HTTP ${dispatchRes.status})` : '';
        const errorDetail = dispatchRes.error ? `\n\n<code>${dispatchRes.error.slice(0, 200)}</code>` : '';
        await sendMessage(
          chatId,
          `⚠️ <b>GitHub Actions Dispatch Issue${statusSnippet}:</b>${errorDetail}\n\nPlease verify that your <code>GITHUB_PAT</code> secret in Cloudflare has <b>workflow</b> permissions and access to repository <code>mtk7zt/Acorn</code>.`,
          env
        );
      }
    } catch (err) {
      await sendMessage(chatId, `⚠️ Failed to trigger workflow: ${err?.message || err}`, env);
    }
    return;
  }

  // Command 1: Data Sovereignty / Wipe My Data
  if (textTrim === '/forget' || textTrim.toLowerCase() === 'wipe my data') {
    await wipeUserData(chatId, env);
    await sendMessage(
      chatId,
      '🗑️ <b>Data Sovereignty Confirmed:</b> All conversation turns and cached resume data have been wiped from edge memory.',
      env
    );
    return;
  }

  // Command 2: ATS Resume Check prompt
  if (textTrim === '/ats') {
    await env.CHAT_HISTORY.put(`awaiting_ats:${chatId}`, 'true', { expirationTtl: 300 });
    await sendMessage(
      chatId,
      '📄 <b>ATS Resume Scoring & Prescription Engine:</b>\n\n' +
      'Please paste your resume text below.\n\n' +
      'Acorn will strip all PII in-memory, evaluate your keyword alignment against active market requirements, ' +
      'give you an ATS compatibility score, and prescribe the <b>exact line edits and high-impact statements</b> you need to pass ATS screening!',
      env
    );
    return;
  }

  // Command 3: Job Description (JD) Breakdown
  if (textTrim === '/jd') {
    await env.CHAT_HISTORY.put(`awaiting_jd:${chatId}`, 'true', { expirationTtl: 300 });
    await sendMessage(
      chatId,
      '📋 <b>Job Description (JD) Breakdown & ATS Statement Engine:</b>\n\n' +
      'Paste the text of any job description or posting in chat below.\n\n' +
      'Acorn will systematically analyze the role requirements, extract the highest-impact ATS keywords, ' +
      'and generate <b>human-sounding Google XYZ statements</b> with real business value and numerical metrics ready to copy into your resume!',
      env
    );
    return;
  }

  // Check if user was in JD breakdown mode
  const awaitingJd = await env.CHAT_HISTORY.get(`awaiting_jd:${chatId}`);
  if (awaitingJd === 'true' && textTrim.length > 50) {
    await env.CHAT_HISTORY.delete(`awaiting_jd:${chatId}`);
    const cleanJD = redactPII(rawText);
    const result = analyzeJobDescription(cleanJD);

    const bulletsList = result.bullets.join('\n\n');
    const skillsDisplay = result.skills.slice(0, 10).map((k) => `<code>${k}</code>`).join(', ');

    const reply = (
      `📋 <b>Job Description ATS Blueprint:</b>\n\n` +
      `🔑 <b>Key Competencies Extracted:</b>\n${skillsDisplay}\n\n` +
      `📝 <b>Recommended Skills Section Line:</b>\n<i>${result.skillsLine}</i>\n\n` +
      `💡 <b>High-Impact ATS Passing Statements (Google XYZ):</b>\n${bulletsList}\n\n` +
      `💡 <i>Copy these bullet points directly into your resume under relevant project or work experience to pass ATS screening!</i>`
    );

    await sendMessage(chatId, reply, env);
    return;
  }

  // Check if user was in ATS evaluation mode
  const awaitingAts = await env.CHAT_HISTORY.get(`awaiting_ats:${chatId}`);
  if (awaitingAts === 'true' && textTrim.length > 50) {
    await env.CHAT_HISTORY.delete(`awaiting_ats:${chatId}`);
    const cleanResume = redactPII(rawText);
    const result = evaluateATSResume(cleanResume);

    const matchEmoji = result.score >= 70 ? '🟢' : result.score >= 50 ? '🟡' : '🔴';
    const matchedList = result.matched.slice(0, 8).join(', ') || 'General fundamentals';
    const missingList = result.missing.join(', ') || 'None';
    const editsList = (result.edits || []).join('\n');
    const bulletsList = result.bullets.join('\n\n');

    const reply = (
      `📄 <b>Grounded ATS Resume Match:</b> ${matchEmoji} <b>${result.score}% Match Score</b>\n\n` +
      `✅ <b>Matched Competencies:</b>\n<code>${matchedList}</code>\n\n` +
      `⚠️ <b>Missing High-Impact Keywords:</b>\n<code>${missingList}</code>\n\n` +
      `🛠️ <b>Actionable Edits & Prescriptions:</b>\n${editsList}\n\n` +
      `💡 <b>Recommended Google XYZ-Formula Bullets:</b>\n${bulletsList}\n\n` +
      `🔒 <i>Evaluated strictly in-memory with zero PII retention. Use /forget anytime to purge session state.</i>`
    );

    await sendMessage(chatId, reply, env);
    return;
  }

  // Standard AI Assistant Chat
  const [history, rolesData, botData, personality] = await Promise.all([
    loadHistory(chatId, env),
    ghGet('roles_config.json', env),
    ghGet('bot_config.json', env),
    getPersonality(chatId, env),
  ]);

  const systemPrompt = buildSystemPrompt(rolesData.content, botData.content, personality);

  let rawLLMOutput;
  try {
    rawLLMOutput = await callGemini(history, rawText, systemPrompt, env);
  } catch (err) {
    console.error('Gemini reasoning exception:', err?.message || err);
    const msg = String(err?.message || '');
    const isQuota = msg.includes('402') || msg.includes('depleted') || msg.includes('RESOURCE_EXHAUSTED');
    const notice = isQuota
      ? '⚠️ <b>Gemini Quota Notice:</b> Your Google AI Studio prepayment credits are depleted (HTTP 402).\n\n💡 <i>Create a new free-tier key at aistudio.google.com without billing attached for 15 free req/min!</i>\n\n✅ <b>Core bot commands (/roles, /ats, /scan, /forget) continue to work normally.</b>'
      : '⚠️ <b>AI Notice:</b> The assistant is temporarily unreachable. Core bot commands (/roles, /ats, /scan, /forget) remain fully functional.';
    await sendMessage(chatId, notice, env);
    return;
  }

  const parsed = parseGeminiResponse(rawLLMOutput);
  const responseMessage = parsed.message || '✅ Done.';

  // Execute remote state changes
  await executePipelineActions(parsed.actions, chatId, env);

  // Save conversation history to KV
  const updatedHistory = [
    ...history,
    { role: 'user', parts: [{ text: rawText }] },
    { role: 'model', parts: [{ text: responseMessage }] },
  ];
  await saveHistory(chatId, updatedHistory, env);

  // Send reply
  await sendMessage(chatId, responseMessage, env);
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. INLINE BUTTON HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

async function handleCallbackQuery(callbackQuery, env) {
  const chatId = callbackQuery.message?.chat?.id;
  const data = callbackQuery.data;

  const role = await resolveAuthRole(chatId, env);

  await answerCallback(callbackQuery.id, '', env);

  // 1. Public Callbacks
  if (data === 'activate_prompt') {
    await env.CHAT_HISTORY.put(`awaiting_activation:${chatId}`, 'true', { expirationTtl: 300 });
    await sendMessage(
      chatId,
      '🔑 <b>Acorn Beta Activation:</b>\n\nPlease text your activation key into this private chat:\n(Format: <code>ACRN-BETA-...</code>)',
      env
    );
    return;
  }

  if (data === 'about_acorn') {
    const aboutMsg = (
      '🌰 <b>About Acorn AI</b>\n\n' +
      'Acorn is your personal Canadian career scout. Instead of spending your day refreshing job boards, ' +
      'Acorn keeps watch in the background, qualifies roles across the Greater Toronto Area & Canada Remote, ' +
      'and brings worthwhile opportunities directly to you with first-mover velocity.'
    );
    await sendMessage(chatId, aboutMsg, env, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌱 Activate Acorn', callback_data: 'activate_prompt' }],
        ],
      },
    });
    return;
  }

  // 2. Founder Admin Callbacks
  if (role === AuthRole.FOUNDER) {
    const adminCtrl = new FounderAdminController(env, { sendMessage, sendTyping });
    if (data === 'admin_newkey_1') {
      await adminCtrl.handleNewKey(chatId, ['Single-Tester Beta', '1']);
      return;
    }
    if (data === 'admin_newkey_5') {
      await adminCtrl.handleNewKey(chatId, ['5-Tester Cohort', '5']);
      return;
    }
    if (data === 'admin_testers') {
      await adminCtrl.handleTesterStats(chatId);
      return;
    }
    if (data === 'admin_list_keys') {
      await adminCtrl.handleListKeys(chatId);
      return;
    }
  }

  // 3. Gate Protected Feature Callbacks
  if (role !== AuthRole.FOUNDER && role !== AuthRole.TESTER) {
    console.warn(`Protected callback rejected for unauthorized user: ${chatId}`);
    await sendMessage(
      chatId,
      '🌰 <b>Access Required:</b> Please activate your tester invitation to use this feature.',
      env,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌱 Activate Acorn', callback_data: 'activate_prompt' }],
          ],
        },
      }
    );
    return;
  }

  if (data === 'prof_view') {
    const profileController = new ProfileController(env, { sendMessage, sendTyping });
    const identityService = new IdentityService(env);
    const { acornUserId } = await identityService.getOrCreateUserByTelegram(chatId);
    await profileController.showProfile(chatId, acornUserId);
    return;
  }

  if (data === 'prof_set_roles') {
    const profileController = new ProfileController(env, { sendMessage, sendTyping });
    await profileController.promptRoles(chatId);
    return;
  }

  if (data === 'prof_set_locs') {
    await sendMessage(
      chatId,
      '📍 <b>Set Search Locations:</b>\n\nReply with <code>/setlocations</code> followed by cities or Remote.\n<i>Example:</i> <code>/setlocations Toronto, Mississauga, Remote</code>',
      env
    );
    return;
  }

  if (data === 'prof_export') {
    const identityService = new IdentityService(env);
    const profileRepo = new ProfileRepository(env);
    const { acornUserId } = await identityService.getOrCreateUserByTelegram(chatId);
    const profileData = await profileRepo.exportProfile(acornUserId);
    await sendMessage(
      chatId,
      `📦 <b>Your Portable Acorn Profile (v1.0):</b>\n\n<pre><code>${JSON.stringify(profileData, null, 2)}</code></pre>`,
      env
    );
    return;
  }

  if (data === 'scan_roles') {
    await sendTyping(chatId, env);
    try {
      const identityService = new IdentityService(env);
      const profileRepo = new ProfileRepository(env);
      const { acornUserId } = await identityService.getOrCreateUserByTelegram(chatId);
      const userRoles = await profileRepo.getUserRoles(acornUserId);

      let targetRoles = [];
      if (userRoles && userRoles.length > 0) {
        targetRoles = userRoles.map((r) => r.role_title);
      } else {
        const promptMsg = (
          '🎯 <b>Before scanning, tell Acorn what roles you want to find!</b>\n\n' +
          'You have not set your personal target roles yet.\n\n' +
          'Reply with <code>/setroles</code> followed by comma-separated titles. For example:\n' +
          '<code>/setroles Junior Software Engineer, Cloud Support, Data Analyst</code>'
        );
        await sendMessage(chatId, promptMsg, env, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎯 Set Target Roles', callback_data: 'prof_set_roles' }],
            ],
          },
        });
        return;
      }

      await profileRepo.recordScanRequest({
        acornUserId,
        correlationId: crypto.randomUUID(),
        recipientAddress: chatId,
      });

      const dispatchRes = await ghDispatchWorkflow(env, {
        targetChatId: chatId,
        targetRoles,
        userId: acornUserId,
      });

      if (dispatchRes.ok) {
        const rolesList = targetRoles.map((r) => `• <b>${r}</b>`).join('\n');
        await sendMessage(
          chatId,
          `🚀 <b>Personalized Job Scan Triggered!</b>\n\n<b>Searching for your target roles:</b>\n${rolesList}\n\n<i>Qualified matching opportunities will be delivered directly to you here!</i>`,
          env
        );
      } else {
        const statusSnippet = dispatchRes.status ? ` (HTTP ${dispatchRes.status})` : '';
        const errorDetail = dispatchRes.error ? `\n\n<code>${dispatchRes.error.slice(0, 200)}</code>` : '';
        await sendMessage(
          chatId,
          `⚠️ <b>GitHub Actions Dispatch Issue${statusSnippet}:</b>${errorDetail}\n\nPlease verify that your <code>GITHUB_PAT</code> secret in Cloudflare has <b>workflow</b> permissions and access to repository <code>mtk7zt/Acorn</code>.`,
          env
        );
      }
    } catch (err) {
      await sendMessage(chatId, `⚠️ Failed to trigger scan: ${err?.message || err}`, env);
    }
  } else if (data && data.startsWith('fit_')) {
    const jobId = data.replace('fit_', '');
    await env.CHAT_HISTORY.put(`awaiting_ats:${chatId}`, 'true', { expirationTtl: 300 });
    await sendMessage(
      chatId,
      `🎯 <b>ATS Resume Fit Check for Opportunity:</b>\n\n` +
      `Paste your resume text or bullet points in chat below.\n\n` +
      `Acorn will evaluate your keyword frequency and produce <b>tailored Google XYZ bullet points</b> (with metrics like 99.9% uptime, 35% latency, 45+ tickets) to help you pass the ATS screen for this role!`,
      env
    );
  } else if (data === 'jd_prompt') {
    await env.CHAT_HISTORY.put(`awaiting_jd:${chatId}`, 'true', { expirationTtl: 300 });
    await sendMessage(
      chatId,
      '📋 <b>Job Description (JD) Breakdown & ATS Statement Engine:</b>\n\n' +
      'Paste the full text or bullet points of any job description below.\n\n' +
      'Acorn will systematically extract the highest-impact ATS keywords, ' +
      'and generate <b>human-sounding Google XYZ statements</b> with real business value and numerical metrics (e.g. 99.9% uptime, 35% latency drop, 45+ tickets at 98% SLA) ready to copy into your resume!',
      env
    );
  } else if (data === 'add_role_prompt') {
    await sendMessage(
      chatId,
      '➕ <b>Add Tracked Role:</b>\n\nSimply text me the role(s) you wish to track:\n<i>"Add QA Analyst, Junior DevOps Engineer"</i>',
      env
    );
  } else if (data === 'list_roles') {
    await sendTyping(chatId, env);
    try {
      const { content } = await ghGet('roles_config.json', env);
      const list = content.roles.map((r, i) => `${i + 1}. <b>${r}</b>`).join('\n');
      await sendMessage(
        chatId,
        `📋 <b>Active Tracked Roles (${content.roles.length}):</b>\n\n${list}\n\n<i>Ask me anytime to add or remove specific roles!</i>`,
        env
      );
    } catch {
      await sendMessage(chatId, '⚠️ Unable to retrieve roles configuration.', env);
    }
  } else if (data === 'ats_prompt') {
    await env.CHAT_HISTORY.put(`awaiting_ats:${chatId}`, 'true', { expirationTtl: 300 });
    await sendMessage(
      chatId,
      '📄 <b>ATS Resume Co-Pilot:</b>\n\nPlease paste your resume text (or bullet points) in chat. All emails, phone numbers, and PII will be <b>automatically scrubbed</b> in memory before evaluation.',
      env
    );
  } else if (data === 'wipe_prompt') {
    await wipeUserData(chatId, env);
    await sendMessage(
      chatId,
      '🗑️ <b>Data Purge Successful:</b> All conversational history and cached ATS evaluations have been wiped from edge storage.',
      env
    );
  }
}

async function processUpdate(update, env) {
  try {
    if (update.message?.text) {
      await handleMessage(update.message, env);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, env);
    }
  } catch (err) {
    console.error('Fatal dispatch error:', err?.message || err);
  }
}
