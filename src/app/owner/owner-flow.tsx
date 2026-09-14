"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  billboards as seededBillboards,
  bids as seededBids,
  formatRupees,
  slots as seededSlots,
  type Slot,
} from "@/lib/data";
import { runAuction } from "@/lib/auction";
import type { StoredAuctionResult } from "@/lib/db";
import { PageIntro, StatusBadge, MetricCard } from "@/components/app-shell";
import {
  closeAuction,
  createSlots,
  deleteSlot,
  setSlotAvailability,
  updateSlot,
  type SlotInput,
} from "@/lib/actions";
import { partitionSlotCandidates, repeatDates } from "@/lib/inventory";
import { publishDataChange, subscribeToDataChanges } from "@/lib/live-sync";
import { BillboardForm } from "./billboard-form";
import { getOwnerInventoryRecommendations } from "@/lib/owner-inventory-recommendations";

type OwnerDashboard = {
  activeBillboards: number;
  availableSlots: number;
  openAuctions: number;
  soldSlots: number;
  ownerEarnings: number;
  upcomingSchedules: {
    slotId: string;
    billboardName: string;
    date: string;
    startTime: string;
    endTime: string;
    advertiserName: string;
    creativeName: string;
  }[];
};
type ViewMode = "day" | "week";
type ModalMode = "create" | "edit" | "ownerUse";
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hourStart = 6;
const hourHeight = 64;

