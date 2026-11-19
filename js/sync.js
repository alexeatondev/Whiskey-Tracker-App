// Automatic sync through the app's private AWS storage (S3), one folder per signed-in user.
//
// Layout in the user's folder (private/<identity id>/):
//   collection.json          all whiskey records (without photos) + deletion tombstones
//   photos/<photoId>.jpg     full photo
//   photos/<photoId>_t.jpg   thumbnail
//
// Merge rule: per whiskey, the version with the newer updatedAt wins. A deletion wins over any version
// that is older than the deletion. Photos are content-addressed by photoId, so they upload once.
import * as db from './db.js';
import * as od from './aws.js';

const STATE = 'wt.sync';
const COLLECTION = 'collection.json';
const PHOTOS = 'photos';

const listeners = new Set();
let running = null;
let timer = null;
let lastAttempt = 0;

function loadState() {
  try { return { enabled: false, ...JSON.parse(localStorage.getItem(STATE) || '{}') }; } catch { return { enabled: false }; }
}
function saveState(patch) {
  const s = { ...loadState(), ...patch };
  try { localStorage.setItem(STATE, JSON.stringify(s)); } catch { /* ignore */ }
  listeners.forEach((fn) => fn(status()));
  return s;
}

/** { enabled, configured, signedIn, account, lastSync, lastError, needsSignIn, busy } */
export function status() {
  const s = loadState();
  return {
    ...s,
    configured: od.isConfigured(),
    signedIn: od.isSignedIn(),
    account: od.account(),
    busy: Boolean(running),
  };
}

export const onStatus = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

const stripBlobs = (w) => {
  const { image, thumb, ...rest } = w;
  return rest;
};

const photoName = (id, thumb = false) => `${PHOTOS}/${id}${thumb ? '_t' : ''}.jpg`;

/**
 * Pure merge of local and remote state. Returns the merged collection plus the local writes/deletes needed.
 * Exported for tests.
 */
export function merge(localRecords, localDeleted, remote) {
  const deleted = { ...(remote.deleted || {}) };
  for (const [id, ts] of Object.entries(localDeleted || {})) deleted[id] = Math.max(deleted[id] || 0, ts);

  const L = new Map(localRecords.map((w) => [w.id, w]));
  const R = new Map(Object.entries(remote.records || {}));
  const records = {};
  const toWrite = [];   // remote versions to store locally
  const toDelete = [];  // local ids to remove

  for (const id of new Set([...L.keys(), ...R.keys()])) {
    const l = L.get(id), r = R.get(id);
    const lt = l ? l.updatedAt || l.createdAt || 0 : -1;
    const rt = r ? r.updatedAt || r.createdAt || 0 : -1;
    const winner = rt > lt ? r : l;
    const wt = Math.max(lt, rt);
    if (deleted[id] && deleted[id] >= wt) {
      if (l) toDelete.push(id);
      continue;
    }
    if (deleted[id]) delete deleted[id]; // edited after the deletion: the edit wins
    records[id] = stripBlobs(winner);
    if (winner === r && rt > lt) toWrite.push({ remote: r, local: l || null });
  }
  return { collection: { records, deleted }, toWrite, toDelete };
}

async function readRemote() {
  const meta = await od.getItem(COLLECTION);
  if (!meta) return { remote: { records: {}, deleted: {} }, eTag: null };
  const remote = (await od.download(COLLECTION, 'json')) || {};
  return { remote: { records: remote.records || {}, deleted: remote.deleted || {} }, eTag: meta.eTag };
}

