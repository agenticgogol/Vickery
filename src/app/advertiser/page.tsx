import Link from "next/link";
import { getMarketplaceSlots, getBillboards, getBids, getSlots, getAuctionResults } from "@/lib/db";
import { PageIntro, StatusBadge } from "@/components/app-shell";
import { formatRupees } from "@/lib/data";
import { getAdvertiserDashboard } from "@/lib/dashboard";
import { MarketplaceGrid } from "./marketplace-grid";
import { CampaignNudge } from "./campaign-nudge";

export default async function AdvertiserPage() {
  const [inventory, billboards, allSlots, bids, auctionResults] = await Promise.all([
    getMarketplaceSlots(),
    getBillboards(),
    getSlots(),
    getBids(),
    getAuctionResults(),
  ]);
  const dashboard = getAdvertiserDashboard(bids, allSlots, billboards, auctionResults);

  return (
    <>
      <PageIntro
        eyebrow="Advertiser marketplace"
        title="Find the right screen time."
        description="Bid on a single slot right from its card below, or bid on several slots at once — manually or automatically — with a campaign."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <CampaignNudge />
            <Link
              href="/advertiser/bids"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600"
            >
              My bids
            </Link>
            <Link
              href="/advertiser/creatives"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600"
            >
              Creatives
            </Link>
          </div>
        }
      />
      <section className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-slate-200 py-3 text-sm">
        <span className="font-bold text-slate-900">Your activity</span>
        <span className="text-slate-500">
          <strong className="text-slate-900">{dashboard.activeBids}</strong>{" "}
          active bids
        </span>
        <span className="text-slate-500">
          <strong className="text-slate-900">{dashboard.outbidBids}</strong>{" "}
          outbid
        </span>
        <span className="text-slate-500">
          <strong className="text-slate-900">{dashboard.wins}</strong> wins
        </span>
        <span className="text-slate-500">
          <strong className="text-slate-900">
            {formatRupees(dashboard.totalSpend)}
          </strong>{" "}
          spent
        </span>
        <Link
          href="/advertiser/bids"
          className="font-bold text-cyan-700 hover:underline"
        >
          View activity →
        </Link>
      </section>
      {dashboard.upcomingPlacements.length > 0 && (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-600">
                Upcoming placements
              </p>
              <h2 className="mt-1 text-lg font-bold">Your winning inventory</h2>
            </div>
            <Link
              href="/advertiser/bids"
              className="text-xs font-bold text-cyan-700"
            >
              View bid activity →
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {dashboard.upcomingPlacements.map((placement) => (
              <div
                key={placement.slotId}
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-4"
              >
                <div>
                  <p className="text-sm font-bold">{placement.billboardName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {placement.area} · {placement.date} · {placement.startTime}–
                    {placement.endTime}
                  </p>
                  <Link
                    href={`/proof-of-play/${placement.slotId}`}
                    className="mt-2 inline-block text-xs font-bold text-cyan-700"
                  >
                    View proof of play →
                  </Link>
                </div>
                <StatusBadge status="sold" />
              </div>
            ))}
          </div>
        </section>
      )}
      <MarketplaceGrid slots={inventory} billboards={billboards} bids={bids} />
    </>
  );
}
