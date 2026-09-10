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
    bloomStrength: lowPower ? 0 : 0.14,
    bloomRadius: 0.28,
    bloomThreshold: 0.86,
    particles: lowPower ? 110 : 340,
    distantLights: lowPower ? 80 : 220,
    reducedMotion,
    isCompact,
  };
}
