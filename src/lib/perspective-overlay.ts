import type { FaceCorner } from "@/lib/data";

export type AffineTransform = { a: number; b: number; c: number; d: number; e: number; f: number };

// Splits the destination quad (top-left, top-right, bottom-right, bottom-left, as pixel
// coordinates) into two triangles and returns the affine transform mapping the unit-square
// source triangle (in `srcWidth` x `srcHeight` source-image pixel space) onto each. Canvas 2D
// has no native quad/projective warp, so a coarser grid of triangles (see gridTriangles) is
// used for less-distorted results; this pair is the minimal 2-triangle case.
export function triangleAffineTransform(
  src: [number, number][],
  dst: [number, number][],
): AffineTransform {
  const [x0, y0] = src[0];
  const [x1, y1] = src[1];
  const [x2, y2] = src[2];
  const [u0, v0] = dst[0];
  const [u1, v1] = dst[1];
  const [u2, v2] = dst[2];

  const A = [
    [x0, y0, 1, 0, 0, 0],
    [0, 0, 0, x0, y0, 1],
    [x1, y1, 1, 0, 0, 0],
    [0, 0, 0, x1, y1, 1],
    [x2, y2, 1, 0, 0, 0],
    [0, 0, 0, x2, y2, 1],
  ];
  const B = [u0, v0, u1, v1, u2, v2];
  const [pa, pc, pe, pb, pd, pf] = solveLinearSystem(A, B);
  return { a: pa, b: pb, c: pc, d: pd, e: pe, f: pf };
}

function solveLinearSystem(A: number[][], B: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, B[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const pivotVal = M[col][col] || 1e-12;
    for (let k = col; k <= n; k++) M[col][k] /= pivotVal;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      for (let k = col; k <= n; k++) M[row][k] -= factor * M[col][k];
    }
  }
  return M.map((row) => row[n]);
}

export type Quad = [FaceCorner, FaceCorner, FaceCorner, FaceCorner];

// Returns the two triangle transforms (top-left/top-right/bottom-right and
// top-left/bottom-right/bottom-left) that together warp a `srcWidth` x `srcHeight`
// source image onto the destination quad, given in pixel coordinates.
export function quadToTriangleTransforms(
  quad: [number, number][],
  srcWidth: number,
  srcHeight: number,
): [AffineTransform, AffineTransform] {
  const src: [number, number][] = [[0, 0], [srcWidth, 0], [srcWidth, srcHeight], [0, srcHeight]];
  const t1 = triangleAffineTransform([src[0], src[1], src[2]], [quad[0], quad[1], quad[2]]);
  const t2 = triangleAffineTransform([src[0], src[2], src[3]], [quad[0], quad[2], quad[3]]);
  return [t1, t2];
}

export function percentQuadToPixels(quad: Quad, width: number, height: number): [number, number][] {
  return quad.map((point) => [(point.x / 100) * width, (point.y / 100) * height]);
}
