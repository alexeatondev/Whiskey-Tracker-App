// Label recognition with Claude. Runs directly from the browser using the user's own API key,
// which is stored only on this device.
import Anthropic from '../vendor/anthropic-sdk.mjs';
import { FLAVOR_TAGS } from './model.js';

export const DEFAULT_MODEL = 'claude-opus-5-5';

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

export async function identifyWhiskey({ apiKey, model, base64 }) {
  if (!apiKey) throw new ClaudeError('Add your Anthropic API key in Settings to enable automatic label recognition.');

  const client = new Anthropic({
    apiKey,
    // This is a personal app: the key belongs to the user and never leaves their device except to call Anthropic.
    dangerouslyAllowBrowser: true,
    maxRetries: 2,
  });

  let response;
  try {
    response = await client.beta.messages.create({
      model: model || DEFAULT_MODEL,
      max_tokens: 6000, // the JSON answer is ~600 tokens; this leaves room for thinking while capping cost
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: SCHEMA },
      },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text: PROMPT },
        ],
      }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new ClaudeError('Your API key was rejected. Check it in Settings.');
    }
    if (err instanceof Anthropic.PermissionDeniedError) {
      throw new ClaudeError('This API key does not have access to that model.');
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new ClaudeError('Rate limited by the API. Wait a moment and try again.');
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new ClaudeError('Could not reach the Anthropic API. Check your internet connection.');
    }
    if (err instanceof Anthropic.APIError) {
      const msg = err.error?.error?.message || err.message;
      throw new ClaudeError(`The API returned an error: ${msg}`);
    }
    throw err;
  }

  if (response.stop_reason === 'refusal') {
    throw new ClaudeError('The model declined to analyze this photo. You can still fill in the details by hand.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new ClaudeError('The response was cut off. Please try again.');
  }

  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try {
    return JSON.parse(text);
  } catch {
    throw new ClaudeError('Could not read the response from the model. Please try again.');
  }
}
