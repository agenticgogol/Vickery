import { describe, expect, it } from "vitest";
import { checkBillboardFit, parseDimensionsRatio } from "./billboard-fit";
import type { Billboard, Creative } from "./data";

const billboard = (dimensions: string): Billboard => ({
  id: "bb-test",
  ownerId: "user-owner",
  name: "Test Billboard",
  city: "Hyderabad",
  area: "Test",
  latitude: 0,
  longitude: 0,
  screenType: "Digital LED",
  dimensions,
  estimatedDailyTraffic: 1000,
  audienceProfile: "Test",
  qualityTier: "Standard",
});

const creative = (width?: number, height?: number): Creative => ({
  id: "creative-test",
  advertiserId: "adv-test",
  name: "Test Creative",
  imageUrl: "/creatives/test.svg",
  width,
  height,
});

describe("parseDimensionsRatio", () => {
  it("parses the '<w> × <h> ft' format", () => {
    expect(parseDimensionsRatio("40 × 20 ft")).toBeCloseTo(2);
    expect(parseDimensionsRatio("35 × 18 ft")).toBeCloseTo(1.944, 2);
  });
  it("returns null for unparseable input", () => {
    expect(parseDimensionsRatio("garbage")).toBeNull();
  });
});

describe("checkBillboardFit", () => {
  it("is compatible when creative ratio closely matches billboard ratio", () => {
    const result = checkBillboardFit(billboard("40 × 20 ft"), creative(1280, 640));
    expect(result.compatible).toBe(true);
    expect(result.billboardRatio).toBeCloseTo(2);
    expect(result.creativeRatio).toBeCloseTo(2);
  });

  it("is compatible within tolerance for a near-match ratio", () => {
    const result = checkBillboardFit(billboard("35 × 18 ft"), creative(1280, 640));
    expect(result.compatible).toBe(true);
  });

  it("flags a mismatch for a square creative on a 2:1 billboard", () => {
    const result = checkBillboardFit(billboard("40 × 20 ft"), creative(800, 800));
    expect(result.compatible).toBe(false);
    expect(result.message).toMatch(/aspect ratio/i);
  });

  it("flags a mismatch for a very wide creative on a 2:1 billboard", () => {
    const result = checkBillboardFit(billboard("40 × 20 ft"), creative(1600, 400));
    expect(result.compatible).toBe(false);
  });

  it("flags a mismatch for a tall creative on a 2:1 billboard", () => {
    const result = checkBillboardFit(billboard("40 × 20 ft"), creative(600, 1200));
    expect(result.compatible).toBe(false);
  });

  it("treats missing dimensions/size as compatible (nothing to compare)", () => {
    expect(checkBillboardFit(billboard("garbage"), creative(1280, 640)).compatible).toBe(true);
    expect(checkBillboardFit(billboard("40 × 20 ft"), creative()).compatible).toBe(true);
  });
});
