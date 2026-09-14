import { afterEach, describe, expect, it, vi } from "vitest";
import { NetworkPushAdapter, UsbExportAdapter, buildUsbManifest, selectAdapter } from "./adapter";
import { billboards, creatives } from "../data";

const billboard = billboards[0];
const creative = creatives[0];
const playback = {
  id: "playback-1",
  slotId: "slot-1",
  creativeId: creative.id,
  advertiserId: creative.advertiserId,
  status: "scheduled" as const,
  plannedStartAt: "2026-09-08T19:00:00+05:30",
  plannedEndAt: "2026-09-08T20:00:00+05:30",
};

describe("selectAdapter", () => {
  it("picks USB export when no webhook is configured", () => {
    expect(selectAdapter(billboard)).toBeInstanceOf(UsbExportAdapter);
  });
  it("picks network push when a webhook is configured", () => {
    expect(selectAdapter({ ...billboard, deliveryWebhookUrl: "https://vendor.example/hook" })).toBeInstanceOf(
      NetworkPushAdapter,
    );
  });
});

describe("UsbExportAdapter", () => {
  it("returns pending without calling anything external", async () => {
    const result = await new UsbExportAdapter().deliver(billboard, playback, creative);
    expect(result).toEqual({ status: "pending", detail: "awaiting manual USB delivery" });
  });
});

describe("buildUsbManifest", () => {
  it("includes billboard, creative, and schedule identifiers", () => {
    const manifest = buildUsbManifest(billboard, playback, creative);
    expect(manifest).toMatchObject({ billboardId: billboard.id, creativeId: creative.id, creativeUrl: creative.imageUrl });
    expect(manifest.checksum).toContain(creative.id);
  });
});

describe("NetworkPushAdapter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns pending when no webhook is configured", async () => {
    const result = await new NetworkPushAdapter().deliver(billboard, playback, creative);
    expect(result).toEqual({ status: "pending", detail: "no network endpoint configured" });
  });

  it("returns delivered when the webhook responds ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    const result = await new NetworkPushAdapter().deliver(
      { ...billboard, deliveryWebhookUrl: "https://vendor.example/hook" },
      playback,
      creative,
    );
    expect(result.status).toBe("delivered");
  });

  it("returns failed when the webhook responds with an error status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const result = await new NetworkPushAdapter().deliver(
      { ...billboard, deliveryWebhookUrl: "https://vendor.example/hook" },
      playback,
      creative,
    );
    expect(result.status).toBe("failed");
  });

  it("returns failed when the fetch call throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await new NetworkPushAdapter().deliver(
      { ...billboard, deliveryWebhookUrl: "https://vendor.example/hook" },
      playback,
      creative,
    );
    expect(result).toEqual({ status: "failed", detail: "network down" });
  });
});
