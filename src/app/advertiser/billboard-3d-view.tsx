"use client";

import { useEffect, useRef, useState } from "react";
import type { Billboard, Creative } from "@/lib/data";
import { checkBillboardFit } from "@/lib/billboard-fit";

type Props = { billboard: Billboard; nearby: Billboard[]; creatives: Creative[]; onSelect?: (billboardId: string) => void };

function haversineKm(a: Billboard, b: Billboard) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ponytail: live Mapbox GL (WebGL) mounted but tiles silently never painted in testing — a plain
// satellite <img> via the Mapbox Static Images API is the lazy, reliable equivalent: real
// satellite/street imagery per location, no WebGL context to go blank. There's no Google Street
// View key configured, so "street" reuses the same real-photo source pulled in close, near-max
// pitch (60 is Mapbox's static-image ceiling) to approximate a roadside eye level; "satellite"
// pulls back to a wide aerial for location context.
function staticMapUrl(lon: number, lat: number, token: string, zoom: number, pitch: number) {
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lon},${lat},${zoom},-20,${pitch}/800x500@2x?access_token=${token}`;
}

// Real photo of an actual billboard structure (Pexels, free license — photo by Athena Sandrini,
// cropped/resized) standing in for our own drawn frame+pole: a photographed sign reads far more
// real than a flat vector rectangle. PANEL is the ad face's bounding box as a fraction of this
// photo, measured by thresholding the sky-blue background to find the frame's pixel bounding box
// (see scratchpad detect_frame2.py). Stretched (not perspective-warped) to fill: the photo is
// placed axis-aligned, so a warp would fight its own baked-in camera angle.
// The source photo's own sky is chroma-keyed to transparent (see scratchpad chroma_key_sign.py)
// — every street scene has a different sky color, and a flat blue rectangle from the original
// photo clashed badly against all of them. Only the frame/pole silhouette is opaque now, so each
// scene's real sky shows through around it.
const SIGN_PHOTO = "/billboards/billboard-structure.png";
const SIGN_PHOTO_ASPECT = 900 / 906;
const SIGN_PANEL = { x: 0.06, y: 0.05, w: 0.88, h: 0.45 };

// Street uses real, confirmed-Hyderabad street photos (Pexels, free license — various
// photographers, credited in each file's git history) so the city is honest even though none is
// literally the seeded billboard's exact GPS spot (no per-location street photography or Street
// View key available) — every one of the 8 billboards gets its own distinct photo, roughly
// matched to its area's character (IT-corridor glass towers, leafy upscale hills, an old-city
// market street, a sunset skyline for the financial district). The sign structure is placed on a
// flat rooftop visible in each frame, a genuine common pattern for Indian city hoardings.
// Satellite keeps the real Mapbox aerial for the actual location, unaffected by this photo.
type SignPlacement = { anchorXPct: number; anchorBottomYPct: number; heightPct: number };
// cropY: where the preview's fixed-height container should center its object-cover crop
// (percent down the source photo) — the sign sits at very different heights across these
// photos, so one fixed crop anchor left some signs cropped out above blank sky.
const STREET_SCENES: Record<string, { src: string; placement: SignPlacement; cropY: number }> = {
  "bb-hitech": { src: "/billboards/street-hitech.jpg", placement: { anchorXPct: 58, anchorBottomYPct: 29, heightPct: 10 }, cropY: 0 },
  "bb-gachibowli": { src: "/billboards/street-scene.jpg", placement: { anchorXPct: 69, anchorBottomYPct: 34, heightPct: 15 }, cropY: 0 },
  "bb-financial": { src: "/billboards/street-financial.jpg", placement: { anchorXPct: 38, anchorBottomYPct: 83, heightPct: 6 }, cropY: 80 },
  "bb-madhapur": { src: "/billboards/street-madhapur.jpg", placement: { anchorXPct: 78, anchorBottomYPct: 58, heightPct: 20 }, cropY: 50 },
  "bb-jubilee": { src: "/billboards/street-jubilee.jpg", placement: { anchorXPct: 78, anchorBottomYPct: 63, heightPct: 8 }, cropY: 68 },
  "bb-banjara": { src: "/billboards/street-banjara.jpg", placement: { anchorXPct: 50, anchorBottomYPct: 45, heightPct: 10 }, cropY: 40 },
  "bb-kondapur": { src: "/billboards/street-kondapur.jpg", placement: { anchorXPct: 20, anchorBottomYPct: 30, heightPct: 12 }, cropY: 24 },
  "bb-secunderabad": { src: "/billboards/street-secunderabad.jpg", placement: { anchorXPct: 20, anchorBottomYPct: 68, heightPct: 9 }, cropY: 63 },
};
const DEFAULT_STREET_SCENE = { src: "/billboards/street-scene.jpg", placement: { anchorXPct: 69, anchorBottomYPct: 34, heightPct: 15 }, cropY: 0 };
const SATELLITE_PLACEMENT: SignPlacement = { anchorXPct: 50, anchorBottomYPct: 90, heightPct: 50 };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

type ViewMode = "street" | "satellite";

export function Billboard3DView({ billboard, nearby, creatives, onSelect }: Props) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [view, setView] = useState<ViewMode>("street");
  const [creativeId, setCreativeId] = useState(creatives[0]?.id ?? "");
  const creative = creatives.find((item) => item.id === creativeId) ?? creatives[0];
  const fit = creative ? checkBillboardFit(billboard, creative) : null;
  const nearbyBillboards = nearby.filter((item) => item.id !== billboard.id && haversineKm(billboard, item) <= 5);
  const streetScene = STREET_SCENES[billboard.id] ?? DEFAULT_STREET_SCENE;

  useEffect(() => {
    if (creatives.length && !creatives.some((item) => item.id === creativeId)) {
      setCreativeId(creatives[0].id);
    }
  }, [creatives, creativeId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let cancelled = false;

    const bgSrc =
      view === "satellite"
        ? token && !mapFailed
          ? staticMapUrl(billboard.longitude, billboard.latitude, token, 17, 60)
          : billboard.imageUrl
        : streetScene.src;
    if (!bgSrc) return;

    const images: Promise<HTMLImageElement>[] = [loadImage(bgSrc), loadImage(SIGN_PHOTO)];
    if (creative) images.push(loadImage(creative.imageUrl));

    Promise.all(images)
      .then(([bg, signPhoto, creativeImg]) => {
        if (cancelled) return;
        canvas.width = bg.width;
        canvas.height = bg.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bg, 0, 0);

        const placement = view === "satellite" ? SATELLITE_PLACEMENT : streetScene.placement;
        const destH = (placement.heightPct / 100) * canvas.height;
        const destW = destH * SIGN_PHOTO_ASPECT;
        const destX = (placement.anchorXPct / 100) * canvas.width - destW / 2;
        const destY = (placement.anchorBottomYPct / 100) * canvas.height - destH;

        ctx.drawImage(signPhoto, 0, 0, signPhoto.width, signPhoto.height, destX, destY, destW, destH);

        if (creativeImg) {
          const panelX = destX + SIGN_PANEL.x * destW;
          const panelY = destY + SIGN_PANEL.y * destH;
          const panelW = SIGN_PANEL.w * destW;
          const panelH = SIGN_PANEL.h * destH;
          // stretched (not cropped) to fill the panel — an incompatible aspect ratio should
          // visibly distort, matching the mismatch warning shown above the preview.
          ctx.drawImage(creativeImg, 0, 0, creativeImg.width, creativeImg.height, panelX, panelY, panelW, panelH);
        }
      })
      .catch(() => {
        if (!cancelled && view === "satellite" && token && !mapFailed) setMapFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [billboard.id, billboard.longitude, billboard.latitude, billboard.imageUrl, token, mapFailed, creative, view, streetScene]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-600">
            {view === "street" ? "Driver's-eye preview" : "Live location + creative preview"}
          </p>
          <h2 className="mt-1 text-lg font-bold">{billboard.name}</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setView("street")}
              className={`rounded-md px-3 py-1.5 transition ${view === "street" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`}
            >
              Street view
            </button>
            <button
              type="button"
              onClick={() => setView("satellite")}
              className={`rounded-md px-3 py-1.5 transition ${view === "satellite" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`}
            >
              Satellite
            </button>
          </div>
          {view === "satellite" && (
            <span className="text-xs font-semibold text-slate-400">{nearbyBillboards.length} nearby screens</span>
          )}
          {creatives.length > 0 && (
            <select
              value={creativeId}
              onChange={(event) => setCreativeId(event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold outline-none focus:border-cyan-500"
            >
              {creatives.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      {fit && !fit.compatible && (
        <div className="mx-5 mt-4 rounded-lg border-2 border-red-300 bg-red-50 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-wide text-red-700">Aspect ratio mismatch</p>
          <p className="mt-1 text-sm font-semibold text-red-700">{fit.message}</p>
        </div>
      )}
      <div className="relative w-full overflow-hidden bg-[#e8f1f0]">
        <canvas
          ref={canvasRef}
          className="h-[380px] w-full object-cover"
          style={{ objectPosition: view === "street" ? `50% ${streetScene.cropY}%` : "50% 50%" }}
        />
        {view === "street" && (
          <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold text-white">
            Representative Hyderabad street — not this slot&apos;s exact camera
          </span>
        )}
        {view === "satellite" && nearbyBillboards.length > 0 && onSelect && (
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-2 bg-gradient-to-t from-black/60 to-transparent p-3">
            {nearbyBillboards.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-slate-800 hover:bg-white"
              >
                {item.name}
              </button>
            ))}
          </div>
        )}
      </div>
      {!creative && (
        <p className="px-5 py-4 text-sm text-slate-500">No creatives available to preview yet.</p>
      )}
    </section>
  );
}
