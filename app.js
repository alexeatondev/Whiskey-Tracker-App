import * as db from './js/db.js';
import { processPhoto } from './js/image.js';
import { identifyWhiskey, ClaudeError, WHISKEY_TYPES, DEFAULT_MODEL } from './js/claude.js';
import { starsHTML, createStarInput, formatRating } from './js/stars.js';
import {
  STATUSES, statusLabel, BOTTLE_STATES, SERVES, FLAVOR_GROUPS, newTasting, todayISO, lastTasted,
  parseMoney, findDuplicates, toCSV,
} from './js/model.js';

// ---------- Settings (stored on this device only) ----------
const settings = {
  get apiKey() { return safeGet('wt.apiKey') || ''; },
  set apiKey(v) { safeSet('wt.apiKey', v); },
  get model() { return safeGet('wt.model') || DEFAULT_MODEL; },
  set model(v) { safeSet('wt.model', v); },
  get sort() { return safeGet('wt.sort') || 'recent'; },
  set sort(v) { safeSet('wt.sort', v); },
};
function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* ignore */ } }

// ---------- Fields (identity + notes) ----------
const FIELDS = [
  { key: 'name', label: 'Name', full: true, placeholder: 'e.g. Eagle Rare 10 Year' },
  { key: 'distillery', label: 'Distillery / Producer' },
  { key: 'type', label: 'Style', kind: 'select', options: WHISKEY_TYPES },
  { key: 'country', label: 'Country' },
  { key: 'region', label: 'Region' },
  { key: 'age', label: 'Age' },
  { key: 'abv', label: 'ABV' },
  { key: 'proof', label: 'Proof' },
  { key: 'approxPrice', label: 'Typical price' },
  { key: 'caskFinish', label: 'Cask / Finish' },
  { key: 'mashBill', label: 'Mash Bill' },
  { key: 'edition', label: 'Batch / Edition', full: true },
  { key: 'description', label: 'Description', kind: 'textarea', full: true },
  { key: 'nose', label: 'Nose', kind: 'textarea' },
  { key: 'palate', label: 'Palate', kind: 'textarea' },
  { key: 'finish', label: 'Finish', kind: 'textarea' },
  { key: 'myNotes', label: 'My Notes', kind: 'textarea', full: true, placeholder: 'Where you tried it, who with, what you thought…' },
];

// ---------- DOM helpers ----------
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
const money = (n) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

let objectUrls = [];
function blobUrl(blob) {
  if (!(blob instanceof Blob)) return '';
  const u = URL.createObjectURL(blob);
  objectUrls.push(u);
  return u;
}
function releaseUrls() { objectUrls.forEach((u) => URL.revokeObjectURL(u)); objectUrls = []; }

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function setChrome({ title = 'Whiskey Tracker', back = false, fab = true }) {
  $('#title').textContent = title;
  $('#backBtn').hidden = !back;
  document.body.classList.toggle('hide-fab', !fab);
  document.title = title === 'Whiskey Tracker' ? 'Whiskey Tracker' : `${title} · Whiskey Tracker`;
}

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

// Share sheet on iOS/iPadOS (so files can go to iCloud Drive), plain download elsewhere.
async function saveFile(name, blob, type) {
  const file = new File([blob], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document) {
    await navigator.share({ files: [file], title: name });
  } else {
    download(name, blob);
  }
}

// ---------- State ----------
// In-progress new entry: { image, thumb, base64, fields, rating, status, flavors, bottle, idState, dupes, dupesDismissed }
let draft = null;
const listState = { q: '', type: '', status: '', flavor: '' };

function newDraft(extra = {}) {
  return {
    fields: {}, rating: 0, status: 'tasted', flavors: [],
    bottle: { state: 'sealed', fill: 100, count: 1, pricePaid: '', purchasedAt: todayISO(), store: '' },
    ...extra,
  };
}

// ---------- Router ----------
function go(hash) { location.hash = hash; }
window.addEventListener('hashchange', route);
$('#backBtn').addEventListener('click', () => {
  if (history.length > 1) history.back(); else go('#/');
});
$('#settingsBtn').addEventListener('click', () => go('#/settings'));
$('#insightsBtn').addEventListener('click', () => go('#/insights'));
$('#addBtn').addEventListener('click', () => go('#/add'));

