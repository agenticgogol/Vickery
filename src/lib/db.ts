import { prisma } from "./prisma";
import { seedAll } from "./seed-data";
import { platformFeeRate, type Billboard, type Slot, type Bid, type Creative, type Campaign, type ScheduledPlayback, type Settlement } from "./data";
import { runAuction, type AuctionOutcome } from "./auction";
import { selectAdapter } from "./delivery/adapter";

// V0 repository boundary: Postgres via Prisma. Every function here is async.
export type StoredAuctionResult = AuctionOutcome & { slotId: string; closedAt: string; creativeId: string | null; platformFee: number; ownerPayout: number; creativeApprovalPending?: boolean };

function toBillboard(row: { active: boolean; qualityTier: string }): Billboard {
  return { ...row, qualityTier: row.qualityTier as Billboard["qualityTier"] } as Billboard;
}
function toSlot(row: { status: string }): Slot {
  return { ...row } as unknown as Slot;
}
function toCreative(row: { status: string }): Creative {
  return { ...row } as unknown as Creative;
}
function toResult(row: {
  slotId: string; status: string; winnerAdvertiserId: string | null; winningBid: number | null;
  secondHighestBid: number | null; clearingPrice: number | null; closedAt: string; creativeId: string | null;
  platformFee: number; ownerPayout: number; creativeApprovalPending: boolean;
}): StoredAuctionResult {
  return {
    status: row.status as AuctionOutcome["status"],
    winnerAdvertiserId: row.winnerAdvertiserId,
    winningBid: row.winningBid,
    secondHighestBid: row.secondHighestBid,
    clearingPrice: row.clearingPrice,
    slotId: row.slotId,
    closedAt: row.closedAt,
    creativeId: row.creativeId,
    platformFee: row.platformFee,
    ownerPayout: row.ownerPayout,
    creativeApprovalPending: row.creativeApprovalPending,
  };
}

export async function getBillboards() {
  return (await prisma.billboard.findMany()).map(toBillboard);
}
export async function getBillboard(id: string) {
  const row = await prisma.billboard.findUnique({ where: { id } });
  return row ? toBillboard(row) : undefined;
}
export async function getSlots() {
  return (await prisma.slot.findMany()).map(toSlot);
}
export async function getSlot(id: string) {
  const row = await prisma.slot.findUnique({ where: { id } });
  return row ? toSlot(row) : undefined;
}
export async function getBids() {
  return (await prisma.bid.findMany()) as unknown as Bid[];
}
export async function getBidsForSlot(slotId: string) {
  return (await prisma.bid.findMany({ where: { slotId } })) as unknown as Bid[];
}
export async function getCreatives() {
  return (await prisma.creative.findMany()).map(toCreative);
}
export async function getCreative(id: string) {
  const row = await prisma.creative.findUnique({ where: { id } });
  return row ? toCreative(row) : undefined;
}
export async function getCampaigns(): Promise<Campaign[]> {
  return (await prisma.campaign.findMany()) as unknown as Campaign[];
}
export async function getCampaign(id: string) {
  const row = await prisma.campaign.findUnique({ where: { id } });
  return row ? (row as unknown as Campaign) : undefined;
}
export async function getPlaybacks(): Promise<ScheduledPlayback[]> {
  return (await prisma.scheduledPlayback.findMany()) as unknown as ScheduledPlayback[];
}
export async function getSettlements(): Promise<Settlement[]> {
  return (await prisma.settlement.findMany()) as unknown as Settlement[];
}
export async function getAuctionResults(): Promise<StoredAuctionResult[]> {
  return (await prisma.auctionResult.findMany()).map(toResult);
}

export async function getMarketplaceSlots() {
  const [slots, billboards] = await Promise.all([getSlots(), getBillboards()]);
  return slots.filter(
    (slot) =>
      slot.published !== false &&
      (slot.status === "available" || slot.status === "auction_open") &&
      billboards.some(
        (billboard) =>
          billboard.id === slot.billboardId &&
          billboard.active !== false &&
          billboard.verificationStatus === "verified",
      ),
  );
}
export async function getOwnerBillboards(ownerId = "user-owner") {
  return (await prisma.billboard.findMany({ where: { ownerId } })).map(toBillboard);
}
export async function getAuctionResult(slotId: string) {
  const row = await prisma.auctionResult.findUnique({ where: { slotId } });
  return row ? toResult(row) : undefined;
}
export async function getPlayback(slotId: string) {
  return (await prisma.scheduledPlayback.findFirst({ where: { slotId } })) as unknown as ScheduledPlayback | null;
}
export async function getSettlement(slotId: string) {
  return (await prisma.settlement.findFirst({ where: { slotId } })) as unknown as Settlement | null;
}

export async function resetSeededData() {
  // Slot and Bid cascade from Billboard; the rest have no FK relations to order around.
  await prisma.settlement.deleteMany();
  await prisma.scheduledPlayback.deleteMany();
  await prisma.auctionResult.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.creative.deleteMany();
  await prisma.billboard.deleteMany();
  await seedAll(prisma);
}

