import Link from "next/link";
import { PageIntro } from "@/components/app-shell";
import { advertisers } from "@/lib/data";
import { getCreatives } from "@/lib/db";
import { ReviewCard } from "./review-card";
import { TakedownCard } from "./takedown-card";

export default async function AdminCreativesPage() {
  const creatives = await getCreatives();
  const pending = creatives.filter((creative) => (creative.status ?? "approved") === "pending_review");
  const approved = creatives.filter((creative) => (creative.status ?? "approved") === "approved");
  return (
    <>
      <PageIntro
        eyebrow="Marketplace operations"
        title="Creative review."
        description="Approve or reject advertiser assets before they can be attached to bids."
        action={
          <Link href="/admin" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600">
            Back to operations
          </Link>
        }
      />
      {pending.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="font-bold">Review queue is clear</p>
          <p className="mt-2 text-sm text-slate-500">New advertiser uploads will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((creative) => (
            <ReviewCard
              key={creative.id}
              creative={creative}
              advertiserName={advertisers.find((advertiser) => advertiser.id === creative.advertiserId)?.name ?? "Advertiser"}
            />
          ))}
        </div>
      )}
      <h2 className="mt-10 text-sm font-black uppercase tracking-[0.14em] text-slate-500">Live creatives</h2>
      {approved.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No approved creatives yet.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {approved.map((creative) => (
            <TakedownCard
              key={creative.id}
              creative={creative}
              advertiserName={advertisers.find((advertiser) => advertiser.id === creative.advertiserId)?.name ?? "Advertiser"}
            />
          ))}
        </div>
      )}
    </>
  );
}
