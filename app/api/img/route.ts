import { NextResponse } from "next/server";
import { createServiceClient, isDbConfigured } from "@/lib/supabase/service";
import { safeHttpUrl } from "@/lib/url";

export const runtime = "nodejs";

// GET /api/img?u=<store image url> — same-origin proxy for store product photos.
// Keeps the CSP tight (img-src stays 'self') and avoids hot-linking store CDNs.
//
// SSRF is closed off two ways: (1) the requested URL must EXIST in
// laptop_listings.image_url — an attacker can't point this at an arbitrary host,
// only at images we actually scraped; (2) a defense-in-depth block on
// private/loopback hosts. Any failure returns a neutral placeholder (200), so a
// broken or missing store image never shows a broken-image icon.

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB cap
const FETCH_TIMEOUT_MS = 8000;

// A calm placeholder tile (matches the "Three" surface tones).
const PLACEHOLDER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">' +
  '<rect width="160" height="160" fill="#181818"/>' +
  '<path d="M52 96l20-22 14 15 10-11 16 18H50z" fill="#343434"/>' +
  '<circle cx="62" cy="60" r="9" fill="#343434"/></svg>';

function placeholder(): NextResponse {
  return new NextResponse(PLACEHOLDER_SVG, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

// Defense-in-depth: reject obvious internal targets by hostname/IP literal.
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true; // 172.16.0.0/12
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  return false;
}

export async function GET(req: Request) {
  const safe = safeHttpUrl(new URL(req.url).searchParams.get("u"));
  if (!safe) return placeholder();

  let host: string;
  try {
    host = new URL(safe).hostname;
  } catch {
    return placeholder();
  }
  if (isBlockedHost(host)) return placeholder();

  // Primary SSRF guard: only proxy images that are actually in our catalog.
  if (!isDbConfigured()) return placeholder();
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("laptop_listings")
      .select("id")
      .eq("image_url", safe)
      .limit(1);
    if (error || !data || data.length === 0) return placeholder();
  } catch {
    return placeholder();
  }

  let res: Response;
  try {
    res = await fetch(safe, {
      redirect: "follow",
      headers: { Accept: "image/avif,image/webp,image/*" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return placeholder();
  }

  const ct = res.headers.get("content-type") || "";
  if (!res.ok || !ct.startsWith("image/")) return placeholder();
  if (Number(res.headers.get("content-length") || "0") > MAX_BYTES) return placeholder();

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return placeholder();

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": ct,
      "Content-Length": String(buf.byteLength),
      // Store images are effectively immutable per URL; cache hard at the edge.
      "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
