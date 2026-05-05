export interface NeuralNode {
  position: [number, number, number];
  color: string;
  scale: number;
}

export interface SynapseGlowProps {
  intensity?: number;
  color?: string;
}

export interface ParticleConfig {
  count?: number;
  colors?: string[];
  minSize?: number;
  maxSize?: number;
}
