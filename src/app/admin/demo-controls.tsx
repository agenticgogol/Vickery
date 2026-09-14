"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateSampleBids, resetDemo } from "@/lib/actions";
import { publishDataChange } from "@/lib/live-sync";
import type { Bid, Slot } from "@/lib/data";

export function DemoControls({ slots, bids }: { slots: Slot[]; bids: Bid[] }) {
  const router = useRouter();
  const [selectedSlotId, setSelectedSlotId] = useState(slots[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  function sampleBids() { setMessage(""); startTransition(async () => { try { await generateSampleBids(selectedSlotId); publishDataChange("bid"); setMessage("Sample bids added. Open the auction to inspect the timeline."); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to generate sample bids."); } }); }
  function reset() { setMessage(""); startTransition(async () => { await resetDemo(); publishDataChange("reset"); setMessage("Seeded demo restored."); router.refresh(); }); }
  return <section className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-5"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Demo controls</p><h2 className="mt-1 font-bold text-violet-950">Experiment or reset in one click</h2><p className="mt-1 text-xs text-violet-800/70">Use normal marketplace actions to explore alternate slots, then restore the scripted Hyderabad scenario anytime.</p></div><div className="flex flex-wrap items-center gap-2"><select value={selectedSlotId} onChange={(event) => setSelectedSlotId(event.target.value)} className="rounded-xl border border-violet-200 bg-white px-3 py-3 text-xs font-bold text-slate-700 outline-none" aria-label="Choose slot for sample bids">{slots.map((slot) => <option key={slot.id} value={slot.id}>{slot.date} · {slot.startTime} · {slot.id.includes("cyber") ? "HITEC City" : slot.id}</option>)}</select><button type="button" onClick={sampleBids} disabled={isPending || !selectedSlotId || bids.some((bid) => bid.slotId === selectedSlotId)} className="rounded-xl bg-violet-700 px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{isPending ? "Working…" : "Generate sample bids"}</button><button type="button" onClick={reset} disabled={isPending} className="rounded-xl border border-violet-200 bg-white px-4 py-3 text-xs font-black text-violet-800 disabled:opacity-50">Reset seeded demo</button></div></div>{message && <p role="status" className="mt-3 text-xs font-bold text-violet-800">✓ {message}</p>}</section>;
}
