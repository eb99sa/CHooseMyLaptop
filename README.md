# CHooseMyLaptop — اختر لابتوبي

An AI-assisted, **Arabic-first** web app that helps non-technical users pick the
best laptop for their real needs and budget — optimized for **return on
investment (ROI)**, not flashy specs.

The first target persona is an Arabic-speaking teacher in Kuwait with a budget
around **250 KWD** who doesn't understand laptop specifications. The app guides
the user through a short two-step flow, then produces a clear, ranked
recommendation report in simple Arabic.

> This repository is the **MVP (Phase 1)**. The architecture is intentionally
> ready for Phase 2 (RAG, scraping, multi-agent simulation) without overbuilding
> it now.

---

## ✨ What the MVP does

1. **Landing page** explaining the value, with a subtle 3D laptop visual.
2. **Magic-link authentication** (Supabase Auth, passwordless).
3. **Two-step needs flow**
   - Page 1 — structured basic needs (budget, use case, portability, …).
   - Page 2 — **AI-generated** follow-up questions tailored to the answers.
4. **AI spec recommendation** — need summary, minimum specs, ideal specs,
   *unnecessary* specs (to save money), and a fair price range, in Arabic.
5. **Laptop matching** — ranks a catalog of laptops against the spec targets
   using a transparent, inspectable scoring rubric.
6. **Recommendation report** — best overall / best budget / best long-term value
   / best to avoid, with score breakdowns and plain-Arabic reasoning.
7. **Admin dashboard** — sessions, popular use cases, common budgets, most
   recommended models, failed/incomplete sessions, recent activity, charts.
8. **CSV export** — sessions, answers, listings, recommendation results.

### Works with or without an AI key
If `OPENROUTER_API_KEY` is **not** set, the app uses a **deterministic
rule-based engine** for both the follow-up questions and the recommendation, and
clearly labels the output as *estimated* (`بيانات تقديرية`). This keeps the app
fully demoable without any AI provider.

---

## 🧱 Tech stack

| Layer        | Choice                                                       |
|--------------|-------------------------------------------------------------|
| Framework    | Next.js 16 (App Router) + TypeScript                        |
| Styling      | Tailwind CSS v4 (Arabic RTL, custom design tokens)          |
| Auth + DB    | Supabase (Postgres, Auth magic link, RLS)                   |
| AI provider  | OpenRouter (configurable model) + deterministic fallback    |
| Vectors      | Supabase `pgvector` (schema scaffolded; used in Phase 2)    |
| Charts       | Recharts                                                    |
| 3D           | three.js + React Three Fiber + drei (subtle, lazy-loaded)   |
| Deploy       | Vercel                                                      |

---

## 🚀 Getting started

