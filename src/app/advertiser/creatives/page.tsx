import Link from "next/link";
import { PageIntro } from "@/components/app-shell";
import { advertisers } from "@/lib/data";
import { getCreatives } from "@/lib/db";
import { CreativeManager } from "../creative-manager";

export default async function CreativesPage() {
  const creatives = await getCreatives();
  return (
    <>
      <PageIntro
        eyebrow="Advertiser workspace"
        title="Creative library."
        description="Upload, preview, and reuse campaign assets across your billboard bids."
        action={
          <Link href="/advertiser" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600">
            Back to marketplace
          </Link>
        }
      />
      <CreativeManager initialCreatives={creatives} advertisers={advertisers} />
    </>
  );
}
