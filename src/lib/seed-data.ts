import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import {
  users,
  billboards,
  advertisers,
  creatives,
  slots,
  bids,
  platformFeeRate,
} from "./data";
import { runAuction } from "./auction";

export const DEMO_PASSWORD = "demo1234";

/** Idempotent: upserts the full seed dataset. Shared by prisma/seed.ts and db.ts's resetSeededData(). */
export async function seedAll(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await Promise.all(
    users.map((user) =>
      prisma.user.upsert({
        where: { id: user.id },
        update: { name: user.name, role: user.role, passwordHash },
        create: { id: user.id, name: user.name, role: user.role, passwordHash },
      }),
    ),
  );

  await Promise.all(
    billboards.map((billboard) =>
      prisma.billboard.upsert({
        where: { id: billboard.id },
        update: { ...billboard, active: billboard.active ?? true, verificationStatus: billboard.verificationStatus ?? "verified" },
        create: { ...billboard, active: billboard.active ?? true, verificationStatus: billboard.verificationStatus ?? "verified" },
      }),
    ),
  );

  await Promise.all(
    advertisers.map((advertiser) =>
      prisma.advertiser.upsert({ where: { id: advertiser.id }, update: advertiser, create: advertiser }),
    ),
  );

  await Promise.all(
    creatives.map((creative) =>
      prisma.creative.upsert({
        where: { id: creative.id },
        update: { ...creative, status: creative.status ?? "approved" },
        create: { ...creative, status: creative.status ?? "approved" },
      }),
    ),
  );

  // Slots depend on billboards existing; bids depend on slots existing.
  await Promise.all(
    slots.map((slot) =>
      prisma.slot.upsert({
        where: { id: slot.id },
        update: { ...slot, published: slot.published ?? true, ownerUse: slot.ownerUse ?? false },
        create: { ...slot, published: slot.published ?? true, ownerUse: slot.ownerUse ?? false },
      }),
    ),
  );

  await Promise.all(bids.map((bid) => prisma.bid.upsert({ where: { id: bid.id }, update: bid, create: bid })));
}

/**
 * Scripted demo result: slot-jubilee-sold ships "sold" with a pending-review creative, so the
 * review queue has a real "needs creative review" example on cold start. Deliberately NOT part
 * of seedAll() / resetSeededData() — "Reset Demo" in the admin UI returns to a clean slate
 * without this extra synthetic result, matching the pre-migration in-memory behavior.
 */
export async function seedJubileeDemoResult(prisma: PrismaClient) {
  const jubileeSlotId = "slot-jubilee-sold";
  const jubileeBid = bids.find((bid) => bid.slotId === jubileeSlotId);
  const jubileeSlot = slots.find((slot) => slot.id === jubileeSlotId);
  if (jubileeBid && jubileeSlot) {
    const outcome = runAuction(jubileeSlot.reservePrice, [jubileeBid]);
    const platformFee = outcome.clearingPrice
      ? Math.round(outcome.clearingPrice * platformFeeRate)
      : 0;
    await prisma.auctionResult.upsert({
      where: { slotId: jubileeSlotId },
      update: {},
      create: {
        id: `auction-${jubileeSlotId}`,
        slotId: jubileeSlotId,
        status: outcome.status,
        winnerAdvertiserId: outcome.winnerAdvertiserId,
        winningBid: outcome.winningBid,
        secondHighestBid: outcome.secondHighestBid,
        clearingPrice: outcome.clearingPrice,
        closedAt: "2026-09-05T20:05:00+05:30",
        creativeId: jubileeBid.creativeId,
        platformFee,
        ownerPayout: (outcome.clearingPrice ?? 0) - platformFee,
        creativeApprovalPending: true,
      },
    });
  }
}
