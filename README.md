# CHooseMyLaptop — اختر لابتوبي

An AI-assisted, **Arabic-first / RTL** web app that helps non-technical users pick the
best laptop for their real needs and budget — optimized for **return on investment
(ROI)**, not flashy specs.

The first target persona is an Arabic-speaking teacher in Kuwait with a budget around
**250 KWD** who doesn't understand laptop specifications. The app guides the user
through a short two-step flow, then produces a clear, ranked recommendation report in
plain Kuwaiti Arabic.

> **Anonymous by design.** There are **no accounts, no login, no personal data.** A
> visitor opens the site, answers a few questions, gets a useful recommendation, and
> leaves. Each attempt is a temporary, anonymous session.

---

## 🧩 What this is (engineering highlights)

A production-grade **RAG-powered** recommendation engine wrapped in a WebGL-forward,
RTL, dark-themed UI. The recommendation is grounded in a curated knowledge base,
refined by a multi-agent spec engine, and scored by a deterministic, auditable rubric —
with a deterministic fallback at every tier so an AI outage degrades gracefully instead
of failing.

- **RAG over `pgvector`** — a curated Arabic knowledge corpus embedded with OpenAI
  `text-embedding-3-small` (1536-d), stored in Supabase `pgvector`, retrieved by cosine
  similarity to ground the spec recommendation.
- **Multi-agent MECE spec engine** — four parallel specialist workers (needs / hardware
  / ROI / contrarian) reconciled by a deterministic merge, then refined by a stronger
  synthesizer — all within the request, all with a deterministic floor.
- **Deterministic 7-dimension scoring rubric** — use-case-weighted, reproducible, no AI
  in the scoring path, so every recommendation is inspectable.
- **Offline store scraping** — six Kuwaiti stores + a review source, normalized to a
  canonical schema, per-source full-refresh, never on the request path.
- **3D WebGL hero** — a real MacBook GLTF model (three.js / R3F / drei) with a
  self-hosted Draco decoder (zero runtime network deps), relit and prominent on the
  landing hero, with a pure-CSS static fallback.
