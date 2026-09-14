"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const NUDGE_KEY = "bx-campaign-nudge-seen";

export function CampaignNudge() {
  const [showNudge, setShowNudge] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = window.localStorage.getItem(NUDGE_KEY) === "1";
    } catch {
      // ignore — storage may be unavailable (private mode etc.)
    }
    if (seen) return;
    const timer = window.setTimeout(() => setShowNudge(true), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  function dismiss() {
    setShowNudge(false);
    try {
      window.localStorage.setItem(NUDGE_KEY, "1");
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative">
      {showNudge && (
        <div className="absolute left-1/2 top-full z-20 mt-3 w-72 -translate-x-1/2 animate-bounce rounded-2xl border border-cyan-200 bg-white p-4 text-left shadow-2xl">
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
          <p className="pr-4 text-xs font-black uppercase tracking-wide text-cyan-600">New</p>
          <p className="mt-1 text-sm font-semibold leading-5 text-slate-800">
            Create a campaign, choose your audience — the system will auto-bid for you.
          </p>
          <span className="absolute -top-1.5 left-8 h-3 w-3 rotate-45 border-l border-t border-cyan-200 bg-white" />
        </div>
      )}
      <Link
        href="/advertiser/campaigns"
        onClick={dismiss}
        className="block rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
      >
        Bid on multiple slots
      </Link>
    </div>
  );
}
