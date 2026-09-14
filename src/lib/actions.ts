"use server";

import { revalidatePath } from "next/cache";
import {
  getBillboards,
  getBillboard,
  getSlots,
  getSlot,
  getBids,
  getBidsForSlot,
  getCreatives,
  getCreative,
  getCampaign,
  createBillboardRow,
  updateBillboardRow,
  createSlotsRows,
  updateSlotRow,
  deleteSlotRow,
  createBidRow,
  createCreativeRow,
  updateCreativeRow,
  createCampaignRow,
  updateCampaignRow,
  updateSettlementRow,
  updatePlaybackRow,
  getPlaybacks,
  getPlayback,
  closeAuctionNow,
  finalizePendingSettlements,
  resetSeededData,
} from "./db";
import {
  advertisers,
  getAdvertiser,
  minimumSlotDurationMinutes,
  type Billboard,
  type Campaign,
  type Creative,
  type CreativeStatus,
  type PlaybackStatus,
  type SettlementStatus,
  type Slot,
} from "./data";
import { extendAuctionIfNeeded, isBidEligible } from "./auction";
import { hasSlotOverlap } from "./inventory";
import { buildCampaignAutoBidPlan } from "./campaign";
import {
  naturalSearchPrompt,
  parseNaturalSearchFallback,
  validateNaturalSearchFilters,
  type NaturalSearchFilters,
} from "./natural-search";
import {
  assistantIntentPrompt,
  parseAssistantIntentFallback,
  validateAssistantIntent,
  type AssistantIntent,
} from "./assistant-intent";
import { getSession, USER_ADVERTISER_MAP, type Role } from "./session";
import { screenCreative } from "./creative-screening";
import { checkBillboardFit } from "./billboard-fit";

// ponytail: real session checks are bypassed in the vitest process (NODE_ENV=test) so the
// existing business-logic test suite can call these actions directly without a request/cookie
// context. Upgrade to per-test session fixtures if action-level auth ever needs dedicated tests.
async function requireRole(role: Role) {
  if (process.env.NODE_ENV === "test") return { userId: "test", role };
  const session = await getSession();
  if (!session || session.role !== role) throw new Error("Not authorized.");
  return session;
}
async function requireAdvertiser(advertiserId: string) {
  if (process.env.NODE_ENV === "test") return { userId: "test", role: "advertiser" as const };
  const session = await requireRole("advertiser");
  if (USER_ADVERTISER_MAP[session.userId] !== advertiserId)
    throw new Error("Not authorized for this advertiser.");
  return session;
}

export type SlotInput = {
  billboardId: string;
  date: string;
  startTime: string;
  endTime: string;
  reservePrice: number;
  auctionOpenTime?: string;
  auctionCloseTime?: string;
  minimumBidIncrement?: number;
  antiSnipingWindowMinutes?: number;
  antiSnipingExtensionMinutes?: number;
  status?: "available" | "reserved" | "unavailable";
  ownerUse?: boolean;
};
export type BillboardInput = Omit<
  Billboard,
  "id" | "ownerId" | "location" | "defaultReservePrice"
> & { location: string; defaultReservePrice: number };
export type CreativeInput = Omit<
  Creative,
  "id" | "status" | "rejectionReason"
> & {
  mimeType: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  status?: CreativeStatus;
};
export type CampaignInput = Omit<
  Campaign,
  "id" | "status" | "createdAt" | "buyingMode"
> & { buyingMode?: Campaign["buyingMode"] };
export type PlaybackAcknowledgement = Exclude<PlaybackStatus, "scheduled">;

export async function interpretMarketplaceSearch(input: {
  query: string;
  availableAreas: string[];
  availableAudiences: string[];
}): Promise<{ filters: NaturalSearchFilters; source: "ai" | "rules" }> {
  const fallback = parseNaturalSearchFallback(
    input.query,
    input.availableAreas,
    input.availableAudiences,
  );
  if (!process.env.OPENAI_API_KEY?.trim())
    return { filters: fallback, source: "rules" };
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: naturalSearchPrompt(
              input.availableAreas,
              input.availableAudiences,
            ),
          },
          { role: "user", content: input.query },
        ],
      }),
      cache: "no-store",
    });
    if (!response.ok) return { filters: fallback, source: "rules" };
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return { filters: fallback, source: "rules" };
    return {
      filters: validateNaturalSearchFilters(
        JSON.parse(content),
        input.availableAreas,
        input.availableAudiences,
      ),
      source: "ai",
    };
  } catch {
    return { filters: fallback, source: "rules" };
  }
}

