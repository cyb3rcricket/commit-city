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
  MeshBasicMaterial,
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

const FOG_COLOR = 0x040605;
const FOG_DENSITY = 0.004;

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

  void main() {
    vec2 p = vWorld.xz;
    float px = p.x;
    float pz = p.y;
    float dist = length(p);
    float near = mix(22.0, 12.0, uFocus);
    float far = mix(64.0, 30.0, uFocus);
    float fade = smoothstep(far, near, dist);

    float inDistrict = smoothstep(22.4, 17.5, abs(px)) * smoothstep(3.6, 1.5, abs(pz));
    float outside = 1.0 - inDistrict;

    float fine = lineGrid(p, 0.72, 0.022);
    float coarse = lineGrid(p, 0.11, 0.01);
    float pulse = 0.5 + 0.5 * sin(px * 0.2 - uTime * 0.32 * uMotion);
    float wave = 1.0 - abs(fract((px + 26.0) / 54.0 - uPulse) * 2.0 - 1.0);
    wave = smoothstep(0.35, 1.0, wave);

    vec3 base = vec3(0.006, 0.009, 0.007);
    vec3 green = vec3(0.12, 0.95, 0.45);
    vec3 cyan = vec3(0.55, 0.95, 0.92);
    float dim = mix(0.72, 0.22, uFocus);

    vec3 color = base;
    color += green * fine * 0.032 * dim;
    color += mix(green, cyan, 0.35) * coarse * 0.07 * dim;
    color += green * wave * uPulse * 0.05;
    color += cyan * pulse * 0.004 * dim;

    float ring = smoothstep(0.22, 0.0, abs(dist - 21.0));
    color += green * ring * 0.028 * dim;

    float smear = pow(1.0 - saturate(abs(pz) / 3.8), 3.2) * inDistrict;
    smear *= 0.55 + 0.45 * smoothstep(18.0, 4.0, abs(px));
    color += vec3(0.03, 0.07, 0.05) * smear * 0.16 * dim;
    float glass = pow(1.0 - saturate(abs(pz) * 0.22), 10.0) * inDistrict;
    color += vec3(0.18, 0.4, 0.32) * glass * 0.016 * dim;

    float pathA = exp(-pow(pz - (18.6 + 0.55 * sin(px * 0.06)), 2.0) * 12.0);
    float pathB = exp(-pow(pz + (19.4 + 0.42 * cos(px * 0.05)), 2.0) * 12.0);
    float pathC = exp(-pow(px - (44.5 + 0.3 * sin(pz * 0.14)), 2.0) * 9.0);
    float ringRoad = exp(-pow(dist - 48.5, 2.0) * 3.6);
    float highways = (pathA + pathB + pathC * 0.7 + ringRoad * 0.5) * outside;
    float packet = smoothstep(0.07, 0.0, abs(fract(px * 0.028 - uTime * 0.022) - 0.5));
    float flow = mix(0.22, 0.22 + packet * 0.38, uMotion);
    color += green * highways * 0.08 * flow * dim;
    color += cyan * highways * packet * uMotion * 0.028 * dim;

    float scanBand = smoothstep(2.2, 0.0, abs(px - uScanX)) * uScan * outside;
    color += mix(green, cyan, 0.25) * scanBand * 0.035;

    color = min(color, vec3(0.055, 0.09, 0.07));
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
    vec3 zenith = vec3(0.01, 0.014, 0.012);
    vec3 mid = vec3(0.016, 0.024, 0.02);
    vec3 horizon = vec3(0.024, 0.038, 0.03);
    vec3 color = mix(horizon, mid, smoothstep(-0.14, 0.2, h));
    color = mix(color, zenith, smoothstep(0.16, 0.76, h));

    float strata = smoothstep(0.14, 0.0, abs(fract(h * 4.6 + dir.x * 0.18) - 0.5));
    color += vec3(0.05, 0.12, 0.08) * strata * 0.04 * uRich;

    float columns = smoothstep(0.06, 0.0, abs(fract(dir.x * 3.4) - 0.5));
    color += vec3(0.04, 0.09, 0.07) * columns * (1.0 - smoothstep(0.05, 0.55, h)) * 0.035 * uRich;

    float veil = pow(max(0.0, 1.0 - abs(h - 0.02) * 2.8), 2.0);
    color += vec3(0.03, 0.055, 0.042) * veil * 0.07;

    float grain = hash(dir.xz * 18.0 + floor(uTime * 0.02 * uMotion));
    color += vec3(0.03, 0.055, 0.045) * grain * 0.018 * uRich;

    float scan = smoothstep(0.045, 0.0, abs(dir.x - uScanX * 0.012)) * uScan;
    color += vec3(0.12, 0.45, 0.28) * scan * 0.022;

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
    float rise = smoothstep(0.0, 0.07, vUv.y) * (1.0 - smoothstep(0.38, 1.0, vUv.y));
    float breathe = 0.82 + 0.1 * sin(uTime * 0.14 + vWorld.x * 0.06) * uMotion;
    float hazeFade = smoothstep(78.0, 36.0, length(vWorld.xz));
    float alpha = beam * rise * breathe * hazeFade * 0.09;
    vec3 color = mix(vec3(0.08, 0.55, 0.28), vec3(0.32, 0.75, 0.64), beam * 0.28);
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
    float fade = smoothstep(56.0, 14.0, r) * (1.0 - smoothstep(8.0, 0.0, r) * 0.55);
    vec3 color = vec3(0.016, 0.028, 0.022);
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
    vAlpha = 0.035 + aSeed * 0.1;
  }
