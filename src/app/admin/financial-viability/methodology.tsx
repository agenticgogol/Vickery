function Row({ term, formula, meaning }: { term: string; formula?: string; meaning: string }) {
  return (
    <div className="border-t border-slate-100 py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-slate-950">{term}</span>
        {formula && <code className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">{formula}</code>}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{meaning}</p>
    </div>
  );
}

export function Methodology() {
  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg font-black text-slate-950">Methodology, in plain English</h2>
      <p className="mt-1 text-xs text-slate-500">
        Every number on this page is built bottom-up from four questions: how many screens do we
        actually have selling rights to, how many hours a day can each one sell, what does an hour
        sell for, and how much of that gets collected. Nothing here is a market forecast — it's a
        calculator for testing "what would have to be true" for Hyderabad to work.
      </p>

      <div className="mt-5">
        <h3 className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Step 1 — How many screens can actually sell</h3>
        <div className="mt-2">
          <Row
            term="Eligible &amp; live screens"
            formula="Connected screens × Mix % × Regulatory-eligible % × Uptime %"
            meaning="Start with screens you're connected to. Not all of them count: some fraction won't legally qualify under Telangana's digital-signage rules (Regulatory-eligible %), and of the ones that do, some are down for maintenance or power cuts at any given time (Uptime %). What's left is the screen-count that can genuinely generate revenue in a month — not the number on the network dashboard."
          />
          <Row
            term="Mix %"
            meaning="Every screen is not equal. We split the network into four tiers — A (landmark/arterial, e.g. HITEC City junction), B (high-value commercial, e.g. Gachibowli), C (neighborhood/long-tail), D (indoor/retail). Mix % is what share of your total screens sits in each tier. This matters because price, hours, and fill rate are all set per tier below — a network that's 60% Tier D looks very different from one that's 60% Tier A even at the same screen count."
          />
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Step 2 — How much one screen can sell in a day</h3>
        <div className="mt-2">
          <Row
            term="Daily rate per screen"
            formula="(Peak hrs/day × Peak ₹/hr) + (Off-peak hrs/day × Off-peak ₹/hr)"
            meaning="A screen doesn't earn the same amount every hour. 'Peak hours' are the few hours a day when footfall/traffic is high enough that advertisers pay a premium — commute time, evening rush. 'Off-peak' is every other operating hour, priced much lower. We add up what a fully-sold day would earn: a few expensive hours plus many cheap ones, not one flat average rate spread across the whole day."
          />
          <Row
            term="Peak / off-peak hours &amp; ₹/hr"
            meaning="These are editable per tier because a landmark screen has both more premium hours and a higher price per hour than a neighborhood screen. Defaults are planning assumptions (Tier A ≈ ₹2,000/hr peak, Tier D ≈ ₹125/hr) — change them to test what happens if real Hyderabad pricing comes in higher or lower."
          />
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Step 3 — How much of that potential actually sells</h3>
        <div className="mt-2">
          <Row
            term="Monthly GMV per screen"
            formula="Daily rate per screen × Sellable days/month × Inventory exposed % × Fill rate %"
            meaning="A screen isn't sellable every calendar day (some days are lost to election-period ad restrictions or other blackout — Sellable days/month), the owner doesn't always let the platform sell all of it (Inventory exposed %, an owner-trust/contract variable), and even the slots that are offered don't all find a buyer (Fill rate %, a demand-side variable set per tier because premium screens sell out faster than long-tail ones in a young marketplace). GMV — Gross Merchandise Value — is the total money advertisers pay across all sold slots, before the platform takes its cut."
          />
          <Row
            term="Monthly GMV (network)"
            formula="Sum across all 4 tiers of (Eligible &amp; live screens in tier × Monthly GMV per screen in tier)"
            meaning="Add up every tier's contribution. This total is what the doc calls 'Marketplace GMV' — the entire transaction volume flowing through the auction system in a month."
          />
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Step 4 — What the platform actually keeps</h3>
        <div className="mt-2">
          <Row
            term="Net effective take rate"
            formula="Platform take rate % − Owner-negotiated discount (pp)"
            meaning="The 'take rate' is the platform's nominal commission (e.g. 3% of every cleared auction). But owners with leverage — premium Tier A/B screens — will often negotiate a better split for themselves, effectively lowering what the platform keeps. This discount is in percentage points (pp), subtracted directly from the take rate, not a percent-of-percent."
          />
          <Row
            term="Monthly platform revenue"
            formula="Monthly GMV × Net effective take rate % × (1 − Bad debt %)"
            meaning="Revenue is GMV times the commission rate — but not all of that commission is ever collected. Advertisers and agencies often pay late or default (Bad debt %), so we shave that off before calling it real revenue."
          />
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Step 5 — What it costs to run</h3>
        <div className="mt-2">
          <Row
            term="Monthly CAC spend"
            formula="(New owners/month × Owner CAC) + (New advertisers/month × Advertiser CAC)"
            meaning="Growing the network isn't free. Every new billboard owner and every new advertiser you sign up costs money to find and close (sales, onboarding, incentives) — CAC means Customer Acquisition Cost. This is spend, not revenue — it scales with how fast you're trying to grow, not with how big you already are."
          />
          <Row
            term="Monthly hardware amortization"
            formula="(Connected screens × Hardware cost/screen) ÷ Amortization months"
            meaning="If a screen needs new hardware or integration work to connect to the platform, that's a one-time cost — but for a monthly P&L view we spread it evenly across an amortization period (e.g. 24 months) so it shows up as a steady monthly drag instead of one giant spike."
          />
          <Row
            term="Total monthly cost"
            formula="Operating cost + CAC spend + Hardware amortization"
            meaning="Operating cost is the running cost of the business itself (team, infra, sales) — everything else is the extra cost of growing and connecting new supply/demand."
          />
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Step 6 — Is it viable</h3>
        <div className="mt-2">
          <Row
            term="Monthly contribution"
            formula="Monthly platform revenue − Total monthly cost"
            meaning="The bottom line. Positive means the marketplace, at these assumptions, more than pays for itself every month. Negative means it's burning cash and needs more scale, better fill, or lower cost to close the gap."
          />
          <Row
            term="Breakeven monthly GMV required"
            formula="Total monthly cost ÷ (Net effective take rate % × (1 − Bad debt %))"
            meaning="Rearranges the revenue formula to ask: how much transaction volume would need to flow through the platform every month just to cover costs, at the current take rate and collection rate? Compare this to your simulated Monthly GMV — if GMV is well below this number, the scenario isn't viable yet."
          />
        </div>
      </div>

      <p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
        What this deliberately leaves out: weekday-vs-weekend demand splits, advertiser budget
        seasonality by industry, incumbent operators already locking up premium sites under
        long-term contracts, and any hard ceiling on how many digital screens actually exist in
        Hyderabad. These are real risks (several are called out explicitly in the underlying
        Hyderabad Financial Viability &amp; Saturation Case), but there's no reliable Hyderabad-specific
        data to turn them into formulas without guessing — so they're flagged here rather than
        baked into a number that would look more precise than it is.
      </p>
    </section>
  );
}
