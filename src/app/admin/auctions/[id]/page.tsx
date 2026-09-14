import Link from "next/link";
import { notFound } from "next/navigation";
import { formatRupees, getAdvertiser, platformFeeRate } from "@/lib/data";
import { runAuction, getAuctionState } from "@/lib/auction";
import { PageIntro, StatusBadge } from "@/components/app-shell";
import { getAuctionResult, getSlot, getBidsForSlot, getBillboard } from "@/lib/db";
import { CloseAuctionButton } from "./close-auction-button";
import { AuctionCountdown } from "./auction-countdown";

const demoLabels: Record<string, string> = { "adv-megamart": "Advertiser A", "adv-quickfood": "Advertiser B", "adv-nova": "Advertiser C" };
const stateLabels = { scheduled: "Scheduled", open: "Open", closing: "Closing", closed: "Closed", unsold: "Unsold" } as const;

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slot = await getSlot(id);
  if (!slot) notFound();
  const billboard = await getBillboard(slot.billboardId);
  const auctionBids = await getBidsForSlot(slot.id);
  const outcome = runAuction(slot.reservePrice, auctionBids);
  const storedResult = await getAuctionResult(slot.id);
  const isFinalized = Boolean(storedResult);
  const auctionState = storedResult ? (storedResult.status === "unsold" ? "unsold" : "closed") : getAuctionState(slot.auctionCloseTime, slot.status, new Date(), 15, slot.auctionOpenTime);
  const eligibleBids = auctionBids.filter((bid) => bid.amount >= slot.reservePrice);
  const winner = outcome.winnerAdvertiserId ? getAdvertiser(outcome.winnerAdvertiserId) : undefined;
  const platformFee = (outcome.clearingPrice ?? 0) ? Math.round((outcome.clearingPrice ?? 0) * platformFeeRate) : 0;
  const ownerPayout = (outcome.clearingPrice ?? 0) - platformFee;
  const currentHighest = eligibleBids.slice().sort((a, b) => b.amount - a.amount || a.createdAt.localeCompare(b.createdAt))[0]?.amount ?? null;
  const closeTime = slot.auctionCloseTime;

  return <>
    <Link href="/admin/auctions" className="mb-6 inline-block text-sm font-bold text-slate-500 transition hover:text-slate-950">← Back to all auctions</Link>
    <PageIntro eyebrow="Management demo · auction control" title={`${billboard?.area} · ${slot.startTime}–${slot.endTime}`} description={`${billboard?.name} · ${slot.date} · Reserve price ${formatRupees(slot.reservePrice)}`} action={<div className="flex flex-wrap items-center gap-2"><StatusBadge status={auctionState === "closing" ? "auction_open" : auctionState === "closed" ? "sold" : auctionState} /><AuctionCountdown closeTime={closeTime} closed={isFinalized} slotId={slot.id} /></div>} />

    <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Current highest bid" value={currentHighest ? formatRupees(currentHighest) : "—"} detail={`${eligibleBids.length} eligible bids`} />
      <Stat label="Reserve price" value={formatRupees(slot.reservePrice)} detail="Minimum eligible bid" />
      <Stat label="Active bidders" value={String(new Set(auctionBids.map((bid) => bid.advertiserId)).size)} detail="Unique advertisers" />
      <Stat label="Auction close" value={closeTime ? new Date(closeTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Manual"} detail={`Increment ${formatRupees(slot.minimumBidIncrement ?? 0)}`} />
    </section>

    {outcome.status === "sold" ? <>
      <section className="relative overflow-hidden rounded-3xl bg-slate-950 p-7 text-white shadow-2xl shadow-slate-950/15 sm:p-9"><div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" /><div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">{isFinalized ? "Winner confirmed" : "Projected winner"}</p><div className="mt-3 flex items-center gap-4"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-400 text-xl font-black text-slate-950">{(winner?.name ?? "?").slice(0, 1)}</span><div><h2 className="text-3xl font-black tracking-tight sm:text-4xl">{demoLabels[winner?.id ?? ""] ?? winner?.name}</h2><p className="mt-1 text-sm text-white/55">Highest eligible bid · {slot.startTime}–{slot.endTime}</p></div></div><div className="mt-8 flex flex-wrap items-center gap-3 text-sm"><span className="rounded-lg bg-white/10 px-3 py-2 text-white/70">Winning bid <b className="ml-1 text-white">{formatRupees(outcome.winningBid ?? 0)}</b></span><span className="text-white/30">→</span><span className="rounded-lg bg-cyan-400/15 px-3 py-2 text-cyan-200">Pays <b className="ml-1 text-cyan-300">{formatRupees(outcome.clearingPrice ?? 0)}</b></span></div></div><div className="lg:text-right"><p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Clearing price</p><p className="mt-2 text-5xl font-black tracking-tight text-cyan-300">{formatRupees(outcome.clearingPrice ?? 0)}</p><p className="mt-2 text-sm text-white/50">Deterministic second-price auction</p></div></div></section>
      <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-bold">Auction waterfall</h2><p className="mt-1 text-xs text-slate-400">Only bids at or above reserve are eligible</p></div><span className="rounded-full bg-cyan-50 px-3 py-1.5 text-[11px] font-bold text-cyan-700">Transparent pricing</span></div><div className="mt-6 grid gap-2 sm:grid-cols-5">{[["Reserve", formatRupees(slot.reservePrice)], ["Highest bid", formatRupees(outcome.winningBid ?? 0)], ["2nd eligible", formatRupees(outcome.secondHighestBid ?? slot.reservePrice)], ["Clearing", formatRupees(outcome.clearingPrice ?? 0)], ["Owner payout", formatRupees(ownerPayout)]].map(([label, value], index) => <div key={label} className={`rounded-xl p-3 ${index === 3 ? "bg-cyan-50" : index === 4 ? "bg-emerald-50" : "bg-slate-50"}`}><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-2 text-lg font-black ${index === 3 ? "text-cyan-700" : index === 4 ? "text-emerald-700" : "text-slate-900"}`}>{value}</p></div>)}</div><p className="mt-4 text-sm leading-6 text-slate-500">The highest eligible bidder wins. The clearing price is the higher of the second-highest eligible bid and the reserve. Platform fee at {platformFeeRate * 100}% is <b>{formatRupees(platformFee)}</b>, leaving <b>{formatRupees(ownerPayout)}</b> for the owner.</p></div><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold">Auction controls</h2><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between"><span className="text-slate-500">Status</span><b>{stateLabels[auctionState]}</b></div><div className="flex justify-between"><span className="text-slate-500">Close time</span><b>{closeTime ? new Date(closeTime).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Manual close"}</b></div><div className="flex justify-between"><span className="text-slate-500">Anti-sniping</span><b>{slot.antiSnipingWindowMinutes ?? 0}m → +{slot.antiSnipingExtensionMinutes ?? 0}m</b></div></div>{isFinalized ? <Link href={`/playback/${slot.id}`} className="mt-6 block rounded-xl bg-cyan-400 px-4 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-cyan-300">View scheduled billboard →</Link> : <CloseAuctionButton slotId={slot.id} closed={false} />}</div></section>
    </> : <section className="rounded-2xl bg-slate-950 p-8 text-white"><p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">{isFinalized ? "Auction closed" : "No eligible bids"}</p><h2 className="mt-3 text-2xl font-bold">Slot remains unsold</h2><p className="mt-2 text-white/60">No bid met the {formatRupees(slot.reservePrice)} reserve price.</p></section>}

    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-bold">Bid timeline</h2><p className="mt-1 text-xs text-slate-400">Bidders are shown as demo labels in this competitive view.</p></div><span className="text-xs font-bold text-slate-400">{auctionBids.length} total bids · {new Set(auctionBids.map((bid) => bid.advertiserId)).size} active bidders</span></div><div className="mt-5 space-y-3">{auctionBids.length === 0 ? <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No bids yet. The auction will remain unsold unless a bid meets reserve.</p> : auctionBids.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((bid, index) => { const eligible = bid.amount >= slot.reservePrice; return <div key={bid.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-xs font-black text-slate-500">{index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold">{demoLabels[bid.advertiserId] ?? "Bidder"}</p><span className={`rounded-full px-2 py-1 text-[10px] font-black ${eligible ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{eligible ? "Eligible" : "Below reserve"}</span></div><p className="mt-1 text-xs text-slate-400">Submitted {new Date(bid.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p></div><p className="text-lg font-black">{formatRupees(bid.amount)}</p></div>; })}</div></section>
  </>;
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-3 text-2xl font-black tracking-tight">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></div>; }
