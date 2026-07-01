import { base64UrlDecode, base64UrlEncode, hmacSha256Hex, safeEqual, sha256Hex } from "@/lib/crypto";

// Admin authentication primitives. PURE: no next/headers import, so this module
// is safe to use from both the Edge proxy and Node route handlers.
//
// Admin access is a single shared password (ADMIN_PASSWORD). On success we issue
// a signed, expiring cookie token: `${payloadB64url}.${hmacHex}` where the
// payload is JSON {exp}. The signature uses ADMIN_SESSION_SECRET.

export const ADMIN_COOKIE = "cml_admin";
export const ADMIN_TTL_SECONDS = 12 * 60 * 60; // 12 hours

function adminSecret(): string | null {
  return process.env.ADMIN_SESSION_SECRET || null;
}

/** True when admin login is configured (password + signing secret present). */
export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET);
}

/** Constant-time check of a submitted password against ADMIN_PASSWORD. Both sides
 *  are hashed to a fixed-width digest first, so response timing never leaks the
 *  password's length (a plain safeEqual short-circuits on unequal length). */
export async function verifyAdminPassword(input: unknown): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof input !== "string" || input.length === 0) return false;
  const [a, b] = await Promise.all([sha256Hex(input), sha256Hex(expected)]);
  return safeEqual(a, b);
}

/** Create a signed admin cookie token valid for `ttlSeconds`. nowMs is injected
 *  so the function stays deterministic/testable. */
export async function createAdminToken(nowMs: number, ttlSeconds = ADMIN_TTL_SECONDS): Promise<string> {
  const secret = adminSecret();
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not set");
  const exp = Math.floor(nowMs / 1000) + ttlSeconds;
  const payload = base64UrlEncode(JSON.stringify({ exp }));
  const sig = await hmacSha256Hex(secret, payload);
  return `${payload}.${sig}`;
}

/** Verify a signed admin cookie token (signature + expiry). */
export async function verifyAdminToken(token: string | undefined | null, nowMs: number): Promise<boolean> {
  const secret = adminSecret();
  if (!secret || !token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmacSha256Hex(secret, payload);
  if (!safeEqual(sig, expected)) return false;
  try {
    const data = JSON.parse(base64UrlDecode(payload)) as { exp?: number };
    if (typeof data.exp !== "number") return false;
    return data.exp * 1000 > nowMs;
  } catch {
    return false;
  }
}
