import { cookies } from "next/headers";
import { randomToken, sha256Hex } from "@/lib/crypto";

// Anonymous session continuity. The DB stores only sha256(token); the raw token
// lives in an HTTP-only cookie so the same browser can reload its report for a
// limited time. No personal identity is involved. SERVER ONLY (next/headers).

export const SESSION_COOKIE = "cml_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export function newSessionToken(): string {
  return randomToken(32);
}

export function hashSessionToken(token: string): Promise<string> {
  return sha256Hex(token);
}

export interface ParsedSessionCookie {
  sessionId: string;
  token: string;
}

function parse(value: string | undefined): ParsedSessionCookie | null {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0 || dot >= value.length - 1) return null;
  return { sessionId: value.slice(0, dot), token: value.slice(dot + 1) };
}

/** Persist the session cookie. Call only from a Route Handler / Server Action. */
export async function setSessionCookie(sessionId: string, token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, `${sessionId}.${token}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** Read + parse the current session cookie (sessionId + raw token). */
export async function readSessionCookie(): Promise<ParsedSessionCookie | null> {
  const store = await cookies();
  return parse(store.get(SESSION_COOKIE)?.value);
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
