"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runBulkSimulation, type BulkSimulationRow } from "@/lib/actions";
import { publishDataChange } from "@/lib/live-sync";
import { formatRupees } from "@/lib/data";

export function BulkSimulation() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<BulkSimulationRow[] | null>(null);
  const [error, setError] = useState("");

  function run() {
    setError("");
    startTransition(async () => {
      try {
        const result = await runBulkSimulation();
        setRows(result);
        publishDataChange("reset");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Simulation failed.");
      }
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
            Bulk simulation
          </p>
          <h2 className="mt-1 font-bold text-cyan-950">
            Release inventory, run a bidding war, clear the auctions
          </h2>
          <p className="mt-1 text-xs text-cyan-800/70">
            Releases fresh slots across 4 billboards, runs a 4-round bidding
            war across all 3 advertisers on each with shrinking raises, closes
            every auction once the war cools off, then refreshes every metric
            on this page.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={isPending}
          className="rounded-xl bg-cyan-700 px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Simulating…" : "Run bulk simulation"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-xs font-bold text-red-700">
          {error}
        </p>
      )}
      {rows && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-cyan-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-cyan-100 text-[10px] font-bold uppercase tracking-wider text-cyan-700">
                <th className="px-3 py-2">Billboard</th>
                <th className="px-3 py-2">Slot</th>
                <th className="px-3 py-2">Bids</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Winner</th>
                <th className="px-3 py-2">Clearing price</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-slate-400">
                    No slots released — every window collided with an existing
                    one. Try again.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.slotId} className="border-b border-cyan-50 last:border-0">
                    <td className="px-3 py-2 font-bold text-slate-700">{row.billboardName}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {row.date} · {row.startTime}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{row.bids}</td>
                    <td className="px-3 py-2 text-slate-500">{row.status}</td>
                    <td className="px-3 py-2 text-slate-500">{row.winner}</td>
                    <td className="px-3 py-2 font-bold text-slate-950">
                      {formatRupees(row.clearingPrice)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
