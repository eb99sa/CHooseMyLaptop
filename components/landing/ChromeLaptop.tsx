"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

const SCENE_CYAN = "#35e0d8"; // --scene-cyan — the single neon accent

// Polished chrome — fully metallic, low roughness, reads bright on the light
// page because the procedural <Environment> supplies white softbox streaks.
const CHROME = {
  color: "#ffffff",
  metalness: 1,
  roughness: 0.08,
  envMapIntensity: 1.5,
  clearcoat: 1,
  clearcoatRoughness: 0.1,
} as const;

// A stylized chrome open laptop built from primitives (no external model).
export function ChromeLaptop() {
  return (
    <group rotation={[0.12, -0.5, 0]}>
      {/* keyboard deck */}
      <mesh>
        <boxGeometry args={[3, 0.16, 2]} />
        <meshPhysicalMaterial {...CHROME} />
      </mesh>
      {/* trackpad — slightly rougher so it reads as a distinct surface */}
      <mesh position={[0, 0.09, 0.5]}>
        <boxGeometry args={[0.9, 0.02, 0.6]} />
        <meshPhysicalMaterial {...CHROME} roughness={0.18} />
      </mesh>
      {/* reclined screen assembly */}
      <group position={[0, 0.08, -1]} rotation={[-1.2, 0, 0]}>
        {/* lid (chrome) */}
        <mesh position={[0, 1, 0]}>
          <boxGeometry args={[3, 2, 0.1]} />
          <meshPhysicalMaterial {...CHROME} />
        </mesh>
        {/* emissive cyan panel — the screen glow */}
        <mesh position={[0, 1, 0.07]}>
          <boxGeometry args={[2.7, 1.7, 0.02]} />
          <meshStandardMaterial
            color="#0b1416"
            emissive={SCENE_CYAN}
            emissiveIntensity={1.05}
            metalness={0}
            roughness={0.4}
            toneMapped={false}
          />
        </mesh>
        {/* brighter cyan core — the focal blob */}
        <mesh position={[0, 1, 0.085]}>
          <circleGeometry args={[0.34, 48]} />
          <meshBasicMaterial color={SCENE_CYAN} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

// Pointer parallax — gently rotates toward the cursor. Adapted from the
// previous Hero3D. No-op without a moving pointer (touch falls back upstream).
export function MouseParallax({ children }: { children: React.ReactNode }) {
  const ref = useRef<Group>(null);
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      target.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const k = Math.min(1, dt * 2.2);
    g.rotation.y += (target.current.x * 0.26 - g.rotation.y) * k;
    g.rotation.x += (-target.current.y * 0.14 - g.rotation.x) * k;
  });

  return <group ref={ref}>{children}</group>;
}

// Calm idle sway (a gentle oscillation, not a full spin) so reflections drift
// across the chrome while the screen stays facing the viewer.
export function IdleSpin({ children }: { children: React.ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.25) * 0.18;
  });
  return <group ref={ref}>{children}</group>;
}
