// Structured security-event logging. Writes one JSON line to stdout/stderr,
// captured by Vercel logs. NEVER include secrets, passwords, raw tokens, or full
// cookies — only redacted/hashed identifiers and outcomes. Edge- and Node-safe.

type SecurityEvent =
  | "admin_login_success"
  | "admin_login_failure"
  | "admin_access_denied"
  | "rate_limited";

export function securityEvent(
  event: SecurityEvent,
  meta: Record<string, string | number | undefined> = {},
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    kind: "security",
    event,
    ...meta,
  });
  // Failures / denials / throttles are warnings; successes are info.
  if (event === "admin_login_success") console.info(line);
  else console.warn(line);
}
