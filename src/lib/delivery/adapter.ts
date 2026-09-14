import type { Billboard, Creative, ScheduledPlayback } from "../data";

export type DeliveryResult = { status: "delivered" | "failed" | "pending"; detail?: string };

export interface CreativeDeliveryAdapter {
  deliver(billboard: Billboard, playback: ScheduledPlayback, creative: Creative): Promise<DeliveryResult>;
}

export class NetworkPushAdapter implements CreativeDeliveryAdapter {
  async deliver(billboard: Billboard, playback: ScheduledPlayback, creative: Creative): Promise<DeliveryResult> {
    const url = billboard.deliveryWebhookUrl;
    if (!url) return { status: "pending", detail: "no network endpoint configured" };
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billboardId: billboard.id,
          creativeUrl: creative.imageUrl,
          plannedStartAt: playback.plannedStartAt,
          plannedEndAt: playback.plannedEndAt,
        }),
      });
      if (!response.ok) return { status: "failed", detail: `Vendor endpoint returned ${response.status}.` };
      return { status: "delivered", detail: "Pushed to vendor network endpoint." };
    } catch (error) {
      return { status: "failed", detail: error instanceof Error ? error.message : "Network push failed." };
    }
  }
}

export function buildUsbManifest(billboard: Billboard, playback: ScheduledPlayback, creative: Creative) {
  return {
    billboardId: billboard.id,
    billboardName: billboard.name,
    creativeId: creative.id,
    creativeName: creative.name,
    creativeUrl: creative.imageUrl,
    plannedStartAt: playback.plannedStartAt,
    plannedEndAt: playback.plannedEndAt,
    checksum: `${creative.id}-${playback.plannedStartAt}`,
  };
}

export class UsbExportAdapter implements CreativeDeliveryAdapter {
  async deliver(billboard: Billboard, playback: ScheduledPlayback, creative: Creative): Promise<DeliveryResult> {
    buildUsbManifest(billboard, playback, creative);
    return { status: "pending", detail: "awaiting manual USB delivery" };
  }
}

export function selectAdapter(billboard: Billboard): CreativeDeliveryAdapter {
  return billboard.deliveryWebhookUrl ? new NetworkPushAdapter() : new UsbExportAdapter();
}
