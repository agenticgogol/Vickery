"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { createBillboard, updateBillboard, type BillboardInput } from "@/lib/actions";
import type { Billboard } from "@/lib/data";
import { publishDataChange } from "@/lib/live-sync";

const emptyForm: BillboardInput = { name: "", city: "Hyderabad", area: "", location: "", latitude: 17.4435, longitude: 78.3772, screenType: "Digital LED", dimensions: "30 × 15 ft", estimatedDailyTraffic: 100000, audienceProfile: "Commuters · professionals", qualityTier: "Standard", defaultReservePrice: 10000, active: true, verificationPhotos: [] };

const CORNER_LABELS = ["Top-left", "Top-right", "Bottom-right", "Bottom-left"];

export function BillboardForm({ initial, onSaved, onCancel }: { initial?: Billboard; onSaved: (billboard: Billboard) => void; onCancel: () => void }) {
  const [form, setForm] = useState<BillboardInput>(initial ? { ...emptyForm, ...initial } : emptyForm);
  const [imagePreview, setImagePreview] = useState(initial?.imageUrl ?? "");
  const [photoUrlInput, setPhotoUrlInput] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const setField = <K extends keyof BillboardInput>(field: K, value: BillboardInput[K]) => setForm((current) => ({ ...current, [field]: value }));
  function addVerificationPhoto() {
    if (!photoUrlInput.trim()) return;
    setField("verificationPhotos", [...(form.verificationPhotos ?? []), photoUrlInput.trim()]);
    setPhotoUrlInput("");
  }
  function removeVerificationPhoto(url: string) {
    setField("verificationPhotos", (form.verificationPhotos ?? []).filter((item) => item !== url));
  }

  function markFaceCorner(event: React.MouseEvent<HTMLImageElement>) {
    const corners = form.faceCorners ?? [];
    if (corners.length >= 4) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setField("faceCorners", [...corners, { x, y }]);
  }

  function chooseImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 3_000_000) { setMessage("Choose an image under 3 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => { const value = String(reader.result); setImagePreview(value); setField("imageUrl", value); setMessage(""); };
    reader.readAsDataURL(file);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    startTransition(async () => {
      try { const saved = initial ? await updateBillboard(initial.id, form) : await createBillboard(form); publishDataChange("billboard"); onSaved(saved); }
      catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save billboard."); }
    });
  }

  return <form onSubmit={submit} className="space-y-5">{initial && <p className="rounded-xl bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">Verification status: {initial.verificationStatus ?? "pending"}{initial.verificationStatus === "rejected" && initial.rejectionReason ? ` · ${initial.rejectionReason}` : ""}</p>}<div className="grid gap-4 sm:grid-cols-2"><Field label="Billboard name" value={form.name} onChange={(value) => setField("name", value)} required /><Field label="City" value={form.city} onChange={(value) => setField("city", value)} required /><Field label="Area" value={form.area} onChange={(value) => setField("area", value)} required /><Field label="Location / landmark" value={form.location ?? ""} onChange={(value) => setField("location", value)} required /><Field label="Latitude" type="number" value={String(form.latitude)} onChange={(value) => setField("latitude", Number(value))} required /><Field label="Longitude" type="number" value={String(form.longitude)} onChange={(value) => setField("longitude", Number(value))} required /><Field label="Altitude (m, optional)" type="number" value={form.altitude !== undefined ? String(form.altitude) : ""} onChange={(value) => setField("altitude", value ? Number(value) : undefined)} /><Field label="Unique hardware ID" value={form.uniqueHardwareId ?? ""} onChange={(value) => setField("uniqueHardwareId", value)} /><Field label="Screen type" value={form.screenType} onChange={(value) => setField("screenType", value)} required /><Field label="Dimensions" value={form.dimensions} onChange={(value) => setField("dimensions", value)} required /><Field label="Estimated daily traffic" type="number" value={String(form.estimatedDailyTraffic)} onChange={(value) => setField("estimatedDailyTraffic", Number(value))} required /><Field label="Default reserve price" type="number" value={String(form.defaultReservePrice)} onChange={(value) => setField("defaultReservePrice", Number(value))} required /><label className="text-sm font-bold">Quality tier<select value={form.qualityTier} onChange={(event) => setField("qualityTier", event.target.value as BillboardInput["qualityTier"])} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-cyan-500"><option>Standard</option><option>Premium</option></select></label><Field label="Audience profile" value={form.audienceProfile} onChange={(value) => setField("audienceProfile", value)} required /></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Blackout periods<textarea value={form.blackoutPeriods ?? ""} onChange={(event) => setField("blackoutPeriods", event.target.value)} placeholder="e.g. no override on election days" className="mt-2 min-h-16 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-cyan-500" /></label><label className="text-sm font-bold">Hardware reliability notes<textarea value={form.hardwareReliabilityNotes ?? ""} onChange={(event) => setField("hardwareReliabilityNotes", event.target.value)} className="mt-2 min-h-16 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-cyan-500" /></label></div><div className="grid gap-4 sm:grid-cols-[1fr_180px]"><label className="text-sm font-bold">Billboard image<input type="file" accept="image/*" onChange={chooseImage} className="mt-2 block w-full text-xs font-normal text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-bold" />{imagePreview && <Image src={imagePreview} alt="Billboard preview" width={640} height={96} unoptimized className="mt-3 h-24 w-full rounded-xl object-cover" />}</label><label className="flex items-center gap-3 self-start pt-7 text-sm font-bold"><input type="checkbox" checked={form.active !== false} onChange={(event) => setField("active", event.target.checked)} className="h-4 w-4 accent-cyan-500" />Active billboard</label></div>{imagePreview && <div><p className="text-sm font-bold">Mark billboard face (for AR preview){(form.faceCorners ?? []).length === 4 && <button type="button" onClick={() => setField("faceCorners", [])} className="ml-3 text-xs font-bold text-red-600">Reset</button>}</p><p className="mt-1 text-xs text-slate-500">Click the 4 corners of the display face in order: top-left, top-right, bottom-right, bottom-left.</p><div className="relative mt-2 inline-block"><img src={imagePreview} alt="Mark billboard face" onClick={markFaceCorner} className="max-h-64 cursor-crosshair rounded-xl" />{(form.faceCorners ?? []).map((point, index) => <span key={index} style={{ left: `${point.x}%`, top: `${point.y}%` }} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow">{index + 1}</span>)}</div><p className="mt-1 text-xs text-slate-400">{(form.faceCorners ?? []).length}/4 corners marked{(form.faceCorners ?? []).length > 0 && (form.faceCorners ?? []).length < 4 ? ` · next: ${CORNER_LABELS[(form.faceCorners ?? []).length]}` : ""}</p></div>}<div><label className="text-sm font-bold">Verification photo URL<div className="mt-2 flex gap-2"><input type="text" value={photoUrlInput} onChange={(event) => setPhotoUrlInput(event.target.value)} placeholder="https://…" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-cyan-500" /><button type="button" onClick={addVerificationPhoto} className="shrink-0 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600">Add</button></div></label>{(form.verificationPhotos ?? []).length > 0 && <ul className="mt-3 space-y-1">{(form.verificationPhotos ?? []).map((url) => <li key={url} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="truncate">{url}</span><button type="button" onClick={() => removeVerificationPhoto(url)} className="ml-2 shrink-0 font-bold text-red-600">Remove</button></li>)}</ul>}<p className="mt-2 text-xs text-slate-500">Photos submitted with this billboard for admin verification. Saving sends it back into the pending review queue.</p></div>{message && <p role="alert" className="text-sm font-semibold text-red-600">{message}</p>}<div className="flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600">Cancel</button><button disabled={isPending} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{isPending ? "Saving…" : initial ? "Save billboard" : "Add billboard"}</button></div></form>;
}

function Field({ label, type = "text", value, onChange, required }: { label: string; type?: string; value: string; onChange: (value: string) => void; required?: boolean }) { return <label className="text-sm font-bold">{label}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-cyan-500" /></label>; }
