import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  BackSide,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  Object3D,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  type Scene,
} from "three";
import type { QualityProfile } from "./quality";
import {
  createMegaSlabs,
  ORBITAL_FRAME,
  shaftAnchorsFor,
} from "./worldLayout";

const FOG_COLOR = 0x050807;
const FOG_DENSITY = 0.018;

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
  uniform float uMotion;
  uniform float uScan;
  uniform float uScanX;
  varying vec3 vWorld;

  float lineGrid(vec2 p, float scale, float width) {
    vec2 g = abs(fract(p * scale) - 0.5);
    vec2 fw = fwidth(p * scale);
    vec2 l = smoothstep(vec2(width) - fw, vec2(width) + fw, g);
    return 1.0 - min(l.x, l.y);
  }

  float saturate(float x) {
    return clamp(x, 0.0, 1.0);
  }

  void main() {
    vec2 p = vWorld.xz;
    float dist = length(p);
    float near = mix(20.0, 12.0, uFocus);
    float far = mix(58.0, 28.0, uFocus);
    float fade = smoothstep(far, near, dist);

    float inDistrict = smoothstep(22.4, 17.5, abs(p.x)) * smoothstep(3.6, 1.5, abs(p.z));
    float outside = 1.0 - inDistrict;

    float fine = lineGrid(p, 0.72, 0.022);
    float coarse = lineGrid(p, 0.11, 0.01);
    float pulse = 0.5 + 0.5 * sin(p.x * 0.2 - uTime * 0.32 * uMotion);
    float wave = 1.0 - abs(fract((p.x + 26.0) / 54.0 - uPulse) * 2.0 - 1.0);
    wave = smoothstep(0.35, 1.0, wave);

    vec3 base = vec3(0.008, 0.012, 0.01);
    vec3 green = vec3(0.12, 0.95, 0.45);
    vec3 cyan = vec3(0.55, 0.95, 0.92);
    float dim = mix(1.0, 0.3, uFocus);

    vec3 color = base;
    color += green * fine * 0.042 * dim;
    color += mix(green, cyan, 0.35) * coarse * 0.11 * dim;
    color += green * wave * uPulse * 0.11;
    color += cyan * pulse * 0.006 * dim;

    float ring = smoothstep(0.22, 0.0, abs(dist - 21.0));
    color += green * ring * 0.045 * dim;

    float smear = pow(1.0 - saturate(abs(p.z) / 3.8), 3.2) * inDistrict;
    smear *= 0.55 + 0.45 * smoothstep(18.0, 4.0, abs(p.x));
    color += vec3(0.04, 0.14, 0.08) * smear * 0.38 * dim;
    float glass = pow(1.0 - saturate(abs(p.z) * 0.22), 10.0) * inDistrict;
    color += vec3(0.28, 0.7, 0.55) * glass * 0.035 * dim;

    float pathA = exp(-pow(p.z - (8.7 + 0.65 * sin(p.x * 0.075)), 2.0) * 13.0);
    float pathB = exp(-pow(p.z + (9.2 + 0.5 * cos(p.x * 0.055)), 2.0) * 13.0);
    float pathC = exp(-pow(p.x - (29.5 + 0.35 * sin(p.z * 0.18)), 2.0) * 9.0);
    float ringRoad = exp(-pow(dist - 34.0, 2.0) * 3.6);
    float highways = (pathA + pathB + pathC * 0.75 + ringRoad * 0.55) * outside;
    float packet = smoothstep(0.07, 0.0, abs(fract(p.x * 0.032 - uTime * 0.038) - 0.5));
    float flow = mix(0.22, 0.22 + packet * 0.55, uMotion);
    color += green * highways * 0.07 * flow * dim;
    color += cyan * highways * packet * uMotion * 0.03 * dim;

    float scanBand = smoothstep(1.8, 0.0, abs(p.x - uScanX)) * uScan * outside;
    color += mix(green, cyan, 0.25) * scanBand * 0.07;

    color = min(color, vec3(0.09, 0.16, 0.12));
    gl_FragColor = vec4(color, fade);
  }
