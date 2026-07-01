"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, Float } from "@react-three/drei";
import { RealLaptop } from "./RealLaptop";

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
  const [use3D, setUse3D] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    let webgl = false;
    try {
      webgl = !!document.createElement("canvas").getContext("webgl2");
    } catch {
      webgl = false;
    }
    setUse3D(!reduced && !coarse && webgl);
  }, []);

  if (!use3D) return null;

  // Perf (audit P2): the back-office laptop is closed + static, so skip the WebGL
  // scene entirely on /admin — no reason to run a continuous frameloop there.
  if (pathname?.startsWith("/admin")) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex: -1 }}>
      <Canvas
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        camera={{ position: [0, 0, -30], fov: 35 }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.32} />
          <directionalLight position={[10, 10, 8]} intensity={0.7} color="#ffffff" />

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

          {/* Composed shot: pushed to the LEFT (opposite the RTL copy on the right),
              larger, lower third. rotation[0,π,0] faces the screen at the camera;
              RealLaptop tilts toward the cursor on top of the gentle Float. */}
          <group position={[6, -2, 0]} rotation={[0, Math.PI, 0]} scale={0.95}>
            <Float speed={1} rotationIntensity={0.12} floatIntensity={0.5} floatingRange={[-0.1, 0.1]}>
              <RealLaptop openness={opennessFor(pathname)} />
            </Float>
          </group>
        </Suspense>
      </Canvas>
    </div>
  );
}
