import { describe, expect, it } from "vitest";
import { billboards, slots } from "./data";
import { estimateSelectedSlots, estimateSlotReach } from "./reach-estimator";

describe("reach estimator", () => {
  it("calculates deterministic estimated reach for one slot", () => {
    const estimate = estimateSlotReach(slots[0], billboards[0]);
    expect(estimate.impressions).toBe(9751);
    expect(estimate.cost).toBe(10000);
    expect(estimate.cpm).toBeCloseTo(1025.54, 1);
  });

  it("combines selected slots and uses supplied planned costs", () => {
    const result = estimateSelectedSlots([
      { slot: slots[0], billboard: billboards[0], cost: 12000 },
      { slot: slots[1], billboard: billboards[1], cost: 9000 },
    ]);
    expect(result.impressions).toBe(17236);
    expect(result.cost).toBe(21000);
    expect(result.cpm).toBeCloseTo(1218.38, 1);
  });

  it("returns zero reach and no CPM for an invalid duration", () => {
    const estimate = estimateSlotReach(
      { ...slots[0], startTime: "20:00", endTime: "19:00" },
      billboards[0],
    );
    expect(estimate.impressions).toBe(0);
    expect(estimate.cpm).toBeNull();
  });
});