`;

const moteFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float glow = smoothstep(0.5, 0.0, d);
    vec3 color = mix(vec3(0.08, 0.4, 0.22), vec3(0.4, 0.72, 0.64), glow * 0.32);
    gl_FragColor = vec4(color, glow * vAlpha);
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

  const hemi = new HemisphereLight(0x6eb894, 0x020403, 0.28);
  group.add(hemi);

  const key = new PointLight(0x3dff8a, 11, 40, 2);
  key.position.set(8, 14, 10);
  group.add(key);

  const fill = new PointLight(0xb8fff4, 4.2, 32, 2);
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
        color: new Color(0x5cb888),
        size: 0.05,
        transparent: true,
        opacity: 0.22,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    ),
  );
  group.add(stars);

  const dummy = new Object3D();
  const slabs = createMegaSlabs(quality.megaCount);
  const megaMat = new MeshBasicMaterial({
    color: 0x0a100e,
    fog: true,
  });
  track(megaMat);
  const ridgeMat = new MeshBasicMaterial({
    color: 0x070b0a,
    fog: true,
  });
  track(ridgeMat);
  const farRidge = new Mesh(track(new BoxGeometry(46, 2.1, 2.6)), ridgeMat);
  farRidge.position.set(6.0, 3.15, -72.0);
  farRidge.rotation.y = 0.05;
  group.add(farRidge);
  const farRidgeB = new Mesh(track(new BoxGeometry(22, 2.6, 2.2)), ridgeMat);
  farRidgeB.position.set(28.5, 3.45, -78.5);
  farRidgeB.rotation.y = -0.14;
  group.add(farRidgeB);
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
    uniforms: { uAlpha: { value: 0.034 } },
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
      uniforms: { uAlpha: { value: 0.016 } },
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

  const ringMat = new MeshBasicMaterial({
    color: 0x1a3d2c,
    wireframe: true,
    transparent: true,
    opacity: 0.15,
    fog: true,
    depthWrite: false,
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
  flash.position.set(-58, 8.2, -52);
  flash.scale.set(9, 5.5, 1);
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
        key.intensity = 9.5;
        fill.intensity = 3.4;
        return;
      }

      groundMat.uniforms.uTime.value = time;
      skyMat.uniforms.uTime.value = time;
      shaftMat.uniforms.uTime.value = time;
      moteMat.uniforms.uTime.value = time;
      key.intensity = 9.8 + Math.sin(time * 0.28) * 0.7;
      fill.intensity = 3.6 + Math.cos(time * 0.19) * 0.4;

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
          flashAge >= 0 && flashAge < 0.7 ? Math.sin((flashAge / 0.7) * Math.PI) * 0.07 : 0;
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
