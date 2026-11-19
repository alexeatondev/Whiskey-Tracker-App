// Two-device sync test against mocked Cognito (hosted UI + token), Cognito Identity, and S3.
// Every S3 request's SigV4 signature is re-computed with the official AWS signer and must match.
(async () => {
const { chromium } = require('playwright');
const { SignatureV4 } = require('@smithy/signature-v4');
const { Sha256 } = require('@aws-crypto/sha256-js');
const ORIGIN = 'http://localhost:8766/';
const REGION = 'us-east-2';
const DOMAIN = 'https://secondpour-test.auth.us-east-2.amazoncognito.com';
const BUCKET = 'secondpour-sync-test';
const S3HOST = `${BUCKET}.s3.${REGION}.amazonaws.com`;
const IDENTITY = 'us-east-2:1111-2222';
const CREDS = { accessKeyId: 'ASIATEST', secretAccessKey: 'secret/With+Chars', sessionToken: 'sess+tok/en==' };
const store = new Map(); // key -> {body, type, etag}
let etagN = 1;
const log = [];
let sigChecked = 0, sigFailed = 0;
let refreshFail = false;
const cors = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'ETag' };
const signer = new SignatureV4({ service: 's3', region: REGION, credentials: CREDS, sha256: Sha256, uriEscapePath: false, applyChecksum: false });

async function verify(req) {
  const u = new URL(req.url());
  const h = req.headers();
  const query = {};
  u.searchParams.forEach((v, k) => { query[k] = v; });
  const d = h['x-amz-date'];
  const date = new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(9, 11)}:${d.slice(11, 13)}:${d.slice(13, 15)}Z`);
  const signed = await signer.sign({
    method: req.method(), protocol: 'https:', hostname: u.hostname, path: u.pathname, query,
    headers: { host: u.hostname, 'x-amz-content-sha256': h['x-amz-content-sha256'], 'x-amz-date': d },
  }, { signingDate: date });
  const want = signed.headers.authorization.match(/Signature=(\w+)/)[1];
  const got = (h.authorization || '').match(/Signature=(\w+)/)?.[1];
  sigChecked++;
  if (want !== got || h['x-amz-security-token'] !== CREDS.sessionToken) { sigFailed++; log.push(`SIG MISMATCH ${req.method()} ${u.pathname}${u.search}`); return false; }
  return true;
}

async function mock(ctx, label) {
  await ctx.route(`${DOMAIN}/**`, async (route) => {
    const req = route.request(); const u = new URL(req.url());
    if (u.pathname === '/oauth2/authorize') {
      const p = u.searchParams;
      log.push(`${label} authorize`);
      return route.fulfill({ status: 302, headers: { location: `${p.get('redirect_uri')}?code=c-${label}&state=${p.get('state')}` } });
    }
    const body = new URLSearchParams(req.postData() || '');
    if (body.get('grant_type') === 'refresh_token' && refreshFail) {
      return route.fulfill({ status: 400, headers: cors, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant' }) });
    }
    log.push(`${label} token ${body.get('grant_type')}`);
    const payload = Buffer.from(JSON.stringify({ email: 'dev@example.com', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
    return route.fulfill({ status: 200, contentType: 'application/json', headers: cors,
      body: JSON.stringify({ id_token: `x.${payload}.y`, access_token: 'a', refresh_token: body.get('grant_type') === 'refresh_token' ? undefined : 'ref', expires_in: 3600 }) });
  });
  await ctx.route(`https://cognito-identity.${REGION}.amazonaws.com/**`, async (route) => {
    const req = route.request();
    const target = req.headers()['x-amz-target'];
    log.push(`${label} ${target.split('.').pop()}`);
    const body = target.endsWith('GetId') ? { IdentityId: IDENTITY }
      : { IdentityId: IDENTITY, Credentials: { AccessKeyId: CREDS.accessKeyId, SecretKey: CREDS.secretAccessKey, SessionToken: CREDS.sessionToken, Expiration: Date.now() / 1000 + 3600 } };
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/x-amz-json-1.1', body: JSON.stringify(body) });
  });
  await ctx.route(`https://${S3HOST}/**`, async (route) => {
    const req = route.request(); const u = new URL(req.url());
    if (!(await verify(req))) return route.fulfill({ status: 403, headers: cors, body: '<Error><Code>SignatureDoesNotMatch</Code></Error>' });
    const own = `private/${IDENTITY}/`;
    if (req.method() === 'GET' && u.searchParams.get('list-type') === '2') {
      const prefix = u.searchParams.get('prefix');
      if (!prefix.startsWith(own)) return route.fulfill({ status: 403, headers: cors, body: '<Error><Code>AccessDenied</Code></Error>' });
      const items = [...store.entries()].filter(([k]) => k.startsWith(prefix));
      const xml = `<?xml version="1.0"?><ListBucketResult>${items.map(([k, v]) => `<Contents><Key>${k}</Key><ETag>&quot;${v.etag}&quot;</ETag></Contents>`).join('')}</ListBucketResult>`;
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/xml', body: xml });
    }
    const key = decodeURIComponent(u.pathname.slice(1));
    if (!key.startsWith(own)) return route.fulfill({ status: 403, headers: cors, body: '<Error><Code>AccessDenied</Code></Error>' });
    const item = store.get(key);
    if (req.method() === 'PUT') {
      const h = req.headers();
      if (h['if-match'] && (!item || `"${item.etag}"` !== h['if-match'])) return route.fulfill({ status: 412, headers: cors, body: '' });
      if (h['if-none-match'] === '*' && item) return route.fulfill({ status: 412, headers: cors, body: '' });
      const rec = { body: req.postDataBuffer(), type: h['content-type'], etag: `e${etagN++}` };
      store.set(key, rec);
      log.push(`${label} PUT ${key.slice(own.length)}`);
      return route.fulfill({ status: 200, headers: { ...cors, etag: `"${rec.etag}"` }, body: '' });
    }
    if (!item) return route.fulfill({ status: 404, headers: cors, body: '' });
    return route.fulfill({ status: 200, headers: { ...cors, etag: `"${item.etag}"` }, contentType: item.type, body: item.body });
  });
}
const b = await chromium.launch();
async function device(label) {
  const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
  await mock(ctx, label);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log.push(`${label} PAGEERROR ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') log.push(`${label} console ${m.text()}`); });
  await page.goto(ORIGIN);
  return page;
}
const addManual = async (page, name, status = 'tasted', withPhoto = false) => {
  await page.goto(ORIGIN + '#/add');
  if (withPhoto) { await page.setInputFiles('#libraryInput', '/home/claude/tests/bottle.jpg'); }
  else { await page.click('#manual'); }
  await page.waitForSelector('#editForm');
  await page.click(`label.seg-btn:has(input[name=status][value=${status}])`);
  await page.fill('#f_name', name);
  await page.click('#editForm button[type=submit]');
  await page.waitForSelector('.detail');
};
const list = (page) => page.evaluate(async () => (await import('./js/db.js')).getAll().then((a) => a.map((w) => `${w.name}${w.image ? '📷' : ''}:${w.rating}`).sort()));
const check = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) process.exitCode = 1; };

const A = await device('A');
await addManual(A, 'Eagle Rare 10', 'tasted', true);
await addManual(A, 'Weller 12', 'shelf');
await addManual(A, 'Stagg', 'wishlist');
await A.goto(ORIGIN + '#/settings'); await A.waitForSelector('#odConnect');
check('panel says Cloud sync', (await A.innerText('#syncPanel')).includes('Cloud sync'));
await A.click('#odConnect');
await A.waitForSelector('#odSync', { timeout: 15000 });
await A.waitForFunction(() => document.querySelector('#syncPanel').innerText.includes('Last synced just now'), null, { timeout: 15000 });
console.log('A panel:', (await A.innerText('#syncPanel')).replace(/\n/g, ' | '));
const keys = [...store.keys()].map((k) => k.replace(`private/${IDENTITY}/`, ''));
console.log('bucket after A:', keys);
check('collection + 2 photo files uploaded', keys.includes('collection.json') && keys.filter((k) => k.startsWith('photos/')).length === 2);
check('sync indicator visible', !(await A.$eval('#syncBtn', (e) => e.hidden)));

const B = await device('B');
await B.goto(ORIGIN + '#/settings'); await B.waitForSelector('#odConnect');
await B.click('#odConnect');
await B.waitForFunction(() => document.querySelector('#syncPanel')?.innerText.includes('Last synced'), null, { timeout: 15000 });
await B.waitForTimeout(1500);
const bHas = await list(B);
console.log('B has:', bHas);
check('B pulled 3 records with photo', bHas.length === 3 && bHas.some((x) => x.includes('📷')));
await B.goto(ORIGIN + '#/'); await B.waitForSelector('.card');
const ids = await B.evaluate(async () => Object.fromEntries((await (await import('./js/db.js')).getAll()).map((w) => [w.name, w.id])));
await B.goto(ORIGIN + `#/w/${ids['Weller 12']}`); await B.waitForSelector('#ratingMount .track');
const tr = B.locator('#ratingMount .track'); await tr.scrollIntoViewIfNeeded(); const bb = await tr.boundingBox();
await B.mouse.click(bb.x + bb.width * 0.85, bb.y + bb.height / 2);
B.on('dialog', (d) => d.accept());
await B.goto(ORIGIN + `#/w/${ids['Stagg']}`); await B.waitForSelector('#deleteBtn'); await B.click('#deleteBtn');
await B.waitForTimeout(5000);
await A.goto(ORIGIN + '#/settings'); await A.waitForSelector('#odSync'); await A.click('#odSync');
await A.waitForTimeout(2500);
const aNow = await list(A);
console.log('A after sync:', aNow);
check('delete propagated to A', aNow.length === 2 && !aNow.some((x) => x.startsWith('Stagg')));
check('rating propagated to A', aNow.some((x) => x.startsWith('Weller 12') && !x.endsWith(':null') && !x.endsWith(':undefined')));

// Concurrent-writer conflict: change remote behind A's back, then A syncs a local change.
const col = JSON.parse(store.get(`private/${IDENTITY}/collection.json`).body.toString());
const wid = Object.keys(col.records).find((k) => col.records[k].name === 'Eagle Rare 10');
col.records[wid] = { ...col.records[wid], notes: 'remote note', updatedAt: Date.now() + 10_000 };
store.set(`private/${IDENTITY}/collection.json`, { body: Buffer.from(JSON.stringify(col)), type: 'application/json', etag: `e${etagN++}` });
await A.evaluate(async (wid) => { const db = await import('./js/db.js'); const w = await db.get(wid); await db.put({ ...w, updatedAt: Date.now() - 1000, store: 'Hy-Vee' }); }, wid);
await A.waitForTimeout(5500);
const notes = await A.evaluate(async (wid) => (await (await import('./js/db.js')).get(wid)).notes, wid);
check('newer remote edit wins after conditional-write conflict', notes === 'remote note');

// Credentials expire: clear session creds and make refresh fail -> "Sign in again".
refreshFail = true;
await A.evaluate(() => {
  sessionStorage.removeItem('wt.aws.creds');
  const t = JSON.parse(localStorage.getItem('wt.aws.tokens')); t.expiresAt = 0; localStorage.setItem('wt.aws.tokens', JSON.stringify(t));
});
await A.reload(); await A.waitForSelector('#syncPanel');
await A.waitForFunction(() => document.querySelector('#syncPanel').innerText.includes('Sign in again'), null, { timeout: 10000 }).catch(() => {});
check('expired sign-in shows Sign in again', (await A.innerText('#syncPanel')).includes('Sign in again'));

check(`all ${sigChecked} S3 signatures valid`, sigFailed === 0 && sigChecked > 5);
const errs = log.filter((l) => /PAGEERROR|console|SIG/.test(l) && !/AuthRequired|status of 400|^\s+at /.test(l));
check('no page errors', errs.length === 0);
if (errs.length) console.log(errs.join('\n'));
await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
