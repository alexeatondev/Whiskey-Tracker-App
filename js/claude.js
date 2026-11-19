// Label recognition with Claude, through the Second Pour AI proxy (infra/ai-proxy.js).
// The Anthropic API key lives only in AWS; the browser sends the photo plus the user's sign-in token.
// The proxy fixes the model and token limit and enforces a monthly per-user quota.
import { FLAVOR_TAGS } from './model.js';
import { AWS_CONFIG } from './aws-config.js';
import { getIdToken, isSignedIn, AuthRequired } from './aws.js';

export const WHISKEY_TYPES = [
  'Bourbon',
  'Rye',
  'Tennessee Whiskey',
  'American Single Malt',
  'American Whiskey',
  'Scotch – Single Malt',
  'Scotch – Blended Malt',
  'Scotch – Blended',
  'Scotch – Grain',
  'Irish Whiskey',
  'Japanese Whisky',
  'Canadian Whisky',
  'World Whisky',
  'Other',
];

const str = (description) => ({ type: 'string', description });

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'isWhiskey', 'name', 'distillery', 'type', 'country', 'region', 'age', 'abv', 'proof',
    'caskFinish', 'mashBill', 'edition', 'description', 'nose', 'palate', 'finish', 'flavors', 'approxPrice', 'confidence',
  ],
  properties: {
    isWhiskey: { type: 'boolean', description: 'True if the photo shows a whiskey/whisky bottle or label.' },
    name: str('Full product name as on the label, e.g. "Blanton\'s Original Single Barrel". Empty string if unknown.'),
    distillery: str('Distillery or producer/brand owner. Empty string if unknown.'),
    type: { type: 'string', enum: WHISKEY_TYPES, description: 'Best-fit style category.' },
    country: str('Country of origin. Empty string if unknown.'),
    region: str('Region/state, e.g. "Kentucky", "Islay", "Speyside". Empty string if unknown.'),
    age: str('Age statement such as "12 years" or "NAS" if no age statement. Empty string if unknown.'),
    abv: str('Alcohol by volume as a number with %, e.g. "46.5%". Empty string if unknown.'),
    proof: str('US proof, e.g. "93". Empty string if unknown.'),
    caskFinish: str('Cask type / finish, e.g. "New charred American oak", "Sherry cask finish". Empty string if unknown.'),
    mashBill: str('Mash bill / grain recipe if known, e.g. "75% corn, 13% rye, 12% malted barley". Empty string if unknown.'),
    edition: str('Batch, barrel number, release year, or limited edition info visible on the label. Empty string if none.'),
    description: str('One or two sentence overview of this whiskey.'),
    nose: str('Typical nose / aroma notes, comma separated. Empty string if unknown.'),
    palate: str('Typical palate / taste notes, comma separated. Empty string if unknown.'),
    finish: str('Typical finish notes, comma separated. Empty string if unknown.'),
    flavors: {
      type: 'array',
      items: { type: 'string', enum: FLAVOR_TAGS },
      description: 'Up to 6 of the most characteristic flavor tags for this whiskey, most prominent first. Empty if unknown.',
    },
    approxPrice: str('Approximate typical US retail price for a 750ml bottle, e.g. "$65". Empty string if unknown.'),
    confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'How confident you are in the identification.' },
  },
};

const PROMPT = `Identify the whiskey in this photo and fill in its details.

Read everything legible on the label first (name, distillery, age, ABV/proof, batch or barrel numbers, cask notes) — the label is the source of truth for those fields. Then fill the remaining fields (style, region, mash bill, typical tasting notes, flavor tags, approximate price) from what you know about this specific product.

If a field is not on the label and you don't reliably know it for this exact product, return an empty string rather than guessing. If you cannot tell exactly which expression it is, give your best identification and set confidence to "low".`;

export class ClaudeError extends Error {}

const USAGE = 'wt.ai.usage';

/** True when label recognition can run: the proxy is configured and the user is signed in. */
export const aiAvailable = () => Boolean(AWS_CONFIG && AWS_CONFIG.aiUrl && isSignedIn());
export const aiConfigured = () => Boolean(AWS_CONFIG && AWS_CONFIG.aiUrl);

/** Last known usage for this month ({ used, limit, month }) or null. */
export function aiUsage() {
  try {
    const u = JSON.parse(localStorage.getItem(USAGE) || 'null');
    return u && u.month === new Date().toISOString().slice(0, 7) ? u : null;
  } catch { return null; }
}

export async function identifyWhiskey({ base64 }) {
  if (!aiConfigured()) throw new ClaudeError('Label recognition is not set up in this build.');
  let token;
  try {
    token = await getIdToken();
  } catch (e) {
    if (e instanceof AuthRequired) throw new ClaudeError('Sign in (Settings → Account & sync) to use label recognition.');
    throw new ClaudeError('Could not reach the sign-in service. Check your internet connection.');
  }

  let res;
  try {
    res = await fetch(AWS_CONFIG.aiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ image: base64, prompt: PROMPT, schema: SCHEMA }),
    });
  } catch {
    throw new ClaudeError('Could not reach the label reader. Check your internet connection.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) throw new ClaudeError('Sign in again (Settings → Account & sync) to use label recognition.');
    if (data.error === 'quota') {
      try { localStorage.setItem(USAGE, JSON.stringify({ used: data.limit, limit: data.limit, month: new Date().toISOString().slice(0, 7) })); } catch { /* ignore */ }
    }
    throw new ClaudeError(data.message || `The label reader returned an error (${res.status}).`);
  }
  if (data.usage) {
    try { localStorage.setItem(USAGE, JSON.stringify({ ...data.usage, month: new Date().toISOString().slice(0, 7) })); } catch { /* ignore */ }
  }
  if (data.stop_reason === 'refusal') {
    throw new ClaudeError('The model declined to analyze this photo. You can still fill in the details by hand.');
  }
  if (data.stop_reason === 'max_tokens') {
    throw new ClaudeError('The response was cut off. Please try again.');
  }
  try {
    return JSON.parse(data.text);
  } catch {
    throw new ClaudeError('Could not read the response from the model. Please try again.');
  }
}
