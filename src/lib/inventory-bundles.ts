import type { Billboard, Slot } from "./data";
import { getTimeOfDay } from "./marketplace";
import { estimateSelectedSlots } from "./reach-estimator";

export type InventoryBundle = {
  id: string;
  name: string;
  slots: Slot[];
  billboards: Billboard[];
  areas: string[];
  estimatedReach: number;
  baseCost: number;
  contextTags: string[];
  why: string;
};

function isEligible(slot: Slot, billboard?: Billboard) {
  return Boolean(billboard && billboard.active !== false && slot.published !== false && (slot.status === "available" || slot.status === "auction_open"));
}

function isFriday(slot: Slot) {
  return new Date(`${slot.date}T12:00:00Z`).getUTCDay() === 5;
}

export function buildInventoryBundles(slots: Slot[], billboards: Billboard[]): InventoryBundle[] {
  const inventory = slots.map((slot) => ({ slot, billboard: billboards.find((item) => item.id === slot.billboardId) })).filter((item): item is { slot: Slot; billboard: Billboard } => isEligible(item.slot, item.billboard));
  const westHyderabad = inventory.filter(({ billboard }) => billboard.longitude <= 78.42 && billboard.qualityTier === "Premium");
  const templates = [
    { id: "hitec-office-commuters", name: "HITEC Office Commuters", items: inventory.filter(({ billboard }) => billboard.area === "HITEC City" && /office|commuter|professional/i.test(billboard.audienceProfile)), tags: ["Tech Hub", "Office Commuters"], why: "Reach tech professionals and peak office movement around HITEC City." },
    { id: "premium-west-hyderabad", name: "Premium West Hyderabad", items: westHyderabad, tags: ["Premium", "West Hyderabad"], why: "A premium cross-area footprint for brands seeking high-quality west Hyderabad screens." },
    { id: "friday-evening-high-traffic", name: "Friday Evening High Traffic", items: inventory.filter(({ slot, billboard }) => isFriday(slot) && getTimeOfDay(slot.startTime) === "Evening" && billboard.estimatedDailyTraffic >= 120000), tags: ["Friday", "Evening Heavy", "High Traffic"], why: "Concentrate visibility into high-traffic Friday evening moments." },
    { id: "budget-reach-pack", name: "Budget Reach Pack", items: inventory.slice().sort((a, b) => a.slot.reservePrice - b.slot.reservePrice || b.billboard.estimatedDailyTraffic - a.billboard.estimatedDailyTraffic).slice(0, 3), tags: ["Budget", "Reach"], why: "Start with the lowest reserve opportunities while keeping multiple screens in play." },
    { id: "tech-corridor", name: "Tech Corridor", items: inventory.filter(({ billboard }) => /hitec|gachibowli|financial district|madhapur|kondapur|tech|it /i.test(`${billboard.area} ${billboard.audienceProfile}`)), tags: ["Tech Hub", "Office Commuters"], why: "Connect a broader tech-and-business corridor across Hyderabad's western cluster." },
    { id: "premium-launch-pack", name: "Premium Launch Pack", items: inventory.filter(({ billboard }) => billboard.qualityTier === "Premium" && billboard.estimatedDailyTraffic >= 100000), tags: ["Premium", "High Traffic"], why: "A strong launch footprint built from premium, high-traffic screens." },
  ];
  return templates.filter((template) => template.items.length > 0).map((template) => {
    const uniqueBillboards = Array.from(new Map(template.items.map(({ billboard }) => [billboard.id, billboard])).values());
    const estimated = estimateSelectedSlots(template.items.map(({ slot, billboard }) => ({ slot, billboard })));
    const areas = Array.from(new Set(template.items.map(({ billboard }) => billboard.area)));
    return { id: template.id, name: template.name, slots: template.items.map(({ slot }) => slot), billboards: uniqueBillboards, areas, estimatedReach: estimated.impressions, baseCost: template.items.reduce((total, { slot }) => total + slot.reservePrice, 0), contextTags: template.tags, why: template.why };
  });
}
