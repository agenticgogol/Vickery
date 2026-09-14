import type { Billboard, Slot } from "./data";

export type EstimateConfidence = "Low" | "Medium" | "High";
export type QualifiedReachInput = {
  expectedCost?: number;
  targetAudienceTags?: string[];
  preferredTimeWindows?: string[];
  visibilityFactor?: number;
  adShareFactor?: number;
  contextFactor?: number;
};

export const qualifiedReachAssumptions = {
  hoursPerDay: 24,
  adShareFactor: 0.1,
  visibilityByQuality: { Premium: 0.9, Standard: 0.7 } as Record<
    Billboard["qualityTier"],
    number
  >,
  timeMultiplier: {
    Morning: 0.8,
    Afternoon: 1,
    Evening: 1.15,
    "Late night": 0.6,
  } as Record<string, number>,
};

function timeOfDay(startTime: string) {
  const hour = Number(startTime.slice(0, 2));
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  if (hour < 21) return "Evening";
  return "Late night";
}

function durationHours(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const hours = (endHour * 60 + endMinute - startHour * 60 - startMinute) / 60;
  return Number.isFinite(hours) && hours > 0 ? hours : 0;
}

function audienceMatch(profile: string | undefined, target: string[]) {
  if (!profile?.trim()) return 0.4;
  if (!target.length) return 0.7;
  const available = profile.split("·").map((item) => item.trim().toLowerCase());
  const matches = target.filter((tag) =>
    available.includes(tag.toLowerCase()),
  ).length;
  if (matches === target.length) return 0.9;
  if (matches > 0) return 0.7;
  return 0.4;
}

export function estimateQualifiedReach(
  slot: Slot,
  billboard: Billboard | undefined,
  input: QualifiedReachInput = {},
) {
  const expectedCost = input.expectedCost ?? slot.reservePrice;
  const duration = durationHours(slot.startTime, slot.endTime);
  const time = timeOfDay(slot.startTime);
  const slotTraffic =
    billboard?.estimatedDailyTraffic && duration > 0
      ? ((billboard.estimatedDailyTraffic * duration) /
          qualifiedReachAssumptions.hoursPerDay) *
        (qualifiedReachAssumptions.timeMultiplier[time] ?? 1)
      : 0;
  const visibilityFactor =
    input.visibilityFactor ??
    (billboard
      ? qualifiedReachAssumptions.visibilityByQuality[billboard.qualityTier]
      : 0.5);
  const audienceMatchFactor = audienceMatch(
    billboard?.audienceProfile,
    input.targetAudienceTags ?? [],
  );
  const adShareFactor =
    input.adShareFactor ?? qualifiedReachAssumptions.adShareFactor;
  const contextFactor =
    input.contextFactor ??
    (input.preferredTimeWindows?.length
      ? input.preferredTimeWindows.includes(time)
        ? 1.05
        : 0.9
      : 1);
  const estimatedQualifiedImpressions = Math.round(
    slotTraffic *
      visibilityFactor *
      audienceMatchFactor *
      adShareFactor *
      contextFactor,
  );
  const qualifiedReachEfficiency =
    expectedCost > 0
      ? (estimatedQualifiedImpressions / expectedCost) * 1000
      : 0;
  const estimatedQualifiedCpm =
    estimatedQualifiedImpressions > 0
      ? (expectedCost / estimatedQualifiedImpressions) * 1000
      : null;
  const confidence: EstimateConfidence =
    !billboard?.estimatedDailyTraffic || !billboard.audienceProfile
      ? "Low"
      : input.targetAudienceTags?.length &&
          input.visibilityFactor !== undefined &&
          input.adShareFactor !== undefined
        ? "High"
        : "Medium";
  return {
    expectedCost,
    priceBasis:
      input.expectedCost === undefined ? "Reserve price" : "Expected cost",
    slotTraffic: Math.round(slotTraffic),
    visibilityFactor,
    audienceMatchFactor,
    adShareFactor,
    contextFactor,
    estimatedQualifiedImpressions,
    qualifiedReachEfficiency,
    estimatedQualifiedCpm,
    confidence,
    timeOfDay: time,
  };
}

export function aggregateQualifiedReach(
  items: Array<{
    slot: Slot;
    billboard?: Billboard;
    input?: QualifiedReachInput;
  }>,
) {
  const estimates = items.map(({ slot, billboard, input }) =>
    estimateQualifiedReach(slot, billboard, input),
  );
  const expectedCost = estimates.reduce(
    (total, item) => total + item.expectedCost,
    0,
  );
  const grossQualifiedImpressions = estimates.reduce(
    (total, item) => total + item.estimatedQualifiedImpressions,
    0,
  );
  // Conservative planning overlap discount: 8% for each additional screen, capped at 25%.
  const overlapDiscount = Math.min(
    0.25,
    Math.max(0, estimates.length - 1) * 0.08,
  );
  const adjustedEstimatedReach = Math.round(
    grossQualifiedImpressions * (1 - overlapDiscount),
  );
  return {
    estimates,
    expectedCost,
    grossQualifiedImpressions,
    adjustedEstimatedReach,
    overlapDiscount,
    qualifiedReachEfficiency: expectedCost
      ? (adjustedEstimatedReach / expectedCost) * 1000
      : 0,
    estimatedQualifiedCpm: adjustedEstimatedReach
      ? (expectedCost / adjustedEstimatedReach) * 1000
      : null,
    confidence: estimates.some((item) => item.confidence === "Low")
      ? "Low"
      : estimates.every((item) => item.confidence === "High")
        ? "High"
        : ("Medium" as EstimateConfidence),
  };
}
