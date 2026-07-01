import type { NextConfig } from "next";

// Content-Security-Policy note: 'unsafe-inline' is present for script-src and
// style-src because Next.js injects inline runtime/bootstrap scripts and inline
// styles without a nonce unless a full nonce-propagation setup is wired in. This
// is the pragmatic trade-off for now; the future hardening is a nonce-based CSP
// (per-request nonce via middleware + strict-dynamic) that drops 'unsafe-inline'.
// Dev needs 'unsafe-eval' for Next's HMR / react-refresh; production omits it.
const SCRIPT_SRC =
  process.env.NODE_ENV === "production"
    ? "'self' 'unsafe-inline'"
    : "'self' 'unsafe-inline' 'unsafe-eval'";
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src ${SCRIPT_SRC}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // blob: — three.js/GLTFLoader loads embedded textures and the Draco decoder via blob URLs.
  "connect-src 'self' blob: https://api.mapbox.com https://api.openai.com https://openrouter.ai",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // three.js ships untranspiled ESM that some toolchains need help with.
  transpilePackages: ["three"],
  // Don't advertise the framework (A02: security misconfiguration).
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "Content-Security-Policy",
            value: CONTENT_SECURITY_POLICY,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
