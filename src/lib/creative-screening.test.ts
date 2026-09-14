import { describe, expect, it } from "vitest";
import { screenCreative } from "./creative-screening";
import type { Creative } from "./data";

const base: Creative = {
  id: "creative-x",
  advertiserId: "adv-megamart",
  name: "Test",
  imageUrl: "/creatives/megamart.svg",
  mimeType: "image/png",
  fileSizeBytes: 400000,
  width: 1280,
  height: 640,
};

describe("screenCreative", () => {
  it("passes a well-formed creative", () => {
    expect(screenCreative(base)).toEqual({ passed: true, issues: [] });
  });

  it("flags a missing mimeType", () => {
    const result = screenCreative({ ...base, mimeType: undefined });
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("Missing or unsupported file type.");
  });

  it("flags implausible dimensions", () => {
    const result = screenCreative({ ...base, width: 10, height: 10 });
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("Missing or implausible dimensions.");
  });

  it("flags a bad aspect ratio", () => {
    const result = screenCreative({ ...base, width: 1280, height: 1280 });
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("Aspect ratio is not 2:1.");
  });

  it("flags an oversized file", () => {
    const result = screenCreative({ ...base, fileSizeBytes: 5_000_000 });
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("File size missing or over 3 MB.");
  });
});
