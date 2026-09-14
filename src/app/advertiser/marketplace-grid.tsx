"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { formatRupees, type Billboard, type Bid, type Slot } from "@/lib/data";
import {
  getAudienceTags,
  getInventoryContextTags,
  getSlotTags,
  getTimeOfDay,
  isWithinRadius,
  isWithinViewport,
  sortMarketplaceSlots,
  type GeoPoint,
  type MarketplaceSort,
  type ViewportBounds,
} from "@/lib/marketplace";
import { interpretMarketplaceSearch } from "@/lib/actions";
import {
  emptyNaturalSearchFilters,
  type NaturalSearchFilters,
} from "@/lib/natural-search";
import { StatusBadge } from "@/components/app-shell";
import { InventoryMap } from "./inventory-map";
import { estimateQualifiedReach } from "@/lib/qualified-reach-efficiency";
import { getDemandScore } from "@/lib/demand-score";
import { getComparableInventoryPrice } from "@/lib/comparable-inventory";

const tagStyles: Record<string, string> = {
  "Just Now": "bg-violet-50 text-violet-700",
  New: "bg-blue-50 text-blue-700",
  Today: "bg-emerald-50 text-emerald-700",
  "Ending Soon": "bg-orange-50 text-orange-700",
  Popular: "bg-cyan-50 text-cyan-700",
  "No Bids Yet": "bg-slate-100 text-slate-500",
  "Tech Hub": "bg-cyan-50 text-cyan-700",
  "Office Commuters": "bg-blue-50 text-blue-700",
  Premium: "bg-amber-50 text-amber-700",
  Retail: "bg-orange-50 text-orange-700",
  Residential: "bg-emerald-50 text-emerald-700",
  "High Traffic": "bg-violet-50 text-violet-700",
  "Airport Route": "bg-indigo-50 text-indigo-700",
  "Family Audience": "bg-rose-50 text-rose-700",
  "Evening Heavy": "bg-slate-100 text-slate-700",
  "Weekend Heavy": "bg-teal-50 text-teal-700",
};

