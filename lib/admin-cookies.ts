import { cookies } from "next/headers";
import { ADMIN_COOKIE, ADMIN_TTL_SECONDS, verifyAdminToken } from "@/lib/admin-auth";

// Server-only admin cookie helpers (next/headers). Kept separate from
// lib/admin-auth.ts so the Edge proxy can import the pure verify logic without
// pulling in next/headers.

export async function setAdminCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_TTL_SECONDS,
  });
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

/** True when the current request carries a valid admin cookie. */
export async function isAdminRequest(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminToken(store.get(ADMIN_COOKIE)?.value, Date.now());
}
