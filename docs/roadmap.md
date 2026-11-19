# Whiskey Tracker — Project Plan & Roadmap

Requirement IDs (C1, M3, P2…) refer to the [PRD](PRD.md).

## Where things stand (v0.1, shipped)

A working installable PWA on GitHub Pages:

- Photo → Claude label read with structured JSON output → editable form → half-star rating → save
- Collection grid with search, style filter and sorting; detail page with inline re-rating
- IndexedDB storage with photos, JSON backup/merge import, offline app shell
- Bring-your-own Anthropic API key, stored per device

**Review notes on the existing code**

| Area | Assessment |
| --- | --- |
| Architecture | Clean and small (~1,000 lines), no build step, easy to change. Good base for the next two milestones. |
| AI call | Solid: JSON-schema output, refusal and truncation handling, typed errors. `max_tokens: 16000` is far more than needed for this schema; ~2,000 is plenty and caps cost if something goes wrong. |
| Data model | One flat record with a single rating. No status, no history, no schema version, so this is the first thing to extend (M1). |
| Sync | Manual export/import only. Fine for one user; a blocker for public launch. |
| Security | API key in `localStorage` is acceptable for a personal app and clearly disclosed. Must move server-side before anyone else uses it. |
| Tests | None. Add a lightweight smoke test (Playwright) before the codebase grows further. |
| Accessibility | Keyboard-operable star input is a good start; needs labels on icon-only controls and contrast review. |

## Platform decision

**Recommendation: stay a PWA, add a backend at M3, and wrap with Capacitor for the app stores at M4.**

| Option | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| **PWA (current)** | One codebase for iPhone, iPad, Android, Windows, Mac; no store review; instant updates; free hosting | iOS can evict storage; no App Store discovery; limited background work | ✅ Keep as the core |
| **PWA + Capacitor wrapper** | Same code ships to App Store/Play; native camera, barcode, haptics; keeps the web app | Store review for an alcohol app (17+, age gate); small native config | ✅ Add at public launch |
| React Native / Expo rewrite | Best native feel; strong camera libraries | Rewrite of working code; separate web story for Windows | ❌ Not worth it yet |
| Flutter / native Swift + Kotlin | Top performance | Two to three codebases or a new language; slow for a solo builder | ❌ |

Rationale: the hardest part of this product is the AI identification and the palate model, not native UI. The PWA already runs on every device Dev uses; a rewrite would spend weeks re-earning what exists.

## Milestones

### M1 — Journal foundations *(in progress, this branch)*

Goal: make the data model match how people actually drink and collect.

- [x] Data model v2 with schema versioning and lazy migration (D4)
- [x] Status: Tasted / On my shelf / Wishlist, with filter tabs (M1, M6)
- [x] Shelf details: bottle state, fill level, count, price paid, purchase date, store (M2)
- [x] Tasting log: multiple dated tastings per whiskey (M3, M4)
- [x] Flavor tags with AI suggestions from the label read (M5, C4)
- [x] Duplicate detection after identification (C3)
- [x] Insights page (P1)
- [x] CSV export (D3)
- [x] Cap `max_tokens` at 6,000 (was 16,000); bump service worker version
- [x] Browser smoke test of the full flow with a mocked Claude API (manual script for now; CI in M2)
- [ ] Dev uses it for two weeks and logs friction

### Personal POC track *(now — refine for Dev's own use before any launch work)*

1. [ ] Merge M1 and use it daily for two weeks; keep a friction list
2. [x] **Automatic sync between iPhone and PC through AWS (Cognito + S3)** ([D-004](decisions.md)), built and deployed Nov 19
3. [ ] "Ask for more detail" on low-confidence label reads + back-label photo (C2, C5)
4. [ ] Palate profile and "Will I like it?" once ~15–20 whiskeys are rated (P2, P3)
5. [ ] Quick wins: pour picker (P4), share cards (S1), store-pick fields (M7)
6. [ ] Automated browser tests in CI to protect the data model

Launch-only work (consent screens, age gate, app-store wrapper, payments, rebrand) waits until Dev decides to go public.

### M2 — Palate *(next, ~3–4 weeks)*

Goal: the app starts giving advice, not just storing notes.

- Palate profile: flavor radar weighted by rating (P2)
- "Will I like it?" scan mode: predicted rating + one-sentence reason from the user's history (P3)
- Pour picker from open bottles, with mood/flavor filters (P4)
- Low-confidence identification asks one clarifying question (C2)
- Multiple photos per bottle (C5); store-pick fields (M7)
- **Share cards** for a whiskey or a tasting night via the share sheet (S1, [D-003](decisions.md))
- Brand clearance for **Second Pour**: official USPTO search, domains, handles (see [backlog.md](backlog.md))
- Playwright smoke tests in CI

### Start now, in parallel *(long lead times)*

- Form the LLC, get the EIN and request a D-U-N-S number (D-U-N-S can take ~2 weeks and gates both store org accounts); see [launch-checklist.md](launch-checklist.md) A and B

### M3 — Accounts, sync and server AI *(~4–6 weeks)*

Goal: remove the two blockers to other people using it.

- Backend: extend the AWS setup already running for the personal phase ([D-004](decisions.md)). Open Cognito sign-up; the per-user S3 folders already keep each user's data separate. Add API Gateway + Lambda (+ DynamoDB if needed) for server-side features.
- Local-first sync: already built. IndexedDB stays the source of truth on each device, and `js/sync.js` merges per record by `updatedAt`, with tombstones for deletions.
- Claude proxy Lambda with per-user quota, product-level cache, and a cheaper model tier for easy labels (removes the bring-your-own key)
- Settings: sign in with Apple / Google / email link; delete account and data (X3)

### M4 — Public beta *(~4 weeks)*

- Work through [launch-checklist.md](launch-checklist.md): business setup, store accounts, legal docs, AI consent, age signals, privacy labels (X2, X3, X6–X10)
- Age gate, privacy policy, terms, responsible-drinking copy (X2, X3)
- Capacitor builds for iOS and Android; TestFlight and Play internal testing (X4)
- Onboarding: three-screen intro + "rate 5 whiskeys you remember" to seed the palate
- Brand name and app icon; landing page
- Pricing per [D-001](decisions.md): free core; Pro $3.99/mo · $29.99/yr; lifetime $79.99 (Founding Pour $49.99); paywall via RevenueCat or Stripe for web
- Rebrand the app to **Second Pour**; apply [brand strategy](brand-strategy.md) (icon, wordmark, store listing, voice pass on UI copy)
- Analytics (privacy-respecting) for PRD success metrics

### M5 — Grow *(later)*

- Barcode fast path seeded with open data (Iowa ABD product list, CC BY 4.0) (C6)
- Menu / shelf scan (C7)
- Compare and tasting-flight mode for hosts (P5)
- Shelf value tracking (P6)
- Shareable wishlist link for gift buyers (S2)
- Shared tasting sessions with guest links and blind mode (S3)
- Import from Distiller / OnlyDrams / Whiskybase (D7)

## Working agreement

- Each milestone ships on a feature branch → PR → merge to `main` → GitHub Pages deploys automatically.
- Bump `VERSION` in `sw.js` on every release so installed apps update.
- Keep `docs/` current: PRD status column, [decisions.md](decisions.md) and this checklist are updated whenever a decision is made or a milestone ships.
- Before a public launch, validate personas with 5–8 short interviews (bourbon groups, tasting clubs, friends).