`;

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vDir = normalize(world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const skyFragment = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  uniform float uScan;
  uniform float uScanX;
  uniform float uRich;
  varying vec3 vDir;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    vec3 zenith = vec3(0.004, 0.007, 0.006);
    vec3 mid = vec3(0.012, 0.022, 0.018);
    vec3 horizon = vec3(0.02, 0.038, 0.03);
    vec3 color = mix(horizon, mid, smoothstep(-0.12, 0.22, h));
    color = mix(color, zenith, smoothstep(0.18, 0.78, h));

    float strata = smoothstep(0.12, 0.0, abs(fract(h * 5.2 + dir.x * 0.15) - 0.5));
    color += vec3(0.04, 0.12, 0.08) * strata * 0.045 * uRich;

    float veil = pow(max(0.0, 1.0 - abs(h - 0.04) * 3.4), 2.0);
    color += vec3(0.03, 0.08, 0.06) * veil * 0.12;

    float grain = hash(dir.xz * 18.0 + floor(uTime * 0.02 * uMotion));
    color += vec3(0.03, 0.07, 0.055) * grain * 0.025 * uRich;

    float scan = smoothstep(0.045, 0.0, abs(dir.x - uScanX * 0.012)) * uScan;
    color += vec3(0.18, 0.7, 0.4) * scan * 0.04;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const megaVertex = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormalW;
  void main() {
    #ifdef USE_INSTANCING
      vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vNormalW = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    #else
      vec4 world = modelMatrix * vec4(position, 1.0);
      vNormalW = normalize(mat3(modelMatrix) * normal);
    #endif
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const megaFragment = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec3 vWorld;
  varying vec3 vNormalW;

  void main() {
    vec3 n = normalize(vNormalW);
    float rim = pow(1.0 - max(dot(n, vec3(0.0, 0.85, 0.2)), 0.0), 2.4);
    float top = smoothstep(0.62, 0.95, n.y);
    vec3 color = vec3(0.014, 0.02, 0.017);
    color += vec3(0.03, 0.055, 0.04) * rim * 0.28;
    color += vec3(0.02, 0.04, 0.03) * top * 0.22;
    float dist = length(vWorld);
    float fog = 1.0 - exp(-uFogDensity * dist * 1.15);
    color = mix(color, uFogColor, clamp(fog, 0.0, 0.9));
    gl_FragColor = vec4(color, 1.0);
  }
`;

const shaftVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const shaftFragment = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  varying vec2 vUv;
  varying vec3 vWorld;

  void main() {
    float beam = pow(1.0 - abs(vUv.x - 0.5) * 2.0, 2.6);
    float rise = smoothstep(0.0, 0.07, vUv.y) * (1.0 - smoothstep(0.42, 1.0, vUv.y));
    float breathe = 0.86 + 0.14 * sin(uTime * 0.17 + vWorld.x * 0.08) * uMotion;
    float alpha = beam * rise * breathe * 0.055;
    vec3 color = mix(vec3(0.08, 0.7, 0.32), vec3(0.45, 0.95, 0.82), beam * 0.35);
    gl_FragColor = vec4(color, alpha);
  }
`;

const hazeVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const hazeFragment = /* glsl */ `
  uniform float uAlpha;
  varying vec3 vWorld;
  void main() {
    float r = length(vWorld.xz);
    float fade = smoothstep(48.0, 6.0, r);
    vec3 color = vec3(0.03, 0.07, 0.05);
    gl_FragColor = vec4(color, fade * uAlpha);
  }
`;

const moteVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uSize;
  uniform float uMotion;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.y = mix(p.y, mod(p.y + uTime * (0.04 + aSeed * 0.07) + aSeed * 5.0, 7.2) - 0.2, uMotion);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.55 + aSeed * 0.45) * (64.0 / -mv.z);
    vAlpha = 0.08 + aSeed * 0.22;
  }
`;

const moteFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float glow = smoothstep(0.5, 0.0, d);
    vec3 color = mix(vec3(0.1, 0.55, 0.28), vec3(0.55, 0.92, 0.82), glow * 0.4);
    gl_FragColor = vec4(color, glow * vAlpha);
  }
`;

const ringVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const ringFragment = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec3 vWorld;
  void main() {
    vec3 color = vec3(0.05, 0.14, 0.09);
    float dist = length(vWorld);
    float fog = 1.0 - exp(-uFogDensity * dist);
    color = mix(color, uFogColor, clamp(fog, 0.0, 0.85));
    gl_FragColor = vec4(color, 0.22);
  }
`;

export type EnvironmentSystem = {
  setPulse: (value: number) => void;
  setFocus: (value: number) => void;
  update: (time: number) => void;
  dispose: () => void;
};

