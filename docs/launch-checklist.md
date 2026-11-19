# Go-Live Checklist: App Store & Google Play

Everything needed to publish **Second Pour** as a real app on iOS and Android, beyond writing the code. This is a living document: update the status column as items move.

**Status:** ☐ not started · ◐ in progress · ☑ done · ⏸ deferred / not needed yet
**⚖️** = worth a lawyer or accountant's review. *This checklist is a planning aid, not legal or tax advice.*

Last reviewed: Nov 19, 2026

---

## Summary: what's different about *this* app

Most of this list applies to any app. Four things are specific to Second Pour and are the likeliest to cause a rejection or legal exposure:

1. **Alcohol content.** It gets an 18+ rating, needs an age gate, and can't encourage excessive drinking. Apple Guideline 1.4.3 bans apps that encourage *excessive* alcohol consumption, so no drink streaks, volume leaderboards or drinking games.
2. **Photos sent to a third-party AI.** Since Nov 2025, Apple Guideline 5.1.2(i) requires a clear in-app disclosure and **explicit opt-in** before personal data, such as a user's photos, goes to a third-party AI like Anthropic. A line in the privacy policy is not enough. Google clarified a similar obligation in July 2026.
3. **State age-verification laws for app stores** (Texas in effect; Utah and others following). Apps must read the age signal the store provides and act on it (Apple's Declared Age Range API, Google's Play Age Signals API). Because we are 18+/21+, the action is simple: block minors.
4. **A web app inside a native shell.** Apple Guideline 4.2 rejects apps that feel like a repackaged website, so the Capacitor build needs real native features.

---

## A. Business foundation

| ID | Item | Status | Notes / cost |
| --- | --- | :-: | --- |
| A-1 | Decide: personal developer accounts vs a business entity. **Recommendation: form an LLC** | ☐ | Limits personal liability for an alcohol-adjacent app that holds user data. It also lets you use *organization* store accounts (see B-3). ⚖️ |
| A-2 | Form an Iowa LLC (e.g. "Second Pour LLC") with the Iowa Secretary of State; get a registered agent | ☐ | Filing fee is about $50 (verify current fee); a small biennial report fee follows. ⚖️ optional |
| A-3 | Get an EIN from the IRS | ☐ | Free, online, same day |
| A-4 | Open a business bank account | ☐ | Needed for store payouts |
| A-5 | Request a **D-U-N-S number** for the LLC | ☐ | Free from Dun & Bradstreet; can take up to ~2 weeks. Required for Apple and Google organization accounts |
| A-6 | Simple bookkeeping setup; ask an accountant how store payouts and subscriptions are taxed | ☐ | The stores collect and remit sales tax/VAT as merchant of record; income tax is still yours. ⚖️ |
| A-7 | Consider insurance (tech errors & omissions plus cyber) | ⏸ | Revisit at public launch |

## B. Developer accounts & store agreements

| ID | Item | Status | Notes / cost |
| --- | --- | :-: | --- |
| B-1 | Enroll in the **Apple Developer Program** as an organization | ☐ | $99/year. Needs D-U-N-S, the legal entity name and a public website |
| B-2 | Enroll in the **Apple App Store Small Business Program** | ☐ | Cuts Apple's commission from 30% to 15% (under $1M/yr) |
| B-3 | Create a **Google Play Console** organization account | ☐ | $25 one-time; identity and D-U-N-S verification. Org accounts skip the **12 testers × 14 days** closed-test requirement that new *personal* accounts face |
| B-4 | Accept the Paid Apps agreement (Apple) and payments profile (Google); add bank and tax forms (W-9) | ☐ | Required before selling subscriptions |
| B-5 | **Reserve the name**: create the "Second Pour" app record in App Store Connect and Play Console early | ☐ | App names are first-come; this holds the name before launch |
| B-6 | Anthropic API: create the organization account in the LLC's name and accept the **Commercial Terms**; set spend limits | ☐ | The API key moves server-side (D-6 in the PRD); never ship a key in the app |

## C. Brand & intellectual property

