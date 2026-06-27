// Isomorphic crypto helpers built on the Web Crypto API (globalThis.crypto).
// Works in both the Edge runtime (proxy.ts) and the Node runtime (API routes).
// No Node 'crypto' import, so it stays edge-compatible.

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Cryptographically-random token as a hex string (default 32 bytes). */
export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  return toHex(buf);
}

/** SHA-256 of a UTF-8 string, hex-encoded. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
}

/** HMAC-SHA256(secret, message), hex-encoded. */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return toHex(new Uint8Array(sig));
}

/** Constant-time-ish comparison of two hex strings of equal expected length. */
export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Base64url helpers (for compact signed payloads).
export function base64UrlEncode(input: string): string {
  const b64 =
    typeof btoa === "function"
      ? btoa(input)
      : Buffer.from(input, "utf-8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  return typeof atob === "function"
    ? atob(b64)
    : Buffer.from(b64, "base64").toString("utf-8");
}
