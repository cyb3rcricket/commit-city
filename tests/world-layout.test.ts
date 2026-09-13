import { describe, expect, it } from "vitest";
import {
  createMegaSlabs,
  DISTRICT,
  isOutsideDistrict,
  SHAFT_ANCHORS,
  shaftAnchorsFor,
} from "../src/scene/worldLayout";

describe("world scenery layout", () => {
  it("keeps megastructure slabs outside the contribution district", () => {
    const slabs = createMegaSlabs(20);
    expect(slabs.length).toBe(20);
    for (const slab of slabs) {
      expect(isOutsideDistrict(slab.x, slab.z, 8)).toBe(true);
      expect(
        Math.abs(slab.x) > DISTRICT.halfWidth || Math.abs(slab.z) > DISTRICT.halfDepth,
      ).toBe(true);
      expect(Math.max(slab.sx, slab.sz)).toBeGreaterThan(2.4);
    }
  });

  it("does not form a contribution-style regular grid", () => {
    const slabs = createMegaSlabs(16);
    const zs = slabs.map((slab) => slab.z).sort((a, b) => a - b);
    const rows = new Set(zs.map((z) => Math.round(z / 0.68)));
    expect(rows.size).toBeGreaterThan(7);

    const xs = slabs.map((slab) => slab.x).sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < xs.length; i += 1) {
      gaps.push(xs[i] - xs[i - 1]);
    }
    const nearLotSpacing = gaps.filter((gap) => Math.abs(gap - 0.78) < 0.12).length;
    expect(nearLotSpacing).toBeLessThan(3);
  });

  it("places light shafts off the contribution lots", () => {
    expect(SHAFT_ANCHORS.length).toBeGreaterThanOrEqual(3);
    expect(SHAFT_ANCHORS.length).toBeLessThanOrEqual(5);
    for (const shaft of shaftAnchorsFor(5)) {
      expect(isOutsideDistrict(shaft.x, shaft.z, 6)).toBe(true);
    }
  });
});
