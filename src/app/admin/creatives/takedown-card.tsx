"use client";

import { useState, useTransition } from "react";
import { takedownCreative } from "@/lib/actions";
import type { Creative } from "@/lib/data";
import { publishDataChange } from "@/lib/live-sync";

export function TakedownCard({ creative, advertiserName }: { creative: Creative; advertiserName: string }) {
  const [reason, setReason] = useState(""); const [message, setMessage] = useState(""); const [isPending, startTransition] = useTransition();
  function takedown() { setMessage(""); startTransition(async () => { try { await takedownCreative(creative.id, reason); publishDataChange("creative"); setMessage("Taken down."); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to take down creative."); } }); }
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div><p className="text-sm font-bold">{creative.name}</p><p className="mt-1 text-xs text-slate-500">{advertiserName} · Approved</p></div><div className="flex items-center gap-2"><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Takedown reason" className="min-w-40 rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none" /><button type="button" onClick={takedown} disabled={isPending || !reason.trim()} className="rounded-xl bg-red-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Take down</button>{message && <span role="status" className="text-xs font-semibold text-slate-500">{message}</span>}</div></div>;
}
