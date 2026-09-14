import { describe, expect, it } from "vitest";
import { billboards } from "./data";
import {
  parseNaturalSearchFallback,
  validateNaturalSearchFilters,
} from "./natural-search";

const areas = billboards.map((billboard) => billboard.area);
const audiences = billboards.flatMap((billboard) =>
  billboard.audienceProfile.split(" · ").map((tag) => tag.trim()),
);

describe("natural marketplace search", () => {
  it("maps common marketplace language to deterministic filters", () => {
    expect(
      parseNaturalSearchFallback(
        "Show premium billboards around Gachibowli under ₹25,000.",
        areas,
        audiences,
      ),
    ).toMatchObject({
      areas: ["Gachibowli"],
      maxReserve: 25000,
      qualityTier: "Premium",
      auctionStatus: "available",
    });
    const officeSearch = parseNaturalSearchFallback(
      "Find office commuter screens Friday evening.",
      areas,
      audiences,
    );
    expect(officeSearch).toMatchObject({ dayOfWeek: 5, timeOfDay: "Evening" });
    expect(officeSearch.audienceTags).toContain("Business commuters");
  });

  it("whitelists schema values and rejects malformed filters", () => {
    expect(
      validateNaturalSearchFilters(
        {
          areas: ["Unknown"],
          audienceTags: ["Unknown"],
          qualityTier: "Gold",
          sorting: "random",
          startTime: "25:00",
          maxReserve: -1,
        },
        areas,
        audiences,
      ),
    ).toEqual({
      areas: [],
      radiusKm: undefined,
      location: undefined,
      date: undefined,
      dayOfWeek: undefined,
      timeOfDay: undefined,
      startTime: undefined,
      endTime: undefined,
      maxReserve: undefined,
      minimumTraffic: undefined,
      audienceTags: [],
      qualityTier: undefined,
      auctionStatus: undefined,
      sorting: undefined,
    });
  });
});
