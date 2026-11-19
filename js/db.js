// IndexedDB storage for whiskeys. Photos are stored as Blobs alongside each record.
const DB_NAME = 'whiskey-tracker';
const DB_VERSION = 1;
const STORE = 'whiskeys';

let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    Promise.resolve(fn(store)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

const wrap = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export const getAll = () => tx('readonly', (s) => wrap(s.getAll()));
export const get = (id) => tx('readonly', (s) => wrap(s.get(id)));
export const put = (item) => tx('readwrite', (s) => wrap(s.put(item)));
export const remove = (id) => tx('readwrite', (s) => wrap(s.delete(id)));

export function newId() {
  return (crypto.randomUUID && crypto.randomUUID()) ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Ask the browser not to evict our data (important on iOS).
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const already = await navigator.storage.persisted();
      if (!already) await navigator.storage.persist();
    }
  } catch { /* ignore */ }
}

// ---------- Backup (export / import) ----------

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function exportAll() {
  const items = await getAll();
  const out = [];
  for (const item of items) {
    const copy = { ...item };
    if (item.image instanceof Blob) copy.image = await blobToDataUrl(item.image);
    if (item.thumb instanceof Blob) copy.thumb = await blobToDataUrl(item.thumb);
    out.push(copy);
  }
  return { app: 'whiskey-tracker', version: 1, exportedAt: new Date().toISOString(), whiskeys: out };
}

// Merges: an incoming record replaces a local one with the same id only if it is newer.
export async function importAll(data) {
  if (!data || data.app !== 'whiskey-tracker' || !Array.isArray(data.whiskeys)) {
    throw new Error('That file is not a Whiskey Tracker backup.');
  }
  let added = 0, updated = 0, skipped = 0;
  for (const raw of data.whiskeys) {
    if (!raw || !raw.id) { skipped++; continue; }
    const existing = await get(raw.id);
    if (existing && (existing.updatedAt || 0) >= (raw.updatedAt || 0)) { skipped++; continue; }
    const item = { ...raw };
    if (typeof item.image === 'string' && item.image.startsWith('data:')) item.image = await dataUrlToBlob(item.image);
    if (typeof item.thumb === 'string' && item.thumb.startsWith('data:')) item.thumb = await dataUrlToBlob(item.thumb);
    await put(item);
    existing ? updated++ : added++;
  }
  return { added, updated, skipped };
}
