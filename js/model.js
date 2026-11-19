// Data model v2: statuses, bottle details, tasting log, flavor tags, migration, duplicate matching and CSV.

export const SCHEMA_VERSION = 2;

export const STATUSES = [
  { key: 'tasted', label: 'Tasted', short: 'Tasted' },
  { key: 'shelf', label: 'On my shelf', short: 'Shelf' },
  { key: 'wishlist', label: 'Wishlist', short: 'Wishlist' },
];
export const statusLabel = (k) => (STATUSES.find((s) => s.key === k) || STATUSES[0]).label;

export const BOTTLE_STATES = [
  { key: 'sealed', label: 'Sealed' },
  { key: 'open', label: 'Open' },
  { key: 'finished', label: 'Finished' },
];

export const SERVES = ['Neat', 'Splash of water', 'On the rocks', 'Highball', 'Cocktail', 'Other'];

// A compact whiskey flavor vocabulary, grouped like a tasting wheel.
export const FLAVOR_GROUPS = [
  { group: 'Sweet', tags: ['Vanilla', 'Caramel', 'Honey', 'Toffee', 'Brown sugar', 'Maple', 'Chocolate'] },
  { group: 'Fruit', tags: ['Cherry', 'Dried fruit', 'Apple', 'Citrus', 'Stone fruit', 'Berry', 'Tropical'] },
  { group: 'Spice', tags: ['Cinnamon', 'Baking spice', 'Black pepper', 'Clove', 'Nutmeg', 'Mint'] },
  { group: 'Wood', tags: ['Oak', 'Toasted oak', 'Cedar', 'Leather', 'Tobacco', 'Coffee'] },
  { group: 'Grain', tags: ['Corn', 'Rye grain', 'Malt', 'Bread', 'Nutty'] },
  { group: 'Smoke & earth', tags: ['Peat', 'Smoke', 'Medicinal', 'Brine', 'Earthy'] },
  { group: 'Floral & herbal', tags: ['Floral', 'Herbal', 'Grassy'] },
];
export const FLAVOR_TAGS = FLAVOR_GROUPS.flatMap((g) => g.tags);
const FLAVOR_SET = new Set(FLAVOR_TAGS);

const emptyBottle = () => ({ state: 'sealed', fill: 100, count: 1, pricePaid: '', purchasedAt: '', store: '' });

/** Bring any stored record (v1 or v2) up to the current shape without dropping unknown fields. */
export function normalize(rec) {
  if (!rec) return rec;
  const out = { ...rec };
  if (!STATUSES.some((s) => s.key === out.status)) out.status = 'tasted';
  out.flavors = Array.isArray(out.flavors) ? out.flavors.filter((f) => FLAVOR_SET.has(f)) : [];
  out.tastings = Array.isArray(out.tastings) ? out.tastings.filter((t) => t && t.id) : [];
  out.bottle = { ...emptyBottle(), ...(out.bottle || {}) };
  out.bottle.fill = clamp(Number(out.bottle.fill), 0, 100, 100);
  out.bottle.count = Math.max(0, Math.round(Number(out.bottle.count) || 0)) || (out.bottle.state === 'finished' ? 0 : 1);
  out.rating = Number(out.rating) || 0;
  out.schema = SCHEMA_VERSION;
  return out;
}

function clamp(n, lo, hi, fallback) {
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
}

export function newTasting({ date, rating = 0, serve = '', location = '', notes = '' } = {}) {
  return {
    id: (crypto.randomUUID && crypto.randomUUID()) || `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    date: date || todayISO(),
    rating: Number(rating) || 0,
    serve, location, notes,
  };
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function lastTasted(w) {
  const dates = (w.tastings || []).map((t) => t.date).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : '';
}

/** Parse "$65", "65.00", "about $40-50" → 65 / 40. Returns NaN if no number. */
export function parseMoney(v) {
  const m = String(v ?? '').replace(/,/g, '').match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}

// ---------- Duplicate detection ----------

const STOP = new Set(['the', 'whiskey', 'whisky', 'bourbon', 'straight', 'kentucky', 'tennessee', 'single', 'malt', 'scotch',
  'rye', 'year', 'years', 'old', 'yr', 'yo', 'aged', 'original', 'edition', 'distillery', 'distilling', 'co', 'company', 'and', 'of']);

function tokens(s) {
  return String(s || '').toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t && !STOP.has(t));
}

/** Numbers (age statements, years) must agree for two names to match: "Eagle Rare 10" ≠ "Eagle Rare 17". */
const numbers = (ts) => ts.filter((t) => /^\d+$/.test(t)).sort().join(',');

/** Similarity 0..1 between two whiskeys based on name (+ distillery as a tiebreaker). */
export function similarity(a, b) {
  const ta = tokens(a.name), tb = tokens(b.name);
  if (!ta.length || !tb.length) return 0;
  if (numbers(ta) !== numbers(tb)) return 0;
  const A = new Set(ta), B = new Set(tb);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const jaccard = inter / (A.size + B.size - inter);
  const da = tokens(a.distillery).join(' '), db = tokens(b.distillery).join(' ');
  const bonus = da && db && (da.includes(db) || db.includes(da)) ? 0.1 : 0;
  return Math.min(1, jaccard + bonus);
}

/** Existing whiskeys that look like the same product, best match first. */
export function findDuplicates(all, candidate, threshold = 0.7) {
  return all
    .map((w) => ({ w, score: similarity(w, candidate) }))
    .filter((x) => x.score >= threshold)
    .sort((x, y) => y.score - x.score)
    .map((x) => x.w);
}

// ---------- CSV export ----------

const CSV_COLUMNS = [
  ['Name', (w) => w.name], ['Distillery', (w) => w.distillery], ['Style', (w) => w.type],
  ['Country', (w) => w.country], ['Region', (w) => w.region], ['Age', (w) => w.age], ['ABV', (w) => w.abv],
  ['Proof', (w) => w.proof], ['Cask / Finish', (w) => w.caskFinish], ['Mash Bill', (w) => w.mashBill],
  ['Batch / Edition', (w) => w.edition], ['Status', (w) => statusLabel(w.status)], ['My Rating', (w) => w.rating || ''],
  ['Flavors', (w) => (w.flavors || []).join('; ')], ['Times Tasted', (w) => (w.tastings || []).length],
  ['Last Tasted', (w) => lastTasted(w)], ['Bottle State', (w) => (w.status === 'shelf' ? w.bottle.state : '')],
  ['Fill %', (w) => (w.status === 'shelf' ? w.bottle.fill : '')], ['Bottles', (w) => (w.status === 'shelf' ? w.bottle.count : '')],
  ['Price Paid', (w) => w.bottle.pricePaid], ['Purchased', (w) => w.bottle.purchasedAt], ['Store', (w) => w.bottle.store],
  ['Typical Price', (w) => w.approxPrice], ['Nose', (w) => w.nose], ['Palate', (w) => w.palate], ['Finish', (w) => w.finish],
  ['My Notes', (w) => w.myNotes], ['Added', (w) => (w.createdAt ? new Date(w.createdAt).toISOString().slice(0, 10) : '')],
];

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(items) {
  const rows = [CSV_COLUMNS.map(([h]) => h)];
  for (const w of items) rows.push(CSV_COLUMNS.map(([, f]) => f(w)));
  // BOM so Excel opens UTF-8 (e.g. "Scotch – Single Malt") correctly.
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}
