import Link from "next/link";
import { formatRupees } from "@/lib/data";
import { getBillboards, getSlots, getBids, getAuctionResults } from "@/lib/db";

function formatCompact(value: number) {
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return String(value);
}

export default async function Home() {
  const [billboards, slots, bids, auctionResults] = await Promise.all([
    getBillboards(),
    getSlots(),
    getBids(),
    getAuctionResults(),
  ]);
  const openSlots = slots.filter((slot) => slot.status === "available").length;
  const gmv = auctionResults
    .filter((result) => result.status === "sold")
    .reduce((total, result) => total + (result.clearingPrice ?? 0), 0);
  const liveAuction = slots
    .filter((slot) => slot.status === "auction_open")
    .slice()
    .sort((a, b) => (a.auctionCloseTime ?? "").localeCompare(b.auctionCloseTime ?? ""))[0];
  const liveBillboard = liveAuction ? billboards.find((item) => item.id === liveAuction.billboardId) : undefined;
  const liveBids = liveAuction ? bids.filter((bid) => bid.slotId === liveAuction.id) : [];
  const topBid = liveBids.reduce((max, bid) => Math.max(max, bid.amount), 0);

  return (
    <div className="grid min-h-[calc(100vh-8rem)] items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
      <section>
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
          Live inventory network · Hyderabad
        </div>
        <h1 className="max-w-3xl text-5xl font-bold leading-[1.04] tracking-[-0.04em] text-slate-950 sm:text-7xl">
          The city is your <span className="text-cyan-600">canvas.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-slate-500">
          A transparent marketplace for premium digital billboard inventory. Release a slot, let brands compete, and make every impression count.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/owner" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5">
            Open owner portal <span className="ml-2">→</span>
          </Link>
          <Link href="/advertiser" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-300">
            Browse inventory
          </Link>
        </div>
        <div className="mt-12 grid max-w-xl grid-cols-3 gap-5 border-t border-slate-200 pt-6">
          <div>
            <p className="text-2xl font-bold">{billboards.length}</p>
            <p className="mt-1 text-xs text-slate-400">Screens live</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{openSlots}</p>
            <p className="mt-1 text-xs text-slate-400">Open slots</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{formatRupees(gmv)}</p>
            <p className="mt-1 text-xs text-slate-400">GMV cleared</p>
          </div>
        </div>
      </section>
      <section className="relative">
        <div className="absolute -inset-5 rounded-[2rem] bg-cyan-100/50 blur-3xl" />
        {liveAuction && liveBillboard ? (
          <div className="relative overflow-hidden rounded-[1.75rem] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-950/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Live auction preview</p>
                <p className="mt-2 text-lg font-bold">{liveBillboard.name}</p>
              </div>
              <span className="rounded-full bg-amber-400/15 px-3 py-1.5 text-xs font-bold text-amber-300">Auction open</span>
            </div>
            <div className="my-8 rounded-xl border border-white/10 bg-gradient-to-br from-cyan-400 via-blue-600 to-violet-700 p-7">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/60">
                {liveAuction.date} · {liveAuction.startTime}–{liveAuction.endTime}
              </p>
              <p className="mt-8 text-4xl font-black tracking-tight">
                Make your
                <br />
                moment move.
              </p>
              <div className="mt-12 flex items-end justify-between">
                <span className="text-xs text-white/70">Reserve price</span>
                <span className="text-xl font-bold">{formatRupees(liveAuction.reservePrice)}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-xs text-white/50">Bids</p>
                <p className="mt-1 text-xl font-bold">{String(liveBids.length).padStart(2, "0")}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-xs text-white/50">Top bid</p>
                <p className="mt-1 text-xl font-bold">{topBid ? `₹${formatCompact(topBid)}` : "—"}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-xs text-white/50">Traffic</p>
                <p className="mt-1 text-xl font-bold">{formatCompact(liveBillboard.estimatedDailyTraffic)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-[1.75rem] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-950/20">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Live auction preview</p>
            <p className="mt-6 text-2xl font-black">No auction is live right now.</p>
            <p className="mt-3 text-sm text-white/60">Release a slot as an owner to see it bid here in real time.</p>
            <Link href="/owner" className="mt-6 inline-flex rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950">
              Release a slot →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
