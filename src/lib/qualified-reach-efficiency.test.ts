import { describe, expect, it } from "vitest";
import { billboards, slots } from "./data";
import {
  aggregateQualifiedReach,
  estimateQualifiedReach,
} from "./qualified-reach-efficiency";

describe("qualified reach efficiency", () => {
  it("reflects audience match, visibility, ad share, and price deterministically", () => {
    const strong = estimateQualifiedReach(slots[0], billboards[0], {
      expectedCost: 10000,
      targetAudienceTags: ["Tech professionals"],
      visibilityFactor: 0.9,
      adShareFactor: 0.1,
    });
    const weak = estimateQualifiedReach(slots[0], billboards[0], {
      expectedCost: 20000,
      targetAudienceTags: ["Families"],
      visibilityFactor: 0.5,
      adShareFactor: 0.05,
    });
    expect(strong.estimatedQualifiedImpressions).toBeGreaterThan(
      weak.estimatedQualifiedImpressions,
    );
    expect(strong.qualifiedReachEfficiency).toBeGreaterThan(
      weak.qualifiedReachEfficiency,
    );
    expect(strong.estimatedQualifiedCpm).toBeLessThan(
      weak.estimatedQualifiedCpm!,
    );
  });

  it("falls back conservatively when source inputs are missing", () => {
    const result = estimateQualifiedReach(slots[0], undefined);
    expect(result.estimatedQualifiedImpressions).toBe(0);
    expect(result.confidence).toBe("Low");
  });

  it("aggregates gross qualified impressions and applies a transparent overlap discount", () => {
    const result = aggregateQualifiedReach([
      { slot: slots[0], billboard: billboards[0] },
      { slot: slots[1], billboard: billboards[1] },
    ]);
    expect(result.grossQualifiedImpressions).toBeGreaterThan(0);
    expect(result.overlapDiscount).toBe(0.08);
    expect(result.adjustedEstimatedReach).toBeLessThan(
      result.grossQualifiedImpressions,
    );
  });
});
