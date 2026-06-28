"use client";

import { Suspense } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, Float, ContactShadows } from "@react-three/drei";
import { ChromeLaptop, MouseParallax, IdleSpin } from "./ChromeLaptop";

// The WebGL hero — a chrome laptop on a light mist stage. Keep R3F defaults
// (ACES filmic tonemapping + sRGB output) so bright chrome reflections roll off
// instead of clipping; alpha so the page canvas shows through.
export function ChromeScene() {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0.6, 6], fov: 32, near: 0.1, far: 100 }}
    >
      <Suspense fallback={null}>
        {/* Subtle lights — the environment does most of the work. */}
        <ambientLight intensity={0.35} />
        <directionalLight position={[4, 6, 5]} intensity={0.9} color="#ffffff" />
        {/* The one neon accent light — cyan, in front of the screen. */}
        <pointLight position={[0, 0.9, 1.2]} intensity={6} distance={9} color="#35e0d8" />

        {/* Procedural studio environment (no network HDRI). A light dome keeps
            the chrome bright on a light page; white softboxes are the streaks. */}
        <Environment resolution={256} frames={1}>
          <mesh scale={60}>
            <sphereGeometry args={[1, 32, 32]} />
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
            position={[5, 3, -4]}
            rotation={[0, -Math.PI / 3, 0]}
            scale={[6, 8, 1]}
          />
          <Lightformer
            form="rect"
            intensity={2}
            color="#ffffff"
            position={[-6, 1, 2]}
            rotation={[0, Math.PI / 3, 0]}
            scale={[6, 6, 1]}
          />
          <Lightformer
            form="rect"
            intensity={8}
            color="#ffffff"
            position={[0, 2, 4]}
            rotation={[0, 0, Math.PI / 4]}
            scale={[1.5, 8, 1]}
          />
          <Lightformer form="circle" intensity={5} color="#ffffff" position={[2, 4, 3]} scale={3} />
          {/* faint cool tint so reflections read as cold mist (--chrome-tint) */}
          <Lightformer
            form="rect"
            intensity={1.2}
            color="#cfe6ea"
            position={[-2, -2, 3]}
            scale={[6, 3, 1]}
          />
        </Environment>

        {/* Shift toward the inline-end (left) + down so the RTL copy stays clear. */}
        <group position={[-2, -0.5, 0]} scale={0.86}>
          <MouseParallax>
            <IdleSpin>
              <Float speed={1.1} rotationIntensity={0.25} floatIntensity={0.7} floatingRange={[-0.08, 0.08]}>
                <ChromeLaptop />
              </Float>
            </IdleSpin>
          </MouseParallax>

          {/* Grounding shadow on the mist floor (moves with the laptop). */}
          <ContactShadows
            position={[0, -1.05, 0]}
            opacity={0.32}
            scale={9}
            blur={2.8}
            far={3.2}
            resolution={512}
            color="#8a9099"
            frames={1}
          />
        </group>
      </Suspense>
    </Canvas>
  );
}