// Runs the selected delivery adapter for a freshly created playback and stores the result.
// Best-effort: a delivery failure never blocks the auction/settlement transaction that created it.
async function deliverScheduledPlayback(slotId: string, billboard: Billboard, creativeId: string) {
  const playback = await getPlayback(slotId);
  const creative = await getCreative(creativeId);
  if (!playback || !creative) return;
  const result = await selectAdapter(billboard).deliver(billboard, playback, creative);
  await prisma.scheduledPlayback.update({
    where: { id: playback.id },
    data: { deliveryStatus: result.status, deliveryDetail: result.detail },
  });
}

// Single authoritative path for finalizing an auction. Manual close buttons (owner/admin)
// and the background clock below both call this — it is idempotent (existing result short-circuits).
export async function closeAuctionNow(slotId: string): Promise<StoredAuctionResult> {
  const existing = await getAuctionResult(slotId);
  if (existing) return existing;
  const slot = await getSlot(slotId);
  if (!slot) throw new Error("Slot not found.");
  if (slot.status !== "auction_open")
    throw new Error(`Slot ${slotId} is not open for auction (status: ${slot.status}).`);
  const slotBids = await getBidsForSlot(slotId);
  const outcome = runAuction(slot.reservePrice, slotBids);
  const winnerBid = outcome.winnerAdvertiserId
    ? slotBids.find((bid) => bid.advertiserId === outcome.winnerAdvertiserId && bid.amount === outcome.winningBid)
    : undefined;
  const winnerCreative = winnerBid ? await getCreative(winnerBid.creativeId) : undefined;
  const creativeApproved = (winnerCreative?.status ?? "approved") === "approved";
  const platformFee = outcome.clearingPrice ? Math.round(outcome.clearingPrice * platformFeeRate) : 0;
  const closedAt = new Date().toISOString();
  const result: StoredAuctionResult = {
    ...outcome,
    slotId,
    closedAt,
    creativeId: winnerBid?.creativeId ?? null,
    platformFee,
    ownerPayout: (outcome.clearingPrice ?? 0) - platformFee,
    creativeApprovalPending: outcome.status === "sold" && !creativeApproved,
  };

  try {
    await prisma.$transaction(async (tx) => {
    await tx.auctionResult.create({
      data: {
        id: `auction-${slotId}`,
        slotId,
        status: result.status,
        winnerAdvertiserId: result.winnerAdvertiserId,
        winningBid: result.winningBid,
        secondHighestBid: result.secondHighestBid,
        clearingPrice: result.clearingPrice,
        closedAt: result.closedAt,
        creativeId: result.creativeId,
        platformFee: result.platformFee,
        ownerPayout: result.ownerPayout,
        creativeApprovalPending: result.creativeApprovalPending ?? false,
      },
    });
    await tx.slot.update({ where: { id: slotId }, data: { status: outcome.status, auctionCloseTime: closedAt } });
    if (outcome.status === "sold" && result.creativeId && result.winnerAdvertiserId && creativeApproved) {
      await tx.scheduledPlayback.create({
        data: {
          id: `playback-${slotId}`,
          slotId,
          creativeId: result.creativeId,
          advertiserId: result.winnerAdvertiserId,
          status: "scheduled",
          plannedStartAt: `${slot.date}T${slot.startTime}:00+05:30`,
          plannedEndAt: `${slot.date}T${slot.endTime}:00+05:30`,
        },
      });
    }
    if (outcome.status === "sold" && creativeApproved) {
      await tx.settlement.create({
        data: {
          id: `settlement-${slotId}`,
          slotId,
          clearingPrice: outcome.clearingPrice ?? 0,
          platformFee,
          ownerPayout: (outcome.clearingPrice ?? 0) - platformFee,
          advertiserAmountDue: outcome.clearingPrice ?? 0,
          ownerAmountPayable: (outcome.clearingPrice ?? 0) - platformFee,
          status: "pending",
          updatedAt: closedAt,
        },
      });
    }
    });
  } catch (error) {
    // Concurrent closeAuctionNow() calls can both pass the "no existing result" check before
    // either commits — the unique slotId constraint on AuctionResult is the real guard here.
    const isUniqueConstraintError =
      typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
    if (!isUniqueConstraintError) throw error;
    const raceWinner = await getAuctionResult(slotId);
    if (raceWinner) return raceWinner;
    throw error;
  }

  if (outcome.status === "sold" && result.creativeId && result.winnerAdvertiserId && creativeApproved)
    await deliverScheduledPlayback(slotId, toBillboard(await prisma.billboard.findUniqueOrThrow({ where: { id: slot.billboardId } })), result.creativeId).catch(() => undefined);

  return result;
}

