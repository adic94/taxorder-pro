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
// Stała sól używana przed wprowadzeniem soli per-użytkownik — TYLKO do weryfikacji starych hashy (nie używać do nowych).
const LEGACY_SALT = 'taxorder-cf-2025';

function genSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

async function hashPwd(password, salt) {
  if (!salt) throw new Error('hashPwd: brak soli');
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
// Jeśli `salt` jest puste (konto sprzed wprowadzenia soli per-użytkownik), weryfikuje względem starej stałej soli.
async function verifyPwd(password, storedHash, salt) {
  return (await hashPwd(password, salt || LEGACY_SALT)) === storedHash;
}

// ─── KLUCZE API (uwierzytelnianie maszyna-maszyna) ────────────────────────────
function genApiKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const b64url = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return 'tord_live_' + b64url;
}
async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
async function getUser(request, env) {
  const auth = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!auth) return null;
  if (auth.startsWith('tord_')) return getApiKeyUser(auth, env);
  return env.DB.prepare(
    `SELECT u.* FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token = ? AND s.expires_at > datetime('now') AND u.active = 1`
  ).bind(auth).first();
}

async function getApiKeyUser(token, env) {
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND active = 1').bind(hash).first();
  if (!row) return null;
  env.DB.prepare('UPDATE api_keys SET last_used_at = datetime(\'now\') WHERE id = ?').bind(row.id).run().catch(() => {});
  return {
    id: 'apikey:' + row.id,
    role: row.scope === 'read_write' ? 'admin' : 'viewer',
    company_id: row.company_id,
    active: 1,
    _apiKey: true,
    api_key_id: row.id,
    api_key_name: row.name,
    api_key_scope: row.scope,
  };
}

function safeUser(u) {
  if (!u) return null;
  const { password_hash, salt, ...rest } = u;
  return rest;
}

// ─── AUTH HANDLERS ────────────────────────────────────────────────────────────
// Rate-limiting logowania: max 5 nieudanych prób / 15 min, liczone per (IP, email) w KV PREFS
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_SECONDS = 15 * 60;

