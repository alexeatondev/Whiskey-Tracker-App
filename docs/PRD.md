# Whiskey Tracker — Product Requirements Document

| | |
| --- | --- |
| Owner | Dev (Alex Eaton) |
| Status | Draft v1 — November 2026 |
| Related | [Personas](personas.md) · [Competitive analysis](competitive-analysis.md) · [Roadmap](roadmap.md) · [Decisions](decisions.md) · [Brand strategy](brand-strategy.md) · [Launch checklist](launch-checklist.md) · [Backlog](backlog.md) |
| Product name | **Second Pour** (decided; trademark clearance in progress, see [decisions.md](decisions.md)). The repo and current UI still say "Whiskey Tracker" until the rebrand |

## 1. Summary

Whiskey Tracker is a personal whiskey journal that works on any device. You photograph a bottle, the app reads the label and fills in the details, you rate it and add your own notes, and over time the app learns your palate well enough to tell you whether you'll like the next bottle you're holding in the store.

The first version (v0.1, live today) proves the core loop: photo → AI label read → edit → half-star rating → searchable collection, all stored locally and installable as an app on iPhone, iPad and Windows.

This PRD defines what it takes to grow that into a product: first a great tool for Dev, then a public app.

## 2. Problem

Whiskey drinkers try far more bottles than they can remember. The common failure modes:

- **"I had something great at that bar… what was it?"** Pours at bars, tastings and friends' houses are forgotten within days.
- **"Do I already own this?" / "Did I like this?"** Standing in a store, people can't recall what's at home or how they rated a similar bottle. Bourbon hunters regularly buy duplicates.
- **"Will I like this $90 bottle?"** Community ratings average out everyone's taste. They don't say whether *you* will like it.
- **Existing apps make logging a chore.** Barcode scanners miss store picks, single barrels and imports. Manual entry is tedious, so people stop logging.
- **Collections outgrow apps.** Users hit bottle caps (Whiskey Shelf limits free users to 99), ads in the middle of adding a bottle (WhiskeyMate), and lost data after updates (Drammer).

## 3. Goals and non-goals

### Goals (next 6 months)

1. **Logging takes under 30 seconds** from opening the app to a saved, rated entry, with no typing needed for most labels.
2. **One record per whiskey, many experiences.** Track every tasting (date, where, how served, rating) under the same bottle, plus ownership (sealed, open, finished; fill level; price paid).
3. **A personal palate profile** built from the user's own ratings and flavor tags, used to answer "will I like this?"
4. **Your data is safe and portable**: works offline, syncs across devices, exports to open formats, never lost on update.
5. **Ready for a public launch**: no user-supplied API keys, accounts and sync, age gate, privacy policy, sustainable unit economics.

### Non-goals (for now)

- Selling alcohol, marketplace or auction features (legal complexity; BAXUS, Unicorn Auctions and others own this).
- A social network or public feed. Sharing is opt-in and card-based (export an image or a link), not a timeline.
- Bar and restaurant inventory management (B2B).
- Spirits other than whiskey. The data model should not block rum, tequila, etc. later, but the UX is whiskey-first.

## 4. Target users

Full research-backed personas are in [personas.md](personas.md). In short:

| Persona | Core job | Priority |
| --- | --- | --- |
| **Marcus — the Home Collector / Bourbon Hunter** | Know what's on my shelf, what I paid, what it's worth, and never buy a dupe | Primary |
| **Priya — the Curious Explorer** | Remember what I tried and liked, learn what I like and why | Primary |
| **Dana — the Palate Builder** | Structured tasting notes, compare bottles, host tastings | Secondary |
| **Tom — the Whiskey Traveler** | Log distillery visits and bar pours on the road | Secondary |
| **Jess — the Gift Buyer** | Find out what my partner already has and would like | Tertiary |

Dev is user zero. Early decisions favor what he will use daily; the personas keep the design from becoming too personal to launch.

## 5. Product principles

1. **The photo is the input.** Every feature should start from "I'm holding a bottle or a glass." Typing is the fallback, not the flow.
2. **Your palate, not the crowd's.** Community data is context; the user's own history is the product.
3. **Local-first and honest.** The app works offline, never holds data hostage, and labels AI-inferred fields as such. The label is the source of truth; model knowledge fills gaps and is marked as "typical" rather than fact.
4. **No paywall on the core loop.** Capture, rate, collection and export stay free. The top complaint about competitors is subscriptions that gate basics.
5. **Fast enough to use at a bar.** One hand, low light, bad signal.

## 6. Scope and requirements

Priority: **P0** = needed for the next release, **P1** = needed before public launch, **P2** = later.

