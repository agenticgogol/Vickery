import Link from "next/link";
import { PageIntro } from "@/components/app-shell";
import { getAdvertiser } from "@/lib/data";
import { getSettlements, getAuctionResults, getBillboards, getSlots } from "@/lib/db";
import { SettlementRow } from "./settlement-row";

export default async function SettlementsPage() {
  const [settlements, results, slots, billboards] = await Promise.all([
    getSettlements(),
    getAuctionResults(),
    getSlots(),
    getBillboards(),
  ]);
  return (
    <>
      <PageIntro
        eyebrow="Marketplace operations"
        title="Settlement ledger."
        description="Track cleared auction economics and manually move settlements through payment states."
        action={
          <Link href="/admin" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600">
            Back to operations
          </Link>
        }
      />
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-500">
          {settlements.length} cleared settlement{settlements.length === 1 ? "" : "s"} · No payment gateway connected
        </div>
        {settlements.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-bold">No cleared auctions yet</p>
            <p className="mt-2 text-sm text-slate-500">Close a sold auction to create its settlement ledger entry.</p>
          </div>
        ) : (
          settlements.map((settlement) => {
            const slot = slots.find((item) => item.id === settlement.slotId);
            const billboard = slot ? billboards.find((item) => item.id === slot.billboardId) : undefined;
            const result = results.find((item) => item.slotId === settlement.slotId);
            return (
              <SettlementRow
                key={settlement.id}
                settlement={settlement}
                billboardName={billboard?.name ?? "Billboard"}
                advertiserName={result?.winnerAdvertiserId ? getAdvertiser(result.winnerAdvertiserId)?.name ?? "Advertiser" : "Advertiser"}
              />
            );
          })
        )}
      </section>
    </>
  );
}
