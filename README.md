# Whiskey Tracker App

Snap a photo of a bottle, have the details read from the label automatically, rate it from ½ to 5 stars, and browse your collection. It runs on Windows, iPhone and iPad from the same code.

## Features

- **Photo capture**: take a photo with the camera or pick one from your library. The photo is saved with the entry.
- **Automatic details**: Claude reads the label and fills in the name, distillery, style, region, age, ABV/proof, cask, mash bill, tasting notes and approximate price. You can edit any field before saving.
- **Half-star ratings**: tap the left half of a star for x.5, or the right half for a whole star. You can also drag across the stars or use the arrow keys. Ratings can be changed from the detail page too.
- **Collection view**: a grid of your bottles with search, a style filter, and sorting by newest, top rated, name or distillery.
- **Works offline**: browsing and rating work without a connection. Only label recognition needs internet.
- **Backup and transfer**: export everything, photos included, to a single file and import it on another device.

## Use it

Once GitHub Pages is enabled (see below), open the site URL:

- **iPhone / iPad**: open it in Safari, tap **Share**, then **Add to Home Screen**. It then opens full-screen like a native app.
- **Windows**: open it in Edge or Chrome and click the **Install** icon in the address bar.

Then open **Settings** (the gear icon) and paste an Anthropic API key from <https://console.anthropic.com/settings/keys> to turn on label recognition. The key is stored only on that device. Each photo costs about a cent or two in API usage. Without a key the app still works, but you type the details in yourself.

## Your data

Your collection is stored in the browser on each device (IndexedDB). To move it or keep devices in step, use **Settings → Export backup** on one device and **Import backup** on the other, for example by saving to iCloud Drive or OneDrive. Imports merge: the newer version of each entry wins and nothing is deleted.

## Deploying (GitHub Pages)

1. Merge this branch into `main`.
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. The `Deploy to GitHub Pages` workflow publishes the site to `https://<your-username>.github.io/<repo-name>/`.

## Development

There is no build step. It's plain HTML, CSS and JavaScript modules:

```
python3 -m http.server 8000   # then open http://localhost:8000
```

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | App shell, styling, views and routing |
| `js/claude.js` | Label recognition via the Anthropic SDK, with structured JSON output |
| `js/db.js` | IndexedDB storage plus backup export/import |
| `js/image.js` | Photo orientation fix, resizing and JPEG compression |
| `js/stars.js` | Half-star rating display and input |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installable app and offline support |
| `vendor/anthropic-sdk.mjs` | Browser bundle of `@anthropic-ai/sdk` |

When you change app files, bump `VERSION` in `sw.js` so installed copies pick up the update.
