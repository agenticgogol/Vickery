import type { Billboard, Slot } from "./data";
import { distanceKm, getTimeOfDay } from "./marketplace";

export const comparableInventoryConfig = {
  minimumComparables: 2,
  maxDistanceKm: 15,
  trafficRatio: 0.45,
};

export function getComparableInventoryPrice(
  slot: Slot,
  billboards: Billboard[],
  slots: Slot[],
  config = comparableInventoryConfig,
) {
  const billboard = billboards.find((item) => item.id === slot.billboardId);
  if (!billboard)
    return {
      sufficient: false as const,
      comparables: [],
      medianReserve: null,
      variancePercent: null,
      label: "Not enough comparable inventory yet.",
    };
  const comparables = slots.filter((item) => {
    const candidate = billboards.find(
      (screen) => screen.id === item.billboardId,
    );
    return (
      item.id !== slot.id &&
      candidate &&
      candidate.qualityTier === billboard.qualityTier &&
      candidate.screenType === billboard.screenType &&
      getTimeOfDay(item.startTime) === getTimeOfDay(slot.startTime) &&
      distanceKm(
        {
          latitude: billboard.latitude,
          longitude: billboard.longitude,
          label: billboard.area,
        },
        candidate,
      ) <= config.maxDistanceKm &&
      Math.abs(
        candidate.estimatedDailyTraffic - billboard.estimatedDailyTraffic,
      ) /
        Math.max(1, billboard.estimatedDailyTraffic) <=
        config.trafficRatio
    );
  });
  if (comparables.length < config.minimumComparables)
    return {
      sufficient: false as const,
      comparables,
      medianReserve: null,
      variancePercent: null,
      label: "Not enough comparable inventory yet.",
    };
  const reserves = comparables
    .map((item) => item.reservePrice)
    .sort((a, b) => a - b);
  const medianReserve =
    reserves.length % 2
      ? reserves[Math.floor(reserves.length / 2)]
      : (reserves[reserves.length / 2 - 1] + reserves[reserves.length / 2]) / 2;
  const variancePercent =
    ((slot.reservePrice - medianReserve) / medianReserve) * 100;
  const rounded = Math.round(Math.abs(variancePercent));
  const label =
    rounded <= 5
      ? "Priced near comparable inventory"
      : variancePercent < 0
        ? `${rounded}% below similar inventory`
        : `${rounded}% above similar ${billboard.qualityTier.toLowerCase()} screens`;
  return {
    sufficient: true as const,
    comparables,
    medianReserve,
    variancePercent,
    label,
  };
}