| ID | Item | Status | Notes |
| --- | --- | :-: | --- |
| C-1 | Preliminary trademark knockout for "SECOND POUR" | ☑ | Done Nov 19. No live SECOND POUR registration, but a registered **POUR** for beverage/bar mobile apps (Class 9) is a moderate risk. See [decisions.md › D-002](decisions.md) |
| C-2 | Official USPTO search (tmsearch.uspto.gov) | ☑ | Done Nov 19; attorney opinion next (backlog B-2a) ⚖️ |
| C-3 | Attorney clearance and **file a federal trademark** (Class 9 software, Class 42 SaaS) | ☐ | ~$350/class in USPTO fees plus attorney time. File as intent-to-use before public marketing. ⚖️ |
| C-4 | Register domains and social handles | ◐ | `secondpour.app` and `getsecondpour.com` available; `secondpour.com` taken. Backlog B-3, B-4 |
| C-5 | **Store screenshots and marketing use fictional or generic bottles**, not real brands' labels or logos | ☐ | Apple 5.2 and Google IP policy: no third-party trademarks in metadata without permission. Users' own photos inside the app are fine |
| C-6 | Open-source license notices screen (Anthropic SDK, Capacitor, other dependencies) | ☐ | Most are MIT/Apache and only require including the notice |
| C-7 | If the Iowa ABD product dataset is used for barcode lookup: add the CC BY 4.0 attribution | ⏸ | M5 feature |

## D. Legal documents (public URLs required by both stores)

| ID | Item | Status | Notes |
| --- | --- | :-: | --- |
| D-1 | **Privacy Policy** | ☐ | Must cover what we collect (photos, ratings, notes, account email, purchase status), the AI processor (Anthropic) and what it does with images, other processors (hosting, RevenueCat), retention, deletion and contact. ⚖️ |
| D-2 | **Terms of Use / EULA** | ☐ | Include 21+ eligibility, responsible-use statement, AI output disclaimer ("label reads and predictions may be wrong"), subscription terms and limitation of liability. ⚖️ |
| D-3 | Support page with a contact method (email) | ☐ | Both stores reject broken or empty support URLs |
| D-4 | Account and data deletion: **in-app** (Apple 5.1.1(v)) and a **web deletion request page** (Google Play) | ☐ | Needs the sync backend |
| D-5 | Subscription disclosures on the paywall: price, period, auto-renew, how to cancel, links to Terms and Privacy; a **Restore Purchases** button | ☐ | Apple 3.1.2; the most common subscription rejection |

## E. Alcohol & age compliance

| ID | Item | Status | Notes |
| --- | --- | :-: | --- |
| E-1 | Apple age-rating questionnaire: *frequent alcohol references* → **18+** | ☐ | Apple's tiers are 4+/9+/13+/16+/18+ |
| E-2 | Google Play: IARC questionnaire and **Target audience = 18+ only** | ☐ | |
| E-3 | **In-app age gate at first launch** ("Are you 21 or older?"), with the same gate on the website | ☐ | US legal drinking age; standard in alcohol apps |
| E-4 | Integrate **Apple Declared Age Range API** and **Google Play Age Signals API**; block users the store reports as under 18 | ☐ | Required under state App Store Accountability Acts: Texas in effect (2026); Utah and others with staggered dates. ⚖️ track changes |
| E-5 | No features that encourage excessive drinking: no streaks, pour counters as achievements, speed or volume leaderboards, or drinking games | ☑ | Already a brand principle ([brand-strategy.md](brand-strategy.md) §8) |
| E-6 | No alcohol sales, delivery or price-to-buy links in v1 | ☑ | Keeps us out of alcohol-sales regulation; revisit before adding "where to buy" |
| E-7 | Responsible-drinking line in onboarding and settings (e.g. a link to responsibility.org) | ☐ | |
| E-8 | Paid marketing: target 21+ only and follow each ad platform's alcohol policy | ⏸ | Meta and Google Ads restrict alcohol-related ads |

## F. AI-specific requirements

