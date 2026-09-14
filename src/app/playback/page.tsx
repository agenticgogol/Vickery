import Link from "next/link";
import { getAdvertiser, type PlaybackStatus } from "@/lib/data";
import { getPlaybacks, getSlots, getBillboards, getCreatives } from "@/lib/db";
import type { Billboard, Creative, ScheduledPlayback, Slot } from "@/lib/data";
import { PageIntro } from "@/components/app-shell";

const statusStyles: Record<PlaybackStatus, string> = {
  scheduled: "bg-violet-50 text-violet-700",
  playing: "bg-cyan-50 text-cyan-700",
  completed: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
};

type PlaybackData = { slots: Slot[]; billboards: Billboard[]; creatives: Creative[] };

function Row({ playback, data }: { playback: ScheduledPlayback; data: PlaybackData }) {
  const slot = data.slots.find((item) => item.id === playback.slotId);
  if (!slot) return null;
  const billboard = data.billboards.find((item) => item.id === slot.billboardId);
  const advertiser = getAdvertiser(playback.advertiserId);
  const creative = data.creatives.find((item) => item.id === playback.creativeId);
  return (
    <Link
      href={`/playback/${playback.slotId}`}
      className="grid grid-cols-[minmax(180px,1.5fr)_140px_120px_100px] items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 text-sm transition hover:border-cyan-200 hover:bg-cyan-50/40"
    >
      <div>
        <p className="font-bold text-slate-900">{billboard?.name}</p>
        <p className="mt-1 text-xs text-slate-400">
          {billboard?.area} · {slot.date} · {slot.startTime}–{slot.endTime}
        </p>
      </div>
      <span className="text-xs font-semibold text-slate-500">{advertiser?.name ?? "—"}</span>
      <span className="truncate text-xs text-slate-400">{creative?.name ?? "—"}</span>
      <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyles[playback.status as PlaybackStatus]}`}>
        {playback.status[0].toUpperCase() + playback.status.slice(1)}
      </span>
    </Link>
  );
}

function Section({ title, hint, items, data }: { title: string; hint: string; items: ScheduledPlayback[]; data: PlaybackData }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-500">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-400">Nothing here right now.</p>
      ) : (
        <div className="space-y-2">
          {items.map((playback) => (
            <Row key={playback.id} playback={playback} data={data} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function PlaybackHistoryPage() {
  const [playbacks, slots, billboards, creatives] = await Promise.all([
    getPlaybacks(),
    getSlots(),
    getBillboards(),
    getCreatives(),
  ]);
  const data: PlaybackData = { slots, billboards, creatives };
  const byRecency = (a: ScheduledPlayback, b: ScheduledPlayback) =>
    (b.playbackTimestamp ?? b.plannedStartAt).localeCompare(a.playbackTimestamp ?? a.plannedStartAt);
  const playing = playbacks.filter((item) => item.status === "playing").sort(byRecency);
  const scheduled = playbacks
    .filter((item) => item.status === "scheduled")
    .sort((a, b) => a.plannedStartAt.localeCompare(b.plannedStartAt));
  const completed = playbacks.filter((item) => item.status === "completed").sort(byRecency);
  const failed = playbacks.filter((item) => item.status === "failed").sort(byRecency);

  return (
    <>
      <PageIntro
        eyebrow="Virtual billboard network"
        title="What's playing, everywhere."
        description="Every scheduled, live, completed, and failed playback across the network — the full history, not just the last one you closed."
        action={
          <Link href="/admin" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600">
            Back to operations
          </Link>
        }
      />
      <div className="space-y-6">
        <Section title="Playing now" hint="Acknowledged as currently airing." items={playing} data={data} />
        <Section title="Scheduled" hint="Sorted by soonest start." items={scheduled} data={data} />
        <Section title="Completed" hint="Most recently finished first." items={completed} data={data} />
        <Section title="Failed" hint="Playback reported a failure." items={failed} data={data} />
      </div>
    </>
  );
}