// Backfills playback + settlement for auctions that were sold before their winning
// creative was approved (creativeApprovalPending). Call after a creative is approved.
export async function finalizePendingSettlements(creativeId: string) {
  const creative = await getCreative(creativeId);
  if (!creative || (creative.status ?? "approved") !== "approved") return;
  const results = await prisma.auctionResult.findMany({
    where: { creativeId, creativeApprovalPending: true },
  });
  for (const result of results) {
    if (!result.winnerAdvertiserId) continue;
    const slot = await getSlot(result.slotId);
    if (!slot) continue;
    await prisma.$transaction([
      prisma.auctionResult.update({ where: { id: result.id }, data: { creativeApprovalPending: false } }),
      prisma.scheduledPlayback.create({
        data: {
          id: `playback-${result.slotId}`,
          slotId: result.slotId,
          creativeId,
          advertiserId: result.winnerAdvertiserId,
          status: "scheduled",
          plannedStartAt: `${slot.date}T${slot.startTime}:00+05:30`,
          plannedEndAt: `${slot.date}T${slot.endTime}:00+05:30`,
        },
      }),
      prisma.settlement.create({
        data: {
          id: `settlement-${result.slotId}`,
          slotId: result.slotId,
          clearingPrice: result.clearingPrice ?? 0,
          platformFee: result.platformFee,
          ownerPayout: result.ownerPayout,
          advertiserAmountDue: result.clearingPrice ?? 0,
          ownerAmountPayable: result.ownerPayout,
          status: "pending",
          updatedAt: new Date().toISOString(),
        },
      }),
    ]);
    const billboard = await getBillboard(slot.billboardId);
    if (billboard) await deliverScheduledPlayback(result.slotId, billboard, creativeId).catch(() => undefined);
  }
}

// Server-side clock: closes any auction past its close time, independent of whether a
// browser tab is open. Replaces the old client-side countdown-triggered close.
async function syncExpiredAuctions() {
  const now = Date.now();
  const openSlots = await prisma.slot.findMany({ where: { status: "auction_open" } });
  for (const slot of openSlots)
    if (slot.auctionCloseTime && now >= new Date(slot.auctionCloseTime).getTime())
      await closeAuctionNow(slot.id).catch(() => undefined);
}

// ponytail: setInterval polling, not a job queue — fine at demo scale (single process, seconds-level precision).
// Upgrade to a real scheduler/cron if this ever needs multi-instance or sub-second accuracy.
// Disabled under vitest: real Postgres round-trips make a full test run span multiple 5s ticks,
// and the seeded slot-cyber-7pm auctionCloseTime is deliberately in the past — the background
// sync would nondeterministically auto-close it mid-suite and corrupt other tests' baselines.
if (typeof window === "undefined" && process.env.NODE_ENV !== "test")
  setInterval(() => void syncExpiredAuctions(), 5000);

// --- Mutation helpers used by actions.ts ---

export async function createBillboardRow(billboard: Billboard) {
  const row = await prisma.billboard.create({ data: { ...billboard, active: billboard.active ?? true } });
  return toBillboard(row);
}
export async function updateBillboardRow(id: string, patch: Partial<Billboard>) {
  const row = await prisma.billboard.update({ where: { id }, data: patch });
  return toBillboard(row);
}

export async function createSlotsRows(newSlots: Slot[]) {
  await prisma.$transaction(
    newSlots.map((slot) =>
      prisma.slot.create({ data: { ...slot, published: slot.published ?? true, ownerUse: slot.ownerUse ?? false } }),
    ),
  );
  return newSlots;
}
export async function updateSlotRow(id: string, patch: Partial<Slot>) {
  const row = await prisma.slot.update({ where: { id }, data: patch });
  return toSlot(row);
}
export async function deleteSlotRow(id: string) {
  await prisma.$transaction([
    prisma.bid.deleteMany({ where: { slotId: id } }),
    prisma.slot.delete({ where: { id } }),
  ]);
}

export async function createBidRow(bid: Bid) {
  await prisma.bid.create({ data: bid });
  return bid;
}

export async function createCreativeRow(creative: Creative) {
  const row = await prisma.creative.create({ data: { ...creative, status: creative.status ?? "pending_review" } });
  return toCreative(row);
}
export async function updateCreativeRow(id: string, patch: Partial<Creative>) {
  const row = await prisma.creative.update({ where: { id }, data: patch });
  return toCreative(row);
}

export async function createCampaignRow(campaign: Campaign) {
  await prisma.campaign.create({ data: campaign });
  return campaign;
}
export async function updateCampaignRow(id: string, patch: Partial<Campaign>) {
  const row = await prisma.campaign.update({ where: { id }, data: patch });
  return row as unknown as Campaign;
}

export async function updateSettlementRow(slotId: string, patch: Partial<Settlement>) {
  const existing = await prisma.settlement.findFirst({ where: { slotId } });
  if (!existing) throw new Error("Settlement not found.");
  const row = await prisma.settlement.update({ where: { id: existing.id }, data: patch });
  return row as unknown as Settlement;
}
export async function updatePlaybackRow(slotId: string, patch: Partial<ScheduledPlayback>) {
  const existing = await prisma.scheduledPlayback.findFirst({ where: { slotId } });
  if (!existing) throw new Error("No scheduled playback found.");
  const row = await prisma.scheduledPlayback.update({ where: { id: existing.id }, data: patch });
  return row as unknown as ScheduledPlayback;
}
