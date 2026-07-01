"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Group, Mesh } from "three";

// The pmndrs "floating-laptop" MacBook model (mac-draco.glb) — textured aluminium
// body, real keyboard, trackpad, touchbar, and a hinged lid. Draco-compressed;
// drei's useGLTF wires the decoder automatically. Mesh mapping + hinge range are
// from the original demo (App.jsx): the lid group rotates on X from 1.575 (closed)
// to -0.425 (open). We drive that per-route with a lerp, tilt the whole thing
// toward the cursor, and swap the screen to the app's cyan glow.
const MODEL = "/models/mac-draco.glb";
const HINGE_CLOSED = 1.575;
const HINGE_OPEN = -0.425;
const SCENE_EMBER = "#f45500"; // --scene accent — the ember filament (screen only)

interface RealLaptopProps {
  openness?: number; // 0 = closed, 1 = fully open
  parallax?: number; // how strongly it tilts toward the cursor
}

export function RealLaptop({ openness = 1, parallax = 0.45 }: RealLaptopProps) {
  const group = useRef<Group>(null);
  const lid = useRef<Group>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const { nodes, materials } = useGLTF(MODEL);
  const mesh = (name: string) => (nodes[name] as Mesh).geometry;

  const target = HINGE_CLOSED + (HINGE_OPEN - HINGE_CLOSED) * THREE.MathUtils.clamp(openness, 0, 1);

  // Track the pointer globally (the canvas is pointer-events-none, so we read the
  // window — the laptop reacts even though it never intercepts clicks).
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((_, dt) => {
    if (lid.current) {
      lid.current.rotation.x = THREE.MathUtils.lerp(lid.current.rotation.x, target, Math.min(1, dt * 3));
    }
    if (group.current) {
      // cursor parallax — ease the tilt toward the pointer
      const k = Math.min(1, dt * 2.5);
      group.current.rotation.y += (pointer.current.x * parallax - group.current.rotation.y) * k;
      group.current.rotation.x += (-pointer.current.y * parallax * 0.55 - group.current.rotation.x) * k;
    }
  });

  return (
    <group ref={group} dispose={null}>
      {/* hinged lid: aluminium shell + matte bezel + cyan-glow screen */}
      <group ref={lid} position={[0, -0.04, 0.41]}>
        <group position={[0, 2.96, -0.13]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh material={materials.aluminium} geometry={mesh("Cube008")} />
          <mesh material={materials["matte.001"]} geometry={mesh("Cube008_1")} />
          {/* screen — replace the model's texture with the app's cyan emissive glow */}
          <mesh geometry={mesh("Cube008_2")}>
            <meshStandardMaterial
              color="#0b1416"
              emissive={SCENE_EMBER}
              emissiveIntensity={1.15}
              metalness={0}
              roughness={0.35}
              toneMapped={false}
            />
          </mesh>
        </group>
      </group>
      {/* keyboard */}
      <mesh material={materials.keys} geometry={mesh("keyboard")} position={[1.79, 0, 3.45]} />
      {/* base + trackpad */}
      <group position={[0, -0.1, 3.39]}>
        <mesh material={materials.aluminium} geometry={mesh("Cube002")} />
        <mesh material={materials.trackpad} geometry={mesh("Cube002_1")} />
      </group>
      {/* touchbar */}
      <mesh material={materials.touchbar} geometry={mesh("touchbar")} position={[0, -0.03, 1.2]} />
    </group>
  );
}

useGLTF.preload(MODEL);