async function handleLogin(req, env) {
  let body;
  try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
  const { email, password } = body;
  if (!email || !password) return err('Podaj email i hasło');

  const emailLc = email.toLowerCase();
  const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = `loginfail:${ip}:${emailLc}`;
  let attempts = 0;
  if (env.PREFS) {
    attempts = parseInt(await env.PREFS.get(rlKey)) || 0;
    if (attempts >= LOGIN_MAX_ATTEMPTS) {
      return err('Zbyt wiele nieudanych prób logowania. Spróbuj ponownie za kilkanaście minut.', 429);
    }
  }

  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE email = ? AND active = 1'
  ).bind(emailLc).first();

  if (!user || !(await verifyPwd(password, user.password_hash, user.salt))) {
    if (env.PREFS) {
      await env.PREFS.put(rlKey, String(attempts + 1), { expirationTtl: LOGIN_LOCKOUT_SECONDS });
    }
    return err('Nieprawidłowy email lub hasło', 401);
  }

  if (env.PREFS) await env.PREFS.delete(rlKey).catch(() => {});

  // Leniwa migracja: konto sprzed wprowadzenia soli per-użytkownik — dorzuć losową sól przy okazji udanego logowania
  if (!user.salt) {
    const newSalt = genSalt();
    const newHash = await hashPwd(password, newSalt);
    await env.DB.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').bind(newHash, newSalt, user.id).run();
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

// ─── SZKODY (DAMAGE REPORTS) ───────────────────────────────────────────────────
async function handleDamages(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean); // ['api','damages',...]

  // GET /api/damages?company=&nrRej= — lista (cała flota lub jeden pojazd)
  if (req.method === 'GET' && segs.length === 2) {
    const company = url.searchParams.get('company') || 'mtoilet';
    const nrRej   = url.searchParams.get('nrRej');
    const rows = nrRej
      ? await env.DB.prepare('SELECT * FROM damage_reports WHERE company_id=? AND nr_rej=? ORDER BY data_zdarzenia DESC, created_at DESC').bind(company, nrRej).all()
      : await env.DB.prepare('SELECT * FROM damage_reports WHERE company_id=? ORDER BY data_zdarzenia DESC, created_at DESC').bind(company).all();
    const reports = rows.results || [];
    if (reports.length) {
      const ids = reports.map(r => r.id);
      const placeholders = ids.map(() => '?').join(',');
      const photoRows = await env.DB.prepare(
        `SELECT id, damage_id, r2_key, mime_type FROM damage_photos WHERE damage_id IN (${placeholders})`
      ).bind(...ids).all();
      const byDamage = {};
      (photoRows.results || []).forEach(p => { (byDamage[p.damage_id] ||= []).push(p); });
      reports.forEach(r => { r.photos = byDamage[r.id] || []; });
    }
    return json(reports);
  }

  // POST /api/damages — utworzenie zgłoszenia (JSON)
  if (req.method === 'POST' && segs.length === 2) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const company = body.company_id || 'mtoilet';
    if (!body.nr_rej) return err('Wymagane: nr_rej');
    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO damage_reports(id,company_id,nr_rej,opis,przyczyna,data_zdarzenia,status,koszt,zglaszajacy,uwagi)
      VALUES(?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      id, company, body.nr_rej, body.opis || null, body.przyczyna || null,
      body.data_zdarzenia || null, body.status || 'ZGLOSZONA',
      body.koszt != null ? Number(body.koszt) : null, body.zglaszajacy || null, body.uwagi || null
    ).run();
    return json({ ok: true, id });
  }

  // POST /api/damages/:id/photo — upload zdjęcia (FormData)
  if (req.method === 'POST' && segs[2] && segs[3] === 'photo') {
    const damageId = segs[2];
    const report = await env.DB.prepare('SELECT company_id, nr_rej FROM damage_reports WHERE id=?').bind(damageId).first();
    if (!report) return err('Zgłoszenie nie znalezione', 404);
    let fd; try { fd = await req.formData(); } catch { return err('Wymagany FormData'); }
    const file = fd.get('file');
    if (!file) return err('Wymagane: file');
    const photoId = crypto.randomUUID();
    const r2Key = `damage/${report.company_id}/${report.nr_rej}/${damageId}/${photoId}`;
    await env.DOCS.put(r2Key, file.stream(), {
      httpMetadata: { contentType: file.type || 'image/jpeg' },
    });
    await env.DB.prepare(
      'INSERT INTO damage_photos(id,damage_id,r2_key,mime_type) VALUES(?,?,?,?)'
    ).bind(photoId, damageId, r2Key, file.type || 'image/jpeg').run();
    return json({ ok: true, id: photoId, key: r2Key });
  }

  // PUT /api/damages/:id — edycja / zmiana statusu
  if (req.method === 'PUT' && segs[2]) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    await env.DB.prepare(`
      UPDATE damage_reports SET
        opis=?, przyczyna=?, data_zdarzenia=?, status=?, koszt=?, zglaszajacy=?, uwagi=?, updated_at=datetime('now')
      WHERE id=?`
    ).bind(
      body.opis || null, body.przyczyna || null, body.data_zdarzenia || null,
      body.status || 'ZGLOSZONA', body.koszt != null ? Number(body.koszt) : null,
      body.zglaszajacy || null, body.uwagi || null, segs[2]
    ).run();
    return json({ ok: true });
  }

  // DELETE /api/damages/photo/:photoId — usuń pojedyncze zdjęcie
  if (req.method === 'DELETE' && segs[2] === 'photo' && segs[3]) {
    const row = await env.DB.prepare('SELECT r2_key FROM damage_photos WHERE id=?').bind(segs[3]).first();
    if (row) {
      await Promise.all([
        env.DOCS.delete(row.r2_key),
        env.DB.prepare('DELETE FROM damage_photos WHERE id=?').bind(segs[3]).run(),
      ]);
    }
    return json({ ok: true });
  }

  // DELETE /api/damages/:id — usuń zgłoszenie (kaskadowo zdjęcia D1 + R2)
  if (req.method === 'DELETE' && segs[2]) {
    const photoRows = await env.DB.prepare('SELECT r2_key FROM damage_photos WHERE damage_id=?').bind(segs[2]).all();
    await Promise.all((photoRows.results || []).map(p => env.DOCS.delete(p.r2_key)));
    await env.DB.prepare('DELETE FROM damage_reports WHERE id=?').bind(segs[2]).run(); // ON DELETE CASCADE usuwa damage_photos
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── OPONY — MAGAZYN I CYKL ŻYCIA ──────────────────────────────────────────────
async function handleTires(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean); // ['api','tires',...]

  // GET /api/tires?company=&status=&nrRej=
  if (req.method === 'GET' && segs.length === 2) {
    const company = url.searchParams.get('company') || 'mtoilet';
    const status  = url.searchParams.get('status');
    const nrRej   = url.searchParams.get('nrRej');
    let sql = 'SELECT * FROM tires WHERE company_id=?';
    const params = [company];
    if (status) { sql += ' AND status=?'; params.push(status); }
    if (nrRej)  { sql += ' AND nr_rej=?';  params.push(nrRej); }
    sql += ' ORDER BY updated_at DESC';
    const rows = await env.DB.prepare(sql).bind(...params).all();
    return json((rows.results || []).map(r => ({ ...r, historia: JSON.parse(r.historia || '[]') })));
  }

  // POST /api/tires — nowa opona (domyślnie do magazynu)
  if (req.method === 'POST' && segs.length === 2) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const company = body.company_id || 'mtoilet';
    const id = crypto.randomUUID();
    const historia = [{ data: new Date().toISOString(), akcja: 'UTWORZONA', nrRej: null, pozycja: null }];
    await env.DB.prepare(`
      INSERT INTO tires(id,company_id,status,nr_rej,pozycja,rozmiar,marka,dot,bieznik_mm,sezon,lokalizacja_magazyn,data_zakupu,uwagi,historia)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      id, company, 'MAGAZYN', null, null,
      body.rozmiar || null, body.marka || null, body.dot || null,
      body.bieznik_mm != null ? Number(body.bieznik_mm) : null, body.sezon || null,
      body.lokalizacja_magazyn || null, body.data_zakupu || null, body.uwagi || null,
      JSON.stringify(historia)
    ).run();
    return json({ ok: true, id });
  }

  // PUT /api/tires/:id — edycja pól LUB akcja mount/unmount/scrap
  if (req.method === 'PUT' && segs[2]) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const row = await env.DB.prepare('SELECT * FROM tires WHERE id=?').bind(segs[2]).first();
    if (!row) return err('Opona nie znaleziona', 404);
    const historia = JSON.parse(row.historia || '[]');

    if (body.akcja === 'ZAMONTUJ') {
      if (!body.nr_rej || !body.pozycja) return err('Wymagane: nr_rej, pozycja');
      historia.push({ data: new Date().toISOString(), akcja: 'ZAMONTOWANA', nrRej: body.nr_rej, pozycja: body.pozycja });
      await env.DB.prepare(`UPDATE tires SET status='ZAMONTOWANA', nr_rej=?, pozycja=?, historia=?, updated_at=datetime('now') WHERE id=?`)
        .bind(body.nr_rej, body.pozycja, JSON.stringify(historia), segs[2]).run();
      return json({ ok: true });
    }
    if (body.akcja === 'ZDEMONTUJ') {
      historia.push({ data: new Date().toISOString(), akcja: 'ZDEMONTOWANA', nrRej: row.nr_rej, pozycja: row.pozycja });
      await env.DB.prepare(`UPDATE tires SET status='MAGAZYN', nr_rej=NULL, pozycja=NULL, lokalizacja_magazyn=?, historia=?, updated_at=datetime('now') WHERE id=?`)
        .bind(body.lokalizacja_magazyn || row.lokalizacja_magazyn || null, JSON.stringify(historia), segs[2]).run();
      return json({ ok: true });
    }
    if (body.akcja === 'ZLOMUJ') {
      historia.push({ data: new Date().toISOString(), akcja: 'ZLOMOWANA', nrRej: row.nr_rej, pozycja: row.pozycja });
      await env.DB.prepare(`UPDATE tires SET status='ZLOMOWANA', nr_rej=NULL, pozycja=NULL, historia=?, updated_at=datetime('now') WHERE id=?`)
        .bind(JSON.stringify(historia), segs[2]).run();
      return json({ ok: true });
    }

    // Zwykła edycja pól (bez zmiany statusu/pozycji)
    await env.DB.prepare(`
      UPDATE tires SET rozmiar=?, marka=?, dot=?, bieznik_mm=?, sezon=?, lokalizacja_magazyn=?, data_zakupu=?, uwagi=?, updated_at=datetime('now')
      WHERE id=?`
    ).bind(
      body.rozmiar ?? row.rozmiar, body.marka ?? row.marka, body.dot ?? row.dot,
      body.bieznik_mm != null ? Number(body.bieznik_mm) : row.bieznik_mm, body.sezon ?? row.sezon,
      body.lokalizacja_magazyn ?? row.lokalizacja_magazyn, body.data_zakupu ?? row.data_zakupu,
      body.uwagi ?? row.uwagi, segs[2]
    ).run();
    return json({ ok: true });
  }

  // DELETE /api/tires/:id
  if (req.method === 'DELETE' && segs[2]) {
    await env.DB.prepare('DELETE FROM tires WHERE id=?').bind(segs[2]).run();
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── ZLECENIA SERWISOWE ─────────────────────────────────────────────────────────
async function handleServiceOrders(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean); // ['api','service-orders',...]

  // GET /api/service-orders?company=&nrRej=&status=
  if (req.method === 'GET' && segs.length === 2) {
    const company = url.searchParams.get('company') || 'mtoilet';
    const nrRej   = url.searchParams.get('nrRej');
    const status  = url.searchParams.get('status');
    let sql = 'SELECT * FROM service_orders WHERE company_id=?';
    const params = [company];
    if (nrRej)  { sql += ' AND nr_rej=?'; params.push(nrRej); }
    if (status) { sql += ' AND status=?'; params.push(status); }
    sql += ' ORDER BY created_at DESC';
    const rows = await env.DB.prepare(sql).bind(...params).all();
    return json(rows.results || []);
  }

  // POST /api/service-orders — nowe zgłoszenie
  if (req.method === 'POST' && segs.length === 2) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const company = body.company_id || 'mtoilet';
    if (!body.nr_rej) return err('Wymagane: nr_rej');
    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO service_orders(id,company_id,nr_rej,typ,opis,zglaszajacy,status,koszt_szacowany,warsztat)
      VALUES(?,?,?,?,?,?,?,?,?)`
    ).bind(
      id, company, body.nr_rej, body.typ || null, body.opis || null, body.zglaszajacy || null,
      'ZGLOSZONE', body.koszt_szacowany != null ? Number(body.koszt_szacowany) : null, body.warsztat || null
    ).run();
    return json({ ok: true, id });
  }

  // PUT /api/service-orders/:id — edycja LUB akcja AUTORYZUJ/ODRZUC/ZREALIZUJ
  if (req.method === 'PUT' && segs[2]) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const row = await env.DB.prepare('SELECT * FROM service_orders WHERE id=?').bind(segs[2]).first();
    if (!row) return err('Zlecenie nie znalezione', 404);

    if (body.akcja === 'AUTORYZUJ') {
      await env.DB.prepare(`UPDATE service_orders SET status='AUTORYZOWANE', autoryzowal=?, data_autoryzacji=datetime('now'), updated_at=datetime('now') WHERE id=?`)
        .bind(body.autoryzowal || null, segs[2]).run();
      return json({ ok: true });
    }
    if (body.akcja === 'ODRZUC') {
      await env.DB.prepare(`UPDATE service_orders SET status='ODRZUCONE', powod_odrzucenia=?, updated_at=datetime('now') WHERE id=?`)
        .bind(body.powod_odrzucenia || null, segs[2]).run();
      return json({ ok: true });
    }
    if (body.akcja === 'ZREALIZUJ') {
      if (row.status !== 'AUTORYZOWANE') return err('Zlecenie musi być najpierw autoryzowane', 409);
      await env.DB.prepare(`
        UPDATE service_orders SET status='ZREALIZOWANE', data_realizacji=?, km_realizacji=?, koszt_rzeczywisty=?,
          nastepny_termin=?, nastepny_km=?, updated_at=datetime('now') WHERE id=?`
      ).bind(
        body.data_realizacji || null, body.km_realizacji != null ? Number(body.km_realizacji) : null,
        body.koszt_rzeczywisty != null ? Number(body.koszt_rzeczywisty) : null,
        body.nastepny_termin || null, body.nastepny_km != null ? Number(body.nastepny_km) : null, segs[2]
      ).run();
      return json({ ok: true });
    }

    // Zwykła edycja pól (przed autoryzacją)
    await env.DB.prepare(`
      UPDATE service_orders SET typ=?, opis=?, zglaszajacy=?, koszt_szacowany=?, warsztat=?, uwagi=?, updated_at=datetime('now')
      WHERE id=?`
    ).bind(
      body.typ ?? row.typ, body.opis ?? row.opis, body.zglaszajacy ?? row.zglaszajacy,
      body.koszt_szacowany != null ? Number(body.koszt_szacowany) : row.koszt_szacowany,
      body.warsztat ?? row.warsztat, body.uwagi ?? row.uwagi, segs[2]
    ).run();
    return json({ ok: true });
  }

  // DELETE /api/service-orders/:id
  if (req.method === 'DELETE' && segs[2]) {
    await env.DB.prepare('DELETE FROM service_orders WHERE id=?').bind(segs[2]).run();
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── PROTOKOŁY ZDAWCZO-ODBIORCZE ────────────────────────────────────────────────
async function handleProtocols(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean); // ['api','protocols',...]

  // GET /api/protocols?company=&nrRej=
  if (req.method === 'GET' && segs.length === 2) {
    const company = url.searchParams.get('company') || 'mtoilet';
    const nrRej   = url.searchParams.get('nrRej');
    const rows = nrRej
      ? await env.DB.prepare('SELECT * FROM handover_protocols WHERE company_id=? AND nr_rej=? ORDER BY data DESC').bind(company, nrRej).all()
      : await env.DB.prepare('SELECT * FROM handover_protocols WHERE company_id=? ORDER BY data DESC').bind(company).all();
    const protocols = rows.results || [];
    if (protocols.length) {
      const ids = protocols.map(p => p.id);
      const placeholders = ids.map(() => '?').join(',');
      const photoRows = await env.DB.prepare(
        `SELECT id, protocol_id, r2_key, mime_type FROM protocol_photos WHERE protocol_id IN (${placeholders})`
      ).bind(...ids).all();
      const byProtocol = {};
      (photoRows.results || []).forEach(p => { (byProtocol[p.protocol_id] ||= []).push(p); });
      protocols.forEach(p => { p.photos = byProtocol[p.id] || []; p.wyposazenie = JSON.parse(p.wyposazenie || '[]'); });
    }
    return json(protocols);
  }

  // POST /api/protocols — nowy protokół
  if (req.method === 'POST' && segs.length === 2) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const company = body.company_id || 'mtoilet';
    if (!body.nr_rej) return err('Wymagane: nr_rej');
    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO handover_protocols(id,company_id,nr_rej,typ,data,osoba_wydajaca,osoba_odbierajaca,
        stan_licznika,stan_paliwa,wyposazenie,uszkodzenia_opis,uwagi,podpis_wydajacy,podpis_odbierajacy)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      id, company, body.nr_rej, body.typ || 'WYDANIE', body.data || new Date().toISOString(),
      body.osoba_wydajaca || null, body.osoba_odbierajaca || null,
      body.stan_licznika != null ? Number(body.stan_licznika) : null, body.stan_paliwa || null,
      JSON.stringify(body.wyposazenie || []), body.uszkodzenia_opis || null, body.uwagi || null,
      body.podpis_wydajacy || null, body.podpis_odbierajacy || null
    ).run();
    return json({ ok: true, id });
  }

  // POST /api/protocols/:id/photo — upload zdjęcia (FormData)
  if (req.method === 'POST' && segs[2] && segs[3] === 'photo') {
    const protocolId = segs[2];
    const protocol = await env.DB.prepare('SELECT company_id, nr_rej FROM handover_protocols WHERE id=?').bind(protocolId).first();
    if (!protocol) return err('Protokół nie znaleziony', 404);
    let fd; try { fd = await req.formData(); } catch { return err('Wymagany FormData'); }
    const file = fd.get('file');
    if (!file) return err('Wymagane: file');
    const photoId = crypto.randomUUID();
    const r2Key = `protocol/${protocol.company_id}/${protocol.nr_rej}/${protocolId}/${photoId}`;
    await env.DOCS.put(r2Key, file.stream(), {
      httpMetadata: { contentType: file.type || 'image/jpeg' },
    });
    await env.DB.prepare(
      'INSERT INTO protocol_photos(id,protocol_id,r2_key,mime_type) VALUES(?,?,?,?)'
    ).bind(photoId, protocolId, r2Key, file.type || 'image/jpeg').run();
    return json({ ok: true, id: photoId, key: r2Key });
  }

  // PUT /api/protocols/:id — edycja
  if (req.method === 'PUT' && segs[2]) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const row = await env.DB.prepare('SELECT * FROM handover_protocols WHERE id=?').bind(segs[2]).first();
    if (!row) return err('Protokół nie znaleziony', 404);
    await env.DB.prepare(`
      UPDATE handover_protocols SET typ=?, data=?, osoba_wydajaca=?, osoba_odbierajaca=?, stan_licznika=?,
        stan_paliwa=?, wyposazenie=?, uszkodzenia_opis=?, uwagi=?, podpis_wydajacy=?, podpis_odbierajacy=?
      WHERE id=?`
    ).bind(
      body.typ ?? row.typ, body.data ?? row.data, body.osoba_wydajaca ?? row.osoba_wydajaca,
      body.osoba_odbierajaca ?? row.osoba_odbierajaca,
      body.stan_licznika != null ? Number(body.stan_licznika) : row.stan_licznika,
      body.stan_paliwa ?? row.stan_paliwa,
      body.wyposazenie ? JSON.stringify(body.wyposazenie) : row.wyposazenie,
      body.uszkodzenia_opis ?? row.uszkodzenia_opis, body.uwagi ?? row.uwagi,
      body.podpis_wydajacy ?? row.podpis_wydajacy, body.podpis_odbierajacy ?? row.podpis_odbierajacy,
      segs[2]
    ).run();
    return json({ ok: true });
  }

  // DELETE /api/protocols/:id — kaskadowo usuwa zdjęcia D1 + R2
  if (req.method === 'DELETE' && segs[2]) {
    const photoRows = await env.DB.prepare('SELECT r2_key FROM protocol_photos WHERE protocol_id=?').bind(segs[2]).all();
    await Promise.all((photoRows.results || []).map(p => env.DOCS.delete(p.r2_key)));
    await env.DB.prepare('DELETE FROM handover_protocols WHERE id=?').bind(segs[2]).run();
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── KLIENCI CFM (zewnętrzni, spoza COMPANIES) ─────────────────────────────────
async function handleCfmClients(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean); // ['api','cfm-clients',...]

  if (req.method === 'GET' && segs.length === 2) {
    const company = url.searchParams.get('company') || 'mtoilet';
    const rows = await env.DB.prepare('SELECT * FROM cfm_clients WHERE company_id=? ORDER BY nazwa').bind(company).all();
    return json(rows.results || []);
  }

  if (req.method === 'POST' && segs.length === 2) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const company = body.company_id || 'mtoilet';
    if (!body.nazwa) return err('Wymagane: nazwa');
    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO cfm_clients(id,company_id,nazwa,nip,regon,ulica,kod,miasto,email,telefon,osoba_kontaktowa,uwagi)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      id, company, body.nazwa, body.nip || null, body.regon || null, body.ulica || null,
      body.kod || null, body.miasto || null, body.email || null, body.telefon || null,
      body.osoba_kontaktowa || null, body.uwagi || null
    ).run();
    return json({ ok: true, id });
  }

  if (req.method === 'PUT' && segs[2]) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const row = await env.DB.prepare('SELECT * FROM cfm_clients WHERE id=?').bind(segs[2]).first();
    if (!row) return err('Klient nie znaleziony', 404);
    await env.DB.prepare(`
      UPDATE cfm_clients SET nazwa=?, nip=?, regon=?, ulica=?, kod=?, miasto=?, email=?, telefon=?, osoba_kontaktowa=?, uwagi=?, updated_at=datetime('now')
      WHERE id=?`
    ).bind(
      body.nazwa ?? row.nazwa, body.nip ?? row.nip, body.regon ?? row.regon, body.ulica ?? row.ulica,
      body.kod ?? row.kod, body.miasto ?? row.miasto, body.email ?? row.email, body.telefon ?? row.telefon,
      body.osoba_kontaktowa ?? row.osoba_kontaktowa, body.uwagi ?? row.uwagi, segs[2]
    ).run();
    return json({ ok: true });
  }

  if (req.method === 'DELETE' && segs[2]) {
    await env.DB.prepare('DELETE FROM cfm_clients WHERE id=?').bind(segs[2]).run();
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── KONTRAKTY CFM (1 pojazd = 1 kontrakt) ─────────────────────────────────────
async function handleCfmContracts(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean); // ['api','cfm-contracts',...]

  if (req.method === 'GET' && segs.length === 2) {
    const company    = url.searchParams.get('company') || 'mtoilet';
    const clientType = url.searchParams.get('clientType');
    const clientRef  = url.searchParams.get('clientRef');
    const nrRej      = url.searchParams.get('nrRej');
    const status     = url.searchParams.get('status');
    let sql = 'SELECT * FROM cfm_contracts WHERE company_id=?';
    const params = [company];
    if (clientType) { sql += ' AND client_type=?'; params.push(clientType); }
    if (clientRef)  { sql += ' AND client_ref=?';  params.push(clientRef); }
    if (nrRej)      { sql += ' AND nr_rej=?';      params.push(nrRej); }
    if (status)     { sql += ' AND status=?';      params.push(status); }
    sql += ' ORDER BY created_at DESC';
    const rows = await env.DB.prepare(sql).bind(...params).all();
    return json(rows.results || []);
  }

  if (req.method === 'POST' && segs.length === 2) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const company = body.company_id || 'mtoilet';
    if (!body.nr_rej || !body.client_type || !body.client_ref) return err('Wymagane: nr_rej, client_type, client_ref');
    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO cfm_contracts(id,company_id,nr_rej,client_type,client_ref,client_name_cache,typ_umowy,
        data_od,data_do,stawka_miesieczna,dzien_platnosci,refakturowanie_kosztow,status,uwagi)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      id, company, body.nr_rej, body.client_type, body.client_ref, body.client_name_cache || null,
      body.typ_umowy || 'NAJEM', body.data_od || null, body.data_do || null,
      body.stawka_miesieczna != null ? Number(body.stawka_miesieczna) : null,
      body.dzien_platnosci != null ? Number(body.dzien_platnosci) : 10,
      body.refakturowanie_kosztow ? 1 : 0, 'AKTYWNY', body.uwagi || null
    ).run();
    return json({ ok: true, id });
  }

  if (req.method === 'PUT' && segs[2]) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const row = await env.DB.prepare('SELECT * FROM cfm_contracts WHERE id=?').bind(segs[2]).first();
    if (!row) return err('Kontrakt nie znaleziony', 404);
    await env.DB.prepare(`
      UPDATE cfm_contracts SET typ_umowy=?, data_od=?, data_do=?, stawka_miesieczna=?, dzien_platnosci=?,
        refakturowanie_kosztow=?, status=?, uwagi=?, updated_at=datetime('now')
      WHERE id=?`
    ).bind(
      body.typ_umowy ?? row.typ_umowy, body.data_od ?? row.data_od, body.data_do ?? row.data_do,
      body.stawka_miesieczna != null ? Number(body.stawka_miesieczna) : row.stawka_miesieczna,
      body.dzien_platnosci != null ? Number(body.dzien_platnosci) : row.dzien_platnosci,
      body.refakturowanie_kosztow != null ? (body.refakturowanie_kosztow ? 1 : 0) : row.refakturowanie_kosztow,
      body.status ?? row.status, body.uwagi ?? row.uwagi, segs[2]
    ).run();
    return json({ ok: true });
  }

  if (req.method === 'DELETE' && segs[2]) {
    await env.DB.prepare('DELETE FROM cfm_contracts WHERE id=?').bind(segs[2]).run();
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── FAKTURY CFM (zbiorcze per klient+okres, z refakturowaniem kosztów) ────────
const _VAT = 23;
const _num2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

async function handleCfmInvoices(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean); // ['api','cfm-invoices',...]

  // GET /api/cfm-invoices?company=&clientType=&clientRef=&okres=
  if (req.method === 'GET' && segs.length === 2) {
    const company    = url.searchParams.get('company') || 'mtoilet';
    const clientType = url.searchParams.get('clientType');
    const clientRef  = url.searchParams.get('clientRef');
    const okres      = url.searchParams.get('okres');
    let sql = 'SELECT * FROM cfm_invoices WHERE company_id=?';
    const params = [company];
    if (clientType) { sql += ' AND client_type=?'; params.push(clientType); }
    if (clientRef)  { sql += ' AND client_ref=?';  params.push(clientRef); }
    if (okres)      { sql += ' AND okres=?';       params.push(okres); }
    sql += ' ORDER BY created_at DESC';
    const rows = await env.DB.prepare(sql).bind(...params).all();
    return json((rows.results || []).map(r => ({ ...r, pozycje: JSON.parse(r.pozycje || '[]') })));
  }

  // POST /api/cfm-invoices/generate — agreguje koszty wszystkich aktywnych kontraktów klienta za okres
  if (req.method === 'POST' && segs[2] === 'generate') {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const company = body.company_id || 'mtoilet';
    const { client_type, client_ref, okres } = body;
    if (!client_type || !client_ref || !okres) return err('Wymagane: client_type, client_ref, okres');

    const contracts = await env.DB.prepare(`
      SELECT * FROM cfm_contracts WHERE company_id=? AND client_type=? AND client_ref=? AND status='AKTYWNY'
        AND (data_od IS NULL OR data_od <= ?) AND (data_do IS NULL OR data_do >= ?)`
    ).bind(company, client_type, client_ref, okres + '-31', okres + '-01').all();

    const list = contracts.results || [];
    if (!list.length) return err('Brak aktywnych kontraktów dla tego klienta w podanym okresie', 404);

    const pozycje = [];
    for (const c of list) {
      const vrow = await env.DB.prepare('SELECT data FROM vehicles WHERE company_id=? AND nr_rej=?').bind(company, c.nr_rej).first();
      let vdata = {};
      try { vdata = vrow ? JSON.parse(vrow.data || '{}') : {}; } catch { vdata = {}; }

      if (c.stawka_miesieczna != null) {
        const netto = Number(c.stawka_miesieczna);
        pozycje.push({ opis: `Najem pojazdu ${c.nr_rej} \u2014 ${okres}`, nrRej: c.nr_rej, ilosc: 1,
          cena_netto: _num2(netto), vat_proc: _VAT, wartosc_netto: _num2(netto), wartosc_brutto: _num2(netto * (1 + _VAT / 100)) });
      }

      if (c.refakturowanie_kosztow) {
        const fuelSum = (vdata.fuelHistory || []).filter(h => (h.date || '').startsWith(okres)).reduce((s, h) => s + (h.totalGross || 0), 0);
        if (fuelSum > 0) {
          const netto = _num2(fuelSum / (1 + _VAT / 100));
          pozycje.push({ opis: `Refaktura paliwa \u2014 ${c.nr_rej}`, nrRej: c.nr_rej, ilosc: 1,
            cena_netto: netto, vat_proc: _VAT, wartosc_netto: netto, wartosc_brutto: _num2(fuelSum) });
        }
        const serviceSum = (vdata.serviceHistory || []).filter(h => (h.date || '').startsWith(okres)).reduce((s, h) => s + (h.cost || 0), 0);
        if (serviceSum > 0) {
          const netto = _num2(serviceSum / (1 + _VAT / 100));
          pozycje.push({ opis: `Refaktura serwisu \u2014 ${c.nr_rej}`, nrRej: c.nr_rej, ilosc: 1,
            cena_netto: netto, vat_proc: _VAT, wartosc_netto: netto, wartosc_brutto: _num2(serviceSum) });
        }
        const dmgRow = await env.DB.prepare(
          `SELECT SUM(koszt) AS suma FROM damage_reports WHERE company_id=? AND nr_rej=? AND data_zdarzenia LIKE ?`
        ).bind(company, c.nr_rej, okres + '%').first();
        const dmgSum = dmgRow?.suma || 0;
        if (dmgSum > 0) {
          const netto = _num2(dmgSum / (1 + _VAT / 100));
          pozycje.push({ opis: `Refaktura szkód \u2014 ${c.nr_rej}`, nrRej: c.nr_rej, ilosc: 1,
            cena_netto: netto, vat_proc: _VAT, wartosc_netto: netto, wartosc_brutto: _num2(dmgSum) });
        }
      }
    }

    const suma_netto  = _num2(pozycje.reduce((s, p) => s + p.wartosc_netto, 0));
    const suma_brutto = _num2(pozycje.reduce((s, p) => s + p.wartosc_brutto, 0));
    const suma_vat     = _num2(suma_brutto - suma_netto);

    const yearNow = new Date().getFullYear();
    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM cfm_invoices WHERE company_id=? AND strftime('%Y', created_at)=?`
    ).bind(company, String(yearNow)).first();
    const seq = (countRow?.n || 0) + 1;
    const dataWyst = new Date();
    const nrFaktury = `FV/${seq}/${String(dataWyst.getMonth() + 1).padStart(2, '0')}/${yearNow}`;
    const terminPlatnosci = new Date(dataWyst.getTime() + 14 * 86400000).toISOString().slice(0, 10);

    const id = crypto.randomUUID();
    try {
      await env.DB.prepare(`
        INSERT INTO cfm_invoices(id,company_id,client_type,client_ref,client_name_cache,nr_faktury,okres,
          data_wystawienia,termin_platnosci,pozycje,suma_netto,suma_vat,suma_brutto,status)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'WYSTAWIONA')`
      ).bind(
        id, company, client_type, client_ref, body.client_name_cache || null, nrFaktury, okres,
        dataWyst.toISOString().slice(0, 10), terminPlatnosci, JSON.stringify(pozycje), suma_netto, suma_vat, suma_brutto
      ).run();
    } catch (e) {
      if (e.message.includes('UNIQUE')) return err('Faktura za ten okres dla tego klienta już istnieje', 409);
      throw e;
    }
    return json({ ok: true, id, nr_faktury: nrFaktury, pozycje, suma_netto, suma_vat, suma_brutto });
  }

  // PUT /api/cfm-invoices/:id — edycja pozycji/statusu (przeliczenie sum)
  if (req.method === 'PUT' && segs[2]) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const row = await env.DB.prepare('SELECT * FROM cfm_invoices WHERE id=?').bind(segs[2]).first();
    if (!row) return err('Faktura nie znaleziona', 404);
    let pozycje = row.pozycje ? JSON.parse(row.pozycje) : [];
    if (Array.isArray(body.pozycje)) pozycje = body.pozycje;
    const suma_netto  = _num2(pozycje.reduce((s, p) => s + (p.wartosc_netto || 0), 0));
    const suma_brutto = _num2(pozycje.reduce((s, p) => s + (p.wartosc_brutto || 0), 0));
    const suma_vat    = _num2(suma_brutto - suma_netto);
    await env.DB.prepare(`
      UPDATE cfm_invoices SET pozycje=?, suma_netto=?, suma_vat=?, suma_brutto=?, status=?, termin_platnosci=?
      WHERE id=?`
    ).bind(
      JSON.stringify(pozycje), suma_netto, suma_vat, suma_brutto,
      body.status ?? row.status, body.termin_platnosci ?? row.termin_platnosci, segs[2]
    ).run();
    return json({ ok: true });
  }

  // DELETE /api/cfm-invoices/:id — tylko gdy nieopłacona
  if (req.method === 'DELETE' && segs[2]) {
    const row = await env.DB.prepare('SELECT status FROM cfm_invoices WHERE id=?').bind(segs[2]).first();
    if (row && row.status === 'OPLACONA') return err('Nie można usunąć opłaconej faktury', 409);
    await env.DB.prepare('DELETE FROM cfm_invoices WHERE id=?').bind(segs[2]).run();
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
    const salt = genSalt();
    const hash = await hashPwd(password, salt);
    try {
      const res = await env.DB.prepare(
        'INSERT INTO users(email,name,password_hash,salt,role) VALUES(?,?,?,?,?)'
      ).bind(email.toLowerCase(), name || email, hash, salt, role || 'viewer').run();
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
    if (body.password)          { const s=genSalt(); sets.push('password_hash=?','salt=?'); vals.push(await hashPwd(body.password, s), s); }
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

// ─── KIEROWCY ─────────────────────────────────────────────────────────────────
async function handleDrivers(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const segs     = path.split('/').filter(Boolean);
  const driverId = segs[2] || null;
  const canWrite = user.role === 'admin' || user.role === 'kierownik' || user.role === 'dyspozytor';

  if (req.method === 'GET') {
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '500'), 2000);
    const rows = await env.DB.prepare(
      'SELECT * FROM drivers WHERE company_id=? ORDER BY name ASC LIMIT ?'
    ).bind(company, limit).all();
    return json({ ok: true, drivers: rows.results || [] });
  }

  if (!canWrite) return err('Brak uprawnień', 403);

  if (req.method === 'POST') {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!body.name?.trim()) return err('Wymagane: name');
    const id = body.id || crypto.randomUUID();
    try {
      await env.DB.prepare(
        `INSERT INTO drivers(id,company_id,name,phone,email,license_no,license_expiry,notes,updated_at)
         VALUES(?,?,?,?,?,?,?,?,datetime('now'))`
      ).bind(id, company, body.name.trim(), body.phone||null, body.email||null,
        body.license_no||null, body.license_expiry||null, body.notes||null
      ).run();
    } catch (e) {
      if (e.message?.includes('UNIQUE')) return err('Kierowca o tej nazwie już istnieje', 409);
      throw e;
    }
    return json({ ok: true, id });
  }

  if (req.method === 'PUT' && driverId) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const existing = await env.DB.prepare('SELECT company_id FROM drivers WHERE id=?').bind(driverId).first();
    if (!existing) return err('Kierowca nie istnieje', 404);
    if (existing.company_id !== company) return err('Brak dostępu', 403);
    const sets = [], vals = [];
    for (const f of ['name','phone','email','license_no','license_expiry','notes']) {
      if (body[f] !== undefined) { sets.push(`${f}=?`); vals.push(body[f] === '' ? null : body[f]); }
    }
    if (!sets.length) return err('Brak pól do aktualizacji');
    sets.push("updated_at=datetime('now')");
    vals.push(driverId);
    try {
      await env.DB.prepare(`UPDATE drivers SET ${sets.join(',')} WHERE id=?`).bind(...vals).run();
    } catch (e) {
      if (e.message?.includes('UNIQUE')) return err('Kierowca o tej nazwie już istnieje', 409);
      throw e;
    }
    return json({ ok: true });
  }

  if (req.method === 'DELETE' && driverId) {
    const existing = await env.DB.prepare('SELECT company_id FROM drivers WHERE id=?').bind(driverId).first();
    if (!existing) return err('Kierowca nie istnieje', 404);
    if (existing.company_id !== company) return err('Brak dostępu', 403);
    await env.DB.prepare('DELETE FROM drivers WHERE id=?').bind(driverId).run();
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── MANDATY I NARUSZENIA ─────────────────────────────────────────────────────
async function handleFines(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const segs   = path.split('/').filter(Boolean);
  const fineId = segs[2] || null;
  const canWrite = user.role === 'admin' || user.role === 'kierownik' || user.role === 'dyspozytor';

  if (req.method === 'GET') {
    const nrRej  = url.searchParams.get('nr_rej');
    const paid   = url.searchParams.get('paid');
    const limit  = Math.min(parseInt(url.searchParams.get('limit') || '500'), 1000);
    let q = 'SELECT * FROM fines WHERE company_id=?';
    const p = [company];
    if (nrRej) { q += ' AND nr_rej=?'; p.push(nrRej); }
    if (paid === '0') q += ' AND paid=0';
    if (paid === '1') q += ' AND paid=1';
    q += ' ORDER BY date DESC LIMIT ?';
    p.push(limit);
    const rows = await env.DB.prepare(q).bind(...p).all();
    return json({ ok: true, fines: rows.results || [] });
  }

  if (!canWrite) return err('Brak uprawnień', 403);

  if (req.method === 'POST') {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!body.date) return err('Wymagane: date');
    const id = body.id || crypto.randomUUID();
    await env.DB.prepare(
      `INSERT OR REPLACE INTO fines(id,company_id,nr_rej,driver_name,type,date,amount,deadline,
        description,fine_no,issuer,points,notes,paid,paid_date,created_by,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`
    ).bind(id, company, body.nr_rej||null, body.driver_name||null, body.type||'inne', body.date,
      body.amount??null, body.deadline||null, body.description||null,
      body.fine_no||null, body.issuer||null, body.points??null, body.notes||null,
      body.paid?1:0, body.paid_date||null, user._apiKey ? null : user.id
    ).run();
    return json({ ok: true, id });
  }

  if (req.method === 'PUT' && fineId) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const existing = await env.DB.prepare('SELECT company_id FROM fines WHERE id=?').bind(fineId).first();
    if (!existing) return err('Mandat nie istnieje', 404);
    if (existing.company_id !== company) return err('Brak dostępu', 403);
    const sets = [], vals = [];
    for (const f of ['nr_rej','driver_name','type','date','amount','deadline','description','fine_no','issuer','points','notes','paid','paid_date']) {
      if (body[f] !== undefined) { sets.push(`${f}=?`); vals.push(body[f] === '' ? null : body[f]); }
    }
    if (!sets.length) return err('Brak pól do aktualizacji');
    sets.push("updated_at=datetime('now')");
    vals.push(fineId);
    await env.DB.prepare(`UPDATE fines SET ${sets.join(',')} WHERE id=?`).bind(...vals).run();
    return json({ ok: true });
  }

  if (req.method === 'DELETE' && fineId) {
    const existing = await env.DB.prepare('SELECT company_id FROM fines WHERE id=?').bind(fineId).first();
    if (!existing) return err('Mandat nie istnieje', 404);
    if (existing.company_id !== company) return err('Brak dostępu', 403);
    await env.DB.prepare('DELETE FROM fines WHERE id=?').bind(fineId).run();
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── REZERWACJE (Kalendarz floty) ─────────────────────────────────────────────
async function handleReservations(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const segs  = path.split('/').filter(Boolean);
  const resId = segs[2] || null;

  if (req.method === 'GET' && !resId) {
    const from  = url.searchParams.get('from') || '';
    const to    = url.searchParams.get('to')   || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '500'), 2000);
    let q = 'SELECT * FROM reservations WHERE company_id = ?';
    const params = [company];
    if (from) { q += ' AND end >= ?'; params.push(from); }
    if (to)   { q += ' AND start <= ?'; params.push(to); }
    q += ' ORDER BY start LIMIT ?';
    params.push(limit);
    const res = await env.DB.prepare(q).bind(...params).all();
    return json({ reservations: res.results || [] });
  }

  if (req.method === 'POST') {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!body.nr_rej || !body.start || !body.end) return err('Wymagane: nr_rej, start, end');
    if (isNaN(Date.parse(body.start)) || isNaN(Date.parse(body.end))) return err('Daty muszą być w formacie YYYY-MM-DD');
    if (body.start > body.end) return err('Data końca musi być >= początku');
    // Sprawdź konflikt
    const conflict = await env.DB.prepare(
      `SELECT id FROM reservations WHERE company_id=? AND nr_rej=? AND status!='rejected' AND start<=? AND end>=?`
    ).bind(company, body.nr_rej, body.end, body.start).first();
    if (conflict) return err('Konflikt rezerwacji: pojazd zajęty w tym terminie', 409);
    const id = body.id || crypto.randomUUID();
    await env.DB.prepare(
      `INSERT OR REPLACE INTO reservations(id,company_id,nr_rej,user_name,start,end,status,notes,updated_at)
       VALUES(?,?,?,?,?,?,?,?,datetime('now'))`
    ).bind(id, company, body.nr_rej, body.user_name||'Użytkownik', body.start, body.end,
      body.status||'pending', body.notes||null
    ).run();
    return json({ ok: true, id });
  }

  if (req.method === 'PUT' && resId) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const existing = await env.DB.prepare('SELECT * FROM reservations WHERE id=?').bind(resId).first();
    if (!existing) return err('Rezerwacja nie istnieje', 404);
    if (existing.company_id !== company) return err('Brak dostępu', 403);
    const sets = [], vals = [];
    for (const f of ['nr_rej','user_name','start','end','status','notes']) {
      if (body[f] !== undefined) { sets.push(`${f}=?`); vals.push(body[f] === '' ? null : body[f]); }
    }
    if (!sets.length) return err('Brak pól do aktualizacji');
    sets.push("updated_at=datetime('now')");
    vals.push(resId);
    await env.DB.prepare(`UPDATE reservations SET ${sets.join(',')} WHERE id=?`).bind(...vals).run();
    return json({ ok: true });
  }

  if (req.method === 'DELETE' && resId) {
    const existing = await env.DB.prepare('SELECT company_id FROM reservations WHERE id=?').bind(resId).first();
    if (!existing) return err('Rezerwacja nie istnieje', 404);
    if (existing.company_id !== company) return err('Brak dostępu', 403);
    await env.DB.prepare('DELETE FROM reservations WHERE id=?').bind(resId).run();
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── KARTY FLOTOWE ────────────────────────────────────────────────────────────
async function handleFleetCards(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const segs   = path.split('/').filter(Boolean);
  const cardId = segs[2] || null;
  const canWrite = user.role === 'admin' || user.role === 'kierownik';
  const canSeePins = user.role === 'admin' || user.role === 'kierownik';

  if (req.method === 'GET' && !cardId) {
    const res = await env.DB.prepare(
      'SELECT * FROM fleet_cards WHERE company_id = ? ORDER BY type, card_no'
    ).bind(company).all();
    const cards = (res.results || []).map(c => ({
      ...c,
      pin: canSeePins ? c.pin : (c.pin ? '****' : null),
    }));
    return json({ cards });
  }

  if (!canWrite) return err('Brak uprawnień', 403);

  if (req.method === 'POST') {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!body.card_no) return err('Wymagane: card_no');
    const id = body.id || crypto.randomUUID();
    await env.DB.prepare(
      `INSERT OR REPLACE INTO fleet_cards(id,company_id,card_no,pin,nr_rej,type,provider,limit_pln,expires,status,notes,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`
    ).bind(id, company, body.card_no, body.pin||null, body.nr_rej||null,
      body.type||'PALIWOWA', body.provider||null, body.limit_pln??null,
      body.expires||null, body.status||'AKTYWNA', body.notes||null
    ).run();
    return json({ ok: true, id });
  }

  if (req.method === 'PUT' && cardId) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const existing = await env.DB.prepare('SELECT company_id FROM fleet_cards WHERE id=?').bind(cardId).first();
    if (!existing) return err('Karta nie istnieje', 404);
    if (existing.company_id !== company) return err('Brak dostępu', 403);
    const sets = [], vals = [];
    for (const f of ['card_no','pin','nr_rej','type','provider','limit_pln','expires','status','notes']) {
      if (body[f] !== undefined) { sets.push(`${f}=?`); vals.push(body[f] === '' ? null : body[f]); }
    }
    if (!sets.length) return err('Brak pól do aktualizacji');
    sets.push("updated_at=datetime('now')");
    vals.push(cardId);
    await env.DB.prepare(`UPDATE fleet_cards SET ${sets.join(',')} WHERE id=?`).bind(...vals).run();
    return json({ ok: true });
  }

  if (req.method === 'DELETE' && cardId) {
    const existing = await env.DB.prepare('SELECT company_id FROM fleet_cards WHERE id=?').bind(cardId).first();
    if (!existing) return err('Karta nie istnieje', 404);
    if (existing.company_id !== company) return err('Brak dostępu', 403);
    await env.DB.prepare('DELETE FROM fleet_cards WHERE id=?').bind(cardId).run();
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── KLUCZE API (CRUD, admin only) ────────────────────────────────────────────
async function handleApiKeys(req, env, user, url, path) {
  if (user.role !== 'admin' || user._apiKey) return err('Brak uprawnień administratora', 403);
  const segs  = path.split('/').filter(Boolean); // ['api','api-keys',':id']
  const keyId = segs[2] || null;

  if (req.method === 'GET' && !keyId) {
    const rows = await env.DB.prepare(
      'SELECT id,company_id,name,scope,active,created_at,last_used_at FROM api_keys ORDER BY created_at DESC'
    ).all();
    return json(rows.results || []);
  }

  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const { name, company_id, scope } = body;
    if (!name || !company_id) return err('Nazwa i firma są wymagane');
    const finalScope = scope === 'read_write' ? 'read_write' : 'read';
    const id = crypto.randomUUID();
    const plaintext = genApiKey();
    const hash = await sha256Hex(plaintext);
    await env.DB.prepare(
      'INSERT INTO api_keys(id,company_id,name,key_hash,scope,created_by) VALUES(?,?,?,?,?,?)'
    ).bind(id, company_id, name, hash, finalScope, user.id).run();
    // Token w postaci jawnej zwracany jest tylko raz, tutaj — nigdy więcej nie da się go odtworzyć (przechowywany jest tylko hash).
    return json({ ok: true, id, key: plaintext });
  }

  if (req.method === 'PUT' && keyId) {
    let body;
    try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const sets = [], vals = [];
    if (body.name !== undefined)   { sets.push('name=?');   vals.push(body.name); }
    if (body.scope !== undefined)  { sets.push('scope=?');  vals.push(body.scope === 'read_write' ? 'read_write' : 'read'); }
    if (body.active !== undefined) { sets.push('active=?'); vals.push(body.active ? 1 : 0); }
    if (!sets.length) return err('Brak pól do aktualizacji');
    vals.push(keyId);
    await env.DB.prepare(`UPDATE api_keys SET ${sets.join(',')} WHERE id=?`).bind(...vals).run();
    return json({ ok: true });
  }

  if (req.method === 'DELETE' && keyId) {
    await env.DB.prepare('DELETE FROM api_keys WHERE id=?').bind(keyId).run();
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── EKSPORT / IMPORT — wszystkie dane firmy w jednym JSON ───────────────────
const EXPORT_TABLES = [
  { key: 'damages',      table: 'damage_reports',     jsonCols: [] },
  { key: 'tires',        table: 'tires',               jsonCols: ['historia'] },
  { key: 'serviceOrders',table: 'service_orders',       jsonCols: [] },
  { key: 'protocols',    table: 'handover_protocols',   jsonCols: ['wyposazenie'] },
  { key: 'cfmClients',   table: 'cfm_clients',          jsonCols: [] },
  { key: 'cfmContracts', table: 'cfm_contracts',        jsonCols: [] },
  { key: 'cfmInvoices',  table: 'cfm_invoices',         jsonCols: ['pozycje'] },
  { key: 'fines',        table: 'fines',                jsonCols: [],  skipImport: false },
  { key: 'drivers',      table: 'drivers',              jsonCols: [],  skipImport: true  },
  { key: 'fleetCards',   table: 'fleet_cards',          jsonCols: [],  skipImport: false },
  { key: 'reservations', table: 'reservations',         jsonCols: [],  skipImport: false },
];

function parseJsonCols(row, jsonCols) {
  const out = { ...row };
  for (const col of jsonCols) {
    if (typeof out[col] === 'string') {
      try { out[col] = JSON.parse(out[col]); } catch { /* zostaw jak jest */ }
    }
  }
  return out;
}

async function handleExport(env, company) {
  const vehiclesRes = await env.DB.prepare('SELECT * FROM vehicles WHERE company_id = ? ORDER BY nr_rej').bind(company).all();
  const vehicles = (vehiclesRes.results || []).map(v => parseJsonCols(v, ['data']));

  const out = { exportedAt: new Date().toISOString(), company_id: company, vehicles };

  for (const { key, table, jsonCols } of EXPORT_TABLES) {
    const res = await env.DB.prepare(`SELECT * FROM ${table} WHERE company_id = ?`).bind(company).all();
    out[key] = (res.results || []).map(r => parseJsonCols(r, jsonCols));
  }

  // Zdjęcia — tylko metadane (r2_key, mime_type), bez binarnej zawartości R2.
  const damagePhotos = await env.DB.prepare(
    `SELECT dp.* FROM damage_photos dp JOIN damage_reports dr ON dp.damage_id = dr.id WHERE dr.company_id = ?`
  ).bind(company).all().catch(() => ({ results: [] }));
  out.damagePhotos = damagePhotos.results || [];

  const protocolPhotos = await env.DB.prepare(
    `SELECT pp.* FROM protocol_photos pp JOIN handover_protocols hp ON pp.protocol_id = hp.id WHERE hp.company_id = ?`
  ).bind(company).all().catch(() => ({ results: [] }));
  out.protocolPhotos = protocolPhotos.results || [];

  return json(out);
}

async function handleImport(req, env, company) {
  let body;
  try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }

  const counts = {};
  const skipped = [];

  if (Array.isArray(body.vehicles) && body.vehicles.length) {
    const stmt = env.DB.prepare(`
      INSERT INTO vehicles(company_id,nr_rej,axles_count,suspension_type,
        dmc_zespolu,miesiace_podatku,dt1_category,dt1_tax_amount,data,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(company_id,nr_rej) DO UPDATE SET
        axles_count=excluded.axles_count, suspension_type=excluded.suspension_type,
        dmc_zespolu=excluded.dmc_zespolu, miesiace_podatku=excluded.miesiace_podatku,
        dt1_category=excluded.dt1_category, dt1_tax_amount=excluded.dt1_tax_amount,
        data=excluded.data, updated_at=datetime('now')`);
    await env.DB.batch(body.vehicles.map(v => stmt.bind(
      company, v.nr_rej, v.axles_count ?? 2, v.suspension_type ?? 'pneumatyczne',
      v.dmc_zespolu ?? 0, v.miesiace_podatku ?? 12,
      v.dt1_category ?? null, v.dt1_tax_amount ?? null,
      typeof v.data === 'string' ? v.data : JSON.stringify(v.data ?? {})
    )));
    counts.vehicles = body.vehicles.length;
  }

  // Drivers — dedykowany upsert po (company_id, name) żeby respektować UNIQUE constraint
  if (Array.isArray(body.drivers) && body.drivers.length) {
    let n = 0;
    for (const d of body.drivers) {
      if (!d.name?.trim()) { skipped.push({ table: 'drivers', id: d.id || null, reason: 'brak name' }); continue; }
      const id = d.id || crypto.randomUUID();
      try {
        await env.DB.prepare(`
          INSERT INTO drivers(id,company_id,name,phone,email,license_no,license_expiry,notes,updated_at)
          VALUES(?,?,?,?,?,?,?,?,datetime('now'))
          ON CONFLICT(company_id,name) DO UPDATE SET
            phone=excluded.phone, email=excluded.email,
            license_no=excluded.license_no, license_expiry=excluded.license_expiry,
            notes=excluded.notes, updated_at=datetime('now')
        `).bind(id, company, d.name.trim(), d.phone||null, d.email||null,
          d.license_no||null, d.license_expiry||null, d.notes||null
        ).run();
        n++;
      } catch (e) { skipped.push({ table: 'drivers', id: d.id || null, reason: e.message }); }
    }
    counts.drivers = n;
  }

  for (const { key, table, jsonCols, skipImport } of EXPORT_TABLES) {
    if (skipImport) continue;
    const rows = body[key];
    if (!Array.isArray(rows) || !rows.length) continue;
    let n = 0;
    for (const row of rows) {
      const cols = Object.keys(row).filter(c => c !== 'id' && c !== 'company_id');
      const vals = cols.map(c => {
        const v = row[c];
        return jsonCols.includes(c) && v !== null && typeof v !== 'string' ? JSON.stringify(v) : v;
      });
      if (row.id) {
        // Sprawdź, że rekord o tym ID (jeśli istnieje) należy do tej samej firmy — inaczej pomiń (ochrona przed wstrzyknięciem do cudzej firmy).
        const existing = await env.DB.prepare(`SELECT company_id FROM ${table} WHERE id = ?`).bind(row.id).first();
        if (existing && existing.company_id !== company) {
          skipped.push({ table, id: row.id, reason: 'należy do innej firmy' });
          continue;
        }
        const setClause = cols.map(c => `${c}=?`).join(',');
        await env.DB.prepare(
          `INSERT INTO ${table}(id,company_id,${cols.join(',')}) VALUES(?,?,${cols.map(() => '?').join(',')})
           ON CONFLICT(id) DO UPDATE SET ${setClause}`
        ).bind(row.id, company, ...vals, ...vals).run();
      } else {
        const newId = crypto.randomUUID();
        await env.DB.prepare(
          `INSERT INTO ${table}(id,company_id,${cols.join(',')}) VALUES(?,?,${cols.map(() => '?').join(',')})`
        ).bind(newId, company, ...vals).run();
      }
      n++;
    }
    counts[key] = n;
  }

  return json({ ok: true, counts, skipped });
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
  const { subscription, company_id, label, user_id } = body;
  if (!subscription?.endpoint || !subscription?.keys) return err('Nieprawidłowa subskrypcja');
  if (!company_id) return err('Wymagane company_id');
  await env.DB.prepare(`
    INSERT INTO push_subscriptions(company_id,user_id,endpoint,p256dh,auth_key,label,updated_at)
    VALUES(?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(endpoint) DO UPDATE SET
      company_id=excluded.company_id,user_id=excluded.user_id,
      p256dh=excluded.p256dh,auth_key=excluded.auth_key,
      label=excluded.label,updated_at=datetime('now')`
  ).bind(company_id, user_id || null, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, label || null).run();
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


// ─── ZMIANA HASŁA (zalogowany użytkownik) ─────────────────────────────────────
async function handleChangeMyPassword(req, env, user) {
  let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
  if (!body.password || body.password.length < 6) return err('Hasło musi mieć minimum 6 znaków');
  const salt = genSalt();
  const hash = await hashPwd(body.password, salt);
  await env.DB.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').bind(hash, salt, user.id).run();
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

  // nrRej: usuń spacje; musi zaczynać się od 2-3 wielkich liter i zawierać cyfrę
  // (odrzuca słowa-etykiety jak "POJAZDU", "REJESTRACYJNY" itp.)
  if (f.nrRej) {
    f.nrRej = String(f.nrRej).replace(/\s+/g, '').toUpperCase().slice(0, 10);
    if (!/^[A-Z]{2,3}[A-Z0-9]/.test(f.nrRej) || !/\d/.test(f.nrRej)) delete f.nrRej;
  }

  // Przeznaczenie pojazdu (RODZAJ POJAZDU z sekcji bezowej) — decyduje o zwolnieniu z DT-1, zachowaj jako wolny tekst
  if (f.przeznaczenie) {
    f.przeznaczenie = String(f.przeznaczenie).trim().slice(0, 60);
    if (!f.przeznaczenie || /^(brak|nie widoczne|n\/a|none)$/i.test(f.przeznaczenie)) delete f.przeznaczenie;
  }

  // D.2 (typ) to kod techniczny (SZN1E, R540) — NIE opis rodzaju ani adres
  if (f.typ) {
    const t = String(f.typ).trim();
    if (/SAMOCH[OÓ]D|SPECJALN|OSOBOW|CI[ĘE][ZŻ]AR|CI[ĄA]GNIK|AUTOBUS/i.test(t)) delete f.typ;
    // Odrzuć adresy: słowo z "ALEJA/ULICA/..." lub wzorzec "SŁOWO 9A"
    else if (/\b(ALEJA|ALEJE|ULICA|UL\b|AL\b|STREET|STRASSE|BOULEVARD|PLAC|DROGA)\b/i.test(t)) delete f.typ;
    else if (/^[A-ZĄĆĘŁŃÓŚŹŻ\s]{4,}\s+\d+[A-Z]{0,2}$/i.test(t)) delete f.typ; // "KATOWICKA 9A" pattern
  }

  // E (VIN): dokładnie 17 znaków [A-Z0-9], bez I/O/Q; gwiazdki/ukośniki = numer homologacji → odrzuć.
  // ISO 3779 zabrania liter I/O/Q w VIN — ale OCR nagminnie myli: 0↔O, 1↔I, 0↔Q.
  // Zamiast usuwać VIN, najpierw koryguj typowe błędy OCR, potem sprawdź długość.
  if (f.vin) {
    const rawVin = String(f.vin);
    console.log('[VIN sanitize] raw:', rawVin);
    if (/[*/]/.test(rawVin)) {
      console.log('[VIN sanitize] usunięty — zawiera gwiazdkę/ukośnik (homologacja)');
      delete f.vin;
    } else {
      f.vin = rawVin.toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .replace(/O/g, '0')
        .replace(/I/g, '1')
        .replace(/Q/g, '0');
      console.log('[VIN sanitize] po korekcie:', f.vin, 'długość:', f.vin.length);
      if (f.vin.length !== 17) {
        console.log('[VIN sanitize] usunięty — zła długość:', f.vin.length);
        delete f.vin;
      }
    }
  } else {
    console.log('[VIN sanitize] pole vin nieobecne w odpowiedzi AI');
  }

  // DMC/masa są zawsze całkowitymi kg — usuwamy WSZYSTKIE znaki niebędące cyframi.
  // Obsługuje formaty: "8 800 kg", "8.800", "8,800", "8800" → zawsze 8800.
  const num = v => { const n = parseInt(String(v || '').replace(/[^\d]/g, ''), 10); return isNaN(n) ? null : n; };
  let f1 = num(f.dmcKg), f2 = num(f.dmcKg2), g = num(f.masaWlKg);

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

  const prompt = `Jestes ekspertem od polskich Dowodow Rejestracyjnych (DR). Dokument ma 3 sekcje: bezowa (homologacja gory), zolta tabela (srodek — dane rejestracyjne), niebieska (dol — dane pojazdu). Wyodrebnij pola TYLKO z ich literowymi oznaczeniami.
UWAGI KRYTYCZNE:
- Pole E (VIN) to DOKLADNIE 17 znakow TYLKO LITERY i CYFRY (A-Z 0-9), BEZ gwiazdek, ukosnikow, spacji. Szukaj VIN w dwoch miejscach: (a) obok litery E w sekcji niebieskiej, np "E WMA15VUZ3N9017358", (b) w strefie MRZ u gory lub dolu dokumentu — wiersz ze strzalkami >>>> zawiera VIN jako pierwsze 17 znakow, np "WMA15VUZ3N9017358>>>>>>>>". Przyklad VIN: WMA15VUZ3N9017358 lub WVWZZZ3BZWE689420. UWAGA: pole K (homologacja) zaczyna sie od "e" po ktorym sa gwiazdki np "e32*..." — to ABSOLUTNIE NIE jest VIN. VIN NIGDY nie zaczyna sie od malego "e" z gwiazdka. Typ pojazdu to np WMA (MAN), VF1 (Renault), WDB (Mercedes), WJM (Volvo), YV2 (Volvo).
- Pole D.2 to KROTKI KOD techniczny pojazdu (do 20 znakow, np TGE140 lub R490 lub 316d). NIE jest to adres firmy, ulica, NIP ani opis slowny. Jesli widzisz adres lub slowa zamiast kodu — zwroc pusty string.
- Pole B to DATA PIERWSZEJ rejestracji (DD.MM.RRRR), nie termin przegladu technicznego.
- Pola F.1/F.2/F.3/G to tylko liczby kilogramow z ZOLTEJ tabeli (nie z sekcji bezowej).
- W sekcji bezowej (gora dokumentu) szukaj etykiety "RODZAJ POJAZDU" lub "PRZEZNACZENIE" — to KRYTYCZNE pole podatkowe: jesli pojazd jest oznaczony jako "SAMOCHOD SPECJALNY" (np. do czyszczenia, asenizacyjny, szambiarka, wodolejka itp.), pojazd jest ZWOLNIONY z podatku DT-1. Zwroc dokladny tekst tej etykiety.
Zwroc WYLACZNIE JSON bez markdown:
{"nrRej":"A — numer rejestracyjny np WPR0365T lub WA0677L (2-3 wielkie litery + cyfry, BEZ spacji)","dataRej":"B — data PIERWSZEJ rejestracji DD.MM.RRRR","marka":"D.1 — marka np MAN lub SCANIA","typ":"D.2 — krotki kod techniczny np TGE140 lub R490 (NIE adres, NIE opis slowny)","przeznaczenie":"RODZAJ POJAZDU / PRZEZNACZENIE z sekcji bezowej, np SAMOCHOD SPECJALNY lub SAMOCHOD CIEZAROWY (puste jesli nie widoczne)","vin":"E — dokladnie 17 znakow VIN np WMA29VUZ7R9018317 (litery A-H J-N P R-Z i cyfry 0-9, NIGDY I O Q, NIGDY gwiazdki)","dmcKg":"F.1 — DMC kg z ZOLTEJ tabeli (jesli dwie wartosci wybierz WIEKSZA)","dmcKg2":"F.2 — DMC z ladunkiem kg","dmcZespolu":"F.3 — DMC zespolu kg (>= F.1)","masaWlKg":"G — masa wlasna kg (mniejsza niz F.1)","liczbaOsi":"L — liczba osi 1-5","kategoria":"J — kategoria np N1 N2 N3 M1","pojSilnika":"P.1 — pojemnosc cm3 cyfry","mocKW":"P.2 — moc kW cyfry","paliwo":"P.3 — D lub B lub G","miejscaSied":"S.1 — miejsca siedzace cyfra","rokProd":"rok produkcji 4 cyfry","dmcPrzyczHam":"O.1 — masa przyczepy z hamulcem kg","dmcPrzyczNieham":"O.2 — masa przyczepy bez hamulca kg","nrHomolog":"K — nr homologacji np e32*IV18/858*NI15391"}`;

  // ── Próba 0: Python PaddleOCR Service (najdokładniejszy — przestrzenne bounding boxy) ──
  if (env.OCR_PYTHON_URL) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (env.OCR_PYTHON_SECRET) headers['X-Api-Key'] = env.OCR_PYTHON_SECRET;
      const pyResp = await fetch(env.OCR_PYTHON_URL.replace(/\/$/, '') + '/ocr', {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageBase64, mimeType }),
        signal: AbortSignal.timeout(8000),
      });
      if (pyResp.ok) {
        const pyData = await pyResp.json();
        if (pyData.ok && pyData.fields) {
          const sanitized = _sanitizeOcrFields(pyData.fields);
          // Sprawdź po sanityzacji — jeśli kluczowe pola puste, przejdź do Groq
          if (sanitized.nrRej || sanitized.vin || sanitized.marka || sanitized.dmcKg) {
            return json({ ok: true, fields: sanitized, model: 'paddleocr' });
          }
          console.log('[OCR PaddleOCR] wynik po sanityzacji pusty — fallthrough do Groq');
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
      console.log('[OCR CF-AI raw]', answer.slice(0, 500));
      const jm = answer.match(/\{[\s\S]*\}/);
      if (jm) {
        const parsed = JSON.parse(jm[0]);
        console.log('[OCR CF-AI parsed vin]', parsed.vin ?? 'BRAK');
        const fields = _sanitizeOcrFields(parsed);
        console.log('[OCR CF-AI after sanitize vin]', fields.vin ?? 'USUNIĘTY');
        if (fields.nrRej || fields.vin || fields.marka || fields.dmcKg) {
          return json({ ok: true, fields, model: 'cf-workers-ai-llama-3.2-11b' });
        }
      }
    } catch (e) { console.log('[OCR CF-AI error]', e?.message); /* fall through to Groq */ }
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
      console.log(`[OCR Groq ${model} raw]`, answer.slice(0, 500));
      const jm = answer.match(/\{[\s\S]*\}/);
      if (!jm) { lastErr = 'AI nie zwróciło JSON: ' + answer.slice(0, 100); continue; }
      const parsed = JSON.parse(jm[0]);
      console.log(`[OCR Groq ${model} parsed vin]`, parsed.vin ?? 'BRAK');
      const fields = _sanitizeOcrFields(parsed);
      console.log(`[OCR Groq ${model} after sanitize vin]`, fields.vin ?? 'USUNIĘTY');
      return json({ ok: true, fields, model });
    } catch (e) {
      lastErr = `${model}: ${e?.message}`;
    }
  }
  return err('Błąd AI Vision: ' + lastErr, 502);
}

// ─── CEPIK PROXY ─────────────────────────────────────────────────────────────
// Browser cannot call api.cepik.gov.pl directly (CORS + IP whitelist).
// These endpoints forward requests server-side from the Worker.

async function handleCepikToken(request) {
  // POST /api/cepik/token — proxy to api-cpa.gov.pl/token
  let body;
  try { body = await request.text(); } catch { return err('Nieprawidłowe ciało żądania'); }
  const authHeader = request.headers.get('Authorization') || '';
  try {
    const resp = await fetch('https://api-cpa.gov.pl/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': authHeader,
      },
      body,
    });
    const data = await resp.text();
    return new Response(data, {
      status: resp.status,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (e) {
    return err('Błąd proxy tokenu CEPiK: ' + e.message, 502);
  }
}

async function handleCepikPojazdy(request, url) {
  // GET /api/cepik/pojazdy?nr=...&woj=...&rok=...
  // Forwards Bearer token from X-Cepik-Token header
  const token = request.headers.get('X-Cepik-Token') || '';
  if (!token) return err('Brak X-Cepik-Token', 401);

  const nr   = url.searchParams.get('nr')  || '';
  const woj  = url.searchParams.get('woj') || '14';
  const rok  = url.searchParams.get('rok') || String(new Date().getFullYear());
  if (!nr) return err('Brak parametru nr');

  const apiUrl = `https://api.cepik.gov.pl/pojazdy?numer-rejestracyjny=${encodeURIComponent(nr)}&wojewodztwo=${woj}&data-od=${rok}0101&data-do=${rok}1231&limit=1&pokaz-wszystkie-pola=true`;
  try {
    const resp = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': 'Bearer ' + token,
      },
    });
    const data = await resp.text();
    return new Response(data, {
      status: resp.status,
      headers: { 'Content-Type': 'application/vnd.api+json', ...CORS },
    });
  } catch (e) {
    return err('Błąd proxy CEPiK: ' + e.message, 502);
  }
}

// ─── CEPIK — KIEROWCY (SPIKE, niezweryfikowane) ───────────────────────────────
// UWAGA: w odróżnieniu od /pojazdy (potwierdzone, publiczne API z OAuth2 client-credentials),
// weryfikacja uprawnień kierowcy po PESEL/nr prawa jazdy NIE ma potwierdzonego publicznego
// endpointu w tym samym przepływie — usługa "Sprawdź uprawnienia kierowcy" w CEPiK jest
// typowo dostępna tylko przez portal gov.pl z logowaniem obywatela (Profil Zaufany/mObywatel),
// nie przez B2B token. Ten handler to spike: próbuje wywołać prawdopodobny endpoint i zwraca
// jasny komunikat ok:false z diagnostyką, jeśli się nie powiedzie — frontend ma wtedy fallback
// na ręczne wprowadzanie danych (patrz modules/drivers.js + notifications.js).
async function handleCepikKierowca(request, url) {
  const token = request.headers.get('X-Cepik-Token') || '';
  if (!token) return err('Brak X-Cepik-Token', 401);

  const pesel  = url.searchParams.get('pesel')  || '';
  const nrPrawaJazdy = url.searchParams.get('nrPrawaJazdy') || '';
  if (!pesel || !nrPrawaJazdy) return err('Brak parametrów: pesel, nrPrawaJazdy');

  const apiUrl = `https://api.cepik.gov.pl/kierowcy?pesel=${encodeURIComponent(pesel)}&nr-prawa-jazdy=${encodeURIComponent(nrPrawaJazdy)}`;
  try {
    const resp = await fetch(apiUrl, {
      headers: { 'Accept': 'application/vnd.api+json', 'Authorization': 'Bearer ' + token },
    });
    if (resp.status === 404 || resp.status === 403) {
      return json({ ok: false, available: false, status: resp.status,
        message: 'Publiczne API CEPiK nie udostępnia weryfikacji uprawnień kierowcy w tym przepływie (status ' + resp.status + '). Wprowadź dane ręcznie.' });
    }
    const data = await resp.text();
    return new Response(data, { status: resp.status, headers: { 'Content-Type': 'application/vnd.api+json', ...CORS } });
  } catch (e) {
    return json({ ok: false, available: false, message: 'Błąd proxy CEPiK kierowcy: ' + e.message });
  }
}

// ─── GPS WEBHOOK ──────────────────────────────────────────────────────────────
function _parseTekomCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const sep = [';', ',', '\t'].sort((a, b) =>
    (lines[0].split(b).length - lines[0].split(a).length))[0];
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase()
    .replace(/\s+/g, '_').replace(/[ą]/g,'a').replace(/[ę]/g,'e').replace(/[ó]/g,'o')
    .replace(/[ś]/g,'s').replace(/[ź]/g,'z').replace(/[ż]/g,'z').replace(/[ń]/g,'n')
    .replace(/[ć]/g,'c').replace(/[ł]/g,'l').replace(/[ź]/g,'z'));
  const ALIASES = {
    vehicle:   ['rejestracja','nrrej','nr_rej','registration','vehicle','pojazd','tablica'],
    odometer:  ['km','odometer','licznik','przebieg','mileage','stan_km','odometr'],
    timestamp: ['data','date','datetime','data_czas','dzien'],
    driver:    ['kierowca','driver','operator'],
    speed:     ['predkosc','speed','v_max','v_avg','predkosc_max'],
    lat:       ['lat','latitude','szerokosc'],
    lon:       ['lon','lng','longitude','dlugosc'],
    location:  ['lokalizacja','location','miejsce','adres','address'],
  };
  const fieldMap = {};
  headers.forEach((h, i) => {
    for (const [canonical, aliases] of Object.entries(ALIASES)) {
      if (aliases.some(a => h.includes(a))) { fieldMap[i] = canonical; break; }
    }
  });
  return lines.slice(1).map(line => {
    const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
    const rec = {};
    Object.entries(fieldMap).forEach(([i, f]) => { if (vals[i] !== undefined) rec[f] = vals[i]; });
    return rec;
  }).filter(r => r.vehicle);
}

