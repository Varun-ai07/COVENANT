"use client";

import { Canvas } from "@react-three/fiber";
import { Stars, Float } from "@react-three/drei";

function NeuralScene() {
  const nodes = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    position: [
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 10,
    ] as [number, number, number],
    color: ["#8b5cf6", "#d946ef", "#22d3ee"][Math.floor(Math.random() * 3)],
    size: 0.05 + Math.random() * 0.15,
  }));

  const particles = Array.from({ length: 80 }, (_, i) => ({
    id: i,
    position: [
      (Math.random() - 0.5) * 24,
      (Math.random() - 0.5) * 16,
      (Math.random() - 0.5) * 12,
    ] as [number, number, number],
    color: ["#8b5cf6", "#d946ef", "#22d3ee"][Math.floor(Math.random() * 3)],
    size: 0.01 + Math.random() * 0.03,
  }));

  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={0.5} color="#8b5cf6" />
      <pointLight position={[-10, -10, -5]} intensity={0.3} color="#d946ef" />
      <pointLight position={[5, -5, 10]} intensity={0.3} color="#22d3ee" />

      <Stars
        radius={50}
        depth={50}
        count={1000}
        factor={4}
        saturation={0}
        fade
        speed={1}
      />

      {nodes.map((node) => (
        <Float
          key={node.id}
          speed={1 + Math.random()}
          rotationIntensity={0.5}
          floatIntensity={0.5}
        >
          <mesh position={node.position}>
            <sphereGeometry args={[node.size, 16, 16]} />
            <meshStandardMaterial
              color={node.color}
              emissive={node.color}
              emissiveIntensity={0.8}
              transparent
              opacity={0.9}
            />
          </mesh>
        </Float>
      ))}

      {particles.map((particle) => (
        <mesh key={particle.id} position={particle.position}>
          <sphereGeometry args={[particle.size, 8, 8]} />
          <meshBasicMaterial
            color={particle.color}
            transparent
            opacity={0.6}
          />
        </mesh>
      ))}

      <mesh position={[0, 0, -5]}>
        <planeGeometry args={[40, 30]} />
        <meshBasicMaterial color="#0a0118" transparent opacity={0.8} />
      </mesh>
    </>
  );
}

export default function NeuralBackground() {
  return (
    <div className="fixed inset-0 -z-10">
      <Canvas
        camera={{ position: [0, 0, 15], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#0a0118"]} />
        <fog attach="fog" args={["#0a0118", 15, 35]} />
        <NeuralScene />
      </Canvas>
    </div>
  );
}
