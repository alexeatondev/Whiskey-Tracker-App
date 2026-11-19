import * as db from './js/db.js';
import { processPhoto } from './js/image.js';
import { identifyWhiskey, ClaudeError, WHISKEY_TYPES, DEFAULT_MODEL } from './js/claude.js';
import { starsHTML, createStarInput } from './js/stars.js';

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

// ---------- Fields ----------
const FIELDS = [
  { key: 'name', label: 'Name', full: true, placeholder: 'e.g. Eagle Rare 10 Year' },
  { key: 'distillery', label: 'Distillery / Producer' },
  { key: 'type', label: 'Style', kind: 'select', options: WHISKEY_TYPES },
  { key: 'country', label: 'Country' },
  { key: 'region', label: 'Region' },
  { key: 'age', label: 'Age' },
  { key: 'abv', label: 'ABV' },
  { key: 'proof', label: 'Proof' },
  { key: 'approxPrice', label: 'Price' },
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
const app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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

// ---------- State ----------
let draft = null; // in-progress new entry: { image, thumb, base64, fields, rating, status }
const listState = { q: '', type: '' };

// ---------- Router ----------
function go(hash) { location.hash = hash; }
window.addEventListener('hashchange', route);
$('#backBtn').addEventListener('click', () => {
  if (history.length > 1) history.back(); else go('#/');
});
$('#settingsBtn').addEventListener('click', () => go('#/settings'));
$('#addBtn').addEventListener('click', () => go('#/add'));

async function route() {
  releaseUrls();
  window.scrollTo(0, 0);
  const [, view, id] = (location.hash || '#/').split('/');
  try {
    if (view === 'add') return renderAdd();
    if (view === 'new') return renderEdit(null);
    if (view === 'edit' && id) return renderEdit(await db.get(id));
    if (view === 'w' && id) return renderDetail(await db.get(id));
    if (view === 'settings') return renderSettings();
    return renderList();
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="status error">Something went wrong: ${esc(err.message)}</div>`;
  }
}

// ---------- List ----------
function sortItems(items, mode) {
  const by = {
    recent: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0) || (a.name || '').localeCompare(b.name || ''),
    name: (a, b) => (a.name || '').localeCompare(b.name || ''),
    distillery: (a, b) => (a.distillery || '').localeCompare(b.distillery || '') || (a.name || '').localeCompare(b.name || ''),
  };
  return items.sort(by[mode] || by.recent);
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
  app.innerHTML = `
    <div class="toolbar">
      <input type="search" id="q" placeholder="Search name, distillery, notes…" value="${esc(listState.q)}" aria-label="Search">
      <select id="typeFilter" aria-label="Filter by style">
        <option value="">All styles</option>
        ${types.map((t) => `<option ${t === listState.type ? 'selected' : ''}>${esc(t)}</option>`).join('')}
      </select>
      <select id="sort" aria-label="Sort">
        ${[['recent', 'Newest'], ['rating', 'Top rated'], ['name', 'Name A–Z'], ['distillery', 'Distillery']]
          .map(([v, l]) => `<option value="${v}" ${v === settings.sort ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
    </div>
    <p class="stats" id="stats"></p>
    <div class="grid" id="grid"></div>`;

  const grid = $('#grid');
  const draw = () => {
    releaseUrls();
    const q = listState.q.trim().toLowerCase();
    let items = all.filter((w) => !listState.type || w.type === listState.type);
    if (q) {
      items = items.filter((w) => [w.name, w.distillery, w.type, w.region, w.country, w.nose, w.palate, w.finish, w.myNotes, w.edition]
        .some((v) => (v || '').toLowerCase().includes(q)));
    }
    sortItems(items, settings.sort);
    const rated = all.filter((w) => w.rating);
    const avg = rated.length ? (rated.reduce((s, w) => s + w.rating, 0) / rated.length).toFixed(1) : null;
    $('#stats').textContent = `${items.length} of ${all.length} whiskeys${avg ? ` · average rating ${avg}` : ''}`;
    grid.innerHTML = items.length ? items.map((w) => `
      <button class="card" data-id="${esc(w.id)}">
        ${w.thumb || w.image ? `<img class="thumb" src="${blobUrl(w.thumb || w.image)}" alt="" loading="lazy">` : '<div class="noimg">🥃</div>'}
        <div class="body">
          <div class="name">${esc(w.name || 'Unnamed whiskey')}</div>
          <div class="sub">${esc([w.distillery, w.age].filter(Boolean).join(' · ') || w.type || '')}</div>
          ${starsHTML(w.rating, 16)}
        </div>
      </button>`).join('') : '<p class="stats">No matches.</p>';
  };
  draw();

  $('#q').addEventListener('input', (e) => { listState.q = e.target.value; draw(); });
  $('#typeFilter').addEventListener('change', (e) => { listState.type = e.target.value; draw(); });
  $('#sort').addEventListener('change', (e) => { settings.sort = e.target.value; draw(); });
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
    draft = { fields: {}, rating: 0 };
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
  draft = { ...processed, fields: {}, rating: 0 };
  go('#/new');
  if (settings.apiKey) runIdentify();
}

async function runIdentify() {
  const current = draft;
  if (!current || !current.base64) return;
  current.status = { state: 'working' };
  updateIdentifyStatus();
  try {
    const result = await identifyWhiskey({ apiKey: settings.apiKey, model: settings.model, base64: current.base64 });
    if (draft !== current) return; // user moved on
    if (!result.isWhiskey) {
      current.status = { state: 'error', msg: "That doesn't look like a whiskey label. You can still fill in the details below." };
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
      current.status = {
        state: 'done',
        msg: result.confidence === 'low'
          ? 'Filled in, but I\'m not confident about this one — please double-check the details.'
          : 'Details filled in from the label. Review, rate, and save.',
      };
    }
  } catch (err) {
    console.error(err);
    if (draft !== current) return;
    current.status = { state: 'error', msg: err instanceof ClaudeError ? err.message : 'Recognition failed. You can fill in the details by hand.' };
  }
  updateIdentifyStatus();
}

function updateIdentifyStatus() {
  const box = $('#identifyStatus');
  if (!box || !draft) return;
  const s = draft.status;
  if (!s) { box.hidden = true; return; }
  box.hidden = false;
  box.className = `status${s.state === 'error' ? ' error' : ''}`;
  box.innerHTML = s.state === 'working'
    ? '<div class="spinner"></div>Reading the label…'
    : `${esc(s.msg)}${s.state === 'error' && draft.base64 && settings.apiKey ? ' <button type="button" class="btn" id="retryId" style="padding:6px 10px;margin-left:auto">Retry</button>' : ''}`;
  const retry = $('#retryId');
  if (retry) retry.addEventListener('click', runIdentify);
}

// ---------- Edit form (new or existing) ----------
function renderEdit(existing) {
  const isNew = !existing;
  if (isNew && !draft) { go('#/add'); return; }
  const src = isNew ? { ...draft.fields, rating: draft.rating, image: draft.image } : existing;
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
        <div class="panel">
          <h2>Your rating</h2>
          <div id="ratingMount"></div>
          <p class="hint">Tap the left half of a star for a half star.</p>
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

  let rating = src.rating || 0;
  $('#ratingMount').appendChild(createStarInput(rating, (v) => { rating = v; if (isNew) draft.rating = v; }));

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

  const form = $('#editForm');
  if (isNew) {
    // Keep typed values in the draft so a re-render (e.g. returning from settings) doesn't lose them.
    form.addEventListener('input', (e) => { if (e.target.name) draft.fields[e.target.name] = e.target.value; });
    updateIdentifyStatus();
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
    const now = Date.now();
    const record = isNew
      ? { id: db.newId(), createdAt: now, image: draft.image || null, thumb: draft.thumb || null }
      : { ...existing };
    Object.assign(record, data, { rating, updatedAt: now });
    if (newPhoto) { record.image = newPhoto.image; record.thumb = newPhoto.thumb; }
    try {
      await db.put(record);
    } catch (err) {
      console.error(err);
      toast('Could not save — storage may be full.');
      return;
    }
    draft = null;
    toast(isNew ? 'Added to your collection' : 'Saved');
    if (isNew) {
      history.replaceState(null, '', '#/');
      go(`#/w/${record.id}`);
    } else {
      location.replace(`#/w/${record.id}`);
    }
  });
}

// ---------- Detail ----------
function renderDetail(w) {
  if (!w) { go('#/'); return; }
  setChrome({ title: w.name || 'Whiskey', back: true, fab: false });
  const fact = (label, v) => (v ? `<div><dt>${esc(label)}</dt><dd>${esc(v)}</dd></div>` : '');
  const note = (label, v) => (v ? `<h3>${esc(label)}</h3><p>${esc(v)}</p>` : '');
  const facts = [
    fact('Age', w.age), fact('ABV', w.abv), fact('Proof', w.proof), fact('Region', w.region),
    fact('Country', w.country), fact('Cask / Finish', w.caskFinish), fact('Mash Bill', w.mashBill),
    fact('Batch / Edition', w.edition), fact('Price', w.approxPrice),
  ].join('');
  const tasting = note('Nose', w.nose) + note('Palate', w.palate) + note('Finish', w.finish);

  app.innerHTML = `
    <article class="detail">
      <div>${w.image ? `<img class="hero" id="hero" src="${blobUrl(w.image)}" alt="Photo of ${esc(w.name)}">` : ''}</div>
      <div>
        <div class="panel">
          <h2 class="name">${esc(w.name || 'Unnamed whiskey')}</h2>
          ${w.distillery ? `<p class="producer">${esc(w.distillery)}</p>` : ''}
          <div id="ratingMount"></div>
          ${w.type ? `<div class="chips"><span class="chip">${esc(w.type)}</span></div>` : ''}
        </div>
        ${facts ? `<div class="panel"><dl class="facts">${facts}</dl></div>` : ''}
        ${w.description || tasting ? `<div class="panel notes">${w.description ? `<p>${esc(w.description)}</p>` : ''}${tasting}</div>` : ''}
        ${w.myNotes ? `<div class="panel notes"><h3 style="margin-top:0">My Notes</h3><p>${esc(w.myNotes)}</p></div>` : ''}
        <div class="btn-row">
          <a class="btn" href="#/edit/${esc(w.id)}">Edit</a>
          <button class="btn danger" id="deleteBtn">Delete</button>
        </div>
        <p class="meta">Added ${new Date(w.createdAt).toLocaleDateString()}${w.updatedAt && w.updatedAt !== w.createdAt ? ` · updated ${new Date(w.updatedAt).toLocaleDateString()}` : ''}</p>
      </div>
    </article>`;

  // Rating can be changed right from the detail page.
  $('#ratingMount').appendChild(createStarInput(w.rating, async (v) => {
    w.rating = v; w.updatedAt = Date.now();
    await db.put(w);
    toast(v ? `Rated ${v} / 5` : 'Rating cleared');
  }, 32));

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
      const name = `whiskey-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document) {
        await navigator.share({ files: [file], title: 'Whiskey Tracker backup' });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      }
      toast(`Exported ${data.whiskeys.length} whiskeys`);
    } catch (err) {
      if (err.name !== 'AbortError') toast('Export failed.');
    } finally {
      btn.disabled = false; btn.textContent = 'Export backup';
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
