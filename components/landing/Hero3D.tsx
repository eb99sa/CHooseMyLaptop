"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Edges, Float } from "@react-three/drei";
import type { Group, Points as ThreePoints } from "three";

// Full-bleed, interactive ISOMETRIC space scene: a cluster of low-poly laptops
// floating in deep space, outlined with thin sky-accent edges, drifting with a
// gentle bob, reacting to the pointer via parallax, over a slow-turning
// starfield and depth fog. Decorative background — content floats over it.
// Orthographic camera = true isometric. Perf: ortho, dpr cap, shared lights,
// no per-frame allocation.

const ACCENT = "#5fb6ff";
const ACCENT_SOFT = "#2c6fa8";
const BODY = "#101a31";
const SCREEN = "#123455";

function Laptop() {
  return (
    <group>
      {/* keyboard deck */}
      <mesh>
        <boxGeometry args={[3, 0.16, 2]} />
        <meshStandardMaterial color={BODY} metalness={0.4} roughness={0.5} />
        <Edges threshold={15} color={ACCENT} />
      </mesh>
      {/* trackpad hairline */}
      <mesh position={[0, 0.09, 0.5]}>
        <boxGeometry args={[0.9, 0.02, 0.6]} />
        <meshStandardMaterial color={BODY} />
        <Edges threshold={15} color={ACCENT_SOFT} />
      </mesh>
      {/* tilted screen */}
      <group position={[0, 0.08, -1]} rotation={[-1.2, 0, 0]}>
        <mesh position={[0, 1, 0]}>
          <boxGeometry args={[3, 2, 0.1]} />
          <meshStandardMaterial color={BODY} metalness={0.4} roughness={0.45} />
          <Edges threshold={15} color={ACCENT} />
        </mesh>
        <mesh position={[0, 1, 0.07]}>
          <boxGeometry args={[2.7, 1.7, 0.02]} />
          <meshStandardMaterial
            color={SCREEN}
            emissive={ACCENT}
            emissiveIntensity={0.5}
            roughness={0.3}
          />
        </mesh>
      </group>
    </group>
  );
}

interface Item {
  pos: [number, number, number];
  rot: [number, number, number];
  scale: number;
  speed: number;
}

const ITEMS: Item[] = [
  { pos: [0, 0, 0], rot: [0, 0.4, 0], scale: 1, speed: 1.1 },
  { pos: [-3.3, 1.2, -1.6], rot: [0, -0.35, 0], scale: 0.55, speed: 1.7 },
  { pos: [3.1, -0.7, -1.2], rot: [0, 0.8, 0], scale: 0.68, speed: 1.0 },
  { pos: [1.7, 1.9, -3], rot: [0, -0.6, 0], scale: 0.42, speed: 2.0 },
  { pos: [-2.3, -1.5, -2.6], rot: [0, 0.2, 0], scale: 0.5, speed: 1.4 },
];

function MouseParallax({ children }: { children: React.ReactNode }) {
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
    g.rotation.y += (target.current.x * 0.28 - g.rotation.y) * k;
    g.rotation.x += (-target.current.y * 0.16 - g.rotation.x) * k;
  });

  return <group ref={ref}>{children}</group>;
}

function Starfield() {
  const ref = useRef<ThreePoints>(null);
  const positions = useMemo(() => {
    const n = 260;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 36;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 24;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 30 - 6;
    }
    return arr;
  }, []);

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.02;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#cfe3ff"
        sizeAttenuation
        transparent
        opacity={0.8}
        depthWrite={false}
      />
    </points>
  );
}

function Scene() {
  return (
    <Canvas
      orthographic
      dpr={[1, 2]}
      camera={{ position: [7, 5.5, 7], zoom: 74, near: -50, far: 100 }}
      gl={{ antialias: true, alpha: true }}
    >
      <fog attach="fog" args={["#080a12", 11, 30]} />
      <Suspense fallback={null}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[6, 10, 4]} intensity={1.2} />
        <pointLight position={[-7, 2, -4]} intensity={22} color={ACCENT} distance={32} />
        <Starfield />
        <MouseParallax>
          {ITEMS.map((it, i) => (
            <Float
              key={i}
              speed={it.speed}
              rotationIntensity={0.4}
              floatIntensity={0.9}
              position={it.pos}
            >
              <group rotation={it.rot} scale={it.scale}>
                <Laptop />
              </group>
            </Float>
          ))}
        </MouseParallax>
      </Suspense>
    </Canvas>
  );
}

export default function Hero3D() {
  // Mount gate: WebGL only in the browser, never during SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    // Nudge R3F to re-measure its container (avoids the stuck 300x150 default
    // when the canvas mounts into an absolutely-positioned parent).
    const fire = () => window.dispatchEvent(new Event("resize"));
    const r = requestAnimationFrame(fire);
    const t = setTimeout(fire, 250);
    return () => {
      cancelAnimationFrame(r);
      clearTimeout(t);
    };
  }, []);
  if (!mounted) return null;
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <Scene />
    </div>
  );
}
