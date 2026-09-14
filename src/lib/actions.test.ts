import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  acknowledgePlayback,
  closeAuction,
  createBillboard,
  createCreative,
  createSlot,
  createSlots,
  deleteSlot,
  generateSampleBids,
  resetDemo,
  reviewBillboard,
  reviewCreative,
  runCampaignAutoBid,
  saveDraftCampaign,
  setSlotAvailability,
  submitBid,
  updateBillboard,
  updateSettlementStatus,
  updateSlot,
} from "./actions";
import {
  getAuctionResult,
  getAuctionResults,
  getBids,
  getBillboards,
  getCampaigns,
  getMarketplaceSlots,
  getPlaybacks,
  getPlayback,
  getSettlement,
  getSettlements,
  getSlots,
} from "./db";
import { getDashboardMetrics } from "./dashboard";

describe("primary management demo flow", () => {
  // The real Postgres DB persists across test runs (unlike the old in-memory arrays), so start
  // from a known-clean seeded state instead of assuming a cold process.
  beforeAll(async () => {
    await resetDemo();
  });

  it("lists a slot, accepts three bids, closes the auction, and assigns the winner creative", async () => {
    const slot = await createSlot({
      billboardId: "bb-hitech",
      date: "2026-09-08",
      startTime: "19:00",
      endTime: "20:00",
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

    const result = await closeAuction(slot.id);

    expect(result).toMatchObject({
      status: "sold",
      winnerAdvertiserId: "adv-quickfood",
      winningBid: 18000,
      secondHighestBid: 15000,
      clearingPrice: 15000,
      platformFee: 450,
      ownerPayout: 14550,
      creativeId: "creative-quickfood",
    });
    await expect(
      submitBid({
        slotId: slot.id,
        advertiserId: "adv-megamart",
        amount: 20000,
        creativeId: "creative-megamart",
      }),
    ).rejects.toThrow("no longer accepting");
  });

  it("rejects bids for unpublished inventory", async () => {
    const slot = await createSlot({
      billboardId: "bb-gachibowli",
      date: "2026-09-09",
      startTime: "18:00",
      endTime: "19:00",
      reservePrice: 10000,
    });
    await setSlotAvailability(slot.id, false);
    await expect(
      submitBid({
        slotId: slot.id,
        advertiserId: "adv-megamart",
        amount: 12000,
        creativeId: "creative-megamart",
      }),
    ).rejects.toThrow("no longer accepting");
  });

  it("supports generated bids and restores the seeded demo", async () => {
    await resetDemo();
    const slot = await createSlot({
      billboardId: "bb-madhapur",
      date: "2026-09-12",
      startTime: "18:00",
      endTime: "19:00",
      reservePrice: 6500,
      minimumBidIncrement: 500,
    });
    const generated = await generateSampleBids(slot.id);
    expect(generated).toHaveLength(3);
    expect(generated.every((bid) => bid.amount >= slot.reservePrice)).toBe(
      true,
    );
    await resetDemo();
    expect(await getSlots()).toHaveLength(6);
    expect(await getBids()).toHaveLength(4);
  });

  it("supports repeated slots, edits, unpublishing, and protects sold inventory", async () => {
    await resetDemo();
    const repeated = await createSlots(
      [1, 2, 3].map((offset) => ({
        billboardId: "bb-hitech",
        date: `2026-09-${12 + offset}`,
        startTime: "10:00",
        endTime: "11:00",
        reservePrice: 5000,
      })),
    );
    expect(repeated).toHaveLength(3);
    await expect(
      createSlot({
        billboardId: "bb-hitech",
        date: "2026-09-13",
        startTime: "10:30",
        endTime: "11:30",
        reservePrice: 5000,
      }),
    ).rejects.toThrow("Overlapping");
    const edited = await updateSlot({
      slotId: repeated[0].id,
      billboardId: "bb-hitech",
      date: "2026-09-13",
      startTime: "12:00",
      endTime: "13:00",
      reservePrice: 7000,
    });
    expect(edited.reservePrice).toBe(7000);
    const unpublished = await setSlotAvailability(repeated[1].id, false);
    expect(unpublished.status).toBe("unavailable");
    await setSlotAvailability(repeated[1].id, true);
    await deleteSlot(repeated[2].id);
    expect((await getSlots()).some((slot) => slot.id === repeated[2].id)).toBe(false);
    const sold = await createSlot({
      billboardId: "bb-hitech",
      date: "2026-09-20",
      startTime: "10:00",
      endTime: "11:00",
      reservePrice: 5000,
    });
    await submitBid({
      slotId: sold.id,
      advertiserId: "adv-megamart",
      amount: 6000,
      creativeId: "creative-megamart",
    });
    await closeAuction(sold.id);
    await expect(
      updateSlot({
        slotId: sold.id,
        billboardId: "bb-hitech",
        date: sold.date,
        startTime: sold.startTime,
        endTime: sold.endTime,
        reservePrice: 9000,
      }),
    ).rejects.toThrow("Sold slots");
    await expect(deleteSlot(sold.id)).rejects.toThrow("Sold slots");
  });

  it("propagates publish, bid, close, and economics state across role views", async () => {
    await resetDemo();
    const slot = await createSlot({
      billboardId: "bb-hitech",
      date: "2026-10-01",
      startTime: "19:00",
      endTime: "20:00",
      reservePrice: 10000,
    });
    expect((await getMarketplaceSlots()).some((item) => item.id === slot.id)).toBe(
      true,
    );

    await setSlotAvailability(slot.id, false);
    expect((await getMarketplaceSlots()).some((item) => item.id === slot.id)).toBe(
      false,
    );
    await setSlotAvailability(slot.id, true);
    expect((await getMarketplaceSlots()).some((item) => item.id === slot.id)).toBe(
      true,
    );

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
    expect((await getSlots()).find((item) => item.id === slot.id)?.status).toBe(
      "auction_open",
    );
    expect((await getBids()).filter((bid) => bid.slotId === slot.id)).toHaveLength(3);

    await closeAuction(slot.id);
    expect((await getSlots()).find((item) => item.id === slot.id)?.status).toBe("sold");
    expect(await getAuctionResult(slot.id)).toMatchObject({
      winnerAdvertiserId: "adv-quickfood",
      clearingPrice: 15000,
      platformFee: 450,
      ownerPayout: 14550,
    });
    const [dashSlots, dashBids, dashBillboards, dashResults] = await Promise.all([
      getSlots(),
      getBids(),
      getBillboards(),
      getAuctionResults(),
    ]);
    expect(getDashboardMetrics(dashSlots, dashBids, dashBillboards, dashResults)).toMatchObject({
      gmv: 15000,
      platformRevenue: 450,
      ownerPayout: 14550,
    });
  });

  it("blocks bids before auction open and makes concurrent closes idempotent", async () => {
    await resetDemo();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T08:00:00.000Z"));
    try {
      const slot = await createSlot({
        billboardId: "bb-hitech",
        date: "2026-10-01",
        startTime: "19:00",
        endTime: "20:00",
        reservePrice: 10000,
        auctionOpenTime: "2026-10-01T09:00:00.000Z",
        auctionCloseTime: "2026-10-01T18:00:00.000Z",
      });
      await expect(
        submitBid({
          slotId: slot.id,
          advertiserId: "adv-megamart",
          amount: 12000,
          creativeId: "creative-megamart",
        }),
      ).rejects.toThrow("not open yet");
      vi.setSystemTime(new Date("2026-10-01T10:00:00.000Z"));
      await submitBid({
        slotId: slot.id,
        advertiserId: "adv-megamart",
        amount: 12000,
        creativeId: "creative-megamart",
      });
      const results = await Promise.all([
        closeAuction(slot.id),
        closeAuction(slot.id),
      ]);
      expect(results[0]).toEqual(results[1]);
      expect(
        (await getAuctionResults()).filter((result) => result.slotId === slot.id),
      ).toHaveLength(1);
      expect(
        (await getSettlements()).filter((settlement) => settlement.slotId === slot.id),
      ).toHaveLength(1);
      await expect(
        submitBid({
          slotId: slot.id,
          advertiserId: "adv-quickfood",
          amount: 15000,
          creativeId: "creative-quickfood",
        }),
      ).rejects.toThrow("no longer accepting");
    } finally {
      vi.useRealTimers();
    }
  });

  it("creates, edits, deactivates, and validates billboard onboarding", async () => {
    await resetDemo();
    const input = {
      name: "Test Junction Screen",
      city: "Hyderabad",
      area: "Kondapur",
      location: "Botanical Garden Gate",
      latitude: 17.4697,
      longitude: 78.3657,
      screenType: "Digital LED",
      dimensions: "24 × 12 ft",
      estimatedDailyTraffic: 88000,
      audienceProfile: "IT employees · residents",
      qualityTier: "Premium" as const,
      defaultReservePrice: 9000,
      active: true,
    };
    const billboard = await createBillboard(input);
    expect(billboard.ownerId).toBe("test");
    expect(billboard.location).toBe("Botanical Garden Gate");
    await updateBillboard(billboard.id, {
      ...input,
      name: "Updated Junction Screen",
    });
    expect((await getBillboards()).find((item) => item.id === billboard.id)?.name).toBe(
      "Updated Junction Screen",
    );
    expect(
      (await getBillboards()).find((item) => item.id === billboard.id)?.verificationStatus,
    ).toBe("pending");
    const unverifiedSlot = await createSlot({
      billboardId: billboard.id,
      date: "2026-11-01",
      startTime: "09:00",
      endTime: "09:30",
      reservePrice: 9000,
    });
    expect(
      (await getMarketplaceSlots()).some((item) => item.id === unverifiedSlot.id),
    ).toBe(false);
    await reviewBillboard(billboard.id, "verified");
    const slot = await createSlot({
      billboardId: billboard.id,
      date: "2026-11-01",
      startTime: "10:00",
      endTime: "11:00",
      reservePrice: 9000,
    });
    expect((await getMarketplaceSlots()).some((item) => item.id === slot.id)).toBe(
      true,
    );
    await updateBillboard(billboard.id, {
      ...input,
      name: "Updated Junction Screen",
      active: false,
    });
    expect((await getMarketplaceSlots()).some((item) => item.id === slot.id)).toBe(
      false,
    );
    await expect(createBillboard({ ...input, latitude: 100 })).rejects.toThrow(
      "valid latitude",
    );
  });

  it("rejects slots shorter than the minimum duration", async () => {
    await resetDemo();
    await expect(
      createSlot({
        billboardId: "bb-hitech",
        date: "2026-11-01",
        startTime: "10:00",
        endTime: "10:03",
        reservePrice: 9000,
      }),
    ).rejects.toThrow("at least");
  });

  it("keeps new creatives pending until admin approval", async () => {
    await resetDemo();
    const creative = await createCreative({
      advertiserId: "adv-megamart",
      name: "Monsoon launch",
      imageUrl: "data:image/png;base64,demo",
      mimeType: "image/png",
      fileSizeBytes: 1200,
      width: 1280,
      height: 640,
      status: "draft",
    });
    expect(creative.status).toBe("draft");
    const slot = await createSlot({
      billboardId: "bb-hitech",
      date: "2026-12-01",
      startTime: "10:00",
      endTime: "11:00",
      reservePrice: 5000,
    });
    await expect(
      submitBid({
        slotId: slot.id,
        advertiserId: "adv-megamart",
        amount: 6000,
        creativeId: creative.id,
      }),
    ).rejects.toThrow("approved creative");
    await expect(reviewCreative(creative.id, "rejected")).rejects.toThrow(
      "rejection reason",
    );
    await reviewCreative(creative.id, "approved");
    await expect(
      submitBid({
        slotId: slot.id,
        advertiserId: "adv-megamart",
        amount: 6000,
        creativeId: creative.id,
      }),
    ).resolves.toMatchObject({ creativeId: creative.id });
  });

  it("saves a campaign brief as a draft without placing bids", async () => {
    await resetDemo();
    const campaign = await saveDraftCampaign({
      advertiserId: "adv-megamart",
      name: "Hyderabad festive launch",
      totalBudget: 50000,
      startDate: "2026-09-06",
      endDate: "2026-09-13",
      preferredAreas: ["HITEC City"],
      preferredTimeWindows: ["Evening"],
      audienceTags: ["Tech professionals"],
      qualityTier: "Premium",
      creativeId: "creative-megamart",
      selectedSlotIds: ["slot-cyber-7pm"],
    });
    expect(campaign.status).toBe("draft");
    expect(await getCampaigns()).toContainEqual(
      expect.objectContaining({ id: campaign.id, status: "draft" }),
    );
    expect(
      (await getBids()).filter((bid) => bid.slotId === "slot-cyber-7pm"),
    ).toHaveLength(3);
  });

  it("places one-time capped automatic bids on matching open inventory", async () => {
    await resetDemo();
    const slot = await createSlot({
      billboardId: "bb-hitech",
      date: "2026-12-10",
      startTime: "19:00",
      endTime: "20:00",
      reservePrice: 10000,
      minimumBidIncrement: 500,
    });
    const result = await runCampaignAutoBid({
      advertiserId: "adv-megamart",
      name: "Tech launch",
      totalBudget: 12000,
      maxBidPerSlot: 12000,
      startDate: "2026-12-10",
      endDate: "2026-12-10",
      preferredAreas: ["HITEC City"],
      preferredTimeWindows: ["Evening"],
      audienceTags: ["Tech professionals"],
      qualityTier: "Premium",
      creativeId: "creative-megamart",
      selectedSlotIds: [],
      buyingMode: "auto",
    });

    expect(result.campaign.status).toBe("active");
    expect(result.placed).toHaveLength(1);
    expect(result.placed[0]).toMatchObject({ slotId: slot.id, amount: 10000 });
    expect((await getBids()).filter((bid) => bid.slotId === slot.id)).toHaveLength(1);
  });

  it("creates and acknowledges proof of play for a sold slot", async () => {
    await resetDemo();
    const slot = await createSlot({
      billboardId: "bb-hitech",
      date: "2026-12-02",
      startTime: "19:00",
      endTime: "20:00",
      reservePrice: 10000,
    });
    await submitBid({
      slotId: slot.id,
      advertiserId: "adv-megamart",
      amount: 12000,
      creativeId: "creative-megamart",
    });
    await closeAuction(slot.id);
    expect(await getSettlement(slot.id)).toMatchObject({
      clearingPrice: 10000,
      advertiserAmountDue: 10000,
      ownerAmountPayable: 9700,
      status: "pending",
    });
    await updateSettlementStatus(slot.id, "advertiser_paid");
    await updateSettlementStatus(slot.id, "owner_payable");
    await updateSettlementStatus(slot.id, "owner_paid");
    expect((await getSettlement(slot.id))?.status).toBe("owner_paid");
    expect(await getPlayback(slot.id)).toMatchObject({
      status: "scheduled",
      plannedStartAt: "2026-12-02T19:00:00+05:30",
      plannedEndAt: "2026-12-02T20:00:00+05:30",
    });
    await acknowledgePlayback(slot.id, "playing");
    expect((await getPlayback(slot.id))?.status).toBe("playing");
    await expect(acknowledgePlayback(slot.id, "failed")).rejects.toThrow(
      "failure reason",
    );
    await acknowledgePlayback(slot.id, "completed");
    expect(await getPlayback(slot.id)).toMatchObject({ status: "completed" });
    expect(await getPlaybacks()).toHaveLength(1);
  });
});
