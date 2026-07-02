import type { CSSProperties } from "react";

// The no-WebGL / reduced-motion / touch fallback for the hero laptop. Pure
// CSS/markup (renders fine without a WebGL context and carries no motion, so it
// satisfies prefers-reduced-motion), sat in the same fixed background layer as
// the real 3D canvas and pushed to the inline-end (the left, in RTL) so it lands
// where the WebGL laptop would — the copy keeps the other half. Aluminium deck +
// an ember screen echoing the CTA spark.
//
// Styles are INLINE by design: a Tailwind-v4 / Lightning-CSS quirk silently drops
// some hand-authored `.class` blocks in globals.css, so we don't route through one.
const lid: CSSProperties = {
  aspectRatio: "16 / 10",
  padding: 7,
  borderRadius: "14px 14px 5px 5px",
  background: "linear-gradient(158deg, #3d3d40 0%, #202023 56%, #2e2e31 100%)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), inset 0 0 0 1px rgba(255,255,255,0.05)",
};
const screen: CSSProperties = {
  height: "100%",
  borderRadius: 7,
  background:
    "radial-gradient(120% 135% at 50% 38%, #ff5a1f 0%, #ff4300 15%, rgba(255,67,0,0.16) 46%, #0b1013 76%)",
  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.55), inset 0 0 34px rgba(255,67,0,0.22)",
};
const deck: CSSProperties = {
  position: "relative",
  width: "132%",
  height: 15,
  margin: "0 -16%",
  borderRadius: "3px 3px 11px 11px",
  background: "linear-gradient(180deg, #35353a 0%, #26262a 34%, #141417 100%)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22)",
  clipPath: "polygon(4% 0, 96% 0, 100% 100%, 0 100%)",
};
const hinge: CSSProperties = {
  position: "absolute",
  top: 0,
  left: "50%",
  width: "22%",
  height: 3,
  transform: "translateX(-50%)",
  borderRadius: "0 0 4px 4px",
  background: "#0d0d0f",
};

export default function StaticLaptop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex: -1 }}>
      <div className="mx-auto flex h-full max-w-6xl items-center px-4">
        <div
          style={{
            marginInlineStart: "auto",
            width: "clamp(230px, 27vw, 380px)",
            filter: "drop-shadow(0 30px 42px rgba(0,0,0,0.72))",
          }}
        >
          <div style={lid}>
            <div style={screen} />
          </div>
          <div style={deck}>
            <div style={hinge} />
          </div>
        </div>
      </div>
    </div>
  );
}
