import type { Billboard, Slot } from "./data";
import { getTimeOfDay } from "./marketplace";

export type ReachEstimate = {
  impressions: number;
  cost: number;
  cpm: number | null;
  durationHours: number;
  timeMultiplier: number;
  qualityFactor: number;
};

export const reachEstimatorAssumptions = {
  // Daily traffic is distributed across 24 hours before the slot multiplier is applied.
  hoursPerDay: 24,
  // These are planning multipliers, not audited audience measurement.
  timeMultipliers: { Morning: 0.8, Afternoon: 1, Evening: 1.15, "Late night": 0.6 } as Record<string, number>,
  // Premium screens receive a modest visibility uplift; Standard is the baseline.
  qualityFactors: { Premium: 1.1, Standard: 1 } as Record<string, number>,
};

function hoursBetween(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const duration = (endHour * 60 + endMinute - (startHour * 60 + startMinute)) / 60;
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

export function estimateSlotReach(slot: Slot, billboard: Billboard, cost = slot.reservePrice): ReachEstimate {
  const durationHours = hoursBetween(slot.startTime, slot.endTime);
  const timeMultiplier = reachEstimatorAssumptions.timeMultipliers[getTimeOfDay(slot.startTime)] ?? 1;
  const qualityFactor = reachEstimatorAssumptions.qualityFactors[billboard.qualityTier] ?? 1;
  const impressions = Math.round(billboard.estimatedDailyTraffic * durationHours / reachEstimatorAssumptions.hoursPerDay * timeMultiplier * qualityFactor);
  const cpm = impressions > 0 ? cost / impressions * 1000 : null;
  return { impressions, cost, cpm, durationHours, timeMultiplier, qualityFactor };
}

export function estimateSelectedSlots(selected: Array<{ slot: Slot; billboard: Billboard; cost?: number }>) {
  const estimates = selected.map(({ slot, billboard, cost }) => estimateSlotReach(slot, billboard, cost));
  const impressions = estimates.reduce((total, estimate) => total + estimate.impressions, 0);
  const cost = estimates.reduce((total, estimate) => total + estimate.cost, 0);
  return { impressions, cost, cpm: impressions > 0 ? cost / impressions * 1000 : null, estimates };
}
