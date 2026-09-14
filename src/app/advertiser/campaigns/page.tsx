import Link from "next/link";
import { PageIntro } from "@/components/app-shell";
import { advertisers } from "@/lib/data";
import { getBillboards, getSlots, getCreatives } from "@/lib/db";
import { CampaignBuilder } from "./campaign-builder";

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ slots?: string }>;
}) {
  const params = await searchParams;
  const initialSlotIds = (params.slots ?? "").split(",").filter(Boolean);
  const [slots, billboards, creatives] = await Promise.all([getSlots(), getBillboards(), getCreatives()]);
  return (
    <>
      <PageIntro
        eyebrow="Advertiser workspace"
        title="Plan a Campaign."
        description="Set a goal, budget, audience, and timing; then choose recommended inventory and bid across multiple slots."
        action={
          <div className="flex gap-2">
            <Link
              href="#campaign-packages"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600"
            >
              Ready-made packages
            </Link>
            <Link
              href="/advertiser"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600"
            >
              Back to marketplace
            </Link>
          </div>
        }
      />
      <CampaignBuilder
        slots={slots}
        billboards={billboards}
        creatives={creatives}
        advertisers={advertisers}
        initialSlotIds={initialSlotIds}
      />
    </>
  );
}