async function route() {
  releaseUrls();
  window.scrollTo(0, 0);
  const [, view, id, sub] = (location.hash || '#/').split('/');
  try {
    if (view === 'add') return renderAdd();
    if (view === 'new') return renderEdit(null);
    if (view === 'edit' && id) return renderEdit(await db.get(id));
    if (view === 'w' && id) return renderDetail(await db.get(id), { openTasting: sub === 'taste' });
    if (view === 'insights') return renderInsights();
    if (view === 'settings') return renderSettings();
    return renderList();
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="status error">Something went wrong: ${esc(err.message)}</div>`;
  }
}

// ---------- List ----------
function sortItems(items, mode) {
  const byName = (a, b) => (a.name || '').localeCompare(b.name || '');
  const by = {
    recent: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0) || byName(a, b),
    tasted: (a, b) => lastTasted(b).localeCompare(lastTasted(a)) || (b.createdAt || 0) - (a.createdAt || 0),
    name: byName,
    distillery: (a, b) => (a.distillery || '').localeCompare(b.distillery || '') || byName(a, b),
    paid: (a, b) => (parseMoney(b.bottle.pricePaid) || 0) - (parseMoney(a.bottle.pricePaid) || 0) || byName(a, b),
  };
  return items.sort(by[mode] || by.recent);
}

function cardBadge(w) {
  if (w.status === 'wishlist') return '<span class="badge wish">Wishlist</span>';
  if (w.status !== 'shelf') return '';
  if (w.bottle.state === 'finished') return '<span class="badge done">Finished</span>';
  const count = w.bottle.count > 1 ? ` ×${w.bottle.count}` : '';
  if (w.bottle.state === 'open') return `<span class="badge shelf">Open · ${w.bottle.fill}%${count}</span>`;
  return `<span class="badge shelf">Sealed${count}</span>`;
}

async function renderList() {
  setChrome({});
  const all = await db.getAll();

  if (!all.length) {
    app.innerHTML = `
      <div class="empty">
        <div class="big">🥃</div>
        <h2>Your shelf is empty</h2>
        <p>Tap <strong>Add Whiskey</strong> and snap a photo of a bottle.<br>The details will be filled in for you.</p>
        ${settings.apiKey ? '' : '<p class="hint">Tip: add your Anthropic API key in <a href="#/settings">Settings</a> to turn on automatic label recognition.</p>'}
      </div>`;
    return;
  }

  const types = [...new Set(all.map((w) => w.type).filter(Boolean))].sort();
  const flavors = FLAVOR_GROUPS.flatMap((g) => g.tags).filter((f) => all.some((w) => w.flavors.includes(f)));
  const counts = Object.fromEntries(STATUSES.map((s) => [s.key, all.filter((w) => w.status === s.key).length]));
  const tab = (key, label, n) => `<button type="button" class="seg-btn" role="tab" data-status="${key}" aria-selected="${listState.status === key}">${label}<span class="n">${n}</span></button>`;

  app.innerHTML = `
    <div class="seg tabs" role="tablist" aria-label="Show">
      ${tab('', 'All', all.length)}${STATUSES.map((s) => tab(s.key, s.short, counts[s.key])).join('')}
    </div>
    <div class="toolbar">
      <input type="search" id="q" placeholder="Search name, distillery, notes…" value="${esc(listState.q)}" aria-label="Search">
      <select id="typeFilter" aria-label="Filter by style">
        <option value="">All styles</option>
        ${types.map((t) => `<option ${t === listState.type ? 'selected' : ''}>${esc(t)}</option>`).join('')}
      </select>
      ${flavors.length ? `<select id="flavorFilter" aria-label="Filter by flavor">
        <option value="">Any flavor</option>
        ${flavors.map((f) => `<option ${f === listState.flavor ? 'selected' : ''}>${esc(f)}</option>`).join('')}
      </select>` : ''}
      <select id="sort" aria-label="Sort">
        ${[['recent', 'Newest'], ['rating', 'Top rated'], ['tasted', 'Recently tasted'], ['name', 'Name A–Z'], ['distillery', 'Distillery'], ['paid', 'Price paid']]
          .map(([v, l]) => `<option value="${v}" ${v === settings.sort ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
    </div>
    <p class="stats" id="stats"></p>
    <div class="grid" id="grid"></div>`;

  const grid = $('#grid');
  const draw = () => {
    releaseUrls();
    const q = listState.q.trim().toLowerCase();
    let items = all.filter((w) => (!listState.type || w.type === listState.type)
      && (!listState.status || w.status === listState.status)
      && (!listState.flavor || w.flavors.includes(listState.flavor)));
    if (q) {
      items = items.filter((w) => [w.name, w.distillery, w.type, w.region, w.country, w.nose, w.palate, w.finish, w.myNotes, w.edition,
        w.bottle.store, w.flavors.join(' '), ...w.tastings.map((t) => `${t.location} ${t.notes}`)]
        .some((v) => (v || '').toLowerCase().includes(q)));
    }
    sortItems(items, settings.sort);
    const rated = items.filter((w) => w.rating);
    const avg = rated.length ? (rated.reduce((s, w) => s + w.rating, 0) / rated.length).toFixed(1) : null;
    $('#stats').textContent = `${items.length} of ${all.length} whiskeys${avg ? ` · average rating ${avg}` : ''}`;
    grid.innerHTML = items.length ? items.map((w) => `
      <button class="card" data-id="${esc(w.id)}">
        <div class="media">
          ${w.thumb || w.image ? `<img class="thumb" src="${blobUrl(w.thumb || w.image)}" alt="" loading="lazy">` : '<div class="noimg">🥃</div>'}
          ${cardBadge(w)}
        </div>
        <div class="body">
          <div class="name">${esc(w.name || 'Unnamed whiskey')}</div>
          <div class="sub">${esc([w.distillery, w.age].filter(Boolean).join(' · ') || w.type || '')}</div>
          ${w.status === 'wishlist' && !w.rating ? '<div class="sub">Not tried yet</div>' : starsHTML(w.rating, 16)}
        </div>
      </button>`).join('') : '<p class="stats">No matches.</p>';
  };
  draw();

  $('#q').addEventListener('input', (e) => { listState.q = e.target.value; draw(); });
  $('#typeFilter').addEventListener('change', (e) => { listState.type = e.target.value; draw(); });
  $('#flavorFilter')?.addEventListener('change', (e) => { listState.flavor = e.target.value; draw(); });
  $('#sort').addEventListener('change', (e) => { settings.sort = e.target.value; draw(); });
  $('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-status]');
    if (!b) return;
    listState.status = b.dataset.status;
    $$('.tabs .seg-btn').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    draw();
  });
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (card) go(`#/w/${card.dataset.id}`);
  });
}

// ---------- Add (capture + identify) ----------
const CAMERA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
const PHOTO_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';

function renderAdd() {
  setChrome({ title: 'Add Whiskey', back: true, fab: false });
  app.innerHTML = `
    <div class="capture">
      <div class="panel">
        <h2>Snap the bottle</h2>
        <p class="hint" style="margin:0 0 14px">Get the front label in frame and in focus. ${settings.apiKey
          ? 'The details will be read from the label automatically.'
          : 'Automatic recognition is off until you add an API key in <a href="#/settings">Settings</a> — you can still save the photo and type the details.'}</p>
        <div class="btn-row">
          <button class="btn primary" id="takePhoto">${CAMERA_ICON}Take Photo</button>
          <button class="btn" id="choosePhoto">${PHOTO_ICON}Choose Photo</button>
        </div>
      </div>
      <button class="btn" id="manual">Skip photo — enter details manually</button>
    </div>`;
  $('#takePhoto').addEventListener('click', () => pickFile('#cameraInput'));
  $('#choosePhoto').addEventListener('click', () => pickFile('#libraryInput'));
  $('#manual').addEventListener('click', () => {
    draft = newDraft();
    go('#/new');
  });
}