async function handleGpsWebhook(req, env, user, url) {
  const ct = req.headers.get('content-type') || '';
  let records;
  if (ct.includes('application/json')) {
    const body = await req.json().catch(() => null);
    if (!body) return err('Nieprawidłowy JSON');
    records = Array.isArray(body) ? body : [body];
  } else {
    records = _parseTekomCsv(await req.text());
  }
  if (!records.length) return err('Brak danych GPS w payload');

  const company = url.searchParams.get('company') || user.company_id || 'mtoilet';
  if (user._apiKey && user.company_id && user.company_id !== company)
    return err('Brak dostępu do tej firmy', 403);

  let updated = 0;
  const skipped = [];

  for (const rec of records) {
    const nrRej = (rec.vehicle || rec.nr_rej || rec.rejestracja || rec.registration || '').toUpperCase();
    if (!nrRej) { skipped.push({ reason: 'brak nr rej', rec }); continue; }

    const row = await env.DB.prepare(
      'SELECT * FROM vehicles WHERE company_id = ? AND nr_rej = ?'
    ).bind(company, nrRej).first();
    if (!row) { skipped.push({ reason: 'pojazd nie znaleziony', nrRej }); continue; }

    let data = {};
    try { data = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {}); } catch {}

    const km = rec.odometer ?? rec.km ?? rec.licznik ?? rec.mileage ?? rec.przebieg;
    if (km != null && Number(km) > (data.stanKilometrow || 0)) data.stanKilometrow = Number(km);
    if (rec.driver || rec.kierowca) data.kierowca = rec.driver || rec.kierowca;

    const entry = {};
    const ts = rec.timestamp || rec.datetime || rec.data || new Date().toISOString();
    entry.ts = ts;
    if (km != null) entry.km = Number(km);
    if (rec.lat != null) entry.lat = Number(rec.lat);
    if (rec.lon != null) entry.lon = Number(rec.lon);
    if (rec.speed != null) entry.speed = Number(rec.speed);
    if (rec.driver || rec.kierowca) entry.driver = rec.driver || rec.kierowca;
    if (rec.location || rec.lokalizacja) entry.location = rec.location || rec.lokalizacja;

    if (!data.gpsHistory) data.gpsHistory = [];
    data.gpsHistory.push(entry);
    if (data.gpsHistory.length > 500) data.gpsHistory = data.gpsHistory.slice(-500);

    await env.DB.prepare(
      "UPDATE vehicles SET data = ?, updated_at = datetime('now') WHERE company_id = ? AND nr_rej = ?"
    ).bind(JSON.stringify(data), company, nrRej).run();
    updated++;
  }

  return json({ ok: true, updated, skipped: skipped.length, errors: skipped.slice(0, 10) });
}