async function syncOnce() {
  // Give every photo a stable id so it is uploaded once and recognised on other devices.
  let local = await db.getAll();
  for (const w of local) {
    if ((w.image || w.thumb) && !w.photoId) {
      w.photoId = `${w.id}-${w.updatedAt || w.createdAt || Date.now()}`;
      await db.put(w, { silent: true });
    }
  }
  local = await db.getAll();

  const { remote, eTag } = await readRemote();
  const { collection, toWrite, toDelete } = merge(local, db.getTombstones(), remote);
  const remotePhotos = await od.listNames(PHOTOS);

  // Upload photos the cloud doesn't have yet.
  for (const w of local) {
    if (!w.photoId || !collection.records[w.id] || collection.records[w.id].photoId !== w.photoId) continue;
    if (w.image && !remotePhotos.has(`${w.photoId}.jpg`)) await od.upload(photoName(w.photoId), w.image, { contentType: 'image/jpeg' });
    if (w.thumb && !remotePhotos.has(`${w.photoId}_t.jpg`)) await od.upload(photoName(w.photoId, true), w.thumb, { contentType: 'image/jpeg' });
  }

  // Apply remote changes locally (downloading photos when they changed).
  let changed = 0;
  for (const { remote: r, local: l } of toWrite) {
    const rec = { ...r };
    if (l && l.photoId && l.photoId === r.photoId) {
      rec.image = l.image; rec.thumb = l.thumb;
    } else if (r.photoId) {
      rec.image = remotePhotos.has(`${r.photoId}.jpg`) ? await od.download(photoName(r.photoId)) : null;
      rec.thumb = remotePhotos.has(`${r.photoId}_t.jpg`) ? await od.download(photoName(r.photoId, true)) : rec.image;
    } else {
      rec.image = null; rec.thumb = null;
    }
    await db.put(rec, { silent: true });
    changed++;
  }
  for (const id of toDelete) { await db.remove(id, { silent: true }); changed++; }
  db.setTombstones(collection.deleted);

  // Push the merged collection if it differs from what's in the cloud.
  const body = JSON.stringify({ app: 'whiskey-tracker', schema: 2, updatedAt: Date.now(), ...collection });
  const same = JSON.stringify(collection.records) === JSON.stringify(remote.records)
    && JSON.stringify(collection.deleted) === JSON.stringify(remote.deleted);
  if (!same) {
    await od.upload(COLLECTION, body, { contentType: 'application/json', ifMatch: eTag || undefined, ifNone: !eTag });
  }
  return { changed, pushed: !same, count: Object.keys(collection.records).length };
}

/** Run a sync now. Resolves with { ok, changed } — never throws. */
export function syncNow() {
  if (running) return running;
  const s = loadState();
  if (!s.enabled || !od.isConfigured()) return Promise.resolve({ ok: false, skipped: true });
  lastAttempt = Date.now();
  saveState({});
  running = (async () => {
    try {
      let result;
      for (let attempt = 0; ; attempt++) {
        try { result = await syncOnce(); break; } catch (e) {
          if (e.conflict && attempt < 2) continue; // someone else wrote in between: merge again
          throw e;
        }
      }
      saveState({ lastSync: Date.now(), lastError: null, needsSignIn: false });
      return { ok: true, ...result };
    } catch (e) {
      console.error('Sync failed', e);
      const needsSignIn = e instanceof od.AuthRequired;
      saveState({ lastError: needsSignIn ? 'Sign in again to keep syncing.' : (navigator.onLine === false ? 'Offline — will sync when you reconnect.' : e.message), needsSignIn });
      return { ok: false, needsSignIn, error: e.message };
    } finally {
      running = null;
      listeners.forEach((fn) => fn(status()));
    }
  })();
  listeners.forEach((fn) => fn(status()));
  return running;
}

/** Debounced sync, used after local edits and when the app comes back to the foreground. */
export function schedule(delay = 3000) {
  if (!loadState().enabled) return;
  clearTimeout(timer);
  timer = setTimeout(() => { syncNow().then(afterSync); }, delay);
}

let afterSync = () => {};

/**
 * Startup: finish a sign-in redirect if there is one, wire up triggers, and run a first sync.
 * onRemoteChange is called after a sync that changed local data, so the UI can refresh.
 */
export async function init({ onRemoteChange = () => {}, onMessage = () => {} } = {}) {
  afterSync = (r) => { if (r && r.ok && r.changed) onRemoteChange(); };

  const r = await od.handleRedirect();
  if (r.handled) {
    if (r.ok) {
      saveState({ enabled: true, needsSignIn: false, lastError: null });
      onMessage('Signed in. Syncing…');
    } else {
      onMessage(`Sign-in didn't finish: ${r.error}`);
    }
  }

  db.onChange(() => schedule());
  window.addEventListener('online', () => schedule(500));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastAttempt > 30_000) schedule(500);
  });

  const s = loadState();
  if (!s.enabled || !od.isConfigured()) return;
  const result = await syncNow();
  afterSync(result);
}

export async function connect() {
  saveState({ enabled: true });
  await od.signIn();
}

export function disconnect() {
  od.signOut();
  saveState({ enabled: false, needsSignIn: false, lastError: null });
}
