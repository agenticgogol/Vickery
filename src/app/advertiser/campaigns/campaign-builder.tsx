"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { Advertiser, Billboard, Creative, Slot } from "@/lib/data";
import { formatRupees } from "@/lib/data";
import { getMatchingSlots } from "@/lib/campaign";
import { getAudienceTags, getTimeOfDay } from "@/lib/marketplace";
import {
  runCampaignAutoBid,
  saveDraftCampaign,
  submitBid,
} from "@/lib/actions";
import { publishDataChange } from "@/lib/live-sync";
import { estimateSelectedSlots } from "@/lib/reach-estimator";
import { getCampaignFitScore } from "@/lib/campaign-fit";
import { buildInventoryBundles } from "@/lib/inventory-bundles";
import { getCurrentAuctionState } from "@/lib/bid-status";
import { aggregateQualifiedReach } from "@/lib/qualified-reach-efficiency";

const timeOptions = ["Morning", "Afternoon", "Evening", "Late night"];

export function CampaignBuilder({
  slots,
  billboards,
  creatives,
  advertisers,
  initialSlotIds = [],
}: {
  slots: Slot[];
  billboards: Billboard[];
  creatives: Creative[];
  advertisers: Advertiser[];
  initialSlotIds?: string[];
}) {
  const [advertiserId, setAdvertiserId] = useState(
    advertisers[1]?.id ?? advertisers[0]?.id ?? "",
  );
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("50000");
  const [startDate, setStartDate] = useState("2026-09-06");
  const [endDate, setEndDate] = useState("2026-09-13");
  const [areas, setAreas] = useState<string[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const [audiences, setAudiences] = useState<string[]>([]);
  const [quality, setQuality] = useState<"Any" | "Premium" | "Standard">("Any");
  const [creativeId, setCreativeId] = useState(
    creatives.find(
      (creative) =>
        creative.advertiserId === (advertisers[1]?.id ?? advertisers[0]?.id) &&
        (creative.status ?? "approved") === "approved",
    )?.id ?? "",
  );
  const [selected, setSelected] = useState<string[]>(() =>
    initialSlotIds.filter((slotId) => slots.some((slot) => slot.id === slotId)),
  );
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [buyingMode, setBuyingModeState] = useState<"manual" | "auto">("auto");
  const [modeTouched, setModeTouched] = useState(false);
  const [maxBidPerSlot, setMaxBidPerSlot] = useState("15000");
  const [savedCampaignId, setSavedCampaignId] = useState("");
  const [message, setMessage] = useState("");
  const [workflowStep, setWorkflowStep] = useState<1 | 2 | 3 | 4>(
    initialSlotIds.length ? 3 : 1,
  );
  const [submittedBidCount, setSubmittedBidCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const areaOptions = Array.from(
    new Set(billboards.map((billboard) => billboard.area)),
  ).sort();
  const audienceOptions = Array.from(
    new Set(billboards.flatMap((billboard) => getAudienceTags(billboard))),
  ).sort();
  const matching = useMemo(
    () =>
      getMatchingSlots(
        {
          totalBudget: Number(budget),
          startDate,
          endDate,
          preferredAreas: areas,
          preferredTimeWindows: times,
          audienceTags: audiences,
          qualityTier: quality,
        },
        slots,
        billboards,
      ),
    [
      areas,
      audiences,
      billboards,
      budget,
      endDate,
      quality,
      slots,
      startDate,
      times,
    ],
  );
  const selectedEstimate = useMemo(
    () =>
      estimateSelectedSlots(
        selected
          .map((slotId) => {
            const slot = slots.find((item) => item.id === slotId);
            const billboard = slot
              ? billboards.find((item) => item.id === slot.billboardId)
              : undefined;
            return slot && billboard
              ? {
                  slot,
                  billboard,
                  cost: Number(bidAmounts[slotId]) || slot.reservePrice,
                }
              : null;
          })
          .filter(
            (
              item,
            ): item is { slot: Slot; billboard: Billboard; cost: number } =>
              Boolean(item),
          ),
      ),
    [billboards, bidAmounts, selected, slots],
  );
  const selectedQualifiedReach = useMemo(
    () =>
      aggregateQualifiedReach(
        selected
          .map((slotId) => {
            const slot = slots.find((item) => item.id === slotId);
            return slot
              ? {
                  slot,
                  billboard: billboards.find(
                    (item) => item.id === slot.billboardId,
                  ),
                  input: {
                    expectedCost:
                      Number(bidAmounts[slotId]) || slot.reservePrice,
                    targetAudienceTags: audiences,
                    preferredTimeWindows: times,
                  },
                }
              : null;
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item)),
      ),
    [audiences, bidAmounts, billboards, selected, slots, times],
  );
  const approvedCreatives = creatives.filter(
    (creative) =>
      creative.advertiserId === advertiserId &&
      (creative.status ?? "approved") === "approved",
  );
  const briefReady = Boolean(
    name.trim() && Number(budget) > 0 && startDate && endDate && creativeId,
  );
  const hasFitPreferences =
    areas.length > 0 ||
    times.length > 0 ||
    audiences.length > 0 ||
    quality !== "Any";
  // Auto-bid is the default landing mode (nudged from the marketplace) — stays selected until
  // the advertiser deliberately picks manual themselves. Preferences set → still recommend
  // auto-bid, just via the badge below rather than force-switching anything.
  function setBuyingMode(mode: "manual" | "auto") {
    setModeTouched(true);
    setBuyingModeState(mode);
  }
  const recommendedMode = hasFitPreferences ? "auto" : "manual";
  const fitResults = useMemo(
    () =>
      Object.fromEntries(
        matching.map((slot) => [
          slot.id,
          getCampaignFitScore(
            slot,
            billboards.find((billboard) => billboard.id === slot.billboardId),
            {
              preferredAreas: areas,
              audienceTags: audiences,
              preferredTimeWindows: times,
              qualityPreference: quality,
              maxReserve: Number(budget),
              objective: "reach",
            },
          ),
        ]),
      ),
    [areas, audiences, billboards, budget, matching, quality, times],
  );
  const campaignBundles = useMemo(
    () => buildInventoryBundles(matching, billboards),
    [billboards, matching],
  );
  const auctionStates = useMemo(
    () =>
      Object.fromEntries(
        slots.map((slot) => [slot.id, getCurrentAuctionState(slot)]),
      ),
    [slots],
  );
  const selectedAuctionsOpen = selected.every((slotId) => {
    const state = auctionStates[slotId];
    return state === "open" || state === "closing";
  });
  const autoBidReady =
    briefReady &&
    hasFitPreferences &&
    Number.isInteger(Number(maxBidPerSlot)) &&
    Number(maxBidPerSlot) > 0;
  function toggle(
    value: string,
    values: string[],
    setter: (next: string[]) => void,
  ) {
    setter(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    );
  }
  function changeAdvertiser(value: string) {
    setAdvertiserId(value);
    setCreativeId(
      creatives.find(
        (creative) =>
          creative.advertiserId === value &&
          (creative.status ?? "approved") === "approved",
      )?.id ?? "",
    );
  }
  function selectBundle(slotIds: string[]) {
    setSelected(slotIds);
    setBidAmounts((current) =>
      Object.fromEntries(
        slotIds.map((slotId) => [
          slotId,
          current[slotId] ||
            String(
              slots.find((slot) => slot.id === slotId)?.reservePrice ?? "",
            ),
        ]),
      ),
    );
    setMessage(
      `${slotIds.length} package slots selected. You can remove individual slots before submitting bids.`,
    );
    setWorkflowStep(3);
  }
  function save() {
    setMessage("");
    startTransition(async () => {
      try {
        const campaign = await saveDraftCampaign({
          advertiserId,
          name,
          totalBudget: Number(budget),
          startDate,
          endDate,
          preferredAreas: areas,
          preferredTimeWindows: times,
          audienceTags: audiences,
          qualityTier: quality,
          creativeId,
          selectedSlotIds: selected,
          buyingMode,
          maxBidPerSlot:
            buyingMode === "auto" ? Number(maxBidPerSlot) : undefined,
        });
        setSavedCampaignId(campaign.id);
        setMessage(
          "Campaign brief saved. Review the recommended inventory below.",
        );
        setWorkflowStep(2);
        publishDataChange("campaign");
        document
          .getElementById("campaign-matches")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to save campaign brief.",
        );
      }
    });
  }
  function autoBidOnMatches() {
    if (!autoBidReady) {
      setMessage(
        "For auto-bid, add a campaign preference and a maximum bid per slot.",
      );
      return;
    }
    setMessage("");
    startTransition(async () => {
      try {
        const result = await runCampaignAutoBid({
          campaignId: savedCampaignId || undefined,
          advertiserId,
          name,
          totalBudget: Number(budget),
          startDate,
          endDate,
          preferredAreas: areas,
          preferredTimeWindows: times,
          audienceTags: audiences,
          qualityTier: quality,
          creativeId,
          selectedSlotIds: [],
          buyingMode: "auto",
          maxBidPerSlot: Number(maxBidPerSlot),
        });
        setSubmittedBidCount(result.placed.length);
        setMessage(
          result.placed.length
            ? `${result.placed.length} automatic bid${result.placed.length === 1 ? "" : "s"} placed on the best live matches.`
            : "No live matches meet both your budget and per-slot maximum right now.",
        );
        setWorkflowStep(4);
        publishDataChange("bid");
        document
          .getElementById("campaign-confirmation")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to place automatic bids.",
        );
      }
    });
  }
  function bidOnSelected() {
    if (!briefReady) {
      setMessage("Complete Step 1 before submitting bids.");
      return;
    }
    if (!selectedAuctionsOpen) {
      setMessage(
        "One or more selected auctions have not opened yet. Remove them or wait for their opening time.",
      );
      return;
    }
    const totalBids = selected.reduce(
      (sum, slotId) => sum + (Number(bidAmounts[slotId]) || 0),
      0,
    );
    if (totalBids > Number(budget)) {
      setMessage(
        `Your bids total ${formatRupees(totalBids)}, over your ${formatRupees(Number(budget))} campaign budget. Lower a bid or raise the budget.`,
      );
      return;
    }
    setMessage("");
    startTransition(async () => {
      const errors: string[] = [];
      for (const slotId of selected) {
        const amount = Number(bidAmounts[slotId]);
        if (!Number.isInteger(amount) || amount <= 0) {
          errors.push("Enter a whole-number bid for every selected slot.");
          break;
        }
        try {
          await submitBid({ slotId, advertiserId, amount, creativeId });
        } catch (error) {
          errors.push(
            error instanceof Error ? error.message : "Unable to place bid.",
          );
        }
      }
      if (errors.length) {
        setMessage(errors[0]);
        return;
      }
      setMessage(
        `${selected.length} manual bid${selected.length === 1 ? "" : "s"} submitted.`,
      );
      setSubmittedBidCount(selected.length);
      setWorkflowStep(4);
      publishDataChange("bid");
      document
        .getElementById("campaign-confirmation")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
  return (
    <div>
      <div className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <Step
          number="1"
          title="Set your brief"
          detail="Name, budget, dates and creative are required."
          active={workflowStep === 1}
          complete={workflowStep > 1}
        />
        <Step
          number="2"
          title="Review matches"
          detail={
            buyingMode === "auto"
              ? "Review ranked live matches and the auto-bid limits."
              : "Choose one or more live slots. We prefill each reserve price."
          }
          active={workflowStep === 2}
          complete={workflowStep > 2}
        />
        <Step
          number="3"
          title="Confirm bids"
          detail={
            buyingMode === "auto"
              ? "Place minimum valid bids on the best matching open slots."
              : "Review bid amounts, then submit. You will see confirmation here."
          }
          active={workflowStep === 3}
          complete={workflowStep === 4}
        />
      </div>
      <div className="mb-6 rounded-2xl border border-cyan-100 bg-cyan-50/60 px-4 py-3 text-sm text-slate-700">
        <p className="font-black text-cyan-800">Campaign Fit Score</p>
        <p className="mt-1">
          {hasFitPreferences
            ? "Scores are active for this brief. Each inventory card shows a 0–100 match and the exact reasons behind it."
            : "Add an optional area, audience, time window, or quality preference in Step 1 to personalise scores. Until then, inventory is shown without a meaningful campaign-fit ranking."}
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside
          id="campaign-brief"
          className="h-fit rounded-2xl bg-slate-950 p-5 text-white shadow-xl"
        >
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
            Step 1 · Campaign brief
          </p>
          <h2 className="mt-2 text-2xl font-bold">Tell us what you need.</h2>
          <p className="mt-2 text-xs leading-5 text-white/60">
            <span className="font-bold text-white">Required:</span> name,
            budget, dates and creative.{" "}
            <span className="font-bold text-white">Optional:</span> areas,
            timing, audience and quality.
          </p>
          <label className="mt-5 block text-xs font-bold text-white/60">
            Advertiser
            <select
              value={advertiserId}
              onChange={(event) => changeAdvertiser(event.target.value)}
              className="mt-2 w-full rounded-xl bg-white px-3 py-3 text-sm font-semibold text-slate-900"
            >
              {advertisers.map((advertiser) => (
                <option key={advertiser.id} value={advertiser.id}>
                  {advertiser.name}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Campaign name *"
            value={name}
            onChange={setName}
            placeholder="e.g. Festive launch"
          />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Field
              label="Total budget *"
              type="number"
              value={budget}
              onChange={setBudget}
            />
            <label className="text-xs font-bold text-white/60">
              Creative *
              <select
                value={creativeId}
                onChange={(event) => setCreativeId(event.target.value)}
                className="mt-2 w-full rounded-xl bg-white px-2 py-3 text-xs font-semibold text-slate-900"
              >
                <option value="">Select approved creative</option>
                {approvedCreatives.map((creative) => (
                  <option key={creative.id} value={creative.id}>
                    {creative.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="mt-4">
            <legend className="text-xs font-bold text-white/60">
              How do you want to bid?
            </legend>
            <p className="mt-1 text-[11px] leading-4 text-white/50">
              {modeTouched
                ? "You can switch any time before you submit."
                : hasFitPreferences
                  ? "You've set preferences, so we've pre-picked auto-bid — switch if you'd rather choose slots yourself."
                  : "We've pre-picked manual since you haven't set preferences yet — add one below to switch to auto-bid."}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["manual", "auto"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setBuyingMode(mode)}
                  className={`relative rounded-xl border p-3 text-left text-xs font-bold ${buyingMode === mode ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-white/15 text-white"}`}
                >
                  {mode === recommendedMode && (
                    <span className="absolute -top-2 right-2 rounded-full bg-emerald-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-950">
                      Recommended
                    </span>
                  )}
                  {mode === "manual" ? "I'll pick the slots" : "Bid for me"}
                  <span
                    className={`mt-1 block font-normal ${buyingMode === mode ? "text-slate-700" : "text-white/60"}`}
                  >
                    {mode === "manual"
                      ? "Choose exact slots and set each bid."
                      : "We rank matches and bid within your caps."}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          {buyingMode === "auto" && (
            <Field
              label="Maximum bid per slot *"
              type="number"
              value={maxBidPerSlot}
              onChange={setMaxBidPerSlot}
            />
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Field
              label="Start date *"
              type="date"
              value={startDate}
              onChange={setStartDate}
            />
            <Field
              label="End date *"
              type="date"
              value={endDate}
              onChange={setEndDate}
            />
          </div>
          <ChoiceGroup
            label="Preferred areas"
            options={areaOptions}
            selected={areas}
            onToggle={(value) => toggle(value, areas, setAreas)}
          />
          <ChoiceGroup
            label="Time windows"
            options={timeOptions}
            selected={times}
            onToggle={(value) => toggle(value, times, setTimes)}
          />
          <ChoiceGroup
            label="Audience tags"
            options={audienceOptions}
            selected={audiences}
            onToggle={(value) => toggle(value, audiences, setAudiences)}
          />
          <label className="mt-4 block text-xs font-bold text-white/60">
            Quality tier
            <select
              value={quality}
              onChange={(event) =>
                setQuality(event.target.value as typeof quality)
              }
              className="mt-2 w-full rounded-xl bg-white px-3 py-3 text-sm font-semibold text-slate-900"
            >
              <option>Any</option>
              <option>Premium</option>
              <option>Standard</option>
            </select>
          </label>
          <button
            type="button"
            onClick={save}
            disabled={isPending || !briefReady}
            className="mt-5 w-full rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Continue to matching inventory"}
          </button>
          {message && (
            <p
              role="status"
              className="mt-4 text-sm font-semibold text-cyan-300"
            >
              {message}
            </p>
          )}
        </aside>
        <section id="campaign-matches">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-600">
                Live matches
              </p>
              <h1 className="mt-1 text-2xl font-bold">Available inventory</h1>
              <p className="mt-1 text-sm text-slate-500">
                {matching.length} slot{matching.length === 1 ? "" : "s"} match
                your brief ·{" "}
                {buyingMode === "auto"
                  ? "ranked for transparent automatic bidding."
                  : "Select several and bid manually."}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
              {buyingMode === "auto"
                ? `Up to ${formatRupees(Number(maxBidPerSlot) || 0)} per slot`
                : `${selected.length} selected`}
            </span>
          </div>
          <div
            className={`mb-4 flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${hasFitPreferences ? "border-cyan-200 bg-cyan-50" : "border-slate-200 bg-slate-50"}`}
          >
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">
                Campaign Fit Score
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                {hasFitPreferences
                  ? "Active: each card below explains its 0–100 match against your preferences."
                  : "Not personalised yet. Add optional preferences in Step 1 to turn scoring on."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setWorkflowStep(1);
                document
                  .getElementById("campaign-brief")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="shrink-0 text-sm font-bold text-cyan-700 hover:underline"
            >
              Edit brief →
            </button>
          </div>
          {campaignBundles.length > 0 && (
            <details
              id="campaign-packages"
              className="mb-4 rounded-2xl border border-violet-100 bg-violet-50/50 p-4"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">
                    Optional shortcut
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    Use a ready-made package
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Pre-grouped live slots based on your current campaign brief.
                  </p>
                </div>
                <span
                  className="text-lg font-bold text-violet-600"
                  aria-hidden="true"
                >
                  ⌄
                </span>
              </summary>
              <div className="mt-4 grid gap-3 border-t border-violet-100 pt-4 md:grid-cols-2">
                {campaignBundles.slice(0, 4).map((bundle) => (
                  <div
                    key={bundle.id}
                    className="rounded-xl bg-white p-3 shadow-sm"
                  >
                    <p className="font-bold text-slate-900">{bundle.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {bundle.slots.length} slots · {bundle.areas.join(" · ")} ·
                      from {formatRupees(bundle.baseCost)}
                    </p>
                    <p className="mt-2 text-xs text-slate-600">{bundle.why}</p>
                    <button
                      type="button"
                      onClick={() =>
                        selectBundle(bundle.slots.map((slot) => slot.id))
                      }
                      className="mt-3 rounded-lg border border-violet-200 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50"
                    >
                      Use this package
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
          {matching.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <p className="font-bold">No matching inventory</p>
              <p className="mt-2 text-sm text-slate-500">
                Broaden your dates, areas, or budget to see more slots.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {matching.map((slot) => {
                const billboard = billboards.find(
                  (item) => item.id === slot.billboardId,
                )!;
                const checked = selected.includes(slot.id);
                const auctionState = auctionStates[slot.id];
                const canBidOnSlot =
                  auctionState === "open" || auctionState === "closing";
                return (
                  <label
                    key={slot.id}
                    className={`grid gap-4 rounded-2xl border bg-white p-4 shadow-sm transition md:grid-cols-[24px_minmax(0,1fr)_130px_150px] md:items-center ${checked ? "border-cyan-400 ring-2 ring-cyan-100" : "border-slate-200"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={buyingMode === "auto"}
                      onChange={() => {
                        setSelected((current) =>
                          checked
                            ? current.filter((id) => id !== slot.id)
                            : [...current, slot.id],
                        );
                        if (!checked)
                          setBidAmounts((current) => ({
                            ...current,
                            [slot.id]:
                              current[slot.id] || String(slot.reservePrice),
                          }));
                        if (!checked) setWorkflowStep(3);
                      }}
                      className="h-4 w-4 accent-cyan-500"
                    />
                    <div>
                      <p className="font-bold">{billboard.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {billboard.area} · {slot.date} · {slot.startTime}–
                        {slot.endTime} · {getTimeOfDay(slot.startTime)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {billboard.estimatedDailyTraffic.toLocaleString(
                          "en-IN",
                        )}{" "}
                        daily traffic · {billboard.qualityTier} · reserve{" "}
                        {formatRupees(slot.reservePrice)}
                      </p>
                      {auctionState === "scheduled" && slot.auctionOpenTime && (
                        <p className="mt-1 text-xs font-bold text-amber-700">
                          Bidding opens{" "}
                          {new Date(slot.auctionOpenTime).toLocaleString(
                            "en-IN",
                            { dateStyle: "medium", timeStyle: "short" },
                          )}
                        </p>
                      )}
                      {hasFitPreferences && (
                        <details className="mt-2 rounded-lg bg-cyan-50 px-2.5 py-2">
                          <summary className="cursor-pointer text-xs font-black text-cyan-800">
                            {fitResults[slot.id]?.score}% Campaign Fit · Why?
                          </summary>
                          <p className="mt-1 text-[10px] font-semibold text-cyan-700">
                            {fitResults[slot.id]?.explanation}
                          </p>
                          <p className="mt-1 text-[10px] text-cyan-700">
                            Location{" "}
                            {fitResults[slot.id]?.breakdown.geo.toFixed(0)}/20 ·
                            Audience{" "}
                            {fitResults[slot.id]?.breakdown.audience.toFixed(0)}
                            /20 · Timing{" "}
                            {fitResults[slot.id]?.breakdown.time.toFixed(0)}/15
                            · Reach{" "}
                            {fitResults[slot.id]?.breakdown.traffic.toFixed(0)}
                            /15 · Price{" "}
                            {fitResults[slot.id]?.breakdown.price.toFixed(0)}/15
                            · Quality{" "}
                            {fitResults[slot.id]?.breakdown.quality.toFixed(0)}
                            /15
                          </p>
                        </details>
                      )}
                    </div>
                    <span
                      className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-bold ${auctionState === "open" ? "bg-emerald-50 text-emerald-700" : auctionState === "closing" ? "bg-orange-50 text-orange-700" : auctionState === "scheduled" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}
                    >
                      {auctionState === "open"
                        ? "Auction open"
                        : auctionState === "closing"
                          ? "Closing soon"
                          : auctionState === "scheduled"
                            ? "Scheduled"
                            : "Bidding closed"}
                    </span>
                    {buyingMode === "manual" ? (
                      <input
                        type="number"
                        min={slot.reservePrice}
                        value={bidAmounts[slot.id] ?? ""}
                        disabled={!canBidOnSlot}
                        onChange={(event) =>
                          setBidAmounts((current) => ({
                            ...current,
                            [slot.id]: event.target.value,
                          }))
                        }
                        onClick={(event) => event.preventDefault()}
                        placeholder={
                          canBidOnSlot
                            ? `Bid · ${formatRupees(slot.reservePrice)}`
                            : "Bidding not open"
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                    ) : (
                      <span className="rounded-xl bg-cyan-50 px-3 py-2 text-center text-xs font-bold text-cyan-800">
                        Auto bid up to{" "}
                        {formatRupees(Number(maxBidPerSlot) || 0)}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <p className="text-sm text-slate-600">
                <span className="font-bold text-slate-900">
                  Step 3 ·{" "}
                  {buyingMode === "auto"
                    ? "Confirm auto-bid."
                    : "Review and submit."}
                </span>{" "}
                {buyingMode === "auto"
                  ? "We rank open matches by Campaign Fit, then place only the minimum valid bid. Total maximum bids never exceed your budget or per-slot cap."
                  : "Bid amounts start at the reserve price. Raise them if the slot already has a higher eligible bid."}
              </p>
              {message && (
                <p
                  role="status"
                  className="mt-1 text-xs font-bold text-cyan-700"
                >
                  {message}
                </p>
              )}
              {selected.length > 0 && (
                <p className="mt-1 text-xs font-semibold text-cyan-700">
                  Estimated reach{" "}
                  {selectedEstimate.impressions.toLocaleString("en-IN")} ·
                  Estimated cost {formatRupees(selectedEstimate.cost)}
                  {selectedEstimate.cpm !== null
                    ? ` · Estimated CPM ${formatRupees(Math.round(selectedEstimate.cpm))}`
                    : ""}
                </p>
              )}
              {selected.length > 0 && (
                <details className="mt-2 text-xs text-violet-800">
                  <summary className="cursor-pointer font-bold">
                    Qualified Reach Efficiency (i):{" "}
                    {Math.round(
                      selectedQualifiedReach.qualifiedReachEfficiency,
                    )}{" "}
                    / ₹1K
                  </summary>
                  <p className="mt-1">
                    Estimated spend{" "}
                    {formatRupees(selectedQualifiedReach.expectedCost)} · Gross
                    qualified impressions{" "}
                    {selectedQualifiedReach.grossQualifiedImpressions.toLocaleString(
                      "en-IN",
                    )}{" "}
                    · Adjusted estimated reach{" "}
                    {selectedQualifiedReach.adjustedEstimatedReach.toLocaleString(
                      "en-IN",
                    )}{" "}
                    · {Math.round(selectedQualifiedReach.overlapDiscount * 100)}
                    % overlap assumption · Confidence{" "}
                    {selectedQualifiedReach.confidence}.
                  </p>
                  <p className="mt-1 text-slate-500">
                    Planning estimate, not audited or guaranteed impressions.
                  </p>
                </details>
              )}
            </div>
            <button
              type="button"
              onClick={buyingMode === "auto" ? autoBidOnMatches : bidOnSelected}
              disabled={
                isPending ||
                !creativeId ||
                (buyingMode === "auto"
                  ? !autoBidReady
                  : selected.length === 0 ||
                    !briefReady ||
                    !selectedAuctionsOpen)
              }
              className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              {isPending
                ? "Submitting…"
                : buyingMode === "auto" && !autoBidReady
                  ? "Add preferences and caps"
                  : !briefReady
                    ? "Complete Step 1 first"
                    : !selectedAuctionsOpen
                      ? "Bidding not open yet"
                      : buyingMode === "auto"
                        ? "Auto-bid best matches"
                        : selected.length === 0
                          ? "Select inventory to bid"
                          : `Submit ${selected.length} bid${selected.length === 1 ? "" : "s"}`}
            </button>
          </div>
          {workflowStep === 4 && (
            <section
              id="campaign-confirmation"
              className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"
            >
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                Bids submitted
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Your campaign is now participating in the auction.
              </h2>
              <p className="mt-2 text-sm text-slate-700">
                {submittedBidCount} bid
                {submittedBidCount === 1 ? " is" : "s are"} live. Auction
                outcomes and any outbid status will appear in My bids.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/advertiser/bids"
                  className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white"
                >
                  View my bids
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setWorkflowStep(2);
                    setMessage(
                      "Choose more inventory to add bids to this campaign.",
                    );
                  }}
                  className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-bold text-emerald-800"
                >
                  Add more inventory
                </button>
              </div>
            </section>
          )}
        </section>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  detail,
  active = false,
  complete = false,
}: {
  number: string;
  title: string;
  detail: string;
  active?: boolean;
  complete?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${active ? "border-cyan-200 bg-cyan-50/60" : complete ? "border-emerald-200 bg-emerald-50/60" : "border-slate-100 bg-slate-50"}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`grid h-6 w-6 place-items-center rounded-full text-xs font-black ${active ? "bg-cyan-500 text-white" : complete ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"}`}
        >
          {complete ? "✓" : number}
        </span>
        <p className="text-sm font-black text-slate-900">{title}</p>
      </div>
      <p className="mt-2 text-xs leading-4 text-slate-500">{detail}</p>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="mt-4 block text-xs font-bold text-white/60">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none"
      />
    </label>
  );
}
function ChoiceGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="mt-4">
      <legend className="text-xs font-bold text-white/60">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            type="button"
            key={option}
            onClick={() => onToggle(option)}
            className={`rounded-full px-2.5 py-1.5 text-[11px] font-bold ${selected.includes(option) ? "bg-cyan-400 text-slate-950" : "bg-white/10 text-white/60"}`}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
