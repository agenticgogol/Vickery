import type { Bid, Billboard, Campaign, Slot } from "./data";
import { getCurrentAuctionState } from "./bid-status";
import { getCampaignFitScore } from "./campaign-fit";
import { getAudienceTags, getTimeOfDay } from "./marketplace";

export function getMatchingSlots(
  campaign: Pick<
    Campaign,
    | "totalBudget"
    | "startDate"
    | "endDate"
    | "preferredAreas"
    | "preferredTimeWindows"
    | "audienceTags"
    | "qualityTier"
  >,
  slots: Slot[],
  billboards: Billboard[],
) {
  return slots.filter((slot) => {
    const billboard = billboards.find((item) => item.id === slot.billboardId);
    if (
      !billboard ||
      billboard.active === false ||
      slot.published === false ||
      (slot.status !== "available" && slot.status !== "auction_open")
    )
      return false;
    if (
      slot.date < campaign.startDate ||
      slot.date > campaign.endDate ||
      slot.reservePrice > campaign.totalBudget
    )
      return false;
    if (
      campaign.preferredAreas.length &&
      !campaign.preferredAreas.includes(billboard.area)
    )
      return false;
    if (
      campaign.preferredTimeWindows.length &&
      !campaign.preferredTimeWindows.includes(getTimeOfDay(slot.startTime))
    )
      return false;
    if (
      campaign.qualityTier !== "Any" &&
      billboard.qualityTier !== campaign.qualityTier
    )
      return false;
    if (
      campaign.audienceTags.length &&
      !campaign.audienceTags.some((tag) =>
        getAudienceTags(billboard).includes(tag),
      )
    )
      return false;
    return true;
  });
}

/**
 * Produces a deterministic, one-time auto-bid plan. It never raises bids after
 * submission: each selected slot receives only the minimum valid bid.
 */
export function buildCampaignAutoBidPlan(
  campaign: Pick<
    Campaign,
    | "totalBudget"
    | "startDate"
    | "endDate"
    | "preferredAreas"
    | "preferredTimeWindows"
    | "audienceTags"
    | "qualityTier"
    | "maxBidPerSlot"
  >,
  slots: Slot[],
  billboards: Billboard[],
  bids: Bid[],
  now = new Date(),
) {
  const maxBidPerSlot = campaign.maxBidPerSlot ?? 0;
  let committed = 0;
  return getMatchingSlots(campaign, slots, billboards)
    .filter((slot) =>
      ["open", "closing"].includes(
        getCurrentAuctionState(slot, undefined, now),
      ),
    )
    .map((slot) => {
      const billboard = billboards.find((item) => item.id === slot.billboardId);
      const highest = bids
        .filter(
          (bid) => bid.slotId === slot.id && bid.amount >= slot.reservePrice,
        )
        .reduce((value, bid) => Math.max(value, bid.amount), 0);
      const amount = Math.max(
        slot.reservePrice,
        highest + (slot.minimumBidIncrement ?? 0),
      );
      const score = getCampaignFitScore(slot, billboard, {
        preferredAreas: campaign.preferredAreas,
        audienceTags: campaign.audienceTags,
        preferredTimeWindows: campaign.preferredTimeWindows,
        qualityPreference: campaign.qualityTier,
        maxReserve: campaign.totalBudget,
        objective: "reach",
      }).score;
      return {
        slotId: slot.id,
        amount,
        score,
        date: slot.date,
        startTime: slot.startTime,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`) ||
        a.slotId.localeCompare(b.slotId),
    )
    .filter((item) => {
      if (
        item.amount > maxBidPerSlot ||
        committed + item.amount > campaign.totalBudget
      )
        return false;
      committed += item.amount;
      return true;
    });
}
