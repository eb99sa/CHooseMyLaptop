"use client";

import { useEffect, useState } from "react";
import HeroChrome from "./HeroChrome";
import { ChromeScene } from "./ChromeScene";

// Drop-in hero: renders the static CSS chrome object (HeroChrome) for SSR, the
// first client paint, reduced-motion, coarse-pointer (touch), and no-WebGL
// environments; otherwise mounts the interactive WebGL ChromeScene.
export default function HeroScene() {
  const [ready, setReady] = useState(false);
  const [use3D, setUse3D] = useState(false);

  useEffect(() => {
    setReady(true);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    let webgl = false;
    try {
      webgl = !!document.createElement("canvas").getContext("webgl2");
    } catch {
      webgl = false;
    }
    setUse3D(!reduced && !coarse && webgl);

    // Nudge R3F to re-measure inside the absolutely-positioned parent.
    const fire = () => window.dispatchEvent(new Event("resize"));
    const raf = requestAnimationFrame(fire);
    const t = setTimeout(fire, 250);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, []);

  if (!ready || !use3D) return <HeroChrome />;

  return (
    <div className="stage absolute inset-0 -z-10 pointer-events-none" aria-hidden>
      <ChromeScene />
    </div>
  );
}
