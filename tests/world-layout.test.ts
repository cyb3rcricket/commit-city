import { describe, expect, it } from "vitest";
import {
  createMegaSlabs,
  DISTRICT,
  isOutsideDistrict,
  MEGA_MIN_RADIUS,
  SCENERY_CLEARANCE,
  SHAFT_ANCHORS,
  shaftAnchorsFor,
} from "../src/scene/worldLayout";

describe("world scenery layout", () => {
  it("keeps megastructure slabs far outside the contribution district", () => {
    const slabs = createMegaSlabs(20);
    expect(slabs.length).toBe(20);
    for (const slab of slabs) {
      expect(isOutsideDistrict(slab.x, slab.z, SCENERY_CLEARANCE)).toBe(true);
      expect(
        Math.abs(slab.x) > DISTRICT.halfWidth || Math.abs(slab.z) > DISTRICT.halfDepth,
      ).toBe(true);
      expect(Math.hypot(slab.x, slab.z)).toBeGreaterThanOrEqual(MEGA_MIN_RADIUS);
      expect(Math.max(slab.sx, slab.sz)).toBeGreaterThan(2.2);
    }
  });

  it("does not form a contribution-style regular grid", () => {
    const slabs = createMegaSlabs(16);
    const zs = slabs.map((slab) => slab.z).sort((a, b) => a - b);
    const rows = new Set(zs.map((z) => Math.round(z / 0.68)));
    expect(rows.size).toBeGreaterThan(7);

    const xs = slabs.map((slab) => slab.x).sort((a, b) => a - b);
    const span = xs[xs.length - 1] - xs[0];
    expect(span).toBeGreaterThan(80);
    const primary = slabs.slice(0, 10);
    const footprints = primary.map((slab) => slab.sx * slab.sz);
    expect(Math.min(...footprints)).toBeGreaterThan(8);
  });

  it("places light shafts off the contribution lots as distant infrastructure", () => {
    expect(SHAFT_ANCHORS.length).toBeGreaterThanOrEqual(3);
    expect(SHAFT_ANCHORS.length).toBeLessThanOrEqual(5);
    for (const shaft of shaftAnchorsFor(5)) {
      expect(isOutsideDistrict(shaft.x, shaft.z, 8)).toBe(true);
      expect(Math.hypot(shaft.x, shaft.z)).toBeGreaterThan(40);
    }
  });
});
