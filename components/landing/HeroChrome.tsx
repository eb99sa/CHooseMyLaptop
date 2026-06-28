import type { CSSProperties } from "react";

// Static CSS "chrome" object for the landing hero — the calm, idle fallback for
// the spec scene (low progress, one faint lit core, no markers). Pure CSS/markup
// with no WebGL, so it renders fine as a Server Component. The real interactive
// ChromeScene (laser lines, spec markers, pointer parallax) lands in a later phase.
//
// Layout: the wrapper handles placement (pushed to the inline-end, lifted out of
// the body-text band); the inner .chrome owns the gentle idle float so the two
// transforms don't collide.
export default function HeroChrome() {
  return (
    <div className="stage absolute inset-0 -z-10" aria-hidden>
      <div className="mx-auto flex h-full max-w-6xl items-start px-4">
        <div
          className="shrink-0"
          style={{ marginInlineStart: "auto", marginTop: "clamp(28px, 7vh, 80px)" }}
        >
          <div
            className="chrome animate-floaty"
            style={
              {
                "--chrome-size": "clamp(148px, 19vw, 228px)",
                "--progress": 0.18,
              } as CSSProperties
            }
          >
            <span className="chrome__sheen" />
            <span className="chrome__rings" />
            <span className="chrome__die">
              <span className="chrome__core" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
