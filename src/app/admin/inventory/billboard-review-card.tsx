"use client";

import { useState, useTransition } from "react";
import { reviewBillboard } from "@/lib/actions";
import type { Billboard } from "@/lib/data";
import { publishDataChange } from "@/lib/live-sync";

export function BillboardReviewCard({ billboard }: { billboard: Billboard }) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  function review(decision: "verified" | "rejected") {
    setMessage("");
    startTransition(async () => {
      try {
        await reviewBillboard(billboard.id, decision, reason);
        publishDataChange("billboard");
        setMessage(decision === "verified" ? "Verified." : "Rejected.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to review billboard.");
      }
    });
  }
  return (
    <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[220px_1fr]">
      {billboard.verificationPhotos?.[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={billboard.verificationPhotos[0]} alt={billboard.name} className="h-28 w-full rounded-xl object-cover" />
      ) : (
        <div className="grid h-28 w-full place-items-center rounded-xl bg-slate-100 text-xs font-bold text-slate-400">
          No verification photo
        </div>
      )}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold">{billboard.name}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {billboard.area}, {billboard.city} · {billboard.screenType}
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
            Pending Verification
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
          <dt className="font-bold text-slate-400">Unique hardware ID</dt>
          <dd>{billboard.uniqueHardwareId || "—"}</dd>
          <dt className="font-bold text-slate-400">Altitude</dt>
          <dd>{billboard.altitude !== undefined ? `${billboard.altitude} m` : "—"}</dd>
          <dt className="font-bold text-slate-400">Blackout periods</dt>
          <dd className="col-span-2">{billboard.blackoutPeriods || "None specified"}</dd>
          <dt className="font-bold text-slate-400">Hardware reliability notes</dt>
          <dd className="col-span-2">{billboard.hardwareReliabilityNotes || "None specified"}</dd>
        </dl>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Rejection reason (required only when rejecting)"
          className="mt-4 min-h-16 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-cyan-400"
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => review("verified")}
            disabled={isPending}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            Verify
          </button>
          <button
            type="button"
            onClick={() => review("rejected")}
            disabled={isPending}
            className="rounded-xl bg-red-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            Reject
          </button>
          {message && <span role="status" className="self-center text-xs font-semibold text-slate-500">{message}</span>}
        </div>
      </div>
    </div>
  );
}