// ─── FUEL CARD WEBHOOK ────────────────────────────────────────────────────────
function _parseFuelCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const sep = [';', ',', '\t'].sort((a, b) =>
    (lines[0].split(b).length - lines[0].split(a).length))[0];
  function norm(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, ' ').trim();
  }
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
  const ALIASES = {
    date:       ['data','data transakcji','data tankowania','transaction date','date'],
    time:       ['godzina','czas','time','godzina transakcji'],
    nrRej:      ['nr rejestracyjny','nr rej','rejestracja','nr.rej.','plate','vehicle reg','registration'],
    liters:     ['ilosc','litry','litrow','volume','quantity','vol l','fuel qty','ilosc l','ilosc (l)','ilosc paliwa','liters','litres'],
    pricePerL:  ['cena','cena za litr','cena/l','unit price','price','cena jedn'],
    totalGross: ['kwota brutto','kwota','total','total amount','amount','wartosc','wartosc brutto','suma','kwota transakcji'],
    totalNet:   ['kwota netto','net','net amount','wartosc netto','suma netto'],
    station:    ['stacja','stacja paliw','station','site name','site'],
    product:    ['produkt','product','fuel type','rodzaj paliwa','paliwo','fuel','typ paliwa'],
    km:         ['przebieg','licznik','km','odometer','mileage','stan km'],
    cardNo:     ['nr karty','numer karty','card number','card no','karta paliwowa'],
  };
  const fieldMap = {};
  headers.forEach((h, i) => {
    const hn = norm(h);
    for (const [canonical, aliases] of Object.entries(ALIASES)) {
      if (fieldMap[i]) continue;
      if (aliases.some(a => { const an = norm(a); return hn === an || hn.includes(an); }))
        fieldMap[i] = canonical;
    }
  });
  const PRODUCT_MAP = {
    on:'diesel','on evo':'diesel',diesel:'diesel',dieselevo:'diesel',
    pb95:'pb95',pb98:'pb98',benzyna:'pb95',
    lpg:'lpg',lng:'lng',cng:'cng',
    adblue:'mocznik',mocznik:'mocznik',
  };
  return lines.slice(1).map(line => {
    const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
    const rec = {};
    Object.entries(fieldMap).forEach(([i, f]) => { if (vals[i] !== undefined) rec[f] = vals[i]; });
    if (!rec.nrRej) return null;
    if (rec.liters)     rec.liters     = parseFloat(String(rec.liters).replace(',','.'))     || null;
    if (rec.pricePerL)  rec.pricePerL  = parseFloat(String(rec.pricePerL).replace(',','.'))  || null;
    if (rec.totalGross) rec.totalGross = parseFloat(String(rec.totalGross).replace(',','.')) || null;
    if (rec.totalNet)   rec.totalNet   = parseFloat(String(rec.totalNet).replace(',','.'))   || null;
    if (rec.km)         rec.km         = parseFloat(String(rec.km).replace(',','.'))         || null;
    if (rec.product) {
      const pn = norm(rec.product);
      rec.product = PRODUCT_MAP[pn] || Object.entries(PRODUCT_MAP).find(([k]) => pn.includes(k))?.[1] || 'inne';
    }
    return rec;
  }).filter(Boolean);
}

