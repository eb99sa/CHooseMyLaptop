"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, Float } from "@react-three/drei";
import { RealLaptop } from "./RealLaptop";
import StaticLaptop from "./StaticLaptop";

// A single realistic laptop that lives in the BACKGROUND of every page (fixed,
// behind content) and changes form — the lid opens/closes — as you navigate.
// Mounted ONCE in the root layout so the WebGL context + model survive route
// changes; only the per-route "openness" changes, which RealLaptop eases into.
//
// Layering: z-index -1 sits above body::before's mist backdrop (also -1, painted
// first in tree order) but below all page content (z-auto), so the laptop floats
// on the mist and the opaque content cards occlude it — a true background.

// How open the lid sits on each route. Navigating between them animates the hinge.
function opennessFor(pathname: string | null): number {
  if (!pathname) return 1;
  if (pathname === "/") return 1; // landing — open, inviting
  if (pathname.startsWith("/admin")) return 0; // back-office — closed
  if (pathname.startsWith("/sessions/new")) return 0.22; // just cracked open
  if (pathname.includes("/questions")) return 0.6; // opening up
  if (pathname.includes("/report")) return 1; // the reveal — fully open
  if (pathname.includes("/compare")) return 0.85;
  return 0.5;
}

export default function BackgroundLaptop() {
  const pathname = usePathname();
  const [caps, setCaps] = useState({ use3D: false, mobile: false });

  useEffect(() => {
    // WebGL2 support is fixed for the session; reduced-motion + viewport can change.
    let webgl = false;
    try {
      webgl = !!document.createElement("canvas").getContext("webgl2");
    } catch {
      webgl = false;
    }
    const reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileMq = window.matchMedia("(max-width: 640px)");
    // Touch is NOT a disqualifier — modern phones run this fine. Only reduced-motion
    // or a missing WebGL2 context fall back to the static laptop.
    const update = () => setCaps({ use3D: !reducedMq.matches && webgl, mobile: mobileMq.matches });
    update();
    reducedMq.addEventListener("change", update);
    mobileMq.addEventListener("change", update);
    return () => {
      reducedMq.removeEventListener("change", update);
      mobileMq.removeEventListener("change", update);
    };
  }, []);

  const { use3D, mobile } = caps;
  const isHero = pathname === "/";

  // No WebGL (reduced-motion / no-WebGL2): render a static CSS laptop on the
  // landing hero so it's never empty; stay out of the way on inner routes.
  if (!use3D) return isHero ? <StaticLaptop /> : null;

  // Perf (audit P2): the back-office laptop is closed + static, so skip the WebGL
  // scene entirely on /admin — no reason to run a continuous frameloop there.
  if (pathname?.startsWith("/admin")) return null;

  // Prominent on the landing hero; a calm ambient background elsewhere. On the
  // hero, mobile gets its own composition (lower + a touch smaller) because the
  // copy fills the whole column instead of leaving the left half open.
  const rig: { pos: [number, number, number]; scale: number; ambient: number; screenGlow: number } =
    !isHero
      ? { pos: [6, -2, 0], scale: 0.95, ambient: 0.32, screenGlow: 1.15 }
      : mobile
        ? { pos: [0.4, -3.1, -1], scale: 0.92, ambient: 0.55, screenGlow: 1.6 }
        : { pos: [4.4, -0.2, -2], scale: 1.3, ambient: 0.5, screenGlow: 1.7 };

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex: -1 }}>
      <Canvas
        dpr={mobile ? [1, 1.5] : [1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        camera={{ position: [0, 0, -30], fov: 35 }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={rig.ambient} />
          <directionalLight position={[10, 10, 8]} intensity={0.7} color="#ffffff" />

          {/* Hero rig: a white key from the front-left + an ember rim so the
              aluminium separates cleanly from the void and reads as the co-star. */}
          {isHero && (
            <>
              <spotLight position={[-7, 7, -9]} angle={0.55} penumbra={0.85} intensity={2.6} color="#ffffff" />
              <pointLight position={[11, 1, 5]} intensity={4.5} distance={22} color="#ff4300" />
            </>
          )}

          {/* Procedural studio env (no network HDRI) — a dark studio dome + dimmer
              softboxes so the aluminium reads as metal in a dark room; the ember
              spill (below) carries the accent, echoing the CTA filament. */}
          <Environment resolution={256} frames={1}>
            <mesh scale={60}>
              <sphereGeometry args={[1, 32, 32]} />
              <meshBasicMaterial color="#14181c" side={THREE.BackSide} />
            </mesh>
            <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 5, 2]} rotation={[-Math.PI / 2, 0, 0]} scale={[10, 10, 1]} />
            <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[5, 3, -4]} rotation={[0, -Math.PI / 3, 0]} scale={[6, 8, 1]} />
            <Lightformer form="rect" intensity={3.6} color="#ffffff" position={[0, 2, 4]} rotation={[0, 0, Math.PI / 4]} scale={[1.5, 8, 1]} />
          </Environment>

          {/* Ember point light so the emissive screen spills onto the deck — the
              product's own light source. */}
          <pointLight position={[6, 1.5, -3]} intensity={6} distance={16} color="#ff4300" />

          {/* Composed shot: pushed to the LEFT (opposite the RTL copy on the right).
              rotation[0,π,0] faces the screen at the camera; RealLaptop tilts
              toward the cursor on top of the gentle Float. */}
          <group position={rig.pos} rotation={[0, Math.PI, 0]} scale={rig.scale}>
            <Float speed={1} rotationIntensity={0.12} floatIntensity={0.5} floatingRange={[-0.1, 0.1]}>
              <RealLaptop openness={opennessFor(pathname)} screenGlow={rig.screenGlow} />
            </Float>
          </group>
        </Suspense>
      </Canvas>
    </div>
  );
}