### 6.1 Capture and identification

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| C1 | Take a photo or choose from library; read label with Claude; prefill all fields | P0 | ✅ Shipped |
| C2 | Show identification confidence; highlight low-confidence fields for review | P0 | Partial (overall confidence only) |
| C3 | **Duplicate detection**: after identification, if a matching whiskey already exists, offer "add a tasting to it" instead of creating a duplicate | P0 | M1 |
| C4 | Suggest flavor tags from the model's typical tasting notes | P0 | M1 |
| C5 | Multiple photos per bottle (front, back label, store-pick sticker) | P1 | |
| C6 | Barcode scan as a fast path, with label photo as fallback. Seed UPC lookup with open data (e.g. Iowa ABD product list, CC BY 4.0) | P2 | |
| C7 | Menu / shelf scan: photograph a bar menu or store shelf and highlight what you've rated or would likely enjoy | P2 | |
| C8 | Works without an API key (manual entry), and degrades clearly offline | P0 | ✅ Shipped |

### 6.2 Collection model

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| M1 | Each whiskey has a **status**: *Tasted*, *On my shelf*, or *Wishlist* | P0 | M1 |
| M2 | Shelf details: bottle state (sealed/open/finished), fill level, price paid, purchase date, store, bottle count | P0 | M1 |
| M3 | **Tasting log**: many dated tastings per whiskey with rating, serve (neat, rocks, water, cocktail), location and notes | P0 | M1 |
| M4 | Overall rating stays user-controlled; tasting ratings shown as history | P0 | M1 |
| M5 | Flavor tags from a fixed whiskey flavor vocabulary (sweet, fruit, spice, wood, smoke, grain…) | P0 | M1 |
| M6 | Filter by status, style, flavor, rating; sort by recent, rating, name, distillery, price | P0 | M1 |
| M7 | Store picks / single barrels: barrel number, pick group, warehouse, barrel proof | P1 | |
| M8 | Infinity bottle support (a "bottle" composed of pours from others) | P2 | |

### 6.3 Insights and palate

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| P1 | Insights page: counts by status and style, average rating by style, top flavors in highly rated whiskeys, top distilleries, shelf spend | P0 | M1 |
| P2 | Palate profile: a flavor radar built from tags weighted by rating | P1 | |
| P3 | **"Will I like it?"**: scan a bottle not in the collection and get a predicted rating with a one-line reason, based on the user's history | P1 | |
| P4 | **Pour picker**: pick tonight's pour from open bottles, filtered by mood or flavor | P1 | |
| P5 | Side-by-side compare of two to four whiskeys; tasting-flight mode for hosting | P2 | |
| P6 | Value estimate for the shelf (MSRP vs paid vs current market) | P2 | |

### 6.3a Sharing

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| S1 | **Share cards**: generate an image of one whiskey (photo, name, rating, top flavors) or a tasting-night lineup, and send it via the device share sheet. No account needed | P1 | M2 |
| S2 | Read-only wishlist link for gift buyers | P2 | M3/M4 (needs sync) |
| S3 | Shared tasting sessions: host invites guests by link/QR, everyone rates the same pours, optional blind reveal | P2 | M5 |

### 6.4 Data, sync and accounts

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| D1 | Local storage in IndexedDB; works offline | P0 | ✅ Shipped |
| D2 | Full JSON backup and merge import | P0 | ✅ Shipped |
| D3 | CSV export (spreadsheet-friendly) | P0 | M1 |
| D4 | Schema versioning with forward migrations; never drop unknown fields | P0 | M1 |
| D5 | Accounts and automatic multi-device sync (local-first, server as replica) | P1 | |
| D6 | Server-side AI proxy so users don't need their own API key; per-user quotas | P1 | |
| D7 | Import from Distiller, OnlyDrams, Whiskybase CSV exports | P2 | |

### 6.5 Platform and compliance

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| X1 | Installable PWA on iOS, iPadOS, Android, Windows, macOS | P0 | ✅ Shipped |
| X2 | Age gate (21+ in the US) and responsible-drinking copy before public launch | P1 | |
| X3 | Privacy policy, terms, data deletion | P1 | |
| X4 | App Store and Google Play listings via a native wrapper (Capacitor) | P1 | |
| X5 | WCAG 2.1 AA: contrast, keyboard rating input (✅), screen-reader labels | P1 | Partial |
| X6 | **AI consent**: explicit opt-in before the first photo is sent to the AI; revocable in Settings; manual entry works without it (Apple 5.1.2(i)) | P1 | |
| X7 | "Report this result" on AI-generated output (Google Play AI-Generated Content policy) | P1 | |
| X8 | Read store age signals (Apple Declared Age Range, Play Age Signals) and block under-18 users, in addition to the 21+ gate | P1 | |
| X9 | In-app account and data deletion plus a web deletion page | P1 | |
| X10 | Paywall disclosures and Restore Purchases (Apple 3.1.2) | P1 | |