/** Read-only grounding data so the assistant can resolve names to ids and never invents inventory. */
export async function getAssistantContext(role: "owner" | "advertiser") {
  const allBillboards = await getBillboards();
  const billboards = allBillboards
    .filter((billboard) => billboard.active !== false)
    .map((billboard) => ({ id: billboard.id, name: billboard.name, area: billboard.area }));
  if (role === "owner") return { billboards, advertisers: [], openSlots: [], creatives: [] };
  const allSlots = await getSlots();
  const openSlots = allSlots
    .filter(
      (slot) =>
        slot.published !== false &&
        (slot.status === "available" || slot.status === "auction_open"),
    )
    .map((slot) => {
      const billboard = allBillboards.find((item) => item.id === slot.billboardId);
      return {
        id: slot.id,
        billboardId: slot.billboardId,
        billboardName: billboard?.name ?? "",
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        reservePrice: slot.reservePrice,
      };
    });
  const allCreatives = await getCreatives();
  return {
    billboards,
    advertisers: advertisers.map((advertiser) => ({ id: advertiser.id, name: advertiser.name })),
    openSlots,
    creatives: allCreatives
      .filter((creative) => (creative.status ?? "approved") === "approved")
      .map((creative) => ({ id: creative.id, advertiserId: creative.advertiserId, name: creative.name })),
  };
}

/** Parses free text into a structured intent for the BX Guide assistant. Never executes anything itself — the caller resolves ids and asks the user to confirm before calling submitBid/createSlot. */
export async function interpretAssistantIntent(input: {
  query: string;
  role: "owner" | "advertiser";
  billboardNames: string[];
  advertiserNames: string[];
}): Promise<{ intent: AssistantIntent; source: "ai" | "rules" }> {
  const fallback = parseAssistantIntentFallback(
    input.role,
    input.query,
    input.billboardNames,
    input.advertiserNames,
  );
  if (!process.env.OPENAI_API_KEY?.trim())
    return { intent: fallback, source: "rules" };
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: assistantIntentPrompt(
              input.role,
              input.billboardNames,
              input.advertiserNames,
            ),
          },
          { role: "user", content: input.query },
        ],
      }),
      cache: "no-store",
    });
    if (!response.ok) return { intent: fallback, source: "rules" };
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return { intent: fallback, source: "rules" };
    const aiIntent = validateAssistantIntent(JSON.parse(content));
    // The model can misclassify a clear request as "navigate" (e.g. JSON-shape drift).
    // Trust the deterministic parser instead whenever it confidently found an action.
    if (aiIntent.type === "navigate" && fallback.type !== "navigate")
      return { intent: fallback, source: "rules" };
    return { intent: aiIntent, source: "ai" };
  } catch {
    return { intent: fallback, source: "rules" };
  }
}

export async function updateSettlementStatus(
  slotId: string,
  status: SettlementStatus,
) {
  await requireRole("admin");
  const settlement = await updateSettlementRow(slotId, { status, updatedAt: new Date().toISOString() });
  revalidatePath("/admin/settlements");
  revalidatePath(`/admin/auctions/${slotId}`);
  revalidatePath("/owner");
  revalidatePath("/advertiser");
  return settlement;
}

