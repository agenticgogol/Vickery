import Link from "next/link";
import { PageIntro } from "@/components/app-shell";
import { ViabilityCalculator } from "./viability-calculator";
import { Methodology } from "./methodology";

export default function FinancialViabilityPage() {
  return (
    <>
      <PageIntro
        eyebrow="Marketplace operations"
        title="Hyderabad financial viability."
        description="Simulate Phase-1 marketplace scenarios — screens, exposure, fill, take rate, and cost — to check when the network breaks even and where it becomes strategically hard to bypass."
        action={
          <Link href="/admin" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600">
            Back to operations
          </Link>
        }
      />
      <div className="mt-6">
        <ViabilityCalculator />
        <Methodology />
      </div>
    </>
  );
}
