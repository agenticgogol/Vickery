import type { Billboard, Slot } from "./data";
import { getAudienceTags, getTimeOfDay } from "./marketplace";

export type CampaignObjective = "reach" | "brand_awareness" | "footfall" | "conversions";
export type CampaignFitPreferences = { preferredAreas: string[]; audienceTags: string[]; preferredTimeWindows: string[]; qualityPreference: "Any" | "Premium" | "Standard"; maxReserve?: number; objective?: CampaignObjective };
export type CampaignFitWeights = { geo: number; audience: number; time: number; traffic: number; price: number; quality: number };
export const defaultCampaignFitWeights: CampaignFitWeights = { geo: 20, audience: 20, time: 15, traffic: 15, price: 15, quality: 15 };

function dimension(value: number, weight: number) { return value * weight / 100; }

export function getCampaignFitScore(slot: Slot, billboard: Billboard | undefined, preferences: CampaignFitPreferences, weights: CampaignFitWeights = defaultCampaignFitWeights) {
  if (!billboard) return { score: 0, breakdown: { geo: 0, audience: 0, time: 0, traffic: 0, price: 0, quality: 0 }, explanation: "Billboard details are unavailable." };
  const geo = preferences.preferredAreas.length ? (preferences.preferredAreas.includes(billboard.area) ? 100 : 0) : 70;
  const audienceTags = getAudienceTags(billboard);
  const audience = preferences.audienceTags.length ? preferences.audienceTags.filter((tag) => audienceTags.includes(tag)).length / preferences.audienceTags.length * 100 : 70;
  const time = preferences.preferredTimeWindows.length ? (preferences.preferredTimeWindows.includes(getTimeOfDay(slot.startTime)) ? 100 : 0) : 70;
  const traffic = Math.min(100, billboard.estimatedDailyTraffic / 180000 * 100);
  const hasBudgetPreference = preferences.maxReserve !== undefined && preferences.maxReserve > 0;
  const price = hasBudgetPreference ? Math.max(0, Math.min(100, 100 - Math.max(0, slot.reservePrice - preferences.maxReserve!) / preferences.maxReserve! * 100)) : 70;
  const quality = preferences.qualityPreference === "Any" ? 70 : preferences.qualityPreference === billboard.qualityTier ? 100 : 0;
  const breakdown = { geo: dimension(geo, weights.geo), audience: dimension(audience, weights.audience), time: dimension(time, weights.time), traffic: dimension(traffic, weights.traffic), price: dimension(price, weights.price), quality: dimension(quality, weights.quality) };
  const score = Math.round(Math.max(0, Math.min(100, breakdown.geo + breakdown.audience + breakdown.time + breakdown.traffic + breakdown.price + breakdown.quality)));
  const strengths = [geo >= 100 && "location", audience >= 100 && "audience", time >= 100 && "timing", quality >= 100 && "quality", traffic >= 80 && "reach"].filter(Boolean) as string[];
  const overBudget = hasBudgetPreference && slot.reservePrice > preferences.maxReserve!;
  const caveats = [geo === 0 && "location", audience === 0 && "audience", time === 0 && "timing", quality === 0 && "quality", overBudget && "price"].filter(Boolean) as string[];
  const explanation = overBudget ? `${strengths.length ? `Strong ${strengths.slice(0, 2).join(" + ")} match; ` : ""}slightly above preferred price.` : strengths.length ? `Strong ${strengths.slice(0, 2).join(" + ")} match${caveats.length ? `; weaker ${caveats[0]} fit.` : "."}` : caveats.length ? `Limited ${caveats.slice(0, 2).join(" + ")} fit.` : "Balanced fit across your campaign brief.";
  return { score, breakdown, explanation };
}
