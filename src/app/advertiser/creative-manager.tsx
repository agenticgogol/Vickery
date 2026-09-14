"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import type { Advertiser, Creative, CreativeStatus } from "@/lib/data";
import { createCreative, type CreativeInput } from "@/lib/actions";
import { publishDataChange, subscribeToDataChanges } from "@/lib/live-sync";

const statusLabel: Record<CreativeStatus, string> = { draft: "Draft", pending_review: "Pending Review", approved: "Approved", rejected: "Rejected" };
const statusStyle: Record<CreativeStatus, string> = { draft: "bg-slate-100 text-slate-600", pending_review: "bg-amber-50 text-amber-700", approved: "bg-emerald-50 text-emerald-700", rejected: "bg-red-50 text-red-600" };

export function CreativeManager({ initialCreatives, advertisers }: { initialCreatives: Creative[]; advertisers: Advertiser[] }) {
  const [creatives, setCreatives] = useState(initialCreatives);
  const [selectedAdvertiser, setSelectedAdvertiser] = useState(advertisers[1]?.id ?? advertisers[0]?.id ?? "");
  const [name, setName] = useState("");
  const [pending, setPending] = useState<CreativeInput | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  useEffect(() => subscribeToDataChanges(() => window.location.reload()), []);

  function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setMessage("Use a JPG, PNG, or WebP image."); return; }
    if (file.size > 3_000_000) { setMessage("Creative must be under 3 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => { const image = new window.Image(); image.onload = () => { const payload: CreativeInput = { advertiserId: selectedAdvertiser, name: name.trim() || file.name.replace(/\.[^.]+$/, ""), imageUrl: String(reader.result), mimeType: file.type, fileSizeBytes: file.size, width: image.naturalWidth, height: image.naturalHeight }; setPending(payload); setMessage(image.naturalWidth >= 640 && image.naturalHeight >= 320 && Math.abs(image.naturalWidth / image.naturalHeight - 2) <= 0.03 ? "" : "Creative must be at least 640 × 320 pixels with a 2:1 aspect ratio."); }; image.src = String(reader.result); };
    reader.readAsDataURL(file);
  }

  function save(status: "draft" | "pending_review") {
    if (!pending) { setMessage("Choose an image first."); return; }
    if (message) return;
    startTransition(async () => { try { const created = await createCreative({ ...pending, name: name.trim() || pending.name, status }); setCreatives((current) => [created, ...current]); setPending(null); setName(""); setMessage(status === "draft" ? "Creative saved as draft." : "Creative submitted for review."); publishDataChange("creative"); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save creative."); } });
  }

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"><section className="space-y-4">{creatives.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">No creatives yet. Upload one to start bidding.</div> : creatives.map((creative) => <div key={creative.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row"><div className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:w-56"><Image src={creative.imageUrl} alt={creative.name} fill sizes="224px" unoptimized className="object-cover" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">{creative.name}</h2><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyle[creative.status ?? "approved"]}`}>{statusLabel[creative.status ?? "approved"]}</span></div><p className="mt-2 text-xs text-slate-500">{advertisers.find((advertiser) => advertiser.id === creative.advertiserId)?.name} · {creative.width && creative.height ? `${creative.width} × ${creative.height}px` : "Seeded creative"} · {creative.mimeType ?? "Demo asset"}</p>{creative.rejectionReason && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">Reason: {creative.rejectionReason}</p>}<p className="mt-3 text-xs text-slate-400">{creative.status === "approved" || !creative.status ? "Ready to reuse across bids." : creative.status === "rejected" ? "Update the asset and submit a new version." : "Review status updates will appear here."}</p></div></div>)}</section><section className="h-fit rounded-2xl bg-slate-950 p-5 text-white shadow-xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Creative studio</p><h2 className="mt-2 text-2xl font-bold">Upload campaign art</h2><p className="mt-2 text-sm leading-6 text-white/55">Use a 2:1 landscape asset for the virtual billboard preview.</p><label className="mt-5 block text-xs font-bold text-white/60">Advertiser<select value={selectedAdvertiser} onChange={(event) => setSelectedAdvertiser(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-white px-3 py-3 text-sm font-semibold text-slate-900"><option value="" disabled>Select advertiser</option>{advertisers.map((advertiser) => <option key={advertiser.id} value={advertiser.id}>{advertiser.name}</option>)}</select></label><label className="mt-4 block text-xs font-bold text-white/60">Creative name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Monsoon launch" className="mt-2 w-full rounded-xl border border-white/15 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none" /></label><label className="mt-4 block text-xs font-bold text-white/60">Image file<input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} className="mt-2 block w-full text-xs text-white/60 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-400 file:px-3 file:py-2 file:text-xs file:font-bold file:text-slate-950" /></label>{pending && <div className="mt-4 overflow-hidden rounded-xl border border-white/10"><Image src={pending.imageUrl} alt="Creative preview" width={640} height={320} unoptimized className="h-40 w-full object-cover" /><p className="px-3 py-2 text-xs text-white/60">{pending.width} × {pending.height}px · Ready to save</p></div>}{message && <p role="alert" className="mt-4 text-sm font-semibold text-amber-300">{message}</p>}<div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => save("draft")} disabled={isPending || !pending || Boolean(message)} className="rounded-xl border border-white/15 px-3 py-3 text-xs font-bold text-white disabled:opacity-40">{isPending ? "Saving…" : "Save draft"}</button><button type="button" onClick={() => save("pending_review")} disabled={isPending || !pending || Boolean(message)} className="rounded-xl bg-cyan-400 px-3 py-3 text-xs font-black text-slate-950 disabled:opacity-40">Submit for review</button></div></section></div>;
}
