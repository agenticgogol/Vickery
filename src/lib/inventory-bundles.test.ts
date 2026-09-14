import { describe, expect, it } from "vitest";
import { billboards, slots } from "./data";
import { buildInventoryBundles } from "./inventory-bundles";

describe("inventory bundles", () => {
  it("builds named bundles from eligible live inventory", () => {
    const bundles = buildInventoryBundles(slots, billboards);
    expect(bundles.map((bundle) => bundle.name)).toEqual(
      expect.arrayContaining([
        "HITEC Office Commuters",
        "Premium West Hyderabad",
        "Budget Reach Pack",
        "Tech Corridor",
        "Premium Launch Pack",
      ]),
    );
    expect(
      bundles.every(
        (bundle) =>
          bundle.slots.length > 0 &&
          bundle.estimatedReach > 0 &&
          bundle.baseCost > 0,
      ),
    ).toBe(true);
  });

  it("excludes unavailable inventory and derives membership without slot IDs", () => {
    const bundles = buildInventoryBundles(
      [{ ...slots[0], status: "unavailable" }, slots[1]],
      billboards,
    );
    expect(
      bundles.find((bundle) => bundle.name === "HITEC Office Commuters"),
    ).toBeUndefined();
    expect(
      bundles
        .find((bundle) => bundle.name === "Budget Reach Pack")
        ?.slots.map((slot) => slot.id),
    ).toEqual(["slot-gachibowli-8pm"]);
  });
});
