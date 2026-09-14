## 1. Architecture

Greenfield Next.js App Router application:

- Next.js + TypeScript + Tailwind CSS.
- Supabase Postgres as the persisted database; use SQLite only if local demo setup becomes materially faster.
- Server Components for dashboards and read-heavy pages.
- Client Components for forms, role switching, bidding, auction closing, and playback controls.
- Next.js Server Actions for mutations.
- Local/public seeded creative images; no upload storage required for the first demo.
- Static location cards instead of Mapbox unless configuration is trivial.
- Seeded demo role switching: owner, advertiser, admin.

Core flow:

`Owner slot creation → advertiser bids → auction close → auction result → scheduled creative → virtual billboard → dashboard metrics`

## 2. Data model

Use the tables specified in `AGENTS.md`:

- `users`: id, name, role.
- `billboards`: id, owner_id, name, city, area, latitude, longitude, screen_type, dimensions, estimated_daily_traffic, audience_profile, quality_tier.
- `slots`: id, billboard_id, date, start_time, end_time, reserve_price, status, auction_close_time.
- `advertisers`: id, name.
- `creatives`: id, advertiser_id, name, image_url.
- `bids`: id, slot_id, advertiser_id, amount, creative_id, created_at.
- `auction_results`: id, slot_id, winner_advertiser_id, winning_bid, second_highest_bid, clearing_price, platform_fee, owner_payout, creative_id, status.

Implementation constraints:

- Foreign keys between related records.
- Slot status values: `available`, `auction_open`, `sold`, `unsold`.
- Monetary values stored as integer rupees.
- Platform fee configured as `3%` in application configuration.
- Unique auction result per slot.
- Bid creation rejected for unavailable or sold slots.

## 3. Pages/routes

- `/`: landing page and owner / advertiser / admin role selector.
- `/owner`: owner inventory dashboard, billboard list, slot statuses, payouts.
- `/owner/billboards/[id]`: billboard metadata and slot management.
- `/owner/billboards/[id]/slots/new`: create and publish a slot.
- `/advertiser`: available inventory marketplace with filters/cards.
- `/advertiser/slots/[id]`: slot detail, location context, audience data, bid form, creative selection.
- `/advertiser/bids`: advertiser bid history and statuses.
- `/admin`: management dashboard with auction and economics metrics.
- `/admin/auctions/[slotId]`: bids, eligibility, second-price calculation, and close-auction action.
- `/playback/[slotId]`: virtual billboard showing the winning scheduled creative.

Use shared components for status badges, rupee formatting, billboard cards, auction summary, metric cards, and timeline/status indicators.

## 4. Backend/server actions

Keep all mutations in a small server-side domain layer:

- `createSlot(input)`: validates date/time/reserve price and creates an available slot.
- `setSlotAvailability(slotId, available)`: toggles availability only before sale.
- `listAvailableSlots()`: returns slots with billboard metadata.
- `getSlotDetails(slotId)`: returns slot, billboard, bids, creatives, and result.
- `submitBid(input)`: validates advertiser, creative ownership, amount, slot status, and reserve-related rules.
- `closeAuction(slotId)`: runs the deterministic auction in a database transaction and persists the result.
- `getAuctionResult(slotId)`: returns winner, clearing price, fees, payout, and creative.
- `getDashboardMetrics()`: derives counts and economics from slots, bids, and auction results.
- `getPlaybackData(slotId)`: returns only sold/scheduled slot data for playback.

Server actions should call `revalidatePath()` for affected owner, advertiser, admin, and playback pages.

## 5. Auction engine design

Implement a pure function independent of Next.js or the database:

```ts
runAuction({
  reservePrice,
  bids,
  platformFeeRate: 0.03,
})
```

Algorithm:

1. Reject or ignore bids that are not associated with the slot.
2. Select bids with `amount >= reservePrice`.
3. Sort eligible bids by:
   - amount descending;
   - `created_at` ascending;
   - stable bid id ascending as the final tie-breaker.
4. If there are no eligible bids, return `unsold`.
5. Select the first bid as winner.
6. Set `secondHighestBid` to the second eligible bid amount, if present.
7. Set `clearingPrice = max(secondHighestBid, reservePrice)`, or reserve price when only one eligible bid exists.
8. Calculate:
   - `platformFee = round(clearingPrice * 0.03)`
   - `ownerPayout = clearingPrice - platformFee`
9. Persist the winner, winning bid, second-highest bid, clearing price, fee, payout, creative, close time, and sold status.

`closeAuction` must be idempotent and must reject already-sold or already-finalized slots.

## 6. Seed data plan

Seed 8–12 Hyderabad billboards across:

- HITEC City
- Gachibowli
- Financial District
- Madhapur
- Jubilee Hills
- Banjara Hills

Each billboard should include realistic traffic, audience, quality tier, dimensions, coordinates, and owner association.

Seed:

- One demo owner.
- Three advertisers: MegaMart, QuickFood, Nova Mobile.
- At least one creative per advertiser.
- Multiple slots in available, auction-open, sold, and unsold states.
- The scripted happy-path slot:
  - 7–8 PM.
  - Reserve: ₹10,000.
  - MegaMart: ₹12,000.
  - QuickFood: ₹18,000.
  - Nova Mobile: ₹15,000.
  - Winner: QuickFood.
  - Clearing price: ₹15,000.
  - Platform fee: ₹450.
  - Owner payout: ₹14,550.

Make the scripted slot immediately discoverable from the advertiser marketplace and admin auction page.

## 7. Test plan

Use unit tests for the pure auction engine:

- Three valid bids.
- One valid bid.
- No bid above reserve.
- Tied highest bids with earliest submission winning.
- Second-highest bid below reserve.
- No bids.
- Exact scripted ₹12,000 / ₹18,000 / ₹15,000 scenario.
- Platform fee calculation.
- Owner payout calculation.

Use server-action/integration tests for slot rules:

- Sold slot rejects new bids.
- Unavailable slot rejects new bids.
- Bid below reserve is retained but ineligible, or rejected consistently according to the chosen UI behavior.
- Creative must belong to the bidding advertiser.
- Closing an auction twice is safe and does not alter the result.

Add one end-to-end smoke test covering:

`create/list slot → submit three bids → close auction → verify result → verify playback → verify dashboard economics`.

## 8. Build order

1. Bootstrap the Next.js, TypeScript, and Tailwind app.
2. Create database schema, seed script, and demo role switching.
3. Implement and test the pure auction engine first.
4. Add slot creation, availability, and owner dashboard.
5. Add advertiser marketplace, slot detail, creatives, and bidding.
6. Add auction close action and result presentation.
7. Add owner payout and admin economics dashboard.
8. Add virtual billboard playback linked to the auction result.
9. Polish the happy path: rupee formatting, status badges, responsive layout, empty states, loading states, and seeded scripted auction visibility.
10. Run the end-to-end smoke test and stop once the Definition of Done flow is reliable.
