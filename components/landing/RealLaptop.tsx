"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Group, Mesh } from "three";

// The pmndrs "floating-laptop" MacBook model (mac-draco.glb) — textured aluminium
// body, real keyboard, trackpad, touchbar, and a hinged lid. Draco-compressed;
// drei's useGLTF wires the decoder automatically. Mesh mapping + hinge range are
// from the original demo (App.jsx): the lid group rotates on X from 1.575 (closed)
// to -0.425 (open). We drive that per-route with a lerp instead of react-spring.
const MODEL = "/models/mac-draco.glb";
const HINGE_CLOSED = 1.575;
const HINGE_OPEN = -0.425;

interface RealLaptopProps {
  openness?: number; // 0 = closed, 1 = fully open
}

export function RealLaptop({ openness = 1 }: RealLaptopProps) {
  const lid = useRef<Group>(null);
  const { nodes, materials } = useGLTF(MODEL);
  const mesh = (name: string) => (nodes[name] as Mesh).geometry;

  const target = HINGE_CLOSED + (HINGE_OPEN - HINGE_CLOSED) * THREE.MathUtils.clamp(openness, 0, 1);

  useFrame((_, dt) => {
    if (lid.current) {
      // ease the lid toward its per-route open angle
      lid.current.rotation.x = THREE.MathUtils.lerp(lid.current.rotation.x, target, Math.min(1, dt * 3));
    }
  });

  return (
    <group dispose={null}>
      {/* hinged lid: aluminium shell + matte bezel + screen */}
      <group ref={lid} position={[0, -0.04, 0.41]}>
        <group position={[0, 2.96, -0.13]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh material={materials.aluminium} geometry={mesh("Cube008")} />
          <mesh material={materials["matte.001"]} geometry={mesh("Cube008_1")} />
          <mesh material={materials["screen.001"]} geometry={mesh("Cube008_2")} />
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
