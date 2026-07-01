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

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex: -1 }}>
      <Canvas
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        camera={{ position: [0, 0, -30], fov: 35 }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 8]} intensity={1.1} color="#ffffff" />

          {/* Procedural studio env (no network HDRI) — a light dome + white
              softboxes so the aluminium reads bright on the light page. */}
          <Environment resolution={256} frames={1}>
            <mesh scale={60}>
              <sphereGeometry args={[1, 32, 32]} />
              <meshBasicMaterial color="#e8ebf0" side={THREE.BackSide} />
            </mesh>
            <Lightformer form="rect" intensity={5} color="#ffffff" position={[0, 5, 2]} rotation={[-Math.PI / 2, 0, 0]} scale={[10, 10, 1]} />
            <Lightformer form="rect" intensity={4} color="#ffffff" position={[5, 3, -4]} rotation={[0, -Math.PI / 3, 0]} scale={[6, 8, 1]} />
            <Lightformer form="rect" intensity={6} color="#ffffff" position={[0, 2, 4]} rotation={[0, 0, Math.PI / 4]} scale={[1.5, 8, 1]} />
          </Environment>

          {/* Composed shot: shifted toward the inline-start, lower third, so page
              copy/cards stay clear. rotation[0,π,0] faces the screen at the camera. */}
          <group position={[-7, -2.2, 0]} rotation={[0, Math.PI, 0]} scale={0.72}>
            <Float speed={1} rotationIntensity={0.16} floatIntensity={0.5} floatingRange={[-0.1, 0.1]}>
              <RealLaptop openness={opennessFor(pathname)} />
            </Float>
          </group>
        </Suspense>
      </Canvas>
    </div>
  );
}
