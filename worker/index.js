/**
 * TaxOrder Pro — Cloudflare Worker
 * Bindings: DB (D1), DOCS (R2), PREFS (KV)
 *
 * Deploy:
 *   wrangler d1 create taxorder-pro
 *   wrangler r2 bucket create taxorder-docs
 *   wrangler kv namespace create PREFS
 *   wrangler d1 execute taxorder-pro --file=worker/schema.sql
 *   wrangler deploy
 */

// ─── CORS ────────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
function err(msg, status = 400) { return json({ error: msg }, status); }

// ─── CRYPTO ──────────────────────────────────────────────────────────────────
async function hashPwd(password, salt = 'taxorder-cf-2025') {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100_000 },
    key, 256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}
async function verifyPwd(password, storedHash) {
  return (await hashPwd(password)) === storedHash;
}

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
async function getUser(request, env) {
  const auth = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!auth) return null;
  return env.DB.prepare(
    `SELECT u.* FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token = ? AND s.expires_at > datetime('now') AND u.active = 1`
  ).bind(auth).first();
}

function safeUser(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
}

// ─── AUTH HANDLERS ────────────────────────────────────────────────────────────
async function handleLogin(req, env) {
  let body;
  try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
  const { email, password } = body;
  if (!email || !password) return err('Podaj email i hasło');

  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE email = ? AND active = 1'
  ).bind(email.toLowerCase()).first();

  if (!user || !(await verifyPwd(password, user.password_hash))) {
    return err('Nieprawidłowy email lub hasło', 401);
  }

  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    'INSERT INTO sessions(token, user_id, expires_at) VALUES(?, ?, ?)'
  ).bind(token, user.id, expires).run();

  return json({ token, user: safeUser(user) });
}

async function handleLogout(req, env) {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  return json({ ok: true });
}

