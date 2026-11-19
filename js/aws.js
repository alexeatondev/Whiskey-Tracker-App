// AWS connection: Cognito sign-in (OAuth 2.0 authorization code + PKCE, no library), short-lived AWS
// credentials from a Cognito Identity Pool, and signed (SigV4) requests to a private S3 bucket.
// Each user can only reach their own folder: private/<identity id>/ (enforced by the IAM role).
// None of the values in aws-config.js are secrets.
import { AWS_CONFIG as C } from './aws-config.js';

const TOKENS = 'wt.aws.tokens';
const PENDING = 'wt.aws.pending';
const CREDS = 'wt.aws.creds'; // sessionStorage: temporary AWS credentials (1 hour)

export const isConfigured = () => Boolean(C && C.clientId && C.bucket);
export const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, '');

function load(key, store = localStorage) {
  try { return JSON.parse(store.getItem(key) || 'null'); } catch { return null; }
}
function save(key, v, store = localStorage) {
  try { v ? store.setItem(key, JSON.stringify(v)) : store.removeItem(key); } catch { /* ignore */ }
}

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomString = (n = 48) => b64url(crypto.getRandomValues(new Uint8Array(n)));

function decodeJwt(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(part))));
  } catch { return {}; }
}

export function account() {
  const t = load(TOKENS);
  return t ? t.account || {} : null;
}
export const isSignedIn = () => Boolean(load(TOKENS));

export function signOut() {
  save(TOKENS, null);
  save(CREDS, null, sessionStorage);
}

export class AuthRequired extends Error {}

/** Redirects to the Cognito sign-in page. */
export async function signIn() {
  const verifier = randomString(48);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const state = randomString(16);
  save(PENDING, { verifier, state, hash: location.hash, at: Date.now() });
  const params = new URLSearchParams({
    client_id: C.clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  location.assign(`${C.domain}/oauth2/authorize?${params}`);
}

async function tokenRequest(body) {
  const res = await fetch(`${C.domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: C.clientId, ...body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error_description || json.error || `Sign-in request failed (${res.status})`);
    err.code = json.error;
    throw err;
  }
  return json;
}

function storeTokens(json, prev = {}) {
  const claims = decodeJwt(json.id_token || '');
  const t = {
    id: json.id_token,
    refresh: json.refresh_token || prev.refresh,
    expiresAt: (claims.exp ? claims.exp * 1000 : Date.now() + (json.expires_in || 3600) * 1000),
    account: { name: claims.name || '', username: claims.email || claims['cognito:username'] || '' },
  };
  save(TOKENS, t);
  return t;
}

/** Call once at startup. If the page is a redirect back from sign-in, finish it. */
export async function handleRedirect() {
  const params = new URLSearchParams(location.search);
  if (!params.has('state') || !(params.has('code') || params.has('error'))) return { handled: false };
  const pending = load(PENDING);
  save(PENDING, null);
  const clean = () => history.replaceState(null, '', location.pathname + ((pending && pending.hash) || '#/'));
  if (!pending || pending.state !== params.get('state')) {
    clean();
    return { handled: true, ok: false, error: 'Sign-in response did not match. Please try again.' };
  }
  if (params.has('error')) {
    clean();
    return { handled: true, ok: false, error: params.get('error_description') || params.get('error') };
  }
  try {
    const json = await tokenRequest({
      grant_type: 'authorization_code',
      code: params.get('code'),
      redirect_uri: redirectUri(),
      code_verifier: pending.verifier,
    });
    storeTokens(json);
    save(CREDS, null, sessionStorage);
    clean();
    return { handled: true, ok: true };
  } catch (e) {
    clean();
    return { handled: true, ok: false, error: e.message };
  }
}

/** A valid Cognito ID token, refreshed when needed (the refresh token lasts a year). */
async function idToken() {
  const t = load(TOKENS);
  if (!t) throw new AuthRequired('Not signed in.');
  if (t.id && t.expiresAt - Date.now() > 60_000) return t.id;
  if (!t.refresh) throw new AuthRequired('Sign-in expired.');
  try {
    const json = await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh });
    return storeTokens(json, t).id;
  } catch (e) {
    if (e.code === 'invalid_grant' || e.code === 'unauthorized_client') {
      save(TOKENS, { ...t, id: null, refresh: null });
      throw new AuthRequired('Sign-in expired.');
    }
    throw e;
  }
}

async function identityCall(target, body) {
  const res = await fetch(`https://cognito-identity.${C.region}.amazonaws.com/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': `AWSCognitoIdentityService.${target}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const type = String(json.__type || '').split('#').pop();
    if (type === 'NotAuthorizedException') throw new AuthRequired('Sign-in expired.');
    throw new Error(json.message || json.Message || `AWS sign-in failed (${res.status})`);
  }
  return json;
}

/** Temporary AWS credentials for the signed-in user (cached for the session, renewed before expiry). */
async function credentials(force = false) {
  const cached = load(CREDS, sessionStorage);
  if (!force && cached && cached.expiresAt - Date.now() > 5 * 60_000) return cached;
  const token = await idToken();
  const logins = { [`cognito-idp.${C.region}.amazonaws.com/${C.userPoolId}`]: token };
  const t = load(TOKENS) || {};
  let identityId = t.identityId;
  if (!identityId) {
    identityId = (await identityCall('GetId', { IdentityPoolId: C.identityPoolId, Logins: logins })).IdentityId;
    save(TOKENS, { ...t, identityId });
  }
  const { Credentials: k } = await identityCall('GetCredentialsForIdentity', { IdentityId: identityId, Logins: logins });
  const creds = {
    accessKeyId: k.AccessKeyId,
    secretKey: k.SecretKey,
    sessionToken: k.SessionToken,
    expiresAt: k.Expiration * 1000,
    identityId,
  };
  save(CREDS, creds, sessionStorage);
  return creds;
}

// ---------- SigV4 (S3) ----------
const te = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', te.encode(s)));
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? te.encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, te.encode(msg));
}
// RFC 3986 encoding as SigV4 requires.
const uriEncode = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export async function signedFetch(key, { method = 'GET', query = {}, headers = {}, body } = {}, creds) {
  const host = `${C.bucket}.s3.${C.region}.amazonaws.com`;
  const path = '/' + key.split('/').map(uriEncode).join('/');
  const qs = Object.keys(query).sort().map((k) => `${uriEncode(k)}=${uriEncode(String(query[k]))}`).join('&');
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const signed = {
    host,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    'x-amz-date': amzDate,
    'x-amz-security-token': creds.sessionToken,
  };
  const names = Object.keys(signed).sort();
  const canonical = [method, path, qs, names.map((n) => `${n}:${signed[n]}\n`).join(''), names.join(';'), 'UNSIGNED-PAYLOAD'].join('\n');
  const scope = `${day}/${C.region}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256(canonical)].join('\n');
  let k = await hmac(`AWS4${creds.secretKey}`, day);
  k = await hmac(k, C.region);
  k = await hmac(k, 's3');
  k = await hmac(k, 'aws4_request');
  const signature = hex(await hmac(k, toSign));
  const h = { ...headers };
  delete signed.host;
  Object.assign(h, signed, {
    Authorization: `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`,
  });
  return fetch(`https://${host}${path}${qs ? `?${qs}` : ''}`, { method, headers: h, body, cache: 'no-store' });
}