async function handleFuelWebhook(req, env, user, url) {
  const ct = req.headers.get('content-type') || '';
  let records;
  if (ct.includes('application/json')) {
    const body = await req.json().catch(() => null);
    if (!body) return err('Nieprawidłowy JSON');
    records = Array.isArray(body) ? body : [body];
  } else {
    records = _parseFuelCsv(await req.text());
  }
  if (!records.length) return err('Brak wierszy tankowań w payload');

  const company = url.searchParams.get('company') || user.company_id || 'mtoilet';
  if (user._apiKey && user.company_id && user.company_id !== company)
    return err('Brak dostępu do tej firmy', 403);

  const KOBIZE = { diesel:2.679, pb95:2.302, pb98:2.302, lpg:1.626, cng:2.154, lng:2.750 };
  let updated = 0;
  const skipped = [];

  for (const rec of records) {
    const nrRej = (rec.nrRej || '').toUpperCase().replace(/\s/g, '');
    if (!nrRej) { skipped.push({ reason: 'brak nr rej', rec }); continue; }

    const row = await env.DB.prepare(
      'SELECT * FROM vehicles WHERE company_id = ? AND nr_rej = ?'
    ).bind(company, nrRej).first();
    if (!row) { skipped.push({ reason: 'pojazd nie znaleziony', nrRej }); continue; }

    let data = {};
    try { data = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {}); } catch {}

    const entry = {
      id: crypto.randomUUID(),
      date: rec.date || new Date().toISOString().slice(0, 10),
      time: rec.time || '',
      liters: rec.liters ?? null,
      pricePerL: rec.pricePerL ?? null,
      totalGross: rec.totalGross ?? null,
      totalNet: rec.totalNet ?? null,
      station: rec.station || '',
      product: rec.product || 'diesel',
      km: rec.km ?? null,
      cardNo: rec.cardNo || '',
      source: 'webhook',
    };
    if (entry.liters) entry.co2kg = +(entry.liters * (KOBIZE[entry.product] || 0)).toFixed(3);

    if (!data.fuelHistory) data.fuelHistory = [];
    // Deduplicate by date+station+liters (avoid double-push from repeated webhooks)
    const isDup = data.fuelHistory.some(f =>
      f.date === entry.date && Math.abs((f.liters||0) - (entry.liters||0)) < 0.01 &&
      f.station === entry.station);
    if (!isDup) {
      data.fuelHistory.push(entry);
      if (data.fuelHistory.length > 1000) data.fuelHistory = data.fuelHistory.slice(-1000);
    }

    if (rec.km != null && Number(rec.km) > (data.stanKilometrow || 0))
      data.stanKilometrow = Number(rec.km);

    await env.DB.prepare(
      "UPDATE vehicles SET data = ?, updated_at = datetime('now') WHERE company_id = ? AND nr_rej = ?"
    ).bind(JSON.stringify(data), company, nrRej).run();
    updated++;
  }

  return json({ ok: true, updated, skipped: skipped.length, errors: skipped.slice(0, 10) });
}

