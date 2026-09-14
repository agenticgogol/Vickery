import Link from "next/link";
import { formatRupees } from "@/lib/data";
import { getBids, getSlots, getBillboards, getAuctionResults } from "@/lib/db";
import { PageIntro } from "@/components/app-shell";
import { getCurrentAuctionState, getBidStatus, type BidStatus } from "@/lib/bid-status";
import { getSession, USER_ADVERTISER_MAP } from "@/lib/session";

// Pre-close, only the bidder's own eligibility is shown — never whether another bid is ahead of theirs (closed-bid auction).
type DisplayStatus = "Won" | "Lost" | "Pending" | "Ineligible";
const displayStatus = (status: BidStatus, closed: boolean): DisplayStatus =>
  status === "Leading" || status === "Outbid" ? (closed ? "Lost" : "Pending") : status;
const statusStyles: Record<DisplayStatus, string> = { Won: "bg-emerald-50 text-emerald-700", Lost: "bg-slate-100 text-slate-500", Pending: "bg-cyan-50 text-cyan-700", Ineligible: "bg-red-50 text-red-600" };
const auctionStyles: Record<string, string> = { scheduled: "bg-violet-50 text-violet-700", open: "bg-emerald-50 text-emerald-700", closing: "bg-orange-50 text-orange-700", closed: "bg-slate-100 text-slate-500", unsold: "bg-slate-100 text-slate-500" };

export default async function AdvertiserBidsPage() {
  const session = await getSession();
  const viewerAdvertiserId = session ? USER_ADVERTISER_MAP[session.userId] : undefined;
  const [allBids, slots, billboards, auctionResults] = await Promise.all([
    getBids(),
    getSlots(),
    getBillboards(),
    getAuctionResults(),
  ]);
  const bids = viewerAdvertiserId ? allBids.filter((bid) => bid.advertiserId === viewerAdvertiserId) : [];
  return (
    <>
      <PageIntro
        eyebrow="Advertiser workspace"
        title="Bid activity."
        description="Track every submitted bid, see who is leading, and follow outcomes across the Hyderabad network."
        action={
          <Link href="/advertiser" className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">
            Browse inventory
          </Link>
        }
      />
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[minmax(220px,1.5fr)_minmax(150px,1fr)_100px_110px_110px] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400 md:grid">
          <span>Inventory</span>
          <span>Auction</span>
          <span>Your bid</span>
          <span>Bid status</span>
          <span>Opportunity</span>
        </div>
        <div className="divide-y divide-slate-100">
          {bids.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-bold text-slate-900">No bids yet</p>
              <p className="mt-2 text-sm text-slate-500">Explore live inventory and place your first bid.</p>
              <Link href="/advertiser" className="mt-5 inline-block rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">
                Explore inventory
              </Link>
            </div>
          ) : (
            bids
              .slice()
              .reverse()
              .map((bid) => {
                const slot = slots.find((item) => item.id === bid.slotId);
                if (!slot) return null;
                const billboard = billboards.find((item) => item.id === slot.billboardId);
                const result = auctionResults.find((item) => item.slotId === slot.id);
                const ownSlotBids = bids.filter((item) => item.slotId === slot.id);
                const rawStatus = getBidStatus(bid, slot, allBids.filter((item) => item.slotId === slot.id), result);
                const auctionState = getCurrentAuctionState(slot, result);
                const status = displayStatus(rawStatus, auctionState === "closed" || auctionState === "unsold");
                return (
                  <Link
                    href={`/advertiser/slots/${slot.id}`}
                    key={bid.id}
                    className="grid gap-4 p-5 transition hover:bg-cyan-50/40 md:grid-cols-[minmax(220px,1.5fr)_minmax(150px,1fr)_100px_110px_110px] md:items-center"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900">{billboard?.name}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {billboard?.area} · {slot.date} · {slot.startTime}–{slot.endTime}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{bid.createdAt.slice(0, 10)}</p>
                    </div>
                    <div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${auctionStyles[auctionState]}`}>
                        {auctionState[0].toUpperCase() + auctionState.slice(1)}
                      </span>
                      <p className="mt-2 text-xs text-slate-400">
                        {ownSlotBids.length} of your bid{ownSlotBids.length === 1 ? "" : "s"} · reserve {formatRupees(slot.reservePrice)}
                      </p>
                    </div>
                    <p className="text-sm font-black text-slate-900">{formatRupees(bid.amount)}</p>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyles[status]}`}>{status}</span>
                    <span className="text-xs font-bold text-cyan-600">View auction →</span>
                  </Link>
                );
              })
          )}
        </div>
      </section>
    </>
  );
}
