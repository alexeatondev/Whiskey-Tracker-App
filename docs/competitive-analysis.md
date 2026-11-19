# Whiskey Tracker — Competitive Analysis

Reviewed November 2026 from app-store listings, review aggregators and publisher pages. Ratings and prices change often; treat figures as approximate.

## Landscape at a glance

| App | Focus | Identification | Strengths | Weaknesses users report | Model |
| --- | --- | --- | --- | --- | --- |
| **Distiller** | Reviews + discovery | Barcode | ~60–65k spirits, expert reviews kept separate from community ratings, flavor graphs, TruePrice values, "Pick For Me" | Pro subscription seen as expensive; server/connection errors when scanning | Free + Pro (~$5.99/mo, ~$49/yr) |
| **Whiskybase** | Database + collectors (EU-centric) | Barcode + label | Largest bottle database, auction-based market values (Plus), wishlists | Crashes when adding bottles or viewing collection | Free + Plus |
| **OnlyDrams** | Collection management | Barcode | 4.9★ on ~7k ratings; fill levels, custom fields, pour picker, infinity bottles, bottle drops | Pour picker only cycles a few bottles; Scotch not grouped by region | Free + supporter tiers |
| **BoozApp by BAXUS** | Pricing | Barcode | MSRP vs Market vs "Fair Price", home-bar value | Pricing tool more than a journal | Free; marketplace upsell |
| **Whiskey Shelf** | Inventory | Manual / search | Infinity bottle, valuations incl. open bottles, random bottle | Free tier capped at 99 bottles | Freemium |
| **Drammer** | Collection + social | Barcode | Purchase price/date/store fields | "App updated and I lost my entire collection"; hard to find brands | Free |
| **WhiskeyMate** | Collection | Database (300k entries) | PDF export | Ads while adding a bottle; asks for partner sharing | Ads + Premium |
| **New AI-scan apps** (Whiskey Rater, Whiskey Label Scanner Journal, BRBNFNDR, Bunker, DramKeep, BarrelBook) | Photo → details | AI label reading (on-device Vision or LLM) | Proves label scanning is now table stakes; some add mood-based "Pour Tonight", cost-per-dram, store-pick fields | Small catalogs/communities; most are iOS-only | Mostly freemium |

**Also launched 2025–26** (same space, small user bases so far): Pour Picks (taste quiz + recommendations, freemium), Neat Notes (palate trends), CaskNotes ($0.99, local-first, flight planner), Dramfly (festival logging, radar palate chart), MyDrams (AI sommelier flights, share cards), Bourbon Bro ($9.99/mo · $99.99/yr, secondary pricing). The idea of "learn my palate" is spreading, so execution and cross-platform reach matter more than the idea itself.

**Pricing benchmarks:** Distiller Pro ~$49/yr, Untappd Insider $54.99/yr, Vivino Premium ~$48/yr, CellarTracker $40+/yr, Bourbon Bro $99.99/yr, BarrelBook $7.99 one-time. Full analysis in [decisions.md › D-001](decisions.md).

**Adjacent benchmark — Vivino (wine):** ~70M users, 16M wines. Its label recognition is widely rated the best in wine, and its moat is what happens after the scan: a personal Taste Profile, a "match for you" score, restaurant wine-list scanning and an integrated marketplace. Recent reviews cite paywalling and instability.

## What we learn

### 1. Scanning is no longer a differentiator; accuracy and what happens next are

Every 2025–26 entrant advertises AI label scanning. Barcode-first apps still miss store picks, single barrels and imports, which is exactly where enthusiasts care most. Our advantage is reading the *whole* label (barrel number, proof, pick info) with an LLM. To make it count:

- Treat label text as truth and mark model-inferred fields (tasting notes, price) as "typical".
- Fall back gracefully: low confidence → ask one clarifying question rather than guess (matches the original project brief: "or ask for more detail").
- Add barcode later as a fast path, not a replacement.

### 2. The moat is the personal palate (Vivino's lesson)

Vivino's "match for you" is the feature people keep paying attention to. No whiskey app does this well; Abov advertises a palate feature but has a small footprint. With an LLM plus the user's own ratings and flavor tags, we can predict "you'll probably rate this 4.0, because you rate high-rye, baking-spice bourbons highly" without a huge community dataset.

### 3. Ratings over time, not one review per bottle

Distiller, Whiskybase and most others store one review per user per bottle. Enthusiasts want to log the same whiskey on different nights, in different glasses, after the bottle has been open for months. A tasting log under each whiskey is a clear gap.

### 4. Trust is a feature

The most damaging reviews are about lost data (Drammer), crashes (Whiskybase, Potion.bar), ads mid-flow (WhiskeyMate), caps (Whiskey Shelf) and expensive subscriptions (Distiller). Our principles answer each: local-first storage, versioned migrations, JSON + CSV export, no ads, no cap, free core loop.

