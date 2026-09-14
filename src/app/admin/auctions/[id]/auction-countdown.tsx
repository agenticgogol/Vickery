"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Display-only. Closing is the server's job (syncExpiredAuctions in lib/db.ts) —
// this just refreshes the page once the clock runs out so the now-closed status shows up.
export function AuctionCountdown({ closeTime, closed }: { closeTime?: string; closed: boolean; slotId?: string }) {
  const router = useRouter();
  const [expired, setExpired] = useState(false);
  const [remaining, setRemaining] = useState(() => closeTime ? Math.max(0, new Date(closeTime).getTime() - Date.now()) : 0);
  useEffect(() => { if (closed || !closeTime) return; let didExpire = false; const update = () => { const next = Math.max(0, new Date(closeTime).getTime() - Date.now()); setRemaining(next); if (next === 0 && !didExpire) { didExpire = true; setExpired(true); window.setTimeout(() => router.refresh(), 5500); } }; update(); const timer = window.setInterval(update, 1000); return () => window.clearInterval(timer); }, [closeTime, closed, router]);
  if (closed || expired || !closeTime || remaining === 0) return <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">Closed</span>;
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black tabular-nums text-orange-700">Closes in {days ? `${days}d ` : ""}{String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</span>;
}