// ─── VEHICLES ─────────────────────────────────────────────────────────────────
async function handleVehicles(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean); // ['api','vehicles',...]

  // GET /api/vehicles?company=mtoilet
  if (req.method === 'GET') {
    const company = url.searchParams.get('company') || 'mtoilet';
    const rows = await env.DB.prepare(
      'SELECT * FROM vehicles WHERE company_id = ? ORDER BY nr_rej'
    ).bind(company).all();
    return json(rows.results || []);
  }

  // POST /api/vehicles/bulk
  if (req.method === 'POST' && segs[2] === 'bulk') {
    let body;
    try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const { vehicles } = body;
    if (!Array.isArray(vehicles) || !vehicles.length) return err('Brak pojazdów');

    const UPSERT = `
      INSERT INTO vehicles(company_id,nr_rej,axles_count,suspension_type,
        dmc_zespolu,miesiace_podatku,dt1_category,dt1_tax_amount,data,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(company_id,nr_rej) DO UPDATE SET
        axles_count=excluded.axles_count, suspension_type=excluded.suspension_type,
        dmc_zespolu=excluded.dmc_zespolu, miesiace_podatku=excluded.miesiace_podatku,
        dt1_category=excluded.dt1_category, dt1_tax_amount=excluded.dt1_tax_amount,
        data=excluded.data, updated_at=datetime('now')`;

    const stmt = env.DB.prepare(UPSERT);
    await env.DB.batch(vehicles.map(v => stmt.bind(
      v.company_id, v.nr_rej, v.axles_count ?? 2, v.suspension_type ?? 'pneumatyczne',
      v.dmc_zespolu ?? 0, v.miesiace_podatku ?? 12,
      v.dt1_category ?? null, v.dt1_tax_amount ?? null,
      typeof v.data === 'string' ? v.data : JSON.stringify(v.data ?? {})
    )));
    return json({ ok: true, count: vehicles.length });
  }

  // PUT /api/vehicles/:nrRej
  if (req.method === 'PUT' && segs[2]) {
    let body;
    try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    await env.DB.prepare(`
      INSERT INTO vehicles(company_id,nr_rej,axles_count,suspension_type,
        dmc_zespolu,miesiace_podatku,dt1_category,dt1_tax_amount,data,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(company_id,nr_rej) DO UPDATE SET
        axles_count=excluded.axles_count, suspension_type=excluded.suspension_type,
        dmc_zespolu=excluded.dmc_zespolu, miesiace_podatku=excluded.miesiace_podatku,
        dt1_category=excluded.dt1_category, dt1_tax_amount=excluded.dt1_tax_amount,
        data=excluded.data, updated_at=datetime('now')`
    ).bind(
      body.company_id, body.nr_rej, body.axles_count ?? 2, body.suspension_type ?? 'pneumatyczne',
      body.dmc_zespolu ?? 0, body.miesiace_podatku ?? 12,
      body.dt1_category ?? null, body.dt1_tax_amount ?? null,
      typeof body.data === 'string' ? body.data : JSON.stringify(body.data ?? {})
    ).run();
    return json({ ok: true });
  }

  // DELETE /api/vehicles/:nrRej
  if (req.method === 'DELETE' && segs[2]) {
    await env.DB.prepare(
      'DELETE FROM vehicles WHERE company_id = ? AND nr_rej = ?'
    ).bind(url.searchParams.get('company') || 'mtoilet', decodeURIComponent(segs[2])).run();
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── COMPANY STATE ────────────────────────────────────────────────────────────
async function handleState(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean);
  const companyId = segs[2];
  if (!companyId) return err('Wymagane company_id');

  if (req.method === 'GET') {
    const row = await env.DB.prepare(
      'SELECT * FROM company_states WHERE company_id = ?'
    ).bind(companyId).first();
    if (!row) return json(null);
    return json({
      company_id: row.company_id,
      tax_year: row.tax_year,
      selected: JSON.parse(row.selected_ids || '[]'),
      taxpayer: JSON.parse(row.taxpayer || '{}'),
    });
  }

  if (req.method === 'PUT') {
    let body;
    try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    await env.DB.prepare(`
      INSERT INTO company_states(company_id,tax_year,selected_ids,taxpayer,updated_at)
      VALUES(?,?,?,?,datetime('now'))
      ON CONFLICT(company_id) DO UPDATE SET
        tax_year=excluded.tax_year, selected_ids=excluded.selected_ids,
        taxpayer=excluded.taxpayer, updated_at=datetime('now')`
    ).bind(
      companyId,
      body.tax_year || '2026',
      JSON.stringify(body.selected || []),
      JSON.stringify(body.taxpayer || {})
    ).run();
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── USER PREFS ───────────────────────────────────────────────────────────────
async function handlePrefs(req, env, user) {
  if (req.method === 'GET') {
    const row = await env.DB.prepare(
      'SELECT * FROM user_prefs WHERE user_id = ?'
    ).bind(user.id).first();
    if (!row) return json({});
    return json({
      col_order:   row.col_order   ? JSON.parse(row.col_order)   : null,
      col_visible: row.col_visible ? JSON.parse(row.col_visible) : null,
      col_widths:  row.col_widths  ? JSON.parse(row.col_widths)  : null,
      density:     row.density || 'normal',
    });
  }

  if (req.method === 'PUT') {
    let body;
    try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    await env.DB.prepare(`
      INSERT INTO user_prefs(user_id,col_order,col_visible,col_widths,density,updated_at)
      VALUES(?,?,?,?,?,datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        col_order=excluded.col_order, col_visible=excluded.col_visible,
        col_widths=excluded.col_widths, density=excluded.density,
        updated_at=datetime('now')`
    ).bind(
      user.id,
      body.col_order   ? JSON.stringify(body.col_order)   : null,
      body.col_visible ? JSON.stringify(body.col_visible) : null,
      body.col_widths  ? JSON.stringify(body.col_widths)  : null,
      body.density || 'normal'
    ).run();
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── DOCUMENTS ────────────────────────────────────────────────────────────────
async function handleDocs(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean); // ['api','docs',...]

  // GET /api/docs?nrRej=XX&company=YY — lista dokumentów
  if (req.method === 'GET' && segs.length === 2) {
    const nrRej   = url.searchParams.get('nrRej');
    const company = url.searchParams.get('company') || 'mtoilet';
    if (!nrRej) return err('nrRej wymagany');
    const rows = await env.DB.prepare(
      'SELECT id,nr_rej,name,mime_type,uploaded_at FROM documents WHERE nr_rej=? AND company_id=? ORDER BY uploaded_at DESC'
    ).bind(nrRej, company).all();
    return json(rows.results || []);
  }

  // POST /api/docs/upload
  if (req.method === 'POST' && segs[2] === 'upload') {
    let fd;
    try { fd = await req.formData(); } catch { return err('Wymagany FormData'); }
    const file    = fd.get('file');
    const nrRej   = fd.get('nrRej');
    const company = fd.get('company') || 'mtoilet';
    if (!file || !nrRej) return err('Wymagane: file, nrRej');

    const docId = crypto.randomUUID();
    const r2Key = `docs/${company}/${nrRej}/${docId}`;
    await env.DOCS.put(r2Key, file.stream(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
    });
    await env.DB.prepare(
      'INSERT INTO documents(id,nr_rej,company_id,name,mime_type,r2_key) VALUES(?,?,?,?,?,?)'
    ).bind(docId, nrRej, company, file.name, file.type || 'application/octet-stream', r2Key).run();

    return json({ ok: true, id: docId, key: r2Key });
  }

  // GET /api/docs/file/:key... — pobierz plik z R2
  if (req.method === 'GET' && segs[2] === 'file') {
    const r2Key = segs.slice(3).join('/');
    if (!r2Key) return err('Brak klucza');
    const obj = await env.DOCS.get(r2Key);
    if (!obj) return err('Dokument nie znaleziony', 404);
    return new Response(obj.body, {
      headers: {
        'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
        ...CORS,
      },
    });
  }

  // DELETE /api/docs/:docId
  if (req.method === 'DELETE' && segs[2] && segs[2] !== 'file') {
    const row = await env.DB.prepare(
      'SELECT r2_key FROM documents WHERE id = ?'
    ).bind(segs[2]).first();
    if (row) {
      await Promise.all([
        env.DOCS.delete(row.r2_key),
        env.DB.prepare('DELETE FROM documents WHERE id = ?').bind(segs[2]).run(),
      ]);
    }
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── USERS (admin) ────────────────────────────────────────────────────────────
async function handleUsers(req, env, user, url, path) {
  if (user.role !== 'admin') return err('Brak uprawnień administratora', 403);
  const segs   = path.split('/').filter(Boolean);
  const userId = segs[2] ? parseInt(segs[2]) : null;

  if (req.method === 'GET' && !userId) {
    const rows = await env.DB.prepare(
      'SELECT id,email,name,role,active,created_at FROM users ORDER BY name'
    ).all();
    return json(rows.results || []);
  }

  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const { email, name, password, role } = body;
    if (!email || !password) return err('Email i hasło wymagane');
    const hash = await hashPwd(password);
    try {
      const res = await env.DB.prepare(
        'INSERT INTO users(email,name,password_hash,role) VALUES(?,?,?,?)'
      ).bind(email.toLowerCase(), name || email, hash, role || 'viewer').run();
      return json({ ok: true, id: res.meta.last_row_id });
    } catch (e) {
      if (e.message.includes('UNIQUE')) return err('Email już istnieje', 409);
      throw e;
    }
  }

  if (req.method === 'PUT' && userId) {
    let body;
    try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const sets = [], vals = [];
    if (body.name)              { sets.push('name=?');          vals.push(body.name); }
    if (body.role)              { sets.push('role=?');          vals.push(body.role); }
    if (body.active !== undefined) { sets.push('active=?');     vals.push(body.active ? 1 : 0); }
    if (body.password)          { sets.push('password_hash=?'); vals.push(await hashPwd(body.password)); }
    if (!sets.length) return err('Brak pól do aktualizacji');
    vals.push(userId);
    await env.DB.prepare(`UPDATE users SET ${sets.join(',')} WHERE id=?`).bind(...vals).run();
    return json({ ok: true });
  }

  if (req.method === 'DELETE' && userId) {
    if (userId === user.id) return err('Nie możesz usunąć własnego konta');
    await env.DB.prepare('DELETE FROM users WHERE id=?').bind(userId).run();
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── WEB PUSH — VAPID + RFC 8291 (aes128gcm) ─────────────────────────────────

function b64url(data) {
  const bytes = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : new Uint8Array(data instanceof ArrayBuffer ? data : data.buffer || data);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDec(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - str.length % 4) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function cat(...arrays) {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

async function hkdf(ikm, salt, info, len) {
  const saltKey = await crypto.subtle.importKey('raw', salt, { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', saltKey, ikm));
  const prkKey = await crypto.subtle.importKey('raw', prk, { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const infoB = typeof info === 'string' ? new TextEncoder().encode(info) : info;
  const t = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, cat(infoB, new Uint8Array([1]))));
  return t.slice(0, len);
}

async function encryptForPush(subscription, messageJson) {
  const enc = new TextEncoder();
  const p256dh = b64urlDec(subscription.keys.p256dh);
  const auth   = b64urlDec(subscription.keys.auth);

  const serverPair = await crypto.subtle.generateKey({ name:'ECDH', namedCurve:'P-256' }, true, ['deriveBits']);
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverPair.publicKey));

  const clientPub = await crypto.subtle.importKey('raw', p256dh, { name:'ECDH', namedCurve:'P-256' }, false, []);
  const ecdhBits  = new Uint8Array(await crypto.subtle.deriveBits({ name:'ECDH', public:clientPub }, serverPair.privateKey, 256));

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const infoKey = cat(enc.encode('WebPush: info\x00'), p256dh, serverPubRaw);
  const ikm     = await hkdf(ecdhBits, auth, infoKey, 32);

  const cekBytes = await hkdf(ikm, salt, enc.encode('Content-Encoding: aes128gcm\x00'), 16);
  const cek = await crypto.subtle.importKey('raw', cekBytes, 'AES-GCM', false, ['encrypt']);

  const nonce = await hkdf(ikm, salt, enc.encode('Content-Encoding: nonce\x00'), 12);

  const plaintext = cat(enc.encode(messageJson), new Uint8Array([2]));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name:'AES-GCM', iv:nonce }, cek, plaintext));

  const rs = new Uint8Array([0, 1, 0, 0]); // record size 65536
  return cat(salt, rs, new Uint8Array([65]), serverPubRaw, ciphertext).buffer;
}

async function vapidHeader(endpoint, privB64, pubB64, sub) {
  const enc = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(JSON.stringify({ typ:'JWT', alg:'ES256' }));
  const p = b64url(JSON.stringify({ aud: new URL(endpoint).origin, exp: now + 43200, sub }));
  const sigInput = enc.encode(`${h}.${p}`);
  const privKey = await crypto.subtle.importKey(
    'pkcs8', b64urlDec(privB64), { name:'ECDSA', namedCurve:'P-256' }, false, ['sign']
  );
  const sig = b64url(await crypto.subtle.sign({ name:'ECDSA', hash:'SHA-256' }, privKey, sigInput));
  return `vapid t=${h}.${p}.${sig},k=${pubB64}`;
}

async function sendPushMsg(sub, payload, env) {
  const body = await encryptForPush(sub, JSON.stringify(payload));
  const auth = await vapidHeader(sub.endpoint, env.VAPID_PRIVATE_KEY, env.VAPID_PUBLIC_KEY, 'mailto:adamus1000@gmail.com');
  return fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '86400',
      Urgency: 'normal',
    },
    body,
  });
}

// POST /api/push/subscribe — public (no Worker auth, Supabase session is enough)
async function handlePushSubscribe(req, env) {
  let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
  const { subscription, company_id, label } = body;
  if (!subscription?.endpoint || !subscription?.keys) return err('Nieprawidłowa subskrypcja');
  if (!company_id) return err('Wymagane company_id');
  await env.DB.prepare(`
    INSERT INTO push_subscriptions(company_id,endpoint,p256dh,auth_key,label,updated_at)
    VALUES(?,?,?,?,?,datetime('now'))
    ON CONFLICT(endpoint) DO UPDATE SET
      company_id=excluded.company_id,p256dh=excluded.p256dh,auth_key=excluded.auth_key,
      label=excluded.label,updated_at=datetime('now')`
  ).bind(company_id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, label || null).run();
  return json({ ok: true });
}

// DELETE /api/push/subscribe — public (endpoint is secret enough)
async function handlePushUnsubscribe(req, env) {
  let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
  if (!body.endpoint) return err('Wymagane endpoint');
  await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').bind(body.endpoint).run();
  return json({ ok: true });
}

// POST /api/push/send — sends to all subscribers of a company
// Requires either: Worker admin session OR X-Supabase-Key header with SUPABASE_SERVICE_KEY
async function handlePushSend(req, env, user) {
  if (user && user.role !== 'admin') return err('Tylko administrator może wysyłać powiadomienia', 403);
  const supaKey = req.headers.get('X-Supabase-Key');
  if (!user && supaKey !== env.SUPABASE_SERVICE_KEY) return err('Nieautoryzowany', 401);
  let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
  const { company_id, title, message, url = '/', urgent = false } = body;
  if (!company_id || !title) return err('Wymagane: company_id, title');
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return err('Klucze VAPID nie skonfigurowane — wygeneruj przez /api/push/generate-keys', 503);

  const rows = await env.DB.prepare('SELECT * FROM push_subscriptions WHERE company_id=?').bind(company_id).all();
  const subs = rows.results || [];
  if (!subs.length) return json({ ok: true, sent: 0, note: 'Brak subskrybentów' });

  const payload = { title, body: message || title, tag: 'taxorder-alert', url, urgent };
  const results = await Promise.allSettled(subs.map(s =>
    sendPushMsg({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } }, payload, env)
  ));

  const expired = subs.filter((_, i) => results[i].status === 'fulfilled' && results[i].value.status === 410).map(s => s.id);
  if (expired.length) {
    for (const id of expired) await env.DB.prepare('DELETE FROM push_subscriptions WHERE id=?').bind(id).run();
  }

  return json({ ok: true, sent: results.filter(r => r.status === 'fulfilled' && r.value.ok).length, total: subs.length });
}

// GET /api/push/vapid-public-key — klucz publiczny dla klientów
async function handleVapidPublicKey(_req, env) {
  if (!env.VAPID_PUBLIC_KEY) return err('Klucze VAPID nie skonfigurowane', 503);
  return json({ key: env.VAPID_PUBLIC_KEY });
}

// GET /api/push/generate-keys — jednorazowe generowanie kluczy VAPID (admin)
async function handleGenerateVapidKeys(_req, _env, user) {
  if (user?.role !== 'admin') return err('Tylko administrator', 403);
  const pair = await crypto.subtle.generateKey({ name:'ECDSA', namedCurve:'P-256' }, true, ['sign','verify']);
  const [pub, priv] = await Promise.all([
    crypto.subtle.exportKey('raw', pair.publicKey),
    crypto.subtle.exportKey('pkcs8', pair.privateKey),
  ]);
  return json({
    VAPID_PUBLIC_KEY: b64url(pub),
    VAPID_PRIVATE_KEY: b64url(priv),
    instructions: 'Ustaw w Cloudflare Dashboard → Workers → taxorder-pro-api → Settings → Variables & Secrets. VAPID_PRIVATE_KEY jako Secret (zaszyfrowany).',
  });
}

// ─── SCHEDULED — czyszczenie wygasłych sesji ─────────────────────────────────
async function cleanSessions(env) {
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}

// ─── SETUP (jednorazowy: ustawia hash hasła w schema.sql) ────────────────────
// GET /api/auth/setup?password=admin2025 — zwraca hash, nie modyfikuje DB
async function handleSetup(req) {
  const url   = new URL(req.url);
  const pass  = url.searchParams.get('password');
  if (!pass) return err('Podaj ?password=...');
  const hash = await hashPwd(pass);
  return json({ hash, hint: 'Wklej ten hash do schema.sql zamiast __HASH_PLACEHOLDER__' });
}

// ─── ZMIANA HASŁA (zalogowany użytkownik) ─────────────────────────────────────
async function handleChangeMyPassword(req, env, user) {
  let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
  if (!body.password || body.password.length < 6) return err('Hasło musi mieć minimum 6 znaków');
  const hash = await hashPwd(body.password);
  await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, user.id).run();
  return json({ ok: true });
}

