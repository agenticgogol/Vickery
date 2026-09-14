import type { Slot } from "./data";

export function slotsOverlap(a: Pick<Slot, "date" | "startTime" | "endTime">, b: Pick<Slot, "date" | "startTime" | "endTime">) {
  return a.date === b.date && a.startTime < b.endTime && a.endTime > b.startTime;
}

export function hasSlotOverlap(candidate: Pick<Slot, "billboardId" | "date" | "startTime" | "endTime">, slots: readonly Slot[], ignoreSlotId?: string) {
  return slots.some((slot) => slot.id !== ignoreSlotId && slot.billboardId === candidate.billboardId && slotsOverlap(candidate, slot));
}

export function repeatDates(startDate: string, endDate: string, weekdays: number[]) {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  while (cursor <= end) {
    if (weekdays.includes(cursor.getUTCDay())) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export const MAX_RECURRING_SLOTS = 2000;

/**
 * Splits recurring-slot candidates into ones that can be created and ones that
 * overlap an existing slot (or another candidate in the same batch) on the
 * same billboard. Throws if the candidate count exceeds MAX_RECURRING_SLOTS
 * so a wide date range × many time blocks fails fast instead of hammering the DB.
 */
export function partitionSlotCandidates<
  T extends Pick<Slot, "billboardId" | "date" | "startTime" | "endTime">,
>(candidates: readonly T[], existingSlots: readonly Slot[]) {
  if (candidates.length > MAX_RECURRING_SLOTS)
    throw new Error(
      `This would create ${candidates.length} slots, which is over the ${MAX_RECURRING_SLOTS} limit. Narrow the date range or time blocks.`,
    );
  const accepted: T[] = [];
  const skipped: T[] = [];
  for (const candidate of candidates) {
    const overlapsBatch = accepted.some(
      (item) => item.billboardId === candidate.billboardId && slotsOverlap(candidate, item),
    );
    if (overlapsBatch || hasSlotOverlap(candidate, existingSlots)) skipped.push(candidate);
    else accepted.push(candidate);
  }
  return { accepted, skipped };
}