function pickFile(sel) {
  const input = $(sel);
  input.value = '';
  input.click();
}

for (const sel of ['#cameraInput', '#libraryInput']) {
  $(sel).addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) await handlePhoto(file);
  });
}

async function handlePhoto(file) {
  setChrome({ title: 'Add Whiskey', back: true, fab: false });
  app.innerHTML = `<div class="capture"><div class="status"><div class="spinner"></div>Preparing photo…</div></div>`;
  let processed;
  try {
    processed = await processPhoto(file);
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="capture"><div class="status error">Couldn't read that image. Try another photo.</div>
      <button class="btn" onclick="location.hash='#/add'">Try again</button></div>`;
    return;
  }
  draft = newDraft(processed);
  go('#/new');
  if (settings.apiKey) runIdentify();
}

async function runIdentify() {
  const current = draft;
  if (!current || !current.base64) return;
  current.idState = { state: 'working' };
  updateIdentifyStatus();
  try {
    const result = await identifyWhiskey({ apiKey: settings.apiKey, model: settings.model, base64: current.base64 });
    if (draft !== current) return; // user moved on
    if (!result.isWhiskey) {
      current.idState = { state: 'error', msg: "That doesn't look like a whiskey label. You can still fill in the details below." };
    } else {
      const fields = {};
      for (const f of FIELDS) if (typeof result[f.key] === 'string') fields[f.key] = result[f.key].trim();
      // Don't clobber anything the user already typed while waiting.
      const form = $('#editForm');
      if (form) {
        for (const f of FIELDS) {
          const el = form.elements[f.key];
          if (el && !el.value.trim() && fields[f.key]) el.value = fields[f.key];
          else if (el && el.value.trim()) fields[f.key] = el.value;
        }
      }
      current.fields = { ...current.fields, ...fields };
      // Suggested flavor tags, only if the user hasn't picked any yet.
      if (!current.flavors.length && Array.isArray(result.flavors)) {
        current.flavors = result.flavors.slice(0, 6);
        current.flavorsSuggested = true;
        syncFlavorChips();
      }
      current.idState = {
        state: 'done',
        msg: result.confidence === 'low'
          ? 'Filled in, but I\'m not confident about this one — please double-check the details.'
          : 'Details filled in from the label. Review, rate, and save.',
      };
      await checkDuplicates();
    }
  } catch (err) {
    console.error(err);
    if (draft !== current) return;
    current.idState = { state: 'error', msg: err instanceof ClaudeError ? err.message : 'Recognition failed. You can fill in the details by hand.' };
  }
  updateIdentifyStatus();
}

function updateIdentifyStatus() {
  const box = $('#identifyStatus');
  if (!box || !draft) return;
  const s = draft.idState;
  if (!s) { box.hidden = true; return; }
  box.hidden = false;
  box.className = `status${s.state === 'error' ? ' error' : ''}`;
  box.innerHTML = s.state === 'working'
    ? '<div class="spinner"></div>Reading the label…'
    : `${esc(s.msg)}${s.state === 'error' && draft.base64 && settings.apiKey ? ' <button type="button" class="btn" id="retryId" style="padding:6px 10px;margin-left:auto">Retry</button>' : ''}`;
  const retry = $('#retryId');
  if (retry) retry.addEventListener('click', runIdentify);
}

// Look for an existing entry that is probably the same whiskey, and offer to use it instead.
async function checkDuplicates() {
  const current = draft;
  if (!current || current.dupesDismissed) return;
  const form = $('#editForm');
  const name = form ? form.elements.name.value : current.fields.name;
  const distillery = form ? form.elements.distillery.value : current.fields.distillery;
  if (!name) { current.dupes = []; renderDupeBanner(); return; }
  const all = await db.getAll();
  if (draft !== current) return;
  current.dupes = findDuplicates(all, { name, distillery }).slice(0, 2);
  renderDupeBanner();
}

function renderDupeBanner() {
  const box = $('#dupeBanner');
  if (!box || !draft) return;
  const d = draft.dupes || [];
  if (!d.length || draft.dupesDismissed) { box.hidden = true; box.innerHTML = ''; return; }
  const w = d[0];
  const what = w.status === 'wishlist'
    ? 'is on your wishlist'
    : w.status === 'shelf' ? `is on your shelf${w.rating ? ` (rated ${formatRating(w.rating)})` : ''}`
      : w.rating ? `was rated ${formatRating(w.rating)}${lastTasted(w) ? ` on ${fmtDate(lastTasted(w))}` : ''}` : 'is already in your collection';
  box.hidden = false;
  box.innerHTML = `
    <div><strong>Already have this?</strong> <em>${esc(w.name)}</em> ${what}.</div>
    <div class="btn-row">
      <button type="button" class="btn primary" data-dupe="taste">Log a tasting there</button>
      <button type="button" class="btn" data-dupe="open">Open it</button>
      <button type="button" class="btn" data-dupe="dismiss">It's different — keep new</button>
    </div>`;
  box.onclick = (e) => {
    const act = e.target.closest('[data-dupe]')?.dataset.dupe;
    if (!act) return;
    if (act === 'dismiss') { draft.dupesDismissed = true; renderDupeBanner(); return; }
    draft = null;
    history.replaceState(null, '', '#/');
    go(act === 'taste' ? `#/w/${w.id}/taste` : `#/w/${w.id}`);
  };
}

// ---------- Shared form pieces ----------
function segHTML(name, options, value) {
  return `<div class="seg" role="radiogroup">${options.map((o) => `
    <label class="seg-btn"><input type="radio" name="${name}" value="${esc(o.key)}" ${o.key === value ? 'checked' : ''}>${esc(o.label)}</label>`).join('')}</div>`;
}