// ─── ALERT TYPES ─────────────────────────────────────────────────────────────
async function handleAlertTypes(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean);
  const company = url.searchParams.get('company') || user.company_id || 'mtoilet';
  const canManage = user.role === 'admin' || (JSON.parse(user.extra_permissions || '[]')).includes('manage_alert_types');

  if (req.method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT * FROM alert_types WHERE (company_id IS NULL OR company_id=?) AND active=1 ORDER BY sort_order,name'
    ).bind(company).all();
    return json({ ok: true, types: rows.results || [] });
  }
  if (!canManage) return err('Brak uprawnień', 403);
  if (req.method === 'POST') {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!body.name || !body.category) return err('Wymagane: name, category');
    const id = crypto.randomUUID();
    const ddays = Array.isArray(body.default_days) ? body.default_days
      : (typeof body.default_days === 'string' ? JSON.parse(body.default_days) : [30,14,7]);
    await env.DB.prepare(
      `INSERT INTO alert_types(id,company_id,name,category,trigger_time,trigger_km,default_days,default_km,icon,sort_order)
       VALUES(?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, company, body.name, body.category,
      body.trigger_time ? 1 : 0, body.trigger_km ? 1 : 0,
      JSON.stringify(ddays),
      body.default_km || null, body.icon || 'ti-bell', body.sort_order || 99
    ).run();
    return json({ ok: true, id });
  }
  if (req.method === 'PUT' && segs[2]) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const sets = [], vals = [];
    if (body.name !== undefined)        { sets.push('name=?');         vals.push(body.name); }
    if (body.active !== undefined)      { sets.push('active=?');       vals.push(body.active ? 1 : 0); }
    if (body.default_days !== undefined){
      const dd = Array.isArray(body.default_days) ? body.default_days
        : (typeof body.default_days === 'string' ? JSON.parse(body.default_days) : [30,14,7]);
      sets.push('default_days=?'); vals.push(JSON.stringify(dd));
    }
    if (body.default_km !== undefined)  { sets.push('default_km=?');   vals.push(body.default_km || null); }
    if (body.icon !== undefined)        { sets.push('icon=?');         vals.push(body.icon); }
    if (!sets.length) return err('Brak pól');
    vals.push(segs[2]);
    await env.DB.prepare(`UPDATE alert_types SET ${sets.join(',')} WHERE id=?`).bind(...vals).run();
    return json({ ok: true });
  }
  if (req.method === 'DELETE' && segs[2]) {
    const existing = await env.DB.prepare('SELECT company_id FROM alert_types WHERE id=?').bind(segs[2]).first();
    if (!existing) return err('Typ alertu nie istnieje', 404);
    if (existing.company_id === null) return err('Nie można usunąć wbudowanego typu alertu', 403);
    await env.DB.prepare('UPDATE alert_types SET active=0 WHERE id=? AND company_id IS NOT NULL').bind(segs[2]).run();
    return json({ ok: true });
  }
  return err('Metoda niedozwolona', 405);
}

// ─── NOTIFICATION PREFS ───────────────────────────────────────────────────────
async function handleNotifPrefs(req, env, user, url) {
  if (req.method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT * FROM notification_prefs WHERE user_id=?'
    ).bind(user.id).all();
    return json({ ok: true, prefs: rows.results || [] });
  }
  if (req.method === 'PUT') {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!body.alert_type_id) return err('Wymagane alert_type_id');
    // Normalize threshold_days: accept array or JSON string
    let tdays = null;
    if (body.threshold_days != null) {
      const arr = Array.isArray(body.threshold_days) ? body.threshold_days
        : JSON.parse(body.threshold_days);
      tdays = JSON.stringify(arr);
    }
    const channels = typeof body.channels === 'object' && body.channels !== null
      ? JSON.stringify(body.channels)
      : JSON.stringify({ push: true, email: false, sms: false });
    await env.DB.prepare(`
      INSERT INTO notification_prefs(user_id,alert_type_id,enabled,channels,threshold_days,threshold_km,quiet_from,quiet_to)
      VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id,alert_type_id) DO UPDATE SET
        enabled=excluded.enabled, channels=excluded.channels,
        threshold_days=excluded.threshold_days, threshold_km=excluded.threshold_km,
        quiet_from=excluded.quiet_from, quiet_to=excluded.quiet_to
    `).bind(
      user.id, body.alert_type_id,
      body.enabled !== false ? 1 : 0,
      channels, tdays,
      body.threshold_km || null,
      body.quiet_from || '22:00',
      body.quiet_to   || '07:00',
    ).run();
    return json({ ok: true });
  }
  return err('Metoda niedozwolona', 405);
}

// ─── NOTIFICATION LOG ─────────────────────────────────────────────────────────
async function handleNotifLog(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean);
  const company = url.searchParams.get('company') || 'mtoilet';

  if (req.method === 'GET') {
    const limit  = Math.min(parseInt(url.searchParams.get('limit')  || '100'), 500);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const alertTypeFilter = url.searchParams.get('alert_type_id');
    const vehicleFilter   = url.searchParams.get('vehicle_nr_rej');
    const channelFilter   = url.searchParams.get('channel');
    let q = `SELECT * FROM notification_log WHERE company_id=? AND (user_id=? OR ? IN ('admin','kierownik'))`;
    const params = [company, user.id, user.role];
    if (alertTypeFilter) { q += ' AND alert_type_id=?'; params.push(alertTypeFilter); }
    if (vehicleFilter)   { q += ' AND vehicle_nr_rej=?'; params.push(vehicleFilter); }
    if (channelFilter)   { q += ' AND channel=?'; params.push(channelFilter); }
    q += ' ORDER BY sent_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = await env.DB.prepare(q).bind(...params).all();
    return json({ ok: true, entries: rows.results || [] });
  }
  if (req.method === 'POST') {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    // actions: acknowledge | snooze | add
    if (body.action === 'acknowledge' && body.id) {
      await env.DB.prepare(
        "UPDATE notification_log SET acknowledged_at=datetime('now') WHERE id=? AND (user_id=? OR ?='admin')"
      ).bind(body.id, user.id, user.role).run();
      return json({ ok: true });
    }
    if (body.action === 'snooze' && body.id) {
      const days = Math.max(1, Math.min(parseInt(body.days || 7), 90));
      await env.DB.prepare(
        `UPDATE notification_log SET snoozed_until=datetime('now','+'||?||' days'),snooze_days=?
         WHERE id=? AND (user_id=? OR ?='admin')`
      ).bind(days, days, body.id, user.id, user.role).run();
      return json({ ok: true });
    }
    if (body.action === 'add') {
      const id = crypto.randomUUID().replace(/-/g,'').toLowerCase();
      await env.DB.prepare(
        `INSERT INTO notification_log(id,company_id,user_id,alert_type_id,vehicle_nr_rej,label,detail,days_until,km_until,channel)
         VALUES(?,?,?,?,?,?,?,?,?,?)`
      ).bind(id, company, user.id, body.alert_type_id || null,
        body.vehicle_nr_rej || null, body.label, body.detail || null,
        body.days_until ?? null, body.km_until ?? null, body.channel || 'inapp'
      ).run();
      return json({ ok: true, id });
    }
    return err('Nieznana akcja');
  }
  return err('Metoda niedozwolona', 405);
}

// ─── MAINTENANCE TEMPLATES ────────────────────────────────────────────────────
async function handleMaintenanceTemplates(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean);
  const company = url.searchParams.get('company') || user.company_id || 'mtoilet';
  const canManage = user.role === 'admin' || user.role === 'kierownik'
    || (JSON.parse(user.extra_permissions || '[]')).includes('manage_templates');

  if (req.method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT * FROM maintenance_templates WHERE company_id=? ORDER BY name'
    ).bind(company).all();
    const parsed = (rows.results || []).map(r => ({ ...r, items: JSON.parse(r.items || '[]') }));
    return json({ ok: true, templates: parsed });
  }
  if (!canManage) return err('Brak uprawnień', 403);
  if (req.method === 'POST') {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    // action: 'apply' — przypisuje szablon do pojazdów (template ID z URL segs[2])
    if (body.action === 'apply') {
      const templateId = segs[2] || body.templateId;
      const vehicleIds = body.vehicle_ids || body.nrRejes;
      if (!templateId) return err('Wymagane: template ID w URL');
      if (!Array.isArray(vehicleIds) || !vehicleIds.length) return err('Wymagane: vehicle_ids[]');
      const tpl = await env.DB.prepare('SELECT * FROM maintenance_templates WHERE id=? AND company_id=?').bind(templateId, company).first();
      if (!tpl) return err('Szablon nie istnieje', 404);
      const items = JSON.parse(tpl.items || '[]');
      let applied = 0;
      for (const vid of vehicleIds) {
        // Akceptujemy zarówno numeryczne ID jak i nr_rej
        const vRow = isNaN(vid)
          ? await env.DB.prepare('SELECT id,data FROM vehicles WHERE company_id=? AND nr_rej=?').bind(company, vid).first()
          : await env.DB.prepare('SELECT id,data FROM vehicles WHERE company_id=? AND id=?').bind(company, String(vid)).first();
        if (!vRow) continue;
        let data = {}; try { data = JSON.parse(vRow.data || '{}'); } catch {}
        if (!data.maintenanceItems) data.maintenanceItems = [];
        for (const item of items) {
          const exists = data.maintenanceItems.find(m => m.typeId === item.typeId);
          if (!exists) {
            data.maintenanceItems.push({ id: crypto.randomUUID(), typeId: item.typeId, label: item.label || null,
              intervalDays: item.intervalDays || null, intervalKm: item.intervalKm || null,
              lastDate: null, lastKm: null, nextDate: null, nextKm: null });
          }
        }
        await env.DB.prepare("UPDATE vehicles SET data=?,updated_at=datetime('now') WHERE id=? AND company_id=?")
          .bind(JSON.stringify(data), vRow.id, company).run();
        applied++;
      }
      return json({ ok: true, applied });
    }
    if (!body.name) return err('Wymagane: name');
    const id = crypto.randomUUID().replace(/-/g,'').slice(0,12);
    await env.DB.prepare(
      'INSERT INTO maintenance_templates(id,company_id,name,description,items,created_by) VALUES(?,?,?,?,?,?)'
    ).bind(id, company, body.name, body.description || null, JSON.stringify(body.items || []), user.id).run();
    return json({ ok: true, id });
  }
  if (req.method === 'PUT' && segs[2]) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const sets = [], vals = [];
    if (body.name !== undefined)        { sets.push('name=?');        vals.push(body.name); }
    if (body.description !== undefined) { sets.push('description=?'); vals.push(body.description); }
    if (body.items !== undefined)       { sets.push('items=?');       vals.push(JSON.stringify(body.items)); }
    if (!sets.length) return err('Brak pól');
    vals.push(segs[2]);
    await env.DB.prepare(`UPDATE maintenance_templates SET ${sets.join(',')} WHERE id=?`).bind(...vals).run();
    return json({ ok: true });
  }
  if (req.method === 'DELETE' && segs[2]) {
    await env.DB.prepare('DELETE FROM maintenance_templates WHERE id=? AND company_id=?').bind(segs[2], company).run();
    return json({ ok: true });
  }
  return err('Metoda niedozwolona', 405);
}

// ─── USER PERMISSIONS (admin nadaje extra_permissions innym użytkownikom) ─────
async function handleUserPermissions(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean); // /api/users/:id/permissions
  const targetId = segs[2];
  if (!targetId) return err('Wymagane user id');
  const myPerms = JSON.parse(user.extra_permissions || '[]');
  const canManage = user.role === 'admin' || myPerms.includes('manage_roles');
  if (!canManage) return err('Brak uprawnień', 403);

  if (req.method === 'GET') {
    const row = await env.DB.prepare('SELECT id,name,role,extra_permissions FROM users WHERE id=?').bind(targetId).first();
    if (!row) return err('Użytkownik nie istnieje', 404);
    return json({ ...row, extra_permissions: JSON.parse(row.extra_permissions || '[]') });
  }
  if (req.method === 'PUT') {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const allowed = ['manage_alert_types','manage_templates','manage_notifications','manage_roles'];
    const perms = (body.extra_permissions || body.permissions || []).filter(p => allowed.includes(p));
    // Użytkownik bez manage_roles nie może nadawać manage_roles
    if (!myPerms.includes('manage_roles') && user.role !== 'admin' && perms.includes('manage_roles')) {
      return err('Brak uprawnień do nadawania manage_roles', 403);
    }
    await env.DB.prepare('UPDATE users SET extra_permissions=? WHERE id=?').bind(JSON.stringify(perms), targetId).run();
    return json({ ok: true, permissions: perms });
  }
  return err('Metoda niedozwolona', 405);
}

// ─── MAIN FETCH ───────────────────────────────────────────────────────────────
async function handleRequest(request, env, url, path) {
  // Public endpoints (no auth required)
  if (path === '/api/auth/login'            && request.method === 'POST') return handleLogin(request, env);
  if (path === '/api/auth/logout'           && request.method === 'POST') return handleLogout(request, env);
  if (path === '/api/push/vapid-public-key' && request.method === 'GET')  return handleVapidPublicKey(request, env);
  if (path === '/api/push/subscribe'        && request.method === 'POST') return handlePushSubscribe(request, env);
  if (path === '/api/push/subscribe'        && request.method === 'DELETE') return handlePushUnsubscribe(request, env);

  // Protected endpoints
  const user = await getUser(request, env);

  // Klucze API są związane z JEDNĄ firmą — w przeciwieństwie do sesji ludzkich (które mogą przełączać firmy w UI),
  // każde żądanie kluczem API musi dotyczyć dokładnie tej firmy, do której klucz został wydany.
  if (user && user._apiKey) {
    const reqCompany = url.searchParams.get('company');
    if (reqCompany && reqCompany !== user.company_id) {
      return err('Klucz API nie ma dostępu do tej firmy', 403);
    }
    if (request.method === 'POST' || request.method === 'PUT') {
      try {
        const clone = request.clone();
        const peek = await clone.json();
        if (peek && peek.company_id && peek.company_id !== user.company_id) {
          return err('Klucz API nie ma dostępu do tej firmy', 403);
        }
      } catch { /* body nie jest JSON-em lub jest puste — pomiń */ }
    }
  }

  // Sesyjni użytkownicy z rolą inną niż admin są ograniczeni do własnej firmy.
  // Admin może odpytywać dowolną firmę (zarządzanie wieloma klientami z jednego konta).
  if (user && !user._apiKey && user.role !== 'admin') {
    const reqCompany = url.searchParams.get('company');
    if (reqCompany && reqCompany !== user.company_id) {
      return err('Brak dostępu do tej firmy', 403);
    }
  }

  if (path === '/api/export' && request.method === 'GET') {
    if (!user) return err('Nieautoryzowany', 401);
    const company = url.searchParams.get('company');
    if (!company) return err('Podaj parametr ?company=');
    if (!user._apiKey && !['admin', 'kierownik'].includes(user.role)) return err('Brak uprawnień do eksportu danych', 403);
    return handleExport(env, company);
  }
  if (path === '/api/import' && request.method === 'POST') {
    if (!user) return err('Nieautoryzowany', 401);
    const company = url.searchParams.get('company');
    if (!company) return err('Podaj parametr ?company=');
    if (user._apiKey) {
      if (user.api_key_scope !== 'read_write') return err('Klucz API ma tylko uprawnienia do odczytu', 403);
    } else if (!['admin', 'kierownik'].includes(user.role)) {
      return err('Brak uprawnień do importu danych', 403);
    }
    return handleImport(request, env, company);
  }
  if (path.startsWith('/api/drivers'))      { if (!user) return err('Nieautoryzowany', 401); return handleDrivers(request, env, user, url, path); }
  if (path.startsWith('/api/fines'))        { if (!user) return err('Nieautoryzowany', 401); return handleFines(request, env, user, url, path); }
  if (path.startsWith('/api/fleet-cards'))  { if (!user) return err('Nieautoryzowany', 401); return handleFleetCards(request, env, user, url, path); }
  if (path.startsWith('/api/reservations')) { if (!user) return err('Nieautoryzowany', 401); return handleReservations(request, env, user, url, path); }
  if (path.startsWith('/api/api-keys'))     { if (!user) return err('Nieautoryzowany', 401); return handleApiKeys(request, env, user, url, path); }

  if (path === '/api/webhook/gps' || path === '/api/webhook/tekom') {
    if (request.method !== 'POST') return err('Tylko POST', 405);
    let webhookUser = user;
    if (!webhookUser) {
      const keyParam = url.searchParams.get('key');
      if (keyParam && keyParam.startsWith('tord_')) webhookUser = await getApiKeyUser(keyParam, env);
    }
    if (!webhookUser) return err('Nieautoryzowany', 401);
    if (webhookUser._apiKey && webhookUser.api_key_scope !== 'read_write') return err('Klucz API tylko do odczytu', 403);
    return handleGpsWebhook(request, env, webhookUser, url);
  }

  if (path === '/api/webhook/fuel') {
    if (request.method !== 'POST') return err('Tylko POST', 405);
    let webhookUser = user;
    if (!webhookUser) {
      const keyParam = url.searchParams.get('key');
      if (keyParam && keyParam.startsWith('tord_')) webhookUser = await getApiKeyUser(keyParam, env);
    }
    if (!webhookUser) return err('Nieautoryzowany', 401);
    if (webhookUser._apiKey && webhookUser.api_key_scope !== 'read_write') return err('Klucz API tylko do odczytu', 403);
    return handleFuelWebhook(request, env, webhookUser, url);
  }

  if (path === '/api/auth/me') {
    if (!user) return err('Nieautoryzowany', 401);
    return json(safeUser(user));
  }
  if (path === '/api/users/me/password' && request.method === 'PUT') {
    if (!user) return err('Nieautoryzowany — zaloguj się', 401);
    return handleChangeMyPassword(request, env, user);
  }
  if (path.startsWith('/api/vehicles')) { if (!user) return err('Nieautoryzowany', 401); return handleVehicles(request, env, user, url, path); }
  if (path.startsWith('/api/state/'))   { if (!user) return err('Nieautoryzowany', 401); return handleState(request, env, user, url, path); }
  if (path.startsWith('/api/prefs'))    { if (!user) return err('Nieautoryzowany', 401); return handlePrefs(request, env, user); }
  if (path.startsWith('/api/docs'))     { if (!user) return err('Nieautoryzowany', 401); return handleDocs(request, env, user, url, path); }
  if (path.startsWith('/api/damages'))  { if (!user) return err('Nieautoryzowany', 401); return handleDamages(request, env, user, url, path); }
  if (path.startsWith('/api/tires'))    { if (!user) return err('Nieautoryzowany', 401); return handleTires(request, env, user, url, path); }
  if (path.startsWith('/api/service-orders')) { if (!user) return err('Nieautoryzowany', 401); return handleServiceOrders(request, env, user, url, path); }
  if (path.startsWith('/api/protocols'))      { if (!user) return err('Nieautoryzowany', 401); return handleProtocols(request, env, user, url, path); }
  // CFM — dane finansowo-kontraktowe, dostęp tylko admin/kierownik (spójne z ograniczeniem ROLE_TABS w UI)
  if (path.startsWith('/api/cfm-')) {
    if (!user) return err('Nieautoryzowany', 401);
    if (!['admin', 'kierownik'].includes(user.role)) return err('Brak uprawnień do modułu CFM', 403);
    if (path.startsWith('/api/cfm-clients'))   return handleCfmClients(request, env, user, url, path);
    if (path.startsWith('/api/cfm-contracts')) return handleCfmContracts(request, env, user, url, path);
    if (path.startsWith('/api/cfm-invoices'))  return handleCfmInvoices(request, env, user, url, path);
  }
  if (path.startsWith('/api/users')) {
    if (!user) return err('Nieautoryzowany', 401);
    if (path.match(/^\/api\/users\/\d+\/permissions/)) return handleUserPermissions(request, env, user, url, path);
    return handleUsers(request, env, user, url, path);
  }
  if (path.startsWith('/api/alert-types'))        { if (!user) return err('Nieautoryzowany', 401); return handleAlertTypes(request, env, user, url, path); }
  if (path.startsWith('/api/notif-prefs'))         { if (!user) return err('Nieautoryzowany', 401); return handleNotifPrefs(request, env, user, url); }
  if (path.startsWith('/api/notif-log'))           { if (!user) return err('Nieautoryzowany', 401); return handleNotifLog(request, env, user, url, path); }
  if (path.startsWith('/api/maintenance-templates')){ if (!user) return err('Nieautoryzowany', 401); return handleMaintenanceTemplates(request, env, user, url, path); }
  // Admin: ręczne wyzwolenie kolejkowania powiadomień (do testów bez crona)
  if (path === '/api/notif-trigger' && request.method === 'POST') {
    if (!user) return err('Nieautoryzowany', 401);
    if (user.role !== 'admin') return err('Brak uprawnień', 403);
    const dryRun = url.searchParams.get('dry_run') === '1';
    if (dryRun) {
      const preview = await previewNotificationJobs(env);
      return json({ ok: true, dry_run: true, ...preview });
    }
    await queueNotificationJobs(env);
    return json({ ok: true, msg: 'Kolejkowanie zakończone — sprawdź zakładkę Historia za chwilę' });
  }
  if (path === '/api/ai/chat')          return handleAI(request, env);
  if (path === '/api/ai/ocr' && request.method === 'POST') return handleAIOCR(request, env);
  if (path === '/api/aztec'  && request.method === 'POST') return handleAztec(request);

  // CEPiK proxy — public (token passed in X-Cepik-Token / Authorization header)
  if (path === '/api/cepik/token'   && request.method === 'POST') return handleCepikToken(request);
  if (path === '/api/cepik/pojazdy' && request.method === 'GET')  return handleCepikPojazdy(request, url);
  if (path === '/api/cepik/kierowca' && request.method === 'GET') return handleCepikKierowca(request, url);

  // Push (authenticated parts)
  if (path === '/api/push/generate-keys' && request.method === 'GET') {
    if (!user) return err('Nieautoryzowany', 401);
    return handleGenerateVapidKeys(request, env, user);
  }
  if (path === '/api/push/send' && request.method === 'POST') return handlePushSend(request, env, user);

  return err('Endpoint nie istnieje', 404);
}

// ─── HELPERS dla budowania alertów (push/email/sms używają tego samego) ─────────
function _daysUntil(ds) {
  if (!ds) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(ds);
  return isNaN(d) ? null : Math.round((d - now) / 86400000);
}

function buildVehicleAlerts(vehRows, alertTypes) {
  const BUILTIN_FIELDS = {
    oc:            v => v.ocEnd           ? { date: v.ocEnd }           : null,
    ac:            v => v.acEnd           ? { date: v.acEnd }           : null,
    przeglad_tech: v => v.nextInspection  ? { date: v.nextInspection }  : null,
    udt:           v => v.hasUdt && v.udtNextDate ? { date: v.udtNextDate } : null,
    tacho:         v => v.hasTacho && v.tachoNextCalib ? { date: v.tachoNextCalib } : null,
    opony_zmiana:  v => v.tireNextChange  ? { date: v.tireNextChange }  : null,
  };
  const alerts = [];
  for (const vRow of vehRows) {
    let v = {}; try { v = JSON.parse(vRow.data || '{}'); } catch {}
    for (const [typeId, getter] of Object.entries(BUILTIN_FIELDS)) {
      const res = getter(v);
      if (!res) continue;
      const days = _daysUntil(res.date);
      if (days === null) continue;
      alerts.push({ subject: vRow.nr_rej, nrRej: vRow.nr_rej, typeId, label: alertTypes.find(a => a.id === typeId)?.name || typeId, days, km: null, expired: days < 0 });
    }
    for (const item of (v.maintenanceItems || [])) {
      const at = alertTypes.find(a => a.id === item.typeId);
      const itemLabel = item.label || at?.name || item.typeId;
      if (item.nextDate) {
        const days = _daysUntil(item.nextDate);
        if (days !== null) alerts.push({ subject: vRow.nr_rej, nrRej: vRow.nr_rej, typeId: item.typeId, label: itemLabel, days, km: null, expired: days < 0 });
      }
      if (item.nextKm && v.stanKilometrow) {
        const kmLeft = item.nextKm - v.stanKilometrow;
        alerts.push({ subject: vRow.nr_rej, nrRej: vRow.nr_rej, typeId: item.typeId, label: itemLabel, days: null, km: kmLeft, expired: kmLeft < 0 });
      }
    }
  }
  return alerts;
}

function buildDriverAlerts(driverRows) {
  const alerts = [];
  for (const d of driverRows) {
    if (!d.license_expiry) continue;
    const days = _daysUntil(d.license_expiry);
    if (days === null) continue;
    alerts.push({
      subject: d.name,
      nrRej: null,
      driverName: d.name,
      typeId: 'driver_license',
      label: `Prawo jazdy: ${d.name}`,
      days,
      km: null,
      expired: days < 0,
    });
  }
  return alerts;
}

function buildFineAlerts(fineRows) {
  const alerts = [];
  for (const f of fineRows) {
    if (!f.deadline || f.paid) continue;
    const days = _daysUntil(f.deadline);
    if (days === null) continue;
    const subj = f.nr_rej || f.driver_name || 'Mandat';
    alerts.push({
      subject: subj,
      nrRej: f.nr_rej || null,
      driverName: f.driver_name || null,
      typeId: 'fine_deadline',
      label: `Termin zapłaty mandatu${f.nr_rej ? ` ${f.nr_rej}` : ''}${f.driver_name ? ` / ${f.driver_name}` : ''}`,
      days,
      km: null,
      expired: days < 0,
    });
  }
  return alerts;
}

function filterAlertsForUser(vehicleAlerts, prefs) {
  const DEFAULT_DAYS = 14;
  return vehicleAlerts.filter(a => {
    const pref = prefs[a.typeId];
    if (pref?.enabled === 0) return false;
    let threshDays = null;
    try { threshDays = pref?.threshold_days ? JSON.parse(pref.threshold_days) : null; } catch {}
    const threshKm = pref?.threshold_km ?? null;
    if (a.days !== null) return a.days <= (threshDays ? Math.max(...threshDays) : DEFAULT_DAYS);
    if (a.km  !== null) return a.km  <= (threshKm ?? 500);
    return false;
  });
}

function buildPushPayload(myAlerts) {
  myAlerts.sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999));
  const first = myAlerts[0];
  const expiredCount = myAlerts.filter(a => a.expired).length;
  const title = expiredCount
    ? `TaxOrder — ${expiredCount} termin${expiredCount > 1 ? 'y' : ''} WYGASŁ${expiredCount > 1 ? 'Y' : ''}`
    : `TaxOrder — ${myAlerts.length} alert${myAlerts.length > 1 ? 'y' : ''} wkrótce`;
  const subj = first.subject || first.nrRej || '—';
  const bodyMsg = first.days !== null
    ? `${subj}: ${first.label} ${first.expired ? `wygasło ${Math.abs(first.days)} dni temu` : `wygasa za ${first.days} dni`}`
    : `${subj}: ${first.label} za ${first.km} km`;
  return { title, body: bodyMsg + (myAlerts.length > 1 ? ` (+${myAlerts.length - 1} więcej)` : ''), urgent: expiredCount > 0, first };
}

function isInQuietHours(prefs, nowHour) {
  const firstPref = Object.values(prefs)[0];
  if (!firstPref?.quiet_from || !firstPref?.quiet_to) return false;
  const from = parseInt(firstPref.quiet_from.split(':')[0], 10);
  const to   = parseInt(firstPref.quiet_to.split(':')[0],   10);
  return from > to ? (nowHour >= from || nowHour < to) : (nowHour >= from && nowHour < to);
}

// ─── DRY RUN: podgląd co zostałoby zakolejkowane ────────────────────────────────
async function previewNotificationJobs(env) {
  const atRows = await env.DB.prepare('SELECT * FROM alert_types WHERE active=1').all();
  const alertTypes = atRows.results || [];
  const subsRows = await env.DB.prepare('SELECT DISTINCT company_id FROM push_subscriptions').all();
  const companies = (subsRows.results || []).map(r => r.company_id);
  const nowHour = new Date().getUTCHours();
  const preview = [];
  let totalSubs = 0;

  for (const company_id of companies) {
    const subRows = await env.DB.prepare('SELECT * FROM push_subscriptions WHERE company_id=?').bind(company_id).all();
    const subs = subRows.results || [];
    totalSubs += subs.length;

    const [vehRows, drvRows, fineRows] = await Promise.all([
      env.DB.prepare('SELECT nr_rej, data FROM vehicles WHERE company_id=?').bind(company_id).all(),
      env.DB.prepare('SELECT name, license_expiry FROM drivers WHERE company_id=?').bind(company_id).all().catch(() => ({ results: [] })),
      env.DB.prepare('SELECT nr_rej, driver_name, deadline, paid FROM fines WHERE company_id=? AND paid=0').bind(company_id).all().catch(() => ({ results: [] })),
    ]);
    const allAlerts = [
      ...buildVehicleAlerts(vehRows.results || [], alertTypes),
      ...buildDriverAlerts(drvRows.results || []),
      ...buildFineAlerts(fineRows.results || []),
    ];

    const prefRows = await env.DB.prepare(
      `SELECT np.user_id, np.alert_type_id, np.enabled, np.threshold_days, np.threshold_km, np.quiet_from, np.quiet_to
       FROM notification_prefs np JOIN users u ON u.id=np.user_id AND u.active=1`
    ).all().catch(() => ({ results: [] }));
    const userPrefs = {};
    for (const row of (prefRows.results || [])) {
      if (!userPrefs[row.user_id]) userPrefs[row.user_id] = {};
      userPrefs[row.user_id][row.alert_type_id] = row;
    }
    for (const sub of subs) {
      const prefs = userPrefs[sub.user_id] || {};
      const quiet = isInQuietHours(prefs, nowHour);
      const myAlerts = filterAlertsForUser(allAlerts, prefs);
      if (myAlerts.length) {
        const { title, body, first } = buildPushPayload([...myAlerts]);
        preview.push({ type: 'push', sub_id: sub.id, user_id: sub.user_id, company_id, quiet, alerts_count: myAlerts.length, title, body,
          top_alert: { subject: first.subject, nrRej: first.nrRej, typeId: first.typeId, days: first.days, km: first.km, expired: first.expired },
          all_alerts: myAlerts.map(a => ({ subject: a.subject, nrRej: a.nrRej, typeId: a.typeId, days: a.days, km: a.km, expired: a.expired })) });
      }
    }
    // Email preview
    const emailUserRows = await env.DB.prepare(
      `SELECT u.id, u.email FROM users u
       WHERE u.email IS NOT NULL AND u.email != '' AND u.active=1
         AND EXISTS (
           SELECT 1 FROM notification_prefs np
           WHERE np.user_id=u.id AND np.enabled=1 AND json_extract(np.channels,'$.email')=1
         )`
    ).all().catch(() => ({ results: [] }));
    for (const usr of (emailUserRows.results || [])) {
      const prefs = userPrefs[usr.id] || {};
      const quiet = isInQuietHours(prefs, nowHour);
      const myAlerts = filterAlertsForUser(allAlerts, prefs);
      if (myAlerts.length) {
        const { title, first } = buildPushPayload([...myAlerts]);
        preview.push({ type: 'email', user_id: usr.id, to_email: usr.email, company_id, quiet, alerts_count: myAlerts.length, title,
          top_alert: { subject: first.subject, nrRej: first.nrRej, typeId: first.typeId, days: first.days, km: first.km, expired: first.expired } });
      }
    }
    // SMS preview
    const smsUserRows = await env.DB.prepare(
      `SELECT u.id, u.telefon FROM users u
       WHERE u.telefon IS NOT NULL AND u.telefon != '' AND u.active=1
         AND EXISTS (
           SELECT 1 FROM notification_prefs np
           WHERE np.user_id=u.id AND np.enabled=1 AND json_extract(np.channels,'$.sms')=1
         )`
    ).all().catch(() => ({ results: [] }));
    for (const usr of (smsUserRows.results || [])) {
      const prefs = userPrefs[usr.id] || {};
      const quiet = isInQuietHours(prefs, nowHour);
      const myAlerts = filterAlertsForUser(allAlerts, prefs);
      if (myAlerts.length) {
        const { title, first } = buildPushPayload([...myAlerts]);
        preview.push({ type: 'sms', user_id: usr.id, to_phone: usr.telefon, company_id, quiet, alerts_count: myAlerts.length, title,
          top_alert: { subject: first.subject, nrRej: first.nrRej, typeId: first.typeId, days: first.days, km: first.km } });
      }
    }
  }
  const pushJobs  = preview.filter(p => p.type === 'push');
  const emailJobs = preview.filter(p => p.type === 'email');
  const smsJobs   = preview.filter(p => p.type === 'sms');
  return {
    companies: companies.length, total_subscriptions: totalSubs,
    would_queue: preview.length,
    push_jobs: pushJobs.length,
    email_jobs: emailJobs.length,
    sms_jobs: smsJobs.length,
    resend_configured: !!env.RESEND_API_KEY,
    smsapi_configured: !!env.SMSAPI_TOKEN,
    vehicle_alerts_total: preview.reduce((s,p) => s + p.alerts_count, 0),
    jobs: preview,
  };
}

// ─── CRON: kolejkuje zadania powiadomień → Queue consumer wysyła asynchronicznie ─
async function queueNotificationJobs(env) {
  // Jeśli brak Queue (lokalny dev), fallback do synchronicznego wysyłania
  if (!env.NOTIF_QUEUE) return _sendNotificationsSync(env);

  const atRows = await env.DB.prepare('SELECT * FROM alert_types WHERE active=1').all();
  const alertTypes = atRows.results || [];

  const subsRows = await env.DB.prepare('SELECT DISTINCT company_id FROM push_subscriptions').all();
  const companies = (subsRows.results || []).map(r => r.company_id);
  if (!companies.length) return;

  const nowHour = new Date().getUTCHours();
  const jobBatch = [];

  for (const company_id of companies) {
    const subRows = await env.DB.prepare('SELECT * FROM push_subscriptions WHERE company_id=?').bind(company_id).all();
    const subs = subRows.results || [];
    if (!subs.length) continue;

    const [vehRows, drvRows, fineRows] = await Promise.all([
      env.DB.prepare('SELECT nr_rej, data FROM vehicles WHERE company_id=?').bind(company_id).all(),
      env.DB.prepare('SELECT name, license_expiry FROM drivers WHERE company_id=?').bind(company_id).all().catch(() => ({ results: [] })),
      env.DB.prepare('SELECT nr_rej, driver_name, deadline, paid FROM fines WHERE company_id=? AND paid=0').bind(company_id).all().catch(() => ({ results: [] })),
    ]);
    const allAlerts = [
      ...buildVehicleAlerts(vehRows.results || [], alertTypes),
      ...buildDriverAlerts(drvRows.results || []),
      ...buildFineAlerts(fineRows.results || []),
    ];
    if (!allAlerts.length) continue;

    // Załaduj preferencje wszystkich użytkowników firmy
    const prefRows = await env.DB.prepare(
      `SELECT np.user_id, np.alert_type_id, np.enabled, np.threshold_days, np.threshold_km, np.quiet_from, np.quiet_to
       FROM notification_prefs np
       JOIN users u ON u.id=np.user_id AND u.active=1`
    ).all().catch(() => ({ results: [] }));
    const userPrefs = {};
    for (const row of (prefRows.results || [])) {
      if (!userPrefs[row.user_id]) userPrefs[row.user_id] = {};
      userPrefs[row.user_id][row.alert_type_id] = row;
    }

    for (const sub of subs) {
      const prefs = userPrefs[sub.user_id] || {};
      if (isInQuietHours(prefs, nowHour)) continue;

      const myAlerts = filterAlertsForUser(allAlerts, prefs);
      if (!myAlerts.length) continue;

      const { title, body, urgent, first } = buildPushPayload([...myAlerts]);
      jobBatch.push({ body: {
        type: 'push',
        company_id,
        user_id: sub.user_id || null,
        sub_id: sub.id,
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth_key: sub.auth_key,
        alert_type_id: first.typeId,
        vehicle_nr_rej: first.nrRej || null,
        subject: first.subject,
        label: body,
        days_until: first.days,
        km_until: first.km,
        title, body, urgent,
      }});
    }

    // Email jobs — dla użytkowników firmy z channels.email=true
    if (env.RESEND_API_KEY) {
      const userRows = await env.DB.prepare(
        `SELECT u.id, u.email FROM users u
         WHERE u.email IS NOT NULL AND u.email != '' AND u.active=1
           AND EXISTS (
             SELECT 1 FROM notification_prefs np
             WHERE np.user_id=u.id AND np.enabled=1 AND json_extract(np.channels,'$.email')=1
           )`
      ).all().catch(() => ({ results: [] }));
      for (const usr of (userRows.results || [])) {
        const prefs = userPrefs[usr.id] || {};
        if (isInQuietHours(prefs, nowHour)) continue;
        const myAlerts = filterAlertsForUser(vehicleAlerts, prefs);
        if (!myAlerts.length) continue;
        const { title, first } = buildPushPayload([...myAlerts]);
        jobBatch.push({ body: {
          type: 'email',
          company_id,
          user_id: usr.id,
          to_email: usr.email,
          alert_type_id: first.typeId,
          vehicle_nr_rej: first.nrRej,
          label: title,
          days_until: first.days,
          km_until: first.km,
          title,
          alerts: myAlerts.map(a => ({ nrRej: a.nrRej, typeId: a.typeId, label: a.label, days: a.days, km: a.km, expired: a.expired })),
        }});
      }
    }

    // SMS jobs — dla użytkowników firmy z channels.sms=true i wypełnionym telefonem
    if (env.SMSAPI_TOKEN) {
      const smsUserRows = await env.DB.prepare(
        `SELECT u.id, u.telefon FROM users u
         WHERE u.telefon IS NOT NULL AND u.telefon != '' AND u.active=1
           AND EXISTS (
             SELECT 1 FROM notification_prefs np
             WHERE np.user_id=u.id AND np.enabled=1 AND json_extract(np.channels,'$.sms')=1
           )`
      ).all().catch(() => ({ results: [] }));
      for (const usr of (smsUserRows.results || [])) {
        const prefs = userPrefs[usr.id] || {};
        if (isInQuietHours(prefs, nowHour)) continue;
        const myAlerts = filterAlertsForUser(vehicleAlerts, prefs);
        if (!myAlerts.length) continue;
        const { title, first } = buildPushPayload([...myAlerts]);
        jobBatch.push({ body: {
          type: 'sms',
          company_id,
          user_id: usr.id,
          to_phone: usr.telefon,
          alert_type_id: first.typeId,
          vehicle_nr_rej: first.nrRej,
          label: title,
          days_until: first.days,
          km_until: first.km,
          alerts: myAlerts.map(a => ({ nrRej: a.nrRej, typeId: a.typeId, label: a.label, days: a.days, km: a.km, expired: a.expired })),
        }});
      }
    }

    console.log(`[Notif queue] ${company_id}: ${vehicleAlerts.length} alertów, ${subs.length} sub`);
  }

  // Wyślij do kolejki partiami po 100 (limit CF)
  for (let i = 0; i < jobBatch.length; i += 100) {
    await env.NOTIF_QUEUE.sendBatch(jobBatch.slice(i, i + 100));
  }
  console.log(`[Notif queue] Zakolejkowano ${jobBatch.length} zadań`);
}

// ─── EMAIL: Resend API ───────────────────────────────────────────────────────
function buildEmailHtml(alerts) {
  const rows = alerts.map(a => {
    const daysStr = a.days != null
      ? (a.days <= 0 ? '<b style="color:#c0392b">WYGASŁO</b>' : `za <b>${a.days}</b> dni`)
      : '';
    const kmStr   = a.km   != null ? `, za <b>${a.km}</b> km` : '';
    return `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${a.nrRej}</td>
              <td style="padding:6px 12px;border-bottom:1px solid #eee">${a.label || a.typeId}</td>
              <td style="padding:6px 12px;border-bottom:1px solid #eee">${daysStr}${kmStr}</td></tr>`;
  }).join('');
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto">
  <h2 style="color:#2c3e50;border-bottom:2px solid #3498db;padding-bottom:8px">TaxOrder Pro — Alerty flotowe</h2>
  <table style="width:100%;border-collapse:collapse">
    <thead><tr style="background:#3498db;color:#fff">
      <th style="padding:8px 12px;text-align:left">Nr rej.</th>
      <th style="padding:8px 12px;text-align:left">Typ alertu</th>
      <th style="padding:8px 12px;text-align:left">Termin</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="margin-top:16px;font-size:13px;color:#666">
    Zaloguj się do <a href="https://taxorder-pro.pages.dev">TaxOrder Pro</a>, aby zarządzać alertami.
  </p></body></html>`;
}

