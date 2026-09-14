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
  { x: 36.8, z: 15.4, height: 12.0, width: 1.65 },
  { x: -35.6, z: 14.2, height: 11.0, width: 1.45 },
  { x: 34.2, z: -17.6, height: 10.2, width: 1.25 },
  { x: -33.0, z: -18.2, height: 9.6, width: 1.15 },
  { x: 11.6, z: 34.8, height: 8.8, width: 1.05 },
];

export const ORBITAL_FRAME = {
  x: 1.0,
  y: 5.55,
  z: -16.2,
  radius: 8.0,
  tube: 0.07,
  rx: 0.2,
  ry: 0.18,
  rz: 0.06,
};

const LANDMARKS: readonly MegaSlab[] = [
  { x: 62.4, y: 2.55, z: 28.6, sx: 5.6, sy: 5.1, sz: 10.4, yaw: -0.18 },
  { x: -63.8, y: 2.45, z: 27.2, sx: 5.4, sy: 4.9, sz: 10.0, yaw: 0.16 },
  { x: 59.6, y: 2.2, z: -36.8, sx: 9.2, sy: 4.4, sz: 5.2, yaw: 0.36 },
  { x: -58.4, y: 2.15, z: -38.4, sx: 8.8, sy: 4.3, sz: 5.0, yaw: -0.32 },
  { x: 70.2, y: 2.05, z: 6.0, sx: 4.2, sy: 4.1, sz: 14.0, yaw: 0.05 },
  { x: -68.8, y: 2.0, z: 5.0, sx: 4.0, sy: 4.0, sz: 13.4, yaw: -0.04 },
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
    const radius = 64 + rand() * 24;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * 0.86;
    const kind = rand();
    const yaw = angle + Math.PI * 0.5 + (rand() - 0.5) * 0.45;

    let sx: number;
    let sy: number;
    let sz: number;
    if (kind < 0.34) {
      sx = 12 + rand() * 14;
      sy = 2.6 + rand() * 2.8;
      sz = 2.2 + rand() * 2.8;
    } else if (kind < 0.72) {
      sx = 4.2 + rand() * 5.6;
      sy = 5.4 + rand() * 5.2;
      sz = 3.2 + rand() * 4.2;
    } else {
      sx = 6.4 + rand() * 5.0;
      sy = 4.0 + rand() * 3.6;
      sz = 5.2 + rand() * 4.2;
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
