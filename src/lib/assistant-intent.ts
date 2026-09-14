export type CreateSlotIntent = {
  type: "create_slot";
  billboardName?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  reservePrice?: number;
};
export type SubmitBidIntent = {
  type: "submit_bid";
  billboardName?: string;
  date?: string;
  startTime?: string;
  amount?: number;
  advertiserName?: string;
};
export type NavigateIntent = { type: "navigate" };
export type AssistantIntent = CreateSlotIntent | SubmitBidIntent | NavigateIntent;

function asMoney(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : undefined;
}
function asTime(value: unknown) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? value
    : undefined;
}
function asDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : undefined;
}
function asName(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : undefined;
}

export function validateAssistantIntent(value: unknown): AssistantIntent {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  if (input.type === "create_slot")
    return {
      type: "create_slot",
      billboardName: asName(input.billboardName),
      date: asDate(input.date),
      startTime: asTime(input.startTime),
      endTime: asTime(input.endTime),
      reservePrice: asMoney(input.reservePrice),
    };
  if (input.type === "submit_bid")
    return {
      type: "submit_bid",
      billboardName: asName(input.billboardName),
      date: asDate(input.date),
      startTime: asTime(input.startTime),
      amount: asMoney(input.amount),
      advertiserName: asName(input.advertiserName),
    };
  return { type: "navigate" };
}

/** Deterministic fallback used with no API key, or when the model call fails. */
export function parseAssistantIntentFallback(
  role: "owner" | "advertiser",
  query: string,
  billboardNames: string[],
  advertiserNames: string[],
): AssistantIntent {
  const text = query.toLowerCase();
  const billboardName = billboardNames.find((name) => text.includes(name.toLowerCase()));
  const dateMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const date = dateMatch?.[1];
  // Strip the date before scanning for times/amounts so its digits can't be misread as either.
  const rest = date ? text.replace(date, " ") : text;
  const timeMatch = rest.match(/([01]?\d|2[0-3])(?::([0-5]\d))?\s*(am|pm)?\s*(?:-|to|–)\s*([01]?\d|2[0-3])(?::([0-5]\d))?\s*(am|pm)?/);
  function to24h(hour: string, meridiem?: string) {
    const h = Number(hour);
    if (!meridiem) return h; // already 24-hour format
    return meridiem === "pm" ? (h % 12) + 12 : h % 12;
  }
  let startTime: string | undefined;
  let endTime: string | undefined;
  if (timeMatch) {
    const [, h1, m1, mer1, h2, m2, mer2] = timeMatch;
    const meridiem = mer1 || mer2;
    startTime = `${String(to24h(h1, meridiem)).padStart(2, "0")}:${m1 ?? "00"}`;
    endTime = `${String(to24h(h2, meridiem)).padStart(2, "0")}:${m2 ?? "00"}`;
  }
  // Require a price/reserve/bid word or a ₹ sign nearby so a bare number (e.g. from a time) isn't mistaken for money.
  const moneyMatch = rest.match(/(?:reserve|price|bid(?:ding)?|₹)\D{0,6}([\d,]+)\s*(k)?/);
  const amount = moneyMatch
    ? Number(moneyMatch[1].replace(/,/g, "")) * (moneyMatch[2] ? 1000 : 1)
    : undefined;
  const advertiserName = advertiserNames.find((name) => text.includes(name.toLowerCase()));

  if (role === "owner" && /(release|create|add|list|publish)/.test(text) && billboardName)
    return { type: "create_slot", billboardName, date, startTime, endTime, reservePrice: amount };
  if (role === "advertiser" && /(bid|buy)/.test(text))
    return { type: "submit_bid", billboardName, date, startTime, amount, advertiserName };
  return { type: "navigate" };
}

export function assistantIntentPrompt(
  role: "owner" | "advertiser",
  billboardNames: string[],
  advertiserNames: string[],
) {
  const base =
    role === "owner"
      ? `{"type":"create_slot","billboardName":string|null,"date":"YYYY-MM-DD"|null,"startTime":"HH:MM"|null,"endTime":"HH:MM"|null,"reservePrice":number|null} or {"type":"navigate"}`
      : `{"type":"submit_bid","billboardName":string|null,"date":"YYYY-MM-DD"|null,"startTime":"HH:MM"|null,"amount":number|null,"advertiserName":string|null} or {"type":"navigate"}`;
  return `Return only JSON matching this schema: ${base}. Use "navigate" when the request is not clearly a request to ${role === "owner" ? "create/release a slot" : "place a bid"}. Copy billboardName exactly from this list when mentioned: ${billboardNames.join(", ") || "none"}. ${role === "advertiser" ? `Copy advertiserName exactly from this list when mentioned: ${advertiserNames.join(", ") || "none"}.` : ""} Never invent a billboardName, advertiserName, date, or price that was not stated or clearly implied by the user. This JSON only fills a form for a human to review before anything is submitted — you are not clearing an auction or deciding a winner.`;
}