### 5. Collector features are expected

Fill level, bottle counts, price paid, store, pour picker and infinity bottles show up across the top-rated collection apps. We need the basics (M1) and should add pour picker and store-pick fields before launch.

### 6. Separate "experts" from "you"

Distiller's founders deliberately separated expert tasting notes from community ratings to make newcomers comfortable. We do the same: the AI's typical notes are reference material; the user's notes and tags are theirs, shown first.

### 7. Cross-platform is still rare

Most new AI-scan apps are iPhone-only. A PWA that runs on iPhone, Android, Windows and Mac from one URL, with the same collection everywhere once sync lands, is a real advantage, especially for Dev's mix of iPhone and Windows.

## Positioning

> **For whiskey drinkers who want to remember what's worth pouring, Whiskey Tracker is the personal whiskey journal that reads any label from a photo and learns your palate. Unlike Distiller and Whiskybase, it's built around your own tastings rather than crowd reviews, and unlike inventory apps, it never caps, never shows ads and never holds your data hostage.**

## Feature gap matrix

| Capability | Distiller | Whiskybase | OnlyDrams | BoozApp | AI-scan apps | **Us (today)** | **Us (M2)** |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Photo/label identification | – | ● | – | – | ● | ● | ● |
| Barcode | ● | ● | ● | ● | ◐ | – | – |
| Owned / tasted / wishlist | ● | ● | ● | ● | ◐ | – | ● |
| Multiple tastings per bottle | – | – | ◐ | – | ◐ | – | ● |
| Fill level / price paid | ◐ (Pro) | ◐ | ● | ● | ◐ | – | ● |
| Flavor tags | ● | ◐ | ◐ | – | ◐ | – | ● |
| Personal palate prediction | – | – | – | – | – | – | ● |
| Market value | ● | ● (Plus) | ● | ● | ◐ | AI estimate | AI estimate |
| Works on Windows/desktop | Web | Web | – | – | – | ● | ● |
| Offline | ◐ | ◐ | ◐ | – | ◐ | ● | ● |
| Free export | – (Pro) | ◐ | ● | – | ◐ | ● JSON | ● JSON + CSV |
| Social feed | ● | ● | ● | – | ◐ | – | – (by choice) |

● = yes · ◐ = partial / paid · – = no

## Sources

- [Distiller App Store listing](https://apps.apple.com/app/id784925833), [Distiller app overview](https://marlvel.ai/api/llm/apps/food-drink/com-votiv-distiller), [Distiller's own app roundup](https://distiller.com/articles/what-are-the-best-whiskey-apps), [Gear Patrol on Distiller's founders](https://gearpatrol.com/2014/08/08/distiller-whiskey-app/)
- [Whiskybase Plus](https://www.whiskybase.com/de/wp/plus), [Whiskybase review summary](https://marlvel.ai/apps/whiskybase-everything-whisky/reviews)
- [OnlyDrams App Store listing](https://apps.apple.com/us/app/onlydrams/id6446233656)
- [BoozApp App Store listing](https://apps.apple.com/us/app/id1529818838), [BAXUS acquires BoozApp](https://www.businesswire.com/news/home/20231115717703/en/BAXUS-Acquires-BoozApp-to-Offer-Fair-Transparent-Liquor-Pricing-for-Wines-and-Spirits-Enthusiasts)
- [Whiskey Shelf reviews](https://justuseapp.com/en/app/6444685822/whiskey-shelf/reviews), [Drammer reviews](https://justuseapp.com/en/app/1200826728/drammer-whisky-app/reviews), [WhiskeyMate reviews](https://justuseapp.com/en/app/1667974972/whiskeymate-collect-track/reviews), [Potion.bar review summary](https://marlvel.ai/api/llm/apps/food-drink/potion-bar-whiskey-scanner)
- [Whiskey Rater](https://apps.apple.com/app/id6744699006), [Whiskey Label Scanner Journal](https://apps.apple.com/app/id6754710138), [Bunker](https://mwm.ai/apps/bunker-whiskey-collection/6792882697), [DramKeep](https://apps.apple.com/app/id6774836200), [Abov](https://apps.apple.com/pl/app/abov-whiskey/id1112697109)
- Vivino: [App Store](https://apps.apple.com/au/app/id414461255), [Jancis Robinson label-scanner review](https://www.jancisrobinson.com/articles/label-scanner-apps-which-is-best), [Vivino review summary](https://marlvel.ai/intel-report/food-drink/vivino-drink-the-right-wine)
- App category complaints: [AppsHunter whisky apps](https://appshunter.io/ios/topics/whisky-database-app)
