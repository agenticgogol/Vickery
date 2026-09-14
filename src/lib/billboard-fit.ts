import type { Billboard, Creative } from "./data";

// How far a creative's aspect ratio may diverge (relative) from the billboard face's
// before it's flagged as a mismatch. Tweak here, not inline below.
export const ASPECT_RATIO_TOLERANCE = 0.25;

export type FitResult = {
  compatible: boolean;
  billboardRatio: number | null;
  creativeRatio: number | null;
  message?: string;
};

export function parseDimensionsRatio(dimensions: string): number | null {
  const match = dimensions.match(/(\d+(?:\.\d+)?)\s*×\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const width = parseFloat(match[1]);
  const height = parseFloat(match[2]);
  if (!height) return null;
  return width / height;
}

export function checkBillboardFit(billboard: Billboard, creative: Creative): FitResult {
  const billboardRatio = parseDimensionsRatio(billboard.dimensions);
  const creativeRatio = creative.width && creative.height ? creative.width / creative.height : null;
  if (!billboardRatio || !creativeRatio)
    return { compatible: true, billboardRatio, creativeRatio };
  const relativeDiff = Math.abs(creativeRatio - billboardRatio) / billboardRatio;
  const compatible = relativeDiff <= ASPECT_RATIO_TOLERANCE;
  return {
    compatible,
    billboardRatio,
    creativeRatio,
    message: compatible
      ? undefined
      : `This creative's aspect ratio (${creativeRatio.toFixed(2)}:1) doesn't fit ${billboard.name}'s face (${billboardRatio.toFixed(2)}:1) — it would be badly stretched or cropped.`,
  };
}
