import Link from "next/link";
import { formatRupees, getAdvertiser } from "@/lib/data";
import { getSlots, getBids, getBillboards, getAuctionResults, type StoredAuctionResult } from "@/lib/db";
import type { Bid, Billboard, Slot } from "@/lib/data";
import { PageIntro, StatusBadge } from "@/components/app-shell";

type AuctionData = { slots: Slot[]; bids: Bid[]; billboards: Billboard[]; results: StoredAuctionResult[] };

function Row({ slotId, data }: { slotId: string; data: AuctionData }) {
  const slot = data.slots.find((item) => item.id === slotId);
  if (!slot) return null;
  const billboard = data.billboards.find((item) => item.id === slot.billboardId);
  const result = data.results.find((item) => item.slotId === slotId);
  const slotBids = data.bids.filter((bid) => bid.slotId === slotId);
  const highest = slotBids.reduce((max, bid) => Math.max(max, bid.amount), 0);
  const won = result?.status === "sold";
  return (
    <div className="grid grid-cols-[minmax(180px,1.5fr)_100px_90px_120px_120px_150px] items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 text-sm transition hover:border-cyan-200 hover:bg-cyan-50/40">
      <Link href={`/admin/auctions/${slotId}`}>
        <p className="font-bold text-slate-900">{billboard?.name}</p>
        <p className="mt-1 text-xs text-slate-400">
          {billboard?.area} · {slot.date} · {slot.startTime}–{slot.endTime}
        </p>
      </Link>
      <span className="text-xs font-semibold text-slate-500">{slotBids.length} bids</span>
      <StatusBadge status={slot.status} />
      <span className="text-xs font-bold text-slate-700">
        {result
          ? won
            ? `Cleared ${formatRupees(result.clearingPrice ?? 0)}`
            : "Unsold"
          : highest
            ? `Leading ${formatRupees(highest)}`
            : `Reserve ${formatRupees(slot.reservePrice)}`}
      </span>
      <span className="text-xs text-slate-400">
        {result?.winnerAdvertiserId ? getAdvertiser(result.winnerAdvertiserId)?.name : "—"}
      </span>
      {won && (
        <Link
          href={result?.creativeApprovalPending ? "/admin/creatives" : `/playback/${slotId}`}
          className={`rounded-lg px-3 py-2 text-center text-[11px] font-black ${result?.creativeApprovalPending ? "bg-amber-50 text-amber-700 hover:bg-amber-100" : "bg-emerald-500 text-white hover:bg-emerald-600"}`}
        >
          {result?.creativeApprovalPending ? "Needs creative review →" : "Watch it play →"}
        </Link>
      )}
    </div>
  );
}

function Section({
  title,
  hint,
  slotIds,
  data,
  accent,
}: {
  title: string;
  hint: string;
  slotIds: string[];
  data: AuctionData;
  accent?: "urgent";
}) {
  return (
    <section
      className={`rounded-2xl border p-5 shadow-sm ${accent === "urgent" ? "border-amber-200 bg-amber-50/40" : "border-slate-200 bg-white"}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className={`font-bold ${accent === "urgent" ? "text-amber-900" : "text-slate-950"}`}>{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold ${accent === "urgent" && slotIds.length ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-500"}`}
        >
          {slotIds.length}
        </span>
      </div>
      {slotIds.length === 0 ? (
        <p className="rounded-xl bg-white/70 p-5 text-sm text-slate-400">Nothing here right now.</p>
      ) : (
        <div className="space-y-2">
          {slotIds.map((slotId) => (
            <Row key={slotId} slotId={slotId} data={data} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function AuctionsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; q?: string }>;
}) {
  const { area = "", q = "" } = await searchParams;
  const query = q.trim().toLowerCase();
  const [slots, bids, billboards, results] = await Promise.all([
    getSlots(),
    getBids(),
    getBillboards(),
    getAuctionResults(),
  ]);
  const data: AuctionData = { slots, bids, billboards, results };
  const areaOptions = Array.from(new Set(billboards.map((billboard) => billboard.area))).sort();

  const matches = (slotId: string) => {
    const slot = slots.find((item) => item.id === slotId);
    if (!slot) return false;
    const billboard = billboards.find((item) => item.id === slot.billboardId);
    if (area && billboard?.area !== area) return false;
    if (query && !billboard?.name.toLowerCase().includes(query)) return false;
    return true;
  };

  const soldResults = results.filter((result) => result.status === "sold");
  const needsReview = soldResults
    .filter((result) => result.creativeApprovalPending)
    .slice()
    .sort((a, b) => b.closedAt.localeCompare(a.closedAt))
    .map((result) => result.slotId)
    .filter(matches);
  const readySold = soldResults
    .filter((result) => !result.creativeApprovalPending)
    .slice()
    .sort((a, b) => b.closedAt.localeCompare(a.closedAt))
    .map((result) => result.slotId)
    .filter(matches);
  const open = slots
    .filter((slot) => slot.status === "auction_open")
    .slice()
    .sort((a, b) => (a.auctionCloseTime ?? "").localeCompare(b.auctionCloseTime ?? ""))
    .map((slot) => slot.id)
    .filter(matches);
  const awaitingBids = slots
    .filter((slot) => slot.status === "available" && slot.published !== false)
    .map((slot) => slot.id)
    .filter(matches);
  const unsold = results
    .filter((result) => result.status === "unsold")
    .slice()
    .sort((a, b) => b.closedAt.localeCompare(a.closedAt))
    .map((result) => result.slotId)
    .filter(matches);

  return (
    <>
      <PageIntro
        eyebrow="Auction observatory"
        title="Every auction, live to closed."
        description="Closed-and-won auctions land here first. From there they either push straight to Play (creative already approved) or need a nudge to get the creative reviewed — once approved, they move to Play on their own."
        action={
          <Link href="/admin" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600">
            Back to operations
          </Link>
        }
      />
      <form className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search billboard name…"
          className="min-w-48 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400"
        />
        <select name="area" defaultValue={area} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
          <option value="">All areas</option>
          {areaOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">
          Filter
        </button>
        {(area || q) && (
          <Link href="/admin/auctions" className="text-xs font-bold text-slate-500 hover:text-slate-900">
            Clear filters
          </Link>
        )}
      </form>
      <div className="space-y-6">
        <Section
          title="Needs creative review"
          hint="Won the auction, waiting on an approval before it can play. Highest priority."
          slotIds={needsReview}
          data={data}
          accent="urgent"
        />
        <Section title="Open — bidding live" hint="Sorted by soonest to close." slotIds={open} data={data} />
        <Section title="Awaiting first bid" hint="Published, reserve set, nobody has bid yet." slotIds={awaitingBids} data={data} />
        <Section title="Closed — sold, ready to play" hint="Creative approved. Most recently closed first." slotIds={readySold} data={data} />
        <Section title="Closed — unsold" hint="No bid met reserve." slotIds={unsold} data={data} />
      </div>
    </>
  );
}
