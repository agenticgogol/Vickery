import type { Creative } from "./data";

export type ScreeningResult = { passed: boolean; issues: string[] };

// Deterministic, rule-based pre-check — no ML/LLM. Mirrors validateCreativeInput's
// constraints so a creative that slipped in with missing/implausible metadata is flagged
// before an admin approves it, rather than only at upload time.
export function screenCreative(creative: Creative): ScreeningResult {
  const issues: string[] = [];
  if (!creative.mimeType || !["image/jpeg", "image/png", "image/webp"].includes(creative.mimeType))
    issues.push("Missing or unsupported file type.");
  if (!creative.width || !creative.height || creative.width < 640 || creative.height < 320)
    issues.push("Missing or implausible dimensions.");
  if (creative.width && creative.height && Math.abs(creative.width / creative.height - 2) > 0.03)
    issues.push("Aspect ratio is not 2:1.");
  if (creative.fileSizeBytes !== undefined && (creative.fileSizeBytes <= 0 || creative.fileSizeBytes > 3_000_000))
    issues.push("File size missing or over 3 MB.");
  return { passed: issues.length === 0, issues };
}
