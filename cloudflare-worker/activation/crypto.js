/**
 * Acorn Activation Cryptographic Utilities (Web Crypto API)
 * Generates cryptographically secure 256-bit random tokens with high entropy
 * and verifies tokens via HMAC-SHA256 digests.
 */

const KEY_PREFIX = "ACRN-BETA-";
const KEY_REGEX = /^ACRN-BETA-[a-zA-Z0-9_-]{32,64}$/;

/**
 * Generates a high-entropy, cryptographically random activation key.
 * Format: ACRN-BETA-<64-char-hex> (256 bits of entropy)
 */
export function generateActivationKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${KEY_PREFIX}${hex}`;
}

/**
 * Validates structural syntax of an activation key before hashing.
 */
export function isValidKeyFormat(rawKey) {
  if (!rawKey || typeof rawKey !== "string") return false;
  return KEY_REGEX.test(rawKey.trim());
}

/**
 * Computes an HMAC-SHA256 hex digest using server-side pepper.
 * Raw activation keys are never stored in databases or logs.
 */
export async function computeKeyHash(rawKey, pepper) {
  const cleanKey = String(rawKey || "").trim();
  const secretKey = String(pepper || "acorn_default_pepper_v2").trim();
  
  const enc = new TextEncoder();
  const keyData = await crypto.subtle.importKey(
    "raw",
    enc.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    keyData,
    enc.encode(cleanKey)
  );

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