// ─── AI CHAT (Groq API — darmowy, Llama 3.1 8B) ─────────────────────────────
async function handleAI(request, env) {
  if (request.method !== 'POST') return err('Method not allowed', 405);
  let body; try { body = await request.json(); } catch { return err('Nieprawidłowe JSON'); }
  const { message, fleetSummary, history = [] } = body;
  if (!message?.trim()) return err('Brak wiadomości');
  if (!env.GROQ_API_KEY) return err('Brak klucza GROQ_API_KEY — ustaw sekret w Cloudflare', 503);

  const systemPrompt = `Jesteś asystentem TaxOrder Pro — systemu DT-1 (podatek od środków transportowych) dla polskich firm.

Pomagasz z: obliczaniem podatku DT-1, kategoryzacją pojazdów (D1–D15), stawkami Warszawy 2026, wypełnianiem deklaracji DT-1/DT-1A, zarządzaniem flotą.

Stawki Warszawa 2026 (Uchwała XXIX/1065/2025):
D1 Ciężarowy 3,5–5,5t: 984 zł (<2024) / 888 zł (>=2024)
D2 Ciężarowy 5,5–9t: 1572 zł / 1416 zł
D3 Ciężarowy 9–12t: 1848 zł / 1656 zł
D8 Ciężarowy >=12t 2 osie: 3264 zł / 2940 zł
D9 Ciężarowy >=12t 3 osie: 3612 zł / 3252 zł
D10 Ciężarowy >=12t 4+ osie: 3972 zł / 3576 zł
D11 Ciągnik >=12t 2 osie: 2760 zł / 2484 zł
D12 Ciągnik >=12t 3+ osie: 3180 zł / 2868 zł
D5 Przyczepa 7–12t: 1128 zł / 1016 zł
D13 Przyczepa >=12t 1 oś: 744 zł, D14 2 osie: 840 zł, D15 3 osie: 984 zł
Terminy: DT-1 do 15 lutego, II rata do 15 września.
Odpowiadaj po polsku, konkretnie i zwięźle.${fleetSummary ? '\n\nFlota użytkownika:\n' + fleetSummary : ''}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + env.GROQ_API_KEY,
      },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, max_tokens: 1024 }),
    });
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}));
      return err('Błąd Groq: ' + (e.error?.message || resp.statusText), 502);
    }
    const data = await resp.json();
    return json({ answer: data.choices[0].message.content });
  } catch (e) {
    console.error('[AI] Groq error:', e?.message);
    return err('Błąd AI: ' + (e?.message || 'nieznany błąd'), 502);
  }
}

// ─── AZTEC DR DECODER — NRV2E decompressor (pure JS, no dependencies) ────────
class _BitReader {
  constructor(buf) { this.b = buf; this.pos = 0; this.bits = 0; this.cur = 0; }
  get ended() { return this.pos >= this.b.length && this.bits === 0; }
  readBit() {
    if (this.bits === 0) { this.cur = this.b[this.pos++]; this.bits = 8; }
    return (this.cur >> --this.bits) & 1;
  }
  readByte() { return this.b[this.pos++]; }
}

function _nrv2eDecompress(input, outputLen) {
  const out = new Uint8Array(outputLen);
  const r = new _BitReader(input);
  let p = 0, lastOff = 1;
  while (!r.ended && p < outputLen) {
    if (r.readBit() === 1) { out[p++] = r.readByte(); continue; }
    let off = 1, len = 0;
    for (;;) {
      off = off * 2 + r.readBit();
      if (r.readBit() === 1) break;
      off = (off - 1) * 2 + r.readBit();
    }
    if (off === 2) {
      off = lastOff; len = r.readBit();
    } else {
      off = (off - 3) * 0x100 + r.readByte();
      if (off === 0xffffffff) break;
      len = (off ^ 0xffffffff) & 1;
      off >>= 1;
      lastOff = ++off;
    }
    if (len) { len = 1 + r.readBit(); }
    else if (r.readBit() === 1) { len = 3 + r.readBit(); }
    else { len++; do { len = len * 2 + r.readBit(); } while (r.readBit() === 0); len += 3; }
    if (off > 0x500) len++;
    let src = p - off;
    if (src < 0) throw new Error('NRV2E: invalid offset');
    for (let i = 0; i <= len && p < outputLen; i++) out[p++] = out[src++];
  }
  return out;
}

// Mapowanie indeksów pól w nowym formacie polskiego DR
const _DR_NEW = { seriaDr:1, nrRej:7, marka:8, typ:9, model:12, vin:13,
  dmcKg:38, dmcKg2:39, dmcZespolu:40, masaWlKg:41, kategoria:42, liczbaOsi:44,
  pojSilnika:48, mocKW:49, paliwo:50, dataRej:51, miejscaSied:52 };
const _DR_OLD = { nrRej:4, marka:5, typ:6, vin:10, dataRej:48 };
const _FUEL = { P:'PB (Benzyna)', D:'ON (Olej napędowy)', M:'LNG (Metan)',
  LPG:'LPG', CNG:'CNG', LNG:'LNG', H:'Hybrydowy', BD:'Biodiesel', EE:'Elektryczny', E85:'E85' };

async function handleAztec(request) {
  let body; try { body = await request.json(); } catch { return err('Nieprawidłowe JSON'); }
  const { bytesBase64 } = body;
  if (!bytesBase64) return err('Brak bytesBase64');

  let bytes;
  try {
    const bin = atob(bytesBase64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch { return err('Nieprawidłowe base64'); }

  if (bytes.length < 8) return err('Za mało danych AZTEC (' + bytes.length + ' bajtów)');

  try {
    // Pierwsze 4 bajty: długość danych po dekompresji (little-endian uint32)
    const outputLen = bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] * 0x1000000);
    if (outputLen < 10 || outputLen > 131072) return err('Nieprawidłowa długość: ' + outputLen);

    const decompressed = _nrv2eDecompress(bytes.slice(4), outputLen);

    // Dekoduj UTF-16LE
    const text = new TextDecoder('utf-16le').decode(decompressed);
    const fields = text.split(/[|\n]/);

    // Nowy format ma >50 pól i zaczyna się od "XX"
    const isNew = fields.length > 40;
    const map = isNew ? _DR_NEW : _DR_OLD;

    const result = {};
    for (const [key, idx] of Object.entries(map)) {
      const v = (fields[idx] || '').trim().replace(/\r/g, '');
      if (v) result[key] = v;
    }

    // Normalizuj paliwo
    if (result.paliwo) result.paliwo = _FUEL[result.paliwo] || result.paliwo;

    // Normalizuj datę: YYYYMMDD lub YYYY-MM-DD → DD.MM.YYYY
    if (result.dataRej) {
      if (/^\d{8}$/.test(result.dataRej)) {
        result.dataRej = result.dataRej.slice(6,8)+'.'+result.dataRej.slice(4,6)+'.'+result.dataRej.slice(0,4);
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(result.dataRej)) {
        const [y,m,d] = result.dataRej.split('-');
        result.dataRej = d+'.'+m+'.'+y;
      }
    }

    return json({ ok: true, fields: result, fieldCount: fields.length, format: isNew ? 'new' : 'old' });
  } catch (e) {
    return err('Błąd dekodowania AZTEC: ' + e.message);
  }
}

// ─── AI VISION OCR ────────────────────────────────────────────────────────────
//
// OCR PIPELINE (kolejność priorytetów):
//   1. AZTEC 2D barcode  — handleAztec()        — 100% dokładność, ~50ms
//   2. CF Workers AI     — @cf/meta/llama-3.2-11b-vision-instruct — brak kosztów zewn., ~1-3s
//   3. Groq Vision (x4)  — llama-4-scout/maverick/llama-3.2-90b/11b — fallback, ~2-5s
//
// ROADMAP — przyszłe ulepszenia OCR (do wdrożenia gdy technologia dojrzeje):
//   A. Cloudflare AI Gateway  — cache odpowiedzi vision, rate-limiting, analytics, logs
//      https://developers.cloudflare.com/ai-gateway/
//   B. AWS Textract / Google Cloud Vision / Azure Document Intelligence
//      — dedykowane modele do dokumentów tabelarycznych (DR to tabelka), 99%+ accuracy
//      — warto porównać ceny przy wolumenie >1M dokumentów/miesiąc
//   C. PaddleOCR via WASM — gdy CF Worker WASM support dojrzeje (aktualnie brak pliku >3MB)
//      — open-source, lokalne przetwarzanie, zero latencji sieciowej
//   D. Fine-tuned model na polskich DR — Mistral/Llama fine-tune na zbiorze 10k+ skanów DR
//      — szacowany koszt treningu: ~$500-2000, zysk: 99.9% accuracy na polu F.1/F.2/G/VIN
//   E. Cloudflare Vectorize — wyszukiwanie pojazdów po cechach (embedding z danych DR)
//      — znajdowanie duplikatów VIN, wyszukiwanie podobnych pojazdów w flocie
//   F. Batch processing — kolejka D1/KV z harmonogramem przetwarzania DR dla dużych flot
//      — Cloudflare Queues (beta) lub Durable Objects jako koordynator kolejki
//
// Sanityzacja i walidacja pól zwróconych przez AI.
// Priorytet: zachowaj F.1 (DMC) — to pole kluczowe dla DT-1.
function _sanitizeOcrFields(f) {
  if (!f || typeof f !== 'object') return f;

  // nrRej: usuń spacje; musi zaczynać się od 2-3 wielkich liter (tablica polska)
  if (f.nrRej) {
    f.nrRej = String(f.nrRej).replace(/\s+/g, '').toUpperCase().slice(0, 10);
    if (!/^[A-Z]{2,3}[A-Z0-9]/.test(f.nrRej)) delete f.nrRej;
  }

  // D.2 (typ) to kod techniczny (SZN1E, R540) — NIE opis rodzaju pojazdu
  if (f.typ && /SAMOCH[OÓ]D|SPECJALN|OSOBOW|CI[ĘE][ZŻ]AR|CI[ĄA]GNIK|AUTOBUS/i.test(f.typ)) {
    delete f.typ;
  }

  const num = v => { const n = parseFloat(String(v || '').replace(/[^\d.]/g, '')); return isNaN(n) ? null : n; };
  const f1 = num(f.dmcKg), f2 = num(f.dmcKg2), g = num(f.masaWlKg);

  // G >= F.1: fizycznie niemożliwe — ZAWSZE usuwamy G, nigdy F.1 (F.1 = podstawa podatku DT-1)
  if (f1 !== null && g !== null && g >= f1) delete f.masaWlKg;

  // F.1 << F.2 przy dużych wartościach: F.2 nie może być > 3x F.1 (byłoby nielogiczne)
  if (f1 !== null && f2 !== null && f1 < f2 * 0.3 && f2 > 5000) delete f.dmcKg;

  // O.1 >= O.2: przyczepa hamowana zawsze ma wyższą dop. masę niż niehamowana
  const o1 = num(f.dmcPrzyczHam), o2 = num(f.dmcPrzyczNieham);
  if (o1 !== null && o2 !== null && o1 < o2) {
    [f.dmcPrzyczHam, f.dmcPrzyczNieham] = [String(o2), String(o1)];
  }

  // dataRej: odrzuć daty z przyszłości (termin przeglądu, nie data rejestracji)
  if (f.dataRej) {
    const parts = String(f.dataRej).split('.');
    if (parts.length === 3) {
      const y = parseInt(parts[2]);
      if (y > new Date().getFullYear()) delete f.dataRej;
    }
  }

  return f;
}

async function handleAIOCR(request, env) {
  if (request.method !== 'POST') return err('Method not allowed', 405);
  let body; try { body = await request.json(); } catch { return err('Nieprawidłowe JSON'); }
  const { imageBase64, mimeType = 'image/jpeg' } = body;
  if (!imageBase64) return err('Brak obrazu (imageBase64)');

  const prompt = `Jestes ekspertem od polskich Dowodow Rejestracyjnych (DR). Dokument ma 3 sekcje: bezowa (homologacja), zolta tabela (dane rejestracyjne) i niebieska (dane pojazdu). Wyodrebnij pola TYLKO z oznaczeniami literowymi A/B/D.1/D.2/E/F.1/F.2/F.3/G/J/K/L/O.1/O.2/P.1/P.2/P.3/S.1.
Zwroc WYLACZNIE JSON bez markdown:
{"nrRej":"A — numer rejestracyjny np WPR0365T lub WA0677L (2-3 wielkie litery + cyfry/litery, BEZ spacji)","dataRej":"B — data PIERWSZEJ rejestracji DD.MM.RRRR (nie termin przegladu)","marka":"D.1 — marka np MAN lub SCANIA","typ":"D.2 — kod techniczny np SZN1E lub R490 (NIE SAMOCHOD SPECJALNY ani opis rodzaju)","vin":"E — 17 znakow VIN","dmcKg":"F.1 — DMC kg z ZOLTEJ tabeli (jesli dwie wartosci F.1 wybierz WIEKSZA)","dmcKg2":"F.2 — DMC z ladunkiem kg","dmcZespolu":"F.3 — DMC zespolu kg (>= F.1)","masaWlKg":"G — masa wlasna kg (MUSI byc mniejsza niz F.1)","liczbaOsi":"L — liczba osi 1-5","kategoria":"J — kategoria np N1 N2 N3 M1","pojSilnika":"P.1 — pojemnosc cm3 tylko cyfry","mocKW":"P.2 — moc kW tylko cyfry","paliwo":"P.3 — D lub B lub G","miejscaSied":"S.1 — miejsca siedzace cyfra","rokProd":"rok produkcji 4 cyfry","dmcPrzyczHam":"O.1 — masa przyczepy z hamulcem kg","dmcPrzyczNieham":"O.2 — masa przyczepy bez hamulca kg (< O.1)","nrHomolog":"K — nr homologacji np e32*IV18/858*NI15391"}`;

  // ── Próba 0: Python PaddleOCR Service (najdokładniejszy — przestrzenne bounding boxy) ──
  if (env.OCR_PYTHON_URL) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (env.OCR_PYTHON_SECRET) headers['X-Api-Key'] = env.OCR_PYTHON_SECRET;
      const pyResp = await fetch(env.OCR_PYTHON_URL.replace(/\/$/, '') + '/ocr', {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageBase64, mimeType }),
        signal: AbortSignal.timeout(30000),
      });
      if (pyResp.ok) {
        const pyData = await pyResp.json();
        if (pyData.ok && pyData.fields && (pyData.fields.nrRej || pyData.fields.vin || pyData.fields.dmcKg)) {
          return json({ ok: true, fields: _sanitizeOcrFields(pyData.fields), model: 'paddleocr' });
        }
      }
    } catch (e) { /* fall through — Python service niedostępny */ }
  }

  // ── Próba 1: Cloudflare Workers AI (primarna, bez kosztów zewnętrznych API) ──
  if (env.AI) {
    try {
      const bin = atob(imageBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const cfResult = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
        prompt,
        image: [...bytes],
        max_tokens: 768,
      });
      const answer = cfResult?.response || '';
      const jm = answer.match(/\{[\s\S]*\}/);
      if (jm) {
        const fields = _sanitizeOcrFields(JSON.parse(jm[0]));
        if (fields.nrRej || fields.vin || fields.marka || fields.dmcKg) {
          return json({ ok: true, fields, model: 'cf-workers-ai-llama-3.2-11b' });
        }
      }
    } catch (e) { /* fall through to Groq */ }
  }

  // ── Próba 2: Groq Vision — 4-modelowy łańcuch fallback ───────────────────────
  if (!env.GROQ_API_KEY) return err('Brak CF AI i GROQ_API_KEY', 503);

  const messages = [{
    role: 'user',
    content: [
      { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
      { type: 'text', text: prompt },
    ],
  }];

  const visionModels = [
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
    'llama-3.2-90b-vision-preview',
    'llama-3.2-11b-vision-preview',
  ];
  let lastErr = 'Brak działającego modelu vision';
  for (const model of visionModels) {
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.GROQ_API_KEY },
        body: JSON.stringify({ model, messages, max_tokens: 512, temperature: 0.1 }),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        lastErr = `${model}: ${e.error?.message || resp.statusText}`;
        continue;
      }
      const data = await resp.json();
      const answer = data.choices?.[0]?.message?.content || '';
      const jm = answer.match(/\{[\s\S]*\}/);
      if (!jm) { lastErr = 'AI nie zwróciło JSON: ' + answer.slice(0, 100); continue; }
      return json({ ok: true, fields: _sanitizeOcrFields(JSON.parse(jm[0])), model });
    } catch (e) {
      lastErr = `${model}: ${e?.message}`;
    }
  }
  return err('Błąd AI Vision: ' + lastErr, 502);
}

// ─── MAIN FETCH ───────────────────────────────────────────────────────────────
async function handleRequest(request, env, url, path) {
  // Public endpoints (no auth required)
  if (path === '/api/auth/login'            && request.method === 'POST') return handleLogin(request, env);
  if (path === '/api/auth/setup'            && request.method === 'GET')  return handleSetup(request);
  if (path === '/api/auth/logout'           && request.method === 'POST') return handleLogout(request, env);
  if (path === '/api/push/vapid-public-key' && request.method === 'GET')  return handleVapidPublicKey(request, env);
  if (path === '/api/push/subscribe'        && request.method === 'POST') return handlePushSubscribe(request, env);
  if (path === '/api/push/subscribe'        && request.method === 'DELETE') return handlePushUnsubscribe(request, env);

  // Protected endpoints
  const user = await getUser(request, env);

  if (path === '/api/auth/me')                    return json(safeUser(user));
  if (path === '/api/users/me/password' && request.method === 'PUT') {
    if (!user) return err('Nieautoryzowany — zaloguj się', 401);
    return handleChangeMyPassword(request, env, user);
  }
  if (path.startsWith('/api/vehicles')) { if (!user) return err('Nieautoryzowany', 401); return handleVehicles(request, env, user, url, path); }
  if (path.startsWith('/api/state/'))   { if (!user) return err('Nieautoryzowany', 401); return handleState(request, env, user, url, path); }
  if (path.startsWith('/api/prefs'))    { if (!user) return err('Nieautoryzowany', 401); return handlePrefs(request, env, user); }
  if (path.startsWith('/api/docs'))     { if (!user) return err('Nieautoryzowany', 401); return handleDocs(request, env, user, url, path); }
  if (path.startsWith('/api/users'))    { if (!user) return err('Nieautoryzowany', 401); return handleUsers(request, env, user, url, path); }
  if (path === '/api/ai/chat')          return handleAI(request, env);
  if (path === '/api/ai/ocr' && request.method === 'POST') return handleAIOCR(request, env);
  if (path === '/api/aztec'  && request.method === 'POST') return handleAztec(request);

  // Push (authenticated parts)
  if (path === '/api/push/generate-keys' && request.method === 'GET') {
    if (!user) return err('Nieautoryzowany', 401);
    return handleGenerateVapidKeys(request, env, user);
  }
  if (path === '/api/push/send' && request.method === 'POST') return handlePushSend(request, env, user);

  return err('Endpoint nie istnieje', 404);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url  = new URL(request.url);
    const path = url.pathname;

    let resp;
    try {
      resp = await handleRequest(request, env, url, path);
    } catch (e) {
      console.error('[Worker error]', e?.stack || e?.message);
      resp = json({ error: 'Błąd serwera: ' + (e?.message || 'unknown') }, 500);
    }

    // Gwarancja CORS na każdej odpowiedzi
    const headers = new Headers(resp.headers);
    Object.entries(CORS).forEach(([k, v]) => headers.set(k, v));
    return new Response(resp.body, { status: resp.status, headers });
  },

  // Cron trigger (wrangler.toml: crons = ["0 3 * * *"])
  async scheduled(event, env, ctx) {
    ctx.waitUntil(cleanSessions(env));
  },
};
