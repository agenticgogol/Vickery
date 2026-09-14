import { describe, expect, it } from "vitest";
import { billboards, slots, type Bid, type Slot } from "./data";
import { buildCampaignAutoBidPlan, getMatchingSlots } from "./campaign";

describe("campaign inventory matching", () => {
  it("matches deterministic campaign preferences and budget", () => {
    const matches = getMatchingSlots(
      {
        totalBudget: 10000,
        startDate: "2026-09-06",
        endDate: "2026-09-07",
        preferredAreas: ["HITEC City"],
        preferredTimeWindows: ["Evening"],
        audienceTags: ["Tech professionals"],
        qualityTier: "Premium",
      },
      slots,
      billboards,
    );
    expect(matches.map((slot) => slot.id)).toEqual(["slot-cyber-7pm"]);
  });

  it("creates a ranked, capped one-time auto-bid plan", () => {
    const openSlots: Slot[] = [
      {
        ...slots[0],
        id: "best",
        status: "available",
        auctionOpenTime: undefined,
        auctionCloseTime: undefined,
        reservePrice: 10000,
        minimumBidIncrement: 500,
      },
      {
        ...slots[1],
        id: "second",
        status: "available",
        reservePrice: 8000,
        minimumBidIncrement: 500,
      },
      {
        ...slots[2],
        id: "over-cap",
        status: "available",
        reservePrice: 9000,
        minimumBidIncrement: 500,
      },
    ];
    const existingBids: Bid[] = [
      {
        id: "existing",
        slotId: "best",
        advertiserId: "adv-quickfood",
        amount: 12000,
        creativeId: "creative-quickfood",
        createdAt: "2026-09-05T10:00:00Z",
      },
    ];
    const plan = buildCampaignAutoBidPlan(
      {
        totalBudget: 20000,
        maxBidPerSlot: 12500,
        startDate: "2026-09-06",
        endDate: "2026-09-07",
        preferredAreas: ["HITEC City", "Gachibowli", "Financial District"],
        preferredTimeWindows: ["Evening"],
        audienceTags: ["Tech professionals"],
        qualityTier: "Premium",
      },
      openSlots,
      billboards,
      existingBids,
      new Date("2026-09-05T12:00:00Z"),
    );

    expect(plan).toEqual([
      {
        slotId: "best",
        amount: 12500,
        score: expect.any(Number),
        date: "2026-09-06",
        startTime: "19:00",
      },
    ]);
  });
});