async function sendEmailViaResend(env, to, subject, html) {
  if (!env.RESEND_API_KEY) return { status: 0 };
  const from = env.RESEND_FROM_EMAIL || 'TaxOrder Pro <noreply@taxorderpro.com>';
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html }),
  }).catch(() => ({ status: 0 }));
}

// ─── SMS: SMSAPI.pl ──────────────────────────────────────────────────────────
function buildSmsText(alerts) {
  if (!alerts.length) return 'TaxOrder: brak alertów';
  const top = alerts[0];
  const more = alerts.length > 1 ? ` (+${alerts.length - 1})` : '';
  const daysStr = top.days != null ? (top.days <= 0 ? 'WYGASŁO' : `za ${top.days} dni`) : '';
  return `TaxOrder: ${top.nrRej} ${top.label || top.typeId} ${daysStr}${more}`.slice(0, 160);
}

async function sendSmsViaSmsApi(env, to, message) {
  if (!env.SMSAPI_TOKEN) return { status: 0 };
  const params = new URLSearchParams({
    to,
    message,
    format: 'json',
    from: env.SMSAPI_SENDER || 'TaxOrder',
  });
  return fetch('https://api.smsapi.pl/sms.do', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.SMSAPI_TOKEN}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  }).catch(() => ({ status: 0 }));
}

