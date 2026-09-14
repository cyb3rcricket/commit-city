import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  EdgesGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  type Raycaster,
  type Scene,
} from "three";
import type { ContributionDay } from "../../shared/types";
import {
  footprintForLevel,
  heightForCount,
  robustMaxCount,
} from "../../shared/calendar";
import type { QualityProfile } from "./quality";

export const LOT = 0.58;
export const GAP_X = 0.2;
export const GAP_Z = 0.1;
export const CONSTRUCT_RISE = 0.58;
export const CONSTRUCT_WEEK_DELAY = 0.044;
export const CONSTRUCT_DAY_DELAY = 0.008;

const dummy = new Object3D();

const buildingVertex = /* glsl */ `
  attribute float aIndex;
  attribute float aLevel;
  attribute float aDelay;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying vec3 vLocal;
  varying float vIndex;
  varying float vLevel;
  varying float vDelay;
  void main() {
    vLocal = position;
    vIndex = aIndex;
    vLevel = aLevel;
    vDelay = aDelay;
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

const buildingFragment = /* glsl */ `
  uniform float uTime;
  uniform float uHover;
  uniform float uSelected;
  uniform float uConstruct;
  uniform float uRise;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying vec3 vLocal;
  varying float vIndex;
  varying float vLevel;
  varying float vDelay;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec3 n = normalize(vNormalW);
    float top = smoothstep(0.65, 0.95, n.y);
    float rim = pow(1.0 - max(dot(n, vec3(0.0, 1.0, 0.15)), 0.0), 2.2);

    float wx = abs(vLocal.x);
    float wz = abs(vLocal.z);
    float edge = max(smoothstep(0.42, 0.5, wx), smoothstep(0.42, 0.5, wz));

    vec2 grid = vec2(vWorld.x * 6.2, vWorld.y * 3.4);
    vec2 cell = floor(grid);
    vec2 f = fract(grid);
    float windowMask = step(0.28, f.x) * step(0.32, f.y) * step(f.x, 0.82) * step(f.y, 0.86);
    windowMask *= 1.0 - top;
    float lit = step(0.32, hash(cell + vIndex));
    lit *= step(0.15, vLevel);

    vec3 body = mix(vec3(0.007, 0.014, 0.011), vec3(0.016, 0.038, 0.026), vLevel / 4.0);
    vec3 glass = vec3(0.016, 0.034, 0.028);
    vec3 emit = mix(vec3(0.04, 0.32, 0.15), vec3(0.14, 0.82, 0.4), vLevel / 4.0);
    vec3 cyan = vec3(0.45, 0.96, 0.9);

    vec3 color = mix(body, glass, 0.22);
    color += emit * lit * windowMask * (1.05 + vLevel * 0.22);
    color += emit * top * 0.28;
    color += mix(emit, cyan, 0.4) * edge * 0.42;
    color += emit * rim * 0.12;

    float hover = 1.0 - step(0.5, abs(vIndex - uHover));
    float selected = 1.0 - step(0.5, abs(vIndex - uSelected));
    color += emit * hover * 0.5;
    color += cyan * selected * 0.4;
    color += emit * selected * edge * 0.7;

    float localT = clamp((uConstruct - vDelay) / max(uRise, 0.001), 0.0, 1.0);
    float birth = smoothstep(0.0, 0.08, localT) * (1.0 - smoothstep(0.1, 0.5, localT));
    float h01 = vLocal.y + 0.5;
    float shaft = smoothstep(0.2, 0.0, abs(h01 - mix(-0.05, 1.08, localT)));
    shaft *= (1.0 - smoothstep(0.72, 1.0, localT)) * step(0.02, localT);
    color += emit * birth * (0.85 + vLevel * 0.22);
    color += vec3(0.2, 1.0, 0.52) * shaft * (0.4 + vLevel * 0.16);
    color += emit * (0.02 + 0.02 * sin(uTime * 1.05 + vIndex * 0.15));

    float dist = length(vWorld);
    float fog = 1.0 - exp(-uFogDensity * dist);
    color = mix(color, uFogColor, clamp(fog, 0.0, 0.75));

    gl_FragColor = vec4(color, 0.96);
  }
