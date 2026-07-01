# Product

## Register

product

## Users

Non-technical, **Arabic-speaking** buyers in Kuwait who do **not** understand
laptop specifications and want to spend their money well. The anchoring persona
is a schoolteacher with a budget around **250 KWD** who can't tell a good CPU
from a bad one and is anxious about overpaying or buying the wrong machine.

Context of use: a one-off, anonymous visit — no account, no login, no saved
profile. The user arrives uncertain, answers a short two-step questionnaire,
reads a ranked recommendation, and leaves. They are mobile-first, read
**right-to-left**, and judge trust in seconds. Many are on mid-range phones and
patchy connections.

## Product Purpose

An AI-assisted laptop-buying **advisor** that turns "I don't know what to buy"
into a clear, ranked, plain-Arabic recommendation optimized for **return on
investment**, not spec bragging. The flow: structured basic needs (+ optional
location) → AI-tailored follow-up questions → a transparent, rubric-scored
report (best overall / best budget / best long-term value / what to avoid) with
honest reasoning for each pick.

Success = a non-technical user finishes the flow, understands *why* a machine
fits their real need and budget, and trusts the recommendation enough to act on
it. The scoring is deterministic and inspectable; every AI call degrades
gracefully to a labelled "estimated" fallback, so the tool is never broken and
never bluffs.

## Brand Personality

Molten ember on gunmetal — **austere, confident, machined**. A matte near-black
dark UI (void `#111` canvas, obsidian `#181818` cards) where a single hot-orange
`#ff4300` spark is rationed to exactly two jobs: the primary action and the
selected state. Nothing else is chromatic. Elevation reads through **tone**, not
shadow or glow; hierarchy comes from **size and colour** over a single heavy
**weight-700** type. The voice is plain Kuwaiti colloquial Arabic that addresses
the user as *you* and the product as *we*; it explains specs as outcomes, never
jargon for its own sake. Emotional goal: replace buying anxiety with grounded
confidence. No hype, no emoji, no salesmanship — the interface earns trust by
being severe, legible, and willing to say where a pick *doesn't* fit. **Dark
theme only** — there is no light mode.

## Anti-references

- **A second chromatic colour.** Ember `#ff4300` is the *only* hue; everything
  else is white / silver / ash on graphite. No blue, no green, no purple accent.
- **Glow and shadow bloom.** No drop shadows, no box-glow, no neon halos —
  elevation is tone-on-tone only.
- **Glassmorphism** and decorative blur.
- **AI-slop decoration:** bento-grid filler, floating particles, spotlight
  sweeps, mascots, a prompt-box hero. This must never look like "a ChatGPT
  wrapper."
- **Gradient text** and gradient fills of any kind.
- **Thin / light font weights** — they wreck Arabic legibility. Weight-700
  everywhere.
- **A light theme.** The system is dark-only; no light surfaces, no inversion.
- **E-commerce clutter** on the result (star-rating spam, "BUY NOW" urgency,
  countdowns, badge soup) — this is an advisor, not a storefront.
- **Spec-sheet intimidation** — walls of raw numbers with no translation into
  what they mean for this buyer.

## Design Principles

1. **The ember is rationed.** One hot spark in a sea of graphite — `#ff4300` is
   spent only on the primary action and the selected state, never as a fill,
   large surface, or decoration. Scarcity is what makes it read as *action*.
2. **Elevation by tone, not shadow.** Cards lift off the void through a lighter
   obsidian surface, not drop shadows or glow. The whole system is matte.
3. **One heavy weight, hierarchy from size + colour.** Type is weight-700
   throughout; importance is signalled by scale and by white-vs-ash contrast,
   not by weight changes or a second colour.
4. **Honesty is a feature.** Every recommendation pairs *why it fits* with
   *where it may not*; estimated data is labelled, never disguised as fact.
5. **Clarity for a non-technical buyer.** Plain Kuwaiti Arabic; specs are
   translated into real-world outcomes, not left as codes.
6. **One high-confidence action per view.** A single ember CTA; the path
   forward is never ambiguous.
7. **Inspectable by design.** The rubric is deterministic and auditable; trust
   comes from being able to see the reasoning, not from a black box.

## Accessibility & Inclusion

- **RTL-first, Arabic-first.** Documents are `dir="rtl" lang="ar"`; layout
  mirrors via logical properties. Latin spec codes and KWD prices are isolated
  (`dir="ltr"` / `unicode-bidi: plaintext`). Never letter-space Arabic; never
  ship thin/light weights (they hurt Arabic legibility).
- **Target: WCAG 2.1 AA.** Body text ≥ 4.5:1 against the dark void/obsidian
  surfaces; ash tones are reserved for secondary text and verified for contrast
  on the darker canvas before use.
- **Reduced motion is respected** globally (`prefers-reduced-motion`), and the
  WebGL hero falls back to a static CSS object for reduced-motion / touch /
  low-power / no-WebGL.
- **Mobile-first.** Primary audience is on phones; touch targets, tap comfort,
  and no horizontal overflow matter more than desktop polish.
- The near-monochrome dark palette keeps the UI robust for low-vision and
  color-blind users; meaning is never carried by the ember accent alone —
  selection and action always pair the `#ff4300` spark with text or shape.
