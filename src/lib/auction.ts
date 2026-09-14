export type AuctionBid = {
  id: string;
  advertiserId: string;
  amount: number;
  createdAt: string;
};

export type AuctionOutcome = {
  status: "sold" | "unsold";
  winnerAdvertiserId: string | null;
  winningBid: number | null;
  secondHighestBid: number | null;
  clearingPrice: number | null;
};

export type AuctionState = "scheduled" | "open" | "closing" | "closed" | "unsold";

export function isBidEligible(amount: number, reservePrice: number, currentHighestBid: number | null = null, minimumBidIncrement = 0) {
  const floor = currentHighestBid !== null && minimumBidIncrement > 0 ? Math.max(reservePrice, currentHighestBid + minimumBidIncrement) : reservePrice;
  return Number.isInteger(amount) && amount >= floor;
}

export function getAuctionState(closeTime: string | undefined, status: "available" | "auction_open" | "sold" | "unsold" | "reserved" | "unavailable", now = new Date(), closingWindowMinutes = 15, openTime?: string): AuctionState {
  if (status === "unsold") return "unsold";
  if (status === "sold" || status === "reserved" || status === "unavailable") return "closed";
  if (openTime && now.getTime() < new Date(openTime).getTime()) return "scheduled";
  if (status === "available" || !closeTime) return "open";
  if (now.getTime() >= new Date(closeTime).getTime()) return "closed";
  return new Date(closeTime).getTime() - now.getTime() <= closingWindowMinutes * 60 * 1000 ? "closing" : "open";
}

export function extendAuctionIfNeeded(closeTime: string, submittedAt: string, windowMinutes = 0, extensionMinutes = 0) {
  if (windowMinutes <= 0 || extensionMinutes <= 0) return closeTime;
  const close = new Date(closeTime).getTime();
  const submitted = new Date(submittedAt).getTime();
  if (close - submitted > windowMinutes * 60 * 1000 || submitted >= close) return closeTime;
  return new Date(close + extensionMinutes * 60 * 1000).toISOString();
}

/** Pure V0 auction calculation; persistence and UI belong outside this module. */
export function runAuction(reservePrice: number, bids: readonly AuctionBid[]): AuctionOutcome {
  const eligibleBids = bids
    .filter((bid) => bid.amount >= reservePrice)
    .slice()
    .sort((a, b) => b.amount - a.amount || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

  if (eligibleBids.length === 0) {
    return { status: "unsold", winnerAdvertiserId: null, winningBid: null, secondHighestBid: null, clearingPrice: null };
  }

  const winner = eligibleBids[0];
  const secondHighestBid = eligibleBids[1]?.amount ?? null;
  const clearingPrice = Math.max(secondHighestBid ?? reservePrice, reservePrice);

  return { status: "sold", winnerAdvertiserId: winner.advertiserId, winningBid: winner.amount, secondHighestBid, clearingPrice };
}
