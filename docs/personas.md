# Whiskey Tracker — User Personas

These personas combine published industry research with patterns in app-store reviews of existing whiskey apps. They are composites, not real people. Market facts are cited at the bottom; behaviors are inferred from reviews and should be validated with interviews before public launch.

## Market context

- **The audience is large but the category is maturing.** American whiskey is a ~$5.1B US category, down 0.9% in 2025 while total spirits fell 2.2% (DISCUS). Growth is coming from engaged enthusiasts trading up, not from mass new drinkers.
- **Gen X is the core; Millennials spend the most per bottle.** About 30% of Gen X name whiskey/bourbon as their preferred spirit, vs 22% of Millennials and 11% of Gen Z. Millennials report the highest per-bottle whiskey spend (~$55 vs $44 for Gen X).
- **Women are a large, underserved share.** Estimates put women at roughly 30–40% of US whiskey drinkers, up from ~15% in the 1990s, while most whiskey branding still targets men.
- **Whiskey is a travel hobby.** The Kentucky Bourbon Trail hosted 2.7M visits in 2025 (flat on a record 2024); 80% of visitors come from out of state and 62% report household income above $100k. Ohio, Indiana, Illinois and Tennessee send the most visitors.
- **Moderation is rising.** About half of US drinkers say they're trying to drink less (65% of Gen Z). People who drink less tend to drink better, which favors a "remember what was worth it" tool.

---

## 1. Marcus — the Home Collector / Bourbon Hunter (Primary)

> "I've got 80-some bottles and I still bought a second Weller 12 last month because I forgot I had one."

| | |
| --- | --- |
| Age / life stage | 44, married, two kids, suburban Midwest |
| Whiskey experience | 10+ years; bourbon and rye first, some Scotch |
| Shelf | 60–150 bottles, a dozen open at a time, several store picks and allocated bottles |
| Tech | iPhone, uses Distiller for reviews and a spreadsheet for inventory |
| Spend | $40–$120 typical; will pay secondary prices for hunted bottles |

