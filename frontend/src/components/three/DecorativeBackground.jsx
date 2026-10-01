import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ---------------------------------------------------------------------------------------------
// FEATURE 14/15 - subtle, low-poly, INSTANCED 3D decorative backgrounds. Six selectable light,
// on-brand (pink/cream/maroon/gold/lavender) themes, all built from a single tiny geometry each
// so a whole scene is one draw call. Every theme is intentionally quiet: soft colors, slow
// drift, low particle counts, halved again on mobile.
// ---------------------------------------------------------------------------------------------

const PALETTE = {
  blush: "#f3c9d6",
  rose: "#e78ea1",
  lavender: "#cdb8e8",
  gold: "#e0b877",
  cream: "#fdf6ee",
  plum: "#7a2f4b",
};

const THEMES = {
  // Tiny glowing motes drifting slowly upward, gently twinkling.
  sparkles: {
    geometry: () => new THREE.OctahedronGeometry(0.09, 0),
    colors: [PALETTE.gold, PALETTE.cream, PALETTE.blush],
    count: { desktop: 28, mobile: 12 },
    motion: "riseTwinkle",
  },
  // Simple two-wing butterfly silhouette (two tilted planes), fluttering across the section.
  butterflies: {
    geometry: () => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.quadraticCurveTo(0.35, 0.35, 0.05, 0.55);
      shape.quadraticCurveTo(-0.3, 0.4, 0, 0);
      return new THREE.ShapeGeometry(shape);
    },
    colors: [PALETTE.rose, PALETTE.lavender, PALETTE.gold],
    count: { desktop: 8, mobile: 4 },
    motion: "flutter",
  },
  // Flat drifting petal discs, falling and turning slowly.
  florals: {
    geometry: () => new THREE.CircleGeometry(0.12, 6),
    colors: [PALETTE.blush, PALETTE.rose, PALETTE.lavender],
    count: { desktop: 20, mobile: 8 },
    motion: "fall",
  },
  // Big soft translucent spheres drifting sideways like clouds.
  clouds: {
    geometry: () => new THREE.SphereGeometry(0.55, 10, 10),
    colors: [PALETTE.cream, "#ffffff"],
    count: { desktop: 6, mobile: 3 },
    motion: "drift",
    opacity: 0.35,
  },
  // Soft glowing orbs of varying size, gently rising and pulsing - a "resin bubble" feel.
  bokeh: {
    geometry: () => new THREE.SphereGeometry(0.14, 12, 12),
    colors: [PALETTE.gold, PALETTE.blush, PALETTE.lavender],
    count: { desktop: 22, mobile: 10 },
    motion: "riseTwinkle",
    opacity: 0.55,
  },
  // Small faceted "gem" shapes, resin/jewellery-inspired, slowly tumbling and floating.
  jewels: {
    geometry: () => new THREE.IcosahedronGeometry(0.1, 0),
    colors: [PALETTE.rose, PALETTE.gold, PALETTE.plum],
    count: { desktop: 16, mobile: 7 },
    motion: "tumble",
  },
};

export const DECORATIVE_THEMES = Object.keys(THEMES);

function ParticleField({ theme, isMobile }) {
  const config = THEMES[theme] || THEMES.sparkles;
  const count = isMobile ? config.count.mobile : config.count.desktop;
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => config.geometry(), [theme]);

  const particles = useMemo(() => {
    return new Array(count).fill(0).map(() => ({
      x: (Math.random() - 0.5) * 8,
      y: (Math.random() - 0.5) * 4,
      z: (Math.random() - 0.5) * 2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.15 + Math.random() * 0.25,
      scale: 0.6 + Math.random() * 0.8,
      rotSpeed: (Math.random() - 0.5) * 0.4,
      colorIdx: Math.floor(Math.random() * config.colors.length),
    }));
  }, [count, theme]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    particles.forEach((p, i) => {
      let x = p.x, y = p.y, z = p.z, rot = 0, scale = p.scale, opacity = 1;
      switch (config.motion) {
        case "riseTwinkle":
          y = ((p.y + t * p.speed + 2) % 4) - 2;
          scale = p.scale * (0.75 + 0.25 * Math.sin(t * 1.5 + p.phase));
          rot = t * p.rotSpeed;
          break;
        case "fall":
          y = ((p.y - t * p.speed + 2) % 4) - 2;
          rot = t * p.rotSpeed;
          x = p.x + Math.sin(t * 0.5 + p.phase) * 0.4;
          break;
        case "drift":
          x = ((p.x + t * p.speed * 0.4 + 4) % 8) - 4;
          y = p.y + Math.sin(t * 0.2 + p.phase) * 0.2;
          break;
        case "flutter":
          x = ((p.x + t * p.speed * 0.5 + 4) % 8) - 4;
          y = p.y + Math.sin(t * 2 + p.phase) * 0.25;
          rot = Math.sin(t * 3 + p.phase) * 0.6;
          break;
        case "tumble":
          y = ((p.y + t * p.speed * 0.6 + 2) % 4) - 2;
          rot = t * p.rotSpeed * 2;
          break;
        default:
          break;
      }
      dummy.position.set(x, y, z);
      dummy.rotation.set(rot * 0.5, rot, rot * 0.3);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, count]}>
      <meshBasicMaterial
        color={config.colors[0]}
        transparent
        opacity={config.opacity ?? 0.8}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

/**
 * Drop this into any section for a subtle animated 3D backdrop. Mounts the WebGL canvas only
 * while the section is actually on screen (IntersectionObserver) and skips entirely when the
 * user has requested reduced motion - so it never costs anything off-screen or for people who
 * asked for less animation.
 *
 * Props:
 *  - theme: one of DECORATIVE_THEMES (default "sparkles")
 *  - className: sizing/positioning classes for the wrapping div (should be absolutely
 *    positioned and behind your section's real content, e.g. "absolute inset-0 -z-10")
 */
export default function DecorativeBackground({ theme = "sparkles", className = "absolute inset-0 -z-10 pointer-events-none" }) {
  const wrapperRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
    setIsMobile(window.innerWidth < 768);
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!wrapperRef.current || reducedMotion) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <div ref={wrapperRef} className={className} aria-hidden="true">
      {inView && !reducedMotion && (
        <Suspense fallback={null}>
          <Canvas
            camera={{ position: [0, 0, 5], fov: 50 }}
            dpr={isMobile ? 1 : [1, 1.5]}
            gl={{ alpha: true, antialias: true }}
            style={{ background: "transparent" }}
          >
            <ParticleField theme={theme} isMobile={isMobile} />
          </Canvas>
        </Suspense>
      )}
    </div>
  );
}