Full go-live requirements: [launch-checklist.md](launch-checklist.md).

### 6.6 Monetization (decided, see [decisions.md › D-001](decisions.md))

| ID | Requirement | Priority |
| --- | --- | --- |
| $1 | Free tier: unlimited collection, ratings, tasting log, insights, export, sync; 15 AI label reads per month | P1 |
| $2 | Pro: $3.99/mo or $29.99/yr (7-day trial on annual); unlimited label reads (fair use), palate predictions, pour picker, multi-photo, value tracking | P1 |
| $3 | Lifetime: $79.99; "Founding Pour" launch offer at $49.99 for the first 1,000 buyers | P1 |
| $4 | No ads, ever. No paywall on capture, rating or export | P0 (principle) |
| $5 | Paywall moments are contextual (after the monthly read limit, on a palate-prediction preview), never at app open | P1 |

## 7. Key user flows

**Log a new bottle (P0).** Tap Add → take photo → spinner "Reading the label…" → form prefilled, suggested flavor tags highlighted → pick status (defaults to *Tasted*) → tap stars → Save. If a match is found: banner "You rated this 4.0 on Mar 3 — Add a tasting instead?"

**Add a tasting to an existing whiskey (P0).** Open whiskey → "Log a tasting" → rating, serve, where, notes → Save. The whiskey's "last tasted" date updates.

**At the store (P1).** Scan → if owned: "On your shelf, ~40% left." If tasted: "You gave it 3.5." If new: "Predicted 4.0 for you: you rate high-rye, cinnamon-forward bourbons well."

## 8. Success metrics

For the personal phase, success is qualitative: Dev logs every new pour and stops using notes apps for whiskey.

For the public beta:

| Metric | Target |
| --- | --- |
| Time from Add to Saved (median) | < 30 s |
| Label identification accepted without edits to name/distillery | ≥ 85% |
| Week-4 retention (logged ≥ 1 whiskey in week 4) | ≥ 30% |
| Whiskeys logged per active user per month | ≥ 4 |
| AI cost per active user per month | < $0.25 |
| Crash-free sessions / data-loss reports | ≥ 99.5% / zero |

## 9. Technical approach

**Now (personal):** keep the zero-build PWA (plain HTML/CSS/JS modules, IndexedDB, service worker, GitHub Pages). Claude is called from the browser with the user's own key. This is simple, free to host and fast to iterate.

**Public (P1):** keep the PWA as the single front end and add:

- A small backend (Supabase or Cloudflare Workers + D1/R2) for auth, sync and photo storage.
- A server-side Claude proxy holding the API key, with per-user rate limits and response caching keyed by normalized product name, so the same bottle isn't identified twice across users.
- Capacitor to wrap the PWA for the App Store and Play Store, with native camera and barcode plugins.

The platform recommendation and alternatives are covered in [roadmap.md](roadmap.md#platform-decision).

**Data model v2 (M1)** — one record per whiskey:

```
{ id, createdAt, updatedAt, schema: 2,
  // identity (from label/model)
  name, distillery, type, country, region, age, abv, proof, caskFinish, mashBill, edition,
  description, nose, palate, finish, approxPrice,
  // personal
  status: 'tasted' | 'shelf' | 'wishlist',
  rating,                // overall 0–5 in 0.5 steps
  flavors: [tag],        // from FLAVOR_TAGS
  myNotes,
  bottle: { state: 'sealed'|'open'|'finished', fill: 0–100, count, pricePaid, purchasedAt, store },
  tastings: [{ id, date, rating, serve, location, notes }],
  image, thumb }
```

## 10. Risks and open questions

| Risk | Mitigation |
| --- | --- |
| AI misidentifies limited releases or store picks | Label text wins over model knowledge; confidence shown; edit is one tap; multiple photos (C5) |
| AI cost at scale | Cache by product; smaller model for simple labels; free tier quota; Pro tier for heavy users |
| App Store review for alcohol apps | 17+ rating, age gate, no sales, responsible-drinking copy (same as Distiller) |
| iOS evicts PWA storage | `navigator.storage.persist()` (done); sync in P1 removes the risk |
| Whiskey category softening (US whiskey sales −0.9% in 2025; Gen Z preference low) | Target engaged enthusiasts, who keep buying, and newcomers who need guidance; keep the model open to other spirits |

**Decisions** (tracked in [decisions.md](decisions.md); open to-dos in [backlog.md](backlog.md))

1. Pricing → D-001 decided: free core + Pro ($3.99/mo, $29.99/yr) + lifetime ($79.99).
2. Name → D-002 decided: **Second Pour**, pending trademark and domain clearance.
3. Sharing → D-003 decided: share cards in M2; live group tasting sessions after sync.
