export type Role = "owner" | "advertiser" | "admin";
export type SlotStatus =
  "available" | "auction_open" | "sold" | "unsold" | "reserved" | "unavailable";
export type CreativeStatus =
  "draft" | "pending_review" | "approved" | "rejected";
export type Campaign = {
  id: string;
  advertiserId: string;
  name: string;
  totalBudget: number;
  startDate: string;
  endDate: string;
  preferredAreas: string[];
  preferredTimeWindows: string[];
  audienceTags: string[];
  qualityTier: "Any" | "Premium" | "Standard";
  creativeId: string;
  selectedSlotIds: string[];
  buyingMode: "manual" | "auto";
  maxBidPerSlot?: number;
  status: "draft" | "active";
  createdAt: string;
};
export type PlaybackStatus = "scheduled" | "playing" | "completed" | "failed";
export type ScheduledPlayback = {
  id: string;
  slotId: string;
  creativeId: string;
  advertiserId: string;
  status: PlaybackStatus;
  plannedStartAt: string;
  plannedEndAt: string;
  playbackTimestamp?: string;
  failureReason?: string;
  deliveryStatus?: "delivered" | "failed" | "pending";
  deliveryDetail?: string;
};
export type SettlementStatus =
  "pending" | "advertiser_paid" | "owner_payable" | "owner_paid";
export type Settlement = {
  id: string;
  slotId: string;
  clearingPrice: number;
  platformFee: number;
  ownerPayout: number;
  advertiserAmountDue: number;
  ownerAmountPayable: number;
  status: SettlementStatus;
  updatedAt: string;
};

export type Billboard = {
  id: string;
  ownerId: string;
  name: string;
  city: string;
  area: string;
  location?: string;
  latitude: number;
  longitude: number;
  screenType: string;
  dimensions: string;
  estimatedDailyTraffic: number;
  audienceProfile: string;
  qualityTier: "Premium" | "Standard";
  defaultReservePrice?: number;
  active?: boolean;
  imageUrl?: string;
  altitude?: number;
  uniqueHardwareId?: string;
  blackoutPeriods?: string;
  hardwareReliabilityNotes?: string;
  verificationStatus?: "pending" | "verified" | "rejected";
  verificationPhotos?: string[];
  rejectionReason?: string;
  faceCorners?: FaceCorner[];
  deliveryWebhookUrl?: string;
};
export type FaceCorner = { x: number; y: number };
export type Slot = {
  id: string;
  billboardId: string;
  date: string;
  startTime: string;
  endTime: string;
  reservePrice: number;
  status: SlotStatus;
  published?: boolean;
  ownerUse?: boolean;
  auctionOpenTime?: string;
  auctionCloseTime?: string;
  minimumBidIncrement?: number;
  antiSnipingWindowMinutes?: number;
  antiSnipingExtensionMinutes?: number;
};
export type Advertiser = { id: string; name: string; accent: string };
export type Creative = {
  id: string;
  advertiserId: string;
  name: string;
  imageUrl: string;
  status?: CreativeStatus;
  rejectionReason?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  width?: number;
  height?: number;
};
export type Bid = {
  id: string;
  slotId: string;
  advertiserId: string;
  amount: number;
  creativeId: string;
  createdAt: string;
};

