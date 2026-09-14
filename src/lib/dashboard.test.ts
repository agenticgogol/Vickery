import { describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { closeAuction, createSlot, resetDemo, submitBid } from "./actions";
import { getDashboardMetrics } from "./dashboard";
import { getSlots, getBids, getBillboards, getAuctionResults } from "./db";
import { seedJubileeDemoResult } from "./seed-data";
import { prisma } from "./prisma";

async function loadMetrics() {
  const [slots, bids, billboards, auctionResults] = await Promise.all([
    getSlots(),
    getBids(),
    getBillboards(),
    getAuctionResults(),
  ]);
  return getDashboardMetrics(slots, bids, billboards, auctionResults);
}

describe("getDashboardMetrics", () => {
  it("derives the management metrics from seeded slots and bids", async () => {
    // resetDemo() deliberately excludes the scripted jubilee result (matches "Reset Demo" in the
    // admin UI); this test wants the literal cold-start seed, so re-add it explicitly.
    await resetDemo();
    await seedJubileeDemoResult(prisma);
    const metrics = await loadMetrics();
    expect(metrics).toMatchObject({
      availableSlots: 3,
      auctionsOpen: 1,
      soldSlots: 1,
      unsoldSlots: 1,
      totalBids: 4,
      gmv: 12000,
      platformRevenue: 360,
      ownerPayout: 11640,
      averageClearingPrice: 12000,
      fillRate: 50,
      connectedBillboards: 8,
      productiveBillboards: 1,
      availableScreenHours: 4,
      soldScreenHours: 1,
      effectiveTakeRate: 3,
      averageReservePrice: 8667,
      averageWinningBid: 12500,
    });
    expect(metrics.sellThroughByArea).toContainEqual({
      area: "Jubilee Hills",
      sold: 1,
      settled: 1,
      rate: 100,
    });
    expect(metrics.sellThroughByTimeOfDay).toContainEqual({
      time: "Evening",
      sold: 1,
      settled: 2,
      rate: 50,
    });
  });

  it("updates pilot economics and utilization after a cleared auction", async () => {
    await resetDemo();
    const slot = await createSlot({
      billboardId: "bb-hitech",
      date: "2026-09-08",
      startTime: "19:00",
      endTime: "21:00",
      reservePrice: 10000,
    });
    await submitBid({
      slotId: slot.id,
      advertiserId: "adv-megamart",
      amount: 12000,
      creativeId: "creative-megamart",
    });
    await submitBid({
      slotId: slot.id,
      advertiserId: "adv-quickfood",
      amount: 18000,
      creativeId: "creative-quickfood",
    });
    await submitBid({
      slotId: slot.id,
      advertiserId: "adv-nova",
      amount: 15000,
      creativeId: "creative-nova",
    });
    await closeAuction(slot.id);

    const metrics = await loadMetrics();
    expect(metrics).toMatchObject({
      connectedBillboards: 8,
      productiveBillboards: 2,
      availableScreenHours: 4,
      soldScreenHours: 3,
      fillRate: 66.66666666666666,
      gmv: 15000,
      effectiveTakeRate: 3,
      platformRevenue: 450,
      ownerPayout: 14550,
      averageWinningBid: 18000,
      averageClearingPrice: 15000,
      bidsPerAuction: 2.3,
    });
    expect(metrics.sellThroughByArea).toContainEqual({
      area: "HITEC City",
      sold: 1,
      settled: 1,
      rate: 100,
    });
    expect(metrics.sellThroughByTimeOfDay).toContainEqual({
      time: "Evening",
      sold: 2,
      settled: 3,
      rate: 66.66666666666666,
    });
  });
});