| ID | Item | Status | Notes |
| --- | --- | :-: | --- |
| F-1 | **AI consent screen** before the first label read: say plainly that the photo is sent to Anthropic's AI to read the label, then Allow / Not now. Keep manual entry fully usable if they decline | ☐ | Apple 5.1.2(i) explicit opt-in. Record consent and make it revocable in Settings |
| F-2 | Label AI-generated content as such ("Typical notes, AI-generated", confidence shown) | ◐ | Detail page already says "Typical notes for this whiskey" |
| F-3 | **"Report this result" button** on AI output (label reads, "Will I like it?") | ☐ | Google Play AI-Generated Content policy requires in-app reporting for generative AI apps; low effort, so do it regardless |
| F-4 | Anthropic Usage Policy check: stay within allowed use; 18+ audience; no chatbot without AI disclosure (if a chat feature is ever added) | ☐ | |
| F-5 | Server-side AI proxy with per-user quotas and abuse limits | ☐ | PRD D-6 (M3) |

## G. Privacy & security

| ID | Item | Status | Notes |
| --- | --- | :-: | --- |
| G-1 | Apple **Privacy Nutrition Label** (App Privacy section) | ☐ | Photos/User Content, Identifiers (account), Purchases; "not used for tracking" |
| G-2 | Apple **privacy manifest** (`PrivacyInfo.xcprivacy`), including manifests from third-party SDKs | ☐ | Required for upload |
| G-3 | Google Play **Data Safety** form | ☐ | Must match the privacy policy |
| G-4 | Encryption export question: we use only standard HTTPS → set `ITSAppUsesNonExemptEncryption = NO` | ☐ | Avoids export-compliance paperwork |
| G-5 | State privacy laws: below thresholds at launch (Iowa CDPA and most states apply at 100,000+ residents' data). Adopt the baseline anyway: access, deletion, no sale of data | ☐ | Re-check yearly as users grow. ⚖️ |
| G-6 | Launch **US-only** at first; defer GDPR/UK obligations (EU representative, DSA "trader" status) | ☐ | Revisit before international launch |
| G-7 | Security basics: row-level security on the database, private photo storage, backups, no secrets in the app bundle, dependency updates | ☐ | |
| G-8 | No analytics or ad SDKs that "track" (keeps us out of App Tracking Transparency) | ☐ | Use privacy-friendly analytics only |

## H. Payments (Option A pricing)

| ID | Item | Status | Notes |
| --- | --- | :-: | --- |
| H-1 | Use **Apple In-App Purchase** and **Google Play Billing** for Pro and Lifetime (required for digital features) | ☐ | Recommend RevenueCat to manage both stores and web |
| H-2 | Create products: Pro Monthly $3.99, Pro Annual $29.99 (7-day trial), Lifetime $79.99, Founding Pour $49.99 (limited) | ☐ | Matches [D-001](decisions.md) |
| H-3 | Decide Family Sharing for subscriptions (recommend **on**, since households share bottles) | ☐ | |
| H-4 | Web purchases for the PWA (Stripe) with entitlement shared across platforms | ⏸ | Optional; US App Store rules now allow linking out to web purchase, but keep v1 simple |
| H-5 | Sandbox-test purchases, renewals, cancellations and restore on both platforms | ☐ | |

## I. App review readiness

| ID | Item | Status | Notes |
| --- | --- | :-: | --- |
| I-1 | **Beat the 4.2 "web wrapper" rejection**: native camera (Capacitor Camera), works offline, native share sheet, haptics, Sign in with Apple | ☐ | Our offline-first design and camera flow help a lot |
| I-2 | If offering Google sign-in, also offer **Sign in with Apple** (or another privacy-preserving login) | ☐ | Apple 4.8 |
| I-3 | Demo account and **review notes** for Apple and Google explaining the age gate, AI consent and how to test a label read | ☐ | Reviewers need to get past the 21+ gate and see the AI flow |
| I-4 | No placeholder text, broken links or "beta" labels; app is complete | ☐ | Apple 2.1 |
| I-5 | Accessibility pass (VoiceOver/TalkBack labels, contrast, Dynamic Type) | ◐ | Keyboard star input done |
| I-6 | Google Play target API level meets Play's current requirement | ☐ | Check at build time; it rises yearly |
| I-7 | Crash reporting (privacy-friendly) and crash-free beta | ☐ | |

## J. Store listings

| ID | Item | Status | Notes |
| --- | --- | :-: | --- |
| J-1 | Name, subtitle ("Whiskey journal & palate"), description, keywords | ☐ | From [brand-strategy.md](brand-strategy.md) |
| J-2 | Screenshots (current iPhone and iPad sizes; Android phone), app preview video optional | ☐ | Use fictional bottles (C-5) |
| J-3 | App icon (1024×1024) and Google Play feature graphic (1024×500) | ☐ | Logo concept in brand strategy |
| J-4 | Support, marketing and privacy URLs live | ☐ | Needs domain (C-4) |
| J-5 | Category: Food & Drink | ☐ | |

## K. Beta & launch

| ID | Item | Status | Notes |
| --- | --- | :-: | --- |
| K-1 | TestFlight beta (internal, then external up to 10,000 testers) | ☐ | External testing needs a light Apple review |
| K-2 | Google Play closed test (only 14 days × 12 testers if the account is *personal*) | ☐ | Not required with an org account (B-3) |
| K-3 | Beta feedback loop and persona interviews (backlog B-8) | ☐ | |
| K-4 | Launch plan: soft launch to whiskey communities, then broader | ☐ | [brand-strategy.md](brand-strategy.md) §8 |

## L. Ongoing after launch

| ID | Item | Cadence |
| --- | --- | --- |
| L-1 | Renew Apple Developer Program | Yearly ($99) |
| L-2 | Re-answer age-rating and privacy forms when features change | Each relevant release |
| L-3 | Watch App Review Guideline, Play policy and state age-law updates | Quarterly |
| L-4 | LLC biennial report; trademark maintenance filings (years 5–6, then every 10) | As due |
| L-5 | Re-check privacy-law thresholds as users grow | Yearly |

---

## Rough one-time cost to go live

| Item | Estimate |
| --- | --- |
| LLC formation (Iowa) | ~$50 + registered agent (free if self) |
| Apple Developer Program | $99/yr |
| Google Play Console | $25 once |
| Domains | ~$15–$40/yr |
| Trademark filing (2 classes, self-filed) | ~$700 USPTO fees; + ~$500–$1,500 if an attorney clears and files |
| Privacy policy / terms | $0–$300 with a generator, or ~$500–$1,500 lawyer-reviewed |
| Backend (Supabase / Cloudflare), RevenueCat | Free tiers at small scale |
| **Total, lean** | **~$1,000–$1,500** |
| **Total, lawyer-reviewed** | **~$2,500–$4,500** |

## Sources

- Apple 5.1.2(i) third-party AI consent: [TechCrunch](https://techcrunch.com/2025/11/13/apples-new-app-review-guidelines-clamp-down-on-apps-sharing-personal-data-with-third-party-ai)
- Apple age ratings (18+ for frequent alcohol references): [Apple overhaul via MacRumors](https://www.macrumors.com/2025/07/25/apple-overhauls-app-store-age-ratings/), [rating tiers](https://newly.app/how-to/app-store-age-rating)
- State App Store Accountability Acts: [Apple developer news (Texas)](https://developer.apple.com/news/?id=2ezb6jhj), [Wiley overview, June 2026](https://www.mondaq.com/unitedstates/privacy-protection/1799524/key-developments-with-state-app-store-accountability-acts-as-texas-act-takes-effect)
- Google Play 12-tester rule: [Google Play Help](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- Google Play AI-Generated Content policy: [Google Play Help](https://support.google.com/googleplay/android-developer/answer/13985936?hl=en)
- Apple 4.2 and web wrappers: [MobiLoud](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper)
- Iowa CDPA thresholds: [Baker Donelson](https://bakerdonelson.com/consumer-data-privacy-law-guide-iowa)
- Anthropic Usage Policy: [anthropic.com/aup](https://www.anthropic.com/aup)
