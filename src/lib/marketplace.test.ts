import { describe, expect, it } from "vitest";
import { billboards, bids, slots } from "./data";
import {
  getBillboardContextTags,
  getInventoryContextTags,
  getSlotTags,
  getTimeOfDay,
  isWithinRadius,
  isWithinViewport,
  sortMarketplaceSlots,
} from "./marketplace";

describe("marketplace discovery rules", () => {
  it("assigns deterministic tags from bids, quality, and auction timing", () => {
    const primary = slots.find((slot) => slot.id === "slot-cyber-7pm")!;
    expect(
      getSlotTags(
        primary,
        billboards[0],
        bids.filter((bid) => bid.slotId === primary.id),
      ),
    ).toEqual(["Just Now", "Ending Soon", "Popular", "Premium"]);
    const noBid = slots.find((slot) => slot.id === "slot-madhapur-9pm")!;
    expect(getSlotTags(noBid, billboards[3], [])).toEqual([
      "New",
      "No Bids Yet",
    ]);
  });

  it("groups times and sorts by reserve and traffic", () => {
    expect(getTimeOfDay("19:00")).toBe("Evening");
    expect(
      sortMarketplaceSlots(slots.slice(0, 4), billboards, bids, "reserve").map(
        (slot) => slot.id,
      ),
    ).toEqual([
      "slot-madhapur-9pm",
      "slot-gachibowli-8pm",
      "slot-financial-6pm",
      "slot-cyber-7pm",
    ]);
    expect(
      sortMarketplaceSlots(slots.slice(0, 4), billboards, bids, "traffic")[0]
        .id,
    ).toBe("slot-cyber-7pm");
  });

  it("filters coordinates deterministically by radius and viewport", () => {
    const hitech = billboards.find(
      (billboard) => billboard.id === "bb-hitech",
    )!;
    const gachibowli = billboards.find(
      (billboard) => billboard.id === "bb-gachibowli",
    )!;
    const center = {
      latitude: hitech.latitude,
      longitude: hitech.longitude,
      label: hitech.area,
    };
    expect(isWithinRadius(hitech, center, 1)).toBe(true);
    expect(isWithinRadius(gachibowli, center, 1)).toBe(false);
    expect(
      isWithinViewport(hitech, {
        north: 17.46,
        south: 17.43,
        east: 78.39,
        west: 78.36,
      }),
    ).toBe(true);
    expect(
      isWithinViewport(gachibowli, {
        north: 17.43,
        south: 17.4,
        east: 78.36,
        west: 78.33,
      }),
    ).toBe(false);
  });

  it("maps billboard metadata to stable context tags", () => {
    const hitech = billboards.find(
      (billboard) => billboard.id === "bb-hitech",
    )!;
    expect(getBillboardContextTags(hitech)).toEqual([
      "Tech Hub",
      "Office Commuters",
      "Premium",
      "Retail",
      "High Traffic",
    ]);
    expect(
      getInventoryContextTags(
        slots.find((slot) => slot.id === "slot-cyber-7pm")!,
        hitech,
      ),
    ).toContain("Evening Heavy");
  });
});
