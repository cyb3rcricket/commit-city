export type QualityProfile = {
  dpr: number;
  antialias: boolean;
  bloom: boolean;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  particles: number;
  distantLights: number;
  reducedMotion: boolean;
  isCompact: boolean;
  lowPower: boolean;
  shafts: number;
  megaCount: number;
  atmosphereMotes: number;
  worldFx: boolean;
  richSky: boolean;
};

export function detectQuality(): QualityProfile {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isCompact = window.matchMedia("(max-width: 720px)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const cores = navigator.hardwareConcurrency ?? 8;
  const lowPower =
    isCompact ||
    (coarse && window.innerWidth < 1100) ||
    (typeof memory === "number" && memory <= 4) ||
    cores <= 4;

  return {
    dpr: Math.min(window.devicePixelRatio || 1, lowPower ? 1.15 : 1.7),
    antialias: !lowPower,
    bloom: !lowPower,
    bloomStrength: lowPower ? 0 : 0.12,
    bloomRadius: 0.26,
    bloomThreshold: 0.88,
    particles: lowPower ? 90 : 260,
    distantLights: lowPower ? 40 : 110,
    reducedMotion,
    isCompact,
    lowPower,
    shafts: lowPower ? 3 : 4,
    megaCount: lowPower ? 8 : 14,
    atmosphereMotes: lowPower ? 28 : 72,
    worldFx: !lowPower && !reducedMotion,
    richSky: !lowPower,
  };
}
