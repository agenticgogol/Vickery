import { getAuctionState, type AuctionState } from "./auction";
import type { Bid, Slot } from "./data";
import type { StoredAuctionResult } from "./db";

export type BidStatus = "Won" | "Lost" | "Leading" | "Outbid" | "Ineligible";

export function getCurrentAuctionState(slot: Slot, result?: StoredAuctionResult, now = new Date()): AuctionState {
  if (result) return result.status === "unsold" ? "unsold" : "closed";
  return getAuctionState(slot.auctionCloseTime, slot.status, now, 15, slot.auctionOpenTime);
}

export function getBidStatus(bid: Bid, slot: Slot, slotBids: readonly Bid[], result?: StoredAuctionResult): BidStatus {
  if (bid.amount < slot.reservePrice) return "Ineligible";
  if (result) return result.winnerAdvertiserId === bid.advertiserId && result.winningBid === bid.amount ? "Won" : "Lost";
  const eligible = slotBids.filter((item) => item.amount >= slot.reservePrice).slice().sort((a, b) => b.amount - a.amount || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return eligible[0]?.id === bid.id ? "Leading" : "Outbid";
}
