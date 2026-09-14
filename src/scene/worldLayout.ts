/** Contribution district in world XZ. Scenery must stay outside this box. */
export const DISTRICT = {
  halfWidth: 22.6,
  halfDepth: 4.15,
};

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
  { x: 21.8, z: 7.2, height: 13.5, width: 1.8 },
  { x: -21.4, z: 6.6, height: 12.4, width: 1.55 },
  { x: 19.6, z: -8.8, height: 11.2, width: 1.25 },
  { x: -19.2, z: -9.2, height: 10.6, width: 1.15 },
  { x: 6.4, z: 9.8, height: 9.4, width: 1.05 },
];

export const ORBITAL_FRAME = {
  x: 1.0,
  y: 5.2,
  z: -14.8,
  radius: 7.4,
  tube: 0.075,
  rx: 0.18,
  ry: 0.22,
  rz: 0.08,
};

const LANDMARKS: readonly MegaSlab[] = [
  { x: 26.2, y: 3.1, z: 6.4, sx: 3.2, sy: 6.2, sz: 6.4, yaw: -0.2 },
  { x: -26.0, y: 3.0, z: 6.0, sx: 3.0, sy: 6.0, sz: 6.2, yaw: 0.18 },
  { x: 25.4, y: 2.6, z: -8.2, sx: 5.0, sy: 5.2, sz: 3.4, yaw: 0.4 },
  { x: -25.2, y: 2.5, z: -8.4, sx: 4.8, sy: 5.0, sz: 3.2, yaw: -0.36 },
  { x: 27.0, y: 2.2, z: 1.2, sx: 2.6, sy: 4.4, sz: 8.8, yaw: 0.06 },
  { x: -26.8, y: 2.1, z: 1.0, sx: 2.5, sy: 4.2, sz: 8.4, yaw: -0.05 },
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
  const pad = Math.max(sx, sz) * 0.52 + 3.2;
  return Math.abs(x) - pad < DISTRICT.halfWidth && Math.abs(z) - pad < DISTRICT.halfDepth;
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
    const radius = 27 + rand() * 18;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * 0.78;
    const kind = rand();
    const yaw = angle + Math.PI * 0.5 + (rand() - 0.5) * 0.45;

    let sx: number;
    let sy: number;
    let sz: number;
    if (kind < 0.34) {
      sx = 9 + rand() * 11;
      sy = 3.2 + rand() * 3.8;
      sz = 1.6 + rand() * 2.2;
    } else if (kind < 0.72) {
      sx = 3.6 + rand() * 5.5;
      sy = 8 + rand() * 9;
      sz = 2.8 + rand() * 4.2;
    } else {
      sx = 5.5 + rand() * 4;
      sy = 5.5 + rand() * 5;
      sz = 4.2 + rand() * 3.4;
    }

    if (overlapsDistrict(x, z, sx, sz)) continue;
    if (!isOutsideDistrict(x, z, 8)) continue;

    const y = sy * 0.5 - 0.08;
    slabs.push({ x, y, z, sx, sy, sz, yaw });

    if (kind > 0.78 && slabs.length < count) {
      const upperSx = sx * (0.42 + rand() * 0.18);
      const upperSz = sz * (0.4 + rand() * 0.2);
      const upperSy = 4 + rand() * 5;
      const ox = x + (rand() - 0.5) * 1.4;
      const oz = z + (rand() - 0.5) * 1.2;
      if (!overlapsDistrict(ox, oz, upperSx, upperSz)) {
        slabs.push({
          x: ox,
          y: sy + upperSy * 0.5 - 0.12,
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
