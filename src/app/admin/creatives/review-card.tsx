"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { reviewCreative } from "@/lib/actions";
import type { Creative } from "@/lib/data";
import { publishDataChange } from "@/lib/live-sync";

const checklistItems = [
  "No political content",
  "No sensitive/illegal content",
  "Format/duration compatible with target screens",
];

export function ReviewCard({ creative, advertiserName }: { creative: Creative; advertiserName: string }) {
  const [reason, setReason] = useState(""); const [message, setMessage] = useState(""); const [isPending, startTransition] = useTransition();
  const [checked, setChecked] = useState<boolean[]>(checklistItems.map(() => false));
  const allChecked = checked.every(Boolean);
  function toggle(index: number) { setChecked((prev) => prev.map((value, i) => (i === index ? !value : value))); }
  function review(status: "approved" | "rejected") { setMessage(""); startTransition(async () => { try { await reviewCreative(creative.id, status, reason); publishDataChange("creative"); setMessage(status === "approved" ? "Approved." : "Rejected."); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to review creative."); } }); }
  return <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[220px_1fr]"><Image src={creative.imageUrl} alt={creative.name} width={440} height={220} unoptimized className="h-28 w-full rounded-xl object-cover" /><div><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold">{creative.name}</h2><p className="mt-1 text-xs text-slate-500">{advertiserName} · {creative.width} × {creative.height}px</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">Pending Review</span></div><div className="mt-4 space-y-1.5">{checklistItems.map((item, index) => <label key={item} className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={checked[index]} onChange={() => toggle(index)} className="h-3.5 w-3.5" />{item}</label>)}</div><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Rejection reason (required only when rejecting)" className="mt-4 min-h-16 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-cyan-400" /><div className="mt-3 flex gap-2"><button type="button" onClick={() => review("approved")} disabled={isPending || !allChecked} title={allChecked ? undefined : "Tick every checklist item before approving"} className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Approve</button><button type="button" onClick={() => review("rejected")} disabled={isPending} className="rounded-xl bg-red-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Reject</button>{message && <span role="status" className="self-center text-xs font-semibold text-slate-500">{message}</span>}</div></div></div>;
}
