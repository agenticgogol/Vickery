# AGENTS.md

## Mission

Build a fast, polished V0 demo of a programmatic digital billboard marketplace.

The V0 must prove one end-to-end loop:

**Billboard owner releases inventory → advertisers bid → auction clears → winner gets slot → creative is scheduled → owner/platform economics are visible.**

Do not overengineer. Optimize for demo quality, speed, and correctness.

---

## Product Scope

### 1. Billboard Owner Portal

Owner can:

- View owned billboards
- Select a billboard
- Create an available time slot
- Set:
  - date
  - start time
  - end time
  - reserve/minimum acceptable price
- Mark a slot available/unavailable
- View status: Available / Auction Open / Sold / Unsold

### 2. Billboard Inventory

Each billboard should have preloaded metadata:

- billboard_id
- name
- latitude
- longitude
- city
- area
- screen type
- screen dimensions
- estimated daily traffic
- audience profile
- quality tier
- owner_id

Use seeded/demo data. No need for external data integrations in V0.

### 3. Advertiser Portal

Advertiser can:

- Browse available billboard slots
- See:
  - billboard location
  - map/location context
  - audience profile
  - estimated traffic
  - available time
  - reserve price
- Select a slot
- Enter bid amount
- Select/upload a demo creative
- Submit bid
- View bid status
- Create a campaign using either:
  - **Manual bids:** select one or more slots and explicitly set each bid.
  - **Auto-bid:** set a total campaign budget, a maximum bid per slot, and at least one audience, area, timing, or quality preference. The system ranks open matching slots using the deterministic Campaign Fit Score and places a one-time minimum valid bid on the highest-ranked slots that fit both caps.

Auto-bid requirements:

- Must be deterministic and explainable.
- Must never exceed the total campaign maximum commitment or maximum bid per slot.
- Must bid only on open/closing eligible inventory.
- Must use the minimum valid bid: `max(reserve, current highest eligible bid + minimum increment)`.
- Must not dynamically re-bid, pace spend over time, use an LLM, or change clearing logic.

### 4. Auction Engine

Implement a deterministic auction.

Rules:

- Only bids >= reserve price are eligible
- Highest eligible bidder wins
- Winner pays the higher of:
  - second-highest eligible bid
  - reserve price
- If only one eligible bid exists, winner pays reserve price
- If no eligible bid exists, slot remains unsold
- Tie-breaking must be deterministic; earliest submitted bid wins

Store:

- winning advertiser
- winning bid
- clearing price
- second-highest bid
- auction status
- close time

Do not use an LLM for auction logic.

### 5. Allocation / Economics

After auction closes, show:

- winning advertiser
- winning bid
- clearing price
- billboard owner payout
- platform fee
- scheduled creative
- slot time

Use a configurable platform fee, default 3%.

For V0:
**Owner payout = clearing price - platform fee**

### 6. Demo Playback

Create a simple virtual billboard/player.

It should show:

- billboard name
- current/selected time slot
- winning advertiser
- creative
- scheduled start/end time

The goal is visual proof that:
**Auction outcome → scheduled advertisement**

No real billboard hardware integration is needed.

### 7. Dashboard

Create a simple management dashboard with:

- total available slots
- auctions open
- slots sold
- slots unsold
- total bids
- GMV
- platform revenue
- owner payout
- average clearing price
- fill rate

Keep it visually polished and demo-friendly.

---

### 8. BX Guide (Conversational Assistant)

BX Guide is a chat assistant available to Owner and Advertiser roles (not Admin). It may:

- Parse a free-text request into a structured intent (release a slot, place a bid) using an LLM when `OPENAI_API_KEY` is set, with a deterministic regex fallback when it is not.
- Resolve that intent against real inventory/advertiser/creative data and show the user an explicit confirmation card (billboard, date/time, price, advertiser, creative) before anything happens.
- On confirmation, call the same server actions the manual forms use (`createSlot`, `submitBid`) — never a separate write path. Those actions keep their existing validation (reserve price, overlap checks, bid eligibility, minimum increment) unchanged.

BX Guide must never:

- Compute or influence auction clearing, winner selection, or clearing price. That stays inside `runAuction` (`src/lib/auction.ts`), pure and deterministic, untouched by the assistant.
- Close an auction, change a settlement status, or acknowledge playback. Those remain explicit manual actions in their own screens.
- Execute a write without the user seeing and confirming the resolved parameters first.
- Invent a billboard, advertiser, date, or price that the user didn't state — an ambiguous or incomplete request gets a clarifying reply, not a guess.

This reconciles with the "Do not use an LLM for auction logic" rule above: the LLM only fills a form; the deterministic auction/bid validation code decides what's actually valid, same as if a human had typed it into the form.

---

## Explicitly Out of Scope for V0

Do NOT build:

- real payment processing
- real billboard/device integration
- Kubernetes
- Kafka
- advanced ML
- dynamic pricing
- ongoing advertiser budget pacing or autonomous re-bidding after the one-time auto-bid plan
- forecasting
- attribution
- incrementality
- complex audience measurement
- multi-city architecture
- real-time millisecond ad auctions
- advanced role/permission systems
- blockchain
- complex AI agents
- production-grade billing
- production-grade tax logic

If a feature does not help prove the core V0 marketplace loop, defer it.

---

## Preferred Tech Stack

Use the simplest stack that can be shipped quickly.

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui if useful

### Backend

Preferred:

- Next.js server actions / API routes for maximum speed

Alternative only if clearly justified:

- FastAPI + Python

### Database

Preferred:

- Supabase Postgres

For very fast local prototyping, SQLite is acceptable initially if migration is straightforward.

### Auth

For V0:

- Seeded/demo users are acceptable
- Simple owner / advertiser role switching is sufficient
- Do not spend significant time on authentication

### Maps

- Mapbox if easy to configure
- Otherwise use a simple static/location card and defer map integration

### Storage

- Local/public seeded demo creatives initially
- Supabase Storage only if upload is easy

---

## Suggested Data Model

### users

- id
- name
- role: owner | advertiser | admin

### billboards

- id
- owner_id
- name
- city
- area
- latitude
- longitude
- screen_type
- dimensions
- estimated_daily_traffic
- audience_profile
- quality_tier

### slots

- id
- billboard_id
- date
- start_time
- end_time
- reserve_price
- status
- auction_close_time

### advertisers

- id
- name

### creatives

- id
- advertiser_id
- name
- image_url

### bids

- id
- slot_id
- advertiser_id
- amount
- creative_id
- created_at

### campaigns

- id
- advertiser_id
- name
- total_budget
- max_bid_per_slot (auto-bid only)
- buying_mode: manual | auto
- preferred areas, times, audience tags, quality tier
- creative_id
- selected_slot_ids
- status
- created_at

### auction_results

- id
- slot_id
- winner_advertiser_id
- winning_bid
- second_highest_bid
- clearing_price
- platform_fee
- owner_payout
- creative_id
- status

---

## Seed Demo Data

Create a compelling seeded Hyderabad dataset.

Suggested billboards:

- HITEC City
- Gachibowli
- Financial District
- Madhapur
- Jubilee Hills
- Banjara Hills

Create 8–12 billboards.

Create 3 demo advertisers, for example:

- MegaMart
- QuickFood
- Nova Mobile

Create multiple available slots.

Create at least one scripted auction example:

Reserve price: ₹10,000

Bids:

- Advertiser A: ₹12,000
- Advertiser B: ₹18,000
- Advertiser C: ₹15,000

Expected result:

- Winner: Advertiser B
- Clearing price: ₹15,000
- Platform fee @3%: ₹450
- Owner payout: ₹14,550

This scenario must work perfectly in the demo.

---

## Core User Flows

### Owner Flow

1. Enter owner portal
2. Select billboard
3. Add available slot
4. Set reserve price
5. Publish slot
6. View bids / auction result
7. See payout

### Advertiser Flow

1. Enter advertiser portal
2. Browse available inventory
3. Inspect billboard/audience data
4. Select slot
5. Choose Manual bids or Auto-bid
6. Select creative and submit manual bids, or set a total budget and maximum bid per slot for Auto-bid
7. For Auto-bid, inspect transparent ranked matches and the caps before submitting the one-time bid plan
8. View auction outcome

### Admin / Demo Flow

1. View open auction
2. Trigger or close auction
3. Show winner
4. Show second-price calculation
5. Show scheduled creative
6. Open virtual billboard
7. Show dashboard economics

---

## UX Expectations

The product should feel like a credible ad-tech marketplace, not a CRUD admin panel.

Priorities:

- clean modern UI
- strong hierarchy
- compact tables/cards
- obvious status badges
- clear rupee formatting
- visual auction outcome
- map/location context where practical
- polished seeded demo

Important screens:

1. Landing / role selector
2. Owner inventory dashboard
3. Create slot
4. Advertiser inventory marketplace
5. Slot detail + bid
6. Auction result
7. Virtual billboard playback
8. Management dashboard

---

## Engineering Principles

1. Ship working software first.
2. Avoid architecture for hypothetical future scale.
3. Keep auction logic deterministic and testable.
4. Seed realistic demo data.
5. Prefer simple implementations over abstractions.
6. Make the happy-path demo flawless.
7. Keep components reusable where natural, but do not build frameworks.
8. Add tests for the auction engine before polishing secondary features.
9. Do not introduce dependencies unless they materially accelerate delivery.
10. When uncertain, choose the smallest implementation that satisfies V0.

---

## Required Tests

At minimum test:

### Auction

- three valid bids
- one valid bid
- no bid above reserve
- tied highest bids
- second-highest below reserve
- no bids

### Economics

- platform fee calculation
- owner payout calculation

### Slot

- sold slot cannot accept new bids
- unavailable slot cannot accept bids

### Campaign Auto-bid

- ranks matching open slots deterministically by Campaign Fit Score
- never exceeds total budget maximum commitment or per-slot maximum bid
- uses the current minimum valid bid
- excludes scheduled, closed, unavailable, and over-cap slots
- has a deterministic tie-break for equally scored slots

---

## Definition of Done

V0 is done when the following can be demonstrated end-to-end:

1. Billboard owner lists a Hyderabad billboard slot for **7–8 PM**
2. Owner sets reserve price **₹10,000**
3. Three advertisers see the slot and bid:
   - ₹12,000
   - ₹18,000
   - ₹15,000
4. Auction closes
5. ₹18,000 bidder wins
6. Clearing price is **₹15,000**
7. Platform revenue @3% = **₹450**
8. Owner payout = **₹14,550**
9. Winning creative is scheduled
10. Virtual billboard displays the winning creative
11. Dashboard updates GMV, revenue, payout, and fill

If this flow works smoothly and looks polished, stop.

That is V0.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
