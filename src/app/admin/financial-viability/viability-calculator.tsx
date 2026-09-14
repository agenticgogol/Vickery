"use client";

import { useMemo, useState } from "react";
import { formatRupees } from "@/lib/data";

type TierKey = "A" | "B" | "C" | "D";

const TIER_LABELS: Record<TierKey, string> = {
  A: "A · Landmark / arterial",
  B: "B · High-value commercial",
  C: "C · Neighborhood / long-tail",
  D: "D · Indoor / retail / contextual",
};

// Default daypart hours/day — editable per tier, these are the starting assumptions only.
const DEFAULT_TIER_HOURS: Record<TierKey, { peak: number; offPeak: number }> = {
  A: { peak: 5, offPeak: 9 },
  B: { peak: 4, offPeak: 10 },
  C: { peak: 2, offPeak: 10 },
  D: { peak: 2, offPeak: 8 },
};

type TierHoursMap = Record<TierKey, { peak: number; offPeak: number }>;
type TierPricing = Record<TierKey, { peakPrice: number; offPeakPrice: number }>;

type TierFillRates = Record<TierKey, number>;

type Scenario = {
  label: string;
  screens: number;
  mix: Record<TierKey, number>;
  hours: TierHoursMap;
  pricing: TierPricing;
  inventoryExposedPct: number;
  fillRatePct: TierFillRates;
  regulatoryEligiblePct: number;
  screenUptimePct: number;
  sellableDaysPerMonth: number;
  takeRatePct: number;
  ownerDiscountPp: number;
  badDebtPct: number;
  monthlyOperatingCost: number;
  ownerCac: number;
  newOwnersPerMonth: number;
  advertiserCac: number;
  newAdvertisersPerMonth: number;
  hardwareCostPerScreen: number;
  amortizationMonths: number;
};

// Recalibrated so Base's blended ₹/screen/month lands near the case study's own ₹2L benchmark
// at Base fill/exposure levels — the original flat estimate undershot it by ~35%.
const defaultPricing: TierPricing = {
  A: { peakPrice: 3_000, offPeakPrice: 675 },
  B: { peakPrice: 1_350, offPeakPrice: 375 },
  C: { peakPrice: 400, offPeakPrice: 150 },
  D: { peakPrice: 190, offPeakPrice: 150 },
};

const scenarios: Scenario[] = [
  {
    label: "Failure",
    screens: 300,
    mix: { A: 10, B: 20, C: 40, D: 30 },
    hours: DEFAULT_TIER_HOURS,
    pricing: defaultPricing,
    inventoryExposedPct: 25,
    fillRatePct: { A: 35, B: 28, C: 18, D: 12 },
    regulatoryEligiblePct: 70,
    screenUptimePct: 80,
    sellableDaysPerMonth: 24,
    takeRatePct: 2.5,
    ownerDiscountPp: 0,
    badDebtPct: 5,
    monthlyOperatingCost: 2_500_000,
    ownerCac: 20_000,
    newOwnersPerMonth: 5,
    advertiserCac: 15_000,
    newAdvertisersPerMonth: 3,
    hardwareCostPerScreen: 0,
    amortizationMonths: 24,
  },
  {
    label: "Downside",
    screens: 500,
    mix: { A: 10, B: 20, C: 40, D: 30 },
    hours: DEFAULT_TIER_HOURS,
    pricing: defaultPricing,
    inventoryExposedPct: 40,
    fillRatePct: { A: 55, B: 45, C: 30, D: 20 },
    regulatoryEligiblePct: 80,
    screenUptimePct: 85,
    sellableDaysPerMonth: 26,
    takeRatePct: 2.5,
    ownerDiscountPp: 0.5,
    badDebtPct: 4,
    monthlyOperatingCost: 2_500_000,
    ownerCac: 20_000,
    newOwnersPerMonth: 8,
    advertiserCac: 15_000,
    newAdvertisersPerMonth: 5,
    hardwareCostPerScreen: 0,
    amortizationMonths: 24,
  },
  {
    label: "Base",
    screens: 1_000,
    mix: { A: 15, B: 25, C: 35, D: 25 },
    hours: DEFAULT_TIER_HOURS,
    pricing: defaultPricing,
    inventoryExposedPct: 75,
    fillRatePct: { A: 90, B: 80, C: 70, D: 58 },
    regulatoryEligiblePct: 90,
    screenUptimePct: 92,
    sellableDaysPerMonth: 28,
    takeRatePct: 3,
    ownerDiscountPp: 0,
    badDebtPct: 1.5,
    monthlyOperatingCost: 2_500_000,
    ownerCac: 20_000,
    newOwnersPerMonth: 10,
    advertiserCac: 15_000,
    newAdvertisersPerMonth: 5,
    hardwareCostPerScreen: 0,
    amortizationMonths: 24,
  },
  {
    label: "Strong",
    screens: 2_000,
    mix: { A: 20, B: 30, C: 30, D: 20 },
    hours: DEFAULT_TIER_HOURS,
    pricing: defaultPricing,
    inventoryExposedPct: 70,
    fillRatePct: { A: 92, B: 82, C: 68, D: 55 },
    regulatoryEligiblePct: 92,
    screenUptimePct: 93,
    sellableDaysPerMonth: 28,
    takeRatePct: 3,
    ownerDiscountPp: 1,
    badDebtPct: 2,
    monthlyOperatingCost: 2_500_000,
    ownerCac: 20_000,
    newOwnersPerMonth: 20,
    advertiserCac: 15_000,
    newAdvertisersPerMonth: 15,
    hardwareCostPerScreen: 0,
    amortizationMonths: 24,
  },
];