/** S3 request for a path inside the user's own folder. Retries once with fresh credentials on 403. */
async function s3(p, opts = {}) {
  let creds = await credentials();
  const key = (p) => `private/${creds.identityId}/${p}`;
  const go = () => (opts.list
    ? signedFetch('', { query: { 'list-type': 2, prefix: key(p), ...(opts.token ? { 'continuation-token': opts.token } : {}) } }, creds)
    : signedFetch(key(p), opts, creds));
  let res = await go();
  if (res.status === 403 || res.status === 400) {
    const text = await res.clone().text().catch(() => '');
    if (/ExpiredToken|InvalidToken|TokenRefreshRequired|RequestTimeTooSkewed|AccessDenied/.test(text)) {
      creds = await credentials(true);
      res = await go();
    }
  }
  return res;
}

function parseList(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const items = [...doc.getElementsByTagName('Contents')].map((c) => ({
    key: c.getElementsByTagName('Key')[0]?.textContent || '',
    eTag: c.getElementsByTagName('ETag')[0]?.textContent || '',
  }));
  const next = doc.getElementsByTagName('NextContinuationToken')[0]?.textContent || null;
  return { items, next };
}

/** Metadata for a file ({ eTag }) or null if it doesn't exist. Uses a listing so a missing file is a clean "no". */
export async function getItem(p) {
  const res = await s3(p, { list: true });
  if (!res.ok) throw new Error(`Cloud: could not check ${p} (${res.status})`);
  const { items } = parseList(await res.text());
  const hit = items.find((i) => i.key.endsWith(`/${p}`));
  return hit ? { eTag: hit.eTag } : null;
}

export async function download(p, as = 'blob') {
  const res = await s3(p);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Cloud: could not download ${p} (${res.status})`);
  return as === 'json' ? res.json() : res.blob();
}

/** Upload. ifMatch: eTag for optimistic concurrency; ifNone: fail if it already exists. */
export async function upload(p, data, { contentType = 'application/octet-stream', ifMatch, ifNone = false } = {}) {
  const headers = { 'Content-Type': contentType };
  if (ifMatch) headers['If-Match'] = ifMatch;
  else if (ifNone) headers['If-None-Match'] = '*';
  const res = await s3(p, { method: 'PUT', headers, body: data });
  if (res.status === 412 || res.status === 409) {
    const err = new Error('conflict');
    err.conflict = true;
    throw err;
  }
  if (!res.ok) throw new Error(`Cloud: could not save ${p} (${res.status})`);
  return { eTag: res.headers.get('ETag') };
}

/** Names of files directly inside a folder (empty set if there are none). */
export async function listNames(folder) {
  const names = new Set();
  let token = null;
  do {
    const res = await s3(`${folder}/`, { list: true, token });
    if (!res.ok) throw new Error(`Cloud: could not list ${folder} (${res.status})`);
    const { items, next } = parseList(await res.text());
    items.forEach((i) => names.add(i.key.split('/').pop()));
    token = next;
  } while (token);
  return names;
}
