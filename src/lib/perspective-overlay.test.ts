import { describe, expect, it } from "vitest";
import { percentQuadToPixels, quadToTriangleTransforms } from "./perspective-overlay";

describe("quadToTriangleTransforms", () => {
  it("reduces to a pure scale for an axis-aligned rectangle", () => {
    const quad: [number, number][] = [[0, 0], [200, 0], [200, 100], [0, 100]];
    const [t1, t2] = quadToTriangleTransforms(quad, 100, 50);
    for (const t of [t1, t2]) {
      expect(t.a).toBeCloseTo(2);
      expect(t.b).toBeCloseTo(0);
      expect(t.c).toBeCloseTo(0);
      expect(t.d).toBeCloseTo(2);
      expect(t.e).toBeCloseTo(0);
      expect(t.f).toBeCloseTo(0);
    }
    // Source corners map exactly onto destination corners.
    const apply = (t: typeof t1, x: number, y: number) => [t.a * x + t.c * y + t.e, t.b * x + t.d * y + t.f];
    expect(apply(t1, 0, 0)).toEqual([0, 0]);
    expect(apply(t1, 100, 0)).toEqual([200, 0]);
    expect(apply(t1, 100, 50)).toEqual([200, 100]);
  });

  it("maps a translated + offset rectangle correctly", () => {
    const quad: [number, number][] = [[10, 20], [110, 20], [110, 70], [10, 70]];
    const [t1] = quadToTriangleTransforms(quad, 100, 50);
    const apply = (x: number, y: number) => [t1.a * x + t1.c * y + t1.e, t1.b * x + t1.d * y + t1.f];
    expect(apply(0, 0)).toEqual([10, 20]);
    expect(apply(100, 0)).toEqual([110, 20]);
  });
});

describe("percentQuadToPixels", () => {
  it("converts percentage corners into pixel coordinates", () => {
    const quad = percentQuadToPixels(
      [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
      400,
      200,
    );
    expect(quad).toEqual([[0, 0], [400, 0], [400, 200], [0, 200]]);
  });
});
