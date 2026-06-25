"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PresentationControls, ContactShadows } from "@react-three/drei";
import type { Group } from "three";

// Subtle, low-poly stylized laptop. Brand-colored, slowly auto-rotating.
// Fully client-side: the Canvas only mounts in the browser (mount gate below),
// so this is safe to import normally from the Server Component landing page —
// it never runs Three.js / WebGL during SSR.

const BRAND = "#4f46e5"; // --color-brand-600
const BRAND_DARK = "#3730a3";
const SCREEN_GLOW = "#a5b4fc"; // --color-brand-300

function Laptop() {
  const group = useRef<Group>(null);

  useFrame((_, delta) => {
    if (group.current) {
      // Gentle continuous spin around the vertical axis.
      group.current.rotation.y += delta * 0.35;
    }
  });

  return (
    <group ref={group} position={[0, -0.25, 0]} rotation={[0.05, 0.5, 0]}>
      {/* Base / keyboard deck */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[3, 0.16, 2]} />
        <meshStandardMaterial color={BRAND} metalness={0.4} roughness={0.35} />
      </mesh>

      {/* Trackpad accent */}
      <mesh position={[0, 0.085, 0.5]}>
        <boxGeometry args={[0.9, 0.02, 0.6]} />
        <meshStandardMaterial color={BRAND_DARK} metalness={0.2} roughness={0.5} />
      </mesh>

      {/* Hinge + tilted screen assembly */}
      <group position={[0, 0.08, -1]} rotation={[-1.15, 0, 0]}>
        {/* Screen back panel */}
        <mesh position={[0, 1, 0]} castShadow>
          <boxGeometry args={[3, 2, 0.12]} />
          <meshStandardMaterial color={BRAND_DARK} metalness={0.45} roughness={0.3} />
        </mesh>
        {/* Screen face / glowing display */}
        <mesh position={[0, 1, 0.07]}>
          <boxGeometry args={[2.7, 1.7, 0.02]} />
          <meshStandardMaterial
            color={SCREEN_GLOW}
            emissive={SCREEN_GLOW}
            emissiveIntensity={0.55}
            roughness={0.2}
          />
        </mesh>
      </group>
    </group>
  );
}

function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.8]}
      camera={{ position: [0, 1.2, 6], fov: 38 }}
      gl={{ antialias: true, alpha: true }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 6, 4]} intensity={1.1} castShadow />
        <directionalLight position={[-4, 2, -2]} intensity={0.35} color={SCREEN_GLOW} />

        <PresentationControls
          global
          cursor
          snap
          polar={[-0.15, 0.25]}
          azimuth={[-0.6, 0.6]}
        >
          <Laptop />
        </PresentationControls>

        {/* Lights-only (no Environment preset) so the scene never fetches an
            external HDR at runtime and renders fully offline. */}
        <ContactShadows position={[0, -1.05, 0]} opacity={0.35} scale={9} blur={2.4} far={3} />
      </Suspense>
    </Canvas>
  );
}

export default function Hero3D() {
  // Mount gate: render the WebGL canvas only after hydration, never on the server.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="card h-[320px] w-full overflow-hidden p-0 sm:h-[420px]">
      {mounted ? (
        <Scene />
      ) : (
        <div className="h-full w-full animate-pulse" aria-hidden />
      )}
    </div>
  );
}