### 1. Prerequisites
- Node.js 20.9+ (tested on Node 24)
- A free [Supabase](https://supabase.com) project
- (Optional) an [OpenRouter](https://openrouter.ai/keys) API key

### 2. Install
```bash
npm install
```

### 3. Configure environment
Copy the example and fill it in:
```bash
cp .env.example .env.local
```
Key variables (see `.env.example` for the full list):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase →
  Project Settings → API.
- `SUPABASE_SERVICE_ROLE_KEY` — **server only**; powers the admin dashboard,
  CSV export, and seeding.
- `OPENROUTER_API_KEY` (optional) and `OPENROUTER_MODEL` (default
  `anthropic/claude-3.5-sonnet`).
- `ADMIN_EMAILS` — comma-separated emails allowed into `/admin`.
- `NEXT_PUBLIC_SITE_URL` — used to build magic-link redirect URLs.

### 4. Set up the database
In the Supabase **SQL Editor**, run these files **in order**:
1. `supabase/schema.sql` — tables, indexes, triggers, extensions.
2. `supabase/rls.sql` — Row Level Security policies.
3. `supabase/seed.sql` — ~20 **sample** laptop listings (clearly labeled as
   estimated; replace with verified data for production).

### 5. Enable magic-link auth
In Supabase → **Authentication → Providers → Email**, enable email/magic link.
Add your site URL and `…/auth/callback` under **URL Configuration → Redirect URLs**
(e.g. `http://localhost:3000/auth/callback` and your Vercel URL).

### 6. Run
```bash
npm run dev      # http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
```

---

## 🧠 How the recommendation works (inspectable by design)

The recommendation pipeline (`lib/ai/recommend.ts`) is split so the logic stays
explainable:

1. **Spec targets** — the AI (or the deterministic baseline in
   `lib/constants.ts`) produces minimum + ideal `SpecTarget`s and a fair price
   range, anchored to the use case so it never over-recommends.
2. **Deterministic scoring** — `lib/scoring.ts` scores every laptop on a fixed
   rubric (no AI involved here, so scores are reproducible and auditable):

   | Dimension                      | Weight |
   |--------------------------------|:------:|
   | Use-case fit                   | 30%    |
   | Price-to-performance (ROI)     | 25%    |
   | Build quality & reliability    | 15%    |
   | Battery & portability          | 10%    |
   | Display & comfort              | 10%    |
   | Upgradeability / future-proof  | 5%     |
   | Local availability & warranty  | 5%     |

   Each laptop gets a `fit_score`, `roi_score`, and a rubric-weighted
   `final_score` (0–100) plus Arabic reasons and warnings.
3. **Picks** — `best_overall`, `best_budget`, `best_value`, and (only when truly
   weak) `avoid`.
4. **Narrative** — the AI (or a template) writes the closing summary in Arabic.

**Prompts are versioned** in `lib/ai/prompts/index.ts` (`PROMPT_VERSION`). The
system prompts encode the MECE "expert panel" mindset (needs analyst, hardware
specialist, ROI evaluator, contrarian) as guidance for the model; the full
multi-agent simulation engine is a Phase 2 item.

---

## 🗂️ Project structure

```
app/
  page.tsx                       Landing
  login/, auth/callback/         Magic-link auth
  dashboard/                     User dashboard
  sessions/new/                  Page 1 — basic needs
  sessions/[id]/questions/       Page 2 — AI follow-ups
  sessions/[id]/report/          Recommendation report
  sessions/[id]/compare/         Comparison table
  admin/, admin/listings/        Admin dashboard + listings
  api/                           Route handlers (sessions, ai, admin/export)
components/
  ui/                            Design-system primitives
  landing/ forms/ report/ dashboard/ admin/
lib/
  types.ts                       Shared domain contracts
  constants.ts                   Rubric weights + use-case baselines
  i18n.ts                        Arabic UI strings + catalogs
  scoring.ts                     Deterministic scoring engine
  ai/                            OpenRouter client, prompts, questions, recommend
  supabase/                      Browser/server/admin clients + middleware
  data/ services/ validation.ts  Data access + orchestration + input validation
supabase/
  schema.sql  rls.sql  seed.sql  Database setup (run in this order)
```

---

## 🔐 Security notes
- **RLS everywhere.** Users can only read/write their own profile, sessions,
  answers, questions, and results. The laptop catalog is public-read; writes use
  the service-role key only.
- The **service-role key is server-only** (`lib/supabase/admin.ts`) and never
  imported into client code.
- Admin access is gated by `ADMIN_EMAILS` and checked server-side on every admin
  route and the CSV export endpoint.

## ⚠️ Data & trust
- The seeded catalog is **sample/estimated data** — not live store prices.
- The UI labels estimated recommendations and reminds users to confirm price and
  availability before buying. Live store availability is **not** faked.

---

## 🛣️ Phase 2 (not in this build)
Automated multi-store scraping, full RAG with vector search, price-history
tracking, availability monitoring, university/major research automation, the
multi-agent MECE simulation engine, advanced analytics, saved history,
price-drop alerts, full Arabic/English bilingual UI, browser extension, mobile app.

---

## 📦 Deploy (Vercel)
1. Push to a Git repo and import it in Vercel.
2. Add all environment variables from `.env.example`.
3. Set `NEXT_PUBLIC_SITE_URL` to your Vercel URL and add `…/auth/callback` to the
   Supabase redirect URLs.
4. Deploy.
