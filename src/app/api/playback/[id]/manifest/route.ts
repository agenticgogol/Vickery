import { NextResponse } from "next/server";
import { buildUsbManifest } from "@/lib/delivery/adapter";
import { getBillboard, getCreative, getPlayback, getSlot } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slot = await getSlot(id);
  const playback = slot && (await getPlayback(id));
  if (!slot || !playback) return NextResponse.json({ error: "No scheduled playback for this slot." }, { status: 404 });
  const [billboard, creative] = await Promise.all([getBillboard(slot.billboardId), getCreative(playback.creativeId)]);
  if (!billboard || !creative) return NextResponse.json({ error: "Billboard or creative not found." }, { status: 404 });
  const manifest = buildUsbManifest(billboard, playback, creative);
  return new NextResponse(JSON.stringify(manifest, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${id}-usb-manifest.json"`,
    },
  });
}
