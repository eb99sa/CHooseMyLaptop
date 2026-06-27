# CHooseMyLaptop — اختر لابتوبي

An AI-assisted, **Arabic-first** web app that helps non-technical users pick the
best laptop for their real needs and budget — optimized for **return on
investment (ROI)**, not flashy specs.

The first target persona is an Arabic-speaking teacher in Kuwait with a budget
around **250 KWD** who doesn't understand laptop specifications. The app guides
the user through a short two-step flow, then produces a clear, ranked
recommendation report in simple Arabic.

> **Anonymous by design.** There are **no accounts, no login, no personal data.**
> A visitor opens the site, answers a few questions, gets a useful recommendation,
> and leaves. Each attempt is a temporary, anonymous session.

> This repository is the **MVP (Phase 1)**. The architecture is intentionally
> ready for Phase 2 (RAG, scraping, multi-agent simulation) without overbuilding
> it now.

---

## ✨ What the MVP does

1. **Landing page** explaining the value, with a subtle 3D laptop visual. No sign-up.
2. **Anonymous two-step needs flow**
   - Page 1 — structured basic needs (budget, use case, portability, …) plus an
     optional, non-intrusive **location** section.
   - Page 2 — **AI-generated** follow-up questions tailored to the answers.
3. **Optional location** — one click uses the browser Geolocation API (only after
   the user clicks), reverse-geocodes via Mapbox to an approximate area, and tunes
   currency + local options. Manual area search and "skip" are always available.
4. **AI spec recommendation** — need summary, minimum specs, ideal specs,
   *unnecessary* specs (to save money), and a fair price range, in Arabic.
5. **Laptop matching** — ranks a catalog against the spec targets using a
   transparent, inspectable scoring rubric.
6. **Recommendation report** — best overall / best budget / best long-term value
   / best to avoid, with score breakdowns and plain-Arabic reasoning.
7. **Anonymous session reload** — the same browser can reload its report for a
   limited time via an HTTP-only cookie (no account needed).
8. **Admin dashboard** — separately password-protected; anonymous aggregates only
   (use cases, budgets, location source, most recommended models, recent events).
9. **CSV export** — anonymous sessions + listings (admin only).

### Works with or without an AI key
If `OPENROUTER_API_KEY` is **not** set, the app uses a **deterministic rule-based
engine** for both the follow-up questions and the recommendation, and clearly
labels the output as *estimated* (`بيانات تقديرية`).

---

## 🔒 Privacy model

- **No accounts, no profiles, no identity.** No name, email, phone, or address is
  ever collected or stored.
- **Location is optional and approximate.** Exact coordinates are used only
  transiently during the active request (to reverse-geocode); only the
  **country / city-or-area** is stored on the anonymous session. Exact
  coordinates are never persisted and never appear in admin analytics.
- **Session continuity is cookie-based.** The DB stores only `sha256(token)`; the
  raw token lives in an HTTP-only cookie so the same browser can reload its report
  until the session expires (7 days).

---

## 🧱 Tech stack

| Layer        | Choice                                                       |
|--------------|-------------------------------------------------------------|
| Framework    | Next.js 16 (App Router) + TypeScript                        |
| Styling      | Tailwind CSS v4 (Arabic RTL, custom design tokens)          |
| Database     | Supabase Postgres — **server-only access** via service role |
| AI provider  | OpenRouter (configurable model) + deterministic fallback    |
| Geocoding    | Mapbox (server-proxied) — optional, degrades gracefully     |
| Vectors      | Supabase `pgvector` (schema scaffolded; used in Phase 2)    |
| Charts       | Recharts                                                    |
| 3D           | three.js + React Three Fiber + drei (subtle, lazy-loaded)   |
| Deploy       | Vercel                                                      |

---

## 🚀 Getting started

