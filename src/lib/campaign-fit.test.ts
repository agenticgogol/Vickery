import { describe, expect, it } from "vitest";
import { billboards, slots } from "./data";
import { defaultCampaignFitWeights, getCampaignFitScore } from "./campaign-fit";

const slot = slots.find((item) => item.id === "slot-cyber-7pm")!;
const billboard = billboards.find((item) => item.id === "bb-hitech")!;

describe("campaign fit score", () => {
  it("returns a perfect score for a matching brief", () => {
    const result = getCampaignFitScore(slot, billboard, {
      preferredAreas: ["HITEC City"],
      audienceTags: ["Tech professionals", "premium retail"],
      preferredTimeWindows: ["Evening"],
      qualityPreference: "Premium",
      maxReserve: 10000,
      objective: "reach",
    });

    expect(result.score).toBe(100);
    expect(result.breakdown).toEqual({
      geo: 20,
      audience: 20,
      time: 15,
      traffic: 15,
      price: 15,
      quality: 15,
    });
  });

  it("explains a price mismatch while remaining deterministic", () => {
    const preferences = {
      preferredAreas: ["HITEC City"],
      audienceTags: ["Tech professionals"],
      preferredTimeWindows: ["Evening"],
      qualityPreference: "Premium" as const,
      maxReserve: 8000,
      objective: "brand_awareness" as const,
    };
    const first = getCampaignFitScore(slot, billboard, preferences);
    const second = getCampaignFitScore(slot, billboard, preferences);

    expect(first).toEqual(second);
    expect(first.explanation).toContain("slightly above preferred price");
  });

  it("honours configurable weights", () => {
    const weights = {
      ...defaultCampaignFitWeights,
      geo: 100,
      audience: 0,
      time: 0,
      traffic: 0,
      price: 0,
      quality: 0,
    };
    expect(
      getCampaignFitScore(
        slot,
        billboard,
        {
          preferredAreas: ["HITEC City"],
          audienceTags: [],
          preferredTimeWindows: [],
          qualityPreference: "Any",
        },
        weights,
      ).score,
    ).toBe(100);
    expect(
      getCampaignFitScore(
        slot,
        billboard,
        {
          preferredAreas: ["Banjara Hills"],
          audienceTags: [],
          preferredTimeWindows: [],
          qualityPreference: "Any",
        },
        weights,
      ).score,
    ).toBe(0);
  });

  it("returns zero when billboard data is unavailable", () => {
    expect(
      getCampaignFitScore(slot, undefined, {
        preferredAreas: [],
        audienceTags: [],
        preferredTimeWindows: [],
        qualityPreference: "Any",
      }),
    ).toMatchObject({ score: 0 });
  });
});