function flavorPickerHTML(selected) {
  return FLAVOR_GROUPS.map((g) => `
    <div class="flavor-group">
      <div class="flavor-group-name">${esc(g.group)}</div>
      <div class="chips">${g.tags.map((t) => `<button type="button" class="chip toggle" data-flavor="${esc(t)}" aria-pressed="${selected.includes(t)}">${esc(t)}</button>`).join('')}</div>
    </div>`).join('');
}

function syncFlavorChips() {
  if (!draft) return;
  $$('[data-flavor]').forEach((b) => b.setAttribute('aria-pressed', String(draft.flavors.includes(b.dataset.flavor))));
  const hint = $('#flavorHint');
  if (hint) hint.textContent = draft.flavorsSuggested ? 'Suggested from the label read — tap to adjust.' : 'Tap what you taste.';
}

function bottleFieldsHTML(b) {
  return `
    <div class="form-grid">
      <div class="field full"><label>Bottle</label>${segHTML('b_state', BOTTLE_STATES, b.state)}</div>
      <div class="field full" id="fillField" ${b.state === 'open' ? '' : 'hidden'}>
        <label for="b_fill">How full? <span id="fillVal">${b.fill}%</span></label>
        <input type="range" id="b_fill" name="b_fill" min="0" max="100" step="5" value="${b.fill}">
      </div>
      <div class="field"><label for="b_count">Bottles</label><input type="number" id="b_count" name="b_count" min="0" step="1" value="${esc(b.count)}" inputmode="numeric"></div>
      <div class="field"><label for="b_price">Price paid</label><input id="b_price" name="b_price" value="${esc(b.pricePaid)}" placeholder="$" inputmode="decimal" autocomplete="off"></div>
      <div class="field"><label for="b_date">Purchased</label><input type="date" id="b_date" name="b_date" value="${esc(b.purchasedAt)}"></div>
      <div class="field"><label for="b_store">Store</label><input id="b_store" name="b_store" value="${esc(b.store)}" autocomplete="off"></div>
    </div>`;
}

function wireBottleFields(root) {
  const fillField = $('#fillField', root);
  root.addEventListener('change', (e) => {
    if (e.target.name === 'b_state') fillField.hidden = e.target.value !== 'open';
  });
  $('#b_fill', root).addEventListener('input', (e) => { $('#fillVal', root).textContent = `${e.target.value}%`; });
}

function readBottleFields(form, prev) {
  const state = form.elements.b_state.value || prev.state;
  return {
    ...prev,
    state,
    fill: state === 'finished' ? 0 : Number(form.elements.b_fill.value),
    count: Math.max(0, Math.round(Number(form.elements.b_count.value) || 0)),
    pricePaid: form.elements.b_price.value.trim(),
    purchasedAt: form.elements.b_date.value,
    store: form.elements.b_store.value.trim(),
  };
}

