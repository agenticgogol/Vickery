import Link from "next/link";
import { notFound } from "next/navigation";
import {
  advertisers,
  bids,
  billboards,
  creatives,
  formatRupees,
  getSlotBillboard,
  slots,
} from "@/lib/data";
import { PageIntro, StatusBadge } from "@/components/app-shell";
import { BidForm } from "./bid-form";
import { getAuctionState } from "@/lib/auction";
import { getInventoryContextTags, getTimeOfDay } from "@/lib/marketplace";
import { estimateSlotReach } from "@/lib/reach-estimator";
import { estimateQualifiedReach } from "@/lib/qualified-reach-efficiency";
import { AuctionCountdown } from "@/app/admin/auctions/[id]/auction-countdown";
import { getSession, USER_ADVERTISER_MAP } from "@/lib/session";
import { Billboard3DView } from "@/app/advertiser/billboard-3d-view";

export default async function SlotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const slot = slots.find((item) => item.id === id);
  if (!slot) notFound();
  const billboard = getSlotBillboard(slot);
  // Sealed-bid auction: advertisers never see other bidders' amounts or the current
  // leader pre-close — only the reserve, the increment, and their own bid history.
  const session = await getSession();
  const viewerAdvertiserId = session ? USER_ADVERTISER_MAP[session.userId] : undefined;
  const myBids = bids
    .filter((bid) => bid.slotId === slot.id && bid.advertiserId === viewerAdvertiserId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const auctionState = getAuctionState(
    slot.auctionCloseTime,
    slot.status,
    new Date(),
    15,
    slot.auctionOpenTime,
  );
  const stateBadge =
    auctionState === "scheduled" || auctionState === "open"
      ? "available"
      : auctionState === "closing"
        ? "auction_open"
        : auctionState;
  const contextTags = getInventoryContextTags(slot, billboard);
  const reachEstimate = billboard ? estimateSlotReach(slot, billboard) : null;
  const qualifiedEstimate = estimateQualifiedReach(slot, billboard);
  const canBid =
    slot.published !== false &&
    (slot.status === "available" || slot.status === "auction_open") &&
    (auctionState === "open" || auctionState === "closing");
  return (
    <>
      <Link
        href="/advertiser"
        className="mb-6 inline-block text-sm font-bold text-slate-500 transition hover:text-slate-950"
      >
        ← Back to marketplace
      </Link>
      <PageIntro
        eyebrow="Bid Now · single-slot buying"
        title={billboard?.name ?? "Billboard slot"}
        description={`${billboard?.area}, ${billboard?.city} · Bid directly on this specific billboard slot in three quick steps.`}
        action={<StatusBadge status={slot.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="relative flex h-64 items-end overflow-hidden bg-gradient-to-br from-slate-950 via-cyan-900 to-blue-600 p-7 text-white">
              {billboard?.imageUrl ? (
                <img
                  src={billboard.imageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-60"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 to-transparent" />
              <div className="relative z-10">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
                  Digital billboard · {billboard?.qualityTier}
                </p>
                <p className="mt-2 text-3xl font-black">{billboard?.area}</p>
                <p className="mt-2 text-sm text-white/60">
                  {billboard?.latitude.toFixed(4)}° N ·{" "}
                  {billboard?.longitude.toFixed(4)}° E
                </p>
              </div>
            </div>
            <div className="border-t border-slate-100 px-6 py-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Full location context
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {contextTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid gap-5 p-6 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-400">Audience profile</p>
                <p className="mt-2 text-sm font-bold leading-5">
                  {billboard?.audienceProfile}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Daily impressions</p>
                <p className="mt-2 text-xl font-bold">
                  {((billboard?.estimatedDailyTraffic ?? 0) / 1000).toFixed(0)}K
                </p>
                <p className="mt-1 text-xs text-slate-400">Estimated traffic</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Screen format</p>
                <p className="mt-2 text-sm font-bold">
                  {billboard?.dimensions}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {billboard?.screenType}
                </p>
              </div>
            </div>
          </div>
          {billboard && (
            <Billboard3DView
              billboard={billboard}
              nearby={billboards.filter((item) => item.city === billboard.city)}
              creatives={creatives.filter((creative) => creative.advertiserId === viewerAdvertiserId)}
            />
          )}
          {reachEstimate && (
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/50 p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
                    Estimated delivery
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    Planning reach for this slot
                  </h2>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-700">
                  Estimated
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MiniStat
                  label="Estimated reach"
                  value={`${reachEstimate.impressions.toLocaleString("en-IN")}`}
                />
                <MiniStat
                  label="Estimated cost"
                  value={formatRupees(reachEstimate.cost)}
                />
                <MiniStat
                  label="Estimated CPM"
                  value={
                    reachEstimate.cpm === null
                      ? "—"
                      : formatRupees(Math.round(reachEstimate.cpm))
                  }
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Planning estimate based on daily traffic, one-hour duration,{" "}
                {reachEstimate.timeMultiplier}×{" "}
                {getTimeOfDay(slot.startTime).toLowerCase()} visibility, and{" "}
                {reachEstimate.qualityFactor}× screen quality. This is not
                audited audience measurement.
              </p>
            </div>
          )}
          <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">
              Qualified Reach Efficiency
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              Relevant audience exposure for this spend
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MiniStat
                label="Est. Qualified Reach (i)"
                value={qualifiedEstimate.estimatedQualifiedImpressions.toLocaleString(
                  "en-IN",
                )}
              />
              <MiniStat
                label="Reach Efficiency (i)"
                value={`${Math.round(qualifiedEstimate.qualifiedReachEfficiency)} / ₹1K`}
              />
              <MiniStat
                label="Est. Qualified CPM (i)"
                value={
                  qualifiedEstimate.estimatedQualifiedCpm === null
                    ? "—"
                    : formatRupees(
                        Math.round(qualifiedEstimate.estimatedQualifiedCpm),
                      )
                }
              />
            </div>
            <details className="mt-4 rounded-xl bg-white/80 p-4 text-xs text-slate-700">
              <summary className="cursor-pointer font-bold text-violet-800">
                How is this calculated? · View calculation
              </summary>
              <p className="mt-3">
                Estimated Qualified Reach = Slot Traffic × Visibility Factor ×
                Audience Match × Ad Share × Context Factor.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-y-1">
                <span>Slot traffic</span>
                <b>{qualifiedEstimate.slotTraffic.toLocaleString("en-IN")}</b>
                <span>Visibility factor</span>
                <b>{qualifiedEstimate.visibilityFactor.toFixed(2)}</b>
                <span>Audience match</span>
                <b>{qualifiedEstimate.audienceMatchFactor.toFixed(2)}</b>
                <span>Ad share</span>
                <b>{qualifiedEstimate.adShareFactor.toFixed(2)}</b>
                <span>Context factor</span>
                <b>{qualifiedEstimate.contextFactor.toFixed(2)}</b>
                <span>Estimate Confidence</span>
                <b>{qualifiedEstimate.confidence}</b>
              </div>
              <p className="mt-3">
                Reach Efficiency = Estimated Qualified Reach / Expected Cost ×
                1,000. Qualified CPM = Expected Cost / Estimated Qualified Reach
                × 1,000.
              </p>
              <p className="mt-2 text-slate-500">
                These are planning estimates based on available traffic and
                audience data, not audited or guaranteed impressions.
              </p>
            </details>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">
                  {slot.status === "auction_open"
                    ? "Live auction"
                    : "Slot opportunity"}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  {slot.date} · {slot.startTime}–{slot.endTime}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={stateBadge} />
                <AuctionCountdown
                  closeTime={slot.auctionCloseTime}
                  closed={auctionState === "closed"}
                  slotId={slot.id}
                />
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <MiniStat
                label="Reserve"
                value={formatRupees(slot.reservePrice)}
              />
              <MiniStat
                label="Minimum bid increment"
                value={
                  slot.minimumBidIncrement
                    ? formatRupees(slot.minimumBidIncrement)
                    : "—"
                }
              />
            </div>
            <div className="mt-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Your bid history on this slot
              </p>
              {myBids.length ? (
                myBids.map((bid) => (
                  <div
                    key={bid.id}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                  >
                    <span className="text-sm font-semibold text-slate-500">
                      {new Date(bid.createdAt).toLocaleString("en-IN")}
                    </span>
                    <span className="text-sm font-bold">
                      {formatRupees(bid.amount)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  {viewerAdvertiserId
                    ? "You haven't bid on this slot yet. This is a sealed-bid auction — other advertisers' bids stay private until the auction closes."
                    : "This is a sealed-bid auction. Sign in as an advertiser to see your own bid history here."}
                </p>
              )}
            </div>
          </div>
        </section>
        <aside className="h-fit rounded-2xl bg-slate-950 p-6 text-white shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
            {canBid ? "Place your bid" : "Bidding closed"}
          </p>
          <h2 className="mt-3 text-2xl font-bold">
            {slot.startTime}–{slot.endTime}
          </h2>
          <p className="mt-2 text-sm text-white/50">
            {slot.date} · Reserve {formatRupees(slot.reservePrice)}
            {slot.minimumBidIncrement
              ? ` · Min. increment ${formatRupees(slot.minimumBidIncrement)}`
              : ""}
          </p>
          {canBid ? (
            <BidForm
              slotId={slot.id}
              reservePrice={slot.reservePrice}
              minimumBidIncrement={slot.minimumBidIncrement ?? 0}
              creatives={creatives}
              advertisers={advertisers}
            />
          ) : (
            <div className="mt-7 rounded-xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/60">
              This slot is no longer accepting bids. Browse available inventory
              for your next campaign.
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}
