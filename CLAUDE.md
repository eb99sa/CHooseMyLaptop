# CLAUDE.md — working conventions for CHooseMyLaptop

Project context and conventions for anyone (human or agent) working in this repo.
Product/setup docs live in [`README.md`](README.md); the design contract lives in
[`ds-bundle/design.md`](ds-bundle/design.md). This file captures the **non-obvious
rules and gotchas** — read it before editing.

**What this is:** `CHooseMyLaptop / اختر لابتوبي` — an anonymous (no accounts),
**Arabic-first / RTL** AI laptop-buying advisor for non-technical Kuwaiti users,
optimized for ROI. Next.js 16 (App Router) · React 19 · TS · Tailwind v4 · Supabase
(server-only) · OpenRouter (with deterministic fallback).

## Commands

```bash
npm install
npm run dev        # http://localhost:3000  (plain `next dev`)
npm run typecheck  # tsc --noEmit — run after every change
npm run build      # production build
```

- **Port:** `npm run dev` serves on **3000**. The Claude Code *preview* tool launches
  on **5000** via `.claude/launch.json` (`next dev -- -p 5000`) — that 5000 is preview
  tooling only, not the canonical run port.
- **`.next` cache gotcha:** running `npm run build` and then `next dev` against the same
  `.next` dir corrupts the dev cache → **404 on every route**. After any `build`, stop
  dev, delete `.next`, then restart dev. Don't `build` while the dev server is live.

## Architecture (how a recommendation is produced)

Anonymous session = one recommendation attempt. No identity is ever stored; ownership is
proven by an HTTP-only cookie whose **sha256 hash** is in the DB (`lib/session.ts`).

1. **Page 1** (`/sessions/new`) → `POST /api/sessions` → `createAnonymousSession`
   (`lib/services/sessions.ts`) stores `BasicNeeds` and generates AI/fallback follow-up
   questions (`lib/ai/questions.ts`).
2. **Page 2** (`/sessions/[id]/questions`) → `POST /api/sessions/[id]/answers` →
   `saveAnswersAndRecommend` → `buildRecommendation` (`lib/ai/recommend.ts`):
   - **Spec targets** from the AI (`SPEC_SYSTEM` prompt) or the deterministic baseline
     (`fallbackSpecRecommendation` in `lib/scoring.ts`, anchored on `USE_CASE_BASELINES`
     in `lib/constants.ts`). AI output is **merged onto the baseline** so a sparse model
     response can never produce NaN scores.
   - **Deterministic scoring** (`lib/scoring.ts`) — a fixed 7-dimension weighted rubric
     (`RUBRIC_WEIGHTS`); reproducible and auditable, **no AI**.
   - **Picks** (`pickRecommendations`): best_overall / best_budget / best_value / avoid.
   - **Narrative** from the AI (`NARRATIVE_SYSTEM`) or a template.
3. **Report** (`/sessions/[id]/report`) is cookie-gated and re-readable for 7 days.

**Invariants**
- **Server-only DB.** All Supabase access uses the **service-role** client
  (`lib/supabase/service.ts`); the browser never talks to Supabase. RLS is on with no
  policies (deny-by-default). Never expose the service-role key to client code.
- **AI is always optional.** Every AI call has a deterministic fallback and is wrapped so
  a failure degrades to "estimated" output, never a hard error. Keep it that way.
- **Domain contracts** live in `lib/types.ts`; **prompts** are versioned in
  `lib/ai/prompts/index.ts` (bump `PROMPT_VERSION` on any prompt change).
- Secrets live only in `.env.local` (gitignored). Never read/print/commit them.

## Design conventions (Chrome Spec Navigator)

The system is light, near-monochrome; see [`ds-bundle/design.md`](ds-bundle/design.md)
for the full contract. When building UI:

- **Use design tokens, never literal hexes.** Tokens are in `app/globals.css` (a
  `@theme` block + a `:root` foundation).
- **No brand hue.** The one primary CTA per view is carbon `#111`. The only accent is
  neon `--scene-cyan #35e0d8`, allowed **only** in the 3D scene + tiny state dots + the
  focus ring — never as a fill, large surface, or CTA.
- **RTL-first.** `dir="rtl" lang="ar"`; mirror with logical properties. Wrap Latin spec
  codes / KWD prices in `dir="ltr"` or rely on `unicode-bidi: plaintext`. Never
  letter-space Arabic; never thin font weights.
- **Copy** is plain **Kuwaiti colloquial** Arabic — address the user as *you*, the
  product as *we*. No emoji.
- **Prefer Tailwind utilities + token vars over porting `ds-bundle` `.class` CSS.** A
  Tailwind-v4 / Lightning-CSS quirk **silently drops** some hand-ported `@layer
  components` blocks and `calc()` nested inside legacy `rgba(r,g,b, calc(...))` — no
  build warning. Keep only `@keyframes` + tiny `.animate-*` helpers in `globals.css`.
- `--color-faint` (~4.3:1 on canvas) is AA only on white/surface cards; use
  `--color-muted` for body text on the page canvas.
- **WebGL hero:** `components/landing/HeroScene` gates to the static `HeroChrome`
  fallback for SSR / reduced-motion / touch / no-WebGL. The preview *screenshot* tool
  times out on the continuous frameloop (real browsers are fine) — verify the hero via
  console-clean + DOM checks, not screenshots.

**`ds-bundle/` is a git-ignored, regenerable design export — not imported at runtime.**
Trust `ds-bundle/design.md`, `tokens/*.css`, and `components/{core,advisor,results,scene}`;
ignore the compiled `_ds_bundle.*` / `styles.css` (those are a stale **dark** build).
`.design-sync/NOTES.md` documents the bundle *build process*, not project notes.

## Phase 2 (in progress)

Beyond the MVP: full **RAG** over `knowledge_documents` + `knowledge_embeddings`
(`pgvector(1536)` already scaffolded in `supabase/schema.sql`), a real **multi-agent
MECE** simulation engine (today `SPEC_SYSTEM` only *role-plays* a 4-expert team in one
prompt), an upgraded scoring **rubric**, plus store scraping and price tracking. Keep the
deterministic-fallback and server-only invariants when adding these.