`;

const foundationVertex = /* glsl */ `
  varying vec3 vLocal;
  varying float vLevel;
  attribute float aLevel;
  void main() {
    vLocal = position;
    vLevel = aLevel;
    #ifdef USE_INSTANCING
      vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    #else
      vec4 world = modelMatrix * vec4(position, 1.0);
    #endif
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const foundationFragment = /* glsl */ `
  varying vec3 vLocal;
  varying float vLevel;
  uniform float uPulse;
  void main() {
    float edge = max(abs(vLocal.x), abs(vLocal.z));
    float ring = smoothstep(0.36, 0.5, edge);
    vec3 color = mix(vec3(0.02, 0.05, 0.035), vec3(0.04, 0.14, 0.08), vLevel / 4.0);
    color += vec3(0.12, 0.95, 0.45) * ring * (0.28 + uPulse * 0.55);
    gl_FragColor = vec4(color, 0.9);
  }
`;

function lotPosition(weekIndex: number, dayIndex: number, weeks: number) {
  const x = (weekIndex - (weeks - 1) / 2) * (LOT + GAP_X);
  const z = (dayIndex - 3) * (LOT + GAP_Z);
  return { x, z };
}

function easeOutBack(t: number): number {
  const c1 = 1.22;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeInCubic(t: number): number {
  return t * t * t;
}

export type CitySystem = {
  group: Group;
  days: ContributionDay[];
  setDays: (
    days: ContributionDay[],
    options: { reducedMotion: boolean; reverse?: boolean },
  ) => void;
  setLoading: (loading: boolean) => void;
  highlight: (index: number) => void;
  select: (index: number) => void;
  pick: (raycaster: Raycaster) => number;
  update: (time: number, dt: number) => void;
  citySize: () => { width: number; depth: number };
  constructionDuration: () => number;
  getDay: (index: number) => ContributionDay | null;
  dispose: () => void;
};

export function createCity(scene: Scene, quality: QualityProfile): CitySystem {
  const group = new Group();
  scene.add(group);

  const emptyDays: ContributionDay[] = [];
  for (let week = 0; week < 53; week += 1) {
    for (let day = 0; day < 7; day += 1) {
      emptyDays.push({
        date: "",
        contributionCount: 0,
        level: 0,
        weekIndex: week,
        dayIndex: day,
      });
    }
  }

  let days = emptyDays;
  let targetHeights = new Float32Array(days.length);
  let progress = new Float32Array(days.length);
  let delays = new Float32Array(days.length);
  let animating = false;
  let reverse = false;
  let constructTime = 0;
  let loading = false;
  let weeks = 53;
  let buildDuration = 0;

  const buildingMat = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uHover: { value: -1 },
      uSelected: { value: -1 },
      uConstruct: { value: 0 },
      uRise: { value: CONSTRUCT_RISE },
      uFogColor: { value: new Color(0x050807) },
      uFogDensity: { value: 0.02 },
    },
    vertexShader: buildingVertex,
    fragmentShader: buildingFragment,
    transparent: false,
  });

  const foundationMat = new ShaderMaterial({
    uniforms: { uPulse: { value: 0 } },
    vertexShader: foundationVertex,
    fragmentShader: foundationFragment,
    transparent: true,
  });

  const beaconMat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: buildingVertex,
    fragmentShader: /* glsl */ `
      varying float vLevel;
      uniform float uTime;
      void main() {
        float pulse = 0.6 + 0.4 * sin(uTime * 2.2);
        vec3 color = mix(vec3(0.2, 1.0, 0.55), vec3(0.75, 1.0, 0.95), 0.35);
        gl_FragColor = vec4(color * (0.4 + vLevel * 0.25) * pulse, 1.0);
      }
    `,
    transparent: false,
  });

  let buildings!: InstancedMesh;
  let foundations!: InstancedMesh;
  let beacons!: InstancedMesh;

  const district = new Mesh(
    new PlaneGeometry(1, 1),
    new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          float e = max(abs(vUv.x - 0.5), abs(vUv.y - 0.5));
          float frame = smoothstep(0.492, 0.5, e);
          vec3 color = vec3(0.12, 0.95, 0.45) * frame * 0.45;
          gl_FragColor = vec4(color, frame * 0.9);
        }
      `,
      transparent: true,
      depthWrite: false,
    }),
  );
  district.rotation.x = -Math.PI / 2;
  district.position.y = 0.001;
  group.add(district);

  const outline = new LineSegments(
    new EdgesGeometry(new BoxGeometry(1, 0.02, 1)),
    new LineBasicMaterial({ color: 0x3dff8a, transparent: true, opacity: 0.2 }),
  );
  outline.position.y = 0.01;
  group.add(outline);

  const writeAttributes = (mesh: InstancedMesh, count: number) => {
    const indexes = new Float32Array(count);
    const levels = new Float32Array(count);
    const delayAttr = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      indexes[i] = i;
      levels[i] = days[i]?.level ?? 0;
      delayAttr[i] = delays[i] ?? 0;
    }
    mesh.geometry.setAttribute("aIndex", new InstancedBufferAttribute(indexes, 1));
    mesh.geometry.setAttribute("aLevel", new InstancedBufferAttribute(levels, 1));
    mesh.geometry.setAttribute("aDelay", new InstancedBufferAttribute(delayAttr, 1));
  };

  const layoutDistrict = () => {
    const width = weeks * (LOT + GAP_X);
    const depth = 7 * (LOT + GAP_Z);
    district.scale.set(width + 1.4, depth + 1.1, 1);
    outline.scale.set(width + 1.4, 1, depth + 1.1);
  };

  const applyInstance = (index: number, height: number, showBeacon: boolean) => {
    const day = days[index];
    if (!day) return;
    const { x, z } = lotPosition(day.weekIndex, day.dayIndex, weeks);
    const footprint = footprintForLevel(day.level) * LOT;

    dummy.position.set(x, 0.035, z);
    dummy.scale.set(footprint * 1.08, 0.07, footprint * 1.08);
    dummy.updateMatrix();
    foundations.setMatrixAt(index, dummy.matrix);

    const h = Math.max(height, 0.001);
    dummy.position.set(x, h / 2, z);
    dummy.scale.set(footprint, h, footprint);
    dummy.updateMatrix();
    buildings.setMatrixAt(index, dummy.matrix);

    if (showBeacon && day.level >= 3 && height > 0.4) {
      dummy.position.set(x, height + 0.14, z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
    } else {
      dummy.position.set(x, -4, z);
      dummy.scale.set(0.001, 0.001, 0.001);
      dummy.updateMatrix();
    }
    beacons.setMatrixAt(index, dummy.matrix);
  };

  const rebuildMeshes = (count: number) => {
    if (buildings && foundations && beacons) {
      group.remove(buildings, foundations, beacons);
      const geos = new Set([
        buildings.geometry,
        foundations.geometry,
        beacons.geometry,
      ]);
      geos.forEach((geo) => geo.dispose());
      buildings.dispose();
      foundations.dispose();
      beacons.dispose();
    }

    const buildingGeo = new BoxGeometry(1, 1, 1);
    const foundationGeo = new BoxGeometry(1, 1, 1);
    const beaconGeo = new BoxGeometry(0.08, 0.18, 0.08);

    buildings = new InstancedMesh(buildingGeo, buildingMat, count);
    foundations = new InstancedMesh(foundationGeo, foundationMat, count);
    beacons = new InstancedMesh(beaconGeo, beaconMat, count);
    buildings.instanceMatrix.setUsage(DynamicDrawUsage);
    foundations.instanceMatrix.setUsage(DynamicDrawUsage);
    beacons.instanceMatrix.setUsage(DynamicDrawUsage);
    buildings.frustumCulled = false;
    foundations.frustumCulled = false;
    beacons.frustumCulled = false;
    group.add(foundations, buildings, beacons);
    writeAttributes(buildings, count);
    writeAttributes(foundations, count);
    writeAttributes(beacons, count);
  };

  const stamp = (immediate = false) => {
    for (let i = 0; i < days.length; i += 1) {
      const t = immediate ? 1 : progress[i];
      applyInstance(i, targetHeights[i] * Math.max(t, 0.002), t > 0.85);
    }
    buildings.instanceMatrix.needsUpdate = true;
    foundations.instanceMatrix.needsUpdate = true;
    beacons.instanceMatrix.needsUpdate = true;
  };

  const configureDays = (
    next: ContributionDay[],
    options: { reducedMotion: boolean; reverse?: boolean },
  ) => {
    days = next;
    weeks = 1 + next.reduce((max, day) => Math.max(max, day.weekIndex), 0);
    const ref = robustMaxCount(next);
    targetHeights = new Float32Array(next.length);
    progress = new Float32Array(next.length);
    delays = new Float32Array(next.length);
    reverse = Boolean(options.reverse);
    constructTime = 0;
    animating = true;
    let maxDelay = 0;

    for (let i = 0; i < next.length; i += 1) {
      const day = next[i];
      targetHeights[i] = heightForCount(day.contributionCount, ref);
      const chronological =
        day.weekIndex * CONSTRUCT_WEEK_DELAY + day.dayIndex * CONSTRUCT_DAY_DELAY;
      delays[i] = options.reducedMotion || reverse ? 0 : chronological;
      maxDelay = Math.max(maxDelay, delays[i]);
      progress[i] = reverse ? 1 : 0;
    }
    buildDuration = options.reducedMotion
      ? 0
      : maxDelay + (reverse ? 0.7 : CONSTRUCT_RISE);

    rebuildMeshes(next.length);
    layoutDistrict();
    if (options.reducedMotion) {
      progress.fill(reverse ? 0 : 1);
      animating = false;
      stamp(true);
      return;
    }
    stamp(false);
  };

  configureDays(emptyDays, { reducedMotion: true });

  return {
    group,
    get days() {
      return days;
    },
    setDays(next, options) {
      configureDays(next, options);
    },
    setLoading(value: boolean) {
      loading = value;
    },
    highlight(index: number) {
      buildingMat.uniforms.uHover.value = index;
    },
    select(index: number) {
      buildingMat.uniforms.uSelected.value = index;
    },
    pick(raycaster) {
      const hits = raycaster.intersectObject(buildings, false);
      if (hits.length === 0) return -1;
      return hits[0].instanceId ?? -1;
    },
    update(time: number, dt: number) {
      if (quality.reducedMotion) {
        buildingMat.uniforms.uTime.value = 0;
        beaconMat.uniforms.uTime.value = 0;
        foundationMat.uniforms.uPulse.value = 0.08;
        (district.material as ShaderMaterial).uniforms.uTime.value = 0;
        return;
      }
      buildingMat.uniforms.uTime.value = time;
      beaconMat.uniforms.uTime.value = time;
      const pulse = loading ? 0.45 + 0.55 * Math.abs(Math.sin(time * 1.4)) : 0.08;
      foundationMat.uniforms.uPulse.value = pulse;
      (district.material as ShaderMaterial).uniforms.uTime.value = time;

      if (!animating) return;
      constructTime += dt;
      buildingMat.uniforms.uConstruct.value = constructTime;
      buildingMat.uniforms.uRise.value = reverse ? 0.7 : CONSTRUCT_RISE;
      const duration = reverse ? 0.7 : CONSTRUCT_RISE;
      let done = 0;
      for (let i = 0; i < days.length; i += 1) {
        const local = (constructTime - delays[i]) / duration;
        const t = Math.min(1, Math.max(0, local));
        const eased = reverse ? 1 - easeInCubic(t) : easeOutBack(t);
        progress[i] = Math.max(0, eased);
        if (t >= 1) done += 1;
      }
      stamp(false);
      if (done >= days.length) animating = false;
    },
    citySize() {
      return {
        width: weeks * (LOT + GAP_X),
        depth: 7 * (LOT + GAP_Z),
      };
    },
    constructionDuration() {
      return buildDuration;
    },
    getDay(index: number) {
      return days[index] ?? null;
    },
    dispose() {
      scene.remove(group);
      buildings.dispose();
      foundations.dispose();
      beacons.dispose();
      buildings.geometry.dispose();
      foundations.geometry.dispose();
      beacons.geometry.dispose();
      buildingMat.dispose();
      foundationMat.dispose();
      beaconMat.dispose();
      district.geometry.dispose();
      (district.material as ShaderMaterial).dispose();
      outline.geometry.dispose();
      (outline.material as LineBasicMaterial).dispose();
    },
  };
}