**Goals**
- Know exactly what he owns, what's open, and how much is left.
- Avoid duplicate purchases; check the shelf from the store aisle.
- Track what he paid vs MSRP and current value.
- Record store-pick details (barrel #, pick group, proof) that generic databases miss.

**Frustrations (from competitor reviews)**
- Barcode scanners don't distinguish store picks and single barrels.
- Free tiers cap collections ("not ideal for large (>99) collections").
- Apps that lost his whole collection after an update. He keeps the spreadsheet as a backup for this reason.
- Ads in the middle of adding a bottle.

**What wins him:** fast bulk entry from photos, store-pick fields, fill levels, dupe warnings, CSV export he trusts, no cap.

**Key features:** shelf status + bottle state (M1, M2), duplicate detection (C3), store-pick fields (M7), CSV export (D3), value (P6), pour picker (P4).

**Willingness to pay:** high for tools that protect a collection worth thousands, but subscription-skeptical. The most likely lifetime buyer; bulk cataloguing needs unlimited label reads.

---

## 2. Priya — the Curious Explorer (Primary)

> "Every time I find one I love at a bar, I take a blurry photo and then never look at it again."

| | |
| --- | --- |
| Age / life stage | 31, professional, city apartment |
| Whiskey experience | 2–3 years; came in through cocktails (old fashioneds, Japanese highballs) |
| Shelf | 5–12 bottles |
| Tech | Android or iPhone; uses Vivino for wine, Untappd once for beer |
| Spend | $35–$70; splurges for gifts and occasions |

**Goals**
- Remember what she tried, where, and whether she liked it.
- Learn the vocabulary ("why do I like this one and not that one?").
- Feel confident buying a bottle or ordering at a bar without asking for help.

**Frustrations**
- Whiskey culture can feel gatekept and male-coded; expert scores and jargon are intimidating.
- Most apps are built for collectors, with inventory-heavy UIs.
- Logging takes too long, so she stops.

**What wins her:** a 15-second "snap and rate" flow, plain-language descriptions, flavor tags she can tap instead of writing notes, and "you'd probably like this" guidance.

**Key features:** photo capture (C1), flavor tags (M5, C4), tasting log with location (M3), palate profile and "will I like it?" (P2, P3), share cards (S1).

**Willingness to pay:** the free tier should fully cover her logging. She converts on "will I like it?" before a $60 purchase, which is the Pro moment.

---

## 3. Dana — the Palate Builder (Secondary)

> "I want my notes to be consistent enough that I can compare a Lagavulin 16 I had in March to one I had in October."

| | |
| --- | --- |
| Age / life stage | 38, runs a monthly tasting club with friends |
| Whiskey experience | 8 years; Scotch-leaning, explores Japanese, Irish and craft American |
| Shelf | 30–50 bottles, many samples |
| Tech | iPad at home, phone at events; uses Whiskybase |

**Goals**
- Structured, comparable notes (nose / palate / finish, intensity).
- Revisit the same whiskey over time and see how her view changed.
- Run blind tastings and flights, then share results with the group.

**Frustrations**
- Apps store one review per bottle; she wants a history.
- Regional sub-categories for Scotch are missing or flattened ("Scotch bottles to be sub-categorized by region").
- Export is weak or paywalled.

**Key features:** tasting log (M3), region-aware styles, compare and flight mode (P5), export (D2, D3), share cards (S1), shared tasting sessions (S3).

**Willingness to pay:** already pays for Whiskybase-type tools; values Pro for flights and group sessions. A potential advocate who brings a whole club.

---

## 4. Tom — the Whiskey Traveler (Secondary)

> "We did six distilleries in three days on the Bourbon Trail and I already can't remember which one had the rye I liked."

| | |
| --- | --- |
| Age / life stage | 52, empty nester, plans one or two whiskey trips a year |
| Whiskey experience | 15 years, casual-serious |
| Tech | iPhone; poor signal in rural distilleries |
| Spend | High on experiences; buys distillery-only bottles |

**Goals**
- Log pours and gift-shop bottles quickly while traveling.
- Keep a record of distilleries visited and favorite pours from each.
- Photos and notes that work without a signal and sync later.

**Key features:** offline capture with queued identification, tasting location (M3), distillery-only and barrel details (M7), trip view (future).

---

## 5. Jess — the Gift Buyer (Tertiary)

> "His birthday's coming up. I don't want to buy something he already has three of."

| | |
| --- | --- |
| Relationship | Partner or family member of a collector |
| Whiskey experience | Low |

**Goals:** see the collector's wishlist and what he already owns, without installing a complex app.

**Evidence:** WhiskeyMate reviewers ask for the "ability to share with spouse or partner."

**Key features:** shareable read-only wishlist link (post-sync), wishlist status (M1).

---

## Persona priorities vs features

| Feature | Marcus | Priya | Dana | Tom | Jess |
| --- | :-: | :-: | :-: | :-: | :-: |
| Snap-and-rate in < 30 s | ●● | ●●● | ● | ●●● | |
| Status: tasted / shelf / wishlist | ●●● | ●● | ●● | ● | ●●● |
| Tasting log over time | ● | ●● | ●●● | ●●● | |
| Flavor tags + palate profile | ● | ●●● | ●● | ● | |
| Duplicate warning | ●●● | ● | ● | ●● | ●● |
| Bottle state / fill / price | ●●● | | ● | ● | |
| Insights | ●● | ●● | ●●● | ● | |
| Export / never lose data | ●●● | ● | ●●● | ● | |
| Offline | ● | ● | ● | ●●● | |

## Sources

- DISCUS 2025 sales via [The Whiskey Wash](https://thewhiskeywash.com/whiskey-news/spirits-rtds-surge-as-u-s-spirits-sales-slip-in-2025-says-discus/)
- Generational preference: [The Liquor Bros](https://theliquorbros.com/blogs/resources/the-fastest-growing-liquors-in-america)
- Per-bottle spend by generation: [Vinetur](https://www.vinetur.com/en/2025100191804/premium-alcohol-sales-growth-slows-as-super-premium-segment-attracts-younger-diverse-consumers.html)
- Women's share of whiskey drinkers: [Drinks Industry Ireland](https://www.drinksindustryireland.ie/whiskey-has-a-gender-problem), [ATOD Magazine](https://atodmagazine.com/?p=49678)
- Kentucky Bourbon Trail 2025: [Spectrum News](https://spectrumnews1.com/ky/lexington/news/2026/04/07/bourbon-trail-visitors), [The Spirits Business](https://www.thespiritsbusiness.com/?p=910414)
- Moderation trends: [Penn State Extension](https://extension.psu.edu/alcoholic-beverage-trends-2025)
- Competitor review quotes: [Whiskey Shelf reviews](https://justuseapp.com/en/app/6444685822/whiskey-shelf/reviews), [Drammer reviews](https://justuseapp.com/en/app/1200826728/drammer-whisky-app/reviews), [WhiskeyMate reviews](https://justuseapp.com/en/app/1667974972/whiskeymate-collect-track/reviews), [OnlyDrams App Store](https://apps.apple.com/us/app/onlydrams/id6446233656)
