"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import type { Billboard, Slot } from "@/lib/data";
import { formatRupees, getSlotBillboard } from "@/lib/data";
import { getAudienceTags, type ViewportBounds } from "@/lib/marketplace";
import { StatusBadge } from "@/components/app-shell";

type Props = { slots: Slot[]; billboards: Billboard[]; selectedSlotId: string | null; highlightedSlotIds?: string[]; onSelect: (slotId: string) => void; onSearchArea?: (bounds: ViewportBounds) => void };

function markerColor(active: boolean, highlighted: boolean) {
  return active ? "#0891b2" : highlighted ? "#7c3aed" : "#0f172a";
}

export function InventoryMap({ slots, billboards, selectedSlotId, highlightedSlotIds = [], onSelect, onSearchArea }: Props) {
  const mapRef = useRef<LeafletMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Marker[]>([]);
  const selected = slots.find((slot) => slot.id === selectedSlotId) ?? slots[0];
  const selectedBillboard = selected ? getSlotBillboard(selected) : undefined;
  const uniqueBillboards = useMemo(() => billboards.filter((billboard) => slots.some((slot) => slot.billboardId === billboard.id)), [billboards, slots]);
  const mapItems = useMemo(() => slots.map((slot) => ({ slot, billboard: billboards.find((billboard) => billboard.id === slot.billboardId) })).filter((item): item is { slot: Slot; billboard: Billboard } => Boolean(item.billboard)), [billboards, slots]);
  const mapCenter = useMemo(() => { const count = uniqueBillboards.length || 1; return [uniqueBillboards.reduce((sum, item) => sum + item.latitude, 0) / count, uniqueBillboards.reduce((sum, item) => sum + item.longitude, 0) / count] as [number, number]; }, [uniqueBillboards]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current).setView(mapCenter, 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    let disposed = false;
    import("leaflet").then((L) => {
      if (disposed || !mapRef.current) return;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = mapItems.map(({ slot, billboard }) => {
        const active = slot.id === selectedSlotId;
        const highlighted = highlightedSlotIds.includes(slot.id);
        const icon = L.divIcon({
          className: "",
          html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);background:${markerColor(active, highlighted)}"></span>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        const marker = L.marker([billboard.latitude, billboard.longitude], { icon }).addTo(mapRef.current!);
        marker.bindTooltip(billboard.name);
        marker.on("click", () => onSelect(slot.id));
        return marker;
      });
    });
    return () => {
      disposed = true;
    };
  }, [highlightedSlotIds, mapItems, onSelect, selectedSlotId]);

  if (!slots.length) return <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><p className="font-bold">No map inventory matches these filters</p><p className="mt-2 text-sm text-slate-500">Clear a filter to see available Hyderabad screens.</p></section>;

  return (
    <section id="inventory-map" className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-600">Live inventory map</p>
          <h2 className="mt-1 text-lg font-bold">Explore Hyderabad screen time</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-400">
            {slots.length} slots · {uniqueBillboards.length} screens
          </span>
          <button
            type="button"
            onClick={() => {
              const bounds = mapRef.current?.getBounds();
              if (bounds) onSearchArea?.({ north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest() });
            }}
            className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-black text-white"
          >
            Search this area
          </button>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row">
        <div className="relative h-[420px] flex-1 overflow-hidden bg-[#e8f1f0]">
          <div ref={containerRef} className="absolute inset-0" />
        </div>
        {selected && selectedBillboard && (
          <div className="w-full shrink-0 border-t border-slate-100 bg-white p-4 sm:w-80 sm:border-l sm:border-t-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-cyan-700">{selectedBillboard.area}</p>
                <h3 className="mt-1 font-bold">{selectedBillboard.name}</h3>
              </div>
              <StatusBadge status={selected.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <span className="text-slate-400">Available time</span>
              <span className="text-right font-bold">
                {selected.date} · {selected.startTime}–{selected.endTime}
              </span>
              <span className="text-slate-400">Reserve</span>
              <span className="text-right font-bold">{formatRupees(selected.reservePrice)}</span>
              <span className="text-slate-400">Traffic</span>
              <span className="text-right font-bold">{selectedBillboard.estimatedDailyTraffic.toLocaleString("en-IN")}/day</span>
              <span className="text-slate-400">Quality</span>
              <span className="text-right font-bold">{selectedBillboard.qualityTier}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {getAudienceTags(selectedBillboard).map((tag) => (
                <span key={tag} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                  {tag}
                </span>
              ))}
            </div>
            <Link href={`/advertiser/slots/${selected.id}`} className="mt-4 block rounded-xl bg-slate-950 px-4 py-2.5 text-center text-xs font-black text-white">
              View Slot →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