function dateLabel(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
function shiftDate(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}
function shiftMonths(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + amount);
  return value.toISOString().slice(0, 10);
}
function weekDates(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - value.getUTCDay());
  return Array.from({ length: 7 }, (_, index) =>
    shiftDate(value.toISOString().slice(0, 10), index),
  );
}
function monthDates(date: string, excludedDates: string[]) {
  const value = new Date(`${date}T12:00:00Z`);
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Array.from(
    { length: days },
    (_, index) =>
      `${year}-${String(month + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
  ).filter((item) => !excludedDates.includes(item));
}
function slotEnd(time: string) {
  const hour = Number(time.slice(0, 2)) + 1;
  return `${String(hour).padStart(2, "0")}:00`;
}
const hourlyOptions = Array.from(
  { length: 17 },
  (_, index) => `${String(index + 6).padStart(2, "0")}:00`,
);
function datesForScope(
  form: ReturnType<typeof initialForm>,
  isEdit: boolean,
) {
  const excludedDates = form.excludedDates
    .split(",")
    .map((date) => date.trim())
    .filter(Boolean);
  return isEdit || form.releaseScope === "day"
    ? [form.date]
    : form.releaseScope === "month"
      ? monthDates(form.date, excludedDates)
      : repeatDates(
          form.date,
          form.repeatUntil || form.date,
          weekdays.map((_, day) => day).filter((day) => !form.excludedWeekdays.includes(day)),
        );
}
function buildSlotCandidates(
  form: ReturnType<typeof initialForm>,
  billboardId: string,
  baseInput: Omit<SlotInput, "date" | "startTime" | "endTime">,
  datesToCreate: string[],
) {
  return datesToCreate.flatMap((date) =>
    form.selectedHours.map((startTime) => ({
      ...baseInput,
      billboardId,
      date,
      startTime,
      endTime: slotEnd(startTime),
      auctionOpenTime:
        form.ownerUse || form.bidOpenImmediately
          ? undefined
          : `${datesToCreate.length > 1 ? date : form.auctionOpenDate}T${form.auctionOpenTime}:00+05:30`,
      auctionCloseTime: form.ownerUse
        ? undefined
        : `${datesToCreate.length > 1 ? date : form.auctionCloseDate}T${form.auctionCloseTime}:00+05:30`,
    })),
  );
}
function initialForm(mode: ModalMode, slot?: Slot) {
  return {
    releaseScope: "day" as "day" | "week" | "month",
    date: slot?.date ?? "2026-09-07",
    repeatUntil: slot?.date ?? "2026-09-13",
    selectedHours: [slot?.startTime ?? "19:00"],
    excludedWeekdays: [] as number[],
    excludedDates: "",
    auctionOpenDate:
      slot?.auctionOpenTime?.slice(0, 10) ?? slot?.date ?? "2026-09-07",
    auctionOpenTime: slot?.auctionOpenTime?.slice(11, 16) ?? "09:00",
    auctionCloseDate:
      slot?.auctionCloseTime?.slice(0, 10) ?? slot?.date ?? "2026-09-07",
    auctionCloseTime: slot?.auctionCloseTime?.slice(11, 16) ?? "18:55",
    bidOpenImmediately: !slot?.auctionOpenTime,
    reservePrice: String(slot?.reservePrice ?? 10000),
    minimumBidIncrement: String(slot?.minimumBidIncrement ?? 0),
    antiSnipingWindowMinutes: String(slot?.antiSnipingWindowMinutes ?? 5),
    antiSnipingExtensionMinutes: String(slot?.antiSnipingExtensionMinutes ?? 5),
    ownerUse: mode === "ownerUse" || slot?.ownerUse === true,
  };
}

export function OwnerFlow({
  initialBillboards = seededBillboards,
  initialSlots = seededSlots,
  initialBids = seededBids,
  initialResults = [],
  dashboard,
}: {
  initialBillboards?: typeof seededBillboards;
  initialSlots?: typeof seededSlots;
  initialBids?: typeof seededBids;
  initialResults?: StoredAuctionResult[];
  dashboard?: OwnerDashboard;
}) {
  const [selectedBillboardId, setSelectedBillboardId] = useState(
    initialBillboards[0].id,
  );
  const [billboards, setBillboards] = useState(initialBillboards);
  const [slots, setSlots] = useState(initialSlots);
  const [auctionResults, setAuctionResults] =
    useState<StoredAuctionResult[]>(initialResults);
  const [selectedDate, setSelectedDate] = useState("2026-09-07");
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [showCalendar, setShowCalendar] = useState(false);
  const [modal, setModal] = useState<{ mode: ModalMode; slot?: Slot } | null>(
    null,
  );
  const [form, setForm] = useState(initialForm("create"));
  const [notice, setNotice] = useState("");
  const [billboardModal, setBillboardModal] = useState<{
    billboard?: (typeof initialBillboards)[number];
  } | null>(null);
  const [quickReleaseBusy, setQuickReleaseBusy] = useState(false);
  const [quickReleaseHours, setQuickReleaseHours] = useState<string[]>(["19:00"]);
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(new Set());
  function toggleQuickReleaseHour(hour: string) {
    setQuickReleaseHours((current) =>
      current.includes(hour) ? current.filter((item) => item !== hour) : [...current, hour].sort(),
    );
  }
  function toggleSlotSelection(id: string) {
    setSelectedSlotIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  useEffect(() => subscribeToDataChanges(() => window.location.reload()), []);
  useEffect(() => setSelectedSlotIds(new Set()), [selectedBillboardId]);
  const selectedBillboard =
    billboards.find((billboard) => billboard.id === selectedBillboardId) ??
    billboards[0];
  const billboardSlots = useMemo(
    () => slots.filter((slot) => slot.billboardId === selectedBillboardId),
    [selectedBillboardId, slots],
  );
  const revocableSlots = useMemo(
    () => billboardSlots.filter((slot) => slot.status !== "sold" && slot.status !== "auction_open"),
    [billboardSlots],
  );
  const billboardStats = useMemo(() => {
    const slotIds = new Set(billboardSlots.map((slot) => slot.id));
    const sold = billboardSlots.filter((slot) => slot.status === "sold").length;
    const bidCount = initialBids.filter((bid) => slotIds.has(bid.slotId)).length;
    const payout = auctionResults
      .filter((result) => slotIds.has(result.slotId) && result.status === "sold")
      .reduce((sum, result) => sum + (result.ownerPayout ?? 0), 0);
    return {
      total: billboardSlots.length,
      fillRate: billboardSlots.length ? Math.round((sold / billboardSlots.length) * 100) : 0,
      bidCount,
      payout,
    };
  }, [billboardSlots, initialBids, auctionResults]);
  const dates = viewMode === "day" ? [selectedDate] : weekDates(selectedDate);
  const recommendations = useMemo(
    () =>
      getOwnerInventoryRecommendations({
        ownerId: billboards[0]?.ownerId ?? "user-owner",
        billboards,
        slots,
        bids: initialBids,
        results: auctionResults,
      }),
    [auctionResults, billboards, initialBids, slots],
  );

  const releasePreview = useMemo(() => {
    if (!modal || modal.mode === "edit" || form.ownerUse || !form.selectedHours.length)
      return null;
    const datesToCreate = datesForScope(form, false);
    if (!datesToCreate.length) return { count: 0, skipped: 0, error: null, dates: 0 };
    const baseInput = {
      billboardId: selectedBillboardId,
      reservePrice: Number(form.reservePrice) || 0,
      status: "available" as const,
    };
    const candidates = buildSlotCandidates(form, selectedBillboardId, baseInput, datesToCreate);
    try {
      const { accepted, skipped } = partitionSlotCandidates(candidates, slots);
      return { count: accepted.length, skipped: skipped.length, error: null, dates: datesToCreate.length };
    } catch (error) {
      return {
        count: 0,
        skipped: 0,
        error: error instanceof Error ? error.message : "Too many slots.",
        dates: datesToCreate.length,
      };
    }
  }, [modal, form, selectedBillboardId, slots]);

  function openModal(mode: ModalMode, slot?: Slot) {
    setForm(initialForm(mode, slot));
    setModal({ mode, slot });
    setNotice("");
  }
  function createRecommendedSlot(
    recommendation: (typeof recommendations)[number],
  ) {
    setSelectedBillboardId(recommendation.billboardId);
    const closeHour = Math.max(
      0,
      Number(recommendation.startTime.slice(0, 2)) - 1,
    );
    setForm({
      ...initialForm("create"),
      date: recommendation.date,
      selectedHours: [recommendation.startTime],
      reservePrice: String(recommendation.reservePrice),
      auctionOpenDate: recommendation.date,
      auctionCloseDate: recommendation.date,
      auctionCloseTime: `${String(closeHour).padStart(2, "0")}:55`,
      bidOpenImmediately: true,
    });
    setModal({ mode: "create" });
    setNotice("Recommendation loaded. Review and confirm before publishing.");
  }
  function setField(field: string, value: string | boolean | number[]) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  function toggleWeekday(day: number) {
    setForm((current) => ({
      ...current,
      excludedWeekdays: current.excludedWeekdays.includes(day)
        ? current.excludedWeekdays.filter((value) => value !== day)
        : [...current.excludedWeekdays, day].sort(),
    }));
  }
  function toggleHour(hour: string) {
    setForm((current) => ({
      ...current,
      selectedHours: current.selectedHours.includes(hour)
        ? current.selectedHours.filter((value) => value !== hour)
        : [...current.selectedHours, hour].sort(),
    }));
  }
  function clearingPrice(slot: Slot) {
    const result = auctionResults.find((item) => item.slotId === slot.id);
    if (result) return { amount: result.clearingPrice ?? 0, final: true };
    const bids = initialBids.filter((bid) => bid.slotId === slot.id);
    const outcome = runAuction(slot.reservePrice, bids);
    return outcome.clearingPrice === null
      ? null
      : { amount: outcome.clearingPrice, final: false };
  }
  async function closeEarly(slot: Slot) {
    if (
      !window.confirm(
        `Close bidding for ${slot.date} ${slot.startTime}–${slot.endTime} now? This will finalize the auction and schedule the winning creative.`,
      )
    )
      return;
    try {
      const result = await closeAuction(slot.id);
      setAuctionResults((current) =>
        current.some((item) => item.slotId === result.slotId)
          ? current
          : [...current, result],
      );
      setSlots((current) =>
        current.map((item) =>
          item.id === slot.id ? { ...item, status: result.status } : item,
        ),
      );
      publishDataChange("auction");
      setNotice(
        result.status === "sold"
          ? "Auction closed. Winning creative scheduled."
          : "Auction closed. Slot is unsold.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to close auction.",
      );
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reservePrice = form.ownerUse ? 0 : Number(form.reservePrice);
    if (
      !form.date ||
      !form.selectedHours.length ||
      (!form.ownerUse &&
        (!Number.isInteger(reservePrice) ||
          reservePrice <= 0 ||
          !form.auctionCloseDate ||
          !form.auctionCloseTime ||
          (!form.bidOpenImmediately &&
            (!form.auctionOpenDate || !form.auctionOpenTime))))
    ) {
      setNotice(
        "Choose at least one one-hour slot and complete the bid window.",
      );
      return;
    }
    const datesToCreate = datesForScope(form, modal?.mode === "edit");
    if (!datesToCreate.length) {
      setNotice("No release dates remain after exclusions.");
      return;
    }
    const baseInput: Omit<SlotInput, "date" | "startTime" | "endTime"> = {
      billboardId: selectedBillboardId,
      reservePrice,
      auctionOpenTime:
        form.ownerUse || form.bidOpenImmediately
          ? undefined
          : `${form.auctionOpenDate}T${form.auctionOpenTime}:00+05:30`,
      auctionCloseTime: form.ownerUse
        ? undefined
        : `${form.auctionCloseDate}T${form.auctionCloseTime}:00+05:30`,
      minimumBidIncrement: form.ownerUse
        ? undefined
        : Number(form.minimumBidIncrement),
      antiSnipingWindowMinutes: form.ownerUse
        ? undefined
        : Number(form.antiSnipingWindowMinutes),
      antiSnipingExtensionMinutes: form.ownerUse
        ? undefined
        : Number(form.antiSnipingExtensionMinutes),
      ownerUse: form.ownerUse,
      status: form.ownerUse ? "reserved" : "available",
    };
    try {
      if (modal?.mode === "edit" && modal.slot) {
        const firstHour = form.selectedHours[0] ?? "19:00";
        const updated = await updateSlot({
          ...baseInput,
          date: form.date,
          startTime: firstHour,
          endTime: slotEnd(firstHour),
          slotId: modal.slot.id,
        });
        setSlots((current) =>
          current.map((slot) => (slot.id === updated.id ? updated : slot)),
        );
        setNotice("Slot updated.");
      } else {
        const candidates = buildSlotCandidates(
          form,
          selectedBillboardId,
          baseInput,
          datesToCreate,
        );
        const { accepted, skipped } = partitionSlotCandidates(candidates, slots);
        if (!accepted.length) {
          setNotice("Every generated slot conflicts with existing inventory. Nothing was created.");
          return;
        }
        const created = await createSlots(accepted);
        setSlots((current) => [...created, ...current]);
        setNotice(
          `${created.length} slot${created.length === 1 ? "" : "s"} created.` +
            (skipped.length
              ? ` ${skipped.length} skipped due to overlap with existing inventory.`
              : ""),
        );
      }
      publishDataChange("inventory");
      setModal(null);
      setSelectedDate(form.date);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to save inventory.",
      );
    }
  }

  async function quickRelease(days: number, label: string) {
    const hours = quickReleaseHours.length ? quickReleaseHours : ["19:00"];
    const reservePrice = selectedBillboard.defaultReservePrice || 10000;
    const dates = Array.from({ length: days }, (_, index) => shiftDate(selectedDate, index));
    const candidates = dates.flatMap((date) =>
      hours.map((hour) => ({
        billboardId: selectedBillboardId,
        date,
        startTime: hour,
        endTime: slotEnd(hour),
        reservePrice,
        status: "available" as const,
        auctionCloseTime: `${date}T${hour}:00+05:30`,
      })),
    );
    setQuickReleaseBusy(true);
    try {
      const { accepted, skipped } = partitionSlotCandidates(candidates, slots);
      if (!accepted.length) {
        setNotice("Every slot in that range already exists — nothing new to release.");
        return;
      }
      const created = await createSlots(accepted);
      setSlots((current) => [...created, ...current]);
      publishDataChange("inventory");
      setNotice(
        `Released ${created.length} slot${created.length === 1 ? "" : "s"} for ${selectedBillboard.name} (${label.toLowerCase()}).` +
          (skipped.length ? ` ${skipped.length} skipped — already had inventory that day.` : ""),
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to release inventory.");
    } finally {
      setQuickReleaseBusy(false);
    }
  }

  async function bulkRevoke() {
    const ids = Array.from(selectedSlotIds);
    if (!ids.length) return;
    if (!window.confirm(`Revoke ${ids.length} inventory block${ids.length === 1 ? "" : "s"}? This can't be undone.`)) return;
    setQuickReleaseBusy(true);
    try {
      await Promise.all(ids.map((id) => deleteSlot(id)));
      publishDataChange("inventory");
      setSlots((current) => current.filter((item) => !selectedSlotIds.has(item.id)));
      setSelectedSlotIds(new Set());
      setNotice(`Revoked ${ids.length} inventory block${ids.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to revoke some slots.");
    } finally {
      setQuickReleaseBusy(false);
    }
  }

  async function remove(slot: Slot) {
    if (!window.confirm("Delete this inventory block?")) return;
    try {
      await deleteSlot(slot.id);
      publishDataChange("inventory");
      setSlots((current) => current.filter((item) => item.id !== slot.id));
      setNotice("Inventory block deleted.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to delete this slot.",
      );
    }
  }
  async function toggleAvailability(slot: Slot) {
    try {
      const updated = await setSlotAvailability(
        slot.id,
        slot.status !== "available",
      );
      publishDataChange("inventory");
      setSlots((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setNotice(
        updated.status === "available"
          ? "Slot published."
          : "Slot marked unavailable.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to update availability.",
      );
    }
  }

  return (
    <>
      <PageIntro
        eyebrow="Owner inventory calendar"
        title="Plan every screen moment."
        description="Create single or repeating inventory, reserve owner-use periods, and keep every billboard schedule conflict-free."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openModal("create")}
              className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"
            >
              + Create slots
            </button>
            <button
              type="button"
              onClick={() => setBillboardModal({})}
              className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-700"
            >
              + Add billboard
            </button>
            <button
              type="button"
              onClick={() => openModal("ownerUse")}
              className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700"
            >
              Block owner use
            </button>
          </div>
        }
      />
      {notice && (
        <div
          role="status"
          className="mb-6 flex items-center justify-between rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-800"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            className="text-cyan-600"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}
      {dashboard && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard label="Billboards" value={String(dashboard.activeBillboards)} detail="Active screens" accent="cyan" />
          <MetricCard label="Available" value={String(dashboard.availableSlots)} detail="Slots open to bid" accent="cyan" />
          <MetricCard label="Live auctions" value={String(dashboard.openAuctions)} detail="Closing soon" accent="orange" />
          <MetricCard label="Sold" value={String(dashboard.soldSlots)} detail="Slots cleared" accent="violet" />
          <MetricCard label="Earnings" value={formatRupees(dashboard.ownerEarnings)} detail="Net payout to date" accent="violet" />
        </div>
      )}
      <section className="mb-6 rounded-2xl border border-violet-100 bg-violet-50/50 p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">
              Inventory recommendations
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              Release the moments advertisers are most likely to value.
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Planning suggestions only. You review every slot and publish it
              yourself.
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-violet-700">
            Deterministic estimates
          </span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {recommendations.slice(0, 3).map((recommendation) => (
            <article
              key={`${recommendation.billboardId}-${recommendation.date}-${recommendation.startTime}`}
              className="rounded-xl bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">
                    {recommendation.billboardName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {recommendation.date} · {recommendation.startTime}–
                    {recommendation.endTime}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-black ${recommendation.expectedDemand === "High" ? "bg-emerald-50 text-emerald-700" : recommendation.expectedDemand === "Moderate" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}
                >
                  {recommendation.expectedDemand} demand
                </span>
              </div>
              <p className="mt-3 text-sm font-black text-slate-900">
                Indicative {formatRupees(recommendation.priceRange.lower)}–
                {formatRupees(recommendation.priceRange.upper)}
              </p>
              <p className="mt-2 min-h-10 text-xs leading-5 text-slate-600">
                {recommendation.reason}
              </p>
              <button
                type="button"
                onClick={() => createRecommendedSlot(recommendation)}
                className="mt-4 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white"
              >
                Create this slot
              </button>
            </article>
          ))}
        </div>
      </section>
      <div className="mt-8 grid gap-6 lg:grid-cols-[250px_1fr]">
        <section className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="font-bold">Your billboards</h2>
            <p className="mt-1 text-xs text-slate-400">
              {billboards.length} screens in Hyderabad
            </p>
          </div>
          <div className="space-y-1">
            {billboards.map((billboard) => (
              <button
                type="button"
                key={billboard.id}
                onClick={() => setSelectedBillboardId(billboard.id)}
                className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${selectedBillboardId === billboard.id ? "bg-slate-950 text-white" : "hover:bg-slate-50"}`}
              >
                {billboard.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={billboard.imageUrl}
                    alt=""
                    className="h-10 w-14 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="grid h-10 w-14 shrink-0 place-items-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-400">
                    No photo
                  </span>
                )}
                <span className="min-w-0">
                  <p className="truncate text-sm font-bold">{billboard.name}</p>
                  <p
                    className={`mt-1 truncate text-xs ${selectedBillboardId === billboard.id ? "text-white/55" : "text-slate-400"}`}
                  >
                    {billboard.area} · {billboard.qualityTier}
                    {billboard.verificationStatus && billboard.verificationStatus !== "verified"
                      ? ` · ${billboard.verificationStatus === "pending" ? "Pending verification" : "Verification rejected"}`
                      : ""}
                  </p>
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {selectedBillboard.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selectedBillboard.imageUrl}
              alt={selectedBillboard.name}
              className="h-40 w-full rounded-t-2xl object-cover"
            />
          )}
          <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
            <div className="px-4 py-3 text-center">
              <p className="text-lg font-bold">{billboardStats.total}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">Slots listed</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-lg font-bold">{billboardStats.fillRate}%</p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">Fill rate</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-lg font-bold">{billboardStats.bidCount}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">Total bids</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-lg font-bold">{formatRupees(billboardStats.payout)}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">Net payout</p>
            </div>
          </div>
          <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500">One-click release:</span>
              {hourlyOptions.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  onClick={() => toggleQuickReleaseHour(hour)}
                  aria-pressed={quickReleaseHours.includes(hour)}
                  className={`rounded-full border px-2 py-1 text-[11px] font-bold ${quickReleaseHours.includes(hour) ? "border-cyan-500 bg-cyan-50 text-cyan-800" : "border-slate-200 bg-white text-slate-500 hover:border-cyan-300"}`}
                >
                  {hour}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {[
                [7, "Next 7 days"],
                [14, "Next 2 weeks"],
                [30, "Next 30 days"],
              ].map(([days, label]) => (
                <button
                  key={label as string}
                  type="button"
                  disabled={quickReleaseBusy || !quickReleaseHours.length}
                  onClick={() => quickRelease(days as number, label as string)}
                  className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {quickReleaseBusy ? "Releasing…" : label}
                </button>
              ))}
              <span className="text-xs text-slate-400">
                {quickReleaseHours.length || "0"} hour block{quickReleaseHours.length === 1 ? "" : "s"}/day · reserve {formatRupees(selectedBillboard.defaultReservePrice || 10000)} · bidding opens immediately.
              </span>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-600">
                {selectedBillboard.area}
              </p>
              <h2 className="mt-1 text-xl font-bold">
                {selectedBillboard.name}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                {selectedBillboard.screenType} · {selectedBillboard.dimensions}{" "}
                ·{" "}
                {selectedBillboard.estimatedDailyTraffic.toLocaleString(
                  "en-IN",
                )}{" "}
                daily traffic
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setBillboardModal({ billboard: selectedBillboard })
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
              >
                Edit details
              </button>
              <button
                type="button"
                onClick={() => setViewMode("day")}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${viewMode === "day" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-500"}`}
              >
                Day
              </button>
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${viewMode === "week" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-500"}`}
              >
                Week
              </button>
            </div>
          </div>
          {billboardSlots.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-2.5">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={revocableSlots.length > 0 && revocableSlots.every((slot) => selectedSlotIds.has(slot.id))}
                  onChange={(event) =>
                    setSelectedSlotIds(event.target.checked ? new Set(revocableSlots.map((slot) => slot.id)) : new Set())
                  }
                  className="h-4 w-4 accent-red-500"
                />
                Select all revocable
              </label>
              <button
                type="button"
                disabled={!selectedSlotIds.size || quickReleaseBusy}
                onClick={bulkRevoke}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Revoke {selectedSlotIds.size || ""} selected
              </button>
              <span className="text-[11px] text-slate-400">Sold and auction-open slots can&apos;t be bulk revoked.</span>
            </div>
          )}
          <div className="divide-y divide-slate-100">
            {billboardSlots.length ? (
              billboardSlots
                .slice()
                .sort((a, b) =>
                  `${a.date}T${a.startTime}`.localeCompare(
                    `${b.date}T${b.startTime}`,
                  ),
                )
                .map((slot) => {
                  const revocable = slot.status !== "sold" && slot.status !== "auction_open";
                  return (
                  <div
                    key={slot.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        disabled={!revocable}
                        checked={selectedSlotIds.has(slot.id)}
                        onChange={() => toggleSlotSelection(slot.id)}
                        className="h-4 w-4 accent-red-500 disabled:opacity-30"
                      />
                      <div>
                      <p className="text-sm font-bold">
                        {slot.date} · {slot.startTime}–{slot.endTime}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {slot.ownerUse
                          ? "Owner use period"
                          : `Reserve ${formatRupees(slot.reservePrice)}`}
                      </p>
                      {clearingPrice(slot) && (
                        <p
                          className={
                            clearingPrice(slot)?.final
                              ? "mt-1 text-xs font-bold text-cyan-700"
                              : "mt-1 text-xs font-medium italic text-slate-400"
                          }
                        >
                          {clearingPrice(slot)?.final
                            ? "Clearing price"
                            : "Projected clearing (not final — may change until auction closes)"}{" "}
                          · {formatRupees(clearingPrice(slot)?.amount ?? 0)}
                        </p>
                      )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={slot.status} />
                      {slot.status === "auction_open" && (
                        <button
                          type="button"
                          onClick={() => closeEarly(slot)}
                          className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950"
                        >
                          Close auction
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openModal("edit", slot)}
                        disabled={
                          slot.status === "sold" ||
                          slot.status === "auction_open"
                        }
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-40"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                  );
                })
            ) : (
              <div className="px-5 py-10 text-center text-sm text-slate-500">
                No inventory for this billboard yet.
              </div>
            )}
          </div>
          <div className="flex justify-end border-t border-slate-100 p-4">
            <button
              type="button"
              onClick={() => setShowCalendar(true)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
            >
              Open calendar view
            </button>
          </div>
        </section>
      </div>
      {dashboard?.upcomingSchedules.length ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-600">
                Upcoming schedules
              </p>
              <h2 className="mt-1 text-lg font-bold">What is playing next</h2>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {dashboard.upcomingSchedules.length} placements
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {dashboard.upcomingSchedules.map((schedule) => (
              <div key={schedule.slotId} className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">
                      {schedule.billboardName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {schedule.date} · {schedule.startTime}–{schedule.endTime}
                    </p>
                  </div>
                  <StatusBadge status="sold" />
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-600">
                  {schedule.advertiserName} · {schedule.creativeName}
                </p>
                <Link
                  href={`/proof-of-play/${schedule.slotId}`}
                  className="mt-3 inline-block text-xs font-bold text-cyan-700"
                >
                  View proof of play →
                </Link>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6">
          <p className="text-sm font-bold">No upcoming placements yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Cleared winning creatives will appear here once auctions settle.
          </p>
        </section>
      )}
      {showCalendar && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-600">
                  Calendar view
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  {selectedBillboard.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCalendar(false)}
                className="text-2xl leading-none text-slate-400"
                aria-label="Close calendar"
              >
                ×
              </button>
            </div>
            <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <button
                type="button"
                onClick={() =>
                  setSelectedDate(
                    shiftDate(selectedDate, viewMode === "week" ? -7 : -1),
                  )
                }
                className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-white"
              >
                ← Previous
              </button>
              <p className="text-sm font-bold">
                {viewMode === "day"
                  ? dateLabel(selectedDate)
                  : `${dateLabel(dates[0])} – ${dateLabel(dates[6])}`}
              </p>
              <button
                type="button"
                onClick={() =>
                  setSelectedDate(
                    shiftDate(selectedDate, viewMode === "week" ? 7 : 1),
                  )
                }
                className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-white"
              >
                Next →
              </button>
            </div>
            <Calendar
              dates={dates}
              slots={billboardSlots}
              onCreate={(date) => {
                setSelectedDate(date);
                setShowCalendar(false);
                openModal("create");
              }}
              onEdit={(slot) => {
                setShowCalendar(false);
                openModal("edit", slot);
              }}
              onDelete={remove}
              onToggleAvailability={toggleAvailability}
            />
          </div>
        </div>
      )}
      {modal && (
        <SlotModal
          mode={modal.mode}
          form={form}
          setField={setField}
          toggleWeekday={toggleWeekday}
          toggleHour={toggleHour}
          onClose={() => setModal(null)}
          onSubmit={save}
          preview={releasePreview}
        />
      )}{" "}
      {billboardModal && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/40 p-5 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-600">
                  Billboard onboarding
                </p>
                <h2 className="mt-2 text-2xl font-bold">
                  {billboardModal.billboard
                    ? "Edit billboard details"
                    : "Add a billboard"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Keep the screen profile accurate for advertisers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBillboardModal(null)}
                className="text-2xl leading-none text-slate-400"
                aria-label="Close billboard form"
              >
                ×
              </button>
            </div>
            <BillboardForm
              key={billboardModal.billboard?.id ?? "new"}
              initial={billboardModal.billboard}
              onCancel={() => setBillboardModal(null)}
              onSaved={(saved) => {
                setBillboards((current) =>
                  billboardModal.billboard
                    ? current.map((item) =>
                        item.id === saved.id ? saved : item,
                      )
                    : [...current, saved],
                );
                setSelectedBillboardId(saved.id);
                setBillboardModal(null);
                setNotice("Billboard saved.");
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

function SlotModal({
  mode,
  form,
  setField,
  toggleWeekday,
  toggleHour,
  onClose,
  onSubmit,
  preview,
}: {
  mode: ModalMode;
  form: ReturnType<typeof initialForm>;
  setField: (field: string, value: string | boolean | number[]) => void;
  toggleWeekday: (day: number) => void;
  toggleHour: (hour: string) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  preview: { count: number; skipped: number; error: string | null; dates: number } | null;
}) {
  const ownerUse = mode === "ownerUse" || form.ownerUse;
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/40 p-5 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-600">
              {mode === "edit"
                ? "Edit inventory"
                : ownerUse
                  ? "Block owner use"
                  : "Release inventory"}
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              {mode === "edit"
                ? "Update time block"
                : ownerUse
                  ? "Reserve a private period"
                  : "Release inventory"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {ownerUse
                ? "This period will not appear in the advertiser marketplace."
                : "Choose dates and one-hour blocks. Longer selections are saved as separate hourly slots."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-slate-400"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={form.releaseScope === "month" ? "Month" : "Start date"}
              type="date"
              value={form.date}
              onChange={(value) => setField("date", value)}
            />
            {form.releaseScope === "week" && (
              <div>
                <Field
                  label="End date"
                  type="date"
                  value={form.repeatUntil}
                  onChange={(value) => setField("repeatUntil", value)}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    ["1 week", () => shiftDate(form.date, 7)],
                    ["2 weeks", () => shiftDate(form.date, 14)],
                    ["3 weeks", () => shiftDate(form.date, 21)],
                    ["1 month", () => shiftMonths(form.date, 1)],
                    ["2 months", () => shiftMonths(form.date, 2)],
                    ["3 months", () => shiftMonths(form.date, 3)],
                  ].map(([label, compute]) => (
                    <button
                      type="button"
                      key={label as string}
                      onClick={() => setField("repeatUntil", (compute as () => string)())}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:border-cyan-300 hover:text-cyan-700"
                    >
                      {label as string}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!ownerUse && (
              <Field
                label="Reserve price"
                type="number"
                value={form.reservePrice}
                onChange={(value) => setField("reservePrice", value)}
              />
            )}
          </div>
          {mode !== "edit" && !ownerUse && (
            <div>
              <p className="text-sm font-bold">Release pattern</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {[
                  ["day", "One day", "Single date"],
                  ["week", "Date range", "Up to 6 months, pick weekdays"],
                  ["month", "Month", "All days, exclude dates"],
                ].map(([value, label, detail]) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setField("releaseScope", value)}
                    className={`rounded-xl border p-3 text-left ${form.releaseScope === value ? "border-cyan-500 bg-cyan-50" : "border-slate-200 bg-white"}`}
                  >
                    <p className="text-sm font-bold">{label}</p>
                    <p className="mt-1 text-xs text-slate-500">{detail}</p>
                  </button>
                ))}
              </div>
              {form.releaseScope === "week" && (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Days of week
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      ["Every day", []],
                      ["Weekdays", [0, 6]],
                      ["Weekends", [1, 2, 3, 4, 5]],
                    ].map(([label, excluded]) => (
                      <button
                        type="button"
                        key={label as string}
                        onClick={() => setField("excludedWeekdays", excluded as number[])}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:border-cyan-300"
                      >
                        {label as string}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Exclude weekdays
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {weekdays.map((day, index) => (
                      <button
                        type="button"
                        key={day}
                        onClick={() => toggleWeekday(index)}
                        className={`rounded-lg px-3 py-2 text-xs font-bold ${form.excludedWeekdays.includes(index) ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"}`}
                      >
                        {form.excludedWeekdays.includes(index)
                          ? `× ${day}`
                          : day}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {form.releaseScope === "month" && (
                <label className="mt-4 block text-sm font-bold">
                  Exclude dates
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    Comma-separated dates, for example 2026-09-10, 2026-09-24
                  </span>
                  <input
                    type="text"
                    value={form.excludedDates}
                    onChange={(event) =>
                      setField("excludedDates", event.target.value)
                    }
                    placeholder="YYYY-MM-DD, YYYY-MM-DD"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-cyan-500"
                  />
                </label>
              )}
            </div>
          )}
          {
            <div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm font-bold">Hourly inventory blocks</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Each selected block becomes one 60-minute slot.
                  </p>
                </div>
                <span className="text-xs font-bold text-cyan-700">
                  {form.selectedHours.length} hour
                  {form.selectedHours.length === 1 ? "" : "s"} selected
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {hourlyOptions.map((hour) => (
                  <button
                    type="button"
                    key={hour}
                    onClick={() => toggleHour(hour)}
                    aria-pressed={form.selectedHours.includes(hour)}
                    className={`rounded-lg border px-3 py-3 text-sm font-bold ${form.selectedHours.includes(hour) ? "border-cyan-500 bg-cyan-50 text-cyan-800" : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300"}`}
                  >
                    {hour}–{slotEnd(hour)}
                  </button>
                ))}
              </div>
            </div>
          }
          {!ownerUse && (
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Bid window
              </p>
              <label className="mt-3 flex items-center gap-3 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={form.bidOpenImmediately}
                  onChange={(event) =>
                    setField("bidOpenImmediately", event.target.checked)
                  }
                  className="h-4 w-4 accent-cyan-600"
                />
                Open bidding immediately
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Recommended for quick launches. Turn this off to schedule a
                custom bid opening.
              </p>
              {!form.bidOpenImmediately && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Bid opens · date"
                    type="date"
                    value={form.auctionOpenDate}
                    onChange={(value) => setField("auctionOpenDate", value)}
                  />
                  <Field
                    label="Bid opens · time"
                    type="time"
                    value={form.auctionOpenTime}
                    onChange={(value) => setField("auctionOpenTime", value)}
                  />
                </div>
              )}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Bid closes · date"
                  type="date"
                  value={form.auctionCloseDate}
                  onChange={(value) => setField("auctionCloseDate", value)}
                />
                <Field
                  label="Bid closes · time"
                  type="time"
                  value={form.auctionCloseTime}
                  onChange={(value) => setField("auctionCloseTime", value)}
                />
                <Field
                  label="Minimum increment"
                  type="number"
                  value={form.minimumBidIncrement}
                  onChange={(value) => setField("minimumBidIncrement", value)}
                />
                <Field
                  label="Anti-sniping window (min)"
                  type="number"
                  value={form.antiSnipingWindowMinutes}
                  onChange={(value) =>
                    setField("antiSnipingWindowMinutes", value)
                  }
                />
                <Field
                  label="Extension (min)"
                  type="number"
                  value={form.antiSnipingExtensionMinutes}
                  onChange={(value) =>
                    setField("antiSnipingExtensionMinutes", value)
                  }
                />
              </div>
            </div>
          )}
          {preview && (
            <div
              className={`rounded-xl p-4 text-sm font-bold ${preview.error ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}
            >
              {preview.error
                ? preview.error
                : `This will create ${preview.count} slot${preview.count === 1 ? "" : "s"} across ${preview.dates} day${preview.dates === 1 ? "" : "s"}.` +
                  (preview.skipped
                    ? ` ${preview.skipped} skipped due to overlap with existing inventory.`
                    : "")}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={Boolean(preview?.error) || preview?.count === 0}
              className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {mode === "edit"
                ? "Save changes"
                : ownerUse
                  ? "Block period"
                  : "Release inventory"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
function Calendar({
  dates,
  slots,
  onCreate,
  onEdit,
  onDelete,
  onToggleAvailability,
}: {
  dates: string[];
  slots: Slot[];
  onCreate: (date: string) => void;
  onEdit: (slot: Slot) => void;
  onDelete: (slot: Slot) => void;
  onToggleAvailability: (slot: Slot) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div
          className="grid border-b border-slate-100"
          style={{
            gridTemplateColumns: `58px repeat(${dates.length}, minmax(100px, 1fr))`,
          }}
        >
          {" "}
          <div />
          {dates.map((date) => (
            <button
              type="button"
              key={date}
              onClick={() => onCreate(date)}
              className="border-l border-slate-100 px-2 py-3 text-center hover:bg-cyan-50"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {weekdays[new Date(`${date}T12:00:00Z`).getUTCDay()]}
              </p>
              <p className="mt-1 text-sm font-black">{date.slice(8)}</p>
            </button>
          ))}
        </div>
        <div
          className="grid"
          style={{
            gridTemplateColumns: `58px repeat(${dates.length}, minmax(100px, 1fr))`,
          }}
        >
          <div className="relative" style={{ height: `${18 * hourHeight}px` }}>
            {Array.from({ length: 18 }, (_, index) => (
              <span
                key={index}
                className="absolute right-2 text-[10px] text-slate-400"
                style={{ top: `${index * hourHeight - 6}px` }}
              >
                {String(hourStart + index).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {dates.map((date) => (
            <div
              key={date}
              className="relative border-l border-slate-100"
              style={{ height: `${18 * hourHeight}px` }}
              onDoubleClick={() => onCreate(date)}
            >
              {Array.from({ length: 18 }, (_, index) => (
                <div
                  key={index}
                  className="absolute left-0 right-0 border-t border-slate-100"
                  style={{ top: `${index * hourHeight}px` }}
                />
              ))}
              {slots
                .filter((slot) => slot.date === date)
                .map((slot) => (
                  <CalendarBlock
                    key={slot.id}
                    slot={slot}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggleAvailability={onToggleAvailability}
                  />
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CalendarBlock({
  slot,
  onEdit,
  onDelete,
  onToggleAvailability,
}: {
  slot: Slot;
  onEdit: (slot: Slot) => void;
  onDelete: (slot: Slot) => void;
  onToggleAvailability: (slot: Slot) => void;
}) {
  const start =
    Number(slot.startTime.slice(0, 2)) * 60 + Number(slot.startTime.slice(3));
  const end =
    Number(slot.endTime.slice(0, 2)) * 60 + Number(slot.endTime.slice(3));
  const top = Math.max(0, ((start - hourStart * 60) / 60) * hourHeight);
  const height = Math.max(38, ((end - start) / 60) * hourHeight);
  const colors: Record<string, string> = {
    available: "border-emerald-300 bg-emerald-50 text-emerald-900",
    auction_open: "border-amber-300 bg-amber-50 text-amber-900",
    sold: "border-cyan-300 bg-cyan-50 text-cyan-900",
    reserved: "border-violet-300 bg-violet-50 text-violet-900",
    unavailable: "border-slate-300 bg-slate-100 text-slate-600",
    unsold: "border-slate-300 bg-slate-50 text-slate-700",
  };
  const locked = slot.status === "sold" || slot.status === "auction_open";
  return (
    <div
      className={`group absolute left-1 right-1 z-10 overflow-hidden rounded-lg border p-2 text-left shadow-sm ${colors[slot.status]}`}
      style={{ top, height }}
    >
      <button
        type="button"
        onClick={() => onEdit(slot)}
        className="block w-full text-left"
        disabled={locked}
      >
        <p className="truncate text-[11px] font-black">
          {slot.startTime}–{slot.endTime}
        </p>
        <p className="truncate text-[10px] font-bold">
          {slot.ownerUse ? "Owner use" : formatRupees(slot.reservePrice)}
        </p>
        <StatusBadge status={slot.status} />
      </button>
      <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
        <button
          type="button"
          onClick={() => onEdit(slot)}
          disabled={locked}
          className="rounded bg-white/80 px-1 text-[10px] font-bold"
          aria-label="Edit slot"
        >
          ✎
        </button>
        <button
          type="button"
          onClick={() => onToggleAvailability(slot)}
          disabled={locked || slot.status === "reserved"}
          className="rounded bg-white/80 px-1 text-[10px] font-bold"
          aria-label="Toggle slot availability"
        >
          {slot.status === "available" ? "×" : "✓"}
        </button>
        <button
          type="button"
          onClick={() => onDelete(slot)}
          disabled={locked}
          className="rounded bg-white/80 px-1 text-[10px] font-bold text-red-600"
          aria-label="Delete slot"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-bold">
      {label}
      <input
        required
        type={type}
        min={type === "number" ? "0" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-cyan-500"
      />
    </label>
  );
}
