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
  { x: -19.8, z: -13.2, height: 23, width: 1.5 },
  { x: 23.6, z: -14.8, height: 20, width: 1.2 },
  { x: 6.1, z: 12.1, height: 18, width: 1.05 },
  { x: -30.2, z: 7.4, height: 22, width: 1.3 },
  { x: 31.4, z: -6.2, height: 16.5, width: 0.95 },
];

export const ORBITAL_FRAME = {
  x: 7.5,
  y: 16.2,
  z: -50,
  radius: 17.2,
  tube: 0.04,
  rx: 0.74,
  ry: 0.16,
  rz: 0.36,
};

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
  const slabs: MegaSlab[] = [];
  let attempts = 0;

  while (slabs.length < count && attempts < 400) {
    attempts += 1;
    const angle = rand() * Math.PI * 2;
    const radius = 36 + rand() * 30;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * 0.7;
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
