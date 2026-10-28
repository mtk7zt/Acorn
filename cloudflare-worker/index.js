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
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',
  'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
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

// ─────────────────────────────────────────────────────────────────────────────
// 1. HTTP GATEWAY & ACCESS CONTROL
// ─────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
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

function evaluateATSResume(cleanResumeText, targetRole = 'Software / IT Support Engineer') {
  const lower = cleanResumeText.toLowerCase();
  const matched = CANONICAL_TECH_KEYWORDS.filter((kw) => lower.includes(kw));
  const missing = CANONICAL_TECH_KEYWORDS.filter((kw) => !lower.includes(kw)).slice(0, 5);

  const score = Math.min(100, Math.round((matched.length / Math.max(1, matched.length + missing.length)) * 100));

  const bullets = missing.slice(0, 3).map((kw) => {
    const title = kw.charAt(0).toUpperCase() + kw.slice(1);
    return `• <b>Accomplished</b> key milestones as measured by production metrics, by integrating <b>${title}</b> into core system workflows.`;
  });

  return { score, matched, missing, bullets };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. TELEGRAM API HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function tgPost(method, body, env) {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
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
  const res = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${path}`, {
    headers: {
      Authorization: `token ${env.GITHUB_PAT}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Acorn-Edge-Worker/2.0',
    },
  });
  if (!res.ok) throw new Error(`GitHub GET ${path} HTTP ${res.status}`);
  const data = await res.json();
  const decoded = atob(data.content.replace(/\s/g, ''));
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  const text = new TextDecoder().decode(bytes);
  return { content: JSON.parse(text), sha: data.sha };
}

async function ghPutWithRetry(path, mutateFn, message, env, maxRetries = 3) {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    const { content, sha } = await ghGet(path, env);
    const updatedContent = mutateFn(content);
    if (!updatedContent) return;

    const json = JSON.stringify(updatedContent, null, 2);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    const encoded = btoa(binary);

    const res = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${path}`, {
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
      console.warn(`GitHub PUT 409 SHA conflict on ${path}. Retrying attempt ${attempt}...`);
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 200 + 100));
      continue;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`GitHub PUT ${path} HTTP ${res.status}: ${JSON.stringify(err)}`);
    }

    return res.json();
  }
  throw new Error(`Max retries exceeded updating ${path}`);
}

async function ghDispatchWorkflow(env) {
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
      body: JSON.stringify({ ref: 'main' }),
    }
  );
  return res.status === 204;
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

async function callGemini(history, newMessage, systemPrompt, env) {
  const contents = [...history, { role: 'user', parts: [{ text: newMessage }] }];

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.7,
      responseMimeType: 'application/json',
    },
  };

  const endpointsToTry = activeGeminiEndpoint
    ? [activeGeminiEndpoint, ...CANDIDATE_GEMINI_ENDPOINTS.filter((u) => u !== activeGeminiEndpoint)]
    : CANDIDATE_GEMINI_ENDPOINTS;

  let lastError = null;
  for (const endpoint of endpointsToTry) {
    try {
      const res = await fetch(`${endpoint}?key=${env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 404) {
        console.warn(`Gemini endpoint ${endpoint} returned 404. Trying next model candidate...`);
        lastError = new Error(`HTTP 404 for ${endpoint}`);
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty candidate response from Gemini API.');

      activeGeminiEndpoint = endpoint;
      return text;
    } catch (err) {
      lastError = err;
      if (err.message?.includes('HTTP 404')) continue;
      throw err;
    }
  }

  throw lastError || new Error('All candidate Gemini model endpoints returned 404.');
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

  // Enforce Multi-User Zero-Trust Authorization (Decision 2)
  if (!isAuthorizedSender(chatId, env)) {
    console.warn(`Unauthorized access rejected from chatId: ${chatId}`);
    return;
  }

  // Visual feedback
  await sendTyping(chatId, env);

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
      '📄 <b>ATS Resume Co-Pilot (Zero-PII):</b>\n\nPlease paste your resume text (or bullet points) below. All emails, phone numbers, postal codes, and personal identifiers will be <b>stripped in-memory</b> before evaluation.',
      env
    );
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
    const bulletsList = result.bullets.join('\n\n');

    const reply = (
      `📄 <b>Grounded ATS Resume Match:</b> ${matchEmoji} <b>${result.score}% Match Score</b>\n\n` +
      `✅ <b>Matched Competencies:</b>\n<code>${matchedList}</code>\n\n` +
      `⚠️ <b>Missing High-Impact Keywords:</b>\n<code>${missingList}</code>\n\n` +
      `💡 <b>Google XYZ-Formula Bullet Recommendations:</b>\n${bulletsList}\n\n` +
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
    await sendMessage(
      chatId,
      '⚠️ <b>AI Notice:</b> The assistant is temporarily unreachable. Please retry in a moment.',
      env
    );
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

  if (!isAuthorizedSender(chatId, env)) return;

  await answerCallback(callbackQuery.id, '', env);

  if (data === 'add_role_prompt') {
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