const base = scenarios[2];
const tierKeys: TierKey[] = ["A", "B", "C", "D"];

function Field({ label, value, onChange, min, max, step, format }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number; step: number; format: (value: number) => string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
        <span>{label}</span>
        <span className="text-slate-950">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 w-full accent-cyan-600" />
    </div>
  );
}

function NumberInput({ value, onChange, prefix }: { value: number; onChange: (value: number) => void; prefix?: string }) {
  return (
    <label className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-700">
      {prefix && <span className="text-slate-400">{prefix}</span>}
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="w-20 outline-none"
      />
    </label>
  );
}

export function ViabilityCalculator() {
  const [screens, setScreens] = useState(base.screens);
  const [mix, setMix] = useState<Record<TierKey, number>>(base.mix);
  const [hours, setHours] = useState<TierHoursMap>(base.hours);
  const [pricing, setPricing] = useState<TierPricing>(base.pricing);
  const [inventoryExposedPct, setInventoryExposedPct] = useState(base.inventoryExposedPct);
  const [fillRatePct, setFillRatePct] = useState<TierFillRates>(base.fillRatePct);
  const [regulatoryEligiblePct, setRegulatoryEligiblePct] = useState(base.regulatoryEligiblePct);
  const [screenUptimePct, setScreenUptimePct] = useState(base.screenUptimePct);
  const [sellableDaysPerMonth, setSellableDaysPerMonth] = useState(base.sellableDaysPerMonth);
  const [takeRatePct, setTakeRatePct] = useState(base.takeRatePct);
  const [ownerDiscountPp, setOwnerDiscountPp] = useState(base.ownerDiscountPp);
  const [badDebtPct, setBadDebtPct] = useState(base.badDebtPct);
  const [monthlyOperatingCost, setMonthlyOperatingCost] = useState(base.monthlyOperatingCost);
  const [ownerCac, setOwnerCac] = useState(base.ownerCac);
  const [newOwnersPerMonth, setNewOwnersPerMonth] = useState(base.newOwnersPerMonth);
  const [advertiserCac, setAdvertiserCac] = useState(base.advertiserCac);
  const [newAdvertisersPerMonth, setNewAdvertisersPerMonth] = useState(base.newAdvertisersPerMonth);
  const [hardwareCostPerScreen, setHardwareCostPerScreen] = useState(base.hardwareCostPerScreen);
  const [amortizationMonths, setAmortizationMonths] = useState(base.amortizationMonths);

  function applyScenario(scenario: Scenario) {
    setScreens(scenario.screens);
    setMix(scenario.mix);
    setHours(scenario.hours);
    setPricing(scenario.pricing);
    setInventoryExposedPct(scenario.inventoryExposedPct);
    setFillRatePct(scenario.fillRatePct);
    setRegulatoryEligiblePct(scenario.regulatoryEligiblePct);
    setScreenUptimePct(scenario.screenUptimePct);
    setSellableDaysPerMonth(scenario.sellableDaysPerMonth);
    setTakeRatePct(scenario.takeRatePct);
    setOwnerDiscountPp(scenario.ownerDiscountPp);
    setBadDebtPct(scenario.badDebtPct);
    setMonthlyOperatingCost(scenario.monthlyOperatingCost);
    setOwnerCac(scenario.ownerCac);
    setNewOwnersPerMonth(scenario.newOwnersPerMonth);
    setAdvertiserCac(scenario.advertiserCac);
    setNewAdvertisersPerMonth(scenario.newAdvertisersPerMonth);
    setHardwareCostPerScreen(scenario.hardwareCostPerScreen);
    setAmortizationMonths(scenario.amortizationMonths);
  }

  const result = useMemo(() => {
    const mixTotal = tierKeys.reduce((total, tier) => total + mix[tier], 0) || 1;
    const eligibilityFactor = (regulatoryEligiblePct / 100) * (screenUptimePct / 100);

    const tierBreakdown = tierKeys.map((tier) => {
      const tierScreens = screens * (mix[tier] / mixTotal) * eligibilityFactor;
      const tierHours = hours[tier];
      const price = pricing[tier];
      const exposureFillFactor = (inventoryExposedPct / 100) * (fillRatePct[tier] / 100);
      const dailyRatePerScreen = tierHours.peak * price.peakPrice + tierHours.offPeak * price.offPeakPrice;
      const monthlyGmvPerScreen = dailyRatePerScreen * sellableDaysPerMonth * exposureFillFactor;
      const monthlyGmv = tierScreens * monthlyGmvPerScreen;
      return { tier, tierScreens, monthlyGmvPerScreen, monthlyGmv };
    });

    const monthlyGmv = tierBreakdown.reduce((total, row) => total + row.monthlyGmv, 0);
    const netTakeRatePct = Math.max(takeRatePct - ownerDiscountPp, 0);
    const grossPlatformRevenue = monthlyGmv * (netTakeRatePct / 100);
    const monthlyPlatformRevenue = grossPlatformRevenue * (1 - badDebtPct / 100);
    const monthlyCac = newOwnersPerMonth * ownerCac + newAdvertisersPerMonth * advertiserCac;
    const monthlyHardwareAmortization = amortizationMonths > 0 ? (screens * hardwareCostPerScreen) / amortizationMonths : 0;
    const totalMonthlyCost = monthlyOperatingCost + monthlyCac + monthlyHardwareAmortization;
    const monthlyContribution = monthlyPlatformRevenue - totalMonthlyCost;
    const breakevenMonthlyGmv = netTakeRatePct > 0 && badDebtPct < 100 ? totalMonthlyCost / ((netTakeRatePct / 100) * (1 - badDebtPct / 100)) : Infinity;

    return {
      tierBreakdown,
      monthlyGmv,
      annualGmv: monthlyGmv * 12,
      netTakeRatePct,
      monthlyPlatformRevenue,
      annualPlatformRevenue: monthlyPlatformRevenue * 12,
      monthlyCac,
      monthlyHardwareAmortization,
      totalMonthlyCost,
      monthlyContribution,
      annualContribution: monthlyContribution * 12,
      breakevenMonthlyGmv,
    };
  }, [screens, mix, hours, pricing, inventoryExposedPct, fillRatePct, regulatoryEligiblePct, screenUptimePct, sellableDaysPerMonth, takeRatePct, ownerDiscountPp, badDebtPct, monthlyOperatingCost, ownerCac, newOwnersPerMonth, advertiserCac, newAdvertisersPerMonth, hardwareCostPerScreen, amortizationMonths]);


  const viable = result.monthlyContribution >= 0;
  const mixTotal = tierKeys.reduce((total, tier) => total + mix[tier], 0);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-950">Scenario presets</h2>
            <p className="mt-1 text-xs text-slate-500">Bottom-up: tier mix × sellable hours/day × price/hour, not a flat "avg screen value."</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {scenarios.map((scenario) => (
              <button key={scenario.label} type="button" onClick={() => applyScenario(scenario)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:border-cyan-300 hover:text-cyan-700">
                {scenario.label}
              </button>
            ))}
          </div>
        </div>

        <Field label="Connected / productive screens" value={screens} onChange={setScreens} min={100} max={3_000} step={50} format={(v) => v.toLocaleString("en-IN")} />

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="pb-2">Tier</th>
                <th className="pb-2">Mix %</th>
                <th className="pb-2">Peak hrs/day</th>
                <th className="pb-2">Peak ₹/hr</th>
                <th className="pb-2">Off-peak hrs/day</th>
                <th className="pb-2">Off-peak ₹/hr</th>
                <th className="pb-2">Fill rate</th>
              </tr>
            </thead>
            <tbody>
              {tierKeys.map((tier) => (
                <tr key={tier} className="border-t border-slate-100">
                  <td className="py-2 pr-3 font-bold text-slate-700">{TIER_LABELS[tier]}</td>
                  <td className="py-2 pr-3"><NumberInput value={mix[tier]} onChange={(v) => setMix((prev) => ({ ...prev, [tier]: v }))} /></td>
                  <td className="py-2 pr-3"><NumberInput value={hours[tier].peak} onChange={(v) => setHours((prev) => ({ ...prev, [tier]: { ...prev[tier], peak: v } }))} /></td>
                  <td className="py-2 pr-3"><NumberInput prefix="₹" value={pricing[tier].peakPrice} onChange={(v) => setPricing((prev) => ({ ...prev, [tier]: { ...prev[tier], peakPrice: v } }))} /></td>
                  <td className="py-2 pr-3"><NumberInput value={hours[tier].offPeak} onChange={(v) => setHours((prev) => ({ ...prev, [tier]: { ...prev[tier], offPeak: v } }))} /></td>
                  <td className="py-2 pr-3"><NumberInput prefix="₹" value={pricing[tier].offPeakPrice} onChange={(v) => setPricing((prev) => ({ ...prev, [tier]: { ...prev[tier], offPeakPrice: v } }))} /></td>
                  <td className="py-2 pr-3"><NumberInput prefix="%" value={fillRatePct[tier]} onChange={(v) => setFillRatePct((prev) => ({ ...prev, [tier]: v }))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-slate-400">Mix normalizes automatically (currently sums to {mixTotal}%). Hours/day default to a daypart assumption per tier but are editable.</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-950">Supply reliability &amp; eligibility</h2>
            <p className="mt-1 text-xs text-slate-500">Hyderabad-specific supply-side drag — separate from demand-side fill.</p>
            <div className="mt-4 space-y-5">
              <Field label="Regulatory-eligible screens (Telangana digital-signage rules)" value={regulatoryEligiblePct} onChange={setRegulatoryEligiblePct} min={20} max={100} step={5} format={(v) => `${v}%`} />
              <Field label="Screen uptime (power / hardware reliability)" value={screenUptimePct} onChange={setScreenUptimePct} min={50} max={100} step={5} format={(v) => `${v}%`} />
              <Field label="Sellable days/month (net of MCC / election blackout)" value={sellableDaysPerMonth} onChange={setSellableDaysPerMonth} min={15} max={30} step={1} format={(v) => `${v} days`} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-950">Marketplace mechanics</h2>
            <div className="mt-4 space-y-5">
              <Field label="Inventory exposed to platform" value={inventoryExposedPct} onChange={setInventoryExposedPct} min={0} max={100} step={5} format={(v) => `${v}%`} />
              <p className="-mt-2 text-[11px] text-slate-400">Fill rate is set per tier in the table above — premium screens fill faster than long-tail.</p>
              <Field label="Platform take rate (configurable)" value={takeRatePct} onChange={setTakeRatePct} min={0.5} max={10} step={0.5} format={(v) => `${v}%`} />
              <Field label="Owner-negotiated discount off take rate" value={ownerDiscountPp} onChange={setOwnerDiscountPp} min={0} max={5} step={0.25} format={(v) => `${v}pp`} />
              <Field label="Bad debt / uncollected commission" value={badDebtPct} onChange={setBadDebtPct} min={0} max={20} step={1} format={(v) => `${v}%`} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-950">Costs</h2>
            <div className="mt-4 space-y-5">
              <Field label="Monthly operating cost" value={monthlyOperatingCost} onChange={setMonthlyOperatingCost} min={500_000} max={10_000_000} step={250_000} format={formatRupees} />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Owner CAC" value={ownerCac} onChange={setOwnerCac} min={0} max={100_000} step={5_000} format={formatRupees} />
                <Field label="New owners/month" value={newOwnersPerMonth} onChange={setNewOwnersPerMonth} min={0} max={50} step={1} format={(v) => String(v)} />
                <Field label="Advertiser CAC" value={advertiserCac} onChange={setAdvertiserCac} min={0} max={100_000} step={5_000} format={formatRupees} />
                <Field label="New advertisers/month" value={newAdvertisersPerMonth} onChange={setNewAdvertisersPerMonth} min={0} max={50} step={1} format={(v) => String(v)} />
              </div>
              <Field label="Hardware/integration cost per screen" value={hardwareCostPerScreen} onChange={setHardwareCostPerScreen} min={0} max={100_000} step={5_000} format={formatRupees} />
              <Field label="Amortization period" value={amortizationMonths} onChange={setAmortizationMonths} min={6} max={48} step={6} format={(v) => `${v} months`} />
            </div>
          </section>
        </div>

        <section className="space-y-4">
          <div className={`rounded-2xl border p-5 shadow-sm ${viable ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            <p className={`text-xs font-black uppercase tracking-[0.18em] ${viable ? "text-emerald-700" : "text-red-700"}`}>{viable ? "Contribution positive" : "Below breakeven"}</p>
            <p className={`mt-1 font-display text-2xl font-black ${viable ? "text-emerald-950" : "text-red-950"}`}>{formatRupees(result.monthlyContribution)}/month</p>
            <p className={`mt-1 text-xs ${viable ? "text-emerald-800/70" : "text-red-800/70"}`}>Net platform revenue minus opex, CAC, and amortized hardware.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-950">GMV by tier</h3>
            <dl className="mt-3 space-y-2 text-sm">
              {result.tierBreakdown.map((row) => (
                <div key={row.tier} className="flex justify-between">
                  <dt className="text-slate-500">Tier {row.tier} ({Math.round(row.tierScreens)} eligible &amp; live)</dt>
                  <dd className="font-bold text-slate-950">{formatRupees(row.monthlyGmv)}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-slate-100 pt-2"><dt className="font-bold text-slate-700">Monthly GMV</dt><dd className="font-bold text-slate-950">{formatRupees(result.monthlyGmv)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Annual GMV</dt><dd className="font-bold text-slate-950">{formatRupees(result.annualGmv)}</dd></div>
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-950">Platform economics</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Net effective take rate</dt><dd className="font-bold text-slate-950">{result.netTakeRatePct.toFixed(2)}%</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Monthly platform revenue</dt><dd className="font-bold text-slate-950">{formatRupees(result.monthlyPlatformRevenue)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Annual platform revenue</dt><dd className="font-bold text-slate-950">{formatRupees(result.annualPlatformRevenue)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Monthly CAC spend</dt><dd className="font-bold text-slate-950">{formatRupees(result.monthlyCac)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Monthly hardware amortization</dt><dd className="font-bold text-slate-950">{formatRupees(result.monthlyHardwareAmortization)}</dd></div>
              <div className="flex justify-between border-t border-slate-100 pt-2"><dt className="font-bold text-slate-700">Total monthly cost</dt><dd className="font-bold text-slate-950">{formatRupees(result.totalMonthlyCost)}</dd></div>
              <div className="flex justify-between"><dt className="font-bold text-slate-700">Annual contribution</dt><dd className={`font-bold ${viable ? "text-emerald-700" : "text-red-700"}`}>{formatRupees(result.annualContribution)}</dd></div>
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-950">Breakeven</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Monthly GMV required</dt><dd className="font-bold text-slate-950">{Number.isFinite(result.breakevenMonthlyGmv) ? formatRupees(result.breakevenMonthlyGmv) : "—"}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-slate-500">Raising the take rate only helps if the owner discount, bad debt, and fill rate hold steady — in practice a higher take rate tends to push owners toward multi-homing, which erodes exposed inventory and fill together.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
