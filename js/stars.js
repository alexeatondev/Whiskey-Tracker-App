// Star rating display and input (0.5 – 5, in 0.5 steps).

const STAR_PATH = 'M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z';

function row(size, color) {
  const gap = Math.round(size * 0.12);
  const width = size * 5 + gap * 4;
  let stars = '';
  for (let i = 0; i < 5; i++) {
    stars += `<svg x="${i * (size + gap)}" y="0" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${STAR_PATH}" fill="${color}"/></svg>`;
  }
  return { width, html: `<svg width="${width}" height="${size}" viewBox="0 0 ${width} ${size}" aria-hidden="true">${stars}</svg>` };
}

// Fraction of the row width that should be filled for a rating, accounting for gaps between stars.
function fillWidth(rating, size) {
  const gap = Math.round(size * 0.12);
  const full = Math.floor(rating);
  const part = rating - full;
  if (rating <= 0) return 0;
  return full * (size + gap) + part * size - (part === 0 ? gap : 0);
}

export function formatRating(r) {
  return r ? (Number.isInteger(r) ? `${r}.0` : `${r}`) : '–';
}

/** Read-only stars. */
export function starsHTML(rating, size = 18, showValue = true) {
  const r = Number(rating) || 0;
  const base = row(size, 'var(--star-empty)');
  const fill = row(size, 'var(--star)');
  return `<span class="stars" role="img" aria-label="${r ? `${r} out of 5 stars` : 'Not rated'}">
    <span class="track" style="width:${base.width}px;height:${size}px">
      ${base.html}<span class="fill" style="width:${fillWidth(r, size)}px">${fill.html}</span>
    </span>${showValue ? `<span class="val">${formatRating(r)}</span>` : ''}
  </span>`;
}

/**
 * Interactive stars. Tap/click the left half of a star for x.5, the right half for x.0.
 * Drag to scrub. Arrow keys change by 0.5. Returns the root element.
 */
export function createStarInput(initial, onChange, size = 40) {
  let value = Number(initial) || 0;
  const gap = Math.round(size * 0.12);
  const base = row(size, 'var(--star-empty)');
  const fill = row(size, 'var(--star)');

  const root = document.createElement('div');
  root.className = 'stars rate';
  root.innerHTML = `
    <span class="track" tabindex="0" role="slider" aria-label="Rating" aria-valuemin="0" aria-valuemax="5" aria-valuestep="0.5"
      style="width:${base.width}px;height:${size}px">
      ${base.html}<span class="fill">${fill.html}</span>
    </span>
    <span class="val"></span>
    <button type="button" class="btn" data-clear style="padding:6px 10px;font-size:.85rem">Clear</button>`;

  const track = root.querySelector('.track');
  const fillEl = root.querySelector('.fill');
  const valEl = root.querySelector('.val');
  const clearBtn = root.querySelector('[data-clear]');

  function render() {
    fillEl.style.width = `${fillWidth(value, size)}px`;
    valEl.textContent = formatRating(value);
    track.setAttribute('aria-valuenow', String(value));
    track.setAttribute('aria-valuetext', value ? `${value} out of 5 stars` : 'Not rated');
    clearBtn.hidden = !value;
  }

  function set(v, notify = true) {
    v = Math.max(0, Math.min(5, Math.round(v * 2) / 2));
    if (v === value) return;
    value = v;
    render();
    if (notify) onChange?.(value);
  }

  function valueAt(clientX) {
    const rect = track.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const scale = rect.width / base.width; // in case CSS scales the track
    const unit = (size + gap) * scale;
    const index = Math.min(4, Math.floor(x / unit));
    const within = (x - index * unit) / (size * scale);
    return index + (within <= 0.5 ? 0.5 : 1);
  }

  let dragging = false;
  track.addEventListener('pointerdown', (e) => {
    dragging = true;
    track.setPointerCapture(e.pointerId);
    set(valueAt(e.clientX));
    e.preventDefault();
  });
  track.addEventListener('pointermove', (e) => { if (dragging) set(valueAt(e.clientX)); });
  const stop = () => { dragging = false; };
  track.addEventListener('pointerup', stop);
  track.addEventListener('pointercancel', stop);

  track.addEventListener('keydown', (e) => {
    const map = { ArrowRight: 0.5, ArrowUp: 0.5, ArrowLeft: -0.5, ArrowDown: -0.5 };
    if (e.key in map) { set(Math.max(0.5, value + map[e.key])); e.preventDefault(); }
    else if (e.key === 'Home') { set(0.5); e.preventDefault(); }
    else if (e.key === 'End') { set(5); e.preventDefault(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { set(0); e.preventDefault(); }
  });
  clearBtn.addEventListener('click', () => set(0));

  render();
  root.getValue = () => value;
  return root;
}
