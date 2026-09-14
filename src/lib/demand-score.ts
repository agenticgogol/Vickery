import type { Bid, Billboard, Slot } from "./data";
import { getTimeOfDay } from "./marketplace";

export const demandScoreWeights = {
  uniqueBidders: 30,
  totalBids: 20,
  bidVelocity: 15,
  timeRemaining: 20,
  similarInventoryHistory: 15,
};

export function getDemandScore(
  slot: Slot,
  bids: Bid[],
  allSlots: Slot[],
  billboards: Billboard[],
  now = new Date(),
) {
  const slotBids = bids.filter((bid) => bid.slotId === slot.id);
  const uniqueBidders = new Set(slotBids.map((bid) => bid.advertiserId)).size;
  const recentBids = slotBids.filter(
    (bid) =>
      now.getTime() - new Date(bid.createdAt).getTime() <= 24 * 60 * 60 * 1000,
  ).length;
  const billboard = billboards.find((item) => item.id === slot.billboardId);
  const similarSlotIds = new Set(
    allSlots
      .filter(
        (item) =>
          item.id !== slot.id &&
          getTimeOfDay(item.startTime) === getTimeOfDay(slot.startTime) &&
          billboards.find((screen) => screen.id === item.billboardId)?.area ===
            billboard?.area,
      )
      .map((item) => item.id),
  );
  const similarBidCount = bids.filter((bid) =>
    similarSlotIds.has(bid.slotId),
  ).length;
  const remainingHours = slot.auctionCloseTime
    ? (new Date(slot.auctionCloseTime).getTime() - now.getTime()) / 3_600_000
    : null;
  const score = Math.round(
    Math.min(
      100,
      (uniqueBidders / 4) * demandScoreWeights.uniqueBidders +
        (Math.min(slotBids.length, 6) / 6) * demandScoreWeights.totalBids +
        (Math.min(recentBids, 3) / 3) * demandScoreWeights.bidVelocity +
        (remainingHours !== null && remainingHours >= 0 && remainingHours <= 24
          ? (1 - remainingHours / 24) * demandScoreWeights.timeRemaining
          : 0) +
        (Math.min(similarBidCount, 6) / 6) *
          demandScoreWeights.similarInventoryHistory,
    ),
  );
  const level =
    score >= 75
      ? "Very High"
      : score >= 50
        ? "High"
        : score >= 25
          ? "Moderate"
          : "Low";
  const activity = uniqueBidders
    ? `${uniqueBidders} bidder${uniqueBidders === 1 ? "" : "s"}${recentBids >= 2 ? " and strong recent activity" : ""}`
    : "limited observed bidding activity";
  return {
    score,
    level,
    uniqueBidders,
    totalBids: slotBids.length,
    recentBids,
    similarBidCount,
    explanation: `${level} demand: ${activity}.`,
  };
}