export const platformFeeRate = 0.03;
export const minimumSlotDurationMinutes = 5;
export const users = [
  { id: "user-owner", name: "Aarav Mehta", role: "owner" as const },
  { id: "user-owner-2", name: "Skyline Outdoor Media", role: "owner" as const },
  { id: "user-megamart", name: "MegaMart", role: "advertiser" as const },
  { id: "user-quickfood", name: "QuickFood", role: "advertiser" as const },
  { id: "user-nova", name: "Nova Mobile", role: "advertiser" as const },
  { id: "user-admin", name: "Marketplace Ops", role: "admin" as const },
];
export const billboards: Billboard[] = [
  {
    id: "bb-hitech",
    ownerId: "user-owner",
    name: "Cyber Towers Landmark",
    city: "Hyderabad",
    area: "HITEC City",
    latitude: 17.4474,
    longitude: 78.3762,
    screenType: "High-brightness LED",
    dimensions: "40 × 20 ft",
    estimatedDailyTraffic: 185000,
    audienceProfile: "Tech professionals · commuters · premium retail",
    qualityTier: "Premium",
    imageUrl: "/billboards/bb-hitech.svg",
    faceCorners: [
      { x: 25, y: 25 }, { x: 75, y: 25 }, { x: 75, y: 66.667 }, { x: 25, y: 66.667 },
    ],
  },
  {
    id: "bb-gachibowli",
    ownerId: "user-owner",
    name: "Gachibowli Flyover",
    city: "Hyderabad",
    area: "Gachibowli",
    latitude: 17.4401,
    longitude: 78.3489,
    screenType: "Digital LED",
    dimensions: "30 × 15 ft",
    estimatedDailyTraffic: 142000,
    audienceProfile: "Business commuters · students · families",
    qualityTier: "Premium",
    imageUrl: "/billboards/bb-gachibowli.svg",
    faceCorners: [
      { x: 27, y: 30 }, { x: 73, y: 30 }, { x: 73, y: 68.333 }, { x: 27, y: 68.333 },
    ],
  },
  {
    id: "bb-financial",
    ownerId: "user-owner",
    name: "Nanakramguda Gateway",
    city: "Hyderabad",
    area: "Financial District",
    latitude: 17.4169,
    longitude: 78.3431,
    screenType: "Digital LED",
    dimensions: "35 × 18 ft",
    estimatedDailyTraffic: 128000,
    audienceProfile: "Finance professionals · decision makers",
    qualityTier: "Premium",
    imageUrl: "/billboards/bb-financial.svg",
    faceCorners: [
      { x: 25.7, y: 23.333 }, { x: 74.3, y: 23.333 }, { x: 74.3, y: 65 }, { x: 25.7, y: 65 },
    ],
  },
  {
    id: "bb-madhapur",
    ownerId: "user-owner-2",
    name: "Madhapur Social Hub",
    city: "Hyderabad",
    area: "Madhapur",
    latitude: 17.4483,
    longitude: 78.3915,
    screenType: "Digital LED",
    dimensions: "24 × 12 ft",
    estimatedDailyTraffic: 98000,
    audienceProfile: "Young professionals · dining · entertainment",
    qualityTier: "Standard",
    imageUrl: "/billboards/bb-madhapur.svg",
    faceCorners: [
      { x: 28, y: 33.333 }, { x: 72, y: 33.333 }, { x: 72, y: 70 }, { x: 28, y: 70 },
    ],
  },
  {
    id: "bb-jubilee",
    ownerId: "user-owner",
    name: "Jubilee Hills Check Post",
    city: "Hyderabad",
    area: "Jubilee Hills",
    latitude: 17.4239,
    longitude: 78.4075,
    screenType: "High-brightness LED",
    dimensions: "30 × 15 ft",
    estimatedDailyTraffic: 91000,
    audienceProfile: "Affluent households · luxury shoppers",
    qualityTier: "Premium",
    imageUrl: "/billboards/bb-jubilee.svg",
    faceCorners: [
      { x: 25, y: 20 }, { x: 75, y: 20 }, { x: 75, y: 61.667 }, { x: 25, y: 61.667 },
    ],
  },
  {
    id: "bb-banjara",
    ownerId: "user-owner-2",
    name: "Road No. 12 Boulevard",
    city: "Hyderabad",
    area: "Banjara Hills",
    latitude: 17.4138,
    longitude: 78.4483,
    screenType: "Digital LED",
    dimensions: "24 × 12 ft",
    estimatedDailyTraffic: 76000,
    audienceProfile: "Affluent households · professionals · visitors",
    qualityTier: "Standard",
    imageUrl: "/billboards/bb-banjara.svg",
    faceCorners: [
      { x: 29, y: 35 }, { x: 71, y: 35 }, { x: 71, y: 70 }, { x: 29, y: 70 },
    ],
  },
  {
    id: "bb-kondapur",
    ownerId: "user-owner-2",
    name: "Kondapur Junction",
    city: "Hyderabad",
    area: "Kondapur",
    latitude: 17.4697,
    longitude: 78.3657,
    screenType: "Digital LED",
    dimensions: "20 × 10 ft",
    estimatedDailyTraffic: 68000,
    audienceProfile: "IT employees · local residents",
    qualityTier: "Standard",
    imageUrl: "/billboards/bb-kondapur.svg",
    faceCorners: [
      { x: 30, y: 36.667 }, { x: 70, y: 36.667 }, { x: 70, y: 70 }, { x: 30, y: 70 },
    ],
  },
  {
    id: "bb-secunderabad",
    ownerId: "user-owner-2",
    name: "Paradise Circle",
    city: "Hyderabad",
    area: "Secunderabad",
    latitude: 17.4435,
    longitude: 78.4867,
    screenType: "Digital LED",
    dimensions: "30 × 15 ft",
    estimatedDailyTraffic: 115000,
    audienceProfile: "Daily commuters · shoppers · families",
    qualityTier: "Standard",
    imageUrl: "/billboards/bb-secunderabad.svg",
    faceCorners: [
      { x: 26, y: 26.667 }, { x: 74, y: 26.667 }, { x: 74, y: 66.667 }, { x: 26, y: 66.667 },
    ],
  },
];
export const advertisers: Advertiser[] = [
  { id: "adv-megamart", name: "MegaMart", accent: "#f97316" },
  { id: "adv-quickfood", name: "QuickFood", accent: "#ef4444" },
  { id: "adv-nova", name: "Nova Mobile", accent: "#06b6d4" },
];
export const creatives: Creative[] = [
  {
    id: "creative-megamart",
    advertiserId: "adv-megamart",
    name: "Weekend Super Sale",
    imageUrl: "/creatives/megamart.svg",
    mimeType: "image/png",
    fileSizeBytes: 420000,
    width: 1280,
    height: 640,
  },
  {
    id: "creative-quickfood",
    advertiserId: "adv-quickfood",
    name: "Dinner in 20 Minutes",
    imageUrl: "/creatives/quickfood.svg",
    mimeType: "image/png",
    fileSizeBytes: 380000,
    width: 1280,
    height: 640,
  },
  {
    id: "creative-nova",
    advertiserId: "adv-nova",
    name: "Nova X Pro",
    imageUrl: "/creatives/nova.svg",
    mimeType: "image/png",
    fileSizeBytes: 410000,
    width: 1280,
    height: 640,
  },
  {
    id: "creative-nova-jubilee",
    advertiserId: "adv-nova",
    name: "Nova X Pro — Jubilee Hills cut",
    imageUrl: "/creatives/nova.svg",
    status: "pending_review",
    mimeType: "image/png",
    fileSizeBytes: 405000,
    width: 1280,
    height: 640,
  },
  {
    id: "creative-quickfood-wide",
    advertiserId: "adv-quickfood",
    name: "Dinner in 20 Minutes — banner cut",
    imageUrl: "/creatives/quickfood-wide.svg",
    mimeType: "image/png",
    fileSizeBytes: 260000,
    width: 1600,
    height: 400,
  },
  {
    id: "creative-nova-square",
    advertiserId: "adv-nova",
    name: "Nova X Pro — square cut",
    imageUrl: "/creatives/nova-square.svg",
    mimeType: "image/png",
    fileSizeBytes: 300000,
    width: 800,
    height: 800,
  },
  {
    id: "creative-megamart-tall",
    advertiserId: "adv-megamart",
    name: "Weekend Super Sale — story cut",
    imageUrl: "/creatives/megamart-tall.svg",
    mimeType: "image/png",
    fileSizeBytes: 340000,
    width: 600,
    height: 1200,
  },
  {
    id: "creative-nova-pulse",
    advertiserId: "adv-nova",
    name: "Nova X Pro — animated pulse",
    imageUrl: "/creatives/nova-pulse.gif",
    mimeType: "image/gif",
    fileSizeBytes: 884243,
    width: 800,
    height: 400,
  },
];
export const slots: Slot[] = [
  {
    id: "slot-cyber-7pm",
    billboardId: "bb-hitech",
    date: "2026-09-06",
    startTime: "19:00",
    endTime: "20:00",
    reservePrice: 10000,
    status: "auction_open",
    auctionOpenTime: "2026-09-05T18:55:00+05:30",
    auctionCloseTime: "2026-09-06T18:55:00+05:30",
    minimumBidIncrement: 500,
    antiSnipingWindowMinutes: 5,
    antiSnipingExtensionMinutes: 5,
  },
  {
    id: "slot-gachibowli-8pm",
    billboardId: "bb-gachibowli",
    date: "2026-09-06",
    startTime: "20:00",
    endTime: "21:00",
    reservePrice: 8000,
    status: "available",
  },
  {
    id: "slot-financial-6pm",
    billboardId: "bb-financial",
    date: "2026-09-07",
    startTime: "18:00",
    endTime: "19:00",
    reservePrice: 9000,
    status: "available",
  },
  {
    id: "slot-madhapur-9pm",
    billboardId: "bb-madhapur",
    date: "2026-09-07",
    startTime: "21:00",
    endTime: "22:00",
    reservePrice: 6000,
    status: "available",
  },
  {
    id: "slot-jubilee-sold",
    billboardId: "bb-jubilee",
    date: "2026-09-05",
    startTime: "19:00",
    endTime: "20:00",
    reservePrice: 12000,
    status: "sold",
  },
  {
    id: "slot-banjara-unsold",
    billboardId: "bb-banjara",
    date: "2026-09-05",
    startTime: "20:00",
    endTime: "21:00",
    reservePrice: 7000,
    status: "unsold",
  },
];
export const bids: Bid[] = [
  {
    id: "bid-1",
    slotId: "slot-cyber-7pm",
    advertiserId: "adv-megamart",
    amount: 12000,
    creativeId: "creative-megamart",
    createdAt: "2026-09-05T09:02:00Z",
  },
  {
    id: "bid-2",
    slotId: "slot-cyber-7pm",
    advertiserId: "adv-quickfood",
    amount: 18000,
    creativeId: "creative-quickfood",
    createdAt: "2026-09-05T09:04:00Z",
  },
  {
    id: "bid-3",
    slotId: "slot-cyber-7pm",
    advertiserId: "adv-nova",
    amount: 15000,
    creativeId: "creative-nova",
    createdAt: "2026-09-05T09:06:00Z",
  },
  {
    id: "bid-jubilee-1",
    slotId: "slot-jubilee-sold",
    advertiserId: "adv-nova",
    amount: 12500,
    creativeId: "creative-nova-jubilee",
    createdAt: "2026-09-05T08:00:00Z",
  },
];
export function getBillboard(id: string) {
  return billboards.find((billboard) => billboard.id === id);
}
export function getAdvertiser(id: string) {
  return advertisers.find((advertiser) => advertiser.id === id);
}
export function getSlotBillboard(slot: Slot) {
  return getBillboard(slot.billboardId);
}
export function formatRupees(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
