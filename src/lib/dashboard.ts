import { getAdvertiser, type Bid, type Billboard, type Creative, type Slot } from "./data";
import type { StoredAuctionResult } from "./db";
import { getBidStatus } from "./bid-status";

export function getDashboardMetrics(slots: Slot[], bids: Bid[], billboards: Billboard[], auctionResults: StoredAuctionResult[]) {
  const cleared = auctionResults.filter((result) => result.status === "sold");
  const gmv = cleared.reduce(
    (total, result) => total + (result.clearingPrice ?? 0),
    0,
  );
  const platformRevenue = cleared.reduce(
    (total, result) => total + result.platformFee,
    0,
  );
  const settledSlots = slots.filter(
    (slot) => slot.status === "sold" || slot.status === "unsold",
  );
  const durationHours = (startTime: string, endTime: string) => {
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);
    const minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
    return (minutes > 0 ? minutes : minutes + 24 * 60) / 60;
  };
  const availableSlots = slots.filter(
    (slot) =>
      slot.published !== false &&
      (slot.status === "available" || slot.status === "auction_open"),
  );
  const soldSlots = slots.filter((slot) => slot.status === "sold");
  const segment = (slot: (typeof slots)[number]) => {
    const hour = Number(slot.startTime.split(":")[0]);
    if (hour >= 5 && hour < 12) return "Morning";
    if (hour >= 12 && hour < 17) return "Afternoon";
    if (hour >= 17 && hour < 21) return "Evening";
    return "Night";
  };
  const sellThrough = (items: typeof slots) => {
    const settled = items.filter(
      (slot) => slot.status === "sold" || slot.status === "unsold",
    );
    const sold = items.filter((slot) => slot.status === "sold");
    return {
      sold: sold.length,
      settled: settled.length,
      rate: settled.length ? (sold.length / settled.length) * 100 : 0,
    };
  };
  const areas = Array.from(
    new Set(
      slots
        .map(
          (slot) =>
            billboards.find((billboard) => billboard.id === slot.billboardId)
              ?.area,
        )
        .filter((area): area is string => Boolean(area)),
    ),
  )
    .sort()
    .map((area) => ({
      area,
      ...sellThrough(
        slots.filter(
          (slot) =>
            billboards.find((billboard) => billboard.id === slot.billboardId)
              ?.area === area,
        ),
      ),
    }));
  const timeOfDay = ["Morning", "Afternoon", "Evening", "Night"].map(
    (time) => ({
      time,
      ...sellThrough(slots.filter((slot) => segment(slot) === time)),
    }),
  );
  const connectedBillboards = billboards.filter(
    (billboard) => billboard.active !== false,
  );

  return {
    availableSlots: slots.filter(
      (slot) => slot.published !== false && slot.status === "available",
    ).length,
    auctionsOpen: slots.filter((slot) => slot.status === "auction_open").length,
    soldSlots: slots.filter((slot) => slot.status === "sold").length,
    unsoldSlots: slots.filter((slot) => slot.status === "unsold").length,
    totalBids: bids.length,
    gmv,
    platformRevenue,
    ownerPayout: gmv - platformRevenue,
    averageClearingPrice: cleared.length ? Math.round(gmv / cleared.length) : 0,
    fillRate: settledSlots.length
      ? (slots.filter((slot) => slot.status === "sold").length /
          settledSlots.length) *
        100
      : 0,
    bidsPerAuction: (() => {
      const auctionCount = slots.filter(
        (slot) =>
          bids.some((bid) => bid.slotId === slot.id) ||
          auctionResults.some((result) => result.slotId === slot.id),
      ).length;
      return auctionCount
        ? Math.round((bids.length / auctionCount) * 10) / 10
        : 0;
    })(),
    connectedBillboards: connectedBillboards.length,
    productiveBillboards: connectedBillboards.filter((billboard) =>
      soldSlots.some((slot) => slot.billboardId === billboard.id),
    ).length,
    availableScreenHours: availableSlots.reduce(
      (total, slot) => total + durationHours(slot.startTime, slot.endTime),
      0,
    ),
    soldScreenHours: soldSlots.reduce(
      (total, slot) => total + durationHours(slot.startTime, slot.endTime),
      0,
    ),
    effectiveTakeRate: gmv ? (platformRevenue / gmv) * 100 : 0,
    averageReservePrice: slots.length
      ? Math.round(
          slots.reduce((total, slot) => total + slot.reservePrice, 0) /
            slots.length,
        )
      : 0,
    averageWinningBid: cleared.length
      ? Math.round(
          cleared.reduce(
            (total, result) => total + (result.winningBid ?? 0),
            0,
          ) / cleared.length,
        )
      : 0,
    sellThroughByArea: areas,
    sellThroughByTimeOfDay: timeOfDay,
    bidsByAdvertiser: Array.from(
      bids.reduce((map, bid) => {
        map.set(bid.advertiserId, (map.get(bid.advertiserId) ?? 0) + 1);
        return map;
      }, new Map<string, number>()),
    )
      .map(([advertiserId, count]) => ({
        advertiserId,
        name: getAdvertiser(advertiserId)?.name ?? "Advertiser",
        count,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    averageBidToReserveRatio: (() => {
      const ratios = bids
        .map((bid) => {
          const slot = slots.find((item) => item.id === bid.slotId);
          return slot && slot.reservePrice > 0
            ? bid.amount / slot.reservePrice
            : null;
        })
        .filter((ratio): ratio is number => ratio !== null);
      return ratios.length
        ? Math.round(
            (ratios.reduce((total, ratio) => total + ratio, 0) /
              ratios.length) *
              100,
          ) / 100
        : 0;
    })(),
  };
}

export function getOwnerDashboard(
  ownerId: string,
  billboards: Billboard[],
  slots: Slot[],
  creatives: Creative[],
  auctionResults: StoredAuctionResult[],
) {
  const ownerBillboards = billboards.filter(
    (billboard) => billboard.ownerId === ownerId,
  );
  const ownerBillboardIds = new Set(
    ownerBillboards.map((billboard) => billboard.id),
  );
  const ownerSlots = slots.filter((slot) =>
    ownerBillboardIds.has(slot.billboardId),
  );
  const today = new Date().toISOString().slice(0, 10);
  return {
    activeBillboards: ownerBillboards.filter((billboard) =>
      ownerSlots.some(
        (slot) => slot.billboardId === billboard.id && slot.published !== false,
      ),
    ).length,
    availableSlots: ownerSlots.filter(
      (slot) => slot.published !== false && slot.status === "available",
    ).length,
    openAuctions: ownerSlots.filter((slot) => slot.status === "auction_open")
      .length,
    soldSlots: ownerSlots.filter((slot) => slot.status === "sold").length,
    ownerEarnings: auctionResults
      .filter(
        (result) =>
          result.status === "sold" &&
          ownerBillboardIds.has(
            slots.find((slot) => slot.id === result.slotId)?.billboardId ?? "",
          ),
      )
      .reduce((total, result) => total + result.ownerPayout, 0),
    upcomingSchedules: ownerSlots
      .filter((slot) => slot.status === "sold" && slot.date >= today)
      .sort((a, b) =>
        `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`),
      )
      .slice(0, 4)
      .map((slot) => {
        const result = auctionResults.find((item) => item.slotId === slot.id);
        const billboard = billboards.find(
          (item) => item.id === slot.billboardId,
        );
        const creative = result?.creativeId
          ? creatives.find((item) => item.id === result.creativeId)
          : undefined;
        return {
          slotId: slot.id,
          billboardName: billboard?.name ?? "Billboard",
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          advertiserName: result?.winnerAdvertiserId
            ? (getAdvertiser(result.winnerAdvertiserId)?.name ??
              "Winning advertiser")
            : "Scheduled advertiser",
          creativeName: creative?.name ?? "Scheduled creative",
        };
      }),
  };
}

export function getAdvertiserDashboard(bids: Bid[], slots: Slot[], billboards: Billboard[], auctionResults: StoredAuctionResult[]) {
  const active = bids.filter((bid) => {
    const slot = slots.find((item) => item.id === bid.slotId);
    return slot && !auctionResults.some((result) => result.slotId === slot.id);
  });
  const outbid = active.filter((bid) => {
    const slot = slots.find((item) => item.id === bid.slotId);
    return slot
      ? getBidStatus(
          bid,
          slot,
          bids.filter((item) => item.slotId === slot.id),
        ) === "Outbid"
      : false;
  });
  const wins = bids.filter((bid) => {
    const result = auctionResults.find((item) => item.slotId === bid.slotId);
    return (
      result?.status === "sold" &&
      result.winnerAdvertiserId === bid.advertiserId &&
      result.winningBid === bid.amount
    );
  });
  const losses = bids.filter(
    (bid) =>
      auctionResults.some(
        (result) =>
          result.slotId === bid.slotId &&
          (result.status === "sold" || result.status === "unsold"),
      ) && !wins.some((win) => win.id === bid.id),
  );
  const today = new Date().toISOString().slice(0, 10);
  const upcomingPlacements = Array.from(
    new Map(
      wins
        .map((bid) => {
          const slot = slots.find((item) => item.id === bid.slotId);
          const billboard =
            slot && billboards.find((item) => item.id === slot.billboardId);
          return slot && slot.date >= today
            ? {
                slotId: slot.id,
                billboardName: billboard?.name ?? "Billboard",
                area: billboard?.area ?? "Hyderabad",
                date: slot.date,
                startTime: slot.startTime,
                endTime: slot.endTime,
                advertiserName:
                  getAdvertiser(bid.advertiserId)?.name ?? "Advertiser",
              }
            : null;
        })
        .filter((placement): placement is NonNullable<typeof placement> =>
          Boolean(placement),
        )
        .map((placement) => [placement.slotId, placement]),
    ).values(),
  ).slice(0, 4);

  return {
    activeBids: active.length,
    outbidBids: outbid.length,
    wins: wins.length,
    losses: losses.length,
    totalSpend: wins.reduce(
      (total, bid) =>
        total +
        (auctionResults.find((result) => result.slotId === bid.slotId)
          ?.clearingPrice ?? 0),
      0,
    ),
    upcomingPlacements,
  };
}
