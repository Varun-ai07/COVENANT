"use client";

import { useRef, useMemo, Suspense, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Stars,
  Float,
  Text,
  MeshDistortMaterial,
  PerformanceMonitor,
  type PerformanceMonitorApi,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
} from "@react-three/postprocessing";
import * as THREE from "three";

// ─── Color Palette (extracted from lavender images) ───
const COLORS = {
  deepAmethyst: "#4c1d95",
  plasmaPink: "#d946ef",
  voidBlack: "#0a0118",
  lavenderBright: "#c87ce0",
  lavenderMid: "#8844aa",
  lavenderShadow: "#2a0840",
  horizonGlow: "#e8948c",
  nebulaCore: "#ff88cc",
  nebulaMid: "#cc55aa",
  nebulaEdge: "#8833aa",
  treeSilhouette: "#120118c",
};

// ─── Shared camera state (exported for UI overlay) ───
export const cameraState = {
  z: 2.5,
  x: 0,
  y: 0.5,
  t: 0, // normalized 0-1
};

// ─── Custom Neural Noise Shader ───
const NeuralNoiseShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    intensity: { value: 0.06 },
    windSync: { value: 0 }, // driven by lavender wind phase
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float intensity;
    uniform float windSync;
    varying vec2 vUv;

    // Simplex-style hash
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // Pulsing neural noise — syncs with wind phase
      float n1 = noise(vUv * 200.0 + time * 0.5);
      float n2 = noise(vUv * 100.0 - time * 0.3 + windSync * 2.0);
      float combined = (n1 * 0.6 + n2 * 0.4);

      // Pink-tinted noise with pulsing amplitude
      float pulse = 0.5 + 0.5 * sin(time * 2.0 + windSync * 3.0);
      float noiseAmount = intensity * (0.7 + 0.3 * pulse);

      vec3 noiseColor = vec3(0.82, 0.32, 0.93); // plasma pink tint
      color.rgb += (combined - 0.5) * noiseAmount * noiseColor * 2.0;

      // Subtle scanline effect
      float scanline = sin(vUv.y * 800.0) * 0.015;
      color.rgb -= scanline;

      gl_FragColor = color;
    }
  `,
};

// Custom shader pass for neural noise
class NeuralNoisePass {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
  enabled = true;
  needsSwap = true;
  renderToScreen = false;
  material: THREE.ShaderMaterial;
  fsQuad: THREE.Mesh;
  scene: THREE.Scene;
  camera: THREE.Camera;

  constructor() {
    this.uniforms = THREE.UniformsUtils.clone(NeuralNoiseShader.uniforms);
    this.vertexShader = NeuralNoiseShader.vertexShader;
    this.fragmentShader = NeuralNoiseShader.fragmentShader;

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: this.vertexShader,
      fragmentShader: this.fragmentShader,
    });

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.scene.add(this.fsQuad);
  }

  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ) {
    this.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.material.dispose();
    this.fsQuad.geometry.dispose();
  }
}

// ─── Parallax Camera Controller ───
function ParallaxCamera() {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 0.5, 2.5));

  useFrame((state) => {
    const { pointer } = state;
    // Map pointer [-1,1] to camera offset, lerp for smooth lag
    target.current.x = THREE.MathUtils.lerp(
      target.current.x,
      pointer.x * 0.6,
      0.05
    );
    target.current.y = THREE.MathUtils.lerp(
      target.current.y,
      0.5 + pointer.y * 0.35,
      0.05
    );

    camera.position.x = target.current.x;
    camera.position.y = target.current.y;
    camera.lookAt(0, 0.2, 0);

    // Update shared camera state for UI
    cameraState.x = camera.position.x;
    cameraState.y = camera.position.y;
    cameraState.z = camera.position.z;
    // Normalize Z to 0-1 range (2.0 to 3.0 mapped)
    cameraState.t = THREE.MathUtils.clamp(
      (camera.position.z - 2.0) / 1.0,
      0,
      1
    );
  });

  return null;
}

// ─── Lavender Field Rows ───
function LavenderField({ windPhaseRef }: { windPhaseRef: React.MutableRefObject<number> }) {
  const ROW_COUNT = 12;

  // Memoize row data to prevent recreation on every render
  const rows = useMemo(() => {
    return Array.from({ length: ROW_COUNT }).map((_, i) => {
      const t = i / ROW_COUNT;
      const z = -t * t * 14;
      const scaleX = THREE.MathUtils.lerp(2.8, 0.15, t);
      const yOffset = THREE.MathUtils.lerp(-0.6, -0.15, t);
      const color = new THREE.Color(COLORS.deepAmethyst).lerp(
        new THREE.Color(COLORS.plasmaPink),
        t
      );
      return { z, scaleX, yOffset, color, key: i };
    });
  }, []);

  // Track wind phase for neural noise sync
  useFrame((_, delta) => {
    windPhaseRef.current += delta * 2; // speed matches MeshDistortMaterial speed={2}
  });

  return (
    <group position={[0, -0.3, 0]}>
      {rows.map(({ z, scaleX, yOffset, color, key }) => (
        <mesh key={key} position={[0, yOffset, z]} rotation={[-Math.PI / 8, 0, 0]}>
          <planeGeometry args={[scaleX, 0.18, 32, 8]} />
          <MeshDistortMaterial
            color={color}
            emissive={COLORS.lavenderShadow}
            emissiveIntensity={0.25}
            distort={0.4}
            speed={2}
            roughness={0.85}
            metalness={0.05}
            transparent
            opacity={THREE.MathUtils.lerp(1, 0.4, key / ROW_COUNT)}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── Midground Tree ───
function MidgroundTree() {
  return (
    <Float speed={1.2} rotationIntensity={0.05} floatIntensity={0.3}>
      <group position={[0, 0.8, -10]}>
        {/* Trunk */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.08, 1.2, 6]} />
          <meshStandardMaterial
            color={COLORS.treeSilhouette}
            emissive={COLORS.deepAmethyst}
            emissiveIntensity={0.1}
          />
        </mesh>
        {/* Canopy layers */}
        {[0.45, 0.7, 0.95].map((y, i) => (
          <mesh key={i} position={[0, y, 0]}>
            <sphereGeometry args={[0.5 - i * 0.1, 8, 6]} />
            <meshStandardMaterial
              color={COLORS.lavenderShadow}
              emissive={COLORS.plasmaPink}
              emissiveIntensity={0.15}
              transparent
              opacity={0.9}
            />
          </mesh>
        ))}
        {/* Pink blossom glow */}
        <pointLight
          position={[0, 0.7, 0.2]}
          color={COLORS.plasmaPink}
          intensity={0.5}
          distance={3}
        />
      </group>
    </Float>
  );
}

// ─── COVENANT Floating Title ───
function CovenantTitle() {
  return (
    <Float speed={1.5} rotationIntensity={0.02} floatIntensity={0.15}>
      <Text
        font="/fonts/Silkscreen-Regular.woff2"
        fontSize={0.35}
        letterSpacing={0.15}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        position={[0, 1.6, -2]}
      >
        COVENANT
        <meshStandardMaterial
          color="#ffffff"
          emissive={COLORS.plasmaPink}
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </Text>
    </Float>
  );
}

// ─── Horizon Glow Plane ───
function HorizonGlow() {
  return (
    <mesh position={[0, -0.1, -12]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[12, 4]} />
      <meshBasicMaterial
        color={COLORS.horizonGlow}
        transparent
        opacity={0.12}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

// ─── Nebula Glow Sprite ───
function NebulaGlow() {
  return (
    <mesh position={[0, 2.5, -18]} rotation={[0, 0, 0]}>
      <planeGeometry args={[10, 6]} />
      <meshBasicMaterial
        color={COLORS.nebulaCore}
        transparent
        opacity={0.08}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

// ─── Neural Noise Overlay (fragment shader post-process) ───
function NeuralNoiseOverlay({
  windPhaseRef,
}: {
  windPhaseRef: React.MutableRefObject<number>;
}) {
  const neuralRef = useRef<NeuralNoisePass | null>(null);

  const neuralPass = useMemo(() => {
    const pass = new NeuralNoisePass();
    neuralRef.current = pass;
    return pass;
  }, []);

  useFrame((state) => {
    if (neuralRef.current) {
      neuralRef.current.uniforms.time.value = state.clock.elapsedTime;
      neuralRef.current.uniforms.windSync.value = windPhaseRef.current;
    }
  });

  return <primitive object={neuralPass} />;
}

// ─── Main Scene ───
function Scene({
  onFpsChange,
  windPhaseRef,
}: {
  onFpsChange: (fps: number) => void;
  windPhaseRef: React.MutableRefObject<number>;
}) {
  return (
    <>
      <PerspectiveCameraWrapper />
      <ParallaxCamera />

      {/* Performance monitor — drops DPR when fps < 60 */}
      <PerformanceMonitor
        onIncline={() => {}}
        onDecline={() => {}}
        flipflops={3}
        onFallback={(api: PerformanceMonitorApi) => onFpsChange(api.fps)}
      />

      {/* Ambient & directional */}
      <ambientLight intensity={0.08} color={COLORS.deepAmethyst} />
      <directionalLight
        position={[0, 3, 2]}
        intensity={0.15}
        color={COLORS.nebulaMid}
      />

      {/* Background: Stars */}
      <Stars
        radius={80}
        depth={60}
        count={5000}
        factor={4}
        saturation={0.2}
        fade
        speed={0.8}
      />

      {/* Background: Nebula glow */}
      <NebulaGlow />

      {/* Horizon glow */}
      <HorizonGlow />

      {/* Foreground: Lavender rows with wind tracking */}
      <LavenderField windPhaseRef={windPhaseRef} />

      {/* Midground: Tree */}
      <MidgroundTree />

      {/* Floating title */}
      <CovenantTitle />

      {/* Post-processing */}
      <EffectComposer>
        <Bloom
          intensity={1.8}
          luminanceThreshold={0.1}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.1} darkness={0.8} />
        <NeuralNoiseOverlay windPhaseRef={windPhaseRef} />
      </EffectComposer>
    </>
  );
}

// ─── Camera Setup ───
function PerspectiveCameraWrapper() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 0.5, 2.5);
    (camera as THREE.PerspectiveCamera).fov = 55;
    (camera as THREE.PerspectiveCamera).near = 0.1;
    (camera as THREE.PerspectiveCamera).far = 100;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  }, [camera]);
  return null;
}

// ─── Loading Fallback ───
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center w-full h-full bg-[#0a0118]">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 animate-pulse-glow mb-4" />
        <p className="text-violet-300/60 text-sm font-mono tracking-widest">
          LOADING WORLD
        </p>
      </div>
    </div>
  );
}

// ─── Exported Component ───
export default function LavenderWorld({
  onFpsChange,
}: {
  onFpsChange?: (fps: number) => void;
} = {}) {
  const windPhaseRef = useRef(0);

  const handleFpsChange = useCallback(
    (fps: number) => {
      onFpsChange?.(fps);
    },
    [onFpsChange]
  );

  return (
    <div className="absolute inset-0 z-0" role="img" aria-label="COVENANT 3D lavender field environment with cyber-pastoral aesthetic">
      <Suspense fallback={<LoadingFallback />}>
        <Canvas
          dpr={[1, 2]}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
          }}
          style={{ background: COLORS.voidBlack }}
        >
          <Scene onFpsChange={handleFpsChange} windPhaseRef={windPhaseRef} />
        </Canvas>
      </Suspense>
    </div>
  );
}
