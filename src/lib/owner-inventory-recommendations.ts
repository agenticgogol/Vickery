import type { StoredAuctionResult } from "./db";
import type { Bid, Billboard, Slot } from "./data";
import {
  comparableInventoryConfig,
  getComparableInventoryPrice,
} from "./comparable-inventory";
import { getTimeOfDay } from "./marketplace";

export const ownerRecommendationConfig = {
  candidateHours: [17, 18, 19],
  horizonDays: 7,
  priceRangePercent: 0.2,
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}
function time(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function getOwnerInventoryRecommendations({
  ownerId,
  billboards,
  slots,
  bids,
  results,
  now = new Date("2026-09-05T12:00:00Z"),
}: {
  ownerId: string;
  billboards: Billboard[];
  slots: Slot[];
  bids: Bid[];
  results: StoredAuctionResult[];
  now?: Date;
}) {
  const ownerBillboards = billboards.filter(
    (billboard) => billboard.ownerId === ownerId && billboard.active !== false,
  );
  const recommendations = ownerBillboards
    .flatMap((billboard) =>
      Array.from(
        { length: ownerRecommendationConfig.horizonDays },
        (_, offset) => {
          const date = addDays(now, offset + 1);
          const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
          return ownerRecommendationConfig.candidateHours.map((hour) => {
            const startTime = time(hour);
            const endTime = time(hour + 1);
            const overlaps = slots.some(
              (slot) =>
                slot.billboardId === billboard.id &&
                slot.date === date &&
                slot.startTime < endTime &&
                slot.endTime > startTime,
            );
            if (overlaps) return null;
            const historical = slots.filter(
              (slot) =>
                new Date(`${slot.date}T12:00:00Z`).getUTCDay() === weekday &&
                getTimeOfDay(slot.startTime) === getTimeOfDay(startTime),
            );
            const settled = historical.filter((slot) =>
              results.some((result) => result.slotId === slot.id),
            );
            const sold = settled.filter(
              (slot) =>
                results.find((result) => result.slotId === slot.id)?.status ===
                "sold",
            );
            const fillRate = settled.length
              ? sold.length / settled.length
              : null;
            const cleared = sold
              .map(
                (slot) =>
                  results.find((result) => result.slotId === slot.id)
                    ?.clearingPrice ?? 0,
              )
              .filter(Boolean);
            const averageClearingPrice = cleared.length
              ? cleared.reduce((sum, value) => sum + value, 0) / cleared.length
              : null;
            const similarOpenSlots = slots.filter(
              (slot) =>
                billboards.find((screen) => screen.id === slot.billboardId)
                  ?.area === billboard.area &&
                getTimeOfDay(slot.startTime) === getTimeOfDay(startTime),
            );
            const uniqueBidders = new Set(
              bids
                .filter((bid) =>
                  similarOpenSlots.some((slot) => slot.id === bid.slotId),
                )
                .map((bid) => bid.advertiserId),
            ).size;
            const hypothetical: Slot = {
              id: `recommendation-${billboard.id}-${date}-${startTime}`,
              billboardId: billboard.id,
              date,
              startTime,
              endTime,
              reservePrice: Math.round(
                averageClearingPrice ?? billboard.defaultReservePrice ?? 10000,
              ),
              status: "available",
            };
            const comparable = getComparableInventoryPrice(
              hypothetical,
              billboards,
              slots,
              comparableInventoryConfig,
            );
            const anchor =
              averageClearingPrice ??
              comparable.medianReserve ??
              billboard.defaultReservePrice ??
              10000;
            const demandScore = Math.round(
              Math.min(
                100,
                (fillRate ?? 0.45) * 45 +
                  (Math.min(uniqueBidders, 4) / 4) * 35 +
                  (hour >= 17 && hour <= 19 ? 20 : 0),
              ),
            );
            const expectedDemand =
              demandScore >= 70
                ? "High"
                : demandScore >= 40
                  ? "Moderate"
                  : "Low";
            const lower =
              Math.round(
                (anchor * (expectedDemand === "High" ? 0.95 : 0.8)) / 500,
              ) * 500;
            const upper =
              Math.round(
                (anchor * (expectedDemand === "High" ? 1.25 : 1)) / 500,
              ) * 500;
            const dayLabel = new Date(`${date}T12:00:00Z`).toLocaleDateString(
              "en-IN",
              { weekday: "long" },
            );
            const reason =
              expectedDemand === "High"
                ? `${dayLabel} ${startTime}–${endTime} has strong observable demand: ${uniqueBidders || "limited"} recent marketplace bidders and ${fillRate === null ? "no settled history yet" : `${Math.round(fillRate * 100)}% historical fill`}.`
                : expectedDemand === "Low"
                  ? `${dayLabel} ${startTime}–${endTime} shows weaker observed demand. Consider starting near the lower end of the indicative range.`
                  : `${dayLabel} ${startTime}–${endTime} has balanced demand signals from similar area/time inventory.`;
            return {
              billboardId: billboard.id,
              billboardName: billboard.name,
              area: billboard.area,
              date,
              startTime,
              endTime,
              reservePrice: lower,
              expectedDemand,
              demandScore,
              priceRange: { lower, upper },
              fillRate,
              averageClearingPrice,
              comparableCount: comparable.comparables.length,
              reason,
            };
          });
        },
      ).flat(),
    )
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  return recommendations
    .sort(
      (a, b) =>
        b.demandScore - a.demandScore ||
        a.date.localeCompare(b.date) ||
        a.startTime.localeCompare(b.startTime),
    )
    .slice(0, 6);
}
