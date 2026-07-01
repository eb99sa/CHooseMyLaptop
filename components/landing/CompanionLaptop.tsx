"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, Float } from "@react-three/drei";
import { ChromeLaptop, IdleSpin } from "./ChromeLaptop";

// A small, persistent brushed-metal laptop companion pinned to the bottom
// inline-start (RTL) corner. Mounted ONCE in the root layout so the WebGL
// context survives client-side navigations (the root-layout subtree is not
// remounted between routes). Cheap by design: one directional light, a tiny
// frames=1 procedural environment, dpr capped, no ContactShadows / parallax.
//
// Gating mirrors HeroScene: client-only after mount, only where the device is
// desktop-capable (non-reduced-motion, non-coarse-pointer, webgl2 present).
// Additionally hidden on the landing route "/" (the big hero already shows the
// laptop) and on /admin* routes. When gated out it renders null.

const HIDDEN_PREFIXES = ["/admin"]; // route prefixes that suppress the companion

function isHiddenPath(pathname: string | null): boolean {
  if (!pathname) return true; // null during the very first render — stay hidden
  if (pathname === "/") return true; // landing hero owns the laptop there
  return HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function CompanionLaptop() {
  const pathname = usePathname();
  const [use3D, setUse3D] = useState(false);

  // Capability probe runs once post-hydration. Matches HeroScene.
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

  // Path gating is evaluated every render (cheap) so navigating to/from "/" or
  // /admin toggles visibility without touching the WebGL context.
  if (!use3D || isHiddenPath(pathname)) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed bottom-4 start-4 z-20 hidden h-[168px] w-[168px] sm:block"
    >
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        camera={{ position: [0, 0.6, 6], fov: 32, near: 0.1, far: 100 }}
      >
        <Suspense fallback={null}>
          {/* Minimal lighting — a single directional key + soft ambient. */}
          <ambientLight intensity={0.4} />
          <directionalLight position={[4, 6, 5]} intensity={1.1} color="#ffffff" />

          {/* Tiny procedural environment (frames={1} = baked once, then static). */}
          <Environment resolution={128} frames={1}>
            <mesh scale={60}>
              <sphereGeometry args={[1, 24, 24]} />
              <meshBasicMaterial color="#e8ebf0" side={THREE.BackSide} />
            </mesh>
            <Lightformer
              form="rect"
              intensity={6}
              color="#ffffff"
              position={[0, 5, 2]}
              rotation={[-Math.PI / 2, 0, 0]}
              scale={[10, 10, 1]}
            />
            <Lightformer
              form="rect"
              intensity={4}
              color="#ffffff"
              position={[3, 2, 4]}
              rotation={[0, 0, Math.PI / 4]}
              scale={[1.5, 6, 1]}
            />
          </Environment>

          {/* Centered + scaled down. IdleSpin drifts the reflections; Float bobs.
              No MouseParallax — a corner companion shouldn't chase the cursor. */}
          <group scale={0.62}>
            <IdleSpin>
              <Float speed={1.1} rotationIntensity={0.2} floatIntensity={0.6} floatingRange={[-0.06, 0.06]}>
                <ChromeLaptop />
              </Float>
            </IdleSpin>
          </group>
        </Suspense>
      </Canvas>
    </div>
  );
}