export function MarketplaceGrid({
  slots,
  billboards,
  bids,
}: {
  slots: Slot[];
  billboards: Billboard[];
  bids: Bid[];
}) {
  const [area, setArea] = useState("all");
  const [date, setDate] = useState("all");
  const [timeOfDay, setTimeOfDay] = useState("all");
  const [quality, setQuality] = useState("all");
  const [audience, setAudience] = useState("all");
  const [status, setStatus] = useState("all");
  const [minReserve, setMinReserve] = useState("");
  const [maxReserve, setMaxReserve] = useState("");
  const [sort, setSort] = useState<MarketplaceSort>("newest");
  const [view, setView] = useState<"cards" | "list">("cards");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [geoCenter, setGeoCenter] = useState<GeoPoint | null>(null);
  const [radiusKm, setRadiusKm] = useState("all");
  const [viewport, setViewport] = useState<ViewportBounds | null>(null);
  const [naturalQuery, setNaturalQuery] = useState("");
  const [naturalFilters, setNaturalFilters] = useState<NaturalSearchFilters>(
    emptyNaturalSearchFilters(),
  );
  const [naturalSource, setNaturalSource] = useState<"ai" | "rules" | null>(
    null,
  );
  const [searchMessage, setSearchMessage] = useState("");
  const [isSearchPending, startSearchTransition] = useTransition();
  const areas = Array.from(
    new Set(
      slots
        .map(
          (slot) =>
            billboards.find((billboard) => billboard.id === slot.billboardId)
              ?.area,
        )
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort();
  const dates = Array.from(new Set(slots.map((slot) => slot.date))).sort();
  const audiences = Array.from(
    new Set(
      slots.flatMap((slot) =>
        getAudienceTags(
          billboards.find((billboard) => billboard.id === slot.billboardId),
        ),
      ),
    ),
  ).sort();
  const efficiencyScores = useMemo(
    () =>
      Object.fromEntries(
        slots.map((slot) => [
          slot.id,
          estimateQualifiedReach(
            slot,
            billboards.find((billboard) => billboard.id === slot.billboardId),
          ).qualifiedReachEfficiency,
        ]),
      ),
    [billboards, slots],
  );
  const filtered = useMemo(
    () =>
      sortMarketplaceSlots(
        slots.filter((slot) => {
          const billboard = billboards.find(
            (item) => item.id === slot.billboardId,
          );
          const naturalDayMatches =
            naturalFilters.dayOfWeek === undefined ||
            new Date(`${slot.date}T12:00:00Z`).getUTCDay() ===
              naturalFilters.dayOfWeek;
          const naturalDateMatches =
            !naturalFilters.date || slot.date === naturalFilters.date;
          const naturalTimeMatches =
            !naturalFilters.timeOfDay ||
            getTimeOfDay(slot.startTime) === naturalFilters.timeOfDay;
          const naturalRangeMatches =
            (!naturalFilters.startTime ||
              slot.startTime >= naturalFilters.startTime) &&
            (!naturalFilters.endTime || slot.endTime <= naturalFilters.endTime);
          const naturalAudienceMatches =
            naturalFilters.audienceTags.length === 0 ||
            naturalFilters.audienceTags.some((tag) =>
              getAudienceTags(billboard).includes(tag),
            );
          return (
            (area === "all" || billboard?.area === area) &&
            (date === "all" || slot.date === date) &&
            (timeOfDay === "all" ||
              getTimeOfDay(slot.startTime) === timeOfDay) &&
            (quality === "all" || billboard?.qualityTier === quality) &&
            (audience === "all" ||
              getAudienceTags(billboard).includes(audience)) &&
            (status === "all" || slot.status === status) &&
            (!minReserve || slot.reservePrice >= Number(minReserve)) &&
            (!maxReserve || slot.reservePrice <= Number(maxReserve)) &&
            (!geoCenter ||
              radiusKm === "all" ||
              (billboard
                ? isWithinRadius(billboard, geoCenter, Number(radiusKm))
                : false)) &&
            (!viewport ||
              (billboard ? isWithinViewport(billboard, viewport) : false)) &&
            (naturalFilters.areas.length === 0 ||
              naturalFilters.areas.includes(billboard?.area ?? "")) &&
            naturalDateMatches &&
            naturalDayMatches &&
            naturalTimeMatches &&
            naturalRangeMatches &&
            (!naturalFilters.maxReserve ||
              slot.reservePrice <= naturalFilters.maxReserve) &&
            (!naturalFilters.minimumTraffic ||
              (billboard?.estimatedDailyTraffic ?? 0) >=
                naturalFilters.minimumTraffic) &&
            naturalAudienceMatches &&
            (!naturalFilters.qualityTier ||
              billboard?.qualityTier === naturalFilters.qualityTier) &&
            (!naturalFilters.auctionStatus ||
              slot.status === naturalFilters.auctionStatus)
          );
        }),
        billboards,
        bids,
        sort,
        {},
        efficiencyScores,
      ),
    [
      area,
      audience,
      billboards,
      bids,
      date,
      geoCenter,
      efficiencyScores,
      maxReserve,
      minReserve,
      naturalFilters,
      quality,
      radiusKm,
      slots,
      sort,
      status,
      timeOfDay,
      viewport,
    ],
  );
  const hasFilters =
    area !== "all" ||
    date !== "all" ||
    timeOfDay !== "all" ||
    quality !== "all" ||
    audience !== "all" ||
    status !== "all" ||
    minReserve !== "" ||
    maxReserve !== "";
  const hasGeoFilters =
    area !== "all" || Boolean(viewport || (geoCenter && radiusKm !== "all"));
  function clearFilters() {
    setArea("all");
    setDate("all");
    setTimeOfDay("all");
    setQuality("all");
    setAudience("all");
    setStatus("all");
    setMinReserve("");
    setMaxReserve("");
  }
  function clearGeoFilters() {
    setArea("all");
    setGeoCenter(null);
    setRadiusKm("all");
    setViewport(null);
  }
  function selectSlot(slotId: string, revealCard = false) {
    setSelectedSlotId(slotId);
    const slot = slots.find((item) => item.id === slotId);
    const billboard = billboards.find((item) => item.id === slot?.billboardId);
    if (billboard)
      setGeoCenter({
        latitude: billboard.latitude,
        longitude: billboard.longitude,
        label: billboard.area,
      });
    if (revealCard)
      requestAnimationFrame(() =>
        document
          .getElementById(`inventory-slot-${slotId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      );
  }
  function searchInventory(query = naturalQuery) {
    if (!query.trim()) return;
    setNaturalQuery(query);
    setSearchMessage("");
    startSearchTransition(async () => {
      const result = await interpretMarketplaceSearch({
        query,
        availableAreas: areas,
        availableAudiences: audiences,
      });
      setNaturalFilters(result.filters);
      setNaturalSource(result.source);
      setSort(result.filters.sorting ?? "newest");
      const centerArea = result.filters.areas[0] ?? result.filters.location;
      const centerBillboard = billboards.find(
        (billboard) =>
          billboard.area.toLowerCase() === centerArea?.toLowerCase(),
      );
      if (centerBillboard && result.filters.radiusKm) {
        setGeoCenter({
          latitude: centerBillboard.latitude,
          longitude: centerBillboard.longitude,
          label: centerBillboard.area,
        });
        setRadiusKm(String(result.filters.radiusKm));
      }
      setSearchMessage("Search applied to the inventory below.");
    });
  }
  function clearNaturalSearch() {
    setNaturalQuery("");
    setNaturalFilters(emptyNaturalSearchFilters());
    setNaturalSource(null);
    setSearchMessage("");
    setRadiusKm("all");
    setGeoCenter(null);
  }
  function removeNaturalFilter(
    key: keyof NaturalSearchFilters,
    value?: string,
  ) {
    setNaturalFilters((current) => {
      const next = { ...current };
      const currentValue = next[key];
      if (Array.isArray(currentValue) && value)
        next[key] = currentValue.filter((item) => item !== value) as never;
      else delete next[key];
      return next;
    });
  }
  return (
    <>
      <section className="mb-0 rounded-t-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">
              Search inventory
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                searchInventory();
              }}
              className="mt-2 flex gap-2"
            >
              <input
                value={naturalQuery}
                onChange={(event) => setNaturalQuery(event.target.value)}
                placeholder="Try “premium billboards around Gachibowli under ₹25,000”"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-violet-400"
              />
              <button
                type="submit"
                disabled={isSearchPending || !naturalQuery.trim()}
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40"
              >
                {isSearchPending ? "Interpreting…" : "Search"}
              </button>
            </form>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Describe what you need, or refine the same results with filters below.
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
          <span>Try:</span>
          <button
            type="button"
            onClick={() =>
              searchInventory(
                "Show premium billboards around Gachibowli under ₹25,000.",
              )
            }
            className="font-semibold text-violet-700 hover:underline"
          >
            Premium Gachibowli
          </button>
          <button
            type="button"
            onClick={() =>
              searchInventory("Find office commuter screens Friday evening.")
            }
            className="font-semibold text-violet-700 hover:underline"
          >
            Office commuters Friday evening
          </button>
          <button
            type="button"
            onClick={() =>
              searchInventory(
                "Show high-traffic HITEC City inventory ending soon.",
              )
            }
            className="font-semibold text-violet-700 hover:underline"
          >
            High-traffic HITEC City
          </button>
        </div>
        {searchMessage && (
          <p role="status" className="mt-3 text-xs font-bold text-emerald-700">
            {searchMessage}
          </p>
        )}
        {naturalSource && (
          <div className="mt-3 rounded-xl bg-violet-50 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-violet-900">
              <span>Interpreted filters</span>
              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-violet-600">
                {naturalSource === "ai" ? "AI parsed" : "Rules fallback"}
              </span>
              {naturalFilters.areas.map((value) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => removeNaturalFilter("areas", value)}
                  className="rounded-full bg-white px-2 py-1"
                >
                  Area: {value} ×
                </button>
              ))}
              {naturalFilters.location && (
                <button
                  type="button"
                  onClick={() => removeNaturalFilter("location")}
                  className="rounded-full bg-white px-2 py-1"
                >
                  Location: {naturalFilters.location} ×
                </button>
              )}
              {naturalFilters.date && (
                <button
                  type="button"
                  onClick={() => removeNaturalFilter("date")}
                  className="rounded-full bg-white px-2 py-1"
                >
                  Date: {naturalFilters.date} ×
                </button>
              )}
              {naturalFilters.dayOfWeek !== undefined && (
                <button
                  type="button"
                  onClick={() => removeNaturalFilter("dayOfWeek")}
                  className="rounded-full bg-white px-2 py-1"
                >
                  Day:{" "}
                  {
                    (
                      ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
                    )[naturalFilters.dayOfWeek]
                  }{" "}
                  ×
                </button>
              )}
              {naturalFilters.timeOfDay && (
                <button
                  type="button"
                  onClick={() => removeNaturalFilter("timeOfDay")}
                  className="rounded-full bg-white px-2 py-1"
                >
                  Time: {naturalFilters.timeOfDay} ×
                </button>
              )}
              {naturalFilters.maxReserve !== undefined && (
                <button
                  type="button"
                  onClick={() => removeNaturalFilter("maxReserve")}
                  className="rounded-full bg-white px-2 py-1"
                >
                  Max: {formatRupees(naturalFilters.maxReserve)} ×
                </button>
              )}
              {naturalFilters.minimumTraffic !== undefined && (
                <button
                  type="button"
                  onClick={() => removeNaturalFilter("minimumTraffic")}
                  className="rounded-full bg-white px-2 py-1"
                >
                  Traffic:{" "}
                  {naturalFilters.minimumTraffic.toLocaleString("en-IN")}/day ×
                </button>
              )}
              {naturalFilters.audienceTags.map((value) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => removeNaturalFilter("audienceTags", value)}
                  className="rounded-full bg-white px-2 py-1"
                >
                  Audience: {value} ×
                </button>
              ))}
              {naturalFilters.qualityTier && (
                <button
                  type="button"
                  onClick={() => removeNaturalFilter("qualityTier")}
                  className="rounded-full bg-white px-2 py-1"
                >
                  Quality: {naturalFilters.qualityTier} ×
                </button>
              )}
              {naturalFilters.auctionStatus && (
                <button
                  type="button"
                  onClick={() => removeNaturalFilter("auctionStatus")}
                  className="rounded-full bg-white px-2 py-1"
                >
                  Status: {naturalFilters.auctionStatus.replace("_", " ")} ×
                </button>
              )}
              <button
                type="button"
                onClick={clearNaturalSearch}
                className="ml-auto font-black underline underline-offset-2"
              >
                Clear search
              </button>
            </div>
          </div>
        )}
      </section>
      <section
        id="inventory-explorer"
        className="mb-6 rounded-b-2xl border border-t-0 border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Filters and results
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {filtered.length} matching opportunities · Prices in INR
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              className={`rounded-lg border px-3 py-2 text-xs font-bold ${hasFilters ? "border-cyan-300 bg-cyan-50 text-cyan-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}
            >
              {showFilters ? "Hide filters" : "Filters"}
              {hasFilters ? " · active" : ""}
            </button>
            <div
              className="flex rounded-lg border border-slate-200 bg-slate-50 p-1"
              aria-label="Inventory view"
            >
              <button
                type="button"
                onClick={() => setView("cards")}
                className={`rounded-md px-3 py-1.5 text-xs font-bold ${view === "cards" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"}`}
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={`rounded-md px-3 py-1.5 text-xs font-bold ${view === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"}`}
              >
                List
              </button>
            </div>
            <label className="flex items-center gap-3 text-sm font-bold text-slate-600">
              Sort by
              <select
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value as MarketplaceSort)
                }
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none"
              >
                <option value="newest">Newest</option>
                <option value="ending">Ending soon</option>
                <option value="reserve">Lowest reserve</option>
                <option value="traffic">Highest traffic</option>
                <option value="bids">Most bids</option>
                <option value="efficiency">Best Reach Efficiency</option>
              </select>
            </label>
          </div>
        </div>
        {showFilters && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <Select
            label="Area"
            value={area}
            onChange={setArea}
            options={areas}
          />
          <label className="text-[11px] font-bold text-slate-400">
            Radius
            <select
              value={radiusKm}
              onChange={(event) => setRadiusKm(event.target.value)}
              disabled={!geoCenter}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="all">Off</option>
              <option value="1">1 km</option>
              <option value="3">3 km</option>
              <option value="5">5 km</option>
              <option value="10">10 km</option>
            </select>
          </label>
          <Select
            label="Date"
            value={date}
            onChange={setDate}
            options={dates}
          />
          <Select
            label="Time"
            value={timeOfDay}
            onChange={setTimeOfDay}
            options={["Morning", "Afternoon", "Evening", "Late night"]}
          />
          <Select
            label="Quality"
            value={quality}
            onChange={setQuality}
            options={["Premium", "Standard"]}
          />
          <Select
            label="Audience"
            value={audience}
            onChange={setAudience}
            options={audiences}
          />
          <Select
            label="Status"
            value={status}
            onChange={setStatus}
            options={["available", "auction_open"]}
          />
          <label className="text-[11px] font-bold text-slate-400">
            Min reserve
            <input
              type="number"
              min="0"
              value={minReserve}
              onChange={(event) => setMinReserve(event.target.value)}
              placeholder="₹ 0"
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-400"
            />
          </label>
          <label className="text-[11px] font-bold text-slate-400">
            Max reserve
            <input
              type="number"
              min="0"
              value={maxReserve}
              onChange={(event) => setMaxReserve(event.target.value)}
              placeholder="No limit"
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-400"
            />
          </label>
        </div>
        )}
        {hasFilters && (
          <div className="mt-3 flex items-center justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-bold text-cyan-700 underline underline-offset-2"
            >
              Clear all filters
            </button>
          </div>
        )}
        {hasGeoFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800">
            <span>Geo filter:</span>
            {area !== "all" && (
              <span className="rounded-full bg-white px-2 py-1">
                Area: {area}
              </span>
            )}
            {geoCenter && radiusKm !== "all" && (
              <span className="rounded-full bg-white px-2 py-1">
                Within {radiusKm} km of {geoCenter.label}
              </span>
            )}
            {viewport && (
              <span className="rounded-full bg-white px-2 py-1">
                Current map area
              </span>
            )}
            <button
              type="button"
              onClick={clearGeoFilters}
              className="ml-auto font-black underline underline-offset-2"
            >
              Reset geo
            </button>
          </div>
        )}
      </section>
      <InventoryMap
        slots={filtered}
        billboards={billboards}
        selectedSlotId={selectedSlotId}
        onSelect={(slotId) => selectSlot(slotId, true)}
        onSearchArea={setViewport}
      />
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-lg font-bold">No matching inventory</p>
          <p className="mt-2 text-sm text-slate-500">
            Adjust your filters to explore more Hyderabad screen time.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-5 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"
          >
            Show all opportunities
          </button>
        </div>
      ) : view === "cards" ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              billboard={billboards.find(
                (item) => item.id === slot.billboardId,
              )}
              bids={bids.filter((bid) => bid.slotId === slot.id)}
              selected={selectedSlotId === slot.id}
              onSelect={selectSlot}
              metric={estimateQualifiedReach(
                slot,
                billboards.find((item) => item.id === slot.billboardId),
              )}
              demand={getDemandScore(slot, bids, slots, billboards)}
              comparable={getComparableInventoryPrice(slot, billboards, slots)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {filtered.map((slot) => (
            <SlotListRow
              key={slot.id}
              slot={slot}
              billboard={billboards.find(
                (item) => item.id === slot.billboardId,
              )}
              bids={bids.filter((bid) => bid.slotId === slot.id)}
              selected={selectedSlotId === slot.id}
              onSelect={selectSlot}
              metric={estimateQualifiedReach(
                slot,
                billboards.find((item) => item.id === slot.billboardId),
              )}
            />
          ))}
        </div>
      )}
    </>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="text-[11px] font-bold text-slate-400">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full truncate rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-400"
      >
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replace("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function SlotCard({
  slot,
  billboard,
  bids,
  selected,
  onSelect,
  fit,
  metric,
  demand,
  comparable,
}: {
  slot: Slot;
  billboard?: Billboard;
  bids: Bid[];
  selected: boolean;
  onSelect: (slotId: string) => void;
  fit?: { score: number; explanation: string };
  metric: ReturnType<typeof estimateQualifiedReach>;
  demand: ReturnType<typeof getDemandScore>;
  comparable: ReturnType<typeof getComparableInventoryPrice>;
}) {
  const tags = getInventoryContextTags(slot, billboard).slice(0, 4);
  return (
    <article
      id={`inventory-slot-${slot.id}`}
      onMouseEnter={() => onSelect(slot.id)}
      className={`group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-1 hover:border-cyan-300 hover:shadow-xl hover:shadow-cyan-900/5 ${selected ? "border-cyan-400 ring-2 ring-cyan-100" : "border-slate-200"}`}
    >
      <div className="relative h-36 overflow-hidden bg-gradient-to-br from-slate-900 via-cyan-900 to-blue-600 p-5 text-white">
        {billboard?.imageUrl ? (
          <img
            src={billboard.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-70"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
        <div className="absolute right-4 top-4">
          <StatusBadge status={slot.status} />
        </div>
        <div className="absolute bottom-5 left-5 z-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">
            {billboard?.area} · Hyderabad
          </p>
          <p className="mt-1 text-xl font-bold">{billboard?.name}</p>
        </div>
      </div>
      <div className="p-5">
        <div className="flex min-h-7 flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className={`rounded-full px-2 py-1 text-[10px] font-black ${tagStyles[tag]}`}
            >
              {tag}
            </span>
          ))}
        </div>
        {fit && (
          <div className="mt-3 rounded-lg bg-cyan-50 px-2.5 py-2">
            <p className="text-sm font-black text-cyan-800">
              {fit.score}% Match
            </p>
            <p className="mt-0.5 text-[10px] font-semibold text-cyan-700">
              {fit.explanation}
            </p>
          </div>
        )}
        <div className="mt-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold">{slot.date}</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              {slot.startTime}–{slot.endTime} · {getTimeOfDay(slot.startTime)}
            </p>
            {slot.auctionCloseTime && (
              <p className="mt-1 text-xs font-semibold text-orange-700">
                Closes{" "}
                {new Date(slot.auctionCloseTime).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            )}
          </div>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
            {billboard?.qualityTier}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {getAudienceTags(billboard).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
          <div>
            <p className="text-[11px] text-slate-400">Reserve</p>
            <p className="mt-1 text-sm font-black">
              {formatRupees(slot.reservePrice)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Traffic / day</p>
            <p className="mt-1 text-sm font-black">
              {((billboard?.estimatedDailyTraffic ?? 0) / 1000).toFixed(0)}K
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Bids</p>
            <p className="mt-1 text-sm font-black">{bids.length}</p>
          </div>
        </div>
        <EfficiencySummary metric={metric} />
        <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
          <span className="font-bold text-violet-700">
            Demand: {demand.level}
          </span>
          <span title={demand.explanation} className="truncate text-slate-500">
            {demand.explanation}
          </span>
        </div>
        <p className="mt-1 text-[11px] font-semibold text-slate-500">
          {comparable.label}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href={`/advertiser/slots/${slot.id}`}
            className="rounded-lg border border-slate-200 px-2 py-2 text-center text-xs font-bold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
          >
            Bid Now
          </Link>
          <Link
            href={`/advertiser/campaigns?slots=${slot.id}`}
            className="rounded-lg bg-slate-950 px-2 py-2 text-center text-xs font-black text-white transition hover:bg-slate-800"
          >
            Add to Campaign
          </Link>
        </div>
      </div>
    </article>
  );
}

function SlotListRow({
  slot,
  billboard,
  bids,
  selected,
  onSelect,
  fit,
  metric,
}: {
  slot: Slot;
  billboard?: Billboard;
  bids: Bid[];
  selected: boolean;
  onSelect: (slotId: string) => void;
  fit?: { score: number; explanation: string };
  metric: ReturnType<typeof estimateQualifiedReach>;
}) {
  const tags = getSlotTags(slot, billboard, bids);
  return (
    <article
      id={`inventory-slot-${slot.id}`}
      onMouseEnter={() => onSelect(slot.id)}
      className={`group grid gap-4 border-b border-slate-100 p-4 transition last:border-b-0 hover:bg-cyan-50/40 ${selected ? "bg-cyan-50/60" : ""} md:grid-cols-[minmax(220px,1.5fr)_minmax(170px,1fr)_repeat(4,minmax(90px,0.6fr))_auto] md:items-center`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-bold text-slate-900">{billboard?.name}</p>
          <StatusBadge status={slot.status} />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {billboard?.area} · {billboard?.qualityTier} · {billboard?.screenType}
        </p>
        {fit && (
          <p className="mt-2 text-xs font-black text-cyan-700">
            {fit.score}% Match{" "}
            <span className="font-semibold text-slate-500">
              · {fit.explanation}
            </span>
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${tagStyles[tag]}`}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-slate-900">{slot.date}</p>
        <p className="mt-1 text-xs text-slate-500">
          {slot.startTime}–{slot.endTime} · {getTimeOfDay(slot.startTime)}
        </p>
      </div>
      <div>
        <p className="text-[11px] text-slate-400">Reserve</p>
        <p className="mt-1 text-sm font-black">
          {formatRupees(slot.reservePrice)}
        </p>
      </div>
      <div>
        <p className="text-[11px] text-slate-400">Traffic</p>
        <p className="mt-1 text-sm font-black">
          {((billboard?.estimatedDailyTraffic ?? 0) / 1000).toFixed(0)}K
        </p>
      </div>
      <div>
        <p className="text-[11px] text-slate-400">Audience</p>
        <p className="mt-1 truncate text-xs font-semibold text-slate-700">
          {getAudienceTags(billboard).slice(0, 2).join(" · ")}
        </p>
      </div>
      <div>
        <p className="text-[11px] text-slate-400">Bids</p>
        <p className="mt-1 text-sm font-black">{bids.length}</p>
      </div>
      <div>
        <p className="text-[11px] text-slate-400">Efficiency</p>
        <p className="mt-1 text-sm font-black">
          {Math.round(metric.qualifiedReachEfficiency)} / ₹1K
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/advertiser/slots/${slot.id}`}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-700 hover:border-cyan-300 hover:text-cyan-700"
        >
          Bid Now
        </Link>
        <Link
          href={`/advertiser/campaigns?slots=${slot.id}`}
          className="rounded-lg bg-slate-950 px-2 py-1.5 text-xs font-black text-white"
        >
          Add to Campaign
        </Link>
      </div>
    </article>
  );
}

function EfficiencySummary({
  metric,
}: {
  metric: ReturnType<typeof estimateQualifiedReach>;
}) {
  return (
    <details className="mt-4 rounded-xl bg-cyan-50 px-3 py-2 text-xs text-cyan-900">
      <summary className="cursor-pointer list-none font-bold">
        Est. Qualified Reach:{" "}
        {(metric.estimatedQualifiedImpressions / 1000).toFixed(1)}K{" "}
        <span className="text-cyan-700">(i)</span>
        <span className="ml-2">
          Efficiency: {Math.round(metric.qualifiedReachEfficiency)} / ₹1K
        </span>
      </summary>
      <p className="mt-2 leading-5">
        Estimated relevant audience exposure based on traffic, visibility,
        audience match and screen share. Confidence: {metric.confidence}.
      </p>
      <p className="mt-2 font-semibold">
        View calculation: {metric.slotTraffic.toLocaleString("en-IN")} ×{" "}
        {metric.visibilityFactor.toFixed(2)} ×{" "}
        {metric.audienceMatchFactor.toFixed(2)} ×{" "}
        {metric.adShareFactor.toFixed(2)} × {metric.contextFactor.toFixed(2)} ={" "}
        {metric.estimatedQualifiedImpressions.toLocaleString("en-IN")}
      </p>
      <p className="mt-1">
        Qualified CPM:{" "}
        {metric.estimatedQualifiedCpm === null
          ? "—"
          : formatRupees(Math.round(metric.estimatedQualifiedCpm))}
        . Planning estimate, not audited or guaranteed impressions.
      </p>
    </details>
  );
}