export async function acknowledgePlayback(
  slotId: string,
  status: PlaybackAcknowledgement,
  failureReason = "",
) {
  await requireRole("admin");
  if (status === "failed" && !failureReason.trim())
    throw new Error("Add a failure reason.");
  const existing = await getPlayback(slotId);
  // "pending" (e.g. awaiting manual USB delivery) is a normal state to acknowledge from — only a
  // known delivery failure should block claiming the screen played a creative that never arrived.
  if (existing?.deliveryStatus === "failed" && status !== "failed")
    throw new Error("Creative delivery failed — cannot acknowledge playback until it is redelivered.");
  const playback = await updatePlaybackRow(slotId, {
    status,
    playbackTimestamp: new Date().toISOString(),
    failureReason: status === "failed" ? failureReason.trim() : undefined,
  });
  revalidatePath(`/playback/${slotId}`);
  revalidatePath(`/proof-of-play/${slotId}`);
  revalidatePath("/owner");
  revalidatePath("/advertiser");
  revalidatePath("/admin");
  return playback;
}

async function assertApprovedCreative(creativeId: string, advertiserId: string) {
  const creative = await getCreative(creativeId);
  if (!creative || creative.advertiserId !== advertiserId || (creative.status ?? "approved") !== "approved")
    throw new Error("Choose an approved creative.");
}

export async function saveDraftCampaign(input: CampaignInput) {
  await requireAdvertiser(input.advertiserId);
  if (
    !input.name.trim() ||
    !Number.isInteger(input.totalBudget) ||
    input.totalBudget <= 0 ||
    !input.startDate ||
    !input.endDate ||
    input.startDate > input.endDate ||
    !input.advertiserId ||
    !input.creativeId
  )
    throw new Error("Complete the campaign name, budget, dates, and creative.");
  await assertApprovedCreative(input.creativeId, input.advertiserId);
  const campaign: Campaign = {
    ...input,
    buyingMode: input.buyingMode ?? "manual",
    id: `campaign-${Date.now()}`,
    status: "draft",
    createdAt: new Date().toISOString(),
  };
  await createCampaignRow(campaign);
  revalidatePath("/advertiser/campaigns");
  return campaign;
}

export async function runCampaignAutoBid(
  input: CampaignInput & { campaignId?: string },
) {
  await requireAdvertiser(input.advertiserId);
  const { campaignId, ...campaignInput } = input;
  if (
    input.buyingMode !== "auto" ||
    typeof input.maxBidPerSlot !== "number" ||
    !Number.isInteger(input.maxBidPerSlot) ||
    input.maxBidPerSlot <= 0
  )
    throw new Error("Set a whole-number maximum bid per slot for auto-bid.");
  if (
    !input.preferredAreas.length &&
    !input.preferredTimeWindows.length &&
    !input.audienceTags.length &&
    input.qualityTier === "Any"
  )
    throw new Error(
      "Add at least one campaign preference so auto-bid has a meaningful match score.",
    );
  if (
    !input.name.trim() ||
    !Number.isInteger(input.totalBudget) ||
    input.totalBudget <= 0 ||
    !input.startDate ||
    !input.endDate ||
    input.startDate > input.endDate ||
    !input.advertiserId ||
    !input.creativeId
  )
    throw new Error("Complete the campaign name, budget, dates, and creative.");
  await assertApprovedCreative(input.creativeId, input.advertiserId);

  const existing = campaignId ? await getCampaign(campaignId) : undefined;
  const campaign: Campaign = existing ?? {
    ...campaignInput,
    buyingMode: "auto",
    id: `campaign-${Date.now()}`,
    status: "active" as const,
    createdAt: new Date().toISOString(),
  };
  if (existing) {
    Object.assign(campaign, campaignInput, { status: "active" as const });
    await updateCampaignRow(campaign.id, campaign);
  } else {
    await createCampaignRow(campaign);
  }

  const [slots, billboards, bids] = await Promise.all([getSlots(), getBillboards(), getBids()]);
  const plan = buildCampaignAutoBidPlan(campaign, slots, billboards, bids);
  const placed = [];
  for (const item of plan) {
    try {
      placed.push(
        await submitBid({
          slotId: item.slotId,
          advertiserId: input.advertiserId,
          amount: item.amount,
          creativeId: input.creativeId,
          campaignId: campaign.id,
        }),
      );
    } catch {
      // The slot may have changed while this bounded one-time plan was executing.
    }
  }
  revalidatePath("/advertiser/campaigns");
  return { campaign, placed, considered: plan.length };
}

