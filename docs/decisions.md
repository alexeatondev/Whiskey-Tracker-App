# Product Decisions Log

Decisions are recorded here with the options considered and the reasoning. Status values: **Proposed** (recommended, awaiting Dev's sign-off), **Decided**, **Revisit**.

---

## D-001 · Pricing model — *Decided (Nov 19, 2026): Option A*

### Market benchmarks (Nov 2026)

| Product | Model | Price |
| --- | --- | --- |
| Distiller Pro | Freemium subscription | ~$5.99/mo · ~$49/yr |
| Untappd Insider | Freemium subscription | $5.99/mo · $54.99/yr |
| Vivino Premium | Freemium subscription | ~$4.99/mo · ~$48/yr |
| CellarTracker | Free + subscription by cellar size | $40–$500/yr |
| Bourbon Bro Pro | Subscription | $9.99/mo · $99.99/yr |
| BarrelBook | Free trial + one-time | $7.99 once |
| DramKeep | Positions on "no subscription traps" | — |
| Subscription-app medians (RevenueCat 2026) | — | $10/mo · $34.80/yr |

What the subscription data says:

- **Annual plans retain best.** Annual trial subscribers retain ~20% at day 380 vs ~14% monthly (Adapty 2026). But 95% of annual subscribers who cancel never come back, and 35% of annual cancellations happen in month 1 (RevenueCat 2026), so the first month has to deliver.
- **AI apps earn more per payer** (median year-1 value $30.16 vs $21.37) but refund and churn a bit more.
- **Hybrid is now normal.** About a third of apps mix models; ~23% pair a subscription with a lifetime option. Lifetime works as an anchor next to a subscription, not on its own.
- **Hard paywalls convert ~5× better than freemium** (10.7% vs 2.1% by day 35). We are deliberately *not* doing this, because "no paywall on the core loop" is our main trust promise against Distiller and WhiskeyMate. We accept a lower conversion rate in exchange for word of mouth in enthusiast communities.
- **Subscription fatigue is real**, and small whiskey apps are using it to market themselves (BarrelBook one-time, DramKeep "no subscription traps").

Our cost driver is AI label reads at roughly $0.01–$0.02 each. A typical explorer logs ~4–8 whiskeys a month; a collector cataloguing a shelf may do 100+ in a weekend, then very few.

### Option A — Free core + Pro subscription + Lifetime *(recommended)*

| | Free | Pro |
| --- | --- | --- |
| Price | $0 | **$3.99/mo · $29.99/yr** (7-day free trial on annual) · **$79.99 lifetime** |
| Collection, ratings, tasting log, flavor tags, insights, CSV/JSON export | ✅ unlimited | ✅ |
| Sync across devices (once built) | ✅ | ✅ |
| AI label reads | 15 / month | Unlimited (fair use ~300/mo) |
| "Will I like it?" predictions, palate profile, pour picker | Preview (3/mo) | ✅ |
| Multiple photos, store-pick fields, menu/shelf scan, value tracking | — | ✅ |
| Share cards | ✅ (with small brand mark) | ✅ (clean, extra templates) |

Why it should win:

- Priced **below every enthusiast benchmark** ($29.99 vs $48–$55/yr) and just under the $34.80 market median, which is an easy "cheaper than Distiller" story.
- The free tier covers Priya (explorer) completely, which keeps word of mouth positive. Pro is sold on the *advice* features (palate predictions) where the differentiation is, not on storage.
- The lifetime option catches subscription-averse collectors (Marcus) and gives early cash. At $79.99 (~2.7× annual) and a fair-use cap, it stays profitable even for heavy scanners.
- Unit economics: an annual Pro user nets ~$25.50/yr after the 15% App Store small-business fee. A heavy user (50 reads/mo) costs ~$6–$12/yr in AI, leaving a healthy margin. Free users at 15 reads/mo cap cost at ~$0.20/mo, within the PRD target.
- Launch offer: **"Founding Pour" lifetime at $49.99** for the first 1,000 buyers to seed the community.

Risks: freemium converts slowly (plan for 2–4% of actives paying); needs good paywall moments (after the 15th read, on the first "Will I like it?" preview).

### Option B — Pay once + scan packs

| | |
| --- | --- |
| Free | Manual entry forever + 25 starter AI reads |
| **Unlock** | **$19.99 one-time**: all features, 300 AI reads included |
| Read packs | $4.99 for 200 reads; never expire |

Why it could win:

- Matches the anti-subscription mood in the category and is the simplest to explain.
- Costs and revenue move together: heavy scanners pay more and there is no "unlimited" exposure.

Why it's second:

- Lower lifetime value, and no recurring revenue to fund sync servers and photo storage, which are ongoing costs.
- Credit counters make people hesitate to scan, which works against "the photo is the input."
- Harder to fund continued development of the palate features that differentiate us.

### Decision

**Option A**, chosen by Dev on Nov 19, 2026. Revisit after the beta with a real price test: run a Van Westendorp survey with 50–100 whiskey drinkers (a PickFu panel costs roughly $1–$3 per response) and A/B test $29.99 vs $34.99 annual.

---

## D-002 · Product name — *Decided (Nov 19, 2026): "Second Pour", pending clearance*

Full method and results are in [brand-strategy.md › Naming study](brand-strategy.md#naming-study).

**Top 5:** 1. **Second Pour** · 2. Long Finish · 3. Proofmark · 4. Pourtrait · 5. Sipmark

Dev chose **Second Pour** on Nov 19, 2026. Clearance status (updated Nov 19, 2026 after the official USPTO search):

**USPTO search (tmsearch.uspto.gov, "second pour")**

| Mark | Serial | Status | Goods / services | Risk to us |
| --- | --- | --- | --- | --- |
| SECOND POUR | 98067771 | **Dead, abandoned** | Class 25 apparel, Class 33 alcoholic beverages (individual owner) | Low: abandoned, but shows the phrase is attractive in the drinks space |
| SECOND POUR TABLE | 99728252 | **Live, allowed** (Notice of Allowance Sep 22, 2026; intent-to-use) | Class 43 catering, bartending, bar equipment rental (Second Course Table LLC, CA) | Low–moderate: different class (services vs software), but same drinks context |
| **POUR** | 90104322 (Reg. 6674959) and 90063159 (Reg. 6770431) | **Live, registered** | **Class 9 mobile app software** for locating bars, breweries and coffee shops, browsing their beverage offerings and ordering (Erik Christiansen) | **Moderate: the main issue.** Same class (mobile apps) and a beverage theme. Our mark contains the whole word POUR. Arguments in our favor: "pour" is weak and common for drinks (many POUR-formative marks coexist: FULL POUR, FIRST POUR, PERFECT POUR, POUR RESPONSIBLY…), our app is a personal tasting journal rather than ordering from bars, and SECOND POUR has a different overall commercial impression. An examiner could still cite it |
| POUR RESPONSIBLY | 88677400 | Live, registered | Class 9 software for beverage dispensing hardware | Low |
| FULL POUR | 98001304 | Live, registered | Class 42 web design | Low |

**Other checks**

| Check | Result | Status |
| --- | --- | --- |
| Common-law use | "The Second Pour" women's wine social club, Metro Detroit (events) | ⚠️ Low–moderate |
| App Store / Google Play | No app named "Second Pour" found | ✅ |
| `secondpour.com` | **Taken**: registered 2016 via Namecheap, renews Aug 2027, parked on default nameservers (possibly purchasable from the owner) | ❌ |
| `secondpour.app` | **Available** | ✅ recommended primary |
| `getsecondpour.com`, `secondpourapp.com`, `trysecondpour.com`, `secondpourhq.com` | **Available** | ✅ |
| `drinksecondpour.com` | Taken (registered Aug 2026 by someone else) | ℹ️ watch for a competing use |

**Assessment:** usable but not clean. Get a trademark attorney's knockout opinion (~$300–$600) **before** paying for branding, the icon or the domain portfolio. If the attorney flags POUR as a likely citation, the fallback is **Long Finish** (#2 in the naming study). Also run the same search for it.

Remaining steps are in [backlog.md](backlog.md).

---

## D-004 · Sync for the personal phase — *Decided (Nov 19, 2026): AWS (Cognito + S3) in a dedicated "Second Pour" account*

**Context:** Dev uses the app on an iPhone and a Windows PC. Manual backup export/import works but is easy to forget, doesn't carry deletions, and re-sends every photo each time.

**Options considered:**
1. **OneDrive app folder (built first, then dropped).** Microsoft no longer lets personal accounts register apps outside an Entra directory, so it would have needed an Azure tenant just to get a client ID.
2. **Access DB / Excel in a shared folder.** Rejected. A browser app can't open either file from a phone, and both corrupt easily with concurrent writers.
3. **AWS (chosen).** Dev already uses AWS and Cognito for another app. It is also the path to the M3 multi-user backend, so the work isn't thrown away.

**Decision:** a separate member account, **Second Pour** (884725728481), in Dev's Alex-Eaton-Team AWS Organization, region **us-east-2**. Everything is defined in `infra/second-pour-sync.yaml` (stack `second-pour-sync`):
- Cognito User Pool (Essentials). Public sign-up is off, and there is a single owner user. Sign-in uses the hosted UI with auth code + PKCE, and the refresh token lasts 365 days.
- Cognito Identity Pool. It issues 1-hour credentials for an IAM role that can only read and write `private/<identity id>/*`.
- Private S3 bucket: versioned (30-day undo), TLS-only, CORS limited to the GitHub Pages origin and localhost.
- $1/month budget alert. All resources are tagged `project=second-pour`.

We did not reuse the existing "Identity Delegated Admin" account. It administers sign-in for the whole org, so mixing app resources into it would widen its blast radius.

**How sync works:** this part is unchanged from the OneDrive design.
- `collection.json` holds every record (without photos) plus deletion tombstones.
- Photos are stored once each as `photos/<photoId>.jpg` (+ `_t` thumbnail).
- Each device merges per record: the newer `updatedAt` wins, and a deletion wins over older edits.
- Uploads use S3 conditional writes (`If-Match` / `If-None-Match`) and retry on conflict.
- Sync runs on launch, a few seconds after any change, when the app returns to the foreground, and when the connection comes back.
- Requests are signed with SigV4 in `js/aws.js` (WebCrypto, no SDK). Tests check every signature against the official AWS signer.

**Cost:** about $0.01–0.05/month at personal scale. The free tier covers Cognito up to 10k MAU.

**Later (M3):** turn on self sign-up (plus Sign in with Apple/Google). The per-user folder design already isolates users. Move the Anthropic key behind a Lambda.

---

## D-003 · Shareable tasting results — *Decided (Nov 19, 2026): share cards in M2, live sessions later*

| Approach | What it is | Complexity | When |
| --- | --- | --- | --- |
| **Share cards** | Generate an image (one whiskey, or a tasting-night lineup with ratings) in the browser and send it through the phone's share sheet to Messages, Instagram, etc. | Low: on-device canvas drawing plus the Web Share API; no server, no accounts | **M2** |
| **Shared tasting sessions** | A host starts a tasting night, guests join with a link or QR code, everyone rates the same pours, and results reveal at the end (blind mode optional) | High: needs accounts or guest sessions, real-time sync and moderation | After sync (**M5**) |
| Shareable wishlist link | Read-only link for gift buyers | Medium: needs the sync backend | **M3/M4** |

Reasoning: share cards deliver most of the value (showing friends what you're drinking, recapping a tasting night) at a fraction of the cost, and every shared card is free marketing with the app name on it. Live group sessions are a strong future feature for Dana's tasting club, but only once sync exists.