export function createEnvironment(scene: Scene, quality: QualityProfile): EnvironmentSystem {
  scene.fog = new FogExp2(FOG_COLOR, FOG_DENSITY);

  const group = new Group();
  scene.add(group);

  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const hemi = new HemisphereLight(0x8eeebb, 0x030605, 0.5);
  group.add(hemi);

  const key = new PointLight(0x3dff8a, 16, 46, 2);
  key.position.set(8, 14, 10);
  group.add(key);

  const fill = new PointLight(0xb8fff4, 7, 38, 2);
  fill.position.set(-12, 9, -6);
  group.add(fill);

  const motion = quality.reducedMotion ? 0 : 1;
  let focusTarget = 0;
  const liveFx = quality.worldFx && !quality.reducedMotion;

  const groundMat = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPulse: { value: 0 },
      uFocus: { value: 0 },
      uMotion: { value: motion },
      uScan: { value: 0 },
      uScanX: { value: -80 },
    },
    vertexShader: groundVertex,
    fragmentShader: groundFragment,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  track(groundMat);
  const ground = new Mesh(track(new PlaneGeometry(170, 170, 1, 1)), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03;
  ground.renderOrder = -1;
  group.add(ground);

  const skyMat = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMotion: { value: motion },
      uScan: { value: 0 },
      uScanX: { value: -80 },
      uRich: { value: quality.richSky ? 1 : 0.45 },
    },
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
    depthWrite: false,
    side: BackSide,
    fog: false,
  });
  track(skyMat);
  const sky = new Mesh(track(new SphereGeometry(118, quality.richSky ? 32 : 20, quality.richSky ? 20 : 12)), skyMat);
  sky.renderOrder = -20;
  sky.frustumCulled = false;
  group.add(sky);

  const starGeo = new BufferGeometry();
  const starCount = quality.distantLights;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const radius = 34 + Math.random() * 36;
    const angle = Math.random() * Math.PI * 2;
    starPos[i * 3] = Math.cos(angle) * radius;
    starPos[i * 3 + 1] = 0.55 + Math.random() * 7.5;
    starPos[i * 3 + 2] = Math.sin(angle) * radius * 0.58;
  }
  starGeo.setAttribute("position", new BufferAttribute(starPos, 3));
  track(starGeo);
  const stars = new Points(
    starGeo,
    track(
      new PointsMaterial({
        color: new Color(0x6ee6a8),
        size: 0.05,
        transparent: true,
        opacity: 0.32,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    ),
  );
  group.add(stars);

  const dummy = new Object3D();
  const slabs = createMegaSlabs(quality.megaCount);
  const megaMat = new ShaderMaterial({
    uniforms: {
      uFogColor: { value: new Color(FOG_COLOR) },
      uFogDensity: { value: FOG_DENSITY },
    },
    vertexShader: megaVertex,
    fragmentShader: megaFragment,
  });
  track(megaMat);
  const megas = new InstancedMesh(track(new BoxGeometry(1, 1, 1)), megaMat, Math.max(slabs.length, 1));
  megas.frustumCulled = false;
  for (let i = 0; i < slabs.length; i += 1) {
    const slab = slabs[i];
    dummy.position.set(slab.x, slab.y, slab.z);
    dummy.rotation.set(0, slab.yaw, 0);
    dummy.scale.set(slab.sx, slab.sy, slab.sz);
    dummy.updateMatrix();
    megas.setMatrixAt(i, dummy.matrix);
  }
  megas.instanceMatrix.needsUpdate = true;
  megas.count = slabs.length;
  group.add(megas);

  const shaftMat = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMotion: { value: motion },
    },
    vertexShader: shaftVertex,
    fragmentShader: shaftFragment,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  });
  track(shaftMat);
  const shaftGeo = track(new PlaneGeometry(1, 1));
  const shafts = new Group();
  const anchors = shaftAnchorsFor(quality.shafts);
  for (const anchor of anchors) {
    for (const yaw of [0, Math.PI * 0.5]) {
      const card = new Mesh(shaftGeo, shaftMat);
      card.position.set(anchor.x, anchor.height * 0.5, anchor.z);
      card.scale.set(anchor.width, anchor.height, 1);
      card.rotation.y = yaw;
      card.renderOrder = 2;
      shafts.add(card);
    }
  }
  group.add(shafts);

  const hazeMat = new ShaderMaterial({
    uniforms: { uAlpha: { value: 0.055 } },
    vertexShader: hazeVertex,
    fragmentShader: hazeFragment,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  track(hazeMat);
  const hazeLow = new Mesh(track(new PlaneGeometry(110, 110)), hazeMat);
  hazeLow.rotation.x = -Math.PI / 2;
  hazeLow.position.y = 0.42;
  hazeLow.renderOrder = 1;
  group.add(hazeLow);

  if (quality.richSky) {
    const hazeHighMat = new ShaderMaterial({
      uniforms: { uAlpha: { value: 0.03 } },
      vertexShader: hazeVertex,
      fragmentShader: hazeFragment,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    track(hazeHighMat);
    const hazeHigh = new Mesh(track(new PlaneGeometry(88, 88)), hazeHighMat);
    hazeHigh.rotation.x = -Math.PI / 2;
    hazeHigh.position.y = 1.55;
    hazeHigh.renderOrder = 1;
    group.add(hazeHigh);
  }

  const moteCount = quality.atmosphereMotes;
  const motePos = new Float32Array(moteCount * 3);
  const moteSeeds = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i += 1) {
    const radius = 3 + Math.random() * 22;
    const angle = Math.random() * Math.PI * 2;
    motePos[i * 3] = Math.cos(angle) * radius;
    motePos[i * 3 + 1] = Math.random() * 6.2;
    motePos[i * 3 + 2] = Math.sin(angle) * radius * 0.55;
    moteSeeds[i] = Math.random();
  }
  const moteGeo = new BufferGeometry();
  moteGeo.setAttribute("position", new BufferAttribute(motePos, 3));
  moteGeo.setAttribute("aSeed", new BufferAttribute(moteSeeds, 1));
  track(moteGeo);
  const moteMat = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: quality.isCompact ? 0.36 : 0.48 },
      uMotion: { value: motion },
    },
    vertexShader: moteVertex,
    fragmentShader: moteFragment,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  track(moteMat);
  const motes = new Points(moteGeo, moteMat);
  motes.frustumCulled = false;
  motes.renderOrder = 3;
  group.add(motes);

  const ringMat = new ShaderMaterial({
    uniforms: {
      uFogColor: { value: new Color(FOG_COLOR) },
      uFogDensity: { value: FOG_DENSITY },
    },
    vertexShader: ringVertex,
    fragmentShader: ringFragment,
    transparent: true,
    depthWrite: false,
    wireframe: true,
  });
  track(ringMat);
  const ring = new Mesh(
    track(
      new TorusGeometry(
        ORBITAL_FRAME.radius,
        ORBITAL_FRAME.tube,
        6,
        quality.lowPower ? 64 : 96,
      ),
    ),
    ringMat,
  );
  ring.position.set(ORBITAL_FRAME.x, ORBITAL_FRAME.y, ORBITAL_FRAME.z);
  ring.rotation.set(ORBITAL_FRAME.rx, ORBITAL_FRAME.ry, ORBITAL_FRAME.rz);
  group.add(ring);

  const flashMat = new SpriteMaterial({
    color: 0x7dffe0,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  track(flashMat);
  const flash = new Sprite(flashMat);
  flash.position.set(-42, 9.5, -34);
  flash.scale.set(11, 7, 1);
  flash.visible = liveFx;
  group.add(flash);

  let nextScan = 17 + Math.random() * 10;
  let scanStart = -100;
  let nextFlash = 26 + Math.random() * 18;
  let flashStart = -100;

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
        groundMat.uniforms.uScan.value = 0;
        skyMat.uniforms.uTime.value = 0;
        skyMat.uniforms.uScan.value = 0;
        shaftMat.uniforms.uTime.value = 0;
        moteMat.uniforms.uTime.value = 0;
        flashMat.opacity = 0;
        key.intensity = 13;
        fill.intensity = 5.5;
        return;
      }

      groundMat.uniforms.uTime.value = time;
      skyMat.uniforms.uTime.value = time;
      shaftMat.uniforms.uTime.value = time;
      moteMat.uniforms.uTime.value = time;
      key.intensity = 13.5 + Math.sin(time * 0.28) * 1.1;
      fill.intensity = 5.6 + Math.cos(time * 0.19) * 0.7;

      let scan = 0;
      let scanX = -80;
      if (liveFx) {
        if (time > nextScan) {
          scanStart = time;
          nextScan = time + 16 + Math.random() * 14;
        }
        const scanAge = time - scanStart;
        if (scanAge >= 0 && scanAge < 3.6) {
          const t = scanAge / 3.6;
          scan = Math.sin(t * Math.PI) * 0.85;
          scanX = -62 + t * 124;
        }
        if (time > nextFlash) {
          flashStart = time;
          nextFlash = time + 22 + Math.random() * 26;
        }
        const flashAge = time - flashStart;
        flashMat.opacity =
          flashAge >= 0 && flashAge < 0.7 ? Math.sin((flashAge / 0.7) * Math.PI) * 0.16 : 0;
      }

      groundMat.uniforms.uScan.value = scan;
      groundMat.uniforms.uScanX.value = scanX;
      skyMat.uniforms.uScan.value = scan;
      skyMat.uniforms.uScanX.value = scanX;
    },
    dispose() {
      scene.remove(group);
      megas.dispose();
      disposables.forEach((item) => item.dispose());
    },
  };
}
