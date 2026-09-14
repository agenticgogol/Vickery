import { describe, expect, it } from "vitest";
import { getComparableInventoryPrice } from "./comparable-inventory";
import { billboards, slots } from "./data";

describe("comparable inventory pricing", () => {
  it("does not invent a benchmark when comparable inventory is insufficient", () => {
    const result = getComparableInventoryPrice(slots[0], billboards, slots);
    expect(result.sufficient).toBe(false);
    expect(result.label).toBe("Not enough comparable inventory yet.");
  });

  it("calculates a median and variance from deterministic comparable inventory", () => {
    const result = getComparableInventoryPrice(slots[0], billboards, [
      slots[0],
      { ...slots[0], id: "comparable-a", reservePrice: 9000 },
      { ...slots[0], id: "comparable-b", reservePrice: 11000 },
    ]);
    expect(result.sufficient).toBe(true);
    expect(result.medianReserve).toBe(10000);
    expect(result.label).toBe("Priced near comparable inventory");
  });
});
