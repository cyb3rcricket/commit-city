/** Contribution district in world XZ. Scenery must stay outside this box. */
export const DISTRICT = {
  halfWidth: 22.6,
  halfDepth: 4.15,
};

/** Keep large scenery beyond a typical cinematic orbit (~18) and max zoom (~52). */
export const MEGA_MIN_RADIUS = 56;

/** Extra pad so shafts and roads never read as part of the contribution lots. */
export const SCENERY_CLEARANCE = 12;

export type MegaSlab = {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  yaw: number;
};

export type ShaftAnchor = {
  x: number;
  z: number;
  height: number;
  width: number;
};

export const SHAFT_ANCHORS: readonly ShaftAnchor[] = [
  { x: 46.5, z: 22.8, height: 11.2, width: 1.55 },
  { x: -45.2, z: 21.4, height: 10.4, width: 1.35 },
  { x: 43.8, z: -24.6, height: 9.6, width: 1.15 },
  { x: -42.4, z: -25.2, height: 9.0, width: 1.05 },
  { x: 16.8, z: 48.5, height: 8.2, width: 0.95 },
];

export const ORBITAL_FRAME = {
  x: 1.2,
  y: 4.35,
  z: -26.4,
  radius: 6.8,
  tube: 0.062,
  rx: 0.16,
  ry: 0.2,
  rz: 0.07,
};

const LANDMARKS: readonly MegaSlab[] = [
  { x: 64.5, y: 2.15, z: 31.2, sx: 4.4, sy: 4.3, sz: 8.2, yaw: -0.18 },
  { x: -66.0, y: 2.05, z: 29.6, sx: 4.2, sy: 4.1, sz: 7.8, yaw: 0.16 },
  { x: 61.8, y: 1.85, z: -38.4, sx: 7.2, sy: 3.7, sz: 4.2, yaw: 0.36 },
  { x: -60.4, y: 1.8, z: -40.2, sx: 6.8, sy: 3.6, sz: 4.0, yaw: -0.32 },
  { x: 72.6, y: 1.7, z: 6.4, sx: 3.4, sy: 3.4, sz: 11.2, yaw: 0.05 },
  { x: -71.2, y: 1.65, z: 5.2, sx: 3.2, sy: 3.3, sz: 10.6, yaw: -0.04 },
];

export function isOutsideDistrict(x: number, z: number, clearance = 0): boolean {
  return (
    Math.abs(x) > DISTRICT.halfWidth + clearance ||
    Math.abs(z) > DISTRICT.halfDepth + clearance
  );
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function overlapsDistrict(x: number, z: number, sx: number, sz: number): boolean {
  const pad = Math.max(sx, sz) * 0.55 + 8.5;
  return Math.abs(x) - pad < DISTRICT.halfWidth && Math.abs(z) - pad < DISTRICT.halfDepth;
}

function isBeyondOrbit(x: number, z: number): boolean {
  return Math.hypot(x, z) >= MEGA_MIN_RADIUS;
}

/**
 * Distant dark slabs used only as scenery. Placement is deterministic, irregular,
 * and kept clear of the contribution grid so they cannot read as extra data towers.
 */
export function createMegaSlabs(count: number): MegaSlab[] {
  const rand = mulberry32(0x51c70c17);
  const slabs: MegaSlab[] = LANDMARKS.slice(0, Math.min(count, LANDMARKS.length)).map((slab) => ({
    ...slab,
  }));
  let attempts = 0;

  while (slabs.length < count && attempts < 400) {
    attempts += 1;
    const angle = Math.PI + (rand() - 0.5) * Math.PI * 1.45;
    const radius = 68 + rand() * 26;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * 0.86;
    const kind = rand();
    const yaw = angle + Math.PI * 0.5 + (rand() - 0.5) * 0.45;

    let sx: number;
    let sy: number;
    let sz: number;
    if (kind < 0.34) {
      sx = 10 + rand() * 12;
      sy = 2.2 + rand() * 2.4;
      sz = 1.8 + rand() * 2.4;
    } else if (kind < 0.72) {
      sx = 3.4 + rand() * 4.8;
      sy = 4.6 + rand() * 4.8;
      sz = 2.6 + rand() * 3.6;
    } else {
      sx = 5.6 + rand() * 4.2;
      sy = 3.4 + rand() * 3.2;
      sz = 4.4 + rand() * 3.6;
    }

    if (overlapsDistrict(x, z, sx, sz)) continue;
    if (!isOutsideDistrict(x, z, SCENERY_CLEARANCE)) continue;
    if (!isBeyondOrbit(x, z)) continue;

    const y = sy * 0.42 - 0.04;
    slabs.push({ x, y, z, sx, sy, sz, yaw });

    if (kind > 0.84 && slabs.length < count) {
      const upperSx = sx * (0.4 + rand() * 0.16);
      const upperSz = sz * (0.38 + rand() * 0.16);
      const upperSy = 2.4 + rand() * 2.8;
      const ox = x + (rand() - 0.5) * 1.2;
      const oz = z + (rand() - 0.5) * 1.0;
      if (!overlapsDistrict(ox, oz, upperSx, upperSz) && isBeyondOrbit(ox, oz)) {
        slabs.push({
          x: ox,
          y: sy * 0.72 + upperSy * 0.42,
          z: oz,
          sx: upperSx,
          sy: upperSy,
          sz: upperSz,
          yaw: yaw + (rand() - 0.5) * 0.2,
        });
      }
    }
  }

  return slabs.slice(0, count);
}

export function shaftAnchorsFor(count: number): ShaftAnchor[] {
  const n = Math.max(3, Math.min(5, Math.round(count)));
  return SHAFT_ANCHORS.slice(0, n).map((anchor) => ({ ...anchor }));
}