// ---------- Edit form (new or existing) ----------
function renderEdit(existing) {
  const isNew = !existing;
  if (isNew && !draft) { go('#/add'); return; }
  const src = isNew
    ? { ...draft.fields, rating: draft.rating, image: draft.image, status: draft.status, flavors: draft.flavors, bottle: draft.bottle }
    : existing;
  setChrome({ title: isNew ? 'New Whiskey' : 'Edit Whiskey', back: true, fab: false });

  const fieldHTML = (f) => {
    const v = src[f.key] ?? '';
    let control;
    if (f.kind === 'select') {
      const opts = f.options.includes(v) || !v ? f.options : [v, ...f.options];
      control = `<select id="f_${f.key}" name="${f.key}"><option value="">—</option>${opts.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    } else if (f.kind === 'textarea') {
      control = `<textarea id="f_${f.key}" name="${f.key}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
    } else {
      control = `<input id="f_${f.key}" name="${f.key}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" autocomplete="off">`;
    }
    return `<div class="field${f.full ? ' full' : ''}"><label for="f_${f.key}">${esc(f.label)}</label>${control}</div>`;
  };

  // For a new entry the selected flavors live on the draft, so a label read that finishes later can fill them in.
  const fl = isNew ? draft : { flavors: [...src.flavors] };
  app.innerHTML = `
    <div class="edit-layout">
      <div class="side">
        ${src.image ? `<img src="${blobUrl(src.image)}" alt="Bottle photo">` : ''}
        <div class="btn-row" style="margin-top:10px">
          <button type="button" class="btn" id="replacePhoto">${CAMERA_ICON}${src.image ? 'Replace photo' : 'Add photo'}</button>
        </div>
      </div>
      <form id="editForm" class="main" autocomplete="off">
        <div id="identifyStatus" class="status" hidden style="margin-bottom:16px"></div>
        <div id="dupeBanner" class="dupe" hidden></div>
        <div class="panel">
          <h2>Where does it go?</h2>
          ${segHTML('status', STATUSES, src.status)}
        </div>
        <div class="panel" id="ratingPanel" ${src.status === 'wishlist' ? 'hidden' : ''}>
          <h2>Your rating</h2>
          <div id="ratingMount"></div>
          <p class="hint">Tap the left half of a star for a half star.</p>
        </div>
        <div class="panel" id="bottlePanel" ${src.status === 'shelf' ? '' : 'hidden'}>
          <h2>Your bottle</h2>
          ${bottleFieldsHTML(src.bottle)}
        </div>
        <div class="panel">
          <h2>Flavors</h2>
          <p class="hint" id="flavorHint" style="margin:0 0 10px">${isNew && draft.flavorsSuggested ? 'Suggested from the label read — tap to adjust.' : 'Tap what you taste.'}</p>
          <div id="flavorPicker">${flavorPickerHTML(fl.flavors)}</div>
        </div>
        <div class="panel">
          <h2>Details</h2>
          <div class="form-grid">${FIELDS.map(fieldHTML).join('')}</div>
        </div>
        <div class="btn-row">
          <button type="button" class="btn" id="cancelBtn">Cancel</button>
          <button type="submit" class="btn primary">Save</button>
        </div>
      </form>
    </div>`;

  const form = $('#editForm');
  let rating = src.rating || 0;
  $('#ratingMount').appendChild(createStarInput(rating, (v) => { rating = v; if (isNew) draft.rating = v; }));
  wireBottleFields($('#bottlePanel'));

  form.addEventListener('change', (e) => {
    if (e.target.name === 'status') {
      $('#ratingPanel').hidden = e.target.value === 'wishlist';
      $('#bottlePanel').hidden = e.target.value !== 'shelf';
      if (isNew) draft.status = e.target.value;
    }
    if (isNew && e.target.name === 'name') checkDuplicates();
  });

  $('#flavorPicker').addEventListener('click', (e) => {
    const b = e.target.closest('[data-flavor]');
    if (!b) return;
    const f = b.dataset.flavor;
    fl.flavors = fl.flavors.includes(f) ? fl.flavors.filter((x) => x !== f) : [...fl.flavors, f];
    b.setAttribute('aria-pressed', String(fl.flavors.includes(f)));
    if (isNew) draft.flavorsSuggested = false;
  });

  let newPhoto = null;
  $('#replacePhoto').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        newPhoto = await processPhoto(file);
        if (isNew) Object.assign(draft, newPhoto);
        const side = $('.side');
        let img = $('img', side);
        if (!img) { img = document.createElement('img'); img.alt = 'Bottle photo'; side.prepend(img); }
        img.src = blobUrl(newPhoto.image);
        if (isNew && settings.apiKey) {
          const ok = confirm('Read the details from this new photo? Empty fields will be filled in.');
          if (ok) runIdentify();
        }
      } catch { toast("Couldn't read that image."); }
    });
    input.click();
  });

  if (isNew) {
    // Keep typed values in the draft so a re-render (e.g. returning from settings) doesn't lose them.
    form.addEventListener('input', (e) => { if (FIELDS.some((f) => f.key === e.target.name)) draft.fields[e.target.name] = e.target.value; });
    updateIdentifyStatus();
    renderDupeBanner();
  }

  $('#cancelBtn').addEventListener('click', () => {
    if (isNew) { draft = null; go('#/'); } else go(`#/w/${existing.id}`);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {};
    for (const f of FIELDS) data[f.key] = (form.elements[f.key].value || '').trim();
    if (!data.name) {
      toast('Give it a name before saving.');
      form.elements.name.focus();
      return;
    }
    const status = form.elements.status.value || 'tasted';
    const now = Date.now();
    const record = isNew
      ? { id: db.newId(), createdAt: now, image: draft.image || null, thumb: draft.thumb || null, tastings: [] }
      : { ...existing };
    Object.assign(record, data, {
      status,
      rating: status === 'wishlist' ? (isNew ? 0 : record.rating) : rating,
      flavors: fl.flavors,
      bottle: readBottleFields(form, record.bottle || src.bottle),
      updatedAt: now,
    });
    // A new entry rated on the spot starts its tasting log with today's tasting.
    if (isNew && status !== 'wishlist' && rating) record.tastings = [newTasting({ rating })];
    if (newPhoto) { record.image = newPhoto.image; record.thumb = newPhoto.thumb; }
    try {
      await db.put(record);
    } catch (err) {
      console.error(err);
      toast('Could not save — storage may be full.');
      return;
    }
    draft = null;
    toast(isNew ? `Added to ${status === 'wishlist' ? 'your wishlist' : status === 'shelf' ? 'your shelf' : 'your collection'}` : 'Saved');
    if (isNew) {
      history.replaceState(null, '', '#/');
      go(`#/w/${record.id}`);
    } else {
      location.replace(`#/w/${record.id}`);
    }
  });
}

