import type { MarketplaceSort } from "./marketplace";

export type NaturalSearchFilters = {
  areas: string[];
  radiusKm?: number;
  location?: string;
  date?: string;
  dayOfWeek?: number;
  timeOfDay?: "Morning" | "Afternoon" | "Evening" | "Late night";
  startTime?: string;
  endTime?: string;
  maxReserve?: number;
  minimumTraffic?: number;
  audienceTags: string[];
  qualityTier?: "Premium" | "Standard";
  auctionStatus?: "available" | "auction_open";
  sorting?: MarketplaceSort;
};

const sortValues: MarketplaceSort[] = ["newest", "ending", "reserve", "traffic", "bids", "match"];
const qualityValues = ["Premium", "Standard"] as const;
const timeValues = ["Morning", "Afternoon", "Evening", "Late night"] as const;
const statusValues = ["available", "auction_open"] as const;

export function emptyNaturalSearchFilters(): NaturalSearchFilters {
  return { areas: [], audienceTags: [] };
}

function asMoney(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;
}

function asTime(value: unknown) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : undefined;
}

export function validateNaturalSearchFilters(value: unknown, availableAreas: string[] = [], availableAudiences: string[] = []): NaturalSearchFilters {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const areas = Array.isArray(input.areas) ? input.areas.filter((area): area is string => typeof area === "string" && availableAreas.includes(area)) : [];
  const audienceTags = Array.isArray(input.audienceTags) ? input.audienceTags.filter((tag): tag is string => typeof tag === "string" && availableAudiences.includes(tag)) : [];
  const radiusKm = asMoney(input.radiusKm);
  const minimumTraffic = asMoney(input.minimumTraffic);
  const dayOfWeek = typeof input.dayOfWeek === "number" && Number.isInteger(input.dayOfWeek) && input.dayOfWeek >= 0 && input.dayOfWeek <= 6 ? input.dayOfWeek : undefined;
  const timeOfDay = timeValues.includes(input.timeOfDay as typeof timeValues[number]) ? input.timeOfDay as typeof timeValues[number] : undefined;
  const qualityTier = qualityValues.includes(input.qualityTier as typeof qualityValues[number]) ? input.qualityTier as typeof qualityValues[number] : undefined;
  const auctionStatus = statusValues.includes(input.auctionStatus as typeof statusValues[number]) ? input.auctionStatus as typeof statusValues[number] : undefined;
  const sorting = sortValues.includes(input.sorting as MarketplaceSort) ? input.sorting as MarketplaceSort : undefined;
  const date = typeof input.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : undefined;
  return { areas, radiusKm, location: typeof input.location === "string" ? input.location.slice(0, 80) : undefined, date, dayOfWeek, timeOfDay, startTime: asTime(input.startTime), endTime: asTime(input.endTime), maxReserve: asMoney(input.maxReserve), minimumTraffic, audienceTags, qualityTier, auctionStatus, sorting };
}

export function parseNaturalSearchFallback(query: string, availableAreas: string[], availableAudiences: string[]): NaturalSearchFilters {
  const text = query.toLowerCase();
  const filters = emptyNaturalSearchFilters();
  filters.areas = availableAreas.filter((area) => text.includes(area.toLowerCase()));
  filters.audienceTags = availableAudiences.filter((tag) => text.includes(tag.toLowerCase()) || (/(office|commuter)/.test(text) && /(office|commuter|professional)/i.test(tag)));
  if (text.includes("premium")) filters.qualityTier = "Premium";
  if (text.includes("standard")) filters.qualityTier = "Standard";
  if (text.includes("morning")) filters.timeOfDay = "Morning";
  if (text.includes("afternoon")) filters.timeOfDay = "Afternoon";
  if (text.includes("evening")) filters.timeOfDay = "Evening";
  if (text.includes("late night") || text.includes("night")) filters.timeOfDay = "Late night";
  if (text.includes("friday")) filters.dayOfWeek = 5;
  if (text.includes("saturday")) filters.dayOfWeek = 6;
  if (text.includes("sunday")) filters.dayOfWeek = 0;
  const maxMatch = text.match(/(?:under|below|up to|max(?:imum)?)[^\d₹]*₹?\s*([\d,]+)\s*(k)?/);
  if (maxMatch) filters.maxReserve = Number(maxMatch[1].replace(/,/g, "")) * (maxMatch[2] ? 1000 : 1);
  if (/high[- ]traffic|heavy traffic/.test(text)) filters.minimumTraffic = 120000;
  if (/ending soon|closing soon/.test(text)) filters.sorting = "ending";
  else if (/lowest reserve|cheapest|budget/.test(text)) filters.sorting = "reserve";
  else if (/highest traffic|high traffic/.test(text)) filters.sorting = "traffic";
  else if (/most bids|popular/.test(text)) filters.sorting = "bids";
  filters.auctionStatus = "available";
  return validateNaturalSearchFilters(filters, availableAreas, availableAudiences);
}

export function naturalSearchPrompt(availableAreas: string[], availableAudiences: string[]) {
  return `Return only JSON matching this schema: {"areas":string[],"radiusKm":number|null,"location":string|null,"date":"YYYY-MM-DD"|null,"dayOfWeek":number|null,"timeOfDay":"Morning"|"Afternoon"|"Evening"|"Late night"|null,"startTime":"HH:MM"|null,"endTime":"HH:MM"|null,"maxReserve":number|null,"minimumTraffic":number|null,"audienceTags":string[],"qualityTier":"Premium"|"Standard"|null,"auctionStatus":"available"|"auction_open"|null,"sorting":"newest"|"ending"|"reserve"|"traffic"|"bids"|"match"|null}. Use only these areas: ${availableAreas.join(", ") || "none"}. Use only these audience tags: ${availableAudiences.join(", ") || "none"}. Do not select inventory or rank inventory.`;
}
