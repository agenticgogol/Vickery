import { OwnerFlow } from "./owner-flow";
import { getAuctionResults, getOwnerBillboards, getSlots, getBids, getCreatives } from "@/lib/db";
import { getOwnerDashboard } from "@/lib/dashboard";
import { getSession } from "@/lib/session";

export default async function OwnerPage() {
  const session = await getSession();
  const ownerId = session?.userId ?? "user-owner";
  const [billboards, slots, bids, results, creatives] = await Promise.all([
    getOwnerBillboards(ownerId),
    getSlots(),
    getBids(),
    getAuctionResults(),
    getCreatives(),
  ]);
  return (
    <OwnerFlow
      initialBillboards={billboards}
      initialSlots={slots}
      initialBids={bids}
      initialResults={results}
      dashboard={getOwnerDashboard(ownerId, billboards, slots, creatives, results)}
    />
  );
}
