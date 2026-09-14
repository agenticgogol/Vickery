"use client";

const EVENT_KEY = "bx-data-sync";

export function publishDataChange(source: string) {
  if (typeof window === "undefined") return;
  const message = JSON.stringify({ source, at: Date.now() });
  try { const channel = new BroadcastChannel(EVENT_KEY); channel.postMessage(message); channel.close(); } catch { /* localStorage fallback below */ }
  try { window.localStorage.setItem(EVENT_KEY, message); } catch { /* BroadcastChannel is sufficient when storage is unavailable. */ }
}

export function subscribeToDataChanges(onChange: (source?: string) => void) {
  if (typeof window === "undefined") return () => undefined;
  let channel: BroadcastChannel | undefined;
  const handleMessage = (event: MessageEvent<string>) => { try { onChange(JSON.parse(event.data).source); } catch { onChange(); } };
  try { channel = new BroadcastChannel(EVENT_KEY); channel.addEventListener("message", handleMessage); } catch { channel = undefined; }
  const handleStorage = (event: StorageEvent) => { if (event.key !== EVENT_KEY || !event.newValue) return; try { onChange(JSON.parse(event.newValue).source); } catch { onChange(); } };
  window.addEventListener("storage", handleStorage);
  return () => { channel?.removeEventListener("message", handleMessage); channel?.close(); window.removeEventListener("storage", handleStorage); };
}