- **OWASP-hardened** — Postgres-backed rate limiting, a strict CSP + security headers,
  prompt-injection delimiters, defensive URL validation, and structured audit logging
  (full [OWASP Top 10:2025 + LLM Top 10](#-security) pass).
- **"Three" design system** — a dark, near-monochrome, single-accent UI distilled from
  real-world product-site references and iterated with a design-audit workflow.
- **Anonymous, server-only, deny-by-default** — no accounts; all DB access is
  server-side via the Supabase service role; RLS on with no policies.

---

## ✨ What the app does

1. **Landing page** with an **interactive WebGL 3D laptop hero** (a real MacBook model)
   that gracefully falls back to a static CSS laptop for reduced-motion / touch /
   no-WebGL. No sign-up.
2. **Anonymous two-step needs flow**
   - Page 1 — structured basic needs (budget, use case, portability, …) plus an
     optional, non-intrusive **location** section.
   - Page 2 — **AI-generated** follow-up questions tailored to the answers.
3. **Optional location** — one click uses the browser Geolocation API (only after the
   user clicks), reverse-geocodes via Mapbox to an approximate area, and tunes currency
   + local options. Manual area search and "skip" are always available.
4. **AI spec recommendation** — need summary, minimum specs, ideal specs, *unnecessary*
   specs (to save money), and a fair price range, in Arabic — grounded by RAG when
   enabled and produced by the multi-agent engine.
5. **Laptop matching** — ranks a catalog against the spec targets using a transparent,
   inspectable scoring rubric (no AI).
6. **Recommendation report** — best overall / best budget / best long-term value / best
   to avoid, with score breakdowns and plain-Arabic reasoning, and the **store** each
   listing comes from.
7. **Anonymous session reload** — the same browser can reload its report for 7 days via
   an HTTP-only cookie (no account needed).
8. **Admin dashboard** — separately password-protected; anonymous aggregates only.
9. **CSV export** — anonymous sessions + listings (admin only).

### Works with or without AI keys
If `OPENROUTER_API_KEY` is **not** set, the app uses a **deterministic rule-based
engine** for both the follow-up questions and the recommendation, and clearly labels the
output as *estimated* (`بيانات تقديرية`). RAG is likewise optional and off until
`OPENAI_API_KEY` + the corpus are configured.

---

## 🔒 Privacy model

- **No accounts, no profiles, no identity.** No name, email, phone, or address is ever
  collected or stored.
- **Location is optional and approximate.** Exact coordinates are used only transiently
  during the active request (to reverse-geocode); only the **country / city-or-area** is
  stored on the anonymous session. Exact coordinates are never persisted and never
  appear in admin analytics.
- **Session continuity is cookie-based.** The DB stores only `sha256(token)`; the raw
  token lives in an HTTP-only cookie so the same browser can reload its report until the
  session expires (7 days).

---

## 🧱 Tech stack

| Layer        | Choice                                                                    |
|--------------|---------------------------------------------------------------------------|
| Framework    | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript                |
| Styling      | Tailwind CSS v4 — **"Three"** dark design tokens (`@theme` + `:root`), IBM Plex |
| Database     | Supabase Postgres — **server-only access** via the service role           |
| Vectors      | Supabase **`pgvector`** (1536-d) — curated RAG corpus, `match_knowledge`   |
| AI provider  | OpenRouter (configurable model) + deterministic fallback                  |
| Embeddings   | OpenAI `text-embedding-3-small` (RAG only; OpenRouter serves no embeddings)|
| Geocoding    | Mapbox (server-proxied) — optional, degrades gracefully                   |
| Scraping     | Node scripts + Playwright (headless, Cloudflare-aware) — offline only     |
| 3D           | three.js 0.171 + React Three Fiber 9 + drei 10 — MacBook GLTF, **self-hosted Draco**, static fallback |
| Charts       | Recharts                                                                  |
| Deploy       | Vercel (`vercel.json` pins `npm ci`)                                      |

---

## 🚀 Getting started

### 1. Prerequisites
- Node.js 20.9+
- A free [Supabase](https://supabase.com) project
- (Optional) an [OpenRouter](https://openrouter.ai/keys) key, an
  [OpenAI](https://platform.openai.com/api-keys) key (for RAG), and a
  [Mapbox](https://account.mapbox.com/access-tokens/) token

### 2. Install
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env.local
```
Key variables:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase → Project Settings → API.
- `SUPABASE_SERVICE_ROLE_KEY` — **server only, REQUIRED.** Every DB call uses it (the
  browser never talks to Supabase directly). Project Settings → API → `service_role`.
- `OPENROUTER_API_KEY` (optional) + `OPENROUTER_MODEL` (default `openai/gpt-4o-mini`).
- `OPENROUTER_SYNTH_MODEL` (optional) — stronger model for the multi-agent synthesizer
  (workers use `OPENROUTER_MODEL`); defaults to `OPENROUTER_MODEL`. Set
  `OPENROUTER_MULTI_AGENT=false` to revert to the legacy single-call path.
- `OPENAI_API_KEY` (optional) — enables **RAG** retrieval (`text-embedding-3-small`).
  Without it, retrieval is skipped and the flow is byte-identical. After setting it, run
  `supabase/rag.sql` then `npm run ingest-knowledge`.
- `MAPBOX_TOKEN` (optional) — location search + reverse geocode; if empty, the location
  section falls back to a plain manual text field.
- `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET` — gate the `/admin` area.
- `NEXT_PUBLIC_SITE_URL` — public base URL.

### 4. Set up the database
In the Supabase **SQL Editor**, run **in order**:
1. `supabase/schema.sql` — extensions (`pgcrypto`, `vector`), tables, indexes.
2. `supabase/rls.sql` — enables RLS with **no policies** (deny-by-default; the server
   uses the service role, which bypasses RLS).
3. `supabase/seed.sql` — a small set of **sample** laptop listings, kept as
   **benchmark/test data** (labelled «بيانات تجريبية» wherever they appear). Real data
   comes from the scraper.
4. `supabase/rate-limit.sql` — the `rate_limits` table + `check_rate_limit` RPC that
   throttle `/api/sessions`, `/api/sessions/[id]/answers`, and `/api/admin/login`. The
   app **fails open** (no throttling) until this is applied, so **run it before going
   live.**
5. `supabase/rag.sql` *(only if using RAG)* — the `match_knowledge` cosine-similarity
   function over `pgvector`.

### 5. Ingest real data (optional)
Offline scripts — server-side only, never on the request path:

- **Store catalog** → scrape the supported Kuwaiti stores into `laptop_listings`:
  ```bash
  npm run scrape                       # all sources
  npm run scrape -- --dry-run          # fetch + parse only, no DB write
  npm run scrape -- --source=pckuwait  # one (or a comma-list of) source(s)
  ```
  Re-running a source **replaces its rows**; the seed + other sources stay untouched.
- **Knowledge corpus (RAG)** → set `OPENAI_API_KEY`, run `supabase/rag.sql`, then:
  ```bash
  npm run ingest-knowledge
  ```

### 6. Run
```bash
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run build && npm run start
```

### 7. Admin
Visit `/admin/login` and enter `ADMIN_PASSWORD`. A signed, HTTP-only cookie is set and
the proxy guards all `/admin/*` and `/api/admin/*` routes.

---

## 🧠 How the recommendation works (inspectable by design)

1. **RAG grounding** *(optional)* — the user's needs are turned into an Arabic retrieval
   query, embedded with `text-embedding-3-small`, and matched against the curated corpus
   in `pgvector` (`match_knowledge`); the top chunks are injected into the spec prompt as
   *guidance, not verbatim* (`lib/ai/rag/`).
2. **Multi-agent spec targets** — four cheap parallel workers each own one MECE slice:
   **NeedsAnalyst** (minimum + need summary), **HardwareSpecialist** (ideal),
   **RoiEvaluator** (fair price range), **Contrarian** (unnecessary specs to save money).
   A **deterministic merge** reconciles them onto a baseline (so a sparse model response
   can never produce NaN), then a stronger **synthesizer** refines the spec and writes
   the narrative — all synchronous within the route (`lib/ai/agents.ts`,
   `lib/ai/recommend.ts`). Tiered via `OPENROUTER_SYNTH_MODEL`; kill-switch
   `OPENROUTER_MULTI_AGENT=false` → legacy single call.
3. **Deterministic scoring** — `lib/rubric.ts` + `lib/scoring.ts` score every laptop on
   seven MECE dimensions with **per-use-case weights** (no AI, so scores are reproducible
   and auditable):

   | Dimension                      | Owner (sub-engine)                          |
   |--------------------------------|---------------------------------------------|
   | Use-case fit                   | CPU/RAM/GPU/storage vs. the target band      |
   | Price-to-performance (ROI)     | price position within the AI's fair band     |
   | Build quality & reliability    | brand prior + build signal + rating − age    |
   | Battery & portability          | battery hours + weight vs. target            |
   | Display & comfort              | size/resolution/panel (+ gaming refresh)     |
   | Upgradeability / future-proof  | RAM/storage replaceability                   |
   | Local availability & warranty  | stock + valid URL + listing freshness        |

   Weights come from `USE_CASE_WEIGHTS` (each use-case profile sums to 1.0), so a gaming
   pick and a teaching pick are judged by different priorities.
4. **Picks** — `best_overall`, `best_budget`, `best_value`, and (only when truly weak)
   `avoid`, de-duplicated by listing.
5. **Narrative** — the synthesizer (or a template) writes the closing summary in Arabic.

Every AI call has a deterministic fallback and never hard-errors. Prompts are versioned
in `lib/ai/prompts/index.ts` (`PROMPT_VERSION`).

---

## 🛰️ Store scraping (offline)

A **script-driven, offline-only** pipeline (never on the request path) refreshes the
catalog from Kuwaiti stores. Six store adapters — **PCKuwait** (WooCommerce REST),
**Wibi** (Shopify), **X-cite** (Algolia), **Best Al-Yousifi** (SAP Commerce), **Next**
(sitemap + headless), **4Sale** (classifieds, used) — plus **rtings.com** for
qualitative review text. Each adapter normalizes to a canonical `NormalizedListing`
(specs parsed from titles/descriptions), and the upsert layer applies `safeHttpUrl()`
sanitization before writing. Cloudflare-protected sites use a lazily-launched **Playwright**
headless browser. Re-running a source is a **full refresh** of that source's rows only;
the seed and other sources are never touched.

---

## 🎨 Design system — "Three"

The UI is one dark, near-monochrome design contract called **"Three"** — a matte void
where color is a single deliberate spark. It was distilled from real-world product-site
references and iterated with a design-audit workflow.

- **Void & ink** — canvas `#111` (one step off black), obsidian surfaces `#181818`,
  white ink `#ffffff`, ash muted text `#999` (AA 6.6:1), graphite dividers `#343434`.
  **Elevation is tone only — no shadows, no glow.**
- **One accent** — ember `--color-brand-600 #ff4300`, the *only* chromatic hue,
  reserved for the single primary CTA and selected states (dark `#111` text on it, AA
  5.44:1). Never a large fill.
- **Type** — a single **heavy weight (700)** everywhere; hierarchy comes from size and
  contrast. IBM Plex Sans Arabic (Arabic-first UI) + Inter (Latin display) + IBM Plex
  Mono (Latin spec codes). Never letter-space Arabic.
- **Shape** — soft radii (22px cards, 15px buttons); the pill is gone.
- **RTL-first** — `dir="rtl" lang="ar"`; layout mirrors via logical properties; Latin
  spec codes and KWD prices are isolated (`dir="ltr"` / `unicode-bidi: plaintext`). Copy
  is plain Kuwaiti Arabic — *you* (user) / *we* (product).

**Tokens** live in `app/globals.css` (a `@theme` block + a `:root` foundation) — use the
token vars, never hard-coded hexes. The living design spec is **[`PRODUCT.md`](PRODUCT.md)**
plus the inline comments in `app/globals.css`.

> Tailwind-v4 / Lightning-CSS quirk: some hand-authored `@layer components` `.class`
> blocks are silently dropped. Prefer Tailwind utilities + token vars; for the few
> exceptions, inline styles are used deliberately.

### The 3D hero
`components/landing/BackgroundLaptop` mounts a single WebGL `Canvas` in the root layout
(so the model + context survive route changes; the lid opens/closes per route). It
renders a real **MacBook GLTF** (`mac-draco.glb`, Draco-compressed) via three.js / R3F /
drei, prominent and relit on the landing hero (white key + ember rim so the aluminium
reads against the void), with cursor parallax. The **Draco decoder is self-hosted** in
`public/draco/` so it loads **same-origin** (no gstatic CDN → no CSP hole → zero runtime
network deps). When WebGL is unavailable — `prefers-reduced-motion`, touch, or no WebGL2
— it swaps to a pure-CSS static laptop (`components/landing/StaticLaptop`) so the hero is
never empty.

---

## 🗂️ Project structure

```
app/
  page.tsx                       Landing (3D hero)
  sessions/new/                  Page 1 — basic needs + location
  sessions/[id]/questions/       Page 2 — AI follow-ups
  sessions/[id]/report/          Recommendation report (cookie-gated)
  sessions/[id]/compare/         Comparison table
  admin/…                        Admin dashboard + listings (cookie-gated)
  api/…                          Route handlers (sessions, answers, geocode, admin)
proxy.ts                         Guards /admin/* and /api/admin/* (+ security logging)
components/
  ui/ landing/ forms/ report/ admin/ location/
lib/
  ai/          prompts, agents, merge, recommend, embeddings, rag/
  scrape/      store adapters (sources/), headless browser, upsert
  rubric.ts scoring.ts constants.ts   deterministic scoring engine
  rate-limit.ts log.ts url.ts crypto.ts   security primitives
  supabase/service.ts            Service-role client (the only DB client)
  session.ts admin-auth.ts types.ts validation.ts i18n.ts
public/
  models/mac-draco.glb           the 3D MacBook model
  draco/                         self-hosted Draco decoder (wasm + wrapper)
supabase/
  schema.sql rls.sql seed.sql rate-limit.sql rag.sql   (run in this order)
scripts/
  scrape-stores.mts ingest-knowledge.mts verify-*.mts
```

---

## 🔐 Security

Hardened against the **OWASP Top 10:2025** + **LLM Top 10**. Fundamentals were already
sound (no injection/IDOR/SSRF, server-only DB, deny-by-default RLS, 256-bit session
tokens, HMAC admin cookie, parameterized queries); the hardening closed the gaps:

- **Rate limiting (financial-DoS / brute force)** — a Postgres-backed fixed-window
  limiter (`rate_limits` + `check_rate_limit` RPC) on `/api/sessions` (10/h/IP),
  `/api/sessions/[id]/answers` (30/h/IP), and `/api/admin/login` (8 / 10 min / IP). It
  **fails open until `supabase/rate-limit.sql` is applied.** `/answers` is also
  **idempotent** — a completed session returns its stored report instead of re-running
  the paid pipeline.
- **Security headers + CSP** — HSTS (preload), `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, `poweredByHeader: false`, and a CSP. The CSP
  is dev-aware (`unsafe-eval` dev-only for HMR), allows `blob:` + `wasm-unsafe-eval` for
  the self-hosted Draco/WebGL hero, and restricts `connect-src` to the app's own APIs.
- **Auth** — admin password verified with **hash-both-sides + constant-time `safeEqual`**
  (no length timing leak); signed, expiring (12 h) HMAC-SHA256 admin cookie enforced in
  the `proxy` middleware, with `admin_access_denied` logging.
- **XSS** — `safeHttpUrl()` allows only `http(s)` (blocks `javascript:` / `data:`),
  applied at scrape ingest **and** at render.
- **Prompt injection (LLM01)** — all user text is wrapped in `<user_data>` delimiters
  with guard instructions; prompts are versioned (`PROMPT_VERSION`).
- **Logging & errors** — structured `securityEvent()` audit logs (never secrets); API
  routes return generic `server_error` with no stack traces.
- **Server-only DB.** The browser never holds Supabase credentials; RLS is enabled with
  no policies as defense in depth.

## ⚠️ Data & trust
- The seeded catalog is **sample/estimated data** — not live store prices.
- The UI labels estimated recommendations and reminds users to confirm price and
  availability before buying. Live store availability is **not** faked.

---

## 📦 Deploy (Vercel)
1. Push to a Git repo and import it in Vercel (`vercel.json` pins `npm ci`).
2. Add all environment variables from `.env.example` (especially
   `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`).
3. Set `NEXT_PUBLIC_SITE_URL` to your Vercel URL.
4. Run the Supabase SQL files (incl. **`rate-limit.sql`**) before going live.
5. Deploy.

---

## 🛣️ Still ahead
Price-history + availability monitoring, expanded analytics, full Arabic/English
bilingual UI, a nonce-based CSP (dropping `unsafe-inline`), browser extension, mobile app.
