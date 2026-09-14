import Link from "next/link";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/app-shell";
import { ProofOfPlay } from "@/components/proof-of-play";
import { getAdvertiser } from "@/lib/data";
import { getAuctionResult, getPlayback, getSlot, getBillboard } from "@/lib/db";

export default async function ProofOfPlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slot = await getSlot(id);
  if (!slot) notFound();
  const result = await getAuctionResult(id);
  const playback = await getPlayback(id);
  const billboard = await getBillboard(slot.billboardId);
  if (!result || result.status !== "sold" || !playback) return <div className="mx-auto max-w-4xl"><Link href={`/playback/${id}`} className="mb-6 inline-block text-sm font-bold text-slate-500">← Back to virtual billboard</Link><div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">{result?.creativeApprovalPending ? <><p className="font-bold text-amber-700">Waiting on creative approval</p><p className="mt-2 text-sm text-slate-500">The winning creative hasn&apos;t been approved yet. Proof of play appears once an admin approves it and playback starts.</p><Link href="/admin/creatives" className="mt-5 inline-block rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">Review creatives →</Link></> : <><p className="font-bold">Proof of play is not available</p><p className="mt-2 text-sm text-slate-500">A winning auction must create a scheduled playback first.</p></>}</div></div>;
  return <><Link href={`/playback/${id}`} className="mb-6 inline-block text-sm font-bold text-slate-500">← Back to virtual billboard</Link><PageIntro eyebrow="Playback verification" title="Proof of play." description={`${billboard?.name} · ${billboard?.area} · ${slot.date} · ${slot.startTime}–${slot.endTime}`} action={<span className="rounded-full bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-700">{getAdvertiser(playback.advertiserId)?.name}</span>} /><ProofOfPlay slotId={id} status={playback.status} plannedStartAt={playback.plannedStartAt} plannedEndAt={playback.plannedEndAt} playbackTimestamp={playback.playbackTimestamp} failureReason={playback.failureReason} deliveryStatus={playback.deliveryStatus} deliveryDetail={playback.deliveryDetail} /></>;
}
