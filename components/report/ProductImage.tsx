"use client";

import { useState } from "react";

// Product thumbnail for a laptop card. Client-side so a proxied image that fails
// to load (rare — the proxy already returns a placeholder on server errors) hides
// cleanly instead of showing a broken-image icon. src is always our /api/img URL.
export function ProductImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)]">
      {/* eslint-disable-next-line @next/next/no-img-element -- proxied same-origin image, not from next/image */}
      <img
        src={src}
        alt={alt}
        width={64}
        height={64}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain p-1.5"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
