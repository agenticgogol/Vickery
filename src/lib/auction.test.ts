import { describe, expect, it } from "vitest";
import {
  extendAuctionIfNeeded,
  getAuctionState,
  isBidEligible,
  runAuction,
  type AuctionBid,
} from "./auction";

const bid = (
  id: string,
  advertiserId: string,
  amount: number,
  createdAt: string,
): AuctionBid => ({ id, advertiserId, amount, createdAt });

describe("runAuction", () => {
  it("selects the highest eligible bidder and charges the second-highest eligible bid", () => {
    expect(
      runAuction(10000, [
        bid("a", "advertiser-a", 12000, "2026-01-01T09:00:00Z"),
        bid("b", "advertiser-b", 18000, "2026-01-01T09:01:00Z"),
        bid("c", "advertiser-c", 15000, "2026-01-01T09:02:00Z"),
      ]),
    ).toEqual({
      status: "sold",
      winnerAdvertiserId: "advertiser-b",
      winningBid: 18000,
      secondHighestBid: 15000,
      clearingPrice: 15000,
    });
  });

  it("charges the reserve price when there is one eligible bidder", () => {
    expect(
      runAuction(10000, [
        bid("a", "advertiser-a", 12000, "2026-01-01T09:00:00Z"),
      ]),
    ).toEqual({
      status: "sold",
      winnerAdvertiserId: "advertiser-a",
      winningBid: 12000,
      secondHighestBid: null,
      clearingPrice: 10000,
    });
  });

  it("returns unsold when no bid reaches the reserve", () => {
    expect(
      runAuction(10000, [
        bid("a", "advertiser-a", 9000, "2026-01-01T09:00:00Z"),
        bid("b", "advertiser-b", 9999, "2026-01-01T09:01:00Z"),
      ]),
    ).toEqual({
      status: "unsold",
      winnerAdvertiserId: null,
      winningBid: null,
      secondHighestBid: null,
      clearingPrice: null,
    });
  });

  it("breaks tied highest bids by earliest submission", () => {
    expect(
      runAuction(10000, [
        bid("later", "advertiser-later", 15000, "2026-01-01T09:02:00Z"),
        bid("earlier", "advertiser-earlier", 15000, "2026-01-01T09:01:00Z"),
      ]),
    ).toMatchObject({
      status: "sold",
      winnerAdvertiserId: "advertiser-earlier",
      winningBid: 15000,
      secondHighestBid: 15000,
      clearingPrice: 15000,
    });
  });

  it("ignores a second bid below reserve and charges reserve", () => {
    expect(
      runAuction(10000, [
        bid("eligible", "advertiser-a", 12000, "2026-01-01T09:00:00Z"),
        bid("ineligible", "advertiser-b", 9000, "2026-01-01T09:01:00Z"),
      ]),
    ).toEqual({
      status: "sold",
      winnerAdvertiserId: "advertiser-a",
      winningBid: 12000,
      secondHighestBid: null,
      clearingPrice: 10000,
    });
  });

  it("returns unsold when there are no bids", () => {
    expect(runAuction(10000, [])).toEqual({
      status: "unsold",
      winnerAdvertiserId: null,
      winningBid: null,
      secondHighestBid: null,
      clearingPrice: null,
    });
  });

  it("enforces reserve and minimum bid increment separately from clearing", () => {
    expect(isBidEligible(10000, 10000)).toBe(true);
    expect(isBidEligible(10499, 10000, 10000, 500)).toBe(false);
    expect(isBidEligible(10500, 10000, 10000, 500)).toBe(true);
    expect(isBidEligible(9000, 10000)).toBe(false);
  });

  it("extends an auction only when a valid bid arrives inside the configured window", () => {
    const close = "2026-09-06T12:00:00.000Z";
    expect(extendAuctionIfNeeded(close, "2026-09-06T11:57:00.000Z", 5, 5)).toBe(
      "2026-09-06T12:05:00.000Z",
    );
    expect(extendAuctionIfNeeded(close, "2026-09-06T11:50:00.000Z", 5, 5)).toBe(
      close,
    );
  });

  it("reports open, closing, closed, and unsold states deterministically", () => {
    const close = "2026-09-06T12:00:00.000Z";
    expect(
      getAuctionState(
        close,
        "auction_open",
        new Date("2026-09-06T11:30:00.000Z"),
      ),
    ).toBe("open");
    expect(
      getAuctionState(
        close,
        "auction_open",
        new Date("2026-09-06T11:50:00.000Z"),
      ),
    ).toBe("closing");
    expect(
      getAuctionState(
        close,
        "auction_open",
        new Date("2026-09-06T12:01:00.000Z"),
      ),
    ).toBe("closed");
    expect(
      getAuctionState(close, "unsold", new Date("2026-09-06T11:30:00.000Z")),
    ).toBe("unsold");
    expect(
      getAuctionState(
        close,
        "auction_open",
        new Date("2026-09-06T11:30:00.000Z"),
        15,
        "2026-09-06T12:00:00.000Z",
      ),
    ).toBe("scheduled");
  });
});
