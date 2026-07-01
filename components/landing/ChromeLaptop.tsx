"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Group } from "three";

const SCENE_CYAN = "#35e0d8"; // --scene-cyan — the single neon accent

// Aluminum tints — neutral gray only, NO brand hue. Silver body + a faintly
// cooler/darker space-gray deck so the keyboard deck reads as a distinct part.
const ALU_BODY = "#c9ccd1"; // lid + trackpad
const ALU_DECK = "#b7bcc4"; // keyboard deck (slightly darker/cooler)

// ---------------------------------------------------------------------------
// Procedural brushed-aluminum maps, generated once on the client.
//   • roughnessMap: base ~0.30 with fine horizontal streaks (0.22–0.42) so the
//     surface scatters light like brushed grain instead of mirroring.
//   • anisotropyMap: RG encode a HORIZONTAL brush tangent (R≈1.0, G≈0.5); the B
//     channel carries per-streak anisotropy STRENGTH so highlights smear and
//     shimmer along the grain. (three r0.171 reads it as normalize(2*rg-1)*b —
//     a plain grayscale streak would be an invalid anisotropy map.)
// ---------------------------------------------------------------------------
function makeBrushedCanvas(
  w: number,
  h: number,
  draw: (px: Uint8ClampedArray, i: number, x: number, y: number) => void,
) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const px = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      draw(px, (y * w + x) * 4, x, y);
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// Deterministic-enough 1D value noise per row (one streak intensity per Y line),
// so the grain is continuous horizontally and varies vertically = brushed look.
function buildBrushedTextures() {
  const W = 512;
  const H = 512;
  const rowNoise = new Float32Array(H);
  for (let y = 0; y < H; y++) rowNoise[y] = Math.random();
  // light 1D smoothing so streaks aren't pure static
  const smooth = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    const a = rowNoise[(y - 1 + H) % H];
    const b = rowNoise[y];
    const c = rowNoise[(y + 1) % H];
    smooth[y] = (a + 2 * b + c) / 4;
  }

  // ROUGHNESS MAP — grayscale; higher = rougher.
  const roughCv = makeBrushedCanvas(W, H, (p, i, x, y) => {
    const streak = smooth[y];
    const ripple = 0.03 * Math.sin(x * 0.35 + y * 0.7);
    let r = 0.3 + (streak - 0.5) * 0.2 + ripple; // ~0.22–0.42
    r = Math.min(0.5, Math.max(0.18, r));
    const v = Math.round(r * 255);
    p[i] = v;
    p[i + 1] = v;
    p[i + 2] = v;
    p[i + 3] = 255;
  });

  // ANISOTROPY MAP — RG = horizontal tangent (1,0)->(255,128); B = strength.
  const anisoCv = makeBrushedCanvas(W, H, (p, i, _x, y) => {
    const streak = smooth[y];
    const strength = 0.45 + streak * 0.55; // shimmering grain 0.45–1.0
    p[i] = 255; // R: tangent.x = +1  -> 2*1-1 = 1
    p[i + 1] = 128; // G: tangent.y =  0  -> 2*.5-1 = 0
    p[i + 2] = Math.round(strength * 255); // B: anisotropy strength
    p[i + 3] = 255;
  });

  const rough = new THREE.CanvasTexture(roughCv);
  const aniso = new THREE.CanvasTexture(anisoCv);
  for (const t of [rough, aniso]) {
    t.colorSpace = THREE.NoColorSpace; // data maps, never sRGB
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2); // tile so the grain stays fine on big faces
    t.anisotropy = 4; // texture-sampling AF (crisper at grazing angles)
    t.needsUpdate = true;
  }
  return { rough, aniso };
}

// Memoize the maps, return spreadable physical-material props, dispose on unmount.
function useBrushedAluminum() {
  const { rough, aniso } = useMemo(() => buildBrushedTextures(), []);
  useEffect(
    () => () => {
      rough.dispose();
      aniso.dispose();
    },
    [rough, aniso],
  );

  return {
    metalness: 1,
    // roughness MULTIPLIES the roughnessMap; ~0.34 keeps it satin, not mirror.
    roughness: 0.34,
    roughnessMap: rough,
    anisotropy: 1, // >0 enables the anisotropic BRDF
    anisotropyRotation: 0, // brush runs horizontal
    anisotropyMap: aniso,
    envMapIntensity: 1.35, // still catches the white Lightformers
    clearcoat: 0.25, // thin satin coat, not the old glassy 1.0
    clearcoatRoughness: 0.35,
  } as const;
}

// A stylized brushed-aluminum open laptop built from primitives (no external model).
export function ChromeLaptop() {
  const alu = useBrushedAluminum();
  return (
    <group rotation={[0.12, -0.5, 0]}>
      {/* keyboard deck — space-gray tint so it reads distinct from the body */}
      <mesh>
        <boxGeometry args={[3, 0.16, 2]} />
        <meshPhysicalMaterial {...alu} color={ALU_DECK} roughness={0.42} />
      </mesh>
      {/* trackpad — slightly smoother + body tint = a distinct inset panel */}
      <mesh position={[0, 0.09, 0.5]}>
        <boxGeometry args={[0.9, 0.02, 0.6]} />
        <meshPhysicalMaterial {...alu} color={ALU_BODY} roughness={0.24} />
      </mesh>
      {/* reclined screen assembly */}
      <group position={[0, 0.08, -1]} rotation={[-1.2, 0, 0]}>
        {/* lid (brushed aluminum body) */}
        <mesh position={[0, 1, 0]}>
          <boxGeometry args={[3, 2, 0.1]} />
          <meshPhysicalMaterial {...alu} color={ALU_BODY} />
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

// Pointer parallax — gently rotates toward the cursor. No-op without a moving
// pointer (touch falls back upstream).
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
// across the metal while the screen stays facing the viewer.
export function IdleSpin({ children }: { children: React.ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.25) * 0.18;
  });
  return <group ref={ref}>{children}</group>;
}
