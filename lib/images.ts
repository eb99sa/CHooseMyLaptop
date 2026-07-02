import { safeHttpUrl } from "@/lib/url";

// Build the URL for a store product image, routed through our same-origin proxy
// (/api/img) so the strict CSP (img-src 'self') is never loosened and store CDNs
// are never hot-linked directly. Returns null when there's no valid image.
export function proxiedImageUrl(raw: string | null | undefined): string | null {
  const safe = safeHttpUrl(raw);
  return safe ? `/api/img?u=${encodeURIComponent(safe)}` : null;
}
