import { describe, expect, it } from "vitest";
import { billboards, bids, slots } from "./data";
import { getDemandScore } from "./demand-score";

describe("demand score", () => {
  it("uses observable bidder activity without exposing bid values", () => {
    const result = getDemandScore(
      slots[0],
      bids,
      slots,
      billboards,
      new Date("2026-09-05T12:00:00Z"),
    );
    expect(result.score).toBeGreaterThan(0);
    expect(result.level).not.toBe("Low");
    expect(result.explanation).toContain("bidder");
  });
});
