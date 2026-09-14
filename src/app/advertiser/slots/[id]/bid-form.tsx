"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Advertiser, Creative } from "@/lib/data";
import { formatRupees } from "@/lib/data";
import { submitBid as submitBidAction } from "@/lib/actions";
import { publishDataChange } from "@/lib/live-sync";

export function BidForm({ slotId, reservePrice, minimumBidIncrement = 0, creatives, advertisers, disabled = false }: { slotId: string; reservePrice: number; minimumBidIncrement?: number; creatives: Creative[]; advertisers: Advertiser[]; disabled?: boolean }) {
  const [advertiserId, setAdvertiserId] = useState(() => { if (typeof window !== "undefined") return window.localStorage.getItem("bx-demo-advertiser") ?? advertisers[1]?.id ?? advertisers[0]?.id ?? ""; return advertisers[1]?.id ?? advertisers[0]?.id ?? ""; });
  // Sealed-bid auction: the client only knows the reserve price, never the current leader's amount.
  // The server (submitBid) is the source of truth for whether a bid clears the real minimum.
  const minimumRequiredBid = reservePrice;
  const [amount, setAmount] = useState(String(minimumRequiredBid));
  const [creativeId, setCreativeId] = useState(creatives.find((creative) => creative.advertiserId === advertiserId)?.id ?? creatives[0]?.id ?? "");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<{ amount: number; creativeName: string } | null>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const advertiserCreatives = useMemo(() => creatives.filter((creative) => creative.advertiserId === advertiserId), [advertiserId, creatives]);

  function changeAdvertiser(nextId: string) {
    setAdvertiserId(nextId);
    window.localStorage.setItem("bx-demo-advertiser", nextId);
    const nextCreative = creatives.find((creative) => creative.advertiserId === nextId);
    if (nextCreative) setCreativeId(nextCreative.id);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const bidAmount = Number(amount);
    if (!Number.isFinite(bidAmount) || bidAmount < minimumRequiredBid) {
      setError(`Your bid must be at least ${formatRupees(minimumRequiredBid)}.`);
      setSubmitted(null);
      return;
    }
    const creative = creatives.find((item) => item.id === creativeId);
    startTransition(async () => {
      try {
        await submitBidAction({ slotId, advertiserId, amount: bidAmount, creativeId });
        publishDataChange("bid");
        setError("");
        setSubmitted({ amount: bidAmount, creativeName: creative?.name ?? "Selected creative" });
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Unable to submit bid.");
      }
    });
  }

  if (submitted) return <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5" role="status"><div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-sm font-black text-white">✓</span><div><p className="font-bold text-emerald-900">Bid submitted successfully</p><p className="mt-1 text-sm leading-6 text-emerald-800">{formatRupees(submitted.amount)} for {submitted.creativeName} is now <b>Pending auction</b>.</p><p className="mt-2 text-xs text-emerald-700">You’ll see the final winner and clearing price after the auction closes.</p></div></div><button type="button" onClick={() => setSubmitted(null)} className="mt-4 text-xs font-bold text-emerald-700 underline underline-offset-2">Submit another bid</button></div>;

  return <form onSubmit={submit} className="mt-6"><p className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-5 text-white/60">Quick path: choose an advertiser, enter your bid, and select a creative.</p><label className="block text-xs font-bold text-white/60">Advertiser<select value={advertiserId} onChange={(event) => changeAdvertiser(event.target.value)} disabled={disabled} className="mt-2 w-full rounded-xl border border-white/15 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none"><option value="" disabled>Select advertiser</option>{advertisers.map((advertiser) => <option key={advertiser.id} value={advertiser.id}>{advertiser.name}</option>)}</select></label><label className="mt-5 block text-xs font-bold text-white/60">Your bid amount<div className="mt-2 flex items-center rounded-xl border border-white/15 bg-white/5 px-4"><span className="text-white/40">₹</span><input required min={minimumRequiredBid} value={amount} onChange={(event) => setAmount(event.target.value)} disabled={disabled} type="number" className="w-full bg-transparent px-3 py-3 text-lg font-bold outline-none" /></div></label><label className="mt-5 block text-xs font-bold text-white/60">Select creative<select value={creativeId} onChange={(event) => setCreativeId(event.target.value)} disabled={disabled || advertiserCreatives.length === 0} className="mt-2 w-full rounded-xl border border-white/15 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none">{advertiserCreatives.map((creative) => <option key={creative.id} value={creative.id}>{creative.name}</option>)}</select></label>{error && <p className="mt-4 text-sm font-semibold text-red-300" role="alert">{error}</p>}<button disabled={disabled || isPending} className="mt-6 w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50">{isPending ? "Submitting bid…" : "Submit demo bid"}</button><p className="mt-4 text-center text-[11px] leading-5 text-white/40">Your bid must meet the reserve{minimumBidIncrement > 0 ? ` and clear the ${minimumBidIncrement}-rupee minimum increment over the current leader` : ""} to enter the auction.</p></form>;
}