### 1. Prerequisites
- Node.js 20.9+
- A free [Supabase](https://supabase.com) project
- (Optional) an [OpenRouter](https://openrouter.ai/keys) key and a
  [Mapbox](https://account.mapbox.com/access-tokens/) token

### 2. Install
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env.local
```
Variables:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase → Project Settings → API.
- `SUPABASE_SERVICE_ROLE_KEY` — **server only, REQUIRED.** Every DB call uses it
  (the browser never talks to Supabase directly). Project Settings → API →
  `service_role` (secret).
- `OPENROUTER_API_KEY` (optional) + `OPENROUTER_MODEL` (default
  `anthropic/claude-3.5-sonnet`).
- `MAPBOX_TOKEN` (optional) — enables location search + reverse geocode; if empty,
  the location section falls back to a plain manual text field.
- `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET` — gate the `/admin` area.
- `NEXT_PUBLIC_SITE_URL` — public base URL.

### 4. Set up the database
In the Supabase **SQL Editor**, run **in order**:
1. `supabase/schema.sql` — tables, indexes, extensions (drops the old
   account-based tables if migrating).
2. `supabase/rls.sql` — enables RLS with **no public policies** (deny-by-default;
   the server uses the service role, which bypasses RLS).
3. `supabase/seed.sql` — ~20 **sample** laptop listings (estimated; replace with
   verified data for production).

### 5. Run
```bash
npm run dev      # http://localhost:3000
npm run build
npm run start
```

### 6. Admin
Visit `/admin/login` and enter `ADMIN_PASSWORD`. A signed, HTTP-only cookie is set
and the proxy guards all `/admin/*` and `/api/admin/*` routes.

---

## 🧠 How the recommendation works (inspectable by design)

1. **Spec targets** — the AI (or the deterministic baseline in
   `lib/constants.ts`) produces minimum + ideal `SpecTarget`s and a fair price
   range, anchored to the use case so it never over-recommends.
2. **Deterministic scoring** — `lib/scoring.ts` scores every laptop on a fixed
   rubric (no AI, so scores are reproducible and auditable):

   | Dimension                      | Weight |
   |--------------------------------|:------:|
   | Use-case fit                   | 30%    |
   | Price-to-performance (ROI)     | 25%    |
   | Build quality & reliability    | 15%    |
   | Battery & portability          | 10%    |
   | Display & comfort              | 10%    |
   | Upgradeability / future-proof  | 5%     |
   | Local availability & warranty  | 5%     |

3. **Picks** — `best_overall`, `best_budget`, `best_value`, and (only when truly
   weak) `avoid`, de-duplicated by listing.
4. **Narrative** — the AI (or a template) writes the closing summary in Arabic.
   When location is available the AI considers local currency/availability; when
   not, it says nearby-store suggestions require a location and never fakes it.

Prompts are versioned in `lib/ai/prompts/index.ts` (`PROMPT_VERSION`).

---

## 🗂️ Project structure

```
app/
  page.tsx                       Landing (anonymous, static)
  sessions/new/                  Page 1 — basic needs + location
  sessions/[id]/questions/       Page 2 — AI follow-ups
  sessions/[id]/report/          Recommendation report (cookie-gated)
  sessions/[id]/compare/         Comparison table
  admin/login/                   Admin password login
  admin/, admin/listings/        Admin dashboard + listings (cookie-gated)
  api/sessions, api/geocode,     Route handlers
  api/admin/login, api/admin/export
proxy.ts                         Guards /admin/* and /api/admin/* only
components/
  ui/ landing/ forms/ report/ admin/ location/
lib/
  types.ts                       Shared domain contracts (anonymous session)
  crypto.ts                      Web Crypto helpers (edge + node)
  session.ts                     Session cookie + token hashing
  admin-auth.ts admin-cookies.ts Admin password + signed cookie
  supabase/service.ts            Service-role client (the only DB client)
  scoring.ts constants.ts geo.ts AI/scoring/geo logic
  ai/ data/ services/ validation.ts i18n.ts
supabase/
  schema.sql  rls.sql  seed.sql  Database setup (run in this order)
```

---

## 🔐 Security notes
- **Server-only DB access.** The browser never holds Supabase credentials. All
  reads/writes go through Next.js route handlers / server components using the
  service-role key. RLS is enabled with no policies (deny-by-default) as defense
  in depth.
- **Session ownership** is proven by a cookie token whose hash is stored in the
  DB — not by an account.
- **Admin** is a separate password + signed HTTP-only cookie, enforced both in the
  `proxy` and in each admin route/page.

## ⚠️ Data & trust
- The seeded catalog is **sample/estimated data** — not live store prices.
- The UI labels estimated recommendations and reminds users to confirm price and
  availability before buying. Live store availability is **not** faked.

---

## 🛣️ Phase 2 (not in this build)
Automated multi-store scraping, full RAG with vector search, price-history
tracking, availability monitoring, university/major research automation, the
multi-agent MECE simulation engine, advanced analytics, price-drop alerts, full
Arabic/English bilingual UI, browser extension, mobile app.

---

## 📦 Deploy (Vercel)
1. Push to a Git repo and import it in Vercel.
2. Add all environment variables from `.env.example` (especially
   `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`).
3. Set `NEXT_PUBLIC_SITE_URL` to your Vercel URL.
4. Deploy.