// ---------- Detail ----------
function renderDetail(w, { openTasting = false } = {}) {
  if (!w) { go('#/'); return; }
  setChrome({ title: w.name || 'Whiskey', back: true, fab: false });
  const fact = (label, v) => (v ? `<div><dt>${esc(label)}</dt><dd>${esc(v)}</dd></div>` : '');
  const note = (label, v) => (v ? `<h3>${esc(label)}</h3><p>${esc(v)}</p>` : '');
  const facts = [
    fact('Age', w.age), fact('ABV', w.abv), fact('Proof', w.proof), fact('Region', w.region),
    fact('Country', w.country), fact('Cask / Finish', w.caskFinish), fact('Mash Bill', w.mashBill),
    fact('Batch / Edition', w.edition), fact('Typical price', w.approxPrice),
  ].join('');
  const tasting = note('Nose', w.nose) + note('Palate', w.palate) + note('Finish', w.finish);
  const tastings = [...w.tastings].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const b = w.bottle;

  const statusActions = {
    wishlist: '<button class="btn primary" data-act="gotit">I bought it</button><button class="btn" data-act="tried">I tried it</button>',
    tasted: '<button class="btn" data-act="gotit">I own a bottle</button>',
    shelf: '',
  }[w.status];

  app.innerHTML = `
    <article class="detail">
      <div>${w.image ? `<img class="hero" id="hero" src="${blobUrl(w.image)}" alt="Photo of ${esc(w.name)}">` : ''}</div>
      <div>
        <div class="panel">
          <h2 class="name">${esc(w.name || 'Unnamed whiskey')}</h2>
          ${w.distillery ? `<p class="producer">${esc(w.distillery)}</p>` : ''}
          <div id="ratingMount"></div>
          <div class="chips">
            <span class="chip status-${esc(w.status)}">${esc(statusLabel(w.status))}</span>
            ${w.type ? `<span class="chip">${esc(w.type)}</span>` : ''}
          </div>
          ${w.flavors.length ? `<div class="chips">${w.flavors.map((f) => `<span class="chip flavor">${esc(f)}</span>`).join('')}</div>` : ''}
          ${statusActions ? `<div class="btn-row" style="margin-top:12px">${statusActions}</div>` : ''}
        </div>

        ${w.status === 'shelf' ? `
        <div class="panel">
          <h2>Your bottle</h2>
          <div class="seg" role="radiogroup" aria-label="Bottle state" id="bottleState">
            ${BOTTLE_STATES.map((s) => `<label class="seg-btn"><input type="radio" name="d_state" value="${s.key}" ${s.key === b.state ? 'checked' : ''}>${s.label}</label>`).join('')}
          </div>
          <div class="fill-row" id="fillRow" ${b.state === 'open' ? '' : 'hidden'}>
            <div class="fill-bar" aria-hidden="true"><span style="width:${b.fill}%"></span></div>
            <input type="range" id="d_fill" min="0" max="100" step="5" value="${b.fill}" aria-label="How full">
            <span class="fill-val" id="d_fillVal">${b.fill}%</span>
          </div>
          <dl class="facts" style="margin-top:12px">
            ${fact('Bottles', String(b.count))}${fact('Price paid', b.pricePaid)}${fact('Purchased', fmtDate(b.purchasedAt))}${fact('Store', b.store)}
          </dl>
        </div>` : ''}

        <div class="panel">
          <div class="panel-head">
            <h2>Tasting log</h2>
            <button class="btn" id="addTasting">+ Log a tasting</button>
          </div>
          <form id="tastingForm" class="tasting-form" hidden autocomplete="off">
            <div id="tRatingMount"></div>
            <div class="form-grid">
              <div class="field"><label for="t_date">Date</label><input type="date" id="t_date" name="date" value="${todayISO()}"></div>
              <div class="field"><label for="t_serve">Served</label><select id="t_serve" name="serve"><option value="">—</option>${SERVES.map((s) => `<option>${esc(s)}</option>`).join('')}</select></div>
              <div class="field full"><label for="t_loc">Where / with whom</label><input id="t_loc" name="location" placeholder="e.g. Home, Bourbon Trail, Mike's bar"></div>
              <div class="field full"><label for="t_notes">Notes</label><textarea id="t_notes" name="notes" placeholder="What stood out this time?"></textarea></div>
            </div>
            <div class="btn-row" style="margin-top:12px">
              <button type="button" class="btn" id="cancelTasting">Cancel</button>
              <button type="submit" class="btn primary">Save tasting</button>
            </div>
          </form>
          ${tastings.length ? `<ul class="tastings">${tastings.map((t) => `
            <li>
              <div class="t-head">
                <strong>${esc(fmtDate(t.date))}</strong>
                ${t.rating ? starsHTML(t.rating, 14) : ''}
                <button class="icon-btn small" data-del-tasting="${esc(t.id)}" aria-label="Delete tasting from ${esc(fmtDate(t.date))}">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
                </button>
              </div>
              ${t.serve || t.location ? `<div class="t-meta">${esc([t.serve, t.location].filter(Boolean).join(' · '))}</div>` : ''}
              ${t.notes ? `<p>${esc(t.notes)}</p>` : ''}
            </li>`).join('')}</ul>` : `<p class="hint" id="noTastings">${w.status === 'wishlist' ? 'Not tried yet.' : 'No tastings logged yet.'}</p>`}
        </div>

        ${facts ? `<div class="panel"><dl class="facts">${facts}</dl></div>` : ''}
        ${w.description || tasting ? `<div class="panel notes"><p class="hint" style="margin:0 0 8px">Typical notes for this whiskey</p>${w.description ? `<p>${esc(w.description)}</p>` : ''}${tasting}</div>` : ''}
        ${w.myNotes ? `<div class="panel notes"><h3 style="margin-top:0">My Notes</h3><p>${esc(w.myNotes)}</p></div>` : ''}
        <div class="btn-row">
          <a class="btn" href="#/edit/${esc(w.id)}">Edit</a>
          <button class="btn danger" id="deleteBtn">Delete</button>
        </div>
        <p class="meta">Added ${new Date(w.createdAt).toLocaleDateString()}${w.updatedAt && w.updatedAt !== w.createdAt ? ` · updated ${new Date(w.updatedAt).toLocaleDateString()}` : ''}</p>
      </div>
    </article>`;

  const save = async (msg) => { w.updatedAt = Date.now(); await db.put(w); if (msg) toast(msg); };
  const rerender = (opts) => { releaseUrls(); renderDetail(w, opts); };

  // Overall rating can be changed right from the detail page (hidden for untried wishlist items).
  if (w.status !== 'wishlist' || w.rating) {
    $('#ratingMount').appendChild(createStarInput(w.rating, async (v) => {
      w.rating = v;
      await save(v ? `Rated ${v} / 5` : 'Rating cleared');
    }, 32));
  }

  // Status quick actions
  app.querySelectorAll('[data-act]').forEach((btn) => btn.addEventListener('click', async () => {
    if (btn.dataset.act === 'gotit') {
      w.status = 'shelf';
      w.bottle = { ...w.bottle, state: 'sealed', fill: 100, count: Math.max(1, w.bottle.count), purchasedAt: w.bottle.purchasedAt || todayISO() };
      await save('Moved to your shelf');
      go(`#/edit/${w.id}`); // let them add price paid / store right away
    } else if (btn.dataset.act === 'tried') {
      rerender({ openTasting: true });
    }
  }));

  // Bottle state + fill
  const stateGroup = $('#bottleState');
  if (stateGroup) {
    stateGroup.addEventListener('change', async (e) => {
      w.bottle.state = e.target.value;
      if (w.bottle.state === 'open' && w.bottle.fill === 0) w.bottle.fill = 100;
      if (w.bottle.state === 'finished') w.bottle.fill = 0;
      $('#fillRow').hidden = w.bottle.state !== 'open';
      await save(w.bottle.state === 'finished' ? 'Marked finished — cheers' : 'Saved');
    });
    const fill = $('#d_fill');
    fill.addEventListener('input', () => {
      $('#d_fillVal').textContent = `${fill.value}%`;
      $('.fill-bar span').style.width = `${fill.value}%`;
    });
    fill.addEventListener('change', async () => { w.bottle.fill = Number(fill.value); await save(); });
  }

  // Tasting log
  const tForm = $('#tastingForm');
  let tRating = 0;
  $('#tRatingMount').appendChild(createStarInput(0, (v) => { tRating = v; }, 32));
  const openForm = () => {
    tForm.hidden = false; $('#addTasting').hidden = true;
    tForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  $('#addTasting').addEventListener('click', openForm);
  $('#cancelTasting').addEventListener('click', () => { tForm.hidden = true; $('#addTasting').hidden = false; });
  tForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = newTasting({
      date: tForm.elements.date.value || todayISO(),
      rating: tRating,
      serve: tForm.elements.serve.value,
      location: tForm.elements.location.value.trim(),
      notes: tForm.elements.notes.value.trim(),
    });
    if (!t.rating && !t.notes) { toast('Add a rating or a note.'); return; }
    w.tastings = [...w.tastings, t];
    if (w.status === 'wishlist') w.status = 'tasted';
    if (!w.rating && t.rating) w.rating = t.rating;
    await save('Tasting logged');
    history.replaceState(null, '', `#/w/${w.id}`);
    rerender();
  });
  $$('[data-del-tasting]').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm('Delete this tasting?')) return;
    w.tastings = w.tastings.filter((t) => t.id !== btn.dataset.delTasting);
    await save('Tasting deleted');
    rerender();
  }));
  if (openTasting) openForm();

  const hero = $('#hero');
  if (hero) hero.addEventListener('click', () => {
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = `<img src="${hero.src}" alt="">`;
    lb.addEventListener('click', () => lb.remove());
    document.body.appendChild(lb);
  });

  $('#deleteBtn').addEventListener('click', async () => {
    if (!confirm(`Delete "${w.name}"? This can't be undone.`)) return;
    await db.remove(w.id);
    toast('Deleted');
    history.replaceState(null, '', '#/');
    route();
  });
}

