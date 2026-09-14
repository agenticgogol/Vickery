import { describe, expect, it } from "vitest";
import { billboards, bids, slots } from "./data";
import { getOwnerInventoryRecommendations } from "./owner-inventory-recommendations";

describe("owner inventory recommendations", () => {
  it("suggests only unused owner periods with deterministic demand and price ranges", () => {
    const results = getOwnerInventoryRecommendations({
      ownerId: "user-owner",
      billboards,
      slots,
      bids,
      results: [],
    });
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every((item) => item.priceRange.upper >= item.priceRange.lower),
    ).toBe(true);
    expect(
      results.every(
        (item) =>
          item.expectedDemand === "Low" ||
          item.expectedDemand === "Moderate" ||
          item.expectedDemand === "High",
      ),
    ).toBe(true);
    expect(
      results.every(
        (item) =>
          !slots.some(
            (slot) =>
              slot.billboardId === item.billboardId &&
              slot.date === item.date &&
              slot.startTime === item.startTime,
          ),
      ),
    ).toBe(true);
  });
});
