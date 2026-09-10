import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  ShaderMaterial,
  type Scene,
} from "three";
import type { QualityProfile } from "./quality";

const vertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uSize;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.y = mod(p.y + uTime * (0.06 + aSeed * 0.12) + aSeed * 8.0, 16.0) - 0.4;
    p.x += sin(uTime * 0.08 + aSeed * 12.0) * 0.18;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.7 + aSeed * 0.5) * (70.0 / -mv.z);
    vAlpha = 0.1 + aSeed * 0.32;
  }
`;

const fragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float glow = smoothstep(0.5, 0.0, d);
    vec3 color = mix(vec3(0.15, 0.9, 0.45), vec3(0.7, 1.0, 0.95), glow);
    gl_FragColor = vec4(color, glow * vAlpha);
  }
`;

export type ParticleSystem = {
  update: (time: number) => void;
  dispose: () => void;
};

export function createParticles(scene: Scene, quality: QualityProfile): ParticleSystem {
  const count = quality.particles;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const radius = 14 + Math.random() * 24;
    const angle = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = 2 + Math.random() * 11;
    positions[i * 3 + 2] = Math.sin(angle) * radius * 0.42;
    seeds[i] = Math.random();
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 1));

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: quality.isCompact ? 0.42 : 0.58 },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  return {
    update(time: number) {
      if (quality.reducedMotion) return;
      material.uniforms.uTime.value = time;
    },
    dispose() {
      scene.remove(points);
      geometry.dispose();
      material.dispose();
    },
  };
}
