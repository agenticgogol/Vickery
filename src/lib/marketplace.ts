import type { Billboard, Bid, Slot } from "./data";

export const DEMO_NOW = "2026-09-05T12:00:00Z";

export function getAudienceTags(billboard?: Billboard) {
  return (
    billboard?.audienceProfile
      .split("·")
      .map((tag) => tag.trim())
      .filter(Boolean) ?? []
  );
}

export function getBillboardContextTags(billboard?: Billboard) {
  if (!billboard) return [];
  const searchText =
    `${billboard.name} ${billboard.area} ${billboard.audienceProfile} ${billboard.screenType}`.toLowerCase();
  const tags: string[] = [];
  if (/(tech|it |hitec|madhapur|kondapur|financial district)/.test(searchText))
    tags.push("Tech Hub");
  if (
    /(office|business|professional|commuter|finance|decision maker)/.test(
      searchText,
    )
  )
    tags.push("Office Commuters");
  if (billboard.qualityTier === "Premium") tags.push("Premium");
  if (/(retail|shopper|shopping|dining|entertainment|visitor)/.test(searchText))
    tags.push("Retail");
  if (/(residen|household|local resident|affluent)/.test(searchText))
    tags.push("Residential");
  if (billboard.estimatedDailyTraffic >= 120000) tags.push("High Traffic");
  if (/(airport|shamshabad)/.test(searchText)) tags.push("Airport Route");
  if (/(family|household|students)/.test(searchText))
    tags.push("Family Audience");
  return tags;
}

export function getInventoryContextTags(slot: Slot, billboard?: Billboard) {
  const tags = getBillboardContextTags(billboard);
  const startHour = Number(slot.startTime.slice(0, 2));
  const weekday = new Date(`${slot.date}T12:00:00Z`).getUTCDay();
  if (startHour >= 17 && startHour < 21) tags.push("Evening Heavy");
  if (weekday === 0 || weekday === 6) tags.push("Weekend Heavy");
  return tags;
}

export function getTimeOfDay(startTime: string) {
  const hour = Number(startTime.slice(0, 2));
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  if (hour < 21) return "Evening";
  return "Late night";
}

export function getSlotTags(
  slot: Slot,
  billboard: Billboard | undefined,
  slotBids: Bid[],
) {
  const tags: string[] = [];
  const latestBid = slotBids
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const demoNow = new Date(DEMO_NOW).getTime();
  if (
    latestBid &&
    demoNow - new Date(latestBid.createdAt).getTime() <= 24 * 60 * 60 * 1000
  )
    tags.push("Just Now");
  else if (!latestBid) tags.push("New");
  if (slot.date === DEMO_NOW.slice(0, 10)) tags.push("Today");
  if (
    slot.status === "auction_open" &&
    slot.auctionCloseTime &&
    new Date(slot.auctionCloseTime).getTime() <= demoNow + 48 * 60 * 60 * 1000
  )
    tags.push("Ending Soon");
  if (slotBids.length >= 2) tags.push("Popular");
  if (billboard?.qualityTier === "Premium") tags.push("Premium");
  if (slotBids.length === 0) tags.push("No Bids Yet");
  return tags;
}

export type MarketplaceSort =
  "newest" | "ending" | "reserve" | "traffic" | "bids" | "match" | "efficiency";

export type GeoPoint = { latitude: number; longitude: number; label: string };
export type ViewportBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export function distanceKm(
  from: GeoPoint,
  to: { latitude: number; longitude: number },
) {
  const earthRadiusKm = 6371;
  const radians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinRadius(
  point: { latitude: number; longitude: number },
  center: GeoPoint,
  radiusKm: number,
) {
  return distanceKm(center, point) <= radiusKm;
}

export function isWithinViewport(
  point: { latitude: number; longitude: number },
  bounds: ViewportBounds,
) {
  const longitudeInBounds =
    bounds.west <= bounds.east
      ? point.longitude >= bounds.west && point.longitude <= bounds.east
      : point.longitude >= bounds.west || point.longitude <= bounds.east;
  return (
    point.latitude >= bounds.south &&
    point.latitude <= bounds.north &&
    longitudeInBounds
  );
}

export function sortMarketplaceSlots(
  items: Slot[],
  billboards: Billboard[],
  bids: Bid[],
  sort: MarketplaceSort,
  fitScores: Record<string, number> = {},
  efficiencyScores: Record<string, number> = {},
) {
  return items.slice().sort((a, b) => {
    const aBillboard = billboards.find((item) => item.id === a.billboardId);
    const bBillboard = billboards.find((item) => item.id === b.billboardId);
    const aBids = bids.filter((bid) => bid.slotId === a.id);
    const bBids = bids.filter((bid) => bid.slotId === b.id);
    if (sort === "reserve")
      return a.reservePrice - b.reservePrice || a.id.localeCompare(b.id);
    if (sort === "traffic")
      return (
        (bBillboard?.estimatedDailyTraffic ?? 0) -
          (aBillboard?.estimatedDailyTraffic ?? 0) || a.id.localeCompare(b.id)
      );
    if (sort === "bids")
      return bBids.length - aBids.length || a.id.localeCompare(b.id);
    if (sort === "match")
      return (
        (fitScores[b.id] ?? 0) - (fitScores[a.id] ?? 0) ||
        a.id.localeCompare(b.id)
      );
    if (sort === "efficiency")
      return (
        (efficiencyScores[b.id] ?? 0) - (efficiencyScores[a.id] ?? 0) ||
        a.id.localeCompare(b.id)
      );
    if (sort === "ending")
      return (
        (a.auctionCloseTime
          ? new Date(a.auctionCloseTime).getTime()
          : Number.MAX_SAFE_INTEGER) -
          (b.auctionCloseTime
            ? new Date(b.auctionCloseTime).getTime()
            : Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id)
      );
    return (
      `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`) ||
      a.id.localeCompare(b.id)
    );
  });
}
