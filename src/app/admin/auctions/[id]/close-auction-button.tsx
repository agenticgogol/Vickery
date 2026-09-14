"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { closeAuction } from "@/lib/actions";
import { publishDataChange } from "@/lib/live-sync";

export function CloseAuctionButton({ slotId, closed }: { slotId: string; closed: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function close() { setError(""); startTransition(async () => { try { await closeAuction(slotId); publishDataChange("auction"); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to close this auction."); } }); }
  return <div className="mt-6"><button type="button" onClick={close} disabled={closed || isPending} className="w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50">{closed ? "Auction closed & creative scheduled" : isPending ? "Closing auction…" : "Close auction & schedule creative"}</button>{error && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{error}</p>}</div>;
}
