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

Calm, precise, and quietly premium — **Apple-keynote restraint meets a chrome
hardware demo**. Three words: **disciplined, honest, decisive.** The voice is
plain Kuwaiti colloquial Arabic that addresses the user as *you* and the product
as *we*; it explains specs as outcomes, never jargon for its own sake. Emotional
goal: replace buying anxiety with grounded confidence. No hype, no emoji, no
salesmanship — the interface earns trust by being legible, monochrome, and
willing to say where a pick *doesn't* fit.

## Anti-references

- **AI-SaaS tropes:** pastel purple/blue gradients, glowing blobs, robot/AI
  mascot art, a prompt-box hero. This must never look like "a ChatGPT wrapper."
- **Glassmorphism-everywhere** and decorative blur.
- **Dark cyberpunk overload** — neon is confined to the 3D scene and tiny state
  dots, never the surrounding UI.
- **E-commerce clutter** on the result (star-rating spam, "BUY NOW" urgency,
  countdowns, badge soup) — this is an advisor, not a storefront.
- **Colored / saturated CTAs.** The one primary action per view is carbon black.
- **Spec-sheet intimidation** — walls of raw numbers with no translation into
  what they mean for this buyer.

## Design Principles

1. **Premium restraint over decoration.** Every effect must serve
   understanding, comparison, trust, or forward action — or it's cut.
2. **Honesty is a feature.** Every recommendation pairs *why it fits* with
   *where it may not*; estimated data is labelled, never disguised as fact.
3. **Clarity for a non-technical buyer.** Plain Kuwaiti Arabic; specs are
   translated into real-world outcomes, not left as codes.
4. **One high-confidence action per view.** A single carbon CTA; the path
   forward is never ambiguous.
5. **The scene explains the decision.** The chrome/neon 3D scene reacts to the
   user's answers — it's part of the reasoning, not spectacle, and always has a
   working static fallback.
6. **Inspectable by design.** The rubric is deterministic and auditable; trust
   comes from being able to see the reasoning, not from a black box.

## Accessibility & Inclusion

- **RTL-first, Arabic-first.** Documents are `dir="rtl" lang="ar"`; layout
  mirrors via logical properties. Latin spec codes and KWD prices are isolated
  (`dir="ltr"` / `unicode-bidi: plaintext`). Never letter-space Arabic; never
  ship thin/light weights (they hurt Arabic legibility).
- **Target: WCAG 2.1 AA.** Body text ≥ 4.5:1; `--color-faint` is AA only on
  white/surface cards — `--color-muted` is required for secondary text on the
  page canvas.
- **Reduced motion is respected** globally (`prefers-reduced-motion`), and the
  WebGL hero falls back to a static CSS object for reduced-motion / touch /
  low-power / no-WebGL.
- **Mobile-first.** Primary audience is on phones; touch targets, tap comfort,
  and no horizontal overflow matter more than desktop polish.
- Carbon-on-white monochrome keeps the UI robust for low-vision and
  color-blind users; meaning is never carried by the neon accent alone.