// ---------- Insights ----------
function barList(rows, { max, value, label, sub, title }) {
  const top = max ?? Math.max(1, ...rows.map(value));
  return `<ul class="bars">${rows.map((r) => `
    <li title="${esc(title ? title(r) : '')}">
      <div class="bar-label"><span>${esc(label(r))}</span><span class="bar-val">${esc(sub(r))}</span></div>
      <div class="bar-track"><span style="width:${Math.max(2, (value(r) / top) * 100)}%"></span></div>
    </li>`).join('')}</ul>`;
}

async function renderInsights() {
  setChrome({ title: 'Insights', back: true, fab: false });
  const all = await db.getAll();
  if (!all.length) {
    app.innerHTML = '<div class="empty"><div class="big">📊</div><h2>Nothing to analyze yet</h2><p>Add a few whiskeys and rate them — your insights will show up here.</p></div>';
    return;
  }
  const rated = all.filter((w) => w.rating && w.status !== 'wishlist');
  const avg = (xs) => (xs.length ? xs.reduce((s, w) => s + w.rating, 0) / xs.length : 0);
  const shelf = all.filter((w) => w.status === 'shelf');
  const onShelf = shelf.filter((w) => w.bottle.state !== 'finished');
  const bottles = onShelf.reduce((s, w) => s + (w.bottle.count || 0), 0);
  const open = onShelf.filter((w) => w.bottle.state === 'open');
  const spent = shelf.reduce((s, w) => { const p = parseMoney(w.bottle.pricePaid); return s + (Number.isFinite(p) ? p : 0); }, 0);
  const tastingCount = all.reduce((s, w) => s + w.tastings.length, 0);

  // Ratings by style
  const byType = {};
  for (const w of rated) (byType[w.type || 'Unspecified'] ||= []).push(w);
  const typeRows = Object.entries(byType).map(([type, ws]) => ({ type, n: ws.length, avg: avg(ws) }))
    .sort((a, b) => b.avg - a.avg || b.n - a.n);

  // Flavors in favorites vs. least favorites
  const flavorCounts = (ws) => {
    const m = {};
    for (const w of ws) for (const f of w.flavors) m[f] = (m[f] || 0) + 1;
    return Object.entries(m).map(([f, n]) => ({ f, n })).sort((a, b) => b.n - a.n).slice(0, 8);
  };
  const favs = rated.filter((w) => w.rating >= 4);
  const lows = rated.filter((w) => w.rating <= 2.5);
  const favFlavors = flavorCounts(favs);
  const lowFlavors = flavorCounts(lows);

  // Distilleries
  const byDist = {};
  for (const w of all) if (w.distillery) (byDist[w.distillery] ||= []).push(w);
  const distRows = Object.entries(byDist).map(([d, ws]) => ({ d, n: ws.length, avg: avg(ws.filter((w) => w.rating)) }))
    .sort((a, b) => b.n - a.n || b.avg - a.avg).slice(0, 8);

  const topRated = [...rated].sort((a, b) => b.rating - a.rating || lastTasted(b).localeCompare(lastTasted(a))).slice(0, 5);
  const stat = (n, l) => `<div class="tile"><div class="tile-n">${n}</div><div class="tile-l">${l}</div></div>`;

  app.innerHTML = `
    <div class="insights">
      <div class="tiles">
        ${stat(all.length, 'whiskeys')}
        ${stat(rated.length ? avg(rated).toFixed(1) : '–', 'average rating')}
        ${stat(tastingCount, 'tastings logged')}
        ${stat(bottles, `bottles on the shelf${open.length ? ` · ${open.length} open` : ''}`)}
        ${stat(all.filter((w) => w.status === 'wishlist').length, 'on the wishlist')}
        ${spent ? stat(money(spent), 'paid for shelf bottles') : ''}
      </div>

      <div class="panel">
        <h2>Your palate</h2>
        ${favFlavors.length ? `
          <p class="hint" style="margin:0 0 10px">Flavors that show up most in whiskeys you rate 4 or higher.</p>
          ${barList(favFlavors, { max: favs.length, value: (r) => r.n, label: (r) => r.f, sub: (r) => `${r.n} of ${favs.length}`, title: (r) => `${r.f}: in ${r.n} of your ${favs.length} favorites` })}
          ${lowFlavors.length ? `<h3 class="sub-h">Less your thing</h3>
            <p class="hint" style="margin:0 0 10px">Common in whiskeys you rated 2.5 or lower.</p>
            ${barList(lowFlavors.slice(0, 5), { max: lows.length, value: (r) => r.n, label: (r) => r.f, sub: (r) => `${r.n} of ${lows.length}` })}` : ''}`
          : '<p class="hint" style="margin:0">Tag flavors on whiskeys you rate 4★ or higher and your palate will show up here.</p>'}
      </div>

      ${typeRows.length ? `<div class="panel">
        <h2>Ratings by style</h2>
        ${barList(typeRows, { max: 5, value: (r) => r.avg, label: (r) => r.type, sub: (r) => `${r.avg.toFixed(1)} ★ · ${r.n}`, title: (r) => `${r.type}: average ${r.avg.toFixed(2)} across ${r.n}` })}
      </div>` : ''}

      ${distRows.length ? `<div class="panel">
        <h2>Most-logged distilleries</h2>
        ${barList(distRows, { value: (r) => r.n, label: (r) => r.d, sub: (r) => `${r.n}${r.avg ? ` · ${r.avg.toFixed(1)} ★` : ''}` })}
      </div>` : ''}

      ${topRated.length ? `<div class="panel">
        <h2>Your top rated</h2>
        <ol class="toplist">${topRated.map((w) => `<li><a href="#/w/${esc(w.id)}">${esc(w.name)}</a> ${starsHTML(w.rating, 14)}</li>`).join('')}</ol>
      </div>` : ''}
    </div>`;
}

