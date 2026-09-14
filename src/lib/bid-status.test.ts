import { describe, expect, it } from "vitest";
import { getBidStatus } from "./bid-status";
import type { Bid, Slot } from "./data";

const slot: Slot = {
  id: "slot-test",
  billboardId: "bb-hitech",
  date: "2026-09-06",
  startTime: "19:00",
  endTime: "20:00",
  reservePrice: 10000,
  status: "auction_open",
};
const makeBid = (
  id: string,
  advertiserId: string,
  amount: number,
  createdAt: string,
): Bid => ({
  id,
  slotId: slot.id,
  advertiserId,
  amount,
  creativeId: "creative-megamart",
  createdAt,
});

describe("bid status", () => {
  it("marks the highest eligible bid leading and lower eligible bids outbid", () => {
    const bids = [
      makeBid("a", "adv-a", 12000, "2026-01-01T09:00:00Z"),
      makeBid("b", "adv-b", 18000, "2026-01-01T09:01:00Z"),
    ];
    expect(getBidStatus(bids[1], slot, bids)).toBe("Leading");
    expect(getBidStatus(bids[0], slot, bids)).toBe("Outbid");
  });

  it("marks settled winning and losing bids, plus below-reserve bids", () => {
    const winning = makeBid("winner", "adv-a", 18000, "2026-01-01T09:00:00Z");
    const losing = makeBid("loser", "adv-b", 12000, "2026-01-01T09:01:00Z");
    const low = makeBid("low", "adv-c", 9000, "2026-01-01T09:02:00Z");
    const result = {
      status: "sold" as const,
      winnerAdvertiserId: "adv-a",
      winningBid: 18000,
      secondHighestBid: 12000,
      clearingPrice: 12000,
      slotId: slot.id,
      closedAt: "2026-01-01T10:00:00Z",
      creativeId: "creative-megamart",
      platformFee: 360,
      ownerPayout: 11640,
    };
    expect(getBidStatus(winning, slot, [winning, losing, low], result)).toBe(
      "Won",
    );
    expect(getBidStatus(losing, slot, [winning, losing, low], result)).toBe(
      "Lost",
    );
    expect(getBidStatus(low, slot, [winning, losing, low])).toBe("Ineligible");
  });
});