function validateCreativeInput(input: CreativeInput) {
  if (!input.name.trim() || !input.imageUrl)
    throw new Error("Add a creative name and image.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(input.mimeType))
    throw new Error("Creative must be JPG, PNG, or WebP.");
  if (
    !Number.isInteger(input.fileSizeBytes) ||
    input.fileSizeBytes <= 0 ||
    input.fileSizeBytes > 3_000_000
  )
    throw new Error("Creative must be under 3 MB.");
  if (
    !Number.isInteger(input.width) ||
    !Number.isInteger(input.height) ||
    input.width < 640 ||
    input.height < 320
  )
    throw new Error("Creative must be at least 640 × 320 pixels.");
  const ratio = input.width / input.height;
  if (Math.abs(ratio - 2) > 0.03)
    throw new Error("Creative aspect ratio must be 2:1.");
}

export async function createCreative(input: CreativeInput) {
  await requireAdvertiser(input.advertiserId);
  validateCreativeInput(input);
  const creative: Creative = {
    ...input,
    id: `creative-${Date.now()}`,
    status: input.status ?? "pending_review",
    rejectionReason: undefined,
  };
  await createCreativeRow(creative);
  revalidatePath("/advertiser/creatives");
  revalidatePath("/advertiser");
  revalidatePath("/admin/creatives");
  return creative;
}

export async function reviewCreative(
  id: string,
  status: "approved" | "rejected",
  rejectionReason = "",
) {
  await requireRole("admin");
  const creative = await getCreative(id);
  if (!creative) throw new Error("Creative not found.");
  if (status === "rejected" && !rejectionReason.trim())
    throw new Error("Add a rejection reason.");
  if (status === "approved") {
    const screening = screenCreative(creative);
    if (!screening.passed) throw new Error(`Cannot approve: ${screening.issues.join(" ")}`);
  }
  const updated = await updateCreativeRow(id, {
    status,
    rejectionReason: status === "rejected" ? rejectionReason.trim() : undefined,
  });
  if (status === "approved") {
    await finalizePendingSettlements(id);
    revalidatePath("/admin");
    revalidatePath("/admin/settlements");
    revalidatePath("/owner");
  }
  revalidatePath("/advertiser/creatives");
  revalidatePath("/advertiser");
  revalidatePath("/admin/creatives");
  return updated;
}

export async function takedownCreative(creativeId: string, reason: string) {
  await requireRole("admin");
  const creative = await getCreative(creativeId);
  if (!creative) throw new Error("Creative not found.");
  if (creative.status !== "approved") throw new Error("Only approved creatives can be taken down.");
  if (!reason.trim()) throw new Error("Add a takedown reason.");
  const updated = await updateCreativeRow(creativeId, { status: "rejected", rejectionReason: reason.trim() });
  const affectedPlaybacks = (await getPlaybacks()).filter(
    (playback) => playback.creativeId === creativeId && (playback.status === "scheduled" || playback.status === "playing"),
  );
  for (const playback of affectedPlaybacks)
    await updatePlaybackRow(playback.slotId, {
      status: "failed",
      failureReason: "Creative taken down by admin.",
      playbackTimestamp: new Date().toISOString(),
    });
  for (const playback of affectedPlaybacks) {
    revalidatePath(`/playback/${playback.slotId}`);
    revalidatePath(`/proof-of-play/${playback.slotId}`);
  }
  revalidatePath("/advertiser/creatives");
  revalidatePath("/advertiser");
  revalidatePath("/admin/creatives");
  return updated;
}

function validateBillboardInput(input: BillboardInput) {
  if (
    !input.name.trim() ||
    !input.city.trim() ||
    !input.area.trim() ||
    !input.location?.trim() ||
    !input.screenType.trim() ||
    !input.dimensions.trim() ||
    !input.audienceProfile.trim()
  )
    throw new Error("Complete all billboard details.");
  if (
    !Number.isFinite(input.latitude) ||
    input.latitude < -90 ||
    input.latitude > 90 ||
    !Number.isFinite(input.longitude) ||
    input.longitude < -180 ||
    input.longitude > 180
  )
    throw new Error("Enter valid latitude and longitude.");
  if (
    !Number.isInteger(input.estimatedDailyTraffic) ||
    input.estimatedDailyTraffic <= 0 ||
    !Number.isInteger(input.defaultReservePrice) ||
    input.defaultReservePrice < 0
  )
    throw new Error("Traffic and reserve must be whole numbers.");
  if (input.imageUrl && input.imageUrl.length > 4_000_000)
    throw new Error("Billboard image must be under 3 MB.");
  if (input.altitude !== undefined && !Number.isFinite(input.altitude))
    throw new Error("Altitude must be a number.");
  if (input.faceCorners !== undefined && input.faceCorners.length !== 4)
    throw new Error("Face corners must be exactly 4 points.");
}

export async function createBillboard(input: BillboardInput) {
  const session = await requireRole("owner");
  validateBillboardInput(input);
  const billboard: Billboard = {
    ...input,
    id: `bb-${Date.now()}`,
    ownerId: session.userId,
    active: input.active ?? true,
    verificationStatus: "pending",
    verificationPhotos: input.verificationPhotos ?? [],
  };
  await createBillboardRow(billboard);
  revalidatePath("/owner");
  revalidatePath("/advertiser");
  revalidatePath("/admin");
  return billboard;
}

export async function updateBillboard(id: string, input: BillboardInput) {
  await requireRole("owner");
  const billboard = await getBillboard(id);
  if (!billboard) throw new Error("Billboard not found.");
  validateBillboardInput(input);
  // Re-editing a billboard's details sends it back to the verification queue.
  const updated = await updateBillboardRow(id, { ...input, verificationStatus: "pending" });
  revalidatePath("/owner");
  revalidatePath("/advertiser");
  revalidatePath("/admin");
  return updated;
}

export async function reviewBillboard(
  billboardId: string,
  decision: "verified" | "rejected",
  reason = "",
) {
  await requireRole("admin");
  const billboard = await getBillboard(billboardId);
  if (!billboard) throw new Error("Billboard not found.");
  if (decision === "rejected" && !reason.trim())
    throw new Error("Add a rejection reason.");
  const updated = await updateBillboardRow(billboardId, {
    verificationStatus: decision,
    rejectionReason: decision === "rejected" ? reason.trim() : undefined,
  });
  revalidatePath("/admin/inventory");
  revalidatePath("/owner");
  revalidatePath("/advertiser");
  return updated;
}

function validateSlotInput(input: SlotInput, billboards: Billboard[]) {
  const minimumReserve = input.ownerUse || input.status === "reserved" ? 0 : 1;
  if (
    !input.date ||
    !input.startTime ||
    !input.endTime ||
    input.endTime <= input.startTime ||
    !Number.isInteger(input.reservePrice) ||
    input.reservePrice < minimumReserve
  )
    throw new Error("Enter a valid date, time range, and reserve price.");
  const [startHour, startMinute] = input.startTime.split(":").map(Number);
  const [endHour, endMinute] = input.endTime.split(":").map(Number);
  const durationMinutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  if (durationMinutes < minimumSlotDurationMinutes)
    throw new Error(`Slot must be at least ${minimumSlotDurationMinutes} minutes long.`);
  if (
    input.auctionOpenTime &&
    input.auctionCloseTime &&
    new Date(input.auctionOpenTime).getTime() >=
      new Date(input.auctionCloseTime).getTime()
  )
    throw new Error("Auction open time must be before close time.");
  if (
    input.minimumBidIncrement !== undefined &&
    (!Number.isInteger(input.minimumBidIncrement) ||
      input.minimumBidIncrement < 0)
  )
    throw new Error("Minimum bid increment must be a whole number.");
  if (
    (input.antiSnipingWindowMinutes !== undefined &&
      (!Number.isInteger(input.antiSnipingWindowMinutes) ||
        input.antiSnipingWindowMinutes < 0)) ||
    (input.antiSnipingExtensionMinutes !== undefined &&
      (!Number.isInteger(input.antiSnipingExtensionMinutes) ||
        input.antiSnipingExtensionMinutes < 0))
  )
    throw new Error("Anti-sniping settings must be whole minutes.");
  if (!billboards.some((billboard) => billboard.id === input.billboardId))
    throw new Error("Billboard not found.");
}

export async function createSlots(inputs: SlotInput[]) {
  await requireRole("owner");
  if (!inputs.length) throw new Error("Add at least one slot.");
  const [existingSlots, billboards] = await Promise.all([getSlots(), getBillboards()]);
  const newSlots: Slot[] = [];
  for (const input of inputs) {
    validateSlotInput(input, billboards);
    if (
      hasSlotOverlap(input, existingSlots, undefined) ||
      hasSlotOverlap(input, newSlots)
    )
      throw new Error(
        `Overlapping slot on ${input.date} from ${input.startTime} to ${input.endTime}.`,
      );
    const { status, ownerUse, ...slotInput } = input;
    const billboard = billboards.find((item) => item.id === input.billboardId);
    const verified = billboard?.verificationStatus === "verified";
    newSlots.push({
      id: `slot-${input.billboardId}-${Date.now()}-${newSlots.length}`,
      ...slotInput,
      status: status ?? (ownerUse ? "reserved" : "available"),
      ownerUse,
      published: status === "unavailable" ? false : !ownerUse && verified,
    });
  }
  await createSlotsRows(newSlots);
  revalidatePath("/owner");
  revalidatePath("/advertiser");
  revalidatePath("/admin");
  return newSlots;
}

export async function createSlot(input: SlotInput) {
  return (await createSlots([input]))[0];
}

export async function submitBid(input: {
  slotId: string;
  advertiserId: string;
  amount: number;
  creativeId: string;
  campaignId?: string;
}) {
  await requireAdvertiser(input.advertiserId);
  const slot = await getSlot(input.slotId);
  if (
    !slot ||
    slot.published === false ||
    (slot.status !== "available" && slot.status !== "auction_open")
  )
    throw new Error("This slot is no longer accepting bids.");
  if (
    slot.auctionOpenTime &&
    Date.now() < new Date(slot.auctionOpenTime).getTime()
  )
    throw new Error("This auction is not open yet.");
  if (
    slot.auctionCloseTime &&
    Date.now() >= new Date(slot.auctionCloseTime).getTime()
  )
    throw new Error("This auction is closed.");
  const creative = await getCreative(input.creativeId);
  if (
    !creative ||
    creative.advertiserId !== input.advertiserId ||
    (creative.status ?? "approved") !== "approved" ||
    !Number.isInteger(input.amount) ||
    input.amount <= 0
  )
    throw new Error("Select an approved creative and valid bid amount.");
  const bidBillboard = await getBillboard(slot.billboardId);
  if (bidBillboard) {
    const fit = checkBillboardFit(bidBillboard, creative);
    if (!fit.compatible) throw new Error(fit.message);
  }
  const slotBids = await getBidsForSlot(slot.id);
  const currentHighestBid =
    slotBids
      .filter((bid) => bid.amount >= slot.reservePrice)
      .reduce((highest, bid) => Math.max(highest, bid.amount), 0) || null;
  if (
    !isBidEligible(
      input.amount,
      slot.reservePrice,
      currentHighestBid,
      slot.minimumBidIncrement ?? 0,
    )
  )
    // Sealed-bid auction: never reveal the current highest bid to a rejected bidder.
    // The client only knows the reserve price and minimum increment.
    throw new Error(
      `Bid must meet the reserve price${slot.minimumBidIncrement ? " and minimum bid increment" : ""}.`,
    );
  const createdAt = new Date().toISOString();
  const bid = {
    id: `bid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    slotId: input.slotId,
    advertiserId: input.advertiserId,
    amount: input.amount,
    creativeId: input.creativeId,
    createdAt,
  };
  await createBidRow(bid);
  const billboard = bidBillboard;
  if (!input.campaignId)
    await createCampaignRow({
      id: `campaign-quick-${bid.id}`,
      advertiserId: input.advertiserId,
      name: `Quick bid · ${slot.date} ${slot.startTime}`,
      totalBudget: input.amount,
      startDate: slot.date,
      endDate: slot.date,
      preferredAreas: billboard ? [billboard.area] : [],
      preferredTimeWindows: [],
      audienceTags: [],
      qualityTier: billboard?.qualityTier ?? "Any",
      creativeId: input.creativeId,
      selectedSlotIds: [slot.id],
      buyingMode: "manual",
      status: "draft",
      createdAt,
    });
  const patch: Partial<Slot> = {};
  if (slot.status === "available") patch.status = "auction_open";
  if (slot.auctionCloseTime)
    patch.auctionCloseTime = extendAuctionIfNeeded(
      slot.auctionCloseTime,
      createdAt,
      slot.antiSnipingWindowMinutes,
      slot.antiSnipingExtensionMinutes,
    );
  if (Object.keys(patch).length) await updateSlotRow(slot.id, patch);
  revalidatePath(`/advertiser/slots/${slot.id}`);
  revalidatePath("/advertiser/campaigns");
  revalidatePath(`/admin/auctions/${slot.id}`);
  revalidatePath("/owner");
  revalidatePath("/advertiser");
  revalidatePath("/admin");
  return bid;
}

export async function setSlotAvailability(slotId: string, available: boolean) {
  await requireRole("owner");
  const slot = await getSlot(slotId);
  if (
    !slot ||
    (slot.status !== "available" &&
      slot.status !== "unsold" &&
      slot.status !== "unavailable")
  )
    throw new Error(
      "Only available, unsold, or unavailable inventory can be published or paused.",
    );
  const updated = await updateSlotRow(slotId, {
    published: available,
    status: slot.status !== "unsold" ? (available ? "available" : "unavailable") : slot.status,
  });
  revalidatePath("/owner");
  revalidatePath("/advertiser");
  revalidatePath("/admin");
  return updated;
}

export async function updateSlot(input: SlotInput & { slotId: string }) {
  await requireRole("owner");
  const slot = await getSlot(input.slotId);
  if (!slot) throw new Error("Slot not found.");
  if (slot.status === "sold")
    throw new Error("Sold slots are locked and cannot be edited.");
  if (slot.status === "auction_open")
    throw new Error("Auction-open slots are locked while bidding is active.");
  const [existingSlots, billboards] = await Promise.all([getSlots(), getBillboards()]);
  validateSlotInput(input, billboards);
  if (hasSlotOverlap(input, existingSlots, slot.id))
    throw new Error(
      `Overlapping slot on ${input.date} from ${input.startTime} to ${input.endTime}.`,
    );
  const { status, ownerUse, slotId, ...slotInput } = input;
  const updated = await updateSlotRow(slotId, {
    ...slotInput,
    status:
      status ??
      (ownerUse
        ? "reserved"
        : slot.status === "unavailable"
          ? "unavailable"
          : "available"),
    ownerUse,
    published:
      status === "unavailable" || ownerUse ? false : slot.published !== false,
  });
  revalidatePath("/owner");
  revalidatePath("/advertiser");
  revalidatePath("/admin");
  return updated;
}

export async function deleteSlot(slotId: string) {
  await requireRole("owner");
  const slot = await getSlot(slotId);
  if (!slot) throw new Error("Slot not found.");
  if (slot.status === "sold")
    throw new Error("Sold slots are locked and cannot be deleted.");
  if (slot.status === "auction_open")
    throw new Error("Auction-open slots are locked while bidding is active.");
  await deleteSlotRow(slotId);
  revalidatePath("/owner");
  revalidatePath("/advertiser");
  revalidatePath("/admin");
  return { ok: true };
}

export async function closeAuction(slotId: string) {
  await requireRole("admin");
  const result = await closeAuctionNow(slotId);
  revalidatePath("/admin");
  revalidatePath(`/admin/auctions/${slotId}`);
  revalidatePath(`/advertiser/slots/${slotId}`);
  revalidatePath("/advertiser");
  revalidatePath(`/playback/${slotId}`);
  revalidatePath("/owner");
  return result;
}

export async function generateSampleBids(slotId: string) {
  await requireRole("admin");
  const slot = await getSlot(slotId);
  if (!slot) throw new Error("Slot not found.");
  const existingBids = await getBidsForSlot(slotId);
  if (existingBids.length) throw new Error("This slot already has bids.");
  const increment = slot.minimumBidIncrement ?? 0;
  const amounts = [
    slot.reservePrice,
    slot.reservePrice + Math.max(increment * 2, 1000),
    slot.reservePrice + Math.max(increment * 4, 2000),
  ];
  const allCreatives = await getCreatives();
  const sampleBids = advertisers
    .map((advertiser, index) => ({
      advertiser,
      amount: amounts[index] ?? slot.reservePrice + (index + 1) * 1000,
      creative: allCreatives.find(
        (creative) => creative.advertiserId === advertiser.id && (creative.status ?? "approved") === "approved",
      ),
    }))
    .filter(
      (item): item is typeof item & { creative: NonNullable<typeof item.creative> } =>
        Boolean(item.creative),
    );
  for (const item of sampleBids)
    await submitBid({
      slotId,
      advertiserId: item.advertiser.id,
      amount: item.amount,
      creativeId: item.creative.id,
    });
  return getBidsForSlot(slotId);
}

export type BulkSimulationRow = {
  billboardName: string;
  slotId: string;
  date: string;
  startTime: string;
  reservePrice: number;
  bids: number;
  status: string;
  winner: string;
  clearingPrice: number;
};

export async function runBulkSimulation() {
  await requireRole("admin");
  const [billboards, allCreatives] = await Promise.all([getBillboards(), getCreatives()]);
  const targets = billboards.slice(0, 4);
  const now = new Date();
  const minute = now.getMinutes();
  const rows: BulkSimulationRow[] = [];
  const raiseSequence = [2500, 1500, 1000, 500]; // war cools off round over round

  for (let i = 0; i < targets.length; i += 1) {
    const billboard = targets[i];
    const date = new Date(now.getTime() + (14 + i) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const startHour = 18 + i;
    const startTime = `${String(startHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const endTime = `${String(startHour + 1).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const reservePrice = 8_000 + i * 2_000;

    let slot: Slot;
    try {
      slot = await createSlot({
        billboardId: billboard.id,
        date,
        startTime,
        endTime,
        reservePrice,
        minimumBidIncrement: 500,
      });
    } catch {
      continue; // slot already released for this minute/day — skip on rerun
    }

    for (let round = 0; round < raiseSequence.length; round += 1) {
      const advertiser = advertisers[round % advertisers.length];
      const creative = allCreatives.find(
        (item) =>
          item.advertiserId === advertiser.id &&
          (item.status ?? "approved") === "approved",
      );
      if (!creative) continue;
      const currentHighest = (await getBidsForSlot(slot.id)).reduce(
        (highest, bid) => Math.max(highest, bid.amount),
        0,
      );
      const amount = (currentHighest || reservePrice - raiseSequence[0]) + raiseSequence[round];
      try {
        await submitBid({
          slotId: slot.id,
          advertiserId: advertiser.id,
          amount,
          creativeId: creative.id,
        });
      } catch {
        // bid fell below the live floor — the war already cooled, move on
      }
    }

    const result = await closeAuctionNow(slot.id);
    rows.push({
      billboardName: billboard.name,
      slotId: slot.id,
      date,
      startTime,
      reservePrice,
      bids: (await getBidsForSlot(slot.id)).length,
      status: result.status,
      winner: result.winnerAdvertiserId
        ? (getAdvertiser(result.winnerAdvertiserId)?.name ?? "Advertiser")
        : "Unsold",
      clearingPrice: result.clearingPrice ?? 0,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/owner");
  revalidatePath("/advertiser");
  return rows;
}

export async function resetDemo() {
  await requireRole("admin");
  await resetSeededData();
  for (const path of [
    "/",
    "/owner",
    "/advertiser",
    "/advertiser/bids",
    "/admin",
    "/admin/auctions/slot-cyber-7pm",
    "/playback/slot-cyber-7pm",
  ])
    revalidatePath(path);
  return { ok: true };
}
