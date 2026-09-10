import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  Mesh,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  ShaderMaterial,
  type Scene,
} from "three";
import type { QualityProfile } from "./quality";

const groundVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const groundFragment = /* glsl */ `
  uniform float uTime;
  uniform float uPulse;
  uniform float uFocus;
  varying vec3 vWorld;

  float lineGrid(vec2 p, float scale, float width) {
    vec2 g = abs(fract(p * scale) - 0.5);
    vec2 fw = fwidth(p * scale);
    vec2 l = smoothstep(vec2(width) - fw, vec2(width) + fw, g);
    return 1.0 - min(l.x, l.y);
  }

  void main() {
    vec2 p = vWorld.xz;
    float dist = length(p);
    float near = mix(18.0, 11.0, uFocus);
    float far = mix(42.0, 24.0, uFocus);
    float fade = smoothstep(far, near, dist);
    float fine = lineGrid(p, 0.72, 0.022);
    float coarse = lineGrid(p, 0.11, 0.01);
    float pulse = 0.5 + 0.5 * sin(p.x * 0.2 - uTime * 0.32);
    float wave = 1.0 - abs(fract((p.x + 26.0) / 54.0 - uPulse) * 2.0 - 1.0);
    wave = smoothstep(0.35, 1.0, wave);
    vec3 base = vec3(0.01, 0.02, 0.016);
    vec3 green = vec3(0.12, 0.95, 0.45);
    vec3 cyan = vec3(0.55, 0.95, 0.92);
    float dim = mix(1.0, 0.32, uFocus);
    vec3 color = base;
    color += green * fine * 0.055 * dim;
    color += mix(green, cyan, 0.35) * coarse * 0.14 * dim;
    color += green * wave * uPulse * 0.14;
    color += cyan * pulse * 0.008 * dim;
    float ring = smoothstep(0.22, 0.0, abs(dist - 21.0));
    color += green * ring * 0.06 * dim;
    gl_FragColor = vec4(color, fade);
  }
`;

export type EnvironmentSystem = {
  setPulse: (value: number) => void;
  setFocus: (value: number) => void;
  update: (time: number) => void;
  dispose: () => void;
};

export function createEnvironment(scene: Scene, quality: QualityProfile): EnvironmentSystem {
  scene.fog = new FogExp2(0x050807, 0.026);

  const group = new Group();
  scene.add(group);

  const hemi = new HemisphereLight(0x9effc6, 0x040807, 0.62);
  group.add(hemi);

  const key = new PointLight(0x3dff8a, 18, 48, 2);
  key.position.set(8, 14, 10);
  group.add(key);

  const fill = new PointLight(0xb8fff4, 8, 40, 2);
  fill.position.set(-12, 9, -6);
  group.add(fill);

  let focusTarget = 0;
  const groundMat = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPulse: { value: 0 },
      uFocus: { value: 0 },
    },
    vertexShader: groundVertex,
    fragmentShader: groundFragment,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });

  const ground = new Mesh(new PlaneGeometry(120, 120, 1, 1), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03;
  group.add(ground);

  const starGeo = new BufferGeometry();
  const starCount = quality.distantLights;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const radius = 30 + Math.random() * 42;
    const angle = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = 1.5 + Math.random() * 20;
    positions[i * 3 + 2] = Math.sin(angle) * radius * 0.52;
  }
  starGeo.setAttribute("position", new BufferAttribute(positions, 3));
  const stars = new Points(
    starGeo,
    new PointsMaterial({
      color: new Color(0xb8fff4),
      size: 0.055,
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(stars);

  return {
    setPulse(value: number) {
      groundMat.uniforms.uPulse.value = quality.reducedMotion ? 0 : value;
    },
    setFocus(value: number) {
      focusTarget = value;
      if (quality.reducedMotion) {
        groundMat.uniforms.uFocus.value = value;
      }
    },
    update(time: number) {
      const current = groundMat.uniforms.uFocus.value as number;
      groundMat.uniforms.uFocus.value += (focusTarget - current) * 0.045;
      if (quality.reducedMotion) {
        groundMat.uniforms.uTime.value = 0;
        groundMat.uniforms.uPulse.value = 0;
        key.intensity = 14;
        fill.intensity = 6;
        return;
      }
      groundMat.uniforms.uTime.value = time;
      key.intensity = 14 + Math.sin(time * 0.35) * 1.6;
      fill.intensity = 6 + Math.cos(time * 0.22) * 1.0;
      stars.rotation.y = time * 0.002;
    },
    dispose() {
      ground.geometry.dispose();
      groundMat.dispose();
      starGeo.dispose();
      (stars.material as PointsMaterial).dispose();
      scene.remove(group);
    },
  };
}
