"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Edges, PresentationControls } from "@react-three/drei";
import type { Group } from "three";

// Dark, techno "forest haze" laptop: matte charcoal volumes outlined with thin
// neon-mint edges, a glowing screen, and a fading neon floor grid. Fully
// client-side via a mount gate, so it never runs WebGL during SSR.

const NEON = "#2bd693";
const NEON_BRIGHT = "#76f6c8";
const BODY = "#0e1512"; // matte forest charcoal
const SCREEN = "#0a3a2a";

function Laptop() {
  const group = useRef<Group>(null);

  useFrame((_, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.3; // calm, continuous spin
    }
  });

  return (
    <group ref={group} position={[0, -0.2, 0]} rotation={[0.06, 0.5, 0]}>
      {/* Base / keyboard deck */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[3, 0.16, 2]} />
        <meshStandardMaterial color={BODY} metalness={0.5} roughness={0.45} />
        <Edges threshold={15} color={NEON} />
      </mesh>

      {/* Trackpad accent (glowing hairline rectangle) */}
      <mesh position={[0, 0.09, 0.5]}>
        <boxGeometry args={[0.9, 0.02, 0.6]} />
        <meshStandardMaterial color={BODY} />
        <Edges threshold={15} color={NEON_BRIGHT} />
      </mesh>

      {/* Tilted screen assembly */}
      <group position={[0, 0.08, -1]} rotation={[-1.15, 0, 0]}>
        <mesh position={[0, 1, 0]}>
          <boxGeometry args={[3, 2, 0.1]} />
          <meshStandardMaterial color={BODY} metalness={0.5} roughness={0.4} />
          <Edges threshold={15} color={NEON} />
        </mesh>
        {/* Emissive neon display */}
        <mesh position={[0, 1, 0.07]}>
          <boxGeometry args={[2.7, 1.7, 0.02]} />
          <meshStandardMaterial
            color={SCREEN}
            emissive={NEON}
            emissiveIntensity={0.7}
            roughness={0.3}
          />
          <Edges threshold={15} color={NEON_BRIGHT} />
        </mesh>
      </group>
    </group>
  );
}

function Scene() {
  return (
    <Canvas
      shadows={false}
      dpr={[1, 2]}
      camera={{ position: [0, 1.1, 6], fov: 40 }}
      gl={{ antialias: true, alpha: true }}
    >
      {/* Haze: fog dissolves the grid and far edges into the dark. */}
      <fog attach="fog" args={["#0a0e0d", 6, 16]} />
      <Suspense fallback={null}>
        <ambientLight intensity={0.35} />
        <pointLight position={[3, 4, 3]} intensity={28} color={NEON_BRIGHT} distance={20} />
        <pointLight position={[-4, 1, -3]} intensity={14} color={"#1f6f5a"} distance={18} />

        <PresentationControls
          global
          cursor
          snap
          polar={[-0.12, 0.22]}
          azimuth={[-0.6, 0.6]}
        >
          <Laptop />
        </PresentationControls>

        {/* Thin neon floor grid, fading into the fog. */}
        <gridHelper
          args={[40, 40, NEON, "#13302a"]}
          position={[0, -1.15, 0]}
        />
      </Suspense>
    </Canvas>
  );
}

export default function Hero3D() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="card h-[320px] w-full overflow-hidden p-0 sm:h-[440px]">
      {mounted ? (
        <Scene />
      ) : (
        <div className="h-full w-full animate-pulse" aria-hidden />
      )}
    </div>
  );
}
