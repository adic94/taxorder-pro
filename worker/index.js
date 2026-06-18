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

// ─── AI CHAT ─────────────────────────────────────────────────────────────────
async function handleAI(request, env) {
  if (request.method !== 'POST') return err('Method not allowed', 405);
  let body; try { body = await request.json(); } catch { return err('Nieprawidłowe JSON'); }
  const { message, fleetSummary, history = [] } = body;
  if (!message?.trim()) return err('Brak wiadomości');
  if (!env.ANTHROPIC_API_KEY) return err('AI nie skonfigurowane — ustaw sekret ANTHROPIC_API_KEY', 503);

  const system = `Jesteś asystentem TaxOrder Pro — systemu DT-1 (podatek od środków transportowych) dla polskich firm.

Pomagasz z: obliczaniem podatku DT-1, kategoryzacją pojazdów (D1–D15), stawkami Warszawy 2026, wypełnianiem deklaracji DT-1/DT-1A, zarządzaniem flotą.

Stawki Warszawa 2026 (Uchwała XXIX/1065/2025). Format: kategoria | pojazdy <2024 | pojazdy ≥2024:
D1 Ciężarowy 3,5–5,5t | 984 zł | 888 zł
D2 Ciężarowy 5,5–9t | 1572 zł | 1416 zł
D3 Ciężarowy 9–12t | 1848 zł | 1656 zł
D8 Ciężarowy ≥12t 2 osie | 3264 zł | 2940 zł
D9 Ciężarowy ≥12t 3 osie | 3612 zł | 3252 zł
D10 Ciężarowy ≥12t 4+ osie | 3972 zł | 3576 zł
D11 Ciągnik ≥12t 2 osie | 2760 zł | 2484 zł
D12 Ciągnik ≥12t 3+ osie | 3180 zł | 2868 zł
D5 Przyczepa 7–12t | 1128 zł | 1016 zł (brak obniżki)
D13–D15 Przyczepa ≥12t 1/2/3 osie | 744–984 zł

Terminy: DT-1 do 15 lutego, II rata do 15 września.
Odpowiadaj po polsku, konkretnie i zwięźle.${fleetSummary ? '\n\nFlota użytkownika:\n' + fleetSummary : ''}`;

  const messages = [
    ...history.slice(-6).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1024, system, messages }),
  });

  if (!resp.ok) {
    const e = await resp.json().catch(() => ({}));
    return err('Błąd AI: ' + (e.error?.message || resp.statusText), 502);
  }
  const data = await resp.json();
  return json({ answer: data.content[0].text });
}

// ─── MAIN FETCH ───────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url  = new URL(request.url);
    const path = url.pathname;

    try {
      // Publiczne: login + setup helper
      if (path === '/api/auth/login' && request.method === 'POST') return handleLogin(request, env);
      if (path === '/api/auth/setup' && request.method === 'GET')  return handleSetup(request);
      if (path === '/api/auth/logout' && request.method === 'POST') return handleLogout(request, env);

      // Chronione: wymaga tokenu
      const user = await getUser(request, env);
      if (!user) return err('Nieautoryzowany — zaloguj się', 401);

      if (path === '/api/auth/me')                    return json(safeUser(user));
      if (path === '/api/users/me/password' && request.method === 'PUT') return handleChangeMyPassword(request, env, user);
      if (path.startsWith('/api/vehicles'))            return handleVehicles(request, env, user, url, path);
      if (path.startsWith('/api/state/'))              return handleState(request, env, user, url, path);
      if (path.startsWith('/api/prefs'))               return handlePrefs(request, env, user);
      if (path.startsWith('/api/docs'))                return handleDocs(request, env, user, url, path);
      if (path.startsWith('/api/users'))               return handleUsers(request, env, user, url, path);
      if (path === '/api/ai/chat')                     return handleAI(request, env);

      return err('Endpoint nie istnieje', 404);
    } catch (e) {
      console.error('[Worker error]', e.stack || e.message);
      return json({ error: 'Błąd serwera: ' + e.message }, 500);
    }
  },

  // Cron trigger (wrangler.toml: crons = ["0 3 * * *"])
  async scheduled(event, env, ctx) {
    ctx.waitUntil(cleanSessions(env));
  },
};
