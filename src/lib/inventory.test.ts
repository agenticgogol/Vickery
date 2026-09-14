import { describe, expect, it } from "vitest";
import { MAX_RECURRING_SLOTS, partitionSlotCandidates, repeatDates } from "./inventory";
import { slots } from "./data";

describe("repeatDates", () => {
  it("includes only the requested weekdays within the range, inclusive", () => {
    // 2026-09-07 is a Monday
    expect(repeatDates("2026-09-07", "2026-09-13", [1, 3])).toEqual([
      "2026-09-07",
      "2026-09-09",
    ]);
  });
});

describe("partitionSlotCandidates", () => {
  const base = slots[0];

  it("accepts all candidates when nothing overlaps", () => {
    const candidates = [
      { billboardId: base.billboardId, date: "2026-09-01", startTime: "18:00", endTime: "19:00" },
      { billboardId: base.billboardId, date: "2026-09-02", startTime: "18:00", endTime: "19:00" },
    ];
    const { accepted, skipped } = partitionSlotCandidates(candidates, []);
    expect(accepted).toHaveLength(2);
    expect(skipped).toHaveLength(0);
  });

  it("skips a candidate that overlaps an existing slot on the same billboard", () => {
    const candidates = [
      { billboardId: base.billboardId, date: base.date, startTime: base.startTime, endTime: base.endTime },
    ];
    const { accepted, skipped } = partitionSlotCandidates(candidates, [base]);
    expect(accepted).toHaveLength(0);
    expect(skipped).toHaveLength(1);
  });

  it("skips a candidate that overlaps another candidate already accepted in the same batch", () => {
    const candidates = [
      { billboardId: "b1", date: "2026-09-01", startTime: "18:00", endTime: "19:00" },
      { billboardId: "b1", date: "2026-09-01", startTime: "18:30", endTime: "19:30" },
    ];
    const { accepted, skipped } = partitionSlotCandidates(candidates, []);
    expect(accepted).toHaveLength(1);
    expect(skipped).toHaveLength(1);
  });

  it("throws when the candidate count exceeds the cap", () => {
    const candidates = Array.from({ length: MAX_RECURRING_SLOTS + 1 }, (_, index) => ({
      billboardId: "b1",
      date: "2026-09-01",
      startTime: "18:00",
      endTime: "19:00",
      id: `x${index}`,
    }));
    expect(() => partitionSlotCandidates(candidates, [])).toThrow(/over the/);
  });
});
