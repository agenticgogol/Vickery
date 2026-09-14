import Link from "next/link";
import { PageIntro } from "@/components/app-shell";
import { getBillboards } from "@/lib/db";
import { BillboardReviewCard } from "./billboard-review-card";

export default async function AdminInventoryPage() {
  const billboards = await getBillboards();
  const pending = billboards.filter((billboard) => (billboard.verificationStatus ?? "pending") === "pending");
  return (
    <>
      <PageIntro
        eyebrow="Marketplace operations"
        title="Inventory verification."
        description="Verify a billboard's hardware details before its slots can be published to the marketplace."
        action={
          <Link href="/admin" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600">
            Back to operations
          </Link>
        }
      />
      {pending.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="font-bold">Review queue is clear</p>
          <p className="mt-2 text-sm text-slate-500">New or edited billboards will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((billboard) => (
            <BillboardReviewCard key={billboard.id} billboard={billboard} />
          ))}
        </div>
      )}
    </>
  );
}