// ─── QUEUE CONSUMER: przetwarza zadania push/email/sms ────────────────────────
async function processNotifQueue(batch, env) {
  for (const msg of batch.messages) {
    const job = msg.body;
    try {
      if (job.type === 'push') {
        if (!env.VAPID_PRIVATE_KEY) { msg.ack(); continue; }
        const res = await sendPushMsg(
          { endpoint: job.endpoint, keys: { p256dh: job.p256dh, auth: job.auth_key } },
          { title: job.title, body: job.body, tag: 'taxorder-alert', url: '/?page=powiadomienia', urgent: job.urgent || false },
          env
        ).catch(() => ({ status: 0 }));

        if (res.status === 410) {
          await env.DB.prepare('DELETE FROM push_subscriptions WHERE id=?').bind(job.sub_id).run().catch(() => {});
          msg.ack();
        } else if (res.status >= 200 && res.status < 300) {
          // Log sukces
          const logId = crypto.randomUUID().replace(/-/g, '').toLowerCase();
          await env.DB.prepare(
            `INSERT INTO notification_log(id,company_id,user_id,alert_type_id,vehicle_nr_rej,label,days_until,km_until,channel)
             VALUES(?,?,?,?,?,?,?,?,?)`
          ).bind(logId, job.company_id, job.user_id || null, job.alert_type_id || null,
            job.vehicle_nr_rej || null, job.label, job.days_until ?? null, job.km_until ?? null, 'push'
          ).run().catch(() => {});
          msg.ack();
        } else {
          // Błąd serwera push — retry po 60s
          msg.retry({ delaySeconds: 60 });
        }
      } else if (job.type === 'email') {
        if (!env.RESEND_API_KEY) { msg.ack(); continue; }
        const subject = job.title || 'TaxOrder Pro — Alerty flotowe';
        const html    = buildEmailHtml(job.alerts || []);
        const res     = await sendEmailViaResend(env, job.to_email, subject, html);
        if (res.status === 200 || res.status === 201) {
          const logId = crypto.randomUUID().replace(/-/g, '').toLowerCase();
          await env.DB.prepare(
            `INSERT INTO notification_log(id,company_id,user_id,alert_type_id,vehicle_nr_rej,label,days_until,km_until,channel)
             VALUES(?,?,?,?,?,?,?,?,?)`
          ).bind(logId, job.company_id, job.user_id || null, job.alert_type_id || null,
            job.vehicle_nr_rej || null, job.label, job.days_until ?? null, job.km_until ?? null, 'email'
          ).run().catch(() => {});
          msg.ack();
        } else if (res.status === 429 || res.status === 500 || res.status === 503 || res.status === 0) {
          msg.retry({ delaySeconds: 300 });
        } else {
          msg.ack(); // 4xx (np. zły adres email) — nie retryować
        }
      } else if (job.type === 'sms') {
        if (!env.SMSAPI_TOKEN) { msg.ack(); continue; }
        const message = buildSmsText(job.alerts || []);
        const res     = await sendSmsViaSmsApi(env, job.to_phone, message);
        const ok      = res.status === 200 || res.status === 201;
        if (ok) {
          let bodyText = '';
          try { bodyText = await res.text(); } catch (_) {}
          const hasError = bodyText.includes('"invalid_login"') || bodyText.includes('"ERR"');
          if (hasError) { msg.ack(); } // błąd API (zły token, zły numer) — nie retry
          else {
            const logId = crypto.randomUUID().replace(/-/g, '').toLowerCase();
            await env.DB.prepare(
              `INSERT INTO notification_log(id,company_id,user_id,alert_type_id,vehicle_nr_rej,label,days_until,km_until,channel)
               VALUES(?,?,?,?,?,?,?,?,?)`
            ).bind(logId, job.company_id, job.user_id || null, job.alert_type_id || null,
              job.vehicle_nr_rej || null, job.label, job.days_until ?? null, job.km_until ?? null, 'sms'
            ).run().catch(() => {});
            msg.ack();
          }
        } else if (res.status === 429 || res.status === 500 || res.status === 503 || res.status === 0) {
          msg.retry({ delaySeconds: 300 });
        } else {
          msg.ack();
        }
      } else {
        msg.ack();
      }
    } catch (e) {
      console.error('[Queue consumer]', e.message, 'job:', JSON.stringify(job).slice(0, 200));
      msg.retry({ delaySeconds: 300 });
    }
  }
}

// Fallback synchroniczny gdy brak NOTIF_QUEUE (lokalny dev)
async function _sendNotificationsSync(env) {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return;
  const atRows = await env.DB.prepare('SELECT * FROM alert_types WHERE active=1').all();
  const alertTypes = atRows.results || [];
  const subsRows = await env.DB.prepare('SELECT DISTINCT company_id FROM push_subscriptions').all();
  const companies = (subsRows.results || []).map(r => r.company_id);
  const nowHour = new Date().getUTCHours();
  for (const company_id of companies) {
    const subRows = await env.DB.prepare('SELECT * FROM push_subscriptions WHERE company_id=?').bind(company_id).all();
    const subs = subRows.results || [];
    if (!subs.length) continue;
    const vehRows = await env.DB.prepare('SELECT nr_rej, data FROM vehicles WHERE company_id=?').bind(company_id).all();
    const vehicleAlerts = buildVehicleAlerts(vehRows.results || [], alertTypes);
    if (!vehicleAlerts.length) continue;
    const prefRows = await env.DB.prepare(
      `SELECT np.user_id, np.alert_type_id, np.enabled, np.threshold_days, np.threshold_km, np.quiet_from, np.quiet_to
       FROM notification_prefs np JOIN users u ON u.id=np.user_id AND u.active=1`
    ).all().catch(() => ({ results: [] }));
    const userPrefs = {};
    for (const row of (prefRows.results || [])) {
      if (!userPrefs[row.user_id]) userPrefs[row.user_id] = {};
      userPrefs[row.user_id][row.alert_type_id] = row;
    }
    for (const sub of subs) {
      const prefs = userPrefs[sub.user_id] || {};
      if (isInQuietHours(prefs, nowHour)) continue;
      const myAlerts = filterAlertsForUser(vehicleAlerts, prefs);
      if (!myAlerts.length) continue;
      const { title, body, urgent } = buildPushPayload([...myAlerts]);
      const res = await sendPushMsg({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } }, { title, body, tag: 'taxorder-alert', url: '/?page=powiadomienia', urgent }, env).catch(() => ({ status: 0 }));
      if (res.status === 410) await env.DB.prepare('DELETE FROM push_subscriptions WHERE id=?').bind(sub.id).run();
    }
  }
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
    ctx.waitUntil(Promise.all([
      cleanSessions(env),
      queueNotificationJobs(env),
    ]));
  },

  // Cloudflare Queue consumer — przetwarza zadania push/email/sms asynchronicznie
  async queue(batch, env) {
    await processNotifQueue(batch, env);
  },
};