// ---------- Settings ----------
function renderSettings() {
  setChrome({ title: 'Settings', back: true, fab: false });
  const key = settings.apiKey;
  app.innerHTML = `
    <div style="max-width:640px;margin:0 auto">
      <div class="panel">
        <h2>Label recognition</h2>
        <p class="hint" style="margin:0 0 12px">Photos are read by Claude using your own Anthropic API key. Get one at
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>.
          The key is saved only in this browser on this device and is sent only to Anthropic. Each photo costs roughly a cent or two.</p>
        <div class="field">
          <label for="apiKey">Anthropic API key</label>
          <input id="apiKey" class="input" type="password" placeholder="sk-ant-…" value="${esc(key)}" autocomplete="off" spellcheck="false">
        </div>
        <div class="field" style="margin-top:12px">
          <label for="model">Model</label>
          <input id="model" class="input" value="${esc(settings.model)}" spellcheck="false">
        </div>
        <div class="btn-row" style="margin-top:14px">
          <button class="btn primary" id="saveKey">Save</button>
          ${key ? '<button class="btn danger" id="clearKey">Remove key</button>' : ''}
        </div>
      </div>

      <div class="panel">
        <h2>Backup &amp; move between devices</h2>
        <p class="hint" style="margin:0 0 12px">Your collection is stored on each device. Export a backup file (photos included),
          then import it on your other device — e.g. save to iCloud Drive or OneDrive from your iPhone and import on your PC.
          Importing merges: newer edits win, nothing is deleted.</p>
        <div class="btn-row">
          <button class="btn" id="exportBtn">Export backup</button>
          <button class="btn" id="importBtn">Import backup</button>
        </div>
      </div>

      <div class="panel">
        <h2>Spreadsheet export</h2>
        <p class="hint" style="margin:0 0 12px">Download your collection as a CSV file that opens in Excel, Numbers or Google Sheets (no photos).</p>
        <button class="btn" id="csvBtn">Export CSV</button>
      </div>

      <div class="panel">
        <h2>Install the app</h2>
        <p class="hint" style="margin:0">
          <strong>iPhone / iPad:</strong> open this page in Safari, tap Share, then “Add to Home Screen”.<br>
          <strong>Windows:</strong> open in Edge or Chrome and click the install icon in the address bar (or menu → Apps → Install).
        </p>
      </div>
    </div>`;

  $('#saveKey').addEventListener('click', () => {
    settings.apiKey = $('#apiKey').value.trim();
    settings.model = $('#model').value.trim() === DEFAULT_MODEL ? '' : $('#model').value.trim();
    toast('Saved');
    renderSettings();
  });
  const clear = $('#clearKey');
  if (clear) clear.addEventListener('click', () => { settings.apiKey = ''; toast('Key removed'); renderSettings(); });

  $('#exportBtn').addEventListener('click', async () => {
    const btn = $('#exportBtn');
    btn.disabled = true; btn.textContent = 'Exporting…';
    try {
      const data = await db.exportAll();
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      await saveFile(`whiskey-tracker-backup-${todayISO()}.json`, blob, 'application/json');
      toast(`Exported ${data.whiskeys.length} whiskeys`);
    } catch (err) {
      if (err.name !== 'AbortError') toast('Export failed.');
    } finally {
      btn.disabled = false; btn.textContent = 'Export backup';
    }
  });

  $('#csvBtn').addEventListener('click', async () => {
    try {
      const items = sortItems(await db.getAll(), 'name');
      const blob = new Blob([toCSV(items)], { type: 'text/csv;charset=utf-8' });
      await saveFile(`whiskey-tracker-${todayISO()}.csv`, blob, 'text/csv');
      toast(`Exported ${items.length} whiskeys`);
    } catch (err) {
      if (err.name !== 'AbortError') toast('Export failed.');
    }
  });

  $('#importBtn').addEventListener('click', () => pickFile('#importInput'));
}

$('#importInput').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const { added, updated } = await db.importAll(data);
    toast(`Imported: ${added} new, ${updated} updated`);
  } catch (err) {
    toast(err.message || 'Import failed.');
  }
});

// ---------- Boot ----------
db.requestPersistence();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
}
route();
