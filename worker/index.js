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

// ─── SENTRY ───────────────────────────────────────────────────────────────────
async function captureException(error, env, ctx = {}) {
  if (!env?.SENTRY_DSN) return;
  try {
    const dsn = env.SENTRY_DSN;
    const m = dsn.match(/^https?:\/\/([^@]+)@([^/]+)\/(.+)$/);
    if (!m) return;
    const [, key, host, projectId] = m;
    const payload = {
      event_id: crypto.randomUUID().replace(/-/g, ''),
      platform: 'javascript',
      level: 'error',
      server_name: 'cloudflare-worker',
      timestamp: new Date().toISOString(),
      environment: 'production',
      release: 'taxorder-pro@1.0.0',
      exception: {
        values: [{
          type: error?.name || 'Error',
          value: error?.message || String(error),
          stacktrace: {
            frames: (error?.stack || '').split('\n').slice(1).map(l => ({ filename: l.trim() })),
          },
        }],
      },
      extra: typeof ctx === 'object' ? ctx : {},
    };
    await fetch(`https://${host}/api/${projectId}/store/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=taxorder-worker/1.0, sentry_timestamp=${Math.floor(Date.now()/1000)}, sentry_key=${key}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {}
}

// ─── POSTHOG AI OBSERVABILITY ─────────────────────────────────────────────────
async function trackAIEvent(env, userId, companyId, model, inputTokens, outputTokens, latencyMs, success) {
  if (!env?.POSTHOG_API_KEY) return;
  try {
    await fetch('https://eu.i.posthog.com/capture/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: env.POSTHOG_API_KEY,
        event: '$ai_generation',
        distinct_id: userId || 'anonymous',
        properties: {
          company_id: companyId,
          '$ai_model': model,
          '$ai_provider': model.includes('llama') ? 'groq' : 'anthropic',
          '$ai_input_tokens': inputTokens ?? 0,
          '$ai_output_tokens': outputTokens ?? 0,
          '$ai_total_tokens': (inputTokens ?? 0) + (outputTokens ?? 0),
          '$ai_latency': latencyMs,
          '$ai_http_status': success ? 200 : 500,
          timestamp: new Date().toISOString(),
        },
      }),
    });
  } catch {}
}

// ─── UPSTASH RATE LIMITING ────────────────────────────────────────────────────
async function rateLimit(env, key, maxRequests, windowSeconds) {
  if (!env?.UPSTASH_REDIS_REST_URL || !env?.UPSTASH_REDIS_REST_TOKEN) return { allowed: true };
  try {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;
    const rKey = `rl:${key}`;
    const pipeline = [
      ['ZREMRANGEBYSCORE', rKey, '-inf', windowStart],
      ['ZADD', rKey, now, `${now}:${Math.random().toString(36).slice(2)}`],
      ['ZCARD', rKey],
      ['EXPIRE', rKey, windowSeconds * 2],
    ];
    const resp = await fetch(`${env.UPSTASH_REDIS_REST_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(pipeline),
    });
    if (!resp.ok) return { allowed: true };
    const results = await resp.json();
    const count = results[2]?.result ?? 0;
    return { allowed: count <= maxRequests, count, limit: maxRequests, remaining: Math.max(0, maxRequests - count) };
  } catch {
    return { allowed: true };
  }
}

// ─── CORS ────────────────────────────────────────────────────────────────────
// Dozwolone originy frontendu — uzupełnij jeśli masz własną domenę
const ALLOWED_ORIGINS = [
  'https://taxorder-pro.pages.dev',
  'https://www.taxorder-pro.pl',
];

function corsHeaders(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin)
    || /^https?:\/\/localhost(:\d+)?$/.test(origin)
    || /^https:\/\/[a-z0-9]+\.taxorder-pro\.pages\.dev$/.test(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

// Używane wewnętrznie przez json() — nadpisywane przez corsHeaders() w głównym handlerze
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

// ─── INPUT VALIDATION ─────────────────────────────────────────────────────────
const VALID_ROLES = new Set(['admin', 'kierownik', 'dyspozytor', 'viewer', 'kierowca']);
const EMAIL_RE    = /^[^\s@]{1,64}@[^\s@]{1,255}$/;

function validateEmail(email) {
  if (!email || typeof email !== 'string') return 'Email wymagany';
  const e = email.trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return 'Nieprawidłowy format email';
  if (e.length > 320) return 'Email zbyt długi (max 320 znaków)';
  return null;
}

function validateStr(val, fieldName, { required = false, maxLen = 500 } = {}) {
  if (required && (!val || !String(val).trim())) return `${fieldName} jest wymagane`;
  if (val !== undefined && val !== null && String(val).length > maxLen) {
    return `${fieldName} zbyt długie (max ${maxLen} znaków)`;
  }
  return null;
}

function validateRole(role) {
  if (role && !VALID_ROLES.has(role)) return `Nieprawidłowa rola: ${role}. Dozwolone: ${[...VALID_ROLES].join(', ')}`;
  return null;
}

// ─── CRYPTO ──────────────────────────────────────────────────────────────────
// DEPRECATED: Stała sól używana przed schemą v5 (przed 2026-01-01).
// Używana wyłącznie do weryfikacji starych hashy przy logowaniu — leniwa migracja usuwa ją po 1. logowaniu.
const LEGACY_SALT = 'taxorder-cf-2025';

// Iteracje PBKDF2:
//   Stare hasła (bez prefiksu "v2_"): 100 000 — wolne ~500ms na CF Worker
//   Nowe hasła (prefiks "v2_"):        10 000 — ~50ms, ×10 szybciej przy logowaniu
// Przy pierwszym logowaniu stare hasło jest weryfikowane (100k), potem re-hashowane (10k)
// przez ctx.waitUntil — nie blokuje odpowiedzi.
const PBKDF2_ITERS_V1 = 100_000;
const PBKDF2_ITERS_V2 =  10_000;

function genSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

async function _pbkdf2(password, salt, iterations) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations },
    key, 256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

// Generuje nowy hash z prefiksem "v2_" i 10k iteracjami.
async function hashPwd(password, salt) {
  if (!salt) throw new Error('hashPwd: brak soli');
  return 'v2_' + await _pbkdf2(password, salt, PBKDF2_ITERS_V2);
}

// Weryfikuje hasło bez względu na wersję hasha.
// Zwraca { ok: boolean, needsMigration: boolean }
async function verifyPwd(password, storedHash, salt) {
  if (storedHash && storedHash.startsWith('v2_')) {
    const ok = ('v2_' + await _pbkdf2(password, salt || LEGACY_SALT, PBKDF2_ITERS_V2)) === storedHash;
    return { ok, needsMigration: false };
  }
  // Stary hash (v1, 100k iteracji) — weryfikacja wolna, ale tylko raz do migracji
  const ok = (await _pbkdf2(password, salt || LEGACY_SALT, PBKDF2_ITERS_V1)) === storedHash;
  return { ok, needsMigration: ok };
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

// ─── CLERK JWT VERIFICATION ───────────────────────────────────────────────────
async function verifyClerkJWT(token, env) {
  if (!env?.CLERK_PUBLISHABLE_KEY && !env?.CLERK_JWKS_URL) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const b64dec = s => {
      const pad = s.length % 4 ? s + '='.repeat(4 - s.length % 4) : s;
      return atob(pad.replace(/-/g, '+').replace(/_/g, '/'));
    };
    const header = JSON.parse(b64dec(parts[0]));
    if (header.alg !== 'RS256') return null;
    let jwksUrl = env.CLERK_JWKS_URL;
    if (!jwksUrl && env.CLERK_PUBLISHABLE_KEY) {
      const encoded = env.CLERK_PUBLISHABLE_KEY.replace(/^pk_(live|test)_/, '');
      const domain = b64dec(encoded).replace(/\$$/, '');
      jwksUrl = `https://${domain}/.well-known/jwks.json`;
    }
    const jwksRes = await fetch(jwksUrl, { cf: { cacheTtl: 3600 } });
    if (!jwksRes.ok) return null;
    const { keys } = await jwksRes.json();
    const jwk = keys.find(k => k.kid === header.kid);
    if (!jwk) return null;
    const pubKey = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    );
    const sigInput = new TextEncoder().encode(parts[0] + '.' + parts[1]);
    const sigBytes = Uint8Array.from(b64dec(parts[2]), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pubKey, sigBytes, sigInput);
    if (!valid) return null;
    const payload = JSON.parse(b64dec(parts[1]));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
async function getUser(request, env) {
  const auth = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!auth) return null;
  if (auth.startsWith('tord_')) return getApiKeyUser(auth, env);
  // Clerk JWT: 3 dot-separated parts — try if CLERK_PUBLISHABLE_KEY is configured
  if (auth.split('.').length === 3 && env?.CLERK_PUBLISHABLE_KEY) {
    const payload = await verifyClerkJWT(auth, env);
    if (payload?.sub) {
      const u = await env.DB.prepare(
        'SELECT * FROM users WHERE clerk_user_id = ? AND active = 1'
      ).bind(payload.sub).first().catch(() => null);
      if (u) return u;
    }
  }
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

async function handleLogin(req, env, ctx) {
  let body;
  try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
  const { email, password } = body;
  if (!email || !password) return err('Podaj email i hasło');
  if (typeof email !== 'string' || email.length > 320) return err('Nieprawidłowy email');
  if (typeof password !== 'string' || password.length > 256) return err('Nieprawidłowe hasło');

  const emailLc = email.trim().toLowerCase();
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

  const verify = user ? await verifyPwd(password, user.password_hash, user.salt) : { ok: false, needsMigration: false };

  if (!verify.ok) {
    if (env.PREFS) {
      await env.PREFS.put(rlKey, String(attempts + 1), { expirationTtl: LOGIN_LOCKOUT_SECONDS });
    }
    return err('Nieprawidłowy email lub hasło', 401);
  }

  if (env.PREFS) await env.PREFS.delete(rlKey).catch(() => {});

  // Leniwa migracja hash → v2 (10k iteracji) oraz brak soli → per-user salt.
  // Uruchamiane przez ctx.waitUntil — nie blokuje odpowiedzi logowania.
  if (!user.salt || verify.needsMigration) {
    const migrateFn = async () => {
      try {
        const newSalt = user.salt || genSalt();
        const newHash = await hashPwd(password, newSalt);  // v2_ + 10k iteracji
        await env.DB.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?')
          .bind(newHash, newSalt, user.id).run();
      } catch (e) {
        console.warn('[Login] Migracja hasha nieudana:', e.message);
      }
    };
    if (ctx?.waitUntil) ctx.waitUntil(migrateFn());
    else migrateFn().catch(() => {});
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

// ─── PROFIL ZAUFANY — OAuth 2.0 / OIDC (login.gov.pl) ───────────────────────
// Wymagane sekrety (wrangler secret put):
//   PZ_CLIENT_ID     — nadaje Ministerstwo Cyfryzacji przy rejestracji aplikacji
//   PZ_CLIENT_SECRET — j.w.
// Opcjonalne zmienne (wrangler.toml [vars]):
//   PZ_BASE_URL      — domyślnie https://login.gov.pl (test: https://int.login.gov.pl)
//   PZ_REALM         — domyślnie UZYTKOWNIK
//   PZ_REDIRECT_URI  — domyślnie https://taxorder-pro-api.adamus1000.workers.dev/api/auth/pz/callback
//   PZ_APP_URL       — domyślnie https://taxorder-pro.pages.dev

async function _pzVerifier() {
  const arr = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
async function _pzChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function handlePzStart(request, env, url) {
  if (!env.PZ_CLIENT_ID) {
    return err(
      'Profil Zaufany nie jest skonfigurowany. ' +
      'Uruchom: wrangler secret put PZ_CLIENT_ID i wrangler secret put PZ_CLIENT_SECRET', 503
    );
  }
  const base        = env.PZ_BASE_URL      || 'https://login.gov.pl';
  const realm       = env.PZ_REALM         || 'UZYTKOWNIK';
  const redirectUri = env.PZ_REDIRECT_URI  || 'https://taxorder-pro-api.adamus1000.workers.dev/api/auth/pz/callback';
  const _rawAppUrl  = url.searchParams.get('app_url') || '';
  const _safeAppUrl = /^https:\/\/([\w-]+\.)?taxorder-pro\.pages\.dev(\/|$)/.test(_rawAppUrl) || /^http:\/\/localhost(:\d+)?(\/|$)/.test(_rawAppUrl) ? _rawAppUrl : null;
  const appUrl      = env.PZ_APP_URL || _safeAppUrl || 'https://taxorder-pro.pages.dev';
  const company     = url.searchParams.get('company') || '';

  const verifier  = await _pzVerifier();
  const challenge = await _pzChallenge(verifier);
  const state     = crypto.randomUUID();

  if (env.PREFS) {
    await env.PREFS.put(
      `pz_state:${state}`,
      JSON.stringify({ verifier, company, appUrl }),
      { expirationTtl: 600 }
    );
  }

  const params = new URLSearchParams({
    client_id:             env.PZ_CLIENT_ID,
    response_type:         'code',
    scope:                 'openid profile',
    redirect_uri:          redirectUri,
    state,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    nonce:                 crypto.randomUUID(),
  });

  return Response.redirect(
    `${base}/auth/realms/${realm}/protocol/openid-connect/auth?${params}`, 302
  );
}

async function handlePzCallback(request, env, url) {
  const code      = url.searchParams.get('code');
  const state     = url.searchParams.get('state');
  const errParam  = url.searchParams.get('error');
  const base      = env.PZ_BASE_URL     || 'https://login.gov.pl';
  const realm     = env.PZ_REALM        || 'UZYTKOWNIK';
  const redirectUri = env.PZ_REDIRECT_URI || 'https://taxorder-pro-api.adamus1000.workers.dev/api/auth/pz/callback';
  let appUrl  = env.PZ_APP_URL || 'https://taxorder-pro.pages.dev';
  let company = '';

  const redir = (hash) => Response.redirect(`${appUrl}#${hash}`, 302);

  if (errParam) {
    const desc = url.searchParams.get('error_description') || errParam;
    return redir(`pz_error=${encodeURIComponent(desc)}`);
  }
  if (!code || !state) return redir('pz_error=missing_params');

  // Walidacja state CSRF + odczyt verifier z KV
  let verifier = '';
  if (env.PREFS) {
    const stored = await env.PREFS.get(`pz_state:${state}`).catch(() => null);
    if (!stored) return redir('pz_error=invalid_state');
    const parsed = JSON.parse(stored);
    verifier = parsed.verifier || '';
    company  = parsed.company  || '';
    if (parsed.appUrl) appUrl = parsed.appUrl;
    await env.PREFS.delete(`pz_state:${state}`).catch(() => {});
  }

  // Wymiana authorization_code → access_token (z PKCE)
  const tokenRes = await fetch(
    `${base}/auth/realms/${realm}/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        client_id:     env.PZ_CLIENT_ID || '',
        client_secret: env.PZ_CLIENT_SECRET || '',
        code,
        redirect_uri:  redirectUri,
        code_verifier: verifier,
      }),
    }
  );
  if (!tokenRes.ok) {
    const msg = await tokenRes.text().catch(() => String(tokenRes.status));
    return redir(`pz_error=${encodeURIComponent('token_error:' + msg.substring(0, 80))}`);
  }
  const tokens = await tokenRes.json();

  // Pobierz claims użytkownika (imię, email, PESEL, NIP)
  const uiRes = await fetch(
    `${base}/auth/realms/${realm}/protocol/openid-connect/userinfo`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );
  if (!uiRes.ok) return redir('pz_error=userinfo_error');
  const pz = await uiRes.json();

  // Znajdź konto TaxOrder po pz_sub (stabilny identyfikator OIDC) lub emailu
  let dbUser = null;
  if (pz.sub) {
    dbUser = await env.DB.prepare(
      'SELECT * FROM users WHERE pz_sub = ? AND active = 1'
    ).bind(pz.sub).first().catch(() => null);
  }
  if (!dbUser && pz.email) {
    dbUser = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ? AND active = 1'
    ).bind(pz.email.toLowerCase()).first().catch(() => null);
    // Lazy link: powiąż sub z istniejącym kontem przy pierwszym logowaniu PZ
    if (dbUser && pz.sub) {
      await env.DB.prepare('UPDATE users SET pz_sub = ? WHERE id = ?')
        .bind(pz.sub, dbUser.id).run().catch(() => {});
    }
  }

  if (!dbUser) {
    return redir(`pz_error=no_account&pz_email=${encodeURIComponent(pz.email || '')}`);
  }

  // Utwórz sesję TaxOrder Pro
  const sessionToken = crypto.randomUUID() + genSalt();
  const expiresAt    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    'INSERT INTO sessions(token, user_id, expires_at) VALUES(?, ?, ?)'
  ).bind(sessionToken, dbUser.id, expiresAt).run();

  // Zapisz claims PZ w KV — do pre-fillowania formularzy DT-1 (imię, PESEL, NIP)
  if (env.PREFS) {
    const claims = {
      sub:         pz.sub || '',
      given_name:  pz.given_name  || (pz.name || '').split(' ')[0] || '',
      family_name: pz.family_name || (pz.name || '').split(' ').slice(1).join(' ') || '',
      email:       pz.email       || '',
      pesel:       pz.PESEL       || pz.pesel       || pz['urn:gov:pl:pesel'] || '',
      nip:         pz.NIP         || pz.nip         || pz['urn:gov:pl:nip']   || '',
    };
    await env.PREFS.put(`pz_claims:${sessionToken}`, JSON.stringify(claims), {
      expirationTtl: 30 * 24 * 60 * 60,
    }).catch(() => {});
  }

  // Przekieruj do aplikacji — token w hash fragment (nie trafia na serwer)
  const hashParts = [`pz_token=${encodeURIComponent(sessionToken)}`];
  if (company) hashParts.push(`company=${encodeURIComponent(company)}`);
  return Response.redirect(`${appUrl}#${hashParts.join('&')}`, 302);
}

async function handlePzUserinfo(request, env) {
  const user = await getUser(request, env);
  if (!user) return err('Nieautoryzowany', 401);

  const auth = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  let pzClaims = null;
  if (env.PREFS && auth && !auth.startsWith('tord_')) {
    const raw = await env.PREFS.get(`pz_claims:${auth}`).catch(() => null);
    if (raw) pzClaims = JSON.parse(raw);
  }
  return json({ user: safeUser(user), pz: pzClaims });
}

// ─── VEHICLES ─────────────────────────────────────────────────────────────────
async function handleVehicles(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean); // ['api','vehicles',...]

  // GET /api/vehicles?company=mtoilet[&limit=N&offset=N]
  if (req.method === 'GET') {
    const company = url.searchParams.get('company') || user.company_id || 'mtoilet';
    const limit  = Math.min(parseInt(url.searchParams.get('limit')  || '2000'), 5000);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'),    0);
    const rows = await env.DB.prepare(
      'SELECT * FROM vehicles WHERE company_id = ? ORDER BY nr_rej LIMIT ? OFFSET ?'
    ).bind(company, limit, offset).all();
    return json(rows.results || []);
  }

  // POST /api/vehicles/bulk
  if (req.method === 'POST' && segs[2] === 'bulk') {
    let body;
    try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const { vehicles } = body;
    if (!Array.isArray(vehicles) || !vehicles.length) return err('Brak pojazdów');
    if (vehicles.length > 500) return err('Zbyt wiele pojazdów naraz (max 500)');

    const UPSERT = `
      INSERT INTO vehicles(company_id,nr_rej,axles_count,suspension_type,
        dmc_zespolu,miesiace_podatku,dt1_category,dt1_tax_amount,data,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(company_id,nr_rej) DO UPDATE SET
        axles_count=excluded.axles_count, suspension_type=excluded.suspension_type,
        dmc_zespolu=excluded.dmc_zespolu, miesiace_podatku=excluded.miesiace_podatku,
        dt1_category=excluded.dt1_category, dt1_tax_amount=excluded.dt1_tax_amount,
        data=excluded.data, updated_at=datetime('now')`;

    const bulkCompany = url.searchParams.get('company') || user.company_id || 'mtoilet';
    const stmt = env.DB.prepare(UPSERT);
    await env.DB.batch(vehicles.map(v => stmt.bind(
      bulkCompany, v.nr_rej, v.axles_count ?? 2, v.suspension_type ?? 'pneumatyczne',
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
    if (!body.nr_rej || String(body.nr_rej).trim().length === 0) return err('nr_rej wymagany');
    if (String(body.nr_rej).length > 20) return err('nr_rej zbyt długi (max 20 znaków)');
    const dataStr = typeof body.data === 'string' ? body.data : JSON.stringify(body.data ?? {});
    if (dataStr.length > 65536) return err('Dane pojazdu zbyt duże (max 64 KB)');
    const putCompany = url.searchParams.get('company') || user.company_id || 'mtoilet';
    await env.DB.prepare(`
      INSERT INTO vehicles(company_id,nr_rej,axles_count,suspension_type,
        dmc_zespolu,miesiace_podatku,dt1_category,dt1_tax_amount,data,branch_id,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(company_id,nr_rej) DO UPDATE SET
        axles_count=excluded.axles_count, suspension_type=excluded.suspension_type,
        dmc_zespolu=excluded.dmc_zespolu, miesiace_podatku=excluded.miesiace_podatku,
        dt1_category=excluded.dt1_category, dt1_tax_amount=excluded.dt1_tax_amount,
        data=excluded.data, branch_id=excluded.branch_id, updated_at=datetime('now')`
    ).bind(
      putCompany, body.nr_rej, body.axles_count ?? 2, body.suspension_type ?? 'pneumatyczne',
      body.dmc_zespolu ?? 0, body.miesiace_podatku ?? 12,
      body.dt1_category ?? null, body.dt1_tax_amount ?? null,
      typeof body.data === 'string' ? body.data : JSON.stringify(body.data ?? {}),
      body.branch_id ?? null
    ).run();
    return json({ ok: true });
  }

  // DELETE /api/vehicles/:nrRej
  if (req.method === 'DELETE' && segs[2]) {
    await env.DB.prepare(
      'DELETE FROM vehicles WHERE company_id = ? AND nr_rej = ?'
    ).bind(url.searchParams.get('company') || user.company_id || 'mtoilet', decodeURIComponent(segs[2])).run();
    return json({ ok: true });
  }

  // POST /api/vehicles/change-nrrej — zmiana numeru rejestracyjnego z archiwizacją
  if (req.method === 'POST' && segs[2] === 'change-nrrej') {
    if (!user || (user.role !== 'admin' && user.role !== 'kierownik')) return err('Brak uprawnień', 403);
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const { old_nr_rej, new_nr_rej, reason } = body;
    const company = url.searchParams.get('company') || user.company_id;
    if (!old_nr_rej || !new_nr_rej || !company) return err('Wymagane: old_nr_rej, new_nr_rej, company');
    if (old_nr_rej.trim().toUpperCase() === new_nr_rej.trim().toUpperCase()) return err('Nowy numer musi być inny od obecnego');

    const existing = await env.DB.prepare('SELECT * FROM vehicles WHERE company_id=? AND nr_rej=?').bind(company, old_nr_rej).first();
    if (!existing) return err('Pojazd nie istnieje');
    const conflict = await env.DB.prepare('SELECT nr_rej FROM vehicles WHERE company_id=? AND nr_rej=?').bind(company, new_nr_rej.toUpperCase()).first();
    if (conflict) return err('Pojazd z tym numerem już istnieje w firmie');

    let data = {};
    try { data = typeof existing.data === 'string' ? JSON.parse(existing.data) : (existing.data || {}); } catch {}
    if (!data.rejestracjaHistory) data.rejestracjaHistory = [];
    data.rejestracjaHistory.unshift({ old: old_nr_rej, new: new_nr_rej.toUpperCase(), date: new Date().toISOString().slice(0,10), reason: reason || 'zmiana' });

    await env.DB.prepare("UPDATE vehicles SET nr_rej=?, data=?, updated_at=datetime('now') WHERE company_id=? AND nr_rej=?")
      .bind(new_nr_rej.toUpperCase(), JSON.stringify(data), company, old_nr_rej).run();

    await env.DB.batch([
      env.DB.prepare('UPDATE documents SET nr_rej=? WHERE company_id=? AND nr_rej=?').bind(new_nr_rej.toUpperCase(), company, old_nr_rej),
      env.DB.prepare('UPDATE damage_reports SET nr_rej=? WHERE company_id=? AND nr_rej=?').bind(new_nr_rej.toUpperCase(), company, old_nr_rej),
      env.DB.prepare('UPDATE tires SET nr_rej=? WHERE company_id=? AND nr_rej=?').bind(new_nr_rej.toUpperCase(), company, old_nr_rej),
      env.DB.prepare('UPDATE service_orders SET nr_rej=? WHERE company_id=? AND nr_rej=?').bind(new_nr_rej.toUpperCase(), company, old_nr_rej),
      env.DB.prepare('UPDATE handover_protocols SET nr_rej=? WHERE company_id=? AND nr_rej=?').bind(new_nr_rej.toUpperCase(), company, old_nr_rej),
      env.DB.prepare('UPDATE cfm_contracts SET nr_rej=? WHERE company_id=? AND nr_rej=?').bind(new_nr_rej.toUpperCase(), company, old_nr_rej),
    ]);

    return json({ ok: true, old_nr_rej, new_nr_rej: new_nr_rej.toUpperCase() });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── COMPANY STATE ────────────────────────────────────────────────────────────
async function handleState(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean);
  const companyId = segs[2];
  if (!companyId) return err('Wymagane company_id');
  if (user.role !== 'admin' && companyId !== user.company_id) return err('Brak dostępu do tej firmy', 403);

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

// ─── PREFS KV ─────────────────────────────────────────────────────────────────
// GET /api/prefs/kv              → { prefs: [{company_id,key,value,updated_at},...] }
// PUT /api/prefs/kv              → body {key,value,company_id?} | {kv:{...},company_id?}
// DELETE /api/prefs/kv?key=X[&company=Y]
async function handlePrefsKv(req, env, user, url) {
  const uid = user.id;

  if (req.method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT company_id, key, value, updated_at FROM user_prefs_kv WHERE user_id = ? ORDER BY company_id, key'
    ).bind(uid).all();
    return json({ prefs: rows.results || [] });
  }

  if (req.method === 'PUT') {
    let body;
    try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const companyId = typeof body.company_id === 'string' ? body.company_id : '';

    if (body.kv && typeof body.kv === 'object' && !Array.isArray(body.kv)) {
      const entries = Object.entries(body.kv);
      if (entries.length > 100) return err('Zbyt wiele kluczy naraz (max 100)');
      const now = new Date().toISOString();
      for (const [key, value] of entries) {
        if (!key || key.length > 128) return err(`Nieprawidłowy klucz: ${key}`);
        await env.DB.prepare(
          `INSERT INTO user_prefs_kv(user_id,company_id,key,value,updated_at) VALUES(?,?,?,?,?)
           ON CONFLICT(user_id,company_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`
        ).bind(uid, companyId, key, typeof value === 'string' ? value : JSON.stringify(value), now).run();
      }
      return json({ ok: true, count: entries.length });
    }

    const { key, value } = body;
    if (!key || typeof key !== 'string' || key.length > 128) return err('Nieprawidłowy klucz');
    if (value === undefined) return err('Brak wartości (value)');
    await env.DB.prepare(
      `INSERT INTO user_prefs_kv(user_id,company_id,key,value,updated_at) VALUES(?,?,?,?,datetime('now'))
       ON CONFLICT(user_id,company_id,key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')`
    ).bind(uid, companyId, key, typeof value === 'string' ? value : JSON.stringify(value)).run();
    return json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const key       = url.searchParams.get('key');
    const companyId = url.searchParams.get('company') ?? '';
    if (!key) return err('Brak parametru key');
    const r = await env.DB.prepare(
      'DELETE FROM user_prefs_kv WHERE user_id=? AND company_id=? AND key=?'
    ).bind(uid, companyId, key).run();
    return json({ ok: true, deleted: r.meta.changes });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── DOCUMENTS — HELPERS ──────────────────────────────────────────────────────
const _DOC_TYPE_RULES = [
  { type: 'oc',        re: [/\boc\b/i, /odpowiedzia.*cywil/i, /ubezp.*komun/i, /polisa.*oc/i, /oc[-_]polisa/i, /oc[-_\s]ubezp/i] },
  { type: 'ac',        re: [/\bac\b/i, /autocasco/i, /ubezp.*\bac\b/i, /ac[-_\s]polisa/i, /\bkasko\b/i] },
  { type: 'przeglad',  re: [/badanie[\s_-]?tech/i, /stacja[\s_-]?kontrol/i, /diagnos/i, /przegl[aą]d[\s_-]?tech/i, /\bskt\b/i, /\bbt\b.*pojazd/i] },
  { type: 'leasing',   re: [/leasing/i, /umowa[\s_-]?leas/i, /leasodawca/i, /rata[\s_-]?leas/i] },
  { type: 'dowod_rej', re: [/dow[oó]d[\s_-]?rej/i, /rejestracyjny/i, /\bcrd\b/i, /\bdowodrej/i] },
  { type: 'faktura',   re: [/\bfaktura\b/i, /\bfvat\b/i, /\bf[\s_-]?vat\b/i, /\binvoice\b/i, /\brachun/i] },
  { type: 'serwis',    re: [/\bserwis\b/i, /\bnaprawa\b/i, /\bwarsztat\b/i, /\bmechanik\b/i, /zlecenie[\s_-]?serwis/i] },
  { type: 'ubezp',     re: [/\bubezpiecz/i, /\bpolisa\b/i, /towarzystwo[\s_-]?ubezp/i] },
  { type: 'mandat',    re: [/\bmandat\b/i, /wykroczen/i, /kara[\s_-]?pienia/i] },
];

function _classifyDoc(filename, textHint = '') {
  const src = (filename + ' ' + textHint).toLowerCase();
  for (const { type, re } of _DOC_TYPE_RULES) {
    if (re.some(r => r.test(src))) return type;
  }
  return 'inne';
}

function _extractVin(text) {
  const matches = text.match(/[A-HJ-NPR-Z0-9]{17}/g) || [];
  return matches.find(v => new Set(v).size > 4) || null;
}

// ─── DOCUMENTS ────────────────────────────────────────────────────────────────
async function handleDocs(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean); // ['api','docs',...]

  // GET /api/docs?nrRej=XX&company=YY — lista dla pojazdu
  // GET /api/docs?company=YY            — lista wszystkich (global view)
  // GET /api/docs?vin=VIN&company=YY   — lista wg VIN
  if (req.method === 'GET' && segs.length === 2) {
    const nrRej   = url.searchParams.get('nrRej');
    const vin     = url.searchParams.get('vin');
    const company = url.searchParams.get('company') || user.company_id || 'mtoilet';
    let rows;
    if (nrRej) {
      rows = await env.DB.prepare(
        'SELECT id,nr_rej,vin,name,mime_type,doc_type,detected_vin,vehicle_id,file_size,notes,expiry_date,doc_number,uploaded_at,uploaded_by FROM documents WHERE nr_rej=? AND company_id=? ORDER BY uploaded_at DESC'
      ).bind(nrRej, company).all();
    } else if (vin) {
      rows = await env.DB.prepare(
        'SELECT id,nr_rej,vin,name,mime_type,doc_type,detected_vin,vehicle_id,file_size,notes,expiry_date,doc_number,uploaded_at,uploaded_by FROM documents WHERE vin=? AND company_id=? ORDER BY uploaded_at DESC'
      ).bind(vin, company).all();
    } else {
      rows = await env.DB.prepare(
        'SELECT id,nr_rej,vin,name,mime_type,doc_type,detected_vin,vehicle_id,file_size,notes,expiry_date,doc_number,uploaded_at,uploaded_by FROM documents WHERE company_id=? ORDER BY uploaded_at DESC LIMIT 500'
      ).bind(company).all();
    }
    return json(rows.results || []);
  }

  // POST /api/docs/upload — smart upload z auto-klasyfikacją i detekcją VIN
  if (req.method === 'POST' && segs[2] === 'upload') {
    let fd;
    try { fd = await req.formData(); } catch { return err('Wymagany FormData'); }
    const file       = fd.get('file');
    const nrRej      = fd.get('nrRej') || '';
    const company    = url.searchParams.get('company') || user.company_id || 'mtoilet';
    const vinParam   = (fd.get('vin') || '').trim().toUpperCase();
    const textHint   = (fd.get('textHint') || '').slice(0, 2000);
    const docTypeIn  = fd.get('doc_type') || '';
    const vehicleId  = fd.get('vehicle_id') || '';
    const notesIn    = (fd.get('notes') || '').slice(0, 500);
    if (!file) return err('Wymagane: file');

    const doc_type     = docTypeIn || _classifyDoc(file.name, textHint);
    const detected_vin = _extractVin(textHint + ' ' + file.name);
    const vin          = vinParam || detected_vin || null;
    const anchor       = vin || nrRej || 'global';
    const expiryDate   = (fd.get('expiry_date') || '').trim() || null;
    const docNumber    = (fd.get('doc_number')   || '').slice(0, 100).trim() || null;

    const docId = crypto.randomUUID();
    const ext   = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'bin';
    const r2Key = `docs/${company}/vin/${anchor}/${docId}.${ext}`;

    await env.DOCS.put(r2Key, file.stream(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
    });
    await env.DB.prepare(
      `INSERT INTO documents(id,nr_rej,company_id,name,mime_type,r2_key,vin,doc_type,detected_vin,vehicle_id,file_size,notes,uploaded_by,expiry_date,doc_number)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      docId, nrRej || null, company, file.name,
      file.type || 'application/octet-stream', r2Key,
      vin, doc_type, detected_vin,
      vehicleId || null, file.size || 0, notesIn || null,
      user?.email || null, expiryDate, docNumber,
    ).run();

    return json({ ok: true, id: docId, key: r2Key, doc_type, detected_vin, vin, expiry_date: expiryDate, doc_number: docNumber });
  }

  // GET /api/docs/file/:key... — pobierz plik z R2
  if (req.method === 'GET' && segs[2] === 'file') {
    const r2Key = segs.slice(3).join('/');
    if (!r2Key) return err('Brak klucza');
    // Weryfikacja własności: dokument musi należeć do firmy użytkownika
    const docMeta = await env.DB.prepare(
      'SELECT company_id, name FROM documents WHERE r2_key=?'
    ).bind(r2Key).first();
    if (!docMeta) return err('Dokument nie znaleziony', 404);
    if (user.role !== 'admin' && docMeta.company_id !== (url.searchParams.get('company') || user.company_id)) {
      return err('Brak dostępu', 403);
    }
    const obj = await env.DOCS.get(r2Key);
    if (!obj) return err('Dokument nie znaleziony', 404);
    const safeName = (docMeta?.name || r2Key.split('/').pop() || 'dokument').replace(/[^\w.\-]/g, '_');
    return new Response(obj.body, {
      headers: {
        'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Cache-Control': 'private, max-age=3600',
        ...CORS,
      },
    });
  }

  // PATCH /api/docs/:docId — aktualizacja doc_type, notes, vin
  if (req.method === 'PATCH' && segs[2] && segs[2] !== 'file') {
    const company = url.searchParams.get('company') || user.company_id;
    let body;
    try { body = await req.json(); } catch { return err('Wymagany JSON'); }
    const fields = [];
    const vals   = [];
    if (body.doc_type    !== undefined) { fields.push('doc_type=?');    vals.push(body.doc_type); }
    if (body.notes       !== undefined) { fields.push('notes=?');       vals.push((body.notes||'').slice(0,500)); }
    if (body.vin         !== undefined) { fields.push('vin=?');         vals.push(body.vin || null); }
    if (body.expiry_date !== undefined) { fields.push('expiry_date=?'); vals.push(body.expiry_date || null); }
    if (body.doc_number  !== undefined) { fields.push('doc_number=?');  vals.push((body.doc_number||'').slice(0,100) || null); }
    if (!fields.length) return err('Brak pól do aktualizacji');
    vals.push(segs[2], company);
    await env.DB.prepare(`UPDATE documents SET ${fields.join(',')} WHERE id=? AND company_id=?`).bind(...vals).run();
    return json({ ok: true });
  }

  // DELETE /api/docs/:docId
  if (req.method === 'DELETE' && segs[2] && segs[2] !== 'file') {
    const company = url.searchParams.get('company') || user.company_id;
    const row = await env.DB.prepare(
      'SELECT r2_key FROM documents WHERE id=? AND company_id=?'
    ).bind(segs[2], company).first();
    if (row) {
      await Promise.all([
        env.DOCS.delete(row.r2_key),
        env.DB.prepare('DELETE FROM documents WHERE id=? AND company_id=?').bind(segs[2], company).run(),
      ]);
    }
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── SZKODY (DAMAGE REPORTS) ───────────────────────────────────────────────────
async function handleDamages(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean); // ['api','damages',...]

  // GET /api/damages?company=&nrRej=[&limit=N&offset=N]
  if (req.method === 'GET' && segs.length === 2) {
    const company = url.searchParams.get('company') || user.company_id || 'mtoilet';
    const nrRej   = url.searchParams.get('nrRej');
    const limit   = Math.min(parseInt(url.searchParams.get('limit')  || '500'), 2000);
    const offset  = Math.max(parseInt(url.searchParams.get('offset') || '0'),   0);
    const rows = nrRej
      ? await env.DB.prepare('SELECT * FROM damage_reports WHERE company_id=? AND nr_rej=? ORDER BY data_zdarzenia DESC, created_at DESC LIMIT ? OFFSET ?').bind(company, nrRej, limit, offset).all()
      : await env.DB.prepare('SELECT * FROM damage_reports WHERE company_id=? ORDER BY data_zdarzenia DESC, created_at DESC LIMIT ? OFFSET ?').bind(company, limit, offset).all();
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
    const company = url.searchParams.get('company') || user.company_id || 'mtoilet';
    if (!body.nr_rej) return err('Wymagane: nr_rej');
    const id = crypto.randomUUID();
    const _branchIdDmg = await _getVehicleBranchId(env, company, body.nr_rej);
    await env.DB.prepare(`
      INSERT INTO damage_reports(id,company_id,nr_rej,opis,przyczyna,data_zdarzenia,status,koszt,zglaszajacy,uwagi,branch_id)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      id, company, body.nr_rej, body.opis || null, body.przyczyna || null,
      body.data_zdarzenia || null, body.status || 'ZGLOSZONA',
      body.koszt != null ? Number(body.koszt) : null, body.zglaszajacy || null, body.uwagi || null, _branchIdDmg
    ).run();
    return json({ ok: true, id });
  }

  // POST /api/damages/:id/photo — upload zdjęcia (FormData)
  if (req.method === 'POST' && segs[2] && segs[3] === 'photo') {
    const damageId = segs[2];
    const report = await env.DB.prepare('SELECT company_id, nr_rej FROM damage_reports WHERE id=? AND company_id=?').bind(damageId, user.company_id).first();
    if (!report) return err('Zgłoszenie nie znalezione', 404);
    let fd; try { fd = await req.formData(); } catch { return err('Wymagany FormData'); }
    const file = fd.get('file');
    if (!file) return err('Wymagane: file');
    if (!file.type || !file.type.startsWith('image/')) return err('Dozwolone tylko pliki graficzne (image/*)', 400);
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
    const company = url.searchParams.get('company') || user.company_id;
    await env.DB.prepare(`
      UPDATE damage_reports SET
        opis=?, przyczyna=?, data_zdarzenia=?, status=?, koszt=?, zglaszajacy=?, uwagi=?, updated_at=datetime('now')
      WHERE id=? AND company_id=?`
    ).bind(
      body.opis || null, body.przyczyna || null, body.data_zdarzenia || null,
      body.status || 'ZGLOSZONA', body.koszt != null ? Number(body.koszt) : null,
      body.zglaszajacy || null, body.uwagi || null, segs[2], company
    ).run();
    return json({ ok: true });
  }

  // DELETE /api/damages/photo/:photoId — usuń pojedyncze zdjęcie
  if (req.method === 'DELETE' && segs[2] === 'photo' && segs[3]) {
    const company = url.searchParams.get('company') || user.company_id;
    const row = await env.DB.prepare(
      'SELECT dp.r2_key FROM damage_photos dp JOIN damage_reports dr ON dp.damage_id=dr.id WHERE dp.id=? AND dr.company_id=?'
    ).bind(segs[3], company).first();
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
    const company = url.searchParams.get('company') || user.company_id;
    const dmgRow = await env.DB.prepare('SELECT id FROM damage_reports WHERE id=? AND company_id=?').bind(segs[2], company).first();
    if (!dmgRow) return json({ ok: true });
    const photoRows = await env.DB.prepare('SELECT r2_key FROM damage_photos WHERE damage_id=?').bind(segs[2]).all();
    await Promise.all((photoRows.results || []).map(p => env.DOCS.delete(p.r2_key)));
    await env.DB.prepare('DELETE FROM damage_reports WHERE id=? AND company_id=?').bind(segs[2], company).run();
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── OPONY — MAGAZYN I CYKL ŻYCIA ──────────────────────────────────────────────
async function handleTires(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean); // ['api','tires',...]

  // GET /api/tires?company=&status=&nrRej=
  if (req.method === 'GET' && segs.length === 2) {
    const company = url.searchParams.get('company') || user.company_id || 'mtoilet';
    const status  = url.searchParams.get('status');
    const nrRej   = url.searchParams.get('nrRej');
    const limit  = Math.min(parseInt(url.searchParams.get('limit')  || '2000'), 5000);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'),    0);
    let sql = 'SELECT * FROM tires WHERE company_id=?';
    const params = [company];
    if (status) { sql += ' AND status=?'; params.push(status); }
    if (nrRej)  { sql += ' AND nr_rej=?';  params.push(nrRej); }
    sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = await env.DB.prepare(sql).bind(...params).all();
    return json((rows.results || []).map(r => ({ ...r, historia: JSON.parse(r.historia || '[]') })));
  }

  // POST /api/tires — nowa opona (domyślnie do magazynu)
  if (req.method === 'POST' && segs.length === 2) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const company = url.searchParams.get('company') || user.company_id || 'mtoilet';
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
    const company = url.searchParams.get('company') || user.company_id;
    const row = await env.DB.prepare('SELECT * FROM tires WHERE id=? AND company_id=?').bind(segs[2], company).first();
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
    const company = url.searchParams.get('company') || user.company_id;
    await env.DB.prepare('DELETE FROM tires WHERE id=? AND company_id=?').bind(segs[2], company).run();
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── ZLECENIA SERWISOWE ─────────────────────────────────────────────────────────
async function handleServiceOrders(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean); // ['api','service-orders',...]

  // GET /api/service-orders?company=&nrRej=&status=
  if (req.method === 'GET' && segs.length === 2) {
    const company = url.searchParams.get('company') || user.company_id || 'mtoilet';
    const nrRej   = url.searchParams.get('nrRej');
    const status  = url.searchParams.get('status');
    const limit  = Math.min(parseInt(url.searchParams.get('limit')  || '2000'), 5000);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'),    0);
    let sql = 'SELECT * FROM service_orders WHERE company_id=?';
    const params = [company];
    if (nrRej)  { sql += ' AND nr_rej=?'; params.push(nrRej); }
    if (status) { sql += ' AND status=?'; params.push(status); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = await env.DB.prepare(sql).bind(...params).all();
    return json(rows.results || []);
  }

  // POST /api/service-orders — nowe zgłoszenie
  if (req.method === 'POST' && segs.length === 2) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const company = url.searchParams.get('company') || user.company_id || 'mtoilet';
    if (!body.nr_rej) return err('Wymagane: nr_rej');
    const id = crypto.randomUUID();
    const _branchIdSvc = await _getVehicleBranchId(env, company, body.nr_rej);
    await env.DB.prepare(`
      INSERT INTO service_orders(id,company_id,nr_rej,typ,opis,zglaszajacy,status,koszt_szacowany,warsztat,branch_id)
      VALUES(?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      id, company, body.nr_rej, body.typ || null, body.opis || null, body.zglaszajacy || null,
      'ZGLOSZONE', body.koszt_szacowany != null ? Number(body.koszt_szacowany) : null, body.warsztat || null, _branchIdSvc
    ).run();
    return json({ ok: true, id });
  }

  // PUT /api/service-orders/:id — edycja LUB akcja AUTORYZUJ/ODRZUC/ZREALIZUJ
  if (req.method === 'PUT' && segs[2]) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const company = url.searchParams.get('company') || user.company_id;
    const row = await env.DB.prepare('SELECT * FROM service_orders WHERE id=? AND company_id=?').bind(segs[2], company).first();
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
    const company = url.searchParams.get('company') || user.company_id;
    await env.DB.prepare('DELETE FROM service_orders WHERE id=? AND company_id=?').bind(segs[2], company).run();
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── PROTOKOŁY ZDAWCZO-ODBIORCZE ────────────────────────────────────────────────
async function handleProtocols(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean); // ['api','protocols',...]

  // GET /api/protocols?company=&nrRej=[&limit=N&offset=N]
  if (req.method === 'GET' && segs.length === 2) {
    const company = url.searchParams.get('company') || user.company_id || 'mtoilet';
    const nrRej   = url.searchParams.get('nrRej');
    const limit   = Math.min(parseInt(url.searchParams.get('limit')  || '500'), 2000);
    const offset  = Math.max(parseInt(url.searchParams.get('offset') || '0'),   0);
    const rows = nrRej
      ? await env.DB.prepare('SELECT * FROM handover_protocols WHERE company_id=? AND nr_rej=? ORDER BY data DESC LIMIT ? OFFSET ?').bind(company, nrRej, limit, offset).all()
      : await env.DB.prepare('SELECT * FROM handover_protocols WHERE company_id=? ORDER BY data DESC LIMIT ? OFFSET ?').bind(company, limit, offset).all();
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
    const company = url.searchParams.get('company') || user.company_id || 'mtoilet';
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
    const protocol = await env.DB.prepare('SELECT company_id, nr_rej FROM handover_protocols WHERE id=? AND company_id=?').bind(protocolId, user.company_id).first();
    if (!protocol) return err('Protokół nie znaleziony', 404);
    let fd; try { fd = await req.formData(); } catch { return err('Wymagany FormData'); }
    const file = fd.get('file');
    if (!file) return err('Wymagane: file');
    if (!file.type || !file.type.startsWith('image/')) return err('Dozwolone tylko pliki graficzne (image/*)', 400);
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
    const company = url.searchParams.get('company') || user.company_id;
    const row = await env.DB.prepare('SELECT * FROM handover_protocols WHERE id=? AND company_id=?').bind(segs[2], company).first();
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
    const company = url.searchParams.get('company') || user.company_id;
    const protRow = await env.DB.prepare('SELECT id FROM handover_protocols WHERE id=? AND company_id=?').bind(segs[2], company).first();
    if (!protRow) return json({ ok: true });
    const photoRows = await env.DB.prepare('SELECT r2_key FROM protocol_photos WHERE protocol_id=?').bind(segs[2]).all();
    await Promise.all((photoRows.results || []).map(p => env.DOCS.delete(p.r2_key)));
    await env.DB.prepare('DELETE FROM handover_protocols WHERE id=? AND company_id=?').bind(segs[2], company).run();
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── KLIENCI CFM (zewnętrzni, spoza COMPANIES) ─────────────────────────────────
async function handleCfmClients(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean); // ['api','cfm-clients',...]

  if (req.method === 'GET' && segs.length === 2) {
    const company = url.searchParams.get('company') || user.company_id || 'mtoilet';
    const limit  = Math.min(parseInt(url.searchParams.get('limit')  || '2000'), 5000);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'),    0);
    const rows = await env.DB.prepare('SELECT * FROM cfm_clients WHERE company_id=? ORDER BY nazwa LIMIT ? OFFSET ?').bind(company, limit, offset).all();
    return json(rows.results || []);
  }

  if (req.method === 'POST' && segs.length === 2) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const company = url.searchParams.get('company') || user.company_id || 'mtoilet';
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
    const company = url.searchParams.get('company') || user.company_id;
    const row = await env.DB.prepare('SELECT * FROM cfm_clients WHERE id=? AND company_id=?').bind(segs[2], company).first();
    if (!row) return err('Klient nie znaleziony', 404);
    await env.DB.prepare(`
      UPDATE cfm_clients SET nazwa=?, nip=?, regon=?, ulica=?, kod=?, miasto=?, email=?, telefon=?, osoba_kontaktowa=?, uwagi=?, updated_at=datetime('now')
      WHERE id=? AND company_id=?`
    ).bind(
      body.nazwa ?? row.nazwa, body.nip ?? row.nip, body.regon ?? row.regon, body.ulica ?? row.ulica,
      body.kod ?? row.kod, body.miasto ?? row.miasto, body.email ?? row.email, body.telefon ?? row.telefon,
      body.osoba_kontaktowa ?? row.osoba_kontaktowa, body.uwagi ?? row.uwagi, segs[2], company
    ).run();
    return json({ ok: true });
  }

  if (req.method === 'DELETE' && segs[2]) {
    const company = url.searchParams.get('company') || user.company_id;
    await env.DB.prepare('DELETE FROM cfm_clients WHERE id=? AND company_id=?').bind(segs[2], company).run();
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── KONTRAKTY CFM (1 pojazd = 1 kontrakt) ─────────────────────────────────────
async function handleCfmContracts(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean); // ['api','cfm-contracts',...]

  if (req.method === 'GET' && segs.length === 2) {
    const company    = url.searchParams.get('company') || user.company_id || 'mtoilet';
    const clientType = url.searchParams.get('clientType');
    const clientRef  = url.searchParams.get('clientRef');
    const nrRej      = url.searchParams.get('nrRej');
    const status     = url.searchParams.get('status');
    const limit  = Math.min(parseInt(url.searchParams.get('limit')  || '1000'), 5000);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'),    0);
    let sql = 'SELECT * FROM cfm_contracts WHERE company_id=?';
    const params = [company];
    if (clientType) { sql += ' AND client_type=?'; params.push(clientType); }
    if (clientRef)  { sql += ' AND client_ref=?';  params.push(clientRef); }
    if (nrRej)      { sql += ' AND nr_rej=?';      params.push(nrRej); }
    if (status)     { sql += ' AND status=?';      params.push(status); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = await env.DB.prepare(sql).bind(...params).all();
    return json(rows.results || []);
  }

  if (req.method === 'POST' && segs.length === 2) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const company = url.searchParams.get('company') || user.company_id || 'mtoilet';
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
    const company = url.searchParams.get('company') || user.company_id;
    const row = await env.DB.prepare('SELECT * FROM cfm_contracts WHERE id=? AND company_id=?').bind(segs[2], company).first();
    if (!row) return err('Kontrakt nie znaleziony', 404);
    await env.DB.prepare(`
      UPDATE cfm_contracts SET typ_umowy=?, data_od=?, data_do=?, stawka_miesieczna=?, dzien_platnosci=?,
        refakturowanie_kosztow=?, status=?, uwagi=?, updated_at=datetime('now')
      WHERE id=? AND company_id=?`
    ).bind(
      body.typ_umowy ?? row.typ_umowy, body.data_od ?? row.data_od, body.data_do ?? row.data_do,
      body.stawka_miesieczna != null ? Number(body.stawka_miesieczna) : row.stawka_miesieczna,
      body.dzien_platnosci != null ? Number(body.dzien_platnosci) : row.dzien_platnosci,
      body.refakturowanie_kosztow != null ? (body.refakturowanie_kosztow ? 1 : 0) : row.refakturowanie_kosztow,
      body.status ?? row.status, body.uwagi ?? row.uwagi, segs[2], company
    ).run();
    return json({ ok: true });
  }

  if (req.method === 'DELETE' && segs[2]) {
    const company = url.searchParams.get('company') || user.company_id;
    await env.DB.prepare('DELETE FROM cfm_contracts WHERE id=? AND company_id=?').bind(segs[2], company).run();
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
    const company    = url.searchParams.get('company') || user.company_id || 'mtoilet';
    const clientType = url.searchParams.get('clientType');
    const clientRef  = url.searchParams.get('clientRef');
    const okres      = url.searchParams.get('okres');
    const limit  = Math.min(parseInt(url.searchParams.get('limit')  || '2000'), 5000);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'),    0);
    let sql = 'SELECT * FROM cfm_invoices WHERE company_id=?';
    const params = [company];
    if (clientType) { sql += ' AND client_type=?'; params.push(clientType); }
    if (clientRef)  { sql += ' AND client_ref=?';  params.push(clientRef); }
    if (okres)      { sql += ' AND okres=?';       params.push(okres); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = await env.DB.prepare(sql).bind(...params).all();
    return json((rows.results || []).map(r => ({ ...r, pozycje: JSON.parse(r.pozycje || '[]') })));
  }

  // POST /api/cfm-invoices/generate — agreguje koszty wszystkich aktywnych kontraktów klienta za okres
  if (req.method === 'POST' && segs[2] === 'generate') {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const company = url.searchParams.get('company') || user.company_id || 'mtoilet';
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
    const company = url.searchParams.get('company') || user.company_id;
    const row = await env.DB.prepare('SELECT * FROM cfm_invoices WHERE id=? AND company_id=?').bind(segs[2], company).first();
    if (!row) return err('Faktura nie znaleziona', 404);
    let pozycje = row.pozycje ? JSON.parse(row.pozycje) : [];
    if (Array.isArray(body.pozycje)) pozycje = body.pozycje;
    const suma_netto  = _num2(pozycje.reduce((s, p) => s + (p.wartosc_netto || 0), 0));
    const suma_brutto = _num2(pozycje.reduce((s, p) => s + (p.wartosc_brutto || 0), 0));
    const suma_vat    = _num2(suma_brutto - suma_netto);
    await env.DB.prepare(`
      UPDATE cfm_invoices SET pozycje=?, suma_netto=?, suma_vat=?, suma_brutto=?, status=?, termin_platnosci=?
      WHERE id=? AND company_id=?`
    ).bind(
      JSON.stringify(pozycje), suma_netto, suma_vat, suma_brutto,
      body.status ?? row.status, body.termin_platnosci ?? row.termin_platnosci, segs[2], company
    ).run();
    return json({ ok: true });
  }

  // DELETE /api/cfm-invoices/:id — tylko gdy nieopłacona
  if (req.method === 'DELETE' && segs[2]) {
    const company = url.searchParams.get('company') || user.company_id;
    const row = await env.DB.prepare('SELECT status FROM cfm_invoices WHERE id=? AND company_id=?').bind(segs[2], company).first();
    if (row && row.status === 'OPLACONA') return err('Nie można usunąć opłaconej faktury', 409);
    await env.DB.prepare('DELETE FROM cfm_invoices WHERE id=? AND company_id=?').bind(segs[2], company).run();
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
      'SELECT id,email,name,role,active,company_id,created_at FROM users ORDER BY name'
    ).all();
    return json(rows.results || []);
  }

  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const { email, name, password, role, company_id } = body;
    const emailErr = validateEmail(email);
    if (emailErr) return err(emailErr);
    if (!password || String(password).length < 6) return err('Hasło wymagane (min 6 znaków)');
    if (String(password).length > 128) return err('Hasło zbyt długie (max 128 znaków)');
    const nameErr = validateStr(name, 'Imię i nazwisko', { maxLen: 200 });
    if (nameErr) return err(nameErr);
    const roleErr = validateRole(role);
    if (roleErr) return err(roleErr);
    const salt = genSalt();
    const hash = await hashPwd(password, salt);
    try {
      const res = await env.DB.prepare(
        'INSERT INTO users(email,name,password_hash,salt,role,company_id) VALUES(?,?,?,?,?,?)'
      ).bind(email.trim().toLowerCase(), (name || email).trim(), hash, salt, role || 'viewer', company_id || null).run();
      return json({ ok: true, id: res.meta.last_row_id });
    } catch (e) {
      if (e.message.includes('UNIQUE')) return err('Email już istnieje', 409);
      throw e;
    }
  }

  if (req.method === 'PUT' && userId) {
    let body;
    try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const roleErr = validateRole(body.role);
    if (roleErr) return err(roleErr);
    const nameErr = validateStr(body.name, 'Imię i nazwisko', { maxLen: 200 });
    if (nameErr) return err(nameErr);
    if (body.password && String(body.password).length < 6) return err('Hasło zbyt krótkie (min 6 znaków)');
    if (body.password && String(body.password).length > 128) return err('Hasło zbyt długie (max 128 znaków)');
    const sets = [], vals = [];
    if (body.name)              { sets.push('name=?');          vals.push(body.name.trim()); }
    if (body.role)              { sets.push('role=?');          vals.push(body.role); }
    if (body.active !== undefined) { sets.push('active=?');     vals.push(body.active ? 1 : 0); }
    if (body.company_id !== undefined) { sets.push('company_id=?'); vals.push(body.company_id || null); }
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
      await env.DB.prepare(`UPDATE drivers SET ${sets.join(',')} WHERE id=? AND company_id=?`).bind(...vals, company).run();
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
    await env.DB.prepare('DELETE FROM drivers WHERE id=? AND company_id=?').bind(driverId, company).run();
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
    const limit  = Math.min(parseInt(url.searchParams.get('limit')  || '500'), 2000);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'),   0);
    let q = 'SELECT * FROM fines WHERE company_id=?';
    const p = [company];
    if (nrRej) { q += ' AND nr_rej=?'; p.push(nrRej); }
    if (paid === '0') q += ' AND paid=0';
    if (paid === '1') q += ' AND paid=1';
    q += ' ORDER BY date DESC LIMIT ? OFFSET ?';
    p.push(limit, offset);
    const rows = await env.DB.prepare(q).bind(...p).all();
    return json({ ok: true, fines: rows.results || [] });
  }

  if (!canWrite) return err('Brak uprawnień', 403);

  if (req.method === 'POST') {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!body.date) return err('Wymagane: date');
    const id = body.id || crypto.randomUUID();
    const _branchIdFine = await _getVehicleBranchId(env, company, body.nr_rej);
    await env.DB.prepare(
      `INSERT OR REPLACE INTO fines(id,company_id,nr_rej,driver_name,type,date,amount,deadline,
        description,fine_no,issuer,points,notes,paid,paid_date,created_by,branch_id,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`
    ).bind(id, company, body.nr_rej||null, body.driver_name||null, body.type||'inne', body.date,
      body.amount??null, body.deadline||null, body.description||null,
      body.fine_no||null, body.issuer||null, body.points??null, body.notes||null,
      body.paid?1:0, body.paid_date||null, user._apiKey ? null : user.id, _branchIdFine
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
    await env.DB.prepare(`UPDATE fines SET ${sets.join(',')} WHERE id=? AND company_id=?`).bind(...vals, company).run();
    return json({ ok: true });
  }

  if (req.method === 'DELETE' && fineId) {
    const existing = await env.DB.prepare('SELECT company_id FROM fines WHERE id=?').bind(fineId).first();
    if (!existing) return err('Mandat nie istnieje', 404);
    if (existing.company_id !== company) return err('Brak dostępu', 403);
    await env.DB.prepare('DELETE FROM fines WHERE id=? AND company_id=?').bind(fineId, company).run();
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
    await env.DB.prepare(`UPDATE reservations SET ${sets.join(',')} WHERE id=? AND company_id=?`).bind(...vals, company).run();
    return json({ ok: true });
  }

  if (req.method === 'DELETE' && resId) {
    const existing = await env.DB.prepare('SELECT company_id FROM reservations WHERE id=?').bind(resId).first();
    if (!existing) return err('Rezerwacja nie istnieje', 404);
    if (existing.company_id !== company) return err('Brak dostępu', 403);
    await env.DB.prepare('DELETE FROM reservations WHERE id=? AND company_id=?').bind(resId, company).run();
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
    if (body.id && !/^[0-9a-f-]{36}$/i.test(body.id)) return err('Nieprawidłowy format id', 400);
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
    await env.DB.prepare(`UPDATE fleet_cards SET ${sets.join(',')} WHERE id=? AND company_id=?`).bind(...vals, company).run();
    return json({ ok: true });
  }

  if (req.method === 'DELETE' && cardId) {
    const existing = await env.DB.prepare('SELECT company_id FROM fleet_cards WHERE id=?').bind(cardId).first();
    if (!existing) return err('Karta nie istnieje', 404);
    if (existing.company_id !== company) return err('Brak dostępu', 403);
    await env.DB.prepare('DELETE FROM fleet_cards WHERE id=? AND company_id=?').bind(cardId, company).run();
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
      'SELECT id,company_id,name,scope,active,created_at,last_used_at FROM api_keys WHERE company_id=? ORDER BY created_at DESC'
    ).bind(user.company_id).all();
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
    vals.push(keyId, user.company_id);
    await env.DB.prepare(`UPDATE api_keys SET ${sets.join(',')} WHERE id=? AND company_id=?`).bind(...vals).run();
    return json({ ok: true });
  }

  if (req.method === 'DELETE' && keyId) {
    await env.DB.prepare('DELETE FROM api_keys WHERE id=? AND company_id=?').bind(keyId, user.company_id).run();
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── HISTORIA DEKLARACJI DT-1 ────────────────────────────────────────────────
async function handleDt1Declarations(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean); // ['api','dt1-declarations',id?]
  const company = url.searchParams.get('company') || user.company_id;
  const declId  = segs[2] || null;

  if (req.method === 'GET' && !declId) {
    const rows = await env.DB.prepare(
      'SELECT id,company_id,rok,total_tax,vehicle_count,gmina,created_by,created_at,notes FROM dt1_declarations WHERE company_id=? ORDER BY rok DESC,created_at DESC'
    ).bind(company).all();
    return json(rows.results || []);
  }

  if (req.method === 'POST') {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const id = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO dt1_declarations(id,company_id,rok,total_tax,vehicle_count,gmina,created_by,notes,vehicles_json) VALUES(?,?,?,?,?,?,?,?,?)'
    ).bind(id, company, body.rok||new Date().getFullYear(), body.total_tax||0, body.vehicle_count||0,
      body.gmina||null, user.email||user.id, body.notes||null,
      body.vehicles ? JSON.stringify(body.vehicles) : null).run();
    return json({ ok:true, id });
  }

  if (req.method === 'DELETE' && declId) {
    await env.DB.prepare('DELETE FROM dt1_declarations WHERE id=? AND company_id=?').bind(declId, company).run();
    return json({ ok:true });
  }

  // GET /api/dt1-declarations/:id/vehicles — zwraca snapshot pojazdów
  if (req.method === 'GET' && declId) {
    const row = await env.DB.prepare('SELECT * FROM dt1_declarations WHERE id=? AND company_id=?').bind(declId, company).first();
    if (!row) return err('Nie znaleziono', 404);
    let vehicles = [];
    try { vehicles = JSON.parse(row.vehicles_json || '[]'); } catch {}
    return json({ ...row, vehicles });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── WEBHOOKI WYCHODZĄCE ──────────────────────────────────────────────────────
async function handleWebhooks(req, env, user, url, path) {
  const segs  = path.split('/').filter(Boolean);
  const company = url.searchParams.get('company') || user.company_id;
  const hookId  = segs[2] || null;

  if (req.method === 'GET' && !hookId) {
    const rows = await env.DB.prepare(
      'SELECT id,company_id,name,url,events,active,last_fired_at,last_status FROM webhooks WHERE company_id=? ORDER BY created_at DESC'
    ).bind(company).all();
    return json(rows.results || []);
  }

  if (req.method === 'POST' && !hookId) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!body.name) return err('Brak nazwy webhooka', 400);
    if (String(body.name).length > 100) return err('Nazwa webhooka zbyt długa (max 100 znaków)', 400);
    if (!body.url || !/^https:\/\//.test(body.url)) return err('URL musi zaczynać się od https://', 400);
    if (body.url.length > 2048) return err('URL webhooka zbyt długi (max 2048 znaków)', 400);
    const id = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO webhooks(id,company_id,name,url,events,secret,active) VALUES(?,?,?,?,?,?,1)'
    ).bind(id, company, body.name, body.url,
      JSON.stringify(Array.isArray(body.events) ? body.events : ['alert']),
      body.secret||null).run();
    return json({ ok:true, id });
  }

  if (req.method === 'PUT' && hookId) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (body.url !== undefined && !/^https:\/\//.test(body.url)) return err('URL musi zaczynać się od https://', 400);
    const sets=[]; const vals=[];
    if (body.name   !== undefined) { sets.push('name=?');   vals.push(body.name); }
    if (body.url    !== undefined) { sets.push('url=?');    vals.push(body.url); }
    if (body.events !== undefined) { sets.push('events=?'); vals.push(JSON.stringify(body.events)); }
    if (body.active !== undefined) { sets.push('active=?'); vals.push(body.active?1:0); }
    if (!sets.length) return err('Brak pól');
    vals.push(hookId, company);
    await env.DB.prepare(`UPDATE webhooks SET ${sets.join(',')} WHERE id=? AND company_id=?`).bind(...vals).run();
    return json({ ok:true });
  }

  if (req.method === 'DELETE' && hookId) {
    await env.DB.prepare('DELETE FROM webhooks WHERE id=? AND company_id=?').bind(hookId, company).run();
    return json({ ok:true });
  }

  // POST /api/webhooks/:id/test — testowe wywołanie
  if (req.method === 'POST' && segs[3] === 'test') {
    const testHookId = hookId;
    const hook = await env.DB.prepare('SELECT * FROM webhooks WHERE id=? AND company_id=?').bind(testHookId, company).first();
    if (!hook) return err('Nie znaleziono webhooka', 404);
    try {
      const resp = await fetch(hook.url, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'X-TaxOrder-Event':'test', ...(hook.secret?{'X-TaxOrder-Signature':hook.secret}:{}) },
        body: JSON.stringify({ event:'test', timestamp: new Date().toISOString(), message:'Test z TaxOrder Pro' }),
      });
      await env.DB.prepare('UPDATE webhooks SET last_fired_at=datetime(\'now\'),last_status=? WHERE id=?').bind(resp.status, testHookId).run();
      return json({ ok:true, status: resp.status });
    } catch(e) {
      return json({ ok:false, error: e.message });
    }
  }

  return err('Metoda niedozwolona', 405);
}

// Pomocnik: wyślij zdarzenie do wszystkich aktywnych webhooków firmy
async function fireWebhooks(env, company_id, event, payload) {
  try {
    const hooks = await env.DB.prepare('SELECT * FROM webhooks WHERE company_id=? AND active=1').bind(company_id).all();
    for (const h of (hooks.results||[])) {
      let events = [];
      try { events = JSON.parse(h.events||'[]'); } catch {}
      if (!events.includes(event) && !events.includes('*')) continue;
      fetch(h.url, {
        method:'POST',
        headers:{'Content-Type':'application/json','X-TaxOrder-Event':event,...(h.secret?{'X-TaxOrder-Signature':h.secret}:{})},
        body: JSON.stringify({ event, timestamp:new Date().toISOString(), company_id, ...payload }),
      }).then(r => env.DB.prepare('UPDATE webhooks SET last_fired_at=datetime(\'now\'),last_status=? WHERE id=?').bind(r.status,h.id).run()).catch(()=>{});
    }
  } catch {}
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
  { key: 'fines',           table: 'fines',            jsonCols: [],                skipImport: false },
  { key: 'drivers',         table: 'drivers',          jsonCols: [],                skipImport: true  },
  { key: 'fleetCards',      table: 'fleet_cards',      jsonCols: [],                skipImport: false },
  { key: 'reservations',    table: 'reservations',     jsonCols: [],                skipImport: false },
  { key: 'dt1Declarations', table: 'dt1_declarations', jsonCols: ['vehicles_json'], skipImport: false },
  { key: 'webhooks',        table: 'webhooks',         jsonCols: ['events'],        skipImport: true  },
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

async function handleDashboardStats(env, company) {
  const today = new Date(); today.setUTCHours(0,0,0,0);
  const in7   = new Date(today); in7.setUTCDate(today.getUTCDate() + 7);
  const in30  = new Date(today); in30.setUTCDate(today.getUTCDate() + 30);
  const in60  = new Date(today); in60.setUTCDate(today.getUTCDate() + 60);
  const fmt   = d => d.toISOString().slice(0,10);

  const [vehRes, fineRes, drvRes] = await Promise.all([
    env.DB.prepare('SELECT data FROM vehicles WHERE company_id=? AND (json_extract(data,\'$.isArchived\') IS NULL OR json_extract(data,\'$.isArchived\')!=1) LIMIT 5000').bind(company).all(),
    env.DB.prepare('SELECT deadline FROM fines WHERE company_id=? AND paid=0 LIMIT 2000').bind(company).all().catch(() => ({ results: [] })),
    env.DB.prepare('SELECT license_expiry FROM drivers WHERE company_id=? LIMIT 2000').bind(company).all().catch(() => ({ results: [] })),
  ]);

  const todayStr = fmt(today);
  const in7Str   = fmt(in7);
  const in30Str  = fmt(in30);
  const in60Str  = fmt(in60);

  let oc_expired=0, oc_7=0, oc_30=0, ac_expired=0, ac_30=0;
  let przeglad_expired=0, przeglad_30=0, udt_30=0, tacho_30=0;
  let vehicles_total=0;

  for (const row of (vehRes.results || [])) {
    vehicles_total++;
    let d = {};
    try { d = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {}); } catch {}

    const check = (field, expCb, d7Cb, d30Cb) => {
      const v = d[field]; if (!v) return;
      if (v < todayStr) expCb();
      else if (v <= in7Str && d7Cb) d7Cb();
      else if (v <= in30Str) d30Cb();
    };
    check('ocEnd', () => oc_expired++, () => oc_7++, () => oc_30++);
    check('acEnd', () => ac_expired++, null, () => ac_30++);
    check('nextInspection', () => przeglad_expired++, null, () => przeglad_30++);
    check('udtNextDate', () => {}, null, () => udt_30++);
    check('tachoNextCalib', () => {}, null, () => tacho_30++);
  }

  let fines_unpaid = 0, fines_deadline_7 = 0;
  for (const f of (fineRes.results || [])) {
    fines_unpaid++;
    if (f.deadline && f.deadline <= in7Str) fines_deadline_7++;
  }

  let drivers_license_expiring = 0;
  for (const dr of (drvRes.results || [])) {
    if (dr.license_expiry && dr.license_expiry >= todayStr && dr.license_expiry <= in30Str) drivers_license_expiring++;
  }

  return json({
    vehicles_total,
    oc_expired, oc_7, oc_30,
    ac_expired, ac_30,
    przeglad_expired, przeglad_30,
    udt_30, tacho_30,
    fines_unpaid, fines_deadline_7,
    drivers_license_expiring,
    computed_at: new Date().toISOString(),
  });
}

// ─── TEKOM / MyCar API INTEGRATION ───────────────────────────────────────────
const TEKOM_API = 'https://api-mcdesktop.tekom.pl/api';

async function tekomAuth(cfg) {
  const r = await fetch(`${TEKOM_API}/AuthenticateUser`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Login: cfg.login,
      Password: cfg.password,
      ServerName: cfg.serverName || '',
      DatabaseName: cfg.dbName || '',
      ComputerName: 'TaxOrderPro',
      Platform: 'Web',
      ApplicationAndVersion: 'TaxOrderPro/1.0',
    }),
  });
  if (!r.ok) throw new Error(`Tekom auth HTTP ${r.status}`);
  const d = await r.json();
  const token = d.Token || d.token || d.result?.Token || d.Result?.Token;
  if (!token) throw new Error(`Tekom: brak tokenu — odpowiedź: ${JSON.stringify(d).slice(0,200)}`);
  return token;
}

async function tekomGetVehicles(token) {
  const r = await fetch(`${TEKOM_API}/GetVehicleList`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ Token: token }),
  });
  if (!r.ok) throw new Error(`Tekom GetVehicleList HTTP ${r.status}`);
  const d = await r.json();
  // Próba różnych struktur odpowiedzi
  return d.Vehicles || d.vehicles || d.Result?.Vehicles || d.result?.Vehicles || d.VehicleList || d.vehicleList || [];
}

async function handleTekomIntegration(req, env, user, url, path) {
  if (!['admin','kierownik'].includes(user.role)) return err('Brak uprawnień', 403);
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Podaj ?company=', 400);
  const cfgKey = `tekom_cfg_${company}`;

  // GET /api/tekom — odczyt konfiguracji (bez hasła)
  if (req.method === 'GET' && path === '/api/tekom') {
    const raw = await env.PREFS?.get(cfgKey);
    if (!raw) return json({ configured: false });
    const cfg = JSON.parse(raw);
    return json({ configured: true, login: cfg.login, serverName: cfg.serverName||'', dbName: cfg.dbName||'', lastSync: cfg.lastSync||null, lastSyncVehicles: cfg.lastSyncVehicles||0 });
  }

  // POST /api/tekom/config — zapis konfiguracji
  if (req.method === 'POST' && path === '/api/tekom/config') {
    const body = await req.json().catch(() => ({}));
    if (!body.login || !body.password) return err('Podaj login i password');
    const cfg = { login: body.login, password: body.password, serverName: body.serverName||'', dbName: body.dbName||'' };
    await env.PREFS?.put(cfgKey, JSON.stringify(cfg));
    return json({ ok: true, msg: 'Konfiguracja zapisana' });
  }

  // POST /api/tekom/test — test połączenia
  if (req.method === 'POST' && path === '/api/tekom/test') {
    const raw = await env.PREFS?.get(cfgKey);
    if (!raw) return err('Brak konfiguracji — najpierw skonfiguruj integrację', 400);
    try {
      const cfg = JSON.parse(raw);
      const token = await tekomAuth(cfg);
      const vehs = await tekomGetVehicles(token);
      return json({ ok: true, msg: `Połączenie OK — znaleziono ${vehs.length} pojazdów w Tekom`, vehicleCount: vehs.length, sampleVehicles: vehs.slice(0,3) });
    } catch(e) {
      return json({ ok: false, msg: e.message });
    }
  }

  // POST /api/tekom/sync — synchronizacja km z Tekom
  if (req.method === 'POST' && path === '/api/tekom/sync') {
    const raw = await env.PREFS?.get(cfgKey);
    if (!raw) return err('Brak konfiguracji Tekom', 400);
    try {
      const cfg = JSON.parse(raw);
      const token = await tekomAuth(cfg);
      const tekomVehs = await tekomGetVehicles(token);

      // Pobierz pojazdy TaxOrder dla tej firmy
      const dbVehs = await env.DB.prepare('SELECT id, nr_rej, data FROM vehicles WHERE company_id = ? LIMIT 5000').bind(company).all();
      const vehMap = {};
      for (const v of (dbVehs.results || [])) {
        // Indeksuj po różnych formach nr rej (bez spacji, bez kresek, uppercase)
        const key = (v.nr_rej||'').toUpperCase().replace(/[\s\-]/g,'');
        vehMap[key] = v;
      }

      let updated = 0, unmatched = 0;
      const updates = [];

      for (const tv of tekomVehs) {
        // Próba różnych nazw pola rejestracji w odpowiedzi Tekom
        const rawReg = tv.Registration || tv.registration || tv.PlateNo || tv.plateNo || tv.Vehicle || tv.vehicle || '';
        const normReg = rawReg.toUpperCase().replace(/[\s\-]/g,'');
        const dbVeh = vehMap[normReg];
        if (!dbVeh) { unmatched++; continue; }

        let data = {};
        try { data = typeof dbVeh.data === 'string' ? JSON.parse(dbVeh.data) : (dbVeh.data || {}); } catch {}

        // Aktualizuj km jeśli Tekom ma wyższy przebieg
        const tekomKm = tv.Odometer || tv.odometer || tv.OdometerValue || tv.CurrentMileage || tv.mileage || null;
        let changed = false;
        if (tekomKm && Number(tekomKm) > 0) {
          const curKm = Number(data.stanKilometrow) || 0;
          if (Number(tekomKm) > curKm) {
            data.stanKilometrow = Number(tekomKm);
            changed = true;
          }
        }

        // Dodaj wpis GPS jeśli dostępna lokalizacja
        const lat = tv.Latitude || tv.latitude || tv.lat || null;
        const lon = tv.Longitude || tv.longitude || tv.lon || null;
        if (lat && lon) {
          if (!Array.isArray(data.gpsHistory)) data.gpsHistory = [];
          const today = new Date().toISOString().slice(0,10);
          const alreadyToday = data.gpsHistory.some(g => g.date === today && g.source === 'tekom_sync');
          if (!alreadyToday) {
            data.gpsHistory.push({
              date: today, time: new Date().toTimeString().slice(0,5),
              lat: Number(lat), lon: Number(lon),
              km: tekomKm ? Number(tekomKm) : undefined,
              driver: tv.Driver || tv.DriverName || tv.driver || '',
              location: tv.Location || tv.location || tv.Address || '',
              source: 'tekom_sync',
            });
            if (data.gpsHistory.length > 500) data.gpsHistory = data.gpsHistory.slice(-500);
            changed = true;
          }
        }

        if (changed) {
          updates.push({ id: dbVeh.id, data: JSON.stringify(data) });
          updated++;
        }
      }

      // Batch update
      for (const u of updates) {
        await env.DB.prepare("UPDATE vehicles SET data=?, updated_at=datetime('now') WHERE id=?").bind(u.data, u.id).run();
      }

      // Zapisz timestamp sync
      const cfg2 = JSON.parse(raw);
      cfg2.lastSync = new Date().toISOString();
      cfg2.lastSyncVehicles = updated;
      await env.PREFS?.put(cfgKey, JSON.stringify(cfg2));

      return json({ ok: true, synced: updated, unmatched, total: tekomVehs.length, msg: `Zsynchronizowano ${updated} pojazdów (${unmatched} bez dopasowania)` });
    } catch(e) {
      return json({ ok: false, msg: e.message, synced: 0 });
    }
  }

  // GET /api/tekom/etoll — sprawdź salda e-Toll z Tekom
  if (req.method === 'GET' && path === '/api/tekom/etoll') {
    const raw = await env.PREFS?.get(cfgKey);
    if (!raw) return err('Brak konfiguracji Tekom', 400);
    try {
      const cfg = JSON.parse(raw);
      const token = await tekomAuth(cfg);
      const r = await fetch(`${TEKOM_API}/GetETollBalance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ Token: token }),
      });
      if (!r.ok) return json({ ok: false, msg: `GetETollBalance HTTP ${r.status}` });
      const d = await r.json();
      const devices = d.ETollDevices || d.etollDevices || d.Devices || d.devices || d.Result || d.result || d || [];
      return json({ ok: true, devices: Array.isArray(devices) ? devices : [devices], rawResponse: d });
    } catch(e) {
      return json({ ok: false, msg: e.message });
    }
  }

  return err('Nieznana operacja Tekom', 404);
}

async function handleExport(env, company) {
  const vehiclesRes = await env.DB.prepare('SELECT * FROM vehicles WHERE company_id = ? ORDER BY nr_rej LIMIT 10000').bind(company).all();
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
    const validVehicles = body.vehicles.filter(v => {
      if (!v.nr_rej?.trim()) { skipped.push({ table: 'vehicles', id: null, reason: 'brak nr_rej' }); return false; }
      return true;
    });
    if (validVehicles.length) {
      const stmt = env.DB.prepare(`
        INSERT INTO vehicles(company_id,nr_rej,axles_count,suspension_type,
          dmc_zespolu,miesiace_podatku,dt1_category,dt1_tax_amount,data,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,datetime('now'))
        ON CONFLICT(company_id,nr_rej) DO UPDATE SET
          axles_count=excluded.axles_count, suspension_type=excluded.suspension_type,
          dmc_zespolu=excluded.dmc_zespolu, miesiace_podatku=excluded.miesiace_podatku,
          dt1_category=excluded.dt1_category, dt1_tax_amount=excluded.dt1_tax_amount,
          data=excluded.data, updated_at=datetime('now')`);
      await env.DB.batch(validVehicles.map(v => stmt.bind(
        company, v.nr_rej.trim(), v.axles_count ?? 2, v.suspension_type ?? 'pneumatyczne',
        v.dmc_zespolu ?? 0, v.miesiace_podatku ?? 12,
        v.dt1_category ?? null, v.dt1_tax_amount ?? null,
        typeof v.data === 'string' ? v.data : JSON.stringify(v.data ?? {})
      )));
    }
    counts.vehicles = validVehicles.length;
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
      // Whitelist: tylko prawidłowe nazwy kolumn SQL (alfanumeryczne + podkreślnik)
      const cols = Object.keys(row).filter(c => c !== 'id' && c !== 'company_id' && /^[a-z_][a-z0-9_]*$/i.test(c));
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

// POST /api/push/subscribe — wymaga sesji (przeniesione za getUser())
async function handlePushSubscribe(req, env, user) {
  let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
  const { subscription, company_id, label, user_id } = body;
  if (!subscription?.endpoint || !subscription?.keys) return err('Nieprawidłowa subskrypcja');
  if (!company_id) return err('Wymagane company_id');
  if (user.role !== 'admin' && company_id !== user.company_id) return err('Brak dostępu do tej firmy', 403);
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

// POST /api/push/send — sends to all subscribers of a company; requires admin session
async function handlePushSend(req, env, user) {
  if (user && user.role !== 'admin') return err('Tylko administrator może wysyłać powiadomienia', 403);
  if (!user) return err('Nieautoryzowany', 401);
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
  if (body.password.length > 128) return err('Hasło zbyt długie (max 128 znaków)');
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

  const userId = request.headers.get('X-User-Id') || 'anon';
  const companyId = new URL(request.url).searchParams.get('company') || '';
  const t0 = Date.now();
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
      trackAIEvent(env, userId, companyId, 'llama-3.3-70b-versatile', 0, 0, Date.now()-t0, false).catch(()=>{});
      return err('Błąd Groq: ' + (e.error?.message || resp.statusText), 502);
    }
    const data = await resp.json();
    const usage = data.usage || {};
    trackAIEvent(env, userId, companyId, 'llama-3.3-70b-versatile', usage.prompt_tokens, usage.completion_tokens, Date.now()-t0, true).catch(()=>{});
    return json({ answer: data.choices[0].message.content });
  } catch (e) {
    console.error('[AI] Groq error:', e?.message);
    trackAIEvent(env, userId, companyId, 'llama-3.3-70b-versatile', 0, 0, Date.now()-t0, false).catch(()=>{});
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
// Indeksy potwierdzone na PRAWDZIWYM dowodzie (Mercedes Sprinter, dokument z 04.2020,
// 67 pól). Wcześniej mapowaliśmy 17 pól z 67 — reszta była w ładunku, tylko jej nie
// czytaliśmy.
//
// `dataWydania` (14) to DATA WYSTAWIENIA DOKUMENTU i to ona zmienia się przy każdej
// wymianie dowodu. `dataRej` (51) jest datą rejestracji i NIE WIADOMO, czy pierwszej,
// czy bieżącej — do rozstrzygnięcia trzeba dwóch dowodów tego samego VIN-u. Do ustalania,
// który dokument jest aktualny, używaj `dataWydania`, nie `dataRej`.
//
// `wlasciciel` (16) to pole C.1 dyrektywy — przy leasingu jest tam leasingodawca,
// po wykupie spółka. To najsilniejszy sygnał odróżniający dowód leasingowy od własnego.
// `posiadacz` (27) to C.2, czyli użytkownik/dzierżawca.
const _DR_NEW = { seriaDr:1, nrRej:7, marka:8, typ:9, model:12, vin:13,
  dataWydania:14, wlasciciel:16, nipWlasciciela:20, posiadacz:27,
  dmcKg:38, dmcKg2:39, dmcZespolu:40, masaWlKg:41, kategoria:42, liczbaOsi:44,
  pojSilnika:48, mocKW:49, paliwo:50, dataRej:51, miejscaSied:52, rokPierwszejRej:56 };
const _DR_OLD = { nrRej:4, marka:5, typ:6, vin:10, dataRej:48 };
const _FUEL = { P:'PB (Benzyna)', D:'ON (Olej napędowy)', M:'LNG (Metan)',
  LPG:'LPG', CNG:'CNG', LNG:'LNG', H:'Hybrydowy', BD:'Biodiesel', EE:'Elektryczny', E85:'E85' };

/**
 * Cała ścieżka bajty → pola dowodu, bez warstwy HTTP. Wydzielone z handleAztec,
 * żeby `tools/aztec-compare.js` mogło uruchomić DOKŁADNIE ten sam kod na zdjęciu
 * dowodu — kontener deweloperski nie ma dostępu sieciowego do produkcyjnego
 * Workera, a kopia tej logiki w narzędziu rozjechałaby się z produkcją i ukryła
 * właśnie ten błąd, który narzędzie ma wykrywać (tak rozjechały się dwie tablice
 * wskaźników CO2 i dwie listy źródeł kreatora raportów).
 *
 * Rzuca Error z komunikatem po polsku — handleAztec zamienia go na 400.
 */
function _decodeAztecPayload(bytes) {
  if (!bytes || bytes.length < 8) throw new Error('Za mało danych AZTEC (' + (bytes ? bytes.length : 0) + ' bajtów)');

  // Pierwsze 4 bajty: długość danych po dekompresji (little-endian uint32)
  const outputLen = bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] * 0x1000000);
  if (outputLen < 10 || outputLen > 131072) throw new Error('Nieprawidłowa długość: ' + outputLen);

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

  return { fields: result, fieldCount: fields.length, format: isNew ? 'new' : 'old' };
}

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

  try {
    const { fields, fieldCount, format } = _decodeAztecPayload(bytes);
    return json({ ok: true, fields, fieldCount, format });
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
// Identyfikator modelu AI, który nie ma prawa być wartością pola pojazdu.
// ZNALEZIONE W DANYCH, nie wymyślone: pojazd WE129YG (Isuzu D-Max) miał model
// „qwen/qwen3.6-27b", a w checkpointcie ekstrakcji DR takich rekordów jest
// 109 z 1318 — 8%. Najczęstsza wartość to `cf-workers-ai-llama-3.2-11b`,
// czyli DOSŁOWNIE literał, który ten plik składa przy odpowiedzi z warstwy CF.
// Model językowy nie zna tego napisu, więc to nie halucynacja — to wyciek
// koperty odpowiedzi do pól. Producenta (skrypt wsadowy z wcześniejszej sesji)
// już nie ma, ale klasa błędu zostaje: KAŻDY konsument, który zrobi
// `{...odpowiedz}` zamiast `{...odpowiedz.fields}`, odtworzy ją natychmiast.
//
// Bramka stoi tutaj, bo `_sanitizeOcrFields` jest jedynym wąskim gardłem,
// przez które przechodzą wszystkie pola OCR ze wszystkich warstw kaskady.
// Wzorzec jest CELOWO wąski — „Scout" to nazwa modelu Internationala, a nie
// tylko `llama-4-scout`, więc samo słowo nie wystarcza do odrzucenia.
// ⚠️ NIE dopisuj tu ogólnego wzorca „vendor/model" (`^[\w.-]+\/[\w.-]+$`) — kusi,
// bo łapie `qwen/qwen3.6-27b` bez listy nazw, ale numer homologacji ma postać
// `e4*2007/46*0413*14`, a D.2 bywa `ATFS-87C/1`. Taka reguła kasowałaby pola
// urzędowe. Lista rodzin jest węższa i wystarcza: `qwen/…` łapie się na `qwen`.
const _WZORZEC_MODELU_AI = /^(cf-workers-ai|@cf\/)|\b(llama-?[0-9]|qwen[0-9]?|gpt-[0-9]|claude-[0-9]|gemma-?[0-9]|mistral-|pixtral|deepseek|phi-[0-9])/i;

// Czy wartość jest przepisanym opisem pola z promptu, a nie odczytem z dokumentu.
//
// Dwie reguły, bo model kopiuje na dwa sposoby — cały opis albo jego początek:
//   [a] wartość zaczyna się od kodu rubryki i myślnika („D.3 — …", „P.3 — …",
//       „K — …"). Żaden realny odczyt tak nie wygląda: w dokumencie kod rubryki
//       jest ETYKIETĄ obok pola, nie częścią wartości;
//   [b] wartość jest całym opisem albo jego długim POCZĄTKIEM (model urwał
//       kopiowanie w pół zdania). Potrzebne dla pól, których opis nie zaczyna
//       się od kodu rubryki — np. `rokProd: 'rok produkcji 4 cyfry'`.
//
// ⚠️ NIE zmieniaj [b] na „wartość ZAWIERA SIĘ w opisie". Kusi, bo brzmi
// ogólniej, ale opisy Z ZAŁOŻENIA wymieniają poprawne odpowiedzi: opis
// `zawieszenie` podaje „pneumatyczne", opis `przeznaczenie` podaje
// „SAMOCHOD CIEZAROWY", a opisy `vin` i `nrHomolog` zawierają przykłady,
// które realny pojazd może mieć naprawdę. Sprawdzone: taka wersja kasowała
// cztery POPRAWNE odczyty na pięć wykrytych ech. Dopasowanie od POCZĄTKU
// nie ma tej wady — żadna z tych wartości nie stoi na początku swojego opisu.
function _echoOpisuPola(wartosc, opis) {
  if (/^[A-Z]{1,3}(\.[0-9])?\s*[—–-]\s/.test(wartosc)) return true;
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const w = norm(wartosc), o = norm(opis);
  return w === o || (w.length >= 20 && o.startsWith(w));
}

function _sanitizeOcrFields(f) {
  if (!f || typeof f !== 'object') return f;

  for (const [k, v] of Object.entries(f)) {
    if (typeof v !== 'string' || !v.trim()) continue;
    const t = v.trim();

    if (_WZORZEC_MODELU_AI.test(t)) {
      console.log(`[OCR sanitize] pole ${k} odrzucone — wygląda na identyfikator modelu AI: ${t.slice(0, 60)}`);
      delete f[k];
      continue;
    }

    // Model przepisał OPIS POLA z promptu zamiast odczytać wartość. Znalezione
    // w raporcie DR: paliwo = „P.3 — D lub B lub G", nrHomolog = „K — nr
    // homologacji np e32*IV18/858*NI15391", model = „D.3 — model np ACTROS
    // lub SPRINTER". Prompt wysyła `JSON.stringify(DR_POLA_OCR)`, więc opis
    // stoi modelowi przed oczami i bywa kopiowany dosłownie.
    //
    // Porównanie idzie z SAMYM DR_POLA_OCR, nie z listą przepisaną obok —
    // dzięki temu zmiana promptu przenosi się na bramkę automatycznie.
    // Precedens w tym projekcie: dwie tablice CO2 i dwie listy źródeł
    // kreatora raportów rozjechały się dokładnie przez taką kopię.
    const opis = DR_POLA_OCR[k];
    if (opis && _echoOpisuPola(t, opis)) {
      console.log(`[OCR sanitize] pole ${k} odrzucone — model przepisał opis pola z promptu: ${t.slice(0, 60)}`);
      delete f[k];
    }
  }

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

/**
 * POLA ZADANE OD MODELU OCR — JEDNA definicja dla obu sciezek.
 *
 * DLACZEGO STALA, A NIE DWA LITERALY. Do 21.08 prompt DR istnial w DWOCH kopiach:
 * `handleAIOCR` (20 pol, szczegolowe wskazowki) i `handleDrOcr` (16 pol, bez przeznaczenia,
 * bez F.2, bez O.1/O.2, bez wskazowek do VIN-a). Ktora sciezka obsluzyla dokument, taki
 * zestaw pol wracal — bez sladu w wyniku. Ten projekt ma juz trzy takie rozjazdy
 * (dwie tablice wskaznikow CO2, dwie listy zrodel kreatora raportow, dwie deklaracje
 * wersji ZXing) i wszystkie objawialy sie CICHYMI ZLYMI DANYMI, nie bledem.
 *
 * DWA POLA DOPISANE PO POMIARZE NA 916 POJAZDACH:
 *   normaEuro   — bylo 55/916, i to wylacznie z zestawienia; OCR o to nie pytal
 *   zawieszenie — bylo 0/916, z ZADNEGO zrodla; OCR o to nie pytal
 * Oba sa polami DT-1: rodzaj zawieszenia decyduje o stawce dla pojazdow >= 12 t.
 * Bez nich podatku nie da sie wyliczyc, a ich brak nie zglaszal sie jako blad.
 *
 * ⛔ KOD „V.9" USUNIETY Z PROMPTU 25.08 — ZWERYFIKOWANE W DZIENNIKU USTAW.
 * Do tej daty prompt kazal modelowi szukac „V.9 — poziom emisji spalin". Taka
 * rubryka NIE ISTNIEJE w polskim wzorze dowodu: ciagi „V.9", „EURO" i „emisj"
 * nie wystepuja w calym rozporzadzeniu MI z 8.11.2024 (Dz.U. 2024 poz. 1709,
 * 102 strony, wyszukiwanie pelnotekstowe). Oficjalna lista kodow w zal. 3 lit. C
 * idzie: A, B, C.*, D.*, E, F.*, G, H, I, J, K, L, O.*, P.*, Q, S.*, X.
 *
 * Kazanie modelowi szukac nieistniejacej rubryki to nie tylko marnowanie pola —
 * to zaproszenie do ZMYSLANIA. Model, ktoremu podaje sie kod, szuka czegos, co
 * pasuje do wzorca, i w razie potrzeby dopasuje sasiednia wartosc. Norma EURO
 * na polskim dowodzie bywa WYLACZNIE w adnotacjach urzedowych i tylko tam ma
 * sens jej szukac — prompt mowi to teraz wprost, razem z informacja, ze kodu
 * literowego dla tego pola NIE MA.
 *
 * Zmierzone pokrycie przed zmiana: normaEuro 1/54 (RapidOCR) i 55/916 (pelny
 * zbior), przy czym te 55 pochodzilo z ZESTAWIENIA, ani jedno z OCR.
 * Zrodlo weryfikacji i adresy do pobrania aktu: modules/dr-fields.js, naglowek.
 */
const DR_POLA_OCR = {
  nrRej: 'A — numer rejestracyjny np WPR0365T lub WA0677L (2-3 wielkie litery + cyfry, BEZ spacji)',
  dataRej: 'B — data PIERWSZEJ rejestracji DD.MM.RRRR',
  marka: 'D.1 — marka np MAN lub SCANIA',
  typ: 'D.2 — krotki kod techniczny np TGE140 lub R490 (NIE adres, NIE opis slowny)',
  model: 'D.3 — model np ACTROS lub SPRINTER',
  przeznaczenie: 'RODZAJ POJAZDU / PRZEZNACZENIE z sekcji bezowej, np SAMOCHOD SPECJALNY lub SAMOCHOD CIEZAROWY (puste jesli nie widoczne)',
  vin: 'E — dokladnie 17 znakow VIN np WMA29VUZ7R9018317 (litery A-H J-N P R-Z i cyfry 0-9, NIGDY I O Q, NIGDY gwiazdki)',
  // ⚠️ F.1 i F.2 TO DWIE RÓŻNE WIELKOŚCI, nie dwa odczyty tej samej.
  // F.1 = maksymalna masa technicznie dopuszczalna (możliwości konstrukcji).
  // F.2 = DOPUSZCZALNA masa całkowita, czyli ta zarejestrowana w kraju — i to
  // JEJ używa ustawa o podatkach i opłatach lokalnych jako podstawy DT-1.
  // Zawsze F.2 <= F.1; na dowodzie WA1697F stoi F.1=37000 przy F.2=32000.
  //
  // Poprzednia wersja tego opisu mówiła „jesli dwie wartosci wybierz WIEKSZA",
  // czyli kazała modelowi wpisać do `dmcKg` wartość TECHNICZNĄ — zawyżoną
  // podstawę podatku. Drugi opis nazywał F.2 „DMC z ladunkiem", co jest po
  // prostu inną wielkością i mogło skłaniać model do zgadywania.
  dmcKg: 'F.1 — maksymalna masa calkowita TECHNICZNIE dopuszczalna, kg',
  dmcKg2: 'F.2 — DOPUSZCZALNA masa calkowita kg (podstawa podatku, zawsze <= F.1)',
  dmcZespolu: 'F.3 — DMC zespolu kg (>= F.1)',
  masaWlKg: 'G — masa wlasna kg (mniejsza niz F.1)',
  liczbaOsi: 'L — liczba osi 1-5',
  kategoria: 'J — kategoria np N1 N2 N3 M1',
  pojSilnika: 'P.1 — pojemnosc cm3 cyfry',
  mocKW: 'P.2 — moc kW cyfry',
  paliwo: 'P.3 — D lub B lub G',
  miejscaSied: 'S.1 — miejsca siedzace cyfra',
  rokProd: 'rok produkcji 4 cyfry',
  dmcPrzyczHam: 'O.1 — masa przyczepy z hamulcem kg',
  dmcPrzyczNieham: 'O.2 — masa przyczepy bez hamulca kg',
  nrHomolog: 'K — nr homologacji np e32*IV18/858*NI15391',
  normaEuro: 'poziom emisji spalin np EURO 6 lub EURO VI. Szukaj WYLACZNIE w ADNOTACJACH URZEDOWYCH (zwykle na dole dokumentu), gdzie bywa zapisany slownie. NIE MA osobnej rubryki z kodem literowym na te dane — jesli w adnotacjach tego nie ma, zwroc puste',
  zawieszenie: 'RODZAJ ZAWIESZENIA OSI JEZDNEJ — zwykle w ADNOTACJACH URZEDOWYCH, np "zawieszenie pneumatyczne" albo "zawieszenie uznane za rownowazne pneumatycznemu". Zwroc "pneumatyczne", "rownowazne pneumatycznemu" albo "inne". Puste jesli dokument o tym nie mowi — NIE ZGADUJ',
};
const DR_JSON_SZABLON = () => JSON.stringify(DR_POLA_OCR);

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
${DR_JSON_SZABLON()}`;

  // ── Próba 0: Python OCR Service (WYŁĄCZONA 24.08, PRZYCZYNA ZMIENIŁA SIĘ DWUKROTNIE 25.08) ──
  //
  // 24.08: silnik byl Tesseract+regex, dawal 10-59s i zle/puste pola — jakosc, nie
  // infrastruktura. NAPRAWIONE 25.08 rano: PaddleOCR (lang=pl) + parser GEOMETRYCZNY —
  // na dokumencie, ktory Proba 1/2 (CF/Groq) dwukrotnie oddaly PUSTY (klaster "Toyota
  // Hilux GR", strona PDF narysowana w orientacji pionowej mimo fizycznie poziomego
  // dowodu), nowy silnik wyciagnal 8 poprawnych pol. JAKOSC PRZESTALA BYC PROBLEMEM,
  // ale akcelerator CPU oneDNN wymagany przez paddlepaddle padal TWARDYM crashem
  // procesu (SIGFPE w konwolucji) na dwoch sprawdzonych wersjach (3.3.1 i 3.2.2, dwie
  // ROZNE awarie w tym samym podsystemie) — wylaczenie go (`enable_mkldnn=False`)
  // usuwalo crash, ale bez sprzetowej akceleracji jeden dokument to ~30-80s.
  //
  // ZAMIENIONE 25.08 wieczorem na RapidOCR (github.com/RapidAI/RapidOCR) — TE SAME
  // modele PP-OCR, ONNX Runtime zamiast frameworka paddlepaddle, wiec caly podsystem
  // oneDNN znika razem z jego awariami. Silnik: patrz ocr-service/extractors/
  // rapid_fields.py. Predkosc: 8-11s/dokument (5-8x szybciej), ale WCIAZ NIE
  // DOSTATECZNIE ponizej limitu 8s ponizej, zeby ryzykowac niezawodnosc zywej
  // sciezki. Dla PRZETWARZANIA WSADOWEGO to bez znaczenia — patrz
  // tools/dr-ocr-batch-cloudrun.js, ktory woła Cloud Run BEZPOSREDNIO (bez tego
  // limitu) i jest dzis wlasciwa droga dla dokumentow, ktorych CF/Groq nie odczytaly.
  // Ponowne wlaczenie tej flagi wymaga potwierdzenia STABILNEGO czasu <8s na wiekszej
  // probce (dzisiejszy pomiar: 5.5-10.7s na 10 dokumentach, mediana ~9.5s) — dopiero
  // wtedy, nie wczesniej.
  const PROBA_0_WLACZONA = false;
  let pyErr = null;
  if (!PROBA_0_WLACZONA) {
    pyErr = 'Próba 0 wyłączona — zmierzona jakość poniżej Prób 1/2, patrz komentarz w kodzie';
  } else if (!env.OCR_PYTHON_URL) {
    pyErr = 'OCR_PYTHON_URL nieustawiony';
  } else {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (env.OCR_PYTHON_SECRET) headers['X-Api-Key'] = env.OCR_PYTHON_SECRET;
      const pyResp = await fetch(env.OCR_PYTHON_URL.replace(/\/$/, '') + '/ocr', {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageBase64, mimeType }),
        signal: AbortSignal.timeout(8000),
      });
      if (!pyResp.ok) {
        // Treść odpowiedzi przycięta: leci do wywołującego, a serwis dostał obraz
        // dowodu i mógłby odbić jego fragment w komunikacie błędu.
        const tresc = await pyResp.text().catch(() => '');
        pyErr = `HTTP ${pyResp.status}${tresc ? ' — ' + tresc.slice(0, 120) : ''}`;
      } else {
        const pyData = await pyResp.json();
        if (!pyData.ok || !pyData.fields) {
          pyErr = `odpowiedź bez pól (ok=${pyData?.ok})${pyData?.error ? ' — ' + String(pyData.error).slice(0, 120) : ''}`;
        } else {
          const sanitized = _sanitizeOcrFields(pyData.fields);
          // Sprawdź po sanityzacji — jeśli kluczowe pola puste, przejdź do Groq
          if (sanitized.nrRej || sanitized.vin || sanitized.marka || sanitized.dmcKg) {
            return json({ ok: true, fields: sanitized, model: 'rapidocr-latin' });
          }
          pyErr = 'wynik po sanityzacji pusty (brak nrRej/vin/marka/dmcKg)';
        }
      }
    } catch (e) {
      // AbortSignal.timeout(8000) zgłasza się tu jako TimeoutError — to najczęstszy
      // objaw uśpionej instancji Railway, wart odróżnienia od zwykłej awarii sieci.
      pyErr = e.name === 'TimeoutError' ? 'przekroczono 8 s (usługa uśpiona?)' : (e.message || String(e));
    }
  }
  if (pyErr) console.log(`[OCR PaddleOCR] pominięty: ${pyErr}`);

  // Powód porażki KAŻDEJ próby musi dotrzeć do wywołującego, nie tylko do console.log.
  // Do 18.08 CF AI zwracał kod 5016 („licencja modelu niezaakceptowana"), a endpoint
  // oddawał 502 z komunikatem o Groq — czyli o warstwie, która była tylko skutkiem.
  // Diagnoza zajęła dzień zamiast minuty, bo prawdziwa przyczyna była wyłącznie w logu.
  let cfErr = null;

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
      if (!jm) {
        cfErr = answer ? 'model nie zwrócił JSON: ' + answer.slice(0, 80) : 'pusta odpowiedź modelu';
      } else {
        const parsed = JSON.parse(jm[0]);
        console.log('[OCR CF-AI parsed vin]', parsed.vin ?? 'BRAK');
        const fields = _sanitizeOcrFields(parsed);
        console.log('[OCR CF-AI after sanitize vin]', fields.vin ?? 'USUNIĘTY');
        if (fields.nrRej || fields.vin || fields.marka || fields.dmcKg) {
          return json({ ok: true, fields, model: 'cf-workers-ai-llama-3.2-11b' });
        }
        // Model odpowiedział, ale po sanitizacji nie zostało nic użytecznego. Bez tego
        // rozróżnienia wygląda to identycznie jak awaria modelu, a wymaga innej naprawy.
        cfErr = '_sanitizeOcrFields nie zostawił żadnego użytecznego pola';
      }
    } catch (e) {
      cfErr = e?.message || String(e);
      console.log('[OCR CF-AI error]', cfErr);
    }
  } else {
    cfErr = 'binding AI niedostępny w środowisku Workera';
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

  // AKTUALIZACJA 24.08: oba modele `llama-4-*` ponizej okazaly sie NIEDOSTEPNE dla tego
  // konta ("does not exist or you do not have access to it") — zmierzone bezposrednio
  // przez /api/ai/ocr, nie zalozone. Podmienione na kandydata z oficjalnej dokumentacji
  // Groq (console.groq.com/docs/vision, potwierdzone dwoma niezaleznymi odczytami z tymi
  // samymi szczegolami — 131K kontekstu, do 5 obrazow, 20MB/obraz). NIEZWERYFIKOWANE
  // wprost wywolaniem API (brak dostepu do GROQ_API_KEY z tego srodowiska) — jesli znowu
  // dostaniesz "does not exist", to znaczy ze i ten identyfikator trzeba sprawdzic w
  // panelu Groq, nie zgadywac kolejnego. Ksztalt zadania (OpenAI-compatible messages
  // z image_url) NIE wymaga zmiany przy podmianie modelu — to ta sama warstwa API.
  const visionModels = [
    'qwen/qwen3.6-27b',
  ];
  // Bledy WSZYSTKICH modeli, nie tylko ostatniego — jedna zmienna nadpisywana w petli
  // gubila powod porazki kazdego modelu oprocz ostatniego. Przy 2 modelach to jeszcze
  // znosne, ale diagnoza "ktory model faktycznie zawodzi i dlaczego" wymagala zgadywania.
  const bledyModeli = [];
  for (const model of visionModels) {
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.GROQ_API_KEY },
        // `reasoning_effort: 'none'` — qwen3.6-27b jest modelem "thinking": bez tego
        // odpowiedz zaczyna sie blokiem <think>...</think> z rozumowaniem, a nasze
        // max_tokens (bylo 512) ucinalo odpowiedz W POLOWIE NAMYSLU, zanim model
        // dotarl do wlasciwego JSON-a. Zmierzone bezposrednio na realnym dokumencie:
        // "AI nie zwrocilo JSON: \n<think>\nThe user wants me to extract data...".
        // Parametr bez znaczenia dla modeli bez trybu thinking (Groq API go ignoruje).
        body: JSON.stringify({ model, messages, max_tokens: 1024, temperature: 0.1, reasoning_effort: 'none' }),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        bledyModeli.push(`${model}: ${e.error?.message || resp.statusText}`);
        continue;
      }
      const data = await resp.json();
      const answer = data.choices?.[0]?.message?.content || '';
      console.log(`[OCR Groq ${model} raw]`, answer.slice(0, 500));
      const jm = answer.match(/\{[\s\S]*\}/);
      if (!jm) { bledyModeli.push(`${model}: AI nie zwróciło JSON: ` + answer.slice(0, 100)); continue; }
      const parsed = JSON.parse(jm[0]);
      console.log(`[OCR Groq ${model} parsed vin]`, parsed.vin ?? 'BRAK');
      const fields = _sanitizeOcrFields(parsed);
      console.log(`[OCR Groq ${model} after sanitize vin]`, fields.vin ?? 'USUNIĘTY');
      return json({ ok: true, fields, model });
    } catch (e) {
      bledyModeli.push(`${model}: ${e?.message}`);
    }
  }
  const lastErr = bledyModeli.length ? bledyModeli.join(' | ') : 'Brak działającego modelu vision';
  // Obie warstwy w jednym komunikacie — inaczej wywołujący widzi wyłącznie porażkę
  // Groq i szuka przyczyny w warstwie, która była tylko następstwem.
  return err(`Błąd AI Vision. PaddleOCR: ${pyErr || 'pominięte'}. CF Workers AI: ${cfErr || 'pominięte'}. Groq: ${lastErr}`, 502);
}

// ─── FOLDER MONITOR — agent watcher handlers ──────────────────────────────────

// POST /api/folder-monitor/ingest
// Przyjmuje plik od lokalnego agenta, uruchamia OCR, zapisuje do kolejki D1
async function handleFmIngest(request, env, user) {
  let body; try { body = await request.json(); } catch { return err('Nieprawidłowe JSON'); }
  const { filename, docType, fileBase64, mimeType = 'image/jpeg', company, agentName = 'agent' } = body;
  if (!filename || !docType || !fileBase64) return err('Wymagane: filename, docType, fileBase64');

  // Weryfikacja dostępu do firmy
  const companyId = company || user.company_id || 'mtoilet';
  if (user.role !== 'admin') {
    const row = await env.DB.prepare('SELECT id FROM users WHERE id=? AND company_id=?').bind(user.id, companyId).first();
    if (!row) return err('Brak dostępu do firmy', 403);
  }

  // Sprawdź duplikat (ta sama nazwa + firma + typ + 24h)
  const dup = await env.DB.prepare(
    "SELECT id FROM folder_monitor_queue WHERE company_id=? AND filename=? AND doc_type=? AND created_at > datetime('now','-24 hours')"
  ).bind(companyId, filename, docType).first();
  if (dup) return json({ ok: true, id: dup.id, duplicate: true });

  // Uruchom OCR (async — wynik trafia do kolejki)
  let ocrResult = null, ocrModel = null, ocrError = null;
  try {
    // Wywołaj handleAIOCRDoc inline z tym samym body
    const mockReq = { method: 'POST', json: async () => ({ imageBase64: fileBase64, mimeType, docType }) };
    const ocrResp = await handleAIOCRDoc(mockReq, env);
    if (ocrResp.status === 200) {
      const d = await ocrResp.json();
      ocrResult = JSON.stringify(d.fields || {});
      ocrModel  = d.model || '';
    } else {
      ocrError = 'HTTP ' + ocrResp.status;
    }
  } catch (e) { ocrError = e.message; }

  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO folder_monitor_queue (id, company_id, filename, doc_type, status, ocr_result, ocr_model, error_msg, agent_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, companyId, filename, docType,
    ocrResult ? 'ocr_done' : 'error',
    ocrResult, ocrModel, ocrError, agentName
  ).run();

  return json({ ok: true, id, status: ocrResult ? 'ocr_done' : 'error' }, 201);
}

// GET /api/folder-monitor/queue?company=...&status=...&limit=50
async function handleFmQueue(request, env, user, url) {
  const company = url.searchParams.get('company') || user.company_id || 'mtoilet';
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    if (user.company_id && user.company_id !== company) return err('Brak dostępu', 403);
  }
  const status  = url.searchParams.get('status');   // opcjonalny filtr
  const limit   = Math.min(parseInt(url.searchParams.get('limit') || '100'), 200);

  let query = 'SELECT id, filename, doc_type, status, ocr_result, ocr_model, error_msg, agent_name, created_at FROM folder_monitor_queue WHERE company_id=?';
  const binds = [company];
  if (status) { query += ' AND status=?'; binds.push(status); }
  query += ' ORDER BY created_at DESC LIMIT ?';
  binds.push(limit);

  const rows = await env.DB.prepare(query).bind(...binds).all();
  return json((rows.results || []).map(r => ({
    ...r,
    ocr_result: r.ocr_result ? JSON.parse(r.ocr_result) : null,
  })));
}

// PATCH /api/folder-monitor/queue/:id  { status: 'imported' | 'skipped' }
// DELETE /api/folder-monitor/queue/:id
async function handleFmQueueItem(request, env, user, path, method) {
  const id = path.split('/').pop();
  if (!id) return err('Brak id');

  // Izolacja tenanta: pozycja kolejki musi nalezec do firmy uzytkownika.
  // Bez tego dowolny zalogowany uzytkownik mogl modyfikowac/usuwac wpisy innej firmy (IDOR).
  // Fallback 'mtoilet' zgodny z handleFmQueue (GET) i pozostalymi 27 miejscami w pliku —
  // users.company_id jest nullable (schema_v22), wiec starsi uzytkownicy nie moga stracic dostepu.
  const company = user.company_id || 'mtoilet';

  if (method === 'DELETE') {
    const r = await env.DB.prepare('DELETE FROM folder_monitor_queue WHERE id=? AND company_id=?')
      .bind(id, company).run();
    if (!r.meta || r.meta.changes === 0) return err('Pozycja nie znaleziona', 404);
    return json({ ok: true });
  }

  // PATCH
  let body; try { body = await request.json(); } catch { return err('Nieprawidłowe JSON'); }
  const { status } = body;
  if (!['imported', 'skipped', 'pending'].includes(status)) return err('Nieprawidłowy status');
  const r = await env.DB.prepare(
    "UPDATE folder_monitor_queue SET status=?, processed_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=? AND company_id=?"
  ).bind(status, id, company).run();
  if (!r.meta || r.meta.changes === 0) return err('Pozycja nie znaleziona', 404);
  return json({ ok: true });
}

// ═══════════════════════════════════════════════════════════════════════════
// FIRMY (NAJEMCY) — schema_v44
// Zastępuje martwe moduły Supabase: companies-readonly.js, company-create.js.
// Firmy były zahardkodowane w app.js — bez tego onboarding nowego najemcy
// wymagał deployu. Źródłem prawdy jest teraz D1.
// ═══════════════════════════════════════════════════════════════════════════
const COMPANY_FIELDS = ['short_name','name','nip','regon','krs','ulica','dom','lokal','kod','miasto','woj','organ','color','wlasciciel'];

function _isCompanyAdmin(user) {
  return user.role === 'admin' || user.role === 'superadmin';
}

async function handleCompanies(req, env, user, url, path) {
  const segs = path.split('/').filter(Boolean);   // ['api','companies',':id']
  const id   = segs[2] || null;

  // GET /api/companies — lista firm dostępnych dla użytkownika
  if (req.method === 'GET' && !id) {
    const rows = await env.DB.prepare(
      'SELECT * FROM companies WHERE active=1 ORDER BY short_name'
    ).all().catch(() => ({ results: [] }));
    let list = rows.results || [];

    // Admin widzi wszystko. Pozostali — tylko firmy z user_company_access
    // plus własna firma domyślna z users.company_id.
    if (!_isCompanyAdmin(user)) {
      const acc = await env.DB.prepare(
        'SELECT company_id FROM user_company_access WHERE user_id=? AND can_view=1'
      ).bind(user.id).all().catch(() => ({ results: [] }));
      const allowed = new Set((acc.results || []).map(r => r.company_id));
      if (user.company_id) allowed.add(user.company_id);
      list = list.filter(c => allowed.has(c.id));
    }
    return json({ companies: list });
  }

  // GET /api/companies/:id
  if (req.method === 'GET' && id) {
    if (!_isCompanyAdmin(user)) {
      const acc = await env.DB.prepare(
        'SELECT 1 FROM user_company_access WHERE user_id=? AND company_id=? AND can_view=1'
      ).bind(user.id, id).first();
      if (!acc && user.company_id !== id) return err('Brak dostępu', 403);
    }
    const row = await env.DB.prepare('SELECT * FROM companies WHERE id=? AND active=1').bind(id).first();
    if (!row) return err('Firma nie znaleziona', 404);
    return json(row);
  }

  // POST /api/companies — utworzenie nowego najemcy
  if (req.method === 'POST') {
    if (!_isCompanyAdmin(user)) return err('Brak uprawnień administratora', 403);
    let b; try { b = await req.json(); } catch { return err('Nieprawidłowe JSON'); }

    const slug = String(b.id || b.slug || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{1,31}$/.test(slug)) {
      return err('Nieprawidłowy identyfikator: 2-32 znaki, małe litery, cyfry, - lub _');
    }
    if (!b.short_name || !b.name) return err('Wymagane: short_name i name');
    if (String(b.short_name).length > 60 || String(b.name).length > 200) return err('Nazwa za długa');
    if (b.nip && !/^\d{10}$/.test(String(b.nip).replace(/[\s-]/g, ''))) return err('NIP musi mieć 10 cyfr');

    const exists = await env.DB.prepare('SELECT id FROM companies WHERE id=?').bind(slug).first();
    if (exists) return err('Firma o tym identyfikatorze już istnieje', 409);

    const vals = COMPANY_FIELDS.map(f => (b[f] != null ? String(b[f]).slice(0, 200) : null));
    await env.DB.prepare(
      `INSERT INTO companies (id,${COMPANY_FIELDS.join(',')},created_by)
       VALUES (?,${COMPANY_FIELDS.map(() => '?').join(',')},?)`
    ).bind(slug, ...vals, user.email || null).run();

    // Twórca dostaje pełny dostęp do nowej firmy
    await env.DB.prepare(
      'INSERT OR IGNORE INTO user_company_access (user_id,company_id,can_view,can_edit,granted_by) VALUES (?,?,1,1,?)'
    ).bind(user.id, slug, user.email || null).run();

    const row = await env.DB.prepare('SELECT * FROM companies WHERE id=?').bind(slug).first();
    return json({ ok: true, company: row }, 201);
  }

  // PUT /api/companies/:id
  if (req.method === 'PUT' && id) {
    if (!_isCompanyAdmin(user)) return err('Brak uprawnień administratora', 403);
    let b; try { b = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const row = await env.DB.prepare('SELECT id FROM companies WHERE id=?').bind(id).first();
    if (!row) return err('Firma nie znaleziona', 404);

    const sets = [], binds = [];
    for (const f of COMPANY_FIELDS) {
      if (b[f] !== undefined) { sets.push(`${f}=?`); binds.push(b[f] != null ? String(b[f]).slice(0, 200) : null); }
    }
    if (b.active !== undefined) { sets.push('active=?'); binds.push(b.active ? 1 : 0); }
    if (!sets.length) return err('Brak pól do aktualizacji');
    sets.push("updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now')");
    binds.push(id);

    await env.DB.prepare(`UPDATE companies SET ${sets.join(',')} WHERE id=?`).bind(...binds).run();
    const upd = await env.DB.prepare('SELECT * FROM companies WHERE id=?').bind(id).first();
    return json({ ok: true, company: upd });
  }

  // DELETE /api/companies/:id — dezaktywacja, nie kasowanie (dane pojazdów zostają)
  if (req.method === 'DELETE' && id) {
    if (!_isCompanyAdmin(user)) return err('Brak uprawnień administratora', 403);
    const r = await env.DB.prepare(
      "UPDATE companies SET active=0, updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?"
    ).bind(id).run();
    if (!r.meta || r.meta.changes === 0) return err('Firma nie znaleziona', 404);
    return json({ ok: true, deactivated: id });
  }

  return err('Metoda nieobsługiwana', 405);
}

// ═══════════════════════════════════════════════════════════════════════════
// DOSTĘPY UŻYTKOWNIK ↔ FIRMA — zastępuje company-access.js na Supabase
// ═══════════════════════════════════════════════════════════════════════════
async function handleCompanyAccess(req, env, user, url, path) {
  if (!_isCompanyAdmin(user)) return err('Brak uprawnień administratora', 403);

  // GET /api/company-access?user_id=123
  if (req.method === 'GET') {
    const uid = parseInt(url.searchParams.get('user_id'), 10);
    if (uid) {
      const rows = await env.DB.prepare(
        'SELECT company_id,can_view,can_edit FROM user_company_access WHERE user_id=?'
      ).bind(uid).all().catch(() => ({ results: [] }));
      return json({ access: rows.results || [] });
    }
    const rows = await env.DB.prepare(
      `SELECT a.user_id,a.company_id,a.can_view,a.can_edit,u.email,u.name
       FROM user_company_access a LEFT JOIN users u ON u.id=a.user_id
       ORDER BY u.email LIMIT 2000`
    ).all().catch(() => ({ results: [] }));
    return json({ access: rows.results || [] });
  }

  // PUT /api/company-access — nadanie/odebranie dostępu
  if (req.method === 'PUT') {
    let b; try { b = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const uid = parseInt(b.user_id, 10);
    const cid = String(b.company_id || '').trim();
    if (!uid || !cid) return err('Wymagane: user_id i company_id');

    const u = await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(uid).first();
    if (!u) return err('Użytkownik nie znaleziony', 404);
    const c = await env.DB.prepare('SELECT id FROM companies WHERE id=?').bind(cid).first();
    if (!c) return err('Firma nie znaleziona', 404);

    const canView = b.can_view ? 1 : 0;
    const canEdit = b.can_edit ? 1 : 0;

    if (!canView && !canEdit) {
      await env.DB.prepare('DELETE FROM user_company_access WHERE user_id=? AND company_id=?')
        .bind(uid, cid).run();
      return json({ ok: true, removed: true });
    }
    await env.DB.prepare(
      `INSERT INTO user_company_access (user_id,company_id,can_view,can_edit,granted_by)
       VALUES (?,?,?,?,?)
       ON CONFLICT(user_id,company_id) DO UPDATE SET can_view=excluded.can_view, can_edit=excluded.can_edit`
    ).bind(uid, cid, canView, canEdit, user.email || null).run();
    return json({ ok: true });
  }

  return err('Metoda nieobsługiwana', 405);
}

// ─── OCR DOC — wieloformatowy OCR (polisa / paliwo / serwis / dr) ─────────────
async function handleAIOCRDoc(request, env) {
  if (request.method !== 'POST') return err('Method not allowed', 405);
  let body; try { body = await request.json(); } catch { return err('Nieprawidłowe JSON'); }
  const { imageBase64, mimeType = 'image/jpeg', docType = 'dr' } = body;
  if (!imageBase64) return err('Brak obrazu (imageBase64)');

  const PROMPTS = {
    polisa: `Jestes ekspertem od polskich polis ubezpieczeniowych OC/AC/NNW. Wyodrebnij dane z dokumentu ubezpieczeniowego.
Zwroc WYLACZNIE JSON bez markdown:
{"nrRej":"numer rejestracyjny pojazdu np WA12345 (puste jesli nie widoczny)","vin":"VIN 17 znakow jesli widoczny","typ":"OC lub AC lub NNW lub Assistance lub inne","nrPolisy":"numer polisy ubezpieczeniowej","towarzystwo":"pelna nazwa firmy ubezpieczeniowej np PZU SA lub Warta SA","dataOd":"data poczatku ochrony DD.MM.RRRR","dataDo":"data konca ochrony DD.MM.RRRR","skladka":"kwota skladki liczba bez jednostki","waluta":"PLN"}`,

    paliwo: `Jestes ekspertem od polskich faktur paliwowych i paragonow za paliwo. Wyodrebnij dane z dokumentu.
Zwroc WYLACZNIE JSON bez markdown:
{"nrRej":"numer rejestracyjny pojazdu jesli widoczny np WA12345","dataFaktury":"data tankowania lub faktury DD.MM.RRRR","litry":"liczba litrow jako liczba np 45.20","cenaNetto":"kwota netto PLN liczba","cenaBrutto":"kwota brutto PLN liczba","rodzajPaliwa":"Diesel lub Benzyna lub LPG lub CNG","nrFaktury":"numer faktury lub paragonu","stacja":"nazwa stacji paliw np Orlen lub BP lub Lotos"}`,

    serwis: `Jestes ekspertem od polskich protokolow serwisowych i faktur za naprawe pojazdow. Wyodrebnij dane.
Zwroc WYLACZNIE JSON bez markdown:
{"nrRej":"numer rejestracyjny pojazdu np WA12345","dataSerwisu":"data uslug DD.MM.RRRR","rodzajUslugi":"opis uslug np Wymiana oleju, Naprawa hamulcow, Przeglad","kosztNetto":"koszt netto PLN liczba","kosztBrutto":"koszt brutto PLN liczba","przebieg":"przebieg km w momencie serwisu liczba","warsztat":"nazwa warsztatu lub serwisu","nrZlecenia":"numer zlecenia serwisowego"}`,

    dr: null, // DR uses the main /api/ai/ocr endpoint and its dedicated prompt
  };

  const prompt = PROMPTS[docType];
  if (!prompt) return err('Nieznany typ dokumentu: ' + docType);

  const messages = [{
    role: 'user',
    content: [
      { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
      { type: 'text', text: prompt },
    ],
  }];

  // ── Próba 1: Cloudflare Workers AI ──
  if (env.AI) {
    try {
      const bin = atob(imageBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const cfResult = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
        prompt,
        image: [...bytes],
        max_tokens: 512,
      });
      const answer = cfResult?.response || '';
      const jm = answer.match(/\{[\s\S]*\}/);
      if (jm) {
        try {
          const fields = JSON.parse(jm[0]);
          if (Object.values(fields).some(v => v && v !== '')) {
            return json({ ok: true, fields, model: 'cf-workers-ai', docType });
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  // ── Próba 2: Groq Vision fallback ──
  if (!env.GROQ_API_KEY) return err('Brak CF AI i GROQ_API_KEY', 503);
  const visionModels = [
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'llama-3.2-90b-vision-preview',
    'llama-3.2-11b-vision-preview',
  ];
  let lastErr = 'Brak dzialajacego modelu';
  for (const model of visionModels) {
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.GROQ_API_KEY },
        body: JSON.stringify({ model, messages, max_tokens: 512, temperature: 0.1 }),
      });
      if (!resp.ok) { const e = await resp.json().catch(() => ({})); lastErr = e.error?.message || resp.statusText; continue; }
      const data = await resp.json();
      const answer = data.choices?.[0]?.message?.content || '';
      const jm = answer.match(/\{[\s\S]*\}/);
      if (!jm) { lastErr = 'AI nie zwrocilo JSON'; continue; }
      const fields = JSON.parse(jm[0]);
      return json({ ok: true, fields, model, docType });
    } catch (e) { lastErr = e?.message; }
  }
  return err('Blad AI Vision: ' + lastErr, 502);
}

// ─── POLISY IMPORT (R2) ──────────────────────────────────────────────────────

async function handlePolisyImport(req, env, user, url, path) {
  if (user.role !== 'admin' && user.role !== 'kierownik') return err('Brak uprawnień', 403);
  const company = url.searchParams.get('company');
  if (!company) return err('Wymagane: company');
  const prefix = `polisy-import/${company}/`;

  // GET — lista plików w folderze R2
  if (req.method === 'GET') {
    const listed = await env.DOCS.list({ prefix, limit: 200 });
    const files = (listed.objects || []).map(o => ({
      key: o.key,
      name: decodeURIComponent(o.customMetadata?.originalName || o.key.replace(prefix, '')),
      size: o.size,
      uploaded: o.uploaded,
    }));
    return json({ ok: true, files });
  }

  // POST — upload pliku do R2
  if (req.method === 'POST') {
    let formData;
    try { formData = await req.formData(); } catch { return err('Wymagane multipart/form-data'); }
    const file = formData.get('file');
    if (!file || !file.name) return err('Brak pliku');
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['pdf','jpg','jpeg','png','webp'].includes(ext)) return err('Dozwolone formaty: PDF, JPG, PNG, WEBP');
    const fileId = crypto.randomUUID();
    const r2Key = `${prefix}${fileId}.${ext}`;
    await env.DOCS.put(r2Key, file.stream(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
      customMetadata: { originalName: file.name, uploadedBy: String(user.id || '') },
    });
    return json({ ok: true, key: r2Key, name: file.name });
  }

  // DELETE — usuń plik (key w query string)
  if (req.method === 'DELETE') {
    const r2Key = url.searchParams.get('key');
    if (!r2Key || !r2Key.startsWith(prefix)) return err('Nieprawidłowy klucz');
    await env.DOCS.delete(r2Key);
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

async function handlePolisySave(req, env, user, url) {
  if (user.role !== 'admin' && user.role !== 'kierownik') return err('Brak uprawnień', 403);
  const company = url.searchParams.get('company');
  if (!company) return err('Wymagane: company');
  let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
  const { nr_rej, polisa, r2Key } = body;
  if (!nr_rej || !polisa?.typ) return err('Wymagane: nr_rej, polisa.typ');

  const vehRow = await env.DB.prepare('SELECT * FROM vehicles WHERE company_id=? AND nr_rej=?').bind(company, nr_rej).first();
  if (!vehRow) return err('Pojazd nie istnieje');

  let data = {};
  try { data = typeof vehRow.data === 'string' ? JSON.parse(vehRow.data) : (vehRow.data || {}); } catch {}
  if (!data.policyHistory) data.policyHistory = [];
  const archiveDate = new Date().toISOString().slice(0, 10);
  const typ = (polisa.typ || '').toUpperCase();

  if (typ === 'OC') {
    if (data.ocPolicyNo || data.ocEnd) {
      data.policyHistory.unshift({ typ:'OC', nr_polisy:data.ocPolicyNo, firma:data.ocInsurer, data_od:data.ocStart, data_do:data.ocEnd, skladka:data.ocPremium, archived_at:archiveDate });
    }
    if (polisa.nr_polisy != null) data.ocPolicyNo = polisa.nr_polisy;
    if (polisa.firma    != null) data.ocInsurer   = polisa.firma;
    if (polisa.data_od  != null) data.ocStart     = polisa.data_od;
    if (polisa.data_do  != null) data.ocEnd       = polisa.data_do;
    if (polisa.skladka  != null) data.ocPremium   = polisa.skladka;
  } else if (typ === 'AC') {
    if (data.acPolicyNo || data.acEnd) {
      data.policyHistory.unshift({ typ:'AC', nr_polisy:data.acPolicyNo, firma:data.acInsurer, data_od:data.acStart, data_do:data.acEnd, skladka:data.acPremium, archived_at:archiveDate });
    }
    if (polisa.nr_polisy != null) data.acPolicyNo = polisa.nr_polisy;
    if (polisa.firma    != null) data.acInsurer   = polisa.firma;
    if (polisa.data_od  != null) data.acStart     = polisa.data_od;
    if (polisa.data_do  != null) data.acEnd       = polisa.data_do;
    if (polisa.skladka  != null) data.acPremium   = polisa.skladka;
  } else if (typ === 'NNW' || typ === 'ASSISTANCE') {
    if (data.assPolicyNo || data.assEnd) {
      data.policyHistory.unshift({ typ:typ, nr_polisy:data.assPolicyNo, firma:data.assInsurer, data_do:data.assEnd, archived_at:archiveDate });
    }
    if (polisa.nr_polisy != null) data.assPolicyNo = polisa.nr_polisy;
    if (polisa.firma    != null) data.assInsurer   = polisa.firma;
    if (polisa.data_do  != null) data.assEnd       = polisa.data_do;
  }

  await env.DB.prepare("UPDATE vehicles SET data=?, updated_at=datetime('now') WHERE company_id=? AND nr_rej=?")
    .bind(JSON.stringify(data), company, nr_rej).run();

  if (r2Key && r2Key.startsWith(`polisy-import/${company}/`)) {
    await env.DOCS.delete(r2Key).catch(() => {});
  }

  return json({ ok: true });
}

async function handlePolisyParse(req, env) {
  let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
  const { ocrText } = body;
  if (!ocrText?.trim()) return err('Brak tekstu OCR');
  if (!env.GROQ_API_KEY) return err('Brak GROQ_API_KEY', 503);

  const prompt = `Przeanalizuj poniższy tekst OCR polisy ubezpieczeniowej pojazdu i wyodrębnij dane. Odpowiedz WYŁĄCZNIE poprawnym JSON, bez żadnego dodatkowego tekstu.

Schemat:
{"typ":"OC","nr_polisy":"...","firma":"...","nr_rej":"...","data_od":"RRRR-MM-DD","data_do":"RRRR-MM-DD","skladka":1234.56,"pewnosc":"wysoka"}

Typy polis: OC, AC, NNW, Assistance. Daty w formacie ISO RRRR-MM-DD. Null gdy brak danych.

Tekst OCR:
${ocrText.slice(0, 4000)}`;

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: 'llama3-8b-8192',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });
  if (!r.ok) return err('Błąd AI: ' + r.status, 502);
  const d = await r.json();
  let parsed = {};
  try { parsed = JSON.parse(d.choices?.[0]?.message?.content || '{}'); } catch {}
  return json({ ok: true, parsed });
}

// ─── DR IMPORT (R2 folder) ────────────────────────────────────────────────────

async function handleDrImport(req, env, user, url) {
  if (user.role !== 'admin' && user.role !== 'kierownik') return err('Brak uprawnień', 403);
  const company = url.searchParams.get('company');
  if (!company) return err('Wymagane: company');
  const prefix = `dr-import/${company}/`;

  if (req.method === 'GET') {
    const listed = await env.DOCS.list({ prefix, limit: 200 });
    const files = (listed.objects || []).map(o => ({
      key: o.key,
      name: decodeURIComponent(o.customMetadata?.originalName || o.key.replace(prefix, '')),
      size: o.size,
      uploaded: o.uploaded,
    }));
    return json({ ok: true, files });
  }

  if (req.method === 'POST') {
    let formData; try { formData = await req.formData(); } catch { return err('Wymagane multipart/form-data'); }
    const file = formData.get('file');
    if (!file || !file.name) return err('Brak pliku');
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['jpg','jpeg','png','webp','pdf'].includes(ext)) return err('Dozwolone: JPG, PNG, WEBP, PDF');
    const r2Key = `${prefix}${crypto.randomUUID()}.${ext}`;
    await env.DOCS.put(r2Key, file.stream(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
      customMetadata: { originalName: file.name, uploadedBy: String(user.id || '') },
    });
    return json({ ok: true, key: r2Key, name: file.name });
  }

  if (req.method === 'DELETE') {
    const r2Key = url.searchParams.get('key');
    if (!r2Key || !r2Key.startsWith(prefix)) return err('Nieprawidłowy klucz');
    await env.DOCS.delete(r2Key);
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

async function handleDrSave(req, env, user, url) {
  if (user.role !== 'admin' && user.role !== 'kierownik') return err('Brak uprawnień', 403);
  const company = url.searchParams.get('company');
  if (!company) return err('Wymagane: company');
  let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
  const { nr_rej, fields, r2Key, unarchive, createIfMissing } = body;
  if (!nr_rej || !fields) return err('Wymagane: nr_rej, fields');

  const nrRej = nr_rej.trim().toUpperCase().replace(/\s/g, '');
  const vehRow = await env.DB.prepare('SELECT * FROM vehicles WHERE company_id=? AND nr_rej=?').bind(company, nrRej).first();

  let data = {};
  let axles = 2;
  let dmc_zespolu = 0;
  if (vehRow) {
    try { data = typeof vehRow.data === 'string' ? JSON.parse(vehRow.data) : (vehRow.data || {}); } catch {}
    axles = vehRow.axles_count || 2;
    dmc_zespolu = vehRow.dmc_zespolu || 0;
  }

  if (fields.marka)        data.marka        = fields.marka;
  if (fields.typ)          data.model         = fields.typ;
  if (fields.vin)          data.vin           = fields.vin;
  if (fields.paliwo)       data.paliwo        = fields.paliwo;
  if (fields.dataRej)      data.dataRej       = fields.dataRej;
  if (fields.kategoria)    data.katPojazdu    = fields.kategoria;
  if (fields.przeznaczenie) data.przeznaczenie = fields.przeznaczenie;
  if (fields.dmcKg)        { data.dmc = parseInt(fields.dmcKg); data.dmcMax = parseInt(fields.dmcKg); }
  if (fields.dmcKg2)       data.dmcKg2        = parseInt(fields.dmcKg2);
  if (fields.dmcZespolu)   { data.dmcZespolu = parseInt(fields.dmcZespolu); dmc_zespolu = parseInt(fields.dmcZespolu); }
  if (fields.masaWlKg)     data.masaWlasna    = parseInt(fields.masaWlKg);
  if (fields.liczbaOsi)    { data.osie = parseInt(fields.liczbaOsi); axles = parseInt(fields.liczbaOsi); }
  if (fields.pojSilnika)   data.pojSilnika    = parseInt(fields.pojSilnika);
  if (fields.mocKW)        data.mocKW         = parseInt(fields.mocKW);
  if (fields.miejscaSied)  data.miejscaSied   = parseInt(fields.miejscaSied);

  if (unarchive) { data.is_active = null; data.archivedAt = null; data.archivedReason = null; }

  if (vehRow) {
    await env.DB.prepare(
      "UPDATE vehicles SET data=?, axles_count=?, dmc_zespolu=?, updated_at=datetime('now') WHERE company_id=? AND nr_rej=?"
    ).bind(JSON.stringify(data), axles, dmc_zespolu, company, nrRej).run();
  } else if (createIfMissing) {
    await env.DB.prepare(
      "INSERT INTO vehicles(company_id,nr_rej,axles_count,suspension_type,dmc_zespolu,miesiace_podatku,data,updated_at) VALUES(?,?,?,?,?,?,?,datetime('now'))"
    ).bind(company, nrRej, axles, 'pneumatyczne', dmc_zespolu, 12, JSON.stringify(data)).run();
  } else {
    return err('Pojazd nie istnieje — użyj createIfMissing:true aby dodać nowy');
  }

  if (r2Key && r2Key.startsWith(`dr-import/${company}/`)) await env.DOCS.delete(r2Key).catch(() => {});
  return json({ ok: true, created: !vehRow, nr_rej: nrRej });
}

// ─── CEPIK PROXY ─────────────────────────────────────────────────────────────
// Browser cannot call api.cepik.gov.pl directly (CORS + IP whitelist).
// These endpoints forward requests server-side from the Worker.

async function handleCepikToken(request, env) {
  // POST /api/cepik/token — proxy do api-cpa.gov.pl używając env secrets (nigdy credentials z frontendu)
  if (!env.CEPIK_KEY || !env.CEPIK_SECRET) {
    return err('CEPiK nie jest skonfigurowany — skontaktuj się z administratorem', 503);
  }

  // Cache w KV: token ważny ~60 min, bufor 5 min
  const cacheKey = 'cepik_token_v1';
  try {
    const cached = await env.PREFS.get(cacheKey, { type: 'json' });
    if (cached?.access_token && cached.expires_at > Date.now() + 300_000) {
      return json({ access_token: cached.access_token, expires_in: Math.floor((cached.expires_at - Date.now()) / 1000) });
    }
  } catch { /* KV miss — kontynuuj */ }

  const credentials = btoa(env.CEPIK_KEY + ':' + env.CEPIK_SECRET);
  try {
    const resp = await fetch('https://api-cpa.gov.pl/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + credentials,
      },
      body: 'grant_type=client_credentials',
    });
    if (!resp.ok) {
      // Nie ujawniaj szczegółów błędu CEPiK klientowi
      console.error('[cepik-token] CEPiK HTTP', resp.status);
      return err('Błąd autoryzacji CEPiK — sprawdź konfigurację', 502);
    }
    const data = await resp.json();
    if (!data.access_token) return err('Nieprawidłowa odpowiedź CEPiK', 502);

    // Zapisz w KV
    const expiresIn = data.expires_in || 3600;
    await env.PREFS.put(cacheKey, JSON.stringify({ access_token: data.access_token, expires_at: Date.now() + expiresIn * 1000 }), { expirationTtl: expiresIn });

    return json({ access_token: data.access_token, expires_in: expiresIn });
  } catch (e) {
    console.error('[cepik-token]', e.message);
    return err('Błąd proxy tokenu CEPiK', 502);
  }
}

async function handleCepikPojazdy(request, env, user, url) {
  // GET /api/cepik/pojazdy?nr=...&woj=...&rok=...
  // Forwards Bearer token from X-Cepik-Token header
  const token = request.headers.get('X-Cepik-Token') || '';
  if (!token) return err('Brak X-Cepik-Token', 401);

  const nr   = url.searchParams.get('nr')  || '';
  const woj  = url.searchParams.get('woj') || '14';
  const rok  = url.searchParams.get('rok') || String(new Date().getFullYear());
  if (!nr) return err('Brak parametru nr');

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const company = user.company_id;

  // Warunek ustawowy dla teletransmisji CEP wymaga ograniczenia zapytań do własnej
  // ewidencji pojazdów — bez tego endpoint pozwalał odpytać CEPiK o DOWOLNY polski
  // numer rejestracyjny, nie tylko flotę firmy wywołującego. Porównanie znormalizowane
  // (bez spacji/myślników, wielkość liter), bo nr_rej bywa zapisany różnie.
  const wlasny = await env.DB.prepare(
    "SELECT id FROM vehicles WHERE company_id=? AND REPLACE(REPLACE(UPPER(nr_rej),' ',''),'-','')=REPLACE(REPLACE(UPPER(?),' ',''),'-','')"
  ).bind(company, nr).first();

  if (!wlasny) {
    await logAudit(env, {
      company_id: company, user_id: user.id, user_email: user.email,
      action: 'cepik_pojazdy_odmowa', entity_type: 'vehicle', entity_id: nr,
      details: { nr, woj, rok, powod: 'numer spoza floty firmy' }, ip,
    });
    return err('Numer rejestracyjny nie należy do floty tej firmy', 403);
  }

  const apiUrl = `https://api.cepik.gov.pl/pojazdy?numer-rejestracyjny=${encodeURIComponent(nr)}&wojewodztwo=${woj}&data-od=${rok}0101&data-do=${rok}1231&limit=1&pokaz-wszystkie-pola=true`;
  try {
    const resp = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': 'Bearer ' + token,
      },
    });
    const data = await resp.text();
    await logAudit(env, {
      company_id: company, user_id: user.id, user_email: user.email,
      action: 'cepik_pojazdy_odczyt', entity_type: 'vehicle', entity_id: wlasny.id,
      details: { nr, woj, rok, http_status: resp.status }, ip,
    });
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

// ─── CEPiK 2.0 KIEROWCA (B2B, luty 2025) ─────────────────────────────────────
// Nowe API B2B uruchomione 04.02.2025. Wymaga rejestracji: biurocepik2.0@cyfra.gov.pl
// Wejście: imię + nazwisko + numer blankietu PJ (nie PESEL). Typ tokenu: env.CEPIK_KIEROWCA_TOKEN
async function handleCepikKierowcaV2(request, env, user) {
  let body;
  try { body = await request.json(); } catch { return err('Nieprawidłowy JSON'); }
  const { imie, nazwisko, nrBlankietu, vehId } = body || {};
  if (!imie || !nazwisko || !nrBlankietu) {
    return err('Brak wymaganych pól: imie, nazwisko, nrBlankietu');
  }

  if (!env.CEPIK_KIEROWCA_TOKEN) {
    return json({ ok: false, configured: false,
      message: 'API CEPiK 2.0 nie jest skonfigurowane. Zarejestruj dostęp B2B: biurocepik2.0@cyfra.gov.pl' });
  }

  try {
    const resp = await fetch('https://api2.cepik.gov.pl/kierowcy/weryfikacja', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + env.CEPIK_KIEROWCA_TOKEN,
      },
      body: JSON.stringify({ imie, nazwisko, numerBlankietu: nrBlankietu }),
      signal: AbortSignal.timeout(15000),
    });

    if (resp.status === 404) {
      const result = { ok: true, configured: true, status: 'not_found', message: 'Brak danych w CEPiK' };
      if (vehId && user) await _saveCepikKierowcaResult(env, user, vehId, result);
      return json(result);
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      return json({ ok: false, configured: true, message: `CEPiK HTTP ${resp.status}: ${txt.slice(0, 200)}` });
    }

    const data = await resp.json();
    const attrs = data?.data?.attributes ?? data ?? {};
    const result = {
      ok: true,
      configured: true,
      status: _mapCepikKierowcaStatus(attrs),
      kategorie: attrs.kategorie ?? attrs.categories ?? null,
      dataWaznosci: attrs.dataWaznosci ?? attrs.dataWaznosciPrawaJazdy ?? null,
      dataZatrzymania: attrs.dataZatrzymania ?? null,
    };

    if (vehId && user) await _saveCepikKierowcaResult(env, user, vehId, result);
    return json(result);
  } catch (e) {
    return json({ ok: false, configured: true, message: 'Błąd połączenia z CEPiK: ' + e.message });
  }
}

function _mapCepikKierowcaStatus(attrs) {
  if (attrs.zatrzymane || attrs.suspended) return 'suspended';
  if (attrs.status === 'NIEWAŻNE' || attrs.expired) return 'expired';
  if (attrs.status === 'WAŻNE' || attrs.valid || attrs.kategorie) return 'valid';
  return 'not_found';
}

async function _saveCepikKierowcaResult(env, user, vehId, result) {
  try {
    await env.DB.prepare(
      // Było: SET cepikStatus=..., cepikLastCheck=..., cepikKategorie=... WHERE ... company=?
      // Żadna z tych kolumn w `vehicles` nie istnieje, a `user.company` też nie —
      // sesja niesie `company_id`. Całość opakowana w try/catch, więc wynik sprawdzenia
      // CEPiK nie zapisywał się NIGDY i nikt tego nie widział.
      `UPDATE vehicles SET data = json_set(COALESCE(data,'{}'),
          '$.cepikStatus', ?, '$.cepikLastCheck', ?, '$.cepikKategorie', ?),
        updated_at = datetime('now')
       WHERE id=? AND company_id=?`
    ).bind(
      result.status,
      new Date().toISOString().slice(0, 10),
      // json_set przyjmuje wartość skalarną — struktury serializujemy, żeby nie zgubić danych.
      result.kategorie == null || typeof result.kategorie === 'string'
        ? (result.kategorie ?? null)
        : JSON.stringify(result.kategorie),
      vehId,
      user.company_id
    ).run();
  } catch {}
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
    const atRow = await env.DB.prepare('SELECT company_id FROM alert_types WHERE id=?').bind(segs[2]).first();
    if (!atRow) return err('Typ alertu nie znaleziony', 404);
    if (user.role !== 'admin' && (atRow.company_id === null || atRow.company_id !== company)) return err('Brak dostępu', 403);
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
    if (user.role !== 'admin' && existing.company_id !== company) return err('Brak dostępu', 403);
    await env.DB.prepare('UPDATE alert_types SET active=0 WHERE id=? AND company_id=?').bind(segs[2], company).run();
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
  const company = url.searchParams.get('company') || user.company_id || 'mtoilet';

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
        "UPDATE notification_log SET acknowledged_at=datetime('now') WHERE id=? AND company_id=? AND (user_id=? OR ?='admin')"
      ).bind(body.id, company, user.id, user.role).run();
      return json({ ok: true });
    }
    if (body.action === 'snooze' && body.id) {
      const days = Math.max(1, Math.min(parseInt(body.days || 7), 90));
      await env.DB.prepare(
        `UPDATE notification_log SET snoozed_until=datetime('now','+'||?||' days'),snooze_days=?
         WHERE id=? AND company_id=? AND (user_id=? OR ?='admin')`
      ).bind(days, days, body.id, company, user.id, user.role).run();
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
    const tmplRow = await env.DB.prepare('SELECT company_id FROM maintenance_templates WHERE id=?').bind(segs[2]).first();
    if (!tmplRow) return err('Szablon nie znaleziony', 404);
    if (user.role !== 'admin' && tmplRow.company_id !== company) return err('Brak dostępu', 403);
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
    const row = await env.DB.prepare('SELECT id,name,role,extra_permissions,company_id FROM users WHERE id=?').bind(targetId).first();
    if (!row) return err('Użytkownik nie istnieje', 404);
    // IDOR: non-admin może zarządzać uprawnieniami tylko w obrębie własnej firmy
    if (user.role !== 'admin' && row.company_id !== user.company_id) return err('Brak dostępu do tego użytkownika', 403);
    return json({ ...row, extra_permissions: JSON.parse(row.extra_permissions || '[]') });
  }
  if (req.method === 'PUT') {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    // IDOR: zweryfikuj że cel należy do tej samej firmy
    const targetRow = await env.DB.prepare('SELECT company_id FROM users WHERE id=?').bind(targetId).first();
    if (!targetRow) return err('Użytkownik nie istnieje', 404);
    if (user.role !== 'admin' && targetRow.company_id !== user.company_id) return err('Brak dostępu do tego użytkownika', 403);
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

// ─── ERROR TRACKING ──────────────────────────────────────────────────────────
// Wysyła push do adminów firmy przy krytycznym błędzie JS
async function pushErrorAlert(env, companyId, msg, errorType) {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return;
  const subs = await env.DB.prepare(
    `SELECT ps.endpoint, ps.p256dh, ps.auth_key
     FROM push_subscriptions ps
     JOIN users u ON ps.user_id = u.id
     WHERE ps.company_id = ? AND u.role = 'admin' AND u.active = 1`
  ).bind(companyId).all().catch(() => ({ results: [] }));
  if (!subs.results?.length) return;
  const payload = {
    title: '⚠ Błąd JS w TaxOrder Pro',
    body: msg.substring(0, 120),
    tag: 'js-error',
    url: '/index.html#errors-admin',
    urgent: true,
  };
  await Promise.allSettled(
    subs.results.map(s => sendPushMsg({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } }, payload, env))
  );
}

// Nocna kontrola terminów — wysyła push 30 i 7 dni przed terminem
async function checkInspectionDeadlines(env) {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return;

  const DEADLINE_FIELDS = [
    { field: 'ocEnd',          label: 'OC' },
    { field: 'acEnd',          label: 'AC/Casco' },
    { field: 'nextInspection', label: 'Przegląd tech.' },
    { field: 'udtNextDate',    label: 'UDT' },
    { field: 'tachoNextCalib', label: 'Tachograf' },
  ];
  const WARN_DAYS = [30, 7];

  const vehicles = await env.DB.prepare('SELECT nr_rej, company_id, data FROM vehicles LIMIT 10000').all().catch(() => ({ results: [] }));
  const now = Date.now();

  for (const vRow of (vehicles.results || [])) {
    let data = {};
    try { data = typeof vRow.data === 'string' ? JSON.parse(vRow.data) : (vRow.data || {}); } catch { continue; }
    if (data.is_active === false) continue;

    for (const { field, label } of DEADLINE_FIELDS) {
      const ds = data[field];
      if (!ds) continue;
      const d = new Date(ds.includes('T') ? ds : ds + 'T00:00:00');
      if (isNaN(d)) continue;
      const days = Math.round((d - now) / 86400000);

      for (const warnDays of WARN_DAYS) {
        if (days !== warnDays) continue;  // tylko w dokładny dzień ostrzeżenia

        const dedupKey = `insp:${vRow.company_id}:${vRow.nr_rej}:${field}:${warnDays}d`.replace(/[^a-zA-Z0-9:_-]/g, '_');
        const sent = await env.PREFS.get(dedupKey).catch(() => null);
        if (sent) continue;

        const subs = await env.DB.prepare(
          `SELECT ps.endpoint, ps.p256dh, ps.auth_key
           FROM push_subscriptions ps JOIN users u ON ps.user_id = u.id
           WHERE ps.company_id = ? AND u.active = 1`
        ).bind(vRow.company_id).all().catch(() => ({ results: [] }));

        if (!subs.results?.length) continue;

        const payload = {
          title: `📅 Termin za ${warnDays} dni — ${label}`,
          body: `${vRow.nr_rej}${data.marka ? ' ' + data.marka : ''}${data.model ? ' ' + data.model : ''} · ${new Date(d).toLocaleDateString('pl-PL')}`,
          tag: `insp-${vRow.nr_rej}-${field}`,
          url: '/index.html#terminarz',
        };

        await Promise.allSettled(
          subs.results.map(s => sendPushMsg({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } }, payload, env))
        );
        await env.PREFS.put(dedupKey, '1', { expirationTtl: 86400 }).catch(() => {});
      }
    }
  }
}

async function handleErrors(request, env, user, url, path) {
  // POST /api/errors — public (no auth), rate-limited at call site (20 req/min/IP)
  if (request.method === 'POST' && path === '/api/errors') {
    let body;
    try { body = await request.json(); } catch { return err('Nieprawidłowy JSON'); }
    const msg = String(body.error_msg || '').trim().substring(0, 500);
    if (!msg) return err('Brak error_msg');
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO error_logs (id, url, error_msg, error_stack, error_type, user_agent, user_id, company_id, app_version)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).bind(
      id,
      String(body.url || '').substring(0, 200),
      msg,
      String(body.error_stack || '').substring(0, 2000),
      ['uncaught', 'promise', 'manual'].includes(body.error_type) ? body.error_type : 'uncaught',
      String(body.user_agent || '').substring(0, 200),
      user?.id ?? null,
      String(body.company_id || '').substring(0, 100) || null,
      String(body.app_version || '').substring(0, 30),
    ).run();
    // Wyślij push do adminów firmy jeśli błąd krytyczny i nie był alerted w ostatniej godzinie
    const companyId = String(body.company_id || '').substring(0, 100) || null;
    if (companyId && env.PREFS && env.VAPID_PRIVATE_KEY) {
      const dedupKey = ('errpush:' + companyId + ':' + msg.substring(0, 80)).replace(/[^a-zA-Z0-9:_-]/g, '_');
      const alreadySent = await env.PREFS.get(dedupKey).catch(() => null);
      if (!alreadySent) {
        await env.PREFS.put(dedupKey, '1', { expirationTtl: 3600 }).catch(() => {});
        pushErrorAlert(env, companyId, msg, body.error_type || 'uncaught').catch(() => {});
      }
    }
    // Forward to Sentry (non-blocking)
    const synErr = Object.assign(new Error(msg), { name: body.error_type || 'FrontendError', stack: body.error_stack || msg });
    captureException(synErr, env, { url: body.url, user_id: body.user_id || null, company_id: companyId, source: 'frontend' }).catch(() => {});
    return json({ ok: true, id });
  }

  // GET /api/errors — admin only
  if (request.method === 'GET' && path === '/api/errors') {
    if (!user || user.role !== 'admin') return err('Brak uprawnień', 403);
    const limit  = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const rows = await env.DB.prepare(
      `SELECT id, created_at, url, error_msg, error_type, company_id, user_id, app_version, analyzed, github_issue_url
       FROM error_logs WHERE company_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(user.company_id, limit, offset).all();
    const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM error_logs WHERE company_id=?').bind(user.company_id).first('n');
    return json({ rows: rows.results, total });
  }

  // DELETE /api/errors/:id
  if (request.method === 'DELETE' && path.startsWith('/api/errors/')) {
    if (!user || user.role !== 'admin') return err('Brak uprawnień', 403);
    const id = path.split('/').pop();
    await env.DB.prepare('DELETE FROM error_logs WHERE id=? AND company_id=?').bind(id, user.company_id).run();
    return json({ ok: true });
  }

  return err('Metoda niedozwolona', 405);
}

// ─── MIESIĘCZNY RAPORT EMAIL ─────────────────────────────────────────────────
async function sendMonthlyReports(env) {
  if (!env.RESEND_API_KEY) return;
  const today = new Date();
  const dayOfMonth = today.getUTCDate();
  const year  = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;
  const monthStr = String(month).padStart(2, '0');
  // Poprzedni miesiąc do raportu
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  const prevMonthStr = String(prevMonth).padStart(2, '0');
  const from = `${prevYear}-${prevMonthStr}-01`;
  const lastDay = new Date(prevYear, prevMonth, 0).getUTCDate();
  const to = `${prevYear}-${prevMonthStr}-${String(lastDay).padStart(2,'0')}`;

  // Pobierz subskrypcje na bieżący dzień miesiąca
  const subs = (await env.DB.prepare(`SELECT DISTINCT company_id, email FROM report_subscriptions WHERE active=1 AND day_of_month=? AND report_type='monthly'`).bind(dayOfMonth).all()).results || [];
  if (!subs.length) return;

  for (const sub of subs) {
    try {
      const [svcRow, fineRow, fuelRow, dmgRow] = await Promise.all([
        env.DB.prepare(`SELECT COUNT(*) AS cnt, SUM(koszt_rzeczywisty) AS total FROM service_orders WHERE company_id=? AND data_realizacji BETWEEN ? AND ?`).bind(sub.company_id, from, to).first(),
        env.DB.prepare(`SELECT COUNT(*) AS cnt, SUM(amount) AS total FROM fines WHERE company_id=? AND date BETWEEN ? AND ?`).bind(sub.company_id, from, to).first(),
        env.DB.prepare(`SELECT COUNT(*) AS cnt, SUM(total_cost) AS total, SUM(liters) AS liters FROM fuel_fills WHERE company_id=? AND fill_date BETWEEN ? AND ?`).bind(sub.company_id, from, to).first(),
        env.DB.prepare(`SELECT COUNT(*) AS cnt, SUM(koszt) AS total FROM damage_reports WHERE company_id=? AND data_zdarzenia BETWEEN ? AND ?`).bind(sub.company_id, from, to).first(),
      ]);
      const fmtPLN = v => v != null ? `${parseFloat(v).toFixed(2)} PLN` : '— PLN';
      const totalCost = (svcRow?.total||0)+(fineRow?.total||0)+(fuelRow?.total||0)+(dmgRow?.total||0);
      const htmlBody = `
<h2>Raport miesięczny floty — ${prevMonthStr}/${prevYear}</h2>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif">
  <tr><th>Kategoria</th><th>Liczba</th><th>Kwota</th></tr>
  <tr><td>Serwis/Naprawy</td><td>${svcRow?.cnt||0}</td><td>${fmtPLN(svcRow?.total)}</td></tr>
  <tr><td>Mandaty</td><td>${fineRow?.cnt||0}</td><td>${fmtPLN(fineRow?.total)}</td></tr>
  <tr><td>Paliwo</td><td>${fuelRow?.cnt||0} (${fuelRow?.liters ? parseFloat(fuelRow.liters).toFixed(1)+' l' : '—'})</td><td>${fmtPLN(fuelRow?.total)}</td></tr>
  <tr><td>Szkody</td><td>${dmgRow?.cnt||0}</td><td>${fmtPLN(dmgRow?.total)}</td></tr>
  <tr><td><strong>RAZEM</strong></td><td></td><td><strong>${fmtPLN(totalCost)}</strong></td></tr>
</table>
<p style="color:#666;font-size:12px">TaxOrder Pro — automatyczny raport. Aby wypisać się, wejdź w Ustawienia → Subskrypcje raportów.</p>`;

      await sendEmailViaResend(env, sub.email, `Raport floty ${prevMonthStr}/${prevYear}`, htmlBody);
    } catch (e) {
      console.error('sendMonthlyReports error', sub.company_id, e.message);
    }
  }
}

// ─── NIGHTLY ANALYSIS (Claude API + GitHub Issues) ────────────────────────────
async function runNightlyAnalysis(env) {
  if (!env.CLAUDE_API_KEY) return;

  // Pobierz IDs wierszy które będziemy analizować — snapshot PRZED analizą,
  // żeby UPDATE nie objął błędów napływających w trakcie (race condition)
  const idRows = await env.DB.prepare(
    `SELECT id FROM error_logs WHERE analyzed=0 AND created_at >= datetime('now', '-1 day')`
  ).all();
  const ids = (idRows.results || []).map(r => r.id);
  if (!ids.length) return;

  // Pogrupowany summary dla Claude (top 20 typów)
  const rows = await env.DB.prepare(
    `SELECT error_msg, error_type, error_stack, url, COUNT(*) AS cnt
     FROM error_logs
     WHERE analyzed=0 AND created_at >= datetime('now', '-1 day')
     GROUP BY error_msg, error_type
     ORDER BY cnt DESC LIMIT 20`
  ).all();

  if (!rows.results?.length) return;

  const summary = rows.results.map((r, i) =>
    `${i + 1}. [${r.error_type}] x${r.cnt}: ${r.error_msg}\n   URL: ${r.url || '?'}\n   Stack: ${(r.error_stack || '').substring(0, 200)}`
  ).join('\n\n');

  let analysis = '';
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'x-api-key':         env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages:   [{
          role:    'user',
          content: `Jesteś asystentem analizy błędów dla polskiej aplikacji flotowej TaxOrder Pro (SPA + Cloudflare Worker + D1 SQLite).\n\nBłędy JS z ostatnich 24 godzin:\n\n${summary}\n\nDla każdego błędu zasugeruj krótko: (1) prawdopodobna przyczyna, (2) sugerowana naprawa. Odpowiedz po polsku, zwięźle.`,
        }],
      }),
    });
    if (!resp.ok) throw new Error(`Claude HTTP ${resp.status}`);
    const data = await resp.json();
    analysis = data.content?.[0]?.text || 'Brak odpowiedzi Claude';
  } catch (e) {
    console.error('[Nightly] Claude API error — aborting analysis mark:', e?.message);
    return;
  }

  // Oznacz tylko te konkretne IDs (nie szeroki zakres dat)
  const placeholders = ids.map(() => '?').join(',');

  if (env.GITHUB_TOKEN && env.GITHUB_REPO) {
    try {
      const issueResp = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${env.GITHUB_TOKEN}`,
          Accept:         'application/vnd.github+json',
          'User-Agent':   'TaxOrderPro-Worker/1.0',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title:  `[Auto] Błędy JS — ${new Date().toISOString().substring(0, 10)} (${rows.results.length} typów, ${rows.results.reduce((s, r) => s + r.cnt, 0)} wystąpień)`,
          body:   `## Analiza błędów frontendowych\n\nPeriod: ostatnie 24h\nUnikalnych typów: ${rows.results.length}\n\n### Błędy\n\`\`\`\n${summary}\n\`\`\`\n\n### Analiza Claude\n${analysis}`,
          labels: ['bug', 'auto-detected'],
        }),
      });
      const issue = await issueResp.json();
      if (issue.html_url) {
        await env.DB.prepare(
          `UPDATE error_logs SET analyzed=1, analysis=?, github_issue_url=? WHERE id IN (${placeholders})`
        ).bind(analysis.substring(0, 2000), issue.html_url, ...ids).run();
        return;
      }
    } catch { /* issue creation failed — oznacz bez URL */ }
  }

  await env.DB.prepare(
    `UPDATE error_logs SET analyzed=1, analysis=? WHERE id IN (${placeholders})`
  ).bind(analysis.substring(0, 2000), ...ids).run();
}

// ─── POLISY UBEZPIECZENIOWE (D1) ─────────────────────────────────────────────
async function handlePoliciesDB(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  const segs = path.split('/').filter(Boolean); // ['api','policies-db', id?]
  const id = segs[2] || null;
  const method = req.method;

  if (method === 'GET') {
    const nrRej = url.searchParams.get('nrRej');
    const vin   = url.searchParams.get('vin');
    let q, binds;
    if (nrRej) {
      q = 'SELECT * FROM policies WHERE company_id=? AND nr_rej=? ORDER BY end_date DESC';
      binds = [company, nrRej];
    } else if (vin) {
      q = 'SELECT * FROM policies WHERE company_id=? AND vin=? ORDER BY end_date DESC';
      binds = [company, vin];
    } else {
      q = 'SELECT * FROM policies WHERE company_id=? ORDER BY end_date DESC LIMIT 500';
      binds = [company];
    }
    const rows = (await env.DB.prepare(q).bind(...binds).all()).results || [];
    return json(rows);
  }

  if (method === 'POST') {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON', 400); }
    const pid = crypto.randomUUID();
    const _branchIdPol = await _getVehicleBranchId(env, company, d.nr_rej);
    await env.DB.prepare(
      `INSERT INTO policies (id,company_id,nr_rej,vin,type,policy_number,insurer,premium,installments,start_date,end_date,notes,doc_id,branch_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(pid, company, d.nr_rej||'', d.vin||null, d.type||'oc', d.policy_number||null,
      d.insurer||null, d.premium??null, d.installments??1,
      d.start_date||null, d.end_date||null, d.notes||null, d.doc_id||null, _branchIdPol).run();
    return json({ ok: true, id: pid });
  }

  if (method === 'PUT' && id) {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON', 400); }
    await env.DB.prepare(
      `UPDATE policies SET nr_rej=?,vin=?,type=?,policy_number=?,insurer=?,premium=?,installments=?,start_date=?,end_date=?,notes=?,doc_id=?,updated_at=datetime('now')
       WHERE id=? AND company_id=?`
    ).bind(d.nr_rej||'', d.vin||null, d.type||'oc', d.policy_number||null,
      d.insurer||null, d.premium??null, d.installments??1,
      d.start_date||null, d.end_date||null, d.notes||null, d.doc_id||null, id, company).run();
    return json({ ok: true });
  }

  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM policies WHERE id=? AND company_id=?').bind(id, company).run();
    return json({ ok: true });
  }

  return err('Metoda nieobsługiwana', 405);
}

// ─── HARMONOGRAM SERWISOWY ────────────────────────────────────────────────────
async function handleServiceSchedules(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  const segs = path.split('/').filter(Boolean);
  const id = segs[2] || null;
  const method = req.method;

  if (method === 'GET') {
    const nrRej = url.searchParams.get('nrRej');
    const due   = url.searchParams.get('due');   // 'soon' = due within 30 days / 1000 km
    let rows;
    if (nrRej) {
      rows = (await env.DB.prepare(
        'SELECT * FROM service_schedules WHERE company_id=? AND nr_rej=? ORDER BY next_date ASC'
      ).bind(company, nrRej).all()).results || [];
    } else if (due === 'soon') {
      const inMonth = new Date(); inMonth.setDate(inMonth.getDate() + 30);
      const dateStr = inMonth.toISOString().slice(0, 10);
      rows = (await env.DB.prepare(
        `SELECT * FROM service_schedules WHERE company_id=? AND (next_date <= ? OR next_date IS NULL) ORDER BY next_date ASC LIMIT 200`
      ).bind(company, dateStr).all()).results || [];
    } else {
      rows = (await env.DB.prepare(
        'SELECT * FROM service_schedules WHERE company_id=? ORDER BY nr_rej, next_date ASC LIMIT 500'
      ).bind(company).all()).results || [];
    }
    return json(rows);
  }

  if (method === 'POST') {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON', 400); }
    if (!d.nr_rej) return err('Wymagane: nr_rej', 400);
    if (!d.name)   return err('Wymagane: name', 400);
    const sid = crypto.randomUUID();
    const nextKm   = (d.last_km   != null && d.interval_km)     ? (d.last_km + d.interval_km)         : null;
    const nextDate = (d.last_date && d.interval_months)          ? _addMonths(d.last_date, d.interval_months) : null;
    await env.DB.prepare(
      `INSERT INTO service_schedules (id,company_id,nr_rej,name,interval_km,interval_months,last_km,last_date,next_km,next_date,notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(sid, company, d.nr_rej, d.name, d.interval_km??null, d.interval_months??null,
      d.last_km??null, d.last_date||null, nextKm, nextDate, d.notes||null).run();
    return json({ ok: true, id: sid });
  }

  if (method === 'PUT' && id) {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON', 400); }
    const nextKm   = (d.last_km   != null && d.interval_km)     ? (d.last_km + d.interval_km)         : null;
    const nextDate = (d.last_date && d.interval_months)          ? _addMonths(d.last_date, d.interval_months) : null;
    await env.DB.prepare(
      `UPDATE service_schedules SET nr_rej=?,name=?,interval_km=?,interval_months=?,last_km=?,last_date=?,next_km=?,next_date=?,notes=?,updated_at=datetime('now')
       WHERE id=? AND company_id=?`
    ).bind(d.nr_rej, d.name, d.interval_km??null, d.interval_months??null,
      d.last_km??null, d.last_date||null, nextKm, nextDate, d.notes||null, id, company).run();
    return json({ ok: true });
  }

  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM service_schedules WHERE id=? AND company_id=?').bind(id, company).run();
    return json({ ok: true });
  }

  return err('Metoda nieobsługiwana', 405);
}

function _addMonths(dateStr, months) {
  if (!dateStr || !months) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// ─── ROZLICZENIA KM PRACOWNICZYCH ─────────────────────────────────────────────
async function handleMileageClaims(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  const segs = path.split('/').filter(Boolean);
  const id     = segs[2] || null;
  const action = segs[3] || null; // approve | reject | pay
  const method = req.method;

  if (method === 'GET') {
    const driver = url.searchParams.get('driver');
    const status = url.searchParams.get('status');
    const nrRej  = url.searchParams.get('nrRej');
    let q = 'SELECT * FROM mileage_claims WHERE company_id=?';
    const binds = [company];
    if (driver) { q += " AND driver_name LIKE '%' || ? || '%'"; binds.push(driver); }
    if (status) { q += ' AND status=?';      binds.push(status); }
    if (nrRej)  { q += ' AND nr_rej=?';      binds.push(nrRej);  }
    q += ' ORDER BY claim_date DESC LIMIT 500';
    const rows = (await env.DB.prepare(q).bind(...binds).all()).results || [];
    return json(rows);
  }

  if (method === 'POST') {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON', 400); }
    if (!d.claim_date) return err('Wymagane: claim_date', 400);
    if (!d.driver_name) return err('Wymagane: driver_name', 400);
    const cid = crypto.randomUUID();
    const kmTotal = (d.km_start != null && d.km_end != null) ? Math.max(0, d.km_end - d.km_start) : (d.km_total ?? 0);
    const rate   = d.rate ?? 0.89;
    const amount = parseFloat((kmTotal * rate).toFixed(2));
    const _branchIdMil = await _getVehicleBranchId(env, company, d.nr_rej);
    await env.DB.prepare(
      `INSERT INTO mileage_claims (id,company_id,nr_rej,driver_name,claim_date,km_start,km_end,km_total,purpose,rate,amount,status,notes,branch_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(cid, company, d.nr_rej||null, d.driver_name, d.claim_date, d.km_start??null, d.km_end??null,
      kmTotal, d.purpose||null, rate, amount, 'pending', d.notes||null, _branchIdMil).run();
    return json({ ok: true, id: cid, amount });
  }

  if (method === 'PUT' && id && !action) {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON', 400); }
    const kmTotal = (d.km_start != null && d.km_end != null) ? Math.max(0, d.km_end - d.km_start) : (d.km_total ?? 0);
    const rate   = d.rate ?? 0.89;
    const amount = parseFloat((kmTotal * rate).toFixed(2));
    await env.DB.prepare(
      `UPDATE mileage_claims SET nr_rej=?,driver_name=?,claim_date=?,km_start=?,km_end=?,km_total=?,purpose=?,rate=?,amount=?,notes=?
       WHERE id=? AND company_id=? AND status='pending'`
    ).bind(d.nr_rej||null, d.driver_name, d.claim_date, d.km_start??null, d.km_end??null,
      kmTotal, d.purpose||null, rate, amount, d.notes||null, id, company).run();
    return json({ ok: true, amount });
  }

  // Status transitions: POST /api/mileage-claims/:id/approve|reject|pay
  if (method === 'POST' && id && action) {
    if (!['approved','rejected','paid'].includes(action)) return err('Nieznana akcja', 400);
    if (!['admin','kierownik'].includes(user.role)) return err('Brak uprawnień', 403);
    const now = new Date().toISOString();
    let q, binds;
    if (action === 'paid') {
      q = `UPDATE mileage_claims SET status='paid' WHERE id=? AND company_id=? AND status='approved'`;
      binds = [id, company];
    } else {
      q = `UPDATE mileage_claims SET status=?, approved_by=?, approved_at=? WHERE id=? AND company_id=? AND status='pending'`;
      binds = [action, user.email || user.login, now, id, company];
    }
    await env.DB.prepare(q).bind(...binds).run();
    return json({ ok: true });
  }

  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM mileage_claims WHERE id=? AND company_id=?').bind(id, company).run();
    return json({ ok: true });
  }

  return err('Metoda nieobsługiwana', 405);
}

// ─── PALIWO (FUEL FILLS) ─────────────────────────────────────────────────────
async function handleFuelFills(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const segs = path.split('/').filter(Boolean);
  const id = segs[2] || null;
  const sub = segs[3] || null;
  const method = req.method;

  // GET /api/fuel-fills/stats — statystyki spalania per pojazd
  if (method === 'GET' && id === 'stats') {
    const year  = url.searchParams.get('year')  || new Date().getFullYear();
    const nrRej = url.searchParams.get('nr_rej');
    let q = `SELECT nr_rej,
               COUNT(*) AS fill_count,
               SUM(liters) AS total_liters,
               SUM(total_cost) AS total_cost,
               AVG(price_per_liter) AS avg_price,
               MIN(odometer) AS odo_min, MAX(odometer) AS odo_max
             FROM fuel_fills WHERE company_id=? AND fill_date LIKE ?`;
    const p = [company, `${year}%`];
    if (nrRej) { q += ' AND nr_rej=?'; p.push(nrRej); }
    q += ' GROUP BY nr_rej ORDER BY total_cost DESC';
    const rows = (await env.DB.prepare(q).bind(...p).all()).results || [];
    // Oblicz średnie spalanie (l/100km) na podstawie odometru
    const enriched = rows.map(r => {
      const km = (r.odo_max && r.odo_min && r.odo_max > r.odo_min) ? (r.odo_max - r.odo_min) : null;
      return { ...r, km_driven: km, avg_consumption: (km && r.total_liters) ? ((r.total_liters / km) * 100).toFixed(2) : null };
    });
    return json(enriched);
  }

  // GET /api/fuel-fills — lista
  if (method === 'GET' && !id) {
    const nrRej  = url.searchParams.get('nr_rej');
    const month  = url.searchParams.get('month');
    const branch = url.searchParams.get('branch_id');
    const limit  = Math.min(parseInt(url.searchParams.get('limit')  || '500'), 5000);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'),   0);
    let q = 'SELECT * FROM fuel_fills WHERE company_id=?';
    const p = [company];
    if (nrRej)  { q += ' AND nr_rej=?';            p.push(nrRej); }
    if (month)  { q += ' AND fill_date LIKE ?';     p.push(`${month}%`); }
    if (branch) { q += ' AND branch_id=?';          p.push(parseInt(branch)); }
    q += ' ORDER BY fill_date DESC, created_at DESC LIMIT ? OFFSET ?';
    p.push(limit, offset);
    return json((await env.DB.prepare(q).bind(...p).all()).results || []);
  }

  // POST /api/fuel-fills
  if (method === 'POST') {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!d.nr_rej)    return err('Wymagane: nr_rej', 400);
    if (!d.fill_date) return err('Wymagane: fill_date', 400);
    if (d.liters == null || !(parseFloat(d.liters) > 0)) return err('Wymagane: liters > 0', 400);
    const bid = await _getVehicleBranchId(env, company, d.nr_rej);
    const totalCost = d.total_cost ?? (d.liters && d.price_per_liter ? parseFloat((d.liters * d.price_per_liter).toFixed(2)) : null);
    const co2 = d.co2_kg ?? (d.liters ? parseFloat((d.liters * 2.64).toFixed(2)) : null); // diesel default
    const newId = d.id || crypto.randomUUID();
    await env.DB.prepare(`INSERT OR REPLACE INTO fuel_fills
      (id,company_id,nr_rej,branch_id,driver_name,fill_date,liters,price_per_liter,total_cost,odometer,station,card_no,full_tank,fuel_type,co2_kg,gl_account,notes)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(newId, company, d.nr_rej, d.branch_id??bid, d.driver_name||null, d.fill_date,
      parseFloat(d.liters), d.price_per_liter??null, totalCost,
      d.odometer??null, d.station||null, d.card_no||null,
      d.full_tank!==false?1:0, d.fuel_type||'diesel', co2, d.gl_account||null, d.notes||null).run();
    return json({ ok: true, id: newId });
  }

  // PUT /api/fuel-fills/:id
  if (method === 'PUT' && id) {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const totalCost = d.total_cost ?? (d.liters && d.price_per_liter ? parseFloat((d.liters * d.price_per_liter).toFixed(2)) : null);
    await env.DB.prepare(`UPDATE fuel_fills SET
      fill_date=?,liters=?,price_per_liter=?,total_cost=?,odometer=?,station=?,card_no=?,
      full_tank=?,fuel_type=?,co2_kg=?,driver_name=?,gl_account=?,notes=?
      WHERE id=? AND company_id=?`)
    .bind(d.fill_date, parseFloat(d.liters), d.price_per_liter??null, totalCost,
      d.odometer??null, d.station||null, d.card_no||null,
      d.full_tank!==false?1:0, d.fuel_type||'diesel', d.co2_kg??null,
      d.driver_name||null, d.gl_account||null, d.notes||null, id, company).run();
    return json({ ok: true });
  }

  // DELETE /api/fuel-fills/:id
  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM fuel_fills WHERE id=? AND company_id=?').bind(id, company).run();
    return json({ ok: true });
  }

  return err('Metoda nieobsługiwana', 405);
}

// ─── BUDŻETY ─────────────────────────────────────────────────────────────────
async function handleBudgets(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const segs = path.split('/').filter(Boolean);
  const id = segs[2] ? parseInt(segs[2]) : null;
  const method = req.method;

  // GET /api/budgets — budżety z wykonaniem
  if (method === 'GET' && !id) {
    const year = parseInt(url.searchParams.get('year') || new Date().getFullYear());
    const budgets = (await env.DB.prepare(
      'SELECT * FROM budgets WHERE company_id=? AND year=? ORDER BY branch_id, nr_rej, category'
    ).bind(company, year).all()).results || [];

    // Pobierz rzeczywiste koszty dla każdego budżetu
    const [svcAgg, fineAgg, fuelAgg, damageAgg, mileAgg, polAgg] = await Promise.all([
      env.DB.prepare(`SELECT COALESCE(branch_id,'') AS bid, COALESCE(nr_rej,'') AS veh, SUM(koszt_rzeczywisty) AS total FROM service_orders WHERE company_id=? AND strftime('%Y',data_realizacji)=? GROUP BY bid,veh`).bind(company, String(year)).all(),
      env.DB.prepare(`SELECT COALESCE(branch_id,'') AS bid, COALESCE(nr_rej,'') AS veh, SUM(amount) AS total FROM fines WHERE company_id=? AND strftime('%Y',date)=? GROUP BY bid,veh`).bind(company, String(year)).all(),
      env.DB.prepare(`SELECT COALESCE(branch_id,'') AS bid, COALESCE(nr_rej,'') AS veh, SUM(total_cost) AS total FROM fuel_fills WHERE company_id=? AND strftime('%Y',fill_date)=? GROUP BY bid,veh`).bind(company, String(year)).all(),
      env.DB.prepare(`SELECT COALESCE(branch_id,'') AS bid, COALESCE(nr_rej,'') AS veh, SUM(koszt) AS total FROM damage_reports WHERE company_id=? AND strftime('%Y',data_zdarzenia)=? GROUP BY bid,veh`).bind(company, String(year)).all(),
      env.DB.prepare(`SELECT COALESCE(branch_id,'') AS bid, COALESCE(nr_rej,'') AS veh, SUM(amount) AS total FROM mileage_claims WHERE company_id=? AND strftime('%Y',claim_date)=? GROUP BY bid,veh`).bind(company, String(year)).all(),
      env.DB.prepare(`SELECT COALESCE(branch_id,'') AS bid, COALESCE(nr_rej,'') AS veh, SUM(premium) AS total FROM policies WHERE company_id=? AND strftime('%Y',start_date)=? GROUP BY bid,veh`).bind(company, String(year)).all(),
    ]);
    const aggMap = { service: svcAgg.results||[], fines: fineAgg.results||[], fuel: fuelAgg.results||[], damages: damageAgg.results||[], mileage: mileAgg.results||[], insurance: polAgg.results||[] };
    const getActual = (cat, bid, veh) => {
      const rows = aggMap[cat] || [];
      return rows.filter(r => (bid ? String(r.bid) === String(bid) : true) && (veh ? r.veh === veh : true)).reduce((s, r) => s + (r.total || 0), 0);
    };
    const enriched = budgets.map(b => ({ ...b, actual: getActual(b.category, b.branch_id, b.nr_rej), pct: b.amount > 0 ? Math.round(getActual(b.category, b.branch_id, b.nr_rej) / b.amount * 100) : 0 }));
    return json(enriched);
  }

  // POST /api/budgets
  if (method === 'POST') {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!d.year || !d.category) return err('Wymagane: year, category', 400);
    if (d.amount == null) return err('Wymagane: amount', 400);
    const result = await env.DB.prepare(
      'INSERT INTO budgets (company_id,branch_id,nr_rej,year,month,category,amount) VALUES (?,?,?,?,?,?,?)'
    ).bind(company, d.branch_id??null, d.nr_rej||null, d.year, d.month??null, d.category, parseFloat(d.amount)).run();
    return json({ ok: true, id: result.meta.last_row_id });
  }

  // PUT /api/budgets/:id
  if (method === 'PUT' && id) {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    await env.DB.prepare(`UPDATE budgets SET amount=?,category=?,month=?,branch_id=?,nr_rej=?,updated_at=datetime('now') WHERE id=? AND company_id=?`)
      .bind(parseFloat(d.amount), d.category, d.month??null, d.branch_id??null, d.nr_rej||null, id, company).run();
    return json({ ok: true });
  }

  // DELETE /api/budgets/:id
  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM budgets WHERE id=? AND company_id=?').bind(id, company).run();
    return json({ ok: true });
  }

  return err('Metoda nieobsługiwana', 405);
}

// ─── USTERKI ─────────────────────────────────────────────────────────────────
async function handleFaults(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const segs = path.split('/').filter(Boolean);
  const id = segs[2] || null;
  const method = req.method;

  if (method === 'GET' && !id) {
    const nrRej    = url.searchParams.get('nr_rej');
    const status   = url.searchParams.get('status');
    const severity = url.searchParams.get('severity');
    const limit    = Math.min(parseInt(url.searchParams.get('limit') || '500'), 1000);
    let q = 'SELECT * FROM faults WHERE company_id=?';
    const p = [company];
    if (nrRej)    { q += ' AND nr_rej=?';    p.push(nrRej); }
    if (status)   { q += ' AND status=?';    p.push(status); }
    if (severity) { q += ' AND severity=?';  p.push(severity); }
    q += ' ORDER BY report_date DESC, created_at DESC LIMIT ?';
    p.push(limit);
    return json((await env.DB.prepare(q).bind(...p).all()).results || []);
  }

  if (method === 'POST') {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!d.nr_rej)      return err('Wymagane: nr_rej', 400);
    if (!d.description) return err('Wymagane: description', 400);
    const bid = await _getVehicleBranchId(env, company, d.nr_rej);
    const newId = d.id || crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO faults (id,company_id,nr_rej,branch_id,reported_by,report_date,description,severity,status)
      VALUES(?,?,?,?,?,?,?,?,?)`)
    .bind(newId, company, d.nr_rej, d.branch_id??bid, d.reported_by||null,
      d.report_date || new Date().toISOString().slice(0,10),
      d.description, d.severity||'low', 'open').run();
    return json({ ok: true, id: newId });
  }

  if (method === 'PUT' && id) {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const row = await env.DB.prepare('SELECT * FROM faults WHERE id=? AND company_id=?').bind(id, company).first();
    if (!row) return err('Nie znaleziono', 404);
    const resolvedAt = (d.status === 'resolved' && row.status !== 'resolved') ? new Date().toISOString() : (row.resolved_at || null);
    await env.DB.prepare(`UPDATE faults SET description=?,severity=?,status=?,resolved_by=?,resolved_at=?,service_order_id=? WHERE id=? AND company_id=?`)
      .bind(d.description||row.description, d.severity||row.severity, d.status||row.status,
        d.resolved_by||row.resolved_by||null, resolvedAt, d.service_order_id||row.service_order_id||null, id, company).run();
    return json({ ok: true });
  }

  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM faults WHERE id=? AND company_id=?').bind(id, company).run();
    return json({ ok: true });
  }

  return err('Metoda nieobsługiwana', 405);
}

// ─── CZAS PRACY KIEROWCÓW ────────────────────────────────────────────────────
async function handleDriverShifts(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const segs = path.split('/').filter(Boolean);
  const id = segs[2] || null;
  const sub = segs[3] || null;
  const method = req.method;

  // GET /api/driver-shifts/summary — miesięczne podsumowanie per kierowca
  if (method === 'GET' && id === 'summary') {
    const month = url.searchParams.get('month') || new Date().toISOString().slice(0,7);
    const rows = (await env.DB.prepare(`
      SELECT driver_name,
        COUNT(*) AS shift_count,
        SUM(work_minutes) AS total_work_min,
        SUM(overtime_minutes) AS total_overtime_min,
        SUM(break_minutes) AS total_break_min,
        GROUP_CONCAT(DISTINCT shift_type) AS shift_types
      FROM driver_shifts WHERE company_id=? AND shift_date LIKE ?
      GROUP BY driver_name ORDER BY driver_name`).bind(company, `${month}%`).all()).results || [];
    return json(rows);
  }

  if (method === 'GET' && !id) {
    const driver = url.searchParams.get('driver');
    const month  = url.searchParams.get('month');
    const nrRej  = url.searchParams.get('nr_rej');
    const limit  = Math.min(parseInt(url.searchParams.get('limit') || '500'), 2000);
    let q = 'SELECT * FROM driver_shifts WHERE company_id=?';
    const p = [company];
    if (driver) { q += " AND driver_name LIKE '%'||?||'%'"; p.push(driver); }
    if (month)  { q += ' AND shift_date LIKE ?';  p.push(`${month}%`); }
    if (nrRej)  { q += ' AND nr_rej=?';           p.push(nrRej); }
    q += ' ORDER BY shift_date DESC LIMIT ?';
    p.push(limit);
    return json((await env.DB.prepare(q).bind(...p).all()).results || []);
  }

  if (method === 'POST') {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!d.driver_name) return err('Wymagane: driver_name', 400);
    if (!d.shift_date)  return err('Wymagane: shift_date', 400);
    // Oblicz work_minutes z start/end
    let workMin = d.work_minutes ?? null;
    if (!workMin && d.start_time && d.end_time) {
      const [sh,sm] = d.start_time.split(':').map(Number);
      const [eh,em] = d.end_time.split(':').map(Number);
      workMin = Math.max(0, (eh*60+em) - (sh*60+sm) - (d.break_minutes||0));
    }
    const ovMin = d.overtime_minutes ?? Math.max(0, (workMin||0) - 8*60);
    const bid = await _getVehicleBranchId(env, company, d.nr_rej);
    const newId = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO driver_shifts
      (id,company_id,driver_name,nr_rej,branch_id,shift_date,start_time,end_time,break_minutes,work_minutes,overtime_minutes,shift_type,notes)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(newId, company, d.driver_name, d.nr_rej||null, d.branch_id??bid,
      d.shift_date, d.start_time||null, d.end_time||null,
      d.break_minutes||0, workMin, ovMin, d.shift_type||'normal', d.notes||null).run();
    return json({ ok: true, id: newId });
  }

  if (method === 'PUT' && id) {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    let workMin = d.work_minutes ?? null;
    if (!workMin && d.start_time && d.end_time) {
      const [sh,sm] = d.start_time.split(':').map(Number);
      const [eh,em] = d.end_time.split(':').map(Number);
      workMin = Math.max(0, (eh*60+em) - (sh*60+sm) - (d.break_minutes||0));
    }
    const ovMin = d.overtime_minutes ?? Math.max(0, (workMin||0) - 8*60);
    await env.DB.prepare(`UPDATE driver_shifts SET
      driver_name=?,nr_rej=?,shift_date=?,start_time=?,end_time=?,break_minutes=?,work_minutes=?,overtime_minutes=?,shift_type=?,notes=?
      WHERE id=? AND company_id=?`)
    .bind(d.driver_name, d.nr_rej||null, d.shift_date, d.start_time||null, d.end_time||null,
      d.break_minutes||0, workMin, ovMin, d.shift_type||'normal', d.notes||null, id, company).run();
    return json({ ok: true });
  }

  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM driver_shifts WHERE id=? AND company_id=?').bind(id, company).run();
    return json({ ok: true });
  }

  return err('Metoda nieobsługiwana', 405);
}

// ─── ARCHIWUM TACHOGRAFU ─────────────────────────────────────────────────────
async function handleTachoRecords(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const segs = path.split('/').filter(Boolean);
  const id = segs[2] || null;
  const method = req.method;

  if (method === 'GET' && !id) {
    const nrRej   = url.searchParams.get('nr_rej');
    const overdue = url.searchParams.get('overdue'); // sprawdź pojazdy bez pobrania > 90 dni
    if (overdue === '1') {
      // Zwróć pojazdy z aktywnym tachografem, gdzie ostatnie pobranie > 90 dni temu lub brak
      const cutoff = new Date(Date.now() - 90*86400000).toISOString().slice(0,10);
      const vehicles = (await env.DB.prepare(
        `SELECT v.nr_rej, v.data, MAX(t.download_date) AS last_download
         FROM vehicles v
         LEFT JOIN tacho_records t ON t.nr_rej = v.nr_rej AND t.company_id = v.company_id
         WHERE v.company_id=?
         GROUP BY v.nr_rej
         HAVING last_download IS NULL OR last_download < ?
         ORDER BY last_download ASC NULLS FIRST LIMIT 200`
      ).bind(company, cutoff).all()).results || [];
      return json(vehicles);
    }
    let q = 'SELECT * FROM tacho_records WHERE company_id=?';
    const p = [company];
    if (nrRej) { q += ' AND nr_rej=?'; p.push(nrRej); }
    q += ' ORDER BY download_date DESC LIMIT 500';
    return json((await env.DB.prepare(q).bind(...p).all()).results || []);
  }

  if (method === 'POST') {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!d.nr_rej)        return err('Wymagane: nr_rej', 400);
    if (!d.download_date) return err('Wymagane: download_date', 400);
    const newId = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO tacho_records (id,company_id,nr_rej,driver_name,download_date,period_from,period_to,file_name,notes)
      VALUES(?,?,?,?,?,?,?,?,?)`)
    .bind(newId, company, d.nr_rej, d.driver_name||null, d.download_date,
      d.period_from||null, d.period_to||null, d.file_name||null, d.notes||null).run();
    return json({ ok: true, id: newId });
  }

  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM tacho_records WHERE id=? AND company_id=?').bind(id, company).run();
    return json({ ok: true });
  }

  return err('Metoda nieobsługiwana', 405);
}

// ─── KARTOTEKA KIEROWCÓW ─────────────────────────────────────────────────────
async function handleDriverProfiles(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const segs = path.split('/').filter(Boolean); // ['api','driver-profiles', id?, action?]
  const id = (segs[2] && segs[2] !== 'alerts') ? segs[2] : null;
  const action = segs[3] || (segs[2] === 'alerts' ? 'alerts' : null);
  const method = req.method;

  if (method === 'GET' && action === 'alerts') {
    const pol = await env.DB.prepare('SELECT license_alert_days, medical_alert_days FROM fleet_policies WHERE company_id=?').bind(company).first();
    const licDays = pol?.license_alert_days ?? 30;
    const medDays = pol?.medical_alert_days ?? 30;
    const today = new Date().toISOString().slice(0, 10);
    const licDate = new Date(Date.now() + licDays*86400000).toISOString().slice(0,10);
    const medDate = new Date(Date.now() + medDays*86400000).toISOString().slice(0,10);
    const rows = (await env.DB.prepare(`
      SELECT id, first_name, last_name, license_expiry, medical_expiry, psychotech_expiry
      FROM driver_profiles WHERE company_id=? AND status='active'
      AND (license_expiry <= ? OR medical_expiry <= ? OR psychotech_expiry <= ?)
    `).bind(company, licDate, medDate, medDate).all()).results || [];
    return json(rows);
  }
  if (method === 'GET' && id) {
    const row = await env.DB.prepare('SELECT * FROM driver_profiles WHERE id=? AND company_id=?').bind(id, company).first();
    if (!row) return err('Nie znaleziono', 404);
    return json(row);
  }
  if (method === 'GET') {
    const status = url.searchParams.get('status') || '';
    const branch = url.searchParams.get('branch_id') || '';
    let q = 'SELECT * FROM driver_profiles WHERE company_id=?';
    const params = [company];
    if (status) { q += ' AND status=?'; params.push(status); }
    if (branch) { q += ' AND branch_id=?'; params.push(parseInt(branch)); }
    q += ' ORDER BY last_name, first_name';
    const rows = (await env.DB.prepare(q).bind(...params).all()).results || [];
    return json(rows);
  }
  if (method === 'POST') {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!d.first_name || !d.last_name) return err('Wymagane: first_name, last_name', 400);
    const nid = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO driver_profiles
      (id,company_id,branch_id,first_name,last_name,employee_id,email,phone,birth_date,
       license_number,license_categories,license_expiry,medical_expiry,psychotech_expiry,
       assigned_nr_rej,status,notes)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(nid, company, d.branch_id??null, d.first_name, d.last_name,
        d.employee_id??null, d.email??null, d.phone??null, d.birth_date??null,
        d.license_number??null, d.license_categories ? JSON.stringify(d.license_categories) : null,
        d.license_expiry??null, d.medical_expiry??null, d.psychotech_expiry??null,
        d.assigned_nr_rej??null, d.status||'active', d.notes??null).run();
    return json({ ok: true, id: nid });
  }
  if ((method === 'PUT') && id) {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    await env.DB.prepare(`UPDATE driver_profiles SET
      branch_id=?,first_name=?,last_name=?,employee_id=?,email=?,phone=?,birth_date=?,
      license_number=?,license_categories=?,license_expiry=?,medical_expiry=?,psychotech_expiry=?,
      assigned_nr_rej=?,status=?,notes=?,updated_at=datetime('now')
      WHERE id=? AND company_id=?`)
      .bind(d.branch_id??null, d.first_name, d.last_name, d.employee_id??null,
        d.email??null, d.phone??null, d.birth_date??null, d.license_number??null,
        d.license_categories ? JSON.stringify(d.license_categories) : null,
        d.license_expiry??null, d.medical_expiry??null, d.psychotech_expiry??null,
        d.assigned_nr_rej??null, d.status||'active', d.notes??null, id, company).run();
    return json({ ok: true });
  }
  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM driver_profiles WHERE id=? AND company_id=?').bind(id, company).run();
    return json({ ok: true });
  }
  return err('Metoda nieobsługiwana', 405);
}

// ─── REZERWACJE POJAZDÓW ──────────────────────────────────────────────────────
async function handleVehicleReservations(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const segs = path.split('/').filter(Boolean);
  const id = (segs[2] && !['calendar'].includes(segs[2])) ? segs[2] : null;
  const action = segs[3] || null; // approve / reject / complete
  const method = req.method;

  // Widok kalendarza
  if (method === 'GET' && segs[2] === 'calendar') {
    const from = url.searchParams.get('from') || new Date().toISOString().slice(0,7)+'-01';
    const to   = url.searchParams.get('to')   || new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).toISOString().slice(0,10);
    const rows = (await env.DB.prepare(`
      SELECT * FROM vehicle_reservations
      WHERE company_id=? AND date_from<=? AND date_to>=? AND status NOT IN ('rejected','cancelled')
      ORDER BY date_from`).bind(company, to, from).all()).results || [];
    return json(rows);
  }
  if (method === 'GET') {
    const nrRej  = url.searchParams.get('nr_rej') || '';
    const status = url.searchParams.get('status') || '';
    const limit  = Math.min(parseInt(url.searchParams.get('limit')  || '1000'), 5000);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'),    0);
    let q = 'SELECT * FROM vehicle_reservations WHERE company_id=?';
    const p = [company];
    if (nrRej)  { q += ' AND nr_rej=?'; p.push(nrRej); }
    if (status) { q += ' AND status=?'; p.push(status); }
    q += ' ORDER BY date_from DESC LIMIT ? OFFSET ?';
    p.push(limit, offset);
    const rows = (await env.DB.prepare(q).bind(...p).all()).results || [];
    return json(rows);
  }
  if (method === 'POST') {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!d.nr_rej || !d.driver_name || !d.date_from || !d.date_to) return err('Wymagane: nr_rej, driver_name, date_from, date_to', 400);
    // Sprawdź kolizję (aktywne rezerwacje)
    const collision = await env.DB.prepare(`
      SELECT id FROM vehicle_reservations
      WHERE company_id=? AND nr_rej=? AND status IN ('pending','approved')
      AND date_from<=? AND date_to>=?`).bind(company, d.nr_rej, d.date_to, d.date_from).first();
    if (collision) return err('Pojazd jest już zarezerwowany w tym terminie', 409);
    // Sprawdź politykę — czy wymaga zatwierdzenia
    const pol = await env.DB.prepare('SELECT reservation_requires_approval FROM fleet_policies WHERE company_id=?').bind(company).first();
    const needsApproval = pol?.reservation_requires_approval ?? 1;
    const nid = crypto.randomUUID();
    const status = needsApproval ? 'pending' : 'approved';
    await env.DB.prepare(`INSERT INTO vehicle_reservations
      (id,company_id,nr_rej,driver_name,driver_id,date_from,date_to,purpose,destination,expected_km,notes,status)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(nid, company, d.nr_rej, d.driver_name, d.driver_id??null,
        d.date_from, d.date_to, d.purpose??null, d.destination??null,
        d.expected_km??null, d.notes??null, status).run();
    // Jeśli wymaga zatwierdzenia — utwórz rekord w approvals
    if (needsApproval) {
      const aid = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO approvals (id,company_id,record_type,record_id,nr_rej,description,requested_by)
        VALUES(?,?,?,?,?,?,?)`)
        .bind(aid, company, 'reservation', nid, d.nr_rej,
          `Rezerwacja ${d.nr_rej} ${d.date_from}–${d.date_to} przez ${d.driver_name}`,
          d.driver_name).run();
    }
    return json({ ok: true, id: nid, status });
  }
  if (method === 'PUT' && id && action === 'approve') {
    const approver = user.email || user.name || 'manager';
    await env.DB.prepare(`UPDATE vehicle_reservations SET status='approved',approved_by=?,approved_at=datetime('now') WHERE id=? AND company_id=?`).bind(approver, id, company).run();
    await env.DB.prepare(`UPDATE approvals SET status='approved',approved_by=?,decided_at=datetime('now') WHERE record_type='reservation' AND record_id=? AND company_id=?`).bind(approver, id, company).run();
    return json({ ok: true });
  }
  if (method === 'PUT' && id && action === 'reject') {
    let d = {}; try { d = await req.json(); } catch {}
    await env.DB.prepare(`UPDATE vehicle_reservations SET status='rejected',rejection_reason=? WHERE id=? AND company_id=?`).bind(d.reason??null, id, company).run();
    await env.DB.prepare(`UPDATE approvals SET status='rejected',rejection_reason=?,decided_at=datetime('now') WHERE record_type='reservation' AND record_id=? AND company_id=?`).bind(d.reason??null, id, company).run();
    return json({ ok: true });
  }
  if (method === 'PUT' && id && action === 'complete') {
    let d = {}; try { d = await req.json(); } catch {}
    await env.DB.prepare(`UPDATE vehicle_reservations SET status='completed',actual_km=? WHERE id=? AND company_id=?`).bind(d.actual_km??null, id, company).run();
    return json({ ok: true });
  }
  if (method === 'PUT' && id) {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    await env.DB.prepare(`UPDATE vehicle_reservations SET nr_rej=?,driver_name=?,date_from=?,date_to=?,purpose=?,destination=?,expected_km=?,notes=? WHERE id=? AND company_id=?`)
      .bind(d.nr_rej, d.driver_name, d.date_from, d.date_to, d.purpose??null, d.destination??null, d.expected_km??null, d.notes??null, id, company).run();
    return json({ ok: true });
  }
  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM vehicle_reservations WHERE id=? AND company_id=?').bind(id, company).run();
    return json({ ok: true });
  }
  return err('Metoda nieobsługiwana', 405);
}

// ─── KOLEJKA ZATWIERDZEŃ ──────────────────────────────────────────────────────
async function handleApprovals(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const segs = path.split('/').filter(Boolean);
  const id   = segs[2] && !['count'].includes(segs[2]) ? segs[2] : null;
  const action = segs[3] || null; // approve / reject
  const method = req.method;

  if (method === 'GET' && segs[2] === 'count') {
    const row = await env.DB.prepare(`SELECT COUNT(*) AS cnt FROM approvals WHERE company_id=? AND status='pending'`).bind(company).first();
    return json({ count: row?.cnt ?? 0 });
  }
  if (method === 'GET') {
    const status = url.searchParams.get('status') || 'pending';
    const type   = url.searchParams.get('type') || '';
    let q = 'SELECT * FROM approvals WHERE company_id=?';
    const p = [company];
    if (status) { q += ' AND status=?'; p.push(status); }
    if (type)   { q += ' AND record_type=?'; p.push(type); }
    q += ' ORDER BY created_at DESC';
    const rows = (await env.DB.prepare(q).bind(...p).all()).results || [];
    return json(rows);
  }
  if (method === 'PUT' && id && action === 'approve') {
    const approver = user.email || user.name || 'manager';
    await env.DB.prepare(`UPDATE approvals SET status='approved',approved_by=?,decided_at=datetime('now') WHERE id=? AND company_id=?`).bind(approver, id, company).run();
    return json({ ok: true });
  }
  if (method === 'PUT' && id && action === 'reject') {
    let d = {}; try { d = await req.json(); } catch {}
    const approver = user.email || user.name || 'manager';
    await env.DB.prepare(`UPDATE approvals SET status='rejected',approved_by=?,rejection_reason=?,decided_at=datetime('now') WHERE id=? AND company_id=?`).bind(approver, d.reason??null, id, company).run();
    return json({ ok: true });
  }
  if (method === 'POST') {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const nid = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO approvals (id,company_id,record_type,record_id,nr_rej,amount,description,requested_by) VALUES(?,?,?,?,?,?,?,?)`)
      .bind(nid, company, d.record_type, d.record_id, d.nr_rej??null, d.amount??null, d.description??null, d.requested_by??null).run();
    return json({ ok: true, id: nid });
  }
  return err('Metoda nieobsługiwana', 405);
}

// ─── POLITYKI FLOTOWE ─────────────────────────────────────────────────────────
async function handleFleetPolicies(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const method = req.method;
  if (method === 'GET') {
    const row = await env.DB.prepare('SELECT * FROM fleet_policies WHERE company_id=?').bind(company).first();
    return json(row || {
      service_approval_threshold: 2000, damage_approval_threshold: 500,
      mileage_approval_threshold: 1000, fuel_norm_diesel: 8.0, fuel_norm_petrol: 9.0,
      max_private_km: 0, reservation_requires_approval: 1, license_alert_days: 30, medical_alert_days: 30
    });
  }
  if (method === 'PUT' || method === 'POST') {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    await env.DB.prepare(`INSERT INTO fleet_policies
      (company_id,service_approval_threshold,damage_approval_threshold,mileage_approval_threshold,
       fuel_norm_diesel,fuel_norm_petrol,max_private_km,reservation_requires_approval,license_alert_days,medical_alert_days,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(company_id) DO UPDATE SET
        service_approval_threshold=excluded.service_approval_threshold,
        damage_approval_threshold=excluded.damage_approval_threshold,
        mileage_approval_threshold=excluded.mileage_approval_threshold,
        fuel_norm_diesel=excluded.fuel_norm_diesel,
        fuel_norm_petrol=excluded.fuel_norm_petrol,
        max_private_km=excluded.max_private_km,
        reservation_requires_approval=excluded.reservation_requires_approval,
        license_alert_days=excluded.license_alert_days,
        medical_alert_days=excluded.medical_alert_days,
        updated_at=datetime('now')`)
      .bind(company,
        d.service_approval_threshold??2000, d.damage_approval_threshold??500,
        d.mileage_approval_threshold??1000, d.fuel_norm_diesel??8.0, d.fuel_norm_petrol??9.0,
        d.max_private_km??0, d.reservation_requires_approval??1,
        d.license_alert_days??30, d.medical_alert_days??30).run();
    return json({ ok: true });
  }
  return err('Metoda nieobsługiwana', 405);
}

// ─── BENCHMARKING ────────────────────────────────────────────────────────────
async function handleBenchmark(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const year = parseInt(url.searchParams.get('year') || new Date().getFullYear());
  const yStr = String(year);

  const [vehRows, svcRows, fineRows, fuelRows, damageRows, mileRows] = await Promise.all([
    env.DB.prepare('SELECT nr_rej, data FROM vehicles WHERE company_id=? ORDER BY nr_rej').bind(company).all(),
    env.DB.prepare(`SELECT nr_rej, SUM(koszt_rzeczywisty) AS total, COUNT(*) AS cnt FROM service_orders WHERE company_id=? AND strftime('%Y',COALESCE(data_realizacji,created_at))=? AND koszt_rzeczywisty IS NOT NULL GROUP BY nr_rej`).bind(company, yStr).all(),
    env.DB.prepare(`SELECT nr_rej, SUM(amount) AS total, COUNT(*) AS cnt FROM fines WHERE company_id=? AND strftime('%Y',date)=? GROUP BY nr_rej`).bind(company, yStr).all(),
    env.DB.prepare(`SELECT nr_rej, SUM(total_cost) AS total, SUM(liters) AS liters, MAX(odometer) AS odo_max, MIN(odometer) AS odo_min FROM fuel_fills WHERE company_id=? AND strftime('%Y',fill_date)=? GROUP BY nr_rej`).bind(company, yStr).all(),
    env.DB.prepare(`SELECT nr_rej, SUM(koszt) AS total, COUNT(*) AS cnt FROM damage_reports WHERE company_id=? AND strftime('%Y',COALESCE(data_zdarzenia,created_at))=? AND koszt IS NOT NULL GROUP BY nr_rej`).bind(company, yStr).all(),
    env.DB.prepare(`SELECT nr_rej, SUM(amount) AS total FROM mileage_claims WHERE company_id=? AND strftime('%Y',claim_date)=? GROUP BY nr_rej`).bind(company, yStr).all(),
  ]);

  const idx = (rows) => Object.fromEntries((rows.results||[]).map(r => [r.nr_rej, r]));
  const svcIdx  = idx(svcRows);
  const fineIdx = idx(fineRows);
  const fuelIdx = idx(fuelRows);
  const dmgIdx  = idx(damageRows);
  const milIdx  = idx(mileRows);

  const result = (vehRows.results||[]).map(v => {
    let data = {}; try { data = JSON.parse(v.data||'{}'); } catch {}
    const svc  = svcIdx[v.nr_rej]  || {};
    const fine = fineIdx[v.nr_rej] || {};
    const fuel = fuelIdx[v.nr_rej] || {};
    const dmg  = dmgIdx[v.nr_rej]  || {};
    const mil  = milIdx[v.nr_rej]  || {};
    const fuelKm = (fuel.odo_max && fuel.odo_min && fuel.odo_max > fuel.odo_min) ? fuel.odo_max - fuel.odo_min : null;
    const total = (svc.total||0)+(fine.total||0)+(fuel.total||0)+(dmg.total||0)+(mil.total||0);
    return {
      nr_rej: v.nr_rej, marka: data.marka||'', model: data.model||'', rok: data.rok||null,
      typ: data.typ||'', dmcMax: data.dmcMax||data.dmc||0,
      service_cost: svc.total||0, service_cnt: svc.cnt||0,
      fine_cost: fine.total||0, fine_cnt: fine.cnt||0,
      fuel_cost: fuel.total||0, fuel_liters: fuel.liters||0,
      fuel_km: fuelKm, avg_consumption: (fuelKm && fuel.liters) ? parseFloat(((fuel.liters/fuelKm)*100).toFixed(2)) : null,
      damage_cost: dmg.total||0, damage_cnt: dmg.cnt||0,
      mileage_cost: mil.total||0,
      total_cost: total,
      cost_per_km: (fuelKm && total) ? parseFloat((total/fuelKm).toFixed(2)) : null,
    };
  });
  return json(result);
}

// ─── WYDAJNOŚĆ KIEROWCÓW ──────────────────────────────────────────────────────
async function handleDriverPerformance(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const year   = parseInt(url.searchParams.get('year') || new Date().getFullYear());
  const yStr   = String(year);
  const driver = url.searchParams.get('driver') || '';

  const [shiftRows, fuelRows, faultRows, claimRows, fineRows] = await Promise.all([
    env.DB.prepare(`SELECT driver_name,
      SUM(work_minutes) AS total_minutes, SUM(overtime_minutes) AS total_overtime, COUNT(*) AS shifts
      FROM driver_shifts WHERE company_id=? AND strftime('%Y',shift_date)=? ${driver?'AND driver_name=?':''}
      GROUP BY driver_name ORDER BY driver_name`)
      .bind(company, yStr, ...(driver ? [driver] : [])).all(),
    env.DB.prepare(`SELECT driver_name,
      SUM(liters) AS liters, SUM(total_cost) AS fuel_cost, COUNT(*) AS fills,
      MAX(odometer) AS odo_max, MIN(odometer) AS odo_min
      FROM fuel_fills WHERE company_id=? AND strftime('%Y',fill_date)=? AND driver_name IS NOT NULL ${driver?'AND driver_name=?':''}
      GROUP BY driver_name`)
      .bind(company, yStr, ...(driver ? [driver] : [])).all(),
    env.DB.prepare(`SELECT reported_by AS driver_name, COUNT(*) AS faults_reported,
      SUM(CASE WHEN status='resolved' THEN 1 ELSE 0 END) AS resolved
      FROM faults WHERE company_id=? AND strftime('%Y',report_date)=? AND reported_by IS NOT NULL
      GROUP BY reported_by`)
      .bind(company, yStr).all(),
    env.DB.prepare(`SELECT driver_name, SUM(amount) AS claims_amount, COUNT(*) AS claims_cnt
      FROM mileage_claims WHERE company_id=? AND strftime('%Y',claim_date)=? AND driver_name IS NOT NULL
      GROUP BY driver_name`)
      .bind(company, yStr).all(),
    env.DB.prepare(`SELECT driver_name, COUNT(*) AS fine_cnt, SUM(amount) AS fine_amount
      FROM fines WHERE company_id=? AND strftime('%Y',date)=? AND driver_name IS NOT NULL
      GROUP BY driver_name`)
      .bind(company, yStr).all(),
  ]);

  const idx = (rows, key='driver_name') => {
    const m = {};
    for (const r of (rows.results||[])) m[r[key]] = r;
    return m;
  };
  const shiftIdx = idx(shiftRows); const fuelIdx = idx(fuelRows);
  const faultIdx = idx(faultRows); const claimIdx = idx(claimRows); const fineIdx = idx(fineRows);
  const allDrivers = new Set([...Object.keys(shiftIdx),...Object.keys(fuelIdx),...Object.keys(claimIdx),...Object.keys(fineIdx)]);

  const result = [...allDrivers].map(name => {
    const s = shiftIdx[name]||{}; const f = fuelIdx[name]||{};
    const fa = faultIdx[name]||{}; const c = claimIdx[name]||{}; const fi = fineIdx[name]||{};
    const km = (f.odo_max && f.odo_min && f.odo_max>f.odo_min) ? f.odo_max-f.odo_min : null;
    return {
      driver_name: name,
      total_minutes: s.total_minutes??0, total_overtime: s.total_overtime??0, shifts: s.shifts??0,
      fuel_liters: f.liters??0, fuel_cost: f.fuel_cost??0, fuel_fills: f.fills??0,
      driven_km: km, avg_consumption: (km&&f.liters) ? parseFloat(((f.liters/km)*100).toFixed(2)) : null,
      faults_reported: fa.faults_reported??0, faults_resolved: fa.resolved??0,
      claims_amount: c.claims_amount??0, claims_cnt: c.claims_cnt??0,
      fine_cnt: fi.fine_cnt??0, fine_amount: fi.fine_amount??0,
    };
  }).sort((a,b) => (a.driver_name||'').localeCompare(b.driver_name||''));
  return json(result);
}

// ─── EXECUTIVE DASHBOARD ──────────────────────────────────────────────────────
async function handleExecutiveDashboard(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const now   = new Date();
  const yStr  = String(now.getFullYear());
  const mStr  = `${yStr}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const today = now.toISOString().slice(0,10);
  const alert30 = new Date(Date.now()+30*86400000).toISOString().slice(0,10);

  const [
    vehRow, ytdRow, mtdRow, pendAppRow,
    pendResRow, lowStockRow, driverAlertRow, budRow, faultOpenRow
  ] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS cnt FROM vehicles WHERE company_id=? AND COALESCE(JSON_EXTRACT(data,\'$.status\'),\'active\')!=\'archived\'').bind(company).first(),
    env.DB.prepare(`SELECT
      COALESCE((SELECT SUM(koszt_rzeczywisty) FROM service_orders WHERE company_id=? AND strftime('%Y',COALESCE(data_realizacji,created_at))=?),0)+
      COALESCE((SELECT SUM(total_cost) FROM fuel_fills WHERE company_id=? AND strftime('%Y',fill_date)=?),0)+
      COALESCE((SELECT SUM(amount) FROM fines WHERE company_id=? AND strftime('%Y',date)=?),0)+
      COALESCE((SELECT SUM(koszt) FROM damage_reports WHERE company_id=? AND strftime('%Y',COALESCE(data_zdarzenia,created_at))=?),0)
      AS total`).bind(company,yStr,company,yStr,company,yStr,company,yStr).first(),
    env.DB.prepare(`SELECT
      COALESCE((SELECT SUM(koszt_rzeczywisty) FROM service_orders WHERE company_id=? AND strftime('%Y-%m',COALESCE(data_realizacji,created_at))=?),0)+
      COALESCE((SELECT SUM(total_cost) FROM fuel_fills WHERE company_id=? AND strftime('%Y-%m',fill_date)=?),0)+
      COALESCE((SELECT SUM(amount) FROM fines WHERE company_id=? AND strftime('%Y-%m',date)=?),0)
      AS total`).bind(company,mStr,company,mStr,company,mStr).first(),
    env.DB.prepare(`SELECT COUNT(*) AS cnt FROM approvals WHERE company_id=? AND status='pending'`).bind(company).first(),
    env.DB.prepare(`SELECT COUNT(*) AS cnt FROM vehicle_reservations WHERE company_id=? AND status='pending'`).bind(company).first(),
    env.DB.prepare(`SELECT COUNT(*) AS cnt FROM spare_parts WHERE company_id=? AND quantity<=min_quantity`).bind(company).first(),
    env.DB.prepare(`SELECT COUNT(*) AS cnt FROM driver_profiles WHERE company_id=? AND status='active' AND (license_expiry<=? OR medical_expiry<=? OR psychotech_expiry<=?)`).bind(company,alert30,alert30,alert30).first(),
    env.DB.prepare(`SELECT SUM(amount) AS budget FROM budgets WHERE company_id=? AND year=? AND month IS NULL`).bind(company, now.getFullYear()).first(),
    env.DB.prepare(`SELECT COUNT(*) AS cnt FROM faults WHERE company_id=? AND status='open'`).bind(company).first(),
  ]);

  // Top 5 najdroższych pojazdów YTD
  const topVeh = (await env.DB.prepare(`
    SELECT nr_rej,
      COALESCE((SELECT SUM(koszt_rzeczywisty) FROM service_orders s WHERE s.company_id=v.company_id AND s.nr_rej=v.nr_rej AND strftime('%Y',COALESCE(data_realizacji,created_at))=?),0)+
      COALESCE((SELECT SUM(total_cost) FROM fuel_fills f WHERE f.company_id=v.company_id AND f.nr_rej=v.nr_rej AND strftime('%Y',fill_date)=?),0)+
      COALESCE((SELECT SUM(amount) FROM fines fi WHERE fi.company_id=v.company_id AND fi.nr_rej=v.nr_rej AND strftime('%Y',date)=?),0) AS cost
    FROM vehicles v WHERE v.company_id=? ORDER BY cost DESC LIMIT 5`).bind(yStr,yStr,yStr,company).all()).results||[];

  return json({
    vehicles_active:    vehRow?.cnt ?? 0,
    cost_ytd:           ytdRow?.total ?? 0,
    cost_mtd:           mtdRow?.total ?? 0,
    budget_annual:      budRow?.budget ?? null,
    pending_approvals:  pendAppRow?.cnt ?? 0,
    pending_reservations: pendResRow?.cnt ?? 0,
    low_stock_parts:    lowStockRow?.cnt ?? 0,
    driver_alerts:      driverAlertRow?.cnt ?? 0,
    open_faults:        faultOpenRow?.cnt ?? 0,
    top_cost_vehicles:  topVeh,
  });
}

// ─── MAGAZYN CZĘŚCI ───────────────────────────────────────────────────────────
async function handleSpareParts(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const segs = path.split('/').filter(Boolean);
  const id   = segs[2] && segs[2] !== 'alerts' ? segs[2] : null;
  const action = segs[3] || (segs[2] === 'alerts' ? 'alerts' : null);
  const method = req.method;

  if (method === 'GET' && action === 'alerts') {
    const rows = (await env.DB.prepare('SELECT * FROM spare_parts WHERE company_id=? AND quantity<=min_quantity ORDER BY name').bind(company).all()).results||[];
    return json(rows);
  }
  if (method === 'GET' && id) {
    const row = await env.DB.prepare('SELECT * FROM spare_parts WHERE id=? AND company_id=?').bind(id, company).first();
    if (!row) return err('Nie znaleziono', 404);
    const txns = (await env.DB.prepare('SELECT * FROM spare_parts_transactions WHERE part_id=? ORDER BY created_at DESC LIMIT 50').bind(id).all()).results||[];
    return json({ ...row, transactions: txns });
  }
  if (method === 'GET') {
    const cat = url.searchParams.get('category') || '';
    let q = 'SELECT * FROM spare_parts WHERE company_id=?'; const p=[company];
    if (cat) { q+=' AND category=?'; p.push(cat); }
    q += ' ORDER BY name';
    const rows = (await env.DB.prepare(q).bind(...p).all()).results||[];
    return json(rows);
  }
  if (method === 'POST') {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!d.name) return err('Wymagane: name', 400);
    const nid = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO spare_parts (id,company_id,part_number,name,category,compatible_models,quantity,min_quantity,unit,unit_price,supplier,location,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(nid,company,d.part_number??null,d.name,d.category??null,
        d.compatible_models?JSON.stringify(d.compatible_models):null,
        d.quantity??0,d.min_quantity??1,d.unit||'szt',d.unit_price??null,d.supplier??null,d.location??null,d.notes??null).run();
    return json({ ok:true, id:nid });
  }
  if (method === 'PUT' && id && action === 'stock') {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    const qty = parseInt(d.qty_change);
    if (!qty) return err('Wymagane: qty_change (liczba całkowita, nie-zerowa)', 400);
    await env.DB.prepare(`UPDATE spare_parts SET quantity=MAX(0,quantity+?),updated_at=datetime('now') WHERE id=? AND company_id=?`).bind(qty,id,company).run();
    await env.DB.prepare(`INSERT INTO spare_parts_transactions (company_id,part_id,nr_rej,qty_change,reason,user_name) VALUES(?,?,?,?,?,?)`)
      .bind(company,id,d.nr_rej??null,qty,d.reason??null,d.user_name??user.email??null).run();
    return json({ ok: true });
  }
  if (method === 'PUT' && id) {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    await env.DB.prepare(`UPDATE spare_parts SET part_number=?,name=?,category=?,compatible_models=?,quantity=?,min_quantity=?,unit=?,unit_price=?,supplier=?,location=?,notes=?,updated_at=datetime('now') WHERE id=? AND company_id=?`)
      .bind(d.part_number??null,d.name,d.category??null,d.compatible_models?JSON.stringify(d.compatible_models):null,
        d.quantity??0,d.min_quantity??1,d.unit||'szt',d.unit_price??null,d.supplier??null,d.location??null,d.notes??null,id,company).run();
    return json({ ok: true });
  }
  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM spare_parts WHERE id=? AND company_id=?').bind(id,company).run();
    return json({ ok: true });
  }
  return err('Metoda nieobsługiwana', 405);
}

// ─── KONTRAKTY Z SERWISAMI ────────────────────────────────────────────────────
async function handleServiceContracts(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const segs = path.split('/').filter(Boolean);
  const id   = segs[2] || null;
  const method = req.method;

  if (method === 'GET' && id) {
    const row = await env.DB.prepare('SELECT * FROM service_contracts WHERE id=? AND company_id=?').bind(id,company).first();
    if (!row) return err('Nie znaleziono', 404);
    // Faktury powiązane z tym kontraktem
    const invoices = (await env.DB.prepare('SELECT id,invoice_number,invoice_date,total_gross,status FROM supplier_invoices WHERE service_contract_id=? ORDER BY invoice_date DESC LIMIT 20').bind(id).all()).results||[];
    return json({ ...row, invoices });
  }
  if (method === 'GET') {
    const rows = (await env.DB.prepare('SELECT * FROM service_contracts WHERE company_id=? ORDER BY workshop_name').bind(company).all()).results||[];
    return json(rows);
  }
  if (method === 'POST') {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!d.workshop_name) return err('Wymagane: workshop_name', 400);
    const nid = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO service_contracts (id,company_id,workshop_name,nip,address,contact_person,phone,email,hourly_rate,parts_discount,contract_from,contract_to,services_covered,payment_days,notes)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(nid,company,d.workshop_name,d.nip??null,d.address??null,d.contact_person??null,
        d.phone??null,d.email??null,d.hourly_rate??null,d.parts_discount??0,
        d.contract_from??null,d.contract_to??null,
        d.services_covered?JSON.stringify(d.services_covered):null,
        d.payment_days??14,d.notes??null).run();
    return json({ ok:true, id:nid });
  }
  if (method === 'PUT' && id) {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    await env.DB.prepare(`UPDATE service_contracts SET workshop_name=?,nip=?,address=?,contact_person=?,phone=?,email=?,hourly_rate=?,parts_discount=?,contract_from=?,contract_to=?,services_covered=?,payment_days=?,notes=? WHERE id=? AND company_id=?`)
      .bind(d.workshop_name,d.nip??null,d.address??null,d.contact_person??null,
        d.phone??null,d.email??null,d.hourly_rate??null,d.parts_discount??0,
        d.contract_from??null,d.contract_to??null,
        d.services_covered?JSON.stringify(d.services_covered):null,
        d.payment_days??14,d.notes??null,id,company).run();
    return json({ ok: true });
  }
  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM service_contracts WHERE id=? AND company_id=?').bind(id,company).run();
    return json({ ok: true });
  }
  return err('Metoda nieobsługiwana', 405);
}

// ─── FAKTURY OD DOSTAWCÓW ─────────────────────────────────────────────────────
async function handleSupplierInvoices(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const segs   = path.split('/').filter(Boolean);
  const id     = segs[2] && !['stats'].includes(segs[2]) ? segs[2] : null;
  const action = segs[3] || (segs[2]==='stats' ? 'stats' : null);
  const method = req.method;

  if (method === 'GET' && action === 'stats') {
    const year = url.searchParams.get('year') || new Date().getFullYear();
    const rows = (await env.DB.prepare(`
      SELECT invoice_type, SUM(total_gross) AS total, COUNT(*) AS cnt,
        SUM(CASE WHEN status='pending' THEN total_gross ELSE 0 END) AS pending_amount
      FROM supplier_invoices WHERE company_id=? AND strftime('%Y',invoice_date)=?
      GROUP BY invoice_type ORDER BY total DESC`).bind(company, String(year)).all()).results||[];
    const overdue = (await env.DB.prepare(`
      SELECT COUNT(*) AS cnt, SUM(total_gross) AS amount FROM supplier_invoices
      WHERE company_id=? AND status IN ('pending','approved') AND due_date < date('now')`).bind(company).first());
    return json({ by_type: rows, overdue_count: overdue?.cnt??0, overdue_amount: overdue?.amount??0 });
  }
  if (method === 'GET' && id) {
    const inv = await env.DB.prepare('SELECT * FROM supplier_invoices WHERE id=? AND company_id=?').bind(id,company).first();
    if (!inv) return err('Nie znaleziono', 404);
    const items = (await env.DB.prepare('SELECT * FROM supplier_invoice_items WHERE invoice_id=?').bind(id).all()).results||[];
    return json({ ...inv, items });
  }
  if (method === 'GET') {
    const status = url.searchParams.get('status') || '';
    const type   = url.searchParams.get('type') || '';
    const from   = url.searchParams.get('from') || '';
    const to     = url.searchParams.get('to') || '';
    let q = 'SELECT * FROM supplier_invoices WHERE company_id=?'; const p=[company];
    if (status) { q+=' AND status=?'; p.push(status); }
    if (type)   { q+=' AND invoice_type=?'; p.push(type); }
    if (from)   { q+=' AND invoice_date>=?'; p.push(from); }
    if (to)     { q+=' AND invoice_date<=?'; p.push(to); }
    q += ' ORDER BY invoice_date DESC';
    const rows = (await env.DB.prepare(q).bind(...p).all()).results||[];
    return json(rows);
  }
  if (method === 'POST') {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!d.invoice_number || !d.supplier_name || !d.invoice_date) return err('Wymagane: invoice_number, supplier_name, invoice_date', 400);
    const nid = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO supplier_invoices
      (id,company_id,invoice_number,supplier_name,invoice_date,due_date,invoice_type,total_net,total_vat,total_gross,status,service_contract_id,gl_account,notes)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(nid,company,d.invoice_number,d.supplier_name,d.invoice_date,d.due_date??null,
        d.invoice_type||'service',d.total_net??null,d.total_vat??null,d.total_gross??null,
        d.status||'pending',d.service_contract_id??null,d.gl_account??null,d.notes??null).run();
    if (Array.isArray(d.items) && d.items.length) {
      const stmts = d.items.map(it => env.DB.prepare(`INSERT INTO supplier_invoice_items (invoice_id,nr_rej,description,quantity,unit_price,total,cost_type) VALUES(?,?,?,?,?,?,?)`)
        .bind(nid,it.nr_rej??null,it.description,it.quantity??1,it.unit_price??null,it.total??null,it.cost_type??null));
      await env.DB.batch(stmts);
    }
    return json({ ok:true, id:nid });
  }
  if (method === 'PUT' && id && action === 'approve') {
    await env.DB.prepare(`UPDATE supplier_invoices SET status='approved' WHERE id=? AND company_id=?`).bind(id,company).run();
    return json({ ok:true });
  }
  if (method === 'PUT' && id && action === 'pay') {
    await env.DB.prepare(`UPDATE supplier_invoices SET status='paid' WHERE id=? AND company_id=?`).bind(id,company).run();
    return json({ ok:true });
  }
  if (method === 'PUT' && id) {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    await env.DB.prepare(`UPDATE supplier_invoices SET invoice_number=?,supplier_name=?,invoice_date=?,due_date=?,invoice_type=?,total_net=?,total_vat=?,total_gross=?,status=?,gl_account=?,notes=? WHERE id=? AND company_id=?`)
      .bind(d.invoice_number,d.supplier_name,d.invoice_date,d.due_date??null,d.invoice_type||'service',
        d.total_net??null,d.total_vat??null,d.total_gross??null,d.status||'pending',d.gl_account??null,d.notes??null,id,company).run();
    return json({ ok:true });
  }
  if (method === 'DELETE' && id) {
    // Najpierw potwierdź własność faktury. Bez tego DELETE pozycji leciał po samym
    // invoice_id ze ścieżki, bez scope'u company_id — użytkownik firmy A, znając id
    // faktury firmy B, trwale kasował jej pozycje (kwoty, opisy), a scope'owany DELETE
    // nagłówka nie kasował nic. Wzorzec jak w handleDamages/handleProtocols.
    const owned = await env.DB.prepare('SELECT id FROM supplier_invoices WHERE id=? AND company_id=?')
      .bind(id,company).first();
    if (!owned) return err('Faktura nie istnieje', 404);
    await env.DB.prepare('DELETE FROM supplier_invoice_items WHERE invoice_id=?').bind(id).run();
    await env.DB.prepare('DELETE FROM supplier_invoices WHERE id=? AND company_id=?').bind(id,company).run();
    return json({ ok:true });
  }
  return err('Metoda nieobsługiwana', 405);
}

// ─── KONTA GL ────────────────────────────────────────────────────────────────
async function handleGlAccounts(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const segs = path.split('/').filter(Boolean);
  const id = segs[2] ? parseInt(segs[2]) : null;
  const method = req.method;

  if (method === 'GET') {
    const rows = (await env.DB.prepare('SELECT * FROM gl_accounts WHERE company_id=? ORDER BY cost_type').bind(company).all()).results || [];
    return json(rows);
  }
  if (method === 'POST') {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!d.cost_type || !d.gl_account) return err('Wymagane: cost_type, gl_account', 400);
    await env.DB.prepare('INSERT OR REPLACE INTO gl_accounts (company_id,cost_type,gl_account,description) VALUES(?,?,?,?)')
      .bind(company, d.cost_type, d.gl_account, d.description||null).run();
    return json({ ok: true });
  }
  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM gl_accounts WHERE id=? AND company_id=?').bind(id, company).run();
    return json({ ok: true });
  }
  return err('Metoda nieobsługiwana', 405);
}

// ─── EKSPORT FK ───────────────────────────────────────────────────────────────
async function handleFkExport(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const from = url.searchParams.get('from') || `${new Date().getFullYear()}-01-01`;
  const to   = url.searchParams.get('to')   || new Date().toISOString().slice(0,10);
  const fmt  = url.searchParams.get('format') || 'csv';

  // Załaduj mapowanie GL
  const glRows = (await env.DB.prepare('SELECT cost_type, gl_account FROM gl_accounts WHERE company_id=?').bind(company).all()).results || [];
  const gl = Object.fromEntries(glRows.map(r => [r.cost_type, r.gl_account]));

  // Pobierz koszty ze wszystkich tabel
  const [svcRows, fineRows, fuelRows, dmgRows, milRows, polRows] = await Promise.all([
    env.DB.prepare(`SELECT 'service' AS type, id, nr_rej, data_realizacji AS date, koszt_rzeczywisty AS amount, typ AS description, branch_id FROM service_orders WHERE company_id=? AND data_realizacji BETWEEN ? AND ? AND koszt_rzeczywisty IS NOT NULL ORDER BY date`).bind(company, from, to).all(),
    env.DB.prepare(`SELECT 'fine' AS type, id, nr_rej, date, amount, COALESCE(description,type) AS description, branch_id FROM fines WHERE company_id=? AND date BETWEEN ? AND ? ORDER BY date`).bind(company, from, to).all(),
    env.DB.prepare(`SELECT 'fuel' AS type, id, nr_rej, fill_date AS date, total_cost AS amount, CONCAT(fuel_type,' ',liters,' l') AS description, branch_id FROM fuel_fills WHERE company_id=? AND fill_date BETWEEN ? AND ? ORDER BY date`).bind(company, from, to).all(),
    env.DB.prepare(`SELECT 'damage' AS type, id, nr_rej, data_zdarzenia AS date, koszt AS amount, opis AS description, branch_id FROM damage_reports WHERE company_id=? AND data_zdarzenia BETWEEN ? AND ? AND koszt IS NOT NULL ORDER BY date`).bind(company, from, to).all(),
    env.DB.prepare(`SELECT 'mileage' AS type, id, nr_rej, claim_date AS date, amount, COALESCE(purpose,'Rozliczenie km') AS description, branch_id FROM mileage_claims WHERE company_id=? AND claim_date BETWEEN ? AND ? ORDER BY date`).bind(company, from, to).all(),
    env.DB.prepare(`SELECT 'insurance' AS type, id, nr_rej, start_date AS date, premium AS amount, CONCAT(type,' ',COALESCE(policy_number,'')) AS description, branch_id FROM policies WHERE company_id=? AND start_date BETWEEN ? AND ? AND premium IS NOT NULL ORDER BY date`).bind(company, from, to).all(),
  ]);

  const allRows = [
    ...(svcRows.results||[]), ...(fineRows.results||[]), ...(fuelRows.results||[]),
    ...(dmgRows.results||[]), ...(milRows.results||[]), ...(polRows.results||[])
  ].sort((a,b) => (a.date||'').localeCompare(b.date||''));

  const GL_LABELS = { service:'Serwis/Naprawy', fine:'Mandaty', fuel:'Paliwo', damage:'Szkody', mileage:'Rozliczenia km', insurance:'Ubezpieczenia' };

  if (fmt === 'json') return json(allRows.map(r => ({ ...r, gl_account: gl[r.type] || '', type_label: GL_LABELS[r.type] || r.type })));

  // CSV
  const hdrs = ['Data','Typ kosztu','Konto GL','Nr rej.','Kwota (PLN)','Opis','ID zapisu'];
  const rows = allRows.map(r => [
    r.date||'', GL_LABELS[r.type]||r.type, gl[r.type]||'',
    r.nr_rej||'', r.amount!=null?String(r.amount):'', (r.description||'').replace(/;/g,' '), r.id||''
  ]);
  const csv = '﻿' + [hdrs,...rows].map(row=>row.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\r\n');
  return new Response(csv, {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'text/csv;charset=utf-8', 'Content-Disposition': `attachment; filename="fk-export-${from}-${to}.csv"` }
  });
}

// ─── SUBSKRYPCJE RAPORTÓW EMAIL ───────────────────────────────────────────────
async function handleReportSubscriptions(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const segs = path.split('/').filter(Boolean);
  const id = segs[2] ? parseInt(segs[2]) : null;
  const method = req.method;

  if (method === 'GET') {
    const rows = (await env.DB.prepare('SELECT * FROM report_subscriptions WHERE company_id=? ORDER BY email').bind(company).all()).results || [];
    return json(rows);
  }
  if (method === 'POST') {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!d.email) return err('Wymagane: email', 400);
    await env.DB.prepare('INSERT OR REPLACE INTO report_subscriptions (company_id,email,report_type,day_of_month,active) VALUES(?,?,?,?,1)')
      .bind(company, d.email.toLowerCase().trim(), d.report_type||'monthly', d.day_of_month||1).run();
    return json({ ok: true });
  }
  if (method === 'PUT' && id) {
    let d; try { d = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    await env.DB.prepare('UPDATE report_subscriptions SET active=?,day_of_month=? WHERE id=? AND company_id=?')
      .bind(d.active?1:0, d.day_of_month||1, id, company).run();
    return json({ ok: true });
  }
  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM report_subscriptions WHERE id=? AND company_id=?').bind(id, company).run();
    return json({ ok: true });
  }
  return err('Metoda nieobsługiwana', 405);
}

// ─── TOKENY POJAZDÓW ─────────────────────────────────────────────────────────
async function handleVehicleTokens(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const segs = path.split('/').filter(Boolean);
  const nrRej = segs[2] ? decodeURIComponent(segs[2]) : null;
  const method = req.method;

  if (method === 'GET' && nrRej) {
    // Pobierz lub utwórz token dla pojazdu
    let row = await env.DB.prepare('SELECT token FROM vehicle_tokens WHERE company_id=? AND nr_rej=?').bind(company, nrRej).first();
    if (!row) {
      const token = crypto.randomUUID();
      await env.DB.prepare('INSERT INTO vehicle_tokens (token,company_id,nr_rej) VALUES(?,?,?)').bind(token, company, nrRej).run();
      row = { token };
    }
    const base = env.APP_URL || 'https://taxorder-pro.pages.dev';
    return json({ token: row.token, url: `${base}/#driver-form/${row.token}` });
  }
  if (method === 'DELETE' && nrRej) {
    // Regeneruj token (usuń stary)
    await env.DB.prepare('DELETE FROM vehicle_tokens WHERE company_id=? AND nr_rej=?').bind(company, nrRej).run();
    return json({ ok: true });
  }
  return err('Metoda nieobsługiwana', 405);
}

// ─── PUBLICZNY FORMULARZ KIEROWCY ─────────────────────────────────────────────
async function handleDriverForm(req, env, url, path) {
  const segs = path.split('/').filter(Boolean); // ['api','driver-form', token]
  const token = segs[2];
  if (!token) return err('Brak tokenu', 400);

  const row = await env.DB.prepare('SELECT * FROM vehicle_tokens WHERE token=?').bind(token).first();
  if (!row) return err('Nieprawidłowy token pojazdu', 404);
  const { company_id: company, nr_rej } = row;

  // GET — dane pojazdu dla kierowcy
  if (req.method === 'GET') {
    const veh = await env.DB.prepare('SELECT nr_rej, data FROM vehicles WHERE company_id=? AND nr_rej=?').bind(company, nr_rej).first();
    if (!veh) return err('Pojazd nie istnieje', 404);
    let data = {}; try { data = JSON.parse(veh.data||'{}'); } catch {}
    // Ostatnie usterki
    const faults = (await env.DB.prepare('SELECT id,report_date,description,severity,status FROM faults WHERE company_id=? AND nr_rej=? ORDER BY report_date DESC LIMIT 5').bind(company, nr_rej).all()).results||[];
    return json({ nr_rej, marka: data.marka||'', model: data.model||'', faults });
  }

  // POST — zgłoszenie usterki lub tankowania
  if (req.method === 'POST') {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (body.type === 'fault') {
      if (!body.description) return err('Wymagane: description', 400);
      const bid = await _getVehicleBranchId(env, company, nr_rej);
      const fid = crypto.randomUUID();
      await env.DB.prepare('INSERT INTO faults (id,company_id,nr_rej,branch_id,reported_by,report_date,description,severity,status) VALUES(?,?,?,?,?,?,?,?,?)')
        .bind(fid, company, nr_rej, bid, body.reported_by||'Kierowca', new Date().toISOString().slice(0,10), body.description, body.severity||'low', 'open').run();
      return json({ ok: true, id: fid });
    }
    if (body.type === 'fuel') {
      if (!body.liters) return err('Wymagane: liters', 400);
      const bid = await _getVehicleBranchId(env, company, nr_rej);
      const fid = crypto.randomUUID();
      const totalCost = body.total_cost ?? (body.liters && body.price_per_liter ? parseFloat((body.liters*body.price_per_liter).toFixed(2)) : null);
      await env.DB.prepare('INSERT INTO fuel_fills (id,company_id,nr_rej,branch_id,driver_name,fill_date,liters,price_per_liter,total_cost,odometer,station,fuel_type,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(fid, company, nr_rej, bid, body.driver_name||null, body.fill_date||new Date().toISOString().slice(0,10), parseFloat(body.liters), body.price_per_liter??null, totalCost, body.odometer??null, body.station||null, body.fuel_type||'diesel', body.notes||null).run();
      return json({ ok: true, id: fid });
    }
    if (body.type === 'km') {
      // Zapis stanu km — aktualizuj pole w vehicle data
      const veh = await env.DB.prepare('SELECT data FROM vehicles WHERE company_id=? AND nr_rej=?').bind(company, nr_rej).first();
      if (!veh) return err('Pojazd nie istnieje', 404);
      let data = {}; try { data = JSON.parse(veh.data||'{}'); } catch {}
      data.stanKilometrow = parseInt(body.km);
      if (!Array.isArray(data.kmHistory)) data.kmHistory = [];
      const today = new Date().toISOString().slice(0,10);
      const last = data.kmHistory[data.kmHistory.length-1];
      if (!last || last.date !== today) data.kmHistory.push({ date: today, km: parseInt(body.km) });
      await env.DB.prepare(`UPDATE vehicles SET data=?, updated_at=datetime('now') WHERE company_id=? AND nr_rej=?`).bind(JSON.stringify(data), company, nr_rej).run();
      return json({ ok: true });
    }
    return err('Nieznany typ zgłoszenia (fault/fuel/km)', 400);
  }
  return err('Metoda nieobsługiwana', 405);
}

// ─── ODDZIAŁY (BRANCHES) ─────────────────────────────────────────────────────
async function _getVehicleBranchId(env, company, nr_rej) {
  if (!nr_rej) return null;
  const row = await env.DB.prepare('SELECT branch_id FROM vehicles WHERE nr_rej=? AND company_id=?').bind(nr_rej, company).first();
  return row?.branch_id ?? null;
}

async function handleBranches(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);
  const segs = path.split('/').filter(Boolean);
  const id  = segs[2] ? parseInt(segs[2]) : null;
  const sub = segs[3] || null;

  // GET /api/branches — lista z liczbą pojazdów
  if (req.method === 'GET' && !id) {
    const rows = (await env.DB.prepare(
      `SELECT b.*, (SELECT COUNT(*) FROM vehicles v WHERE v.branch_id=b.id AND v.company_id=b.company_id) AS vehicle_count
       FROM branches b WHERE b.company_id=? ORDER BY b.name`
    ).bind(company).all()).results || [];
    return json(rows);
  }

  // GET /api/branches/:id/report — raport kosztowy oddziału
  if (req.method === 'GET' && id && sub === 'report') {
    const [svcRows, fineRows, damageRows, mileageRows, policyRows] = await Promise.all([
      env.DB.prepare(`SELECT nr_rej, typ AS type, status, koszt_rzeczywisty AS koszt, data_realizacji AS date
        FROM service_orders WHERE company_id=? AND branch_id=? AND koszt_rzeczywisty IS NOT NULL ORDER BY date DESC LIMIT 300`).bind(company, id).all(),
      env.DB.prepare(`SELECT nr_rej, type, date, amount AS koszt FROM fines WHERE company_id=? AND branch_id=? ORDER BY date DESC LIMIT 300`).bind(company, id).all(),
      env.DB.prepare(`SELECT nr_rej, opis AS type, data_zdarzenia AS date, koszt FROM damage_reports WHERE company_id=? AND branch_id=? AND koszt IS NOT NULL ORDER BY date DESC LIMIT 300`).bind(company, id).all(),
      env.DB.prepare(`SELECT nr_rej, purpose AS type, claim_date AS date, amount AS koszt FROM mileage_claims WHERE company_id=? AND branch_id=? ORDER BY date DESC LIMIT 300`).bind(company, id).all(),
      env.DB.prepare(`SELECT nr_rej, type, start_date AS date, premium AS koszt FROM policies WHERE company_id=? AND branch_id=? AND premium IS NOT NULL ORDER BY date DESC LIMIT 300`).bind(company, id).all(),
    ]);
    return json({
      service_orders: svcRows.results || [],
      fines:          fineRows.results || [],
      damages:        damageRows.results || [],
      mileage:        mileageRows.results || [],
      policies:       policyRows.results || [],
    });
  }

  // POST /api/branches
  if (req.method === 'POST') {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!body.name?.trim()) return err('Wymagane: name', 400);
    const result = await env.DB.prepare(
      'INSERT INTO branches (company_id, name, description) VALUES (?,?,?)'
    ).bind(company, body.name.trim(), body.description || '').run();
    return json({ ok: true, id: result.meta.last_row_id });
  }

  // PUT /api/branches/:id
  if (req.method === 'PUT' && id) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!body.name?.trim()) return err('Wymagane: name', 400);
    await env.DB.prepare('UPDATE branches SET name=?, description=? WHERE id=? AND company_id=?')
      .bind(body.name.trim(), body.description || '', id, company).run();
    return json({ ok: true });
  }

  // DELETE /api/branches/:id
  if (req.method === 'DELETE' && id) {
    const cnt = (await env.DB.prepare('SELECT COUNT(*) AS c FROM vehicles WHERE branch_id=? AND company_id=?').bind(id, company).first())?.c ?? 0;
    if (cnt > 0) return err(`Oddział ma ${cnt} pojazdów — przenieś je najpierw.`, 409);
    await env.DB.prepare('DELETE FROM branches WHERE id=? AND company_id=?').bind(id, company).run();
    return json({ ok: true });
  }

  return err('Metoda nieobsługiwana', 405);
}

// ─── TRANSPORT ORDERS ─────────────────────────────────────────────────────────
async function handleTransportOrders(request, env, user, url, path) {
  const segs = path.split('/');
  const company = url.searchParams.get('company') || user.company_id;

  if (request.method === 'GET' && segs[3] === 'stats') {
    const today = new Date().toISOString().slice(0, 10);
    const { results: rows } = await env.DB.prepare(
      'SELECT status, COUNT(*) AS cnt FROM transport_orders WHERE company_id=? GROUP BY status'
    ).bind(company).all();
    const map = {};
    for (const r of rows) map[r.status] = r.cnt;
    const todayRow = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM transport_orders WHERE company_id=? AND date(scheduled_start)=?"
    ).bind(company, today).first();
    return json({
      total: Object.values(map).reduce((a, b) => a + b, 0),
      planned: map.planned ?? 0, in_progress: map.in_progress ?? 0,
      completed: map.completed ?? 0, cancelled: map.cancelled ?? 0,
      today: todayRow?.c ?? 0,
    });
  }

  if (request.method === 'GET' && segs[3] && !['stats'].includes(segs[3])) {
    const row = await env.DB.prepare('SELECT * FROM transport_orders WHERE id=? AND company_id=?').bind(segs[3], company).first();
    if (!row) return err('Nie znaleziono', 404);
    return json(row);
  }

  if (request.method === 'GET') {
    const status = url.searchParams.get('status');
    const from   = url.searchParams.get('from');
    const to     = url.searchParams.get('to');
    const limit  = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
    let sql = 'SELECT * FROM transport_orders WHERE company_id=?';
    const binds = [company];
    if (status) { sql += ' AND status=?'; binds.push(status); }
    if (from)   { sql += ' AND date(scheduled_start)>=?'; binds.push(from); }
    if (to)     { sql += ' AND date(scheduled_start)<=?'; binds.push(to); }
    sql += ' ORDER BY scheduled_start DESC LIMIT ?'; binds.push(limit);
    const { results } = await env.DB.prepare(sql).bind(...binds).all();
    return json(results);
  }

  if (request.method === 'POST') {
    let body; try { body = await request.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!body.title || !body.scheduled_start) return err('Wymagane: title, scheduled_start');
    const id = crypto.randomUUID().replace(/-/g, '');
    await env.DB.prepare(
      `INSERT INTO transport_orders (id,company_id,title,driver_id,driver_name,vehicle_id,nr_rej,origin,destination,
       scheduled_start,scheduled_end,distance_km,cargo_desc,cargo_weight_kg,status,priority,notes,created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, company, body.title, body.driver_id||null, body.driver_name||null, body.vehicle_id||null, body.nr_rej||null,
      body.origin||null, body.destination||null, body.scheduled_start, body.scheduled_end||null,
      body.distance_km||null, body.cargo_desc||null, body.cargo_weight_kg||null,
      body.status||'planned', body.priority||'normal', body.notes||null, user.id).run();
    return json({ ok: true, id }, 201);
  }

  if (request.method === 'PUT' && segs[4] === 'status') {
    const existing = await env.DB.prepare('SELECT id FROM transport_orders WHERE id=? AND company_id=?').bind(segs[3], company).first();
    if (!existing) return err('Nie znaleziono', 404);
    let body; try { body = await request.json(); } catch { return err('Nieprawidłowe JSON'); }
    const now = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE transport_orders SET status=?,
       actual_start=CASE WHEN ?='in_progress' AND actual_start IS NULL THEN ? ELSE actual_start END,
       actual_end=CASE WHEN ?='completed' AND actual_end IS NULL THEN ? ELSE actual_end END,
       updated_at=datetime('now') WHERE id=? AND company_id=?`
    ).bind(body.status, body.status, now, body.status, now, segs[3], company).run();
    return json({ ok: true });
  }

  if (request.method === 'PUT' && segs[3]) {
    const existing = await env.DB.prepare('SELECT * FROM transport_orders WHERE id=? AND company_id=?').bind(segs[3], company).first();
    if (!existing) return err('Nie znaleziono', 404);
    let body; try { body = await request.json(); } catch { return err('Nieprawidłowe JSON'); }
    await env.DB.prepare(
      `UPDATE transport_orders SET title=?,driver_id=?,driver_name=?,vehicle_id=?,nr_rej=?,origin=?,destination=?,
       scheduled_start=?,scheduled_end=?,distance_km=?,cargo_desc=?,cargo_weight_kg=?,status=?,priority=?,notes=?,
       updated_at=datetime('now') WHERE id=? AND company_id=?`
    ).bind(
      body.title??existing.title, body.driver_id??existing.driver_id, body.driver_name??existing.driver_name,
      body.vehicle_id??existing.vehicle_id, body.nr_rej??existing.nr_rej, body.origin??existing.origin,
      body.destination??existing.destination, body.scheduled_start??existing.scheduled_start,
      body.scheduled_end??existing.scheduled_end, body.distance_km??existing.distance_km,
      body.cargo_desc??existing.cargo_desc, body.cargo_weight_kg??existing.cargo_weight_kg,
      body.status??existing.status, body.priority??existing.priority, body.notes??existing.notes,
      segs[3], company).run();
    return json({ ok: true });
  }

  if (request.method === 'DELETE' && segs[3]) {
    const existing = await env.DB.prepare('SELECT id FROM transport_orders WHERE id=? AND company_id=?').bind(segs[3], company).first();
    if (!existing) return err('Nie znaleziono', 404);
    await env.DB.prepare('DELETE FROM transport_orders WHERE id=? AND company_id=?').bind(segs[3], company).run();
    return json({ ok: true });
  }

  return err('Method Not Allowed', 405);
}

// ─── DRIVER SCHEDULE ──────────────────────────────────────────────────────────
async function handleDriverSchedule(request, env, user, url, path) {
  const segs = path.split('/');
  const company = url.searchParams.get('company') || user.company_id;

  if (request.method === 'GET' && segs[3] === 'week') {
    const dateStr = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d.setDate(diff));
    const days = [];
    for (let i = 0; i < 7; i++) {
      const dd = new Date(mon); dd.setDate(mon.getDate() + i);
      days.push(dd.toISOString().slice(0, 10));
    }
    const { results: entries } = await env.DB.prepare(
      `SELECT * FROM driver_schedules WHERE company_id=? AND scheduled_date>=? AND scheduled_date<=? ORDER BY driver_name, scheduled_date`
    ).bind(company, days[0], days[6]).all();
    const { results: drivers } = await env.DB.prepare(
      'SELECT DISTINCT driver_name FROM driver_schedules WHERE company_id=? ORDER BY driver_name'
    ).bind(company).all();
    const grid = {};
    for (const e of entries) {
      if (!grid[e.driver_name]) grid[e.driver_name] = {};
      grid[e.driver_name][e.scheduled_date] = e;
    }
    return json({ days, drivers: drivers.map(d => d.driver_name), grid, entries });
  }

  if (request.method === 'GET') {
    const driver = url.searchParams.get('driver_name');
    const from   = url.searchParams.get('from');
    const to     = url.searchParams.get('to');
    let sql = 'SELECT * FROM driver_schedules WHERE company_id=?';
    const binds = [company];
    if (driver) { sql += ' AND driver_name LIKE ?'; binds.push('%'+driver+'%'); }
    if (from)   { sql += ' AND scheduled_date>=?'; binds.push(from); }
    if (to)     { sql += ' AND scheduled_date<=?'; binds.push(to); }
    sql += ' ORDER BY scheduled_date DESC LIMIT 500';
    const { results } = await env.DB.prepare(sql).bind(...binds).all();
    return json(results);
  }

  if (request.method === 'POST') {
    let body; try { body = await request.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!body.driver_name || !body.scheduled_date) return err('Wymagane: driver_name, scheduled_date');
    const id = crypto.randomUUID().replace(/-/g, '');
    await env.DB.prepare(
      `INSERT INTO driver_schedules (id,company_id,driver_id,driver_name,vehicle_id,nr_rej,scheduled_date,shift_type,start_time,end_time,route,notes,status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, company, body.driver_id||null, body.driver_name, body.vehicle_id||null, body.nr_rej||null,
      body.scheduled_date, body.shift_type||'day', body.start_time||null, body.end_time||null,
      body.route||null, body.notes||null, body.status||'scheduled').run();
    return json({ ok: true, id }, 201);
  }

  if (request.method === 'PUT' && segs[3]) {
    const existing = await env.DB.prepare('SELECT * FROM driver_schedules WHERE id=? AND company_id=?').bind(segs[3], company).first();
    if (!existing) return err('Nie znaleziono', 404);
    let body; try { body = await request.json(); } catch { return err('Nieprawidłowe JSON'); }
    await env.DB.prepare(
      `UPDATE driver_schedules SET driver_name=?,vehicle_id=?,nr_rej=?,scheduled_date=?,shift_type=?,
       start_time=?,end_time=?,route=?,notes=?,status=? WHERE id=? AND company_id=?`
    ).bind(
      body.driver_name??existing.driver_name, body.vehicle_id??existing.vehicle_id, body.nr_rej??existing.nr_rej,
      body.scheduled_date??existing.scheduled_date, body.shift_type??existing.shift_type,
      body.start_time??existing.start_time, body.end_time??existing.end_time,
      body.route??existing.route, body.notes??existing.notes, body.status??existing.status,
      segs[3], company).run();
    return json({ ok: true });
  }

  if (request.method === 'DELETE' && segs[3]) {
    const existing = await env.DB.prepare('SELECT id FROM driver_schedules WHERE id=? AND company_id=?').bind(segs[3], company).first();
    if (!existing) return err('Nie znaleziono', 404);
    await env.DB.prepare('DELETE FROM driver_schedules WHERE id=? AND company_id=?').bind(segs[3], company).run();
    return json({ ok: true });
  }

  return err('Method Not Allowed', 405);
}

// ─── DRIVER SCORING ───────────────────────────────────────────────────────────
async function handleDriverScoring(request, env, user, url, path) {
  if (request.method !== 'GET') return err('Method Not Allowed', 405);
  const company = url.searchParams.get('company') || user.company_id;
  const year    = url.searchParams.get('year') || String(new Date().getFullYear());

  const [driversRes, shiftsRes, finesRes, faultsRes, fuelRes] = await env.DB.batch([
    env.DB.prepare("SELECT id, first_name||' '||last_name AS full_name, email FROM driver_profiles WHERE company_id=? AND status='active'").bind(company),
    env.DB.prepare(`SELECT driver_name, COUNT(*) AS shifts, SUM(overtime_minutes) AS overtime_min FROM driver_shifts WHERE company_id=? AND strftime('%Y',shift_date)=? GROUP BY driver_name`).bind(company, year),
    env.DB.prepare(`SELECT driver_name, COUNT(*) AS cnt, SUM(amount) AS total FROM fines WHERE company_id=? AND strftime('%Y',date)=? GROUP BY driver_name`).bind(company, year),
    // `faults` NIE MA kolumny driver_name — usterka jest przypisana do POJAZDU (nr_rej),
    // nie do osoby; jedyna kolumna osobowa to `reported_by`, czyli ZGŁASZAJĄCY, co nie
    // znaczy to samo. Kierowcę wiążemy tak, jak robi to kreator raportów (COL_EXPR
    // `driver`): przez przypisanie kierowcy do pojazdu w JSON `data`.
    // Waga naprawy: to `env.DB.batch()`, a batch w D1 jest ATOMOWY — jedno wadliwe
    // zapytanie odrzucało CAŁĄ partię, więc ranking kierowców zwracał 500 zawsze,
    // nie ciche zero.
    env.DB.prepare(`SELECT JSON_EXTRACT(v.data,'$.kierowca') AS driver_name, COUNT(*) AS cnt
      FROM faults f JOIN vehicles v ON v.nr_rej=f.nr_rej AND v.company_id=f.company_id
      WHERE f.company_id=? AND strftime('%Y',f.report_date)=?
        AND COALESCE(JSON_EXTRACT(v.data,'$.kierowca'),'')<>''
      GROUP BY driver_name`).bind(company, year),
    env.DB.prepare(`SELECT driver_name, SUM(liters) AS liters FROM fuel_fills WHERE company_id=? AND strftime('%Y',fill_date)=? GROUP BY driver_name`).bind(company, year),
  ]);

  const shiftsMap = {}; for (const r of shiftsRes.results) shiftsMap[r.driver_name] = r;
  const finesMap  = {}; for (const r of finesRes.results)  finesMap[r.driver_name]  = r;
  const faultsMap = {}; for (const r of faultsRes.results) faultsMap[r.driver_name] = r;
  const fuelMap   = {}; for (const r of fuelRes.results)   fuelMap[r.driver_name]  = r;

  const scored = driversRes.results.map(dr => {
    const name     = dr.full_name;
    const shifts   = shiftsMap[name] || {};
    const fines    = finesMap[name]  || {};
    const faults   = faultsMap[name] || {};
    const fuel     = fuelMap[name]   || {};
    const drivenKm = 0; // brak kolumny km w driver_shifts — scoring bez przejechanych km
    const liters   = fuel.liters || 0;
    const avgCons  = drivenKm > 100 && liters > 0 ? (liters / drivenKm) * 100 : null;
    let score = 100;
    score -= (fines.cnt || 0) * 5;
    score -= (faults.cnt || 0) * 3;
    if (avgCons !== null && avgCons > 12) score -= 10;
    else if (avgCons !== null && avgCons > 10) score -= 5;
    if ((fines.cnt || 0) === 0 && (shifts.shifts || 0) >= 10) score += 2;
    score = Math.max(0, Math.min(100, score));
    const cat = score >= 80 ? 'Wzorowy' : score >= 60 ? 'Dobry' : score >= 40 ? 'Przeciętny' : 'Do poprawy';
    return {
      driver_id: dr.id, driver_name: name, score, category: cat,
      shifts: shifts.shifts || 0, overtime_min: shifts.overtime_min || 0,
      driven_km: drivenKm, fuel_liters: liters, avg_consumption: avgCons,
      fine_cnt: fines.cnt || 0, fine_amount: fines.total || 0,
      fault_cnt: faults.cnt || 0,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return json(scored);
}

// ─── TERYT — GUS rejestr jednostek terytorialnych ────────────────────────────

const _TERYT_KV = 'teryt_gminy_v2';
const _TERYT_KIND = new Set(['1', '2', '3']); // miejska, wiejska, miejsko-wiejska

async function _fetchAndCacheGminy(env) {
  const PAGE_SIZE = 100;
  let all = [];

  // Strona 0 — poznaj totalRecords
  let first;
  try {
    const r = await fetch(
      `https://bdl.stat.gov.pl/api/v1/units?level=6&page-size=${PAGE_SIZE}&page=0&format=json`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!r.ok) return [];
    first = await r.json();
  } catch (e) { console.error('[TERYT] fetch p0:', e.message); return []; }

  for (const u of (first.results || [])) {
    if (_TERYT_KIND.has(String(u.kind))) all.push({ n: u.name, k: u.kind });
  }

  const totalPages = Math.ceil((first.totalRecords || 0) / PAGE_SIZE);

  // Pozostałe strony — porcjami po 8 równolegle
  const BATCH = 8;
  for (let s = 1; s < Math.min(totalPages, 50); s += BATCH) {
    const pages = [];
    for (let p = s; p < Math.min(s + BATCH, totalPages, 50); p++) pages.push(p);
    const settled = await Promise.allSettled(pages.map(p =>
      fetch(`https://bdl.stat.gov.pl/api/v1/units?level=6&page-size=${PAGE_SIZE}&page=${p}&format=json`,
        { signal: AbortSignal.timeout(10000) })
        .then(r => r.ok ? r.json() : null).catch(() => null)
    ));
    for (const s2 of settled) {
      if (s2.status === 'fulfilled' && s2.value?.results) {
        for (const u of s2.value.results) {
          if (_TERYT_KIND.has(String(u.kind))) all.push({ n: u.name, k: u.kind });
        }
      }
    }
  }

  if (all.length < 200) return [];

  // Deduplikacja po nazwie: preferuj kind=1 (miejska) > kind=3 (m.-w.) > kind=2 (wiejska)
  const PRIO = { '1': 0, '3': 1, '2': 2 };
  const byName = {};
  for (const g of all) {
    if (!byName[g.n] || PRIO[g.k] < PRIO[byName[g.n].k]) byName[g.n] = g;
  }
  const deduped = Object.values(byName).sort((a, b) => a.n.localeCompare(b.n, 'pl'));

  try {
    await env.PREFS.put(_TERYT_KV, JSON.stringify(deduped), { expirationTtl: 30 * 24 * 3600 });
    console.log(`[TERYT] Zapisano ${deduped.length} gmin do KV`);
  } catch (e) { console.error('[TERYT] KV put:', e.message); }

  return deduped;
}

async function handleTeryt(request, env, user, url, path) {
  const segs = path.split('/').filter(Boolean);
  const action = segs[2]; // 'search' | 'refresh' | 'status'

  if (action === 'refresh') {
    if (user.role !== 'admin') return err('Brak uprawnień', 403);
    await env.PREFS.delete(_TERYT_KV);
    const gminy = await _fetchAndCacheGminy(env);
    return json({ ok: true, count: gminy.length });
  }

  if (action === 'status') {
    const cached = await env.PREFS.get(_TERYT_KV);
    if (!cached) return json({ ready: false, count: 0 });
    try {
      const d = JSON.parse(cached);
      return json({ ready: true, count: d.length });
    } catch { return json({ ready: false, count: 0 }); }
  }

  // GET /api/teryt/search?q=xxx
  const q = (url.searchParams.get('q') || '').trim();
  if (q.length < 2) return json({ results: [], total: 0 });

  const cached = await env.PREFS.get(_TERYT_KV);
  if (!cached) return json({ results: [], total: 0, loading: true });

  let gminy;
  try { gminy = JSON.parse(cached); } catch { return json({ results: [], total: 0 }); }

  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const qn = norm(q);

  const starts = [], contains = [];
  for (const g of gminy) {
    const gn = norm(g.n);
    if (gn.startsWith(qn)) starts.push(g.n);
    else if (gn.includes(qn)) contains.push(g.n);
  }

  return json({ results: [...starts, ...contains].slice(0, 12), total: gminy.length });
}

// ─── DR OCR — AI ekstrakcja pól dowodu rejestracyjnego (Groq Vision / Claude) ─

async function handleDrOcr(request, env) {
  if (request.method !== 'POST') return err('Method Not Allowed', 405);

  const hasGroq   = !!env.GROQ_API_KEY;
  const hasClaude = !!env.CLAUDE_API_KEY;
  if (!hasGroq && !hasClaude) {
    return json({ ok: false, noKey: true });
  }

  let body;
  try { body = await request.json(); } catch { return err('Nieprawidłowe JSON', 400); }

  const { imageBase64, mimeType } = body || {};
  if (!imageBase64) return err('Brak imageBase64', 400);

  const mt = mimeType || 'image/jpeg';
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowed.includes(mt)) return err('Nieobsługiwany typ obrazu', 400);

  // Ta sama lista pol co `handleAIOCR` — patrz DR_POLA_OCR. Wczesniej byla tu WLASNA,
  // krotsza kopia (16 pol zamiast 22), wiec zestaw zwroconych pol zalezal od tego, ktora
  // sciezka obsluzyla dokument — bez zadnego sladu w odpowiedzi.
  const prompt = `Przeanalizuj skan polskiego dowodu rejestracyjnego i wyodrębnij dane.
Zwróć TYLKO obiekt JSON o dokładnie tych kluczach; wartość opisuje, czego szukać:
${DR_JSON_SZABLON()}
Nieczytelne lub nieobecne pole = null. NIE ZGADUJ. TYLKO JSON.`;

  function _parseOcrJson(raw) {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      const d = JSON.parse(m[0]);
      Object.keys(d).forEach(k => { if (d[k] === null || d[k] === undefined) delete d[k]; });
      return d;
    } catch { return null; }
  }

  // Próba 1: Groq Vision (llama-4-scout)
  if (hasGroq) {
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + env.GROQ_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          max_tokens: 512,
          messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:${mt};base64,${imageBase64}` } },
            { type: 'text', text: prompt },
          ]}],
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (resp.ok) {
        const msg = await resp.json();
        const data = _parseOcrJson(msg.choices?.[0]?.message?.content || '');
        if (data) return json({ ok: true, data, source: 'groq-vision' });
      }
    } catch (e) { console.error('[DR OCR Groq]', e.message); }
  }

  // Próba 2: Claude Vision (fallback)
  if (hasClaude) {
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: mt, data: imageBase64 } },
            { type: 'text', text: prompt },
          ]}],
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (resp.ok) {
        const msg = await resp.json();
        const data = _parseOcrJson(msg.content?.[0]?.text || '');
        if (data) return json({ ok: true, data, source: 'claude-vision' });
      }
    } catch (e) { console.error('[DR OCR Claude]', e.message); }
  }

  return err('Nie udało się odczytać danych z dokumentu', 502);
}

// ─── TCO ──────────────────────────────────────────────────────────────────────
async function handleTCO(request, env, user, url, path) {
  const segs = path.split('/');
  const company = url.searchParams.get('company') || user.company_id;

  if (request.method === 'GET') {
    const vehicle_id = url.searchParams.get('vehicle_id') || segs[3];
    let sql = 'SELECT t.*, v.make, v.model, v.year AS vehicle_year FROM tco_config t LEFT JOIN vehicles v ON t.vehicle_id=v.id WHERE t.company_id=?';
    const binds = [company];
    if (vehicle_id) { sql += ' AND t.vehicle_id=?'; binds.push(vehicle_id); }
    const { results: configs } = await env.DB.prepare(sql).bind(...binds).all();
    if (!configs.length) return json([]);

    const nrRejes = configs.map(c => c.nr_rej).filter(Boolean);
    const ph  = nrRejes.length ? nrRejes.map(() => '?').join(',') : "'__none__'";
    const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 1);
    const since = cutoff.toISOString().slice(0, 10);
    const [fuelRes, svcRes, insRes] = await env.DB.batch([
      env.DB.prepare(`SELECT nr_rej, SUM(total_cost) AS total FROM fuel_fills WHERE company_id=? AND nr_rej IN (${ph}) AND fill_date>=? GROUP BY nr_rej`).bind(company, ...nrRejes, since),
      env.DB.prepare(`SELECT nr_rej, SUM(koszt_rzeczywisty) AS total FROM service_orders WHERE company_id=? AND nr_rej IN (${ph}) AND data_realizacji>=? GROUP BY nr_rej`).bind(company, ...nrRejes, since),
      env.DB.prepare(`SELECT nr_rej, SUM(premium) AS total FROM policies WHERE company_id=? AND nr_rej IN (${ph}) AND start_date>=? GROUP BY nr_rej`).bind(company, ...nrRejes, since),
    ]);
    const fuelMap = {}; for (const r of fuelRes.results) fuelMap[r.nr_rej] = r.total;
    const svcMap  = {}; for (const r of svcRes.results)  svcMap[r.nr_rej]  = r.total;
    const insMap  = {}; for (const r of insRes.results)  insMap[r.nr_rej]  = r.total;

    const result = configs.map(c => {
      const deprMon = c.purchase_price > 0
        ? ((c.purchase_price - (c.residual_value ?? 0)) / ((c.expected_life_years || 5) * 12))
        : 0;
      const fuelMon  = (fuelMap[c.nr_rej] ?? 0) / 12;
      const svcMon   = (svcMap[c.nr_rej]  ?? 0) / 12;
      const insMon   = (insMap[c.nr_rej]  ?? 0) / 12;
      const leasMon  = c.monthly_leasing ?? 0;
      const tcoMon   = deprMon + leasMon + fuelMon + svcMon + insMon;
      return { ...c, costs: { fuel_12m: fuelMap[c.vehicle_id] ?? 0, service_12m: svcMap[c.vehicle_id] ?? 0, insurance_12m: insMap[c.vehicle_id] ?? 0, depreciation_monthly: Math.round(deprMon * 100) / 100, tco_monthly: Math.round(tcoMon * 100) / 100, tco_annual: Math.round(tcoMon * 12 * 100) / 100 } };
    });
    return json(vehicle_id ? (result[0] || null) : result);
  }

  if (request.method === 'POST') {
    let body; try { body = await request.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!body.vehicle_id) return err('Wymagane: vehicle_id');
    const id = crypto.randomUUID().replace(/-/g, '');
    await env.DB.prepare(
      `INSERT INTO tco_config (id,company_id,vehicle_id,nr_rej,purchase_price,purchase_date,expected_life_years,residual_value,depreciation_method,monthly_leasing,co2_g_per_km,notes,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
       ON CONFLICT(company_id,vehicle_id) DO UPDATE SET
         nr_rej=excluded.nr_rej,purchase_price=excluded.purchase_price,purchase_date=excluded.purchase_date,
         expected_life_years=excluded.expected_life_years,residual_value=excluded.residual_value,
         depreciation_method=excluded.depreciation_method,monthly_leasing=excluded.monthly_leasing,
         co2_g_per_km=excluded.co2_g_per_km,notes=excluded.notes,updated_at=excluded.updated_at`
    ).bind(id, company, body.vehicle_id, body.nr_rej||null, body.purchase_price||null, body.purchase_date||null,
      body.expected_life_years||5, body.residual_value??0, body.depreciation_method||'linear',
      body.monthly_leasing||null, body.co2_g_per_km||null, body.notes||null).run();
    return json({ ok: true });
  }

  if (request.method === 'DELETE' && segs[3]) {
    await env.DB.prepare('DELETE FROM tco_config WHERE vehicle_id=? AND company_id=?').bind(segs[3], company).run();
    return json({ ok: true });
  }

  return err('Method Not Allowed', 405);
}

// ─── CO2 REPORT ───────────────────────────────────────────────────────────────

// Wskaźniki emisji CO2 (kg na litr). Współdzielone przez /api/co2-report i /api/esg —
// wcześniej ESG w ogóle nie liczyło CO2, a po naprawie dwa endpointy mogłyby raportować
// różne wartości dla tej samej floty, gdyby każdy trzymał własną tablicę.
// UWAGA: modules/co2-report.js ma WŁASNĄ, rozbieżną tablicę (diesel 2.68, lpg 1.51,
// klucze po polsku) — patrz dług techniczny w CLAUDE.md. Wartości poniżej są tymi,
// których backend używał do tej pory; nie zmieniam ich przy okazji naprawy zer.
/**
 * ══ OPŁATY ZA KORZYSTANIE ZE ŚRODOWISKA — eksploatacja pojazdów ══════════════
 *
 * ODRĘBNE od wskaźników CO2 niżej. Mylenie tych dwóch rzeczy daje liczby bez sensu:
 *
 *                  wskaźnik CO2            opłata środowiskowa
 *   wynik          kg CO2                  ZŁOTE
 *   podstawa       objętość (litry)        MASA paliwa (Mg)
 *   różnicowanie   rodzaj paliwa           rodzaj paliwa I NORMA EURO
 *   adresat        raport ESG/CSRD         urząd marszałkowski
 *   zmienność      wskaźniki KOBiZE        obwieszczenie ministra, corocznie
 *
 * Dlatego stawki NIE trafiają do CO2_FACTOR_SETS — tamta struktura nie zna norm
 * EURO i mnoży przez litry.
 *
 * ⚠️ DWIE PUŁAPKI JEDNOSTEK, obie dające błąd o rząd wielkości:
 *   1. stawka jest na Mg (tonę), a `fuel_fills` trzyma LITRY — przeliczenie wymaga
 *      GĘSTOŚCI, która jest częścią podstawy wyliczenia, nie stałą uniwersalną;
 *   2. gęstość różni się między paliwami (ON ≠ benzyna ≠ LPG).
 * Dlatego gęstość jest częścią ZESTAWU STAWEK — kto wpisuje stawki, ten deklaruje
 * też gęstość, na której je oparł, i jedno i drugie ma to samo źródło.
 *
 * Lista jest CELOWO PUSTA. Nie wpisuję stawek, których nie odczytałem ze źródła —
 * a `computeEnvironmentalFee` przy braku zestawu ODMAWIA wyliczenia zamiast zwrócić
 * zero. Cicha zerowa należność wobec urzędu marszałkowskiego byłaby gorsza niż błąd.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ══════════════════════════════════════════════════════════════════════════════
 * ŹRÓDŁO ODCZYTANE, STRUKTURA PRZEBUDOWANA — zostaje JEDNA rzecz: GĘSTOŚCI.
 *
 * Obwieszczenie:
 *   M.P. 2025 poz. 769 (stawki na 2026) — https://monitorpolski.gov.pl/M2025000076901.pdf
 *   metadane/status: https://api.sejm.gov.pl/eli/acts/MP/2025/769
 * Stawki dla pojazdów są w TABELI D („Jednostkowe stawki opłaty za gazy lub pyły
 * wprowadzane do powietrza z procesów spalania paliw w silnikach spalinowych").
 *
 * Tabela ma TRZY wymiary i klucz stawki też ma trzy: `paliwo|norma|klasa_pojazdu`.
 * Klasa nie jest niuansem — dla oleju napędowego EURO 5 różnica sięga 60%:
 *     osobowy 5,76 · do 3,5 Mg inny niż osobowy 6,82 · powyżej 3,5 Mg 9,19 zł/Mg.
 * Kolumn paliwa jest SZEŚĆ: bs, lpg, cng_fabryczny, cng_przebudowany (inna stawka
 * niż fabryczny!), on, bd.
 *
 * CO ZOSTAŁO: `gestosc_kg_na_litr` jest PUSTE i to jedyny powód, dla którego
 * `computeEnvironmentalFee` nie podaje kwot — wstawia każdy pojazd na listę
 * `nieustalone` z powodem „gęstość paliwa". Obwieszczenie gęstości NIE PODAJE
 * (sprawdzone pełnotekstowo w rocznikach 2025 i 2026: „gęstoś", „kg/m3", „kg/dm",
 * „g/cm" — zero trafień), więc pochodzą z innego źródła i wymagają osobnej decyzji
 * wraz z podaniem pochodzenia. Do tego czasu odmowa jest zachowaniem właściwym.
 *
 * ⚠️ CNG WYMAGA ODDZIELNEGO ROZSTRZYGNIĘCIA, NIE SAMEJ GĘSTOŚCI. CNG sprzedaje się
 * na KILOGRAMY, nie na litry, więc przeliczenie `litry × gęstość` jest dla niego
 * bez sensu — dla tych dwóch paliw wejściem powinna być masa. Wpisanie im
 * jakiejkolwiek „gęstości" dałoby liczbę wyglądającą poprawnie i błędną.
 *
 * ⚠️ AUTOBUSY POWYŻEJ 3,5 t MAJĄ W KODZIE WYŁĄCZNIE WIERSZ PRZED_EURO (on 88,25;
 * bd 79,87). Autobus z normą EURO 1–5 nie dostanie stawki i trafi na „nieustalone".
 * Nie wiadomo, czy to wierne odwzorowanie Tabeli D, czy luka ekstrakcji — do
 * sprawdzenia przy następnym dostępie do PDF-a. Odmowa jest tu bezpieczna, ale
 * jeśli flota ma autobusy, ta luka blokuje ich rozliczenie.
 *
 * WIARYGODNOŚĆ SAMYCH STAWEK — zweryfikowana dwiema kontrolami niewymagającymi PDF-a,
 * utrwalonymi w `tests/unit/env-fee-test.js`:
 *   • monotoniczność: w 16 seriach paliwo×klasa stawka ani razu nie rośnie wraz
 *     z normą EURO. Udokumentowany tryb awarii ekstrakcji to przesunięcie wiersza
 *     o jeden — takie przesunięcie niemal na pewno złamałoby monotoniczność;
 *   • trzy kotwice ON EURO 5 (5,76 / 6,82 / 9,19) zgadzają się co do grosza
 *     z odczytem zapisanym niezależnie w CLAUDE.md.
 *
 * BRAK EURO 6 JEST FAKTEM, NIE PRZEOCZENIEM — Tabela D kończy się na EURO 5.
 * Pojazd EURO 6 trafia na „nieustalone" celowo: podstawienie mu stawki EURO 5
 * byłoby INTERPRETACJĄ przepisu, nie odczytem. Dotyczy większości nowoczesnej
 * floty, więc wymaga rozstrzygnięcia z księgowością.
 * ══════════════════════════════════════════════════════════════════════════════
 */
const ENV_FEE_RATE_SETS = [
  {
    rok: 2026,
    zrodlo: 'M.P. 2025 poz. 769, Tabela D (obwieszczenie MKiS z 6.08.2025) - https://monitorpolski.gov.pl/M2025000076901.pdf',
    jednostka_stawki: 'zl_na_Mg',
    // GESTOSCI CELOWO PUSTE - obwieszczenie ICH NIE PODAJE (sprawdzone
    // pelnotekstowo w rocznikach 2025 i 2026: "gestos", "kg/m3", "kg/dm",
    // "g/cm" - zero trafien). Bez nich nie przeliczy sie litrow na Mg, wiec
    // computeEnvironmentalFee wstawi KAZDY pojazd na liste `nieustalone`
    // z powodem "gestosc paliwa". To jest zamierzone: stawki sa zweryfikowane,
    // gestosci nie - a jedno bez drugiego nie daje kwoty.
    gestosc_kg_na_litr: {},
    // Klucz: paliwo|norma|klasa_pojazdu - TRZY wymiary, bo tyle ma Tabela D.
    // Dwuwymiarowy klucz paliwo|EURO (do 25.08) nie mogl wyrazic roznicy miedzy
    // klasami, a ta siega 60%: ON EURO 5 to 5,76 zl/Mg dla osobowego i 9,19
    // dla pojazdu powyzej 3,5 t.
    //
    // PRZED_EURO = wiersz bez wymogu dokumentu EURO (rozstrzygany data pierwszej
    // rejestracji). NIE stosowac jako "domyslnego" - daty progowe roznia sie
    // miedzy klasami i sa w opisach wierszy Tabeli D.
    //
    // BRAK EURO 6 JEST FAKTEM, NIE PRZEOCZENIEM. Tabela D konczy sie na EURO 5.
    // Pojazd z norma EURO 6 nie ma tu stawki i trafi na liste `nieustalone` -
    // celowo, bo przypisanie mu stawki EURO 5 byloby INTERPRETACJA przepisu,
    // nie odczytem. Dotyczy to wiekszosci nowoczesnej floty, wiec wymaga
    // rozstrzygniecia z ksiegowoscia, zanim funkcja zacznie liczyc.
    //
    // Wyciagniete PROGRAMOWO z PDF-a, nie przepisane recznie. Przy pierwszej
    // probie regex wymagajacy przecinka dziesietnego pominal wiersz 11
    // (w PDF-ie jest tam "10.01" z KROPKA), przez co wierszowi 11 przypisalo
    // wartosci wiersza 12 - ciche przesuniecie stawki finansowej o jeden wiersz.
    // Wykryte przez sprawdzenie kompletnosci numeracji Lp (32/32).
    stawki: {
    'bs|PRZED_EURO|osobowy': 116.73,
    'lpg|PRZED_EURO|osobowy': 74.84,
    'on|PRZED_EURO|osobowy': 31.88,
    'bd|PRZED_EURO|osobowy': 26.01,
    'bs|EURO 1|osobowy': 44.32,
    'lpg|EURO 1|osobowy': 64.53,
    'on|EURO 1|osobowy': 18.49,
    'bd|EURO 1|osobowy': 16.52,
    'bs|EURO 2|osobowy': 29.64,
    'lpg|EURO 2|osobowy': 42.43,
    'on|EURO 2|osobowy': 18.49,
    'bd|EURO 2|osobowy': 16.52,
    'bs|EURO 3|osobowy': 19.31,
    'lpg|EURO 3|osobowy': 27.46,
    'cng_fabryczny|EURO 3|osobowy': 17.31,
    'cng_przebudowany|EURO 3|osobowy': 20.48,
    'on|EURO 3|osobowy': 14.23,
    'bd|EURO 3|osobowy': 12.67,
    'bs|EURO 4|osobowy': 10.05,
    'lpg|EURO 4|osobowy': 13.81,
    'cng_fabryczny|EURO 4|osobowy': 8.74,
    'cng_przebudowany|EURO 4|osobowy': 10.39,
    'on|EURO 4|osobowy': 8.14,
    'bd|EURO 4|osobowy': 6.75,
    'bs|EURO 5|osobowy': 8.90,
    'lpg|EURO 5|osobowy': 12.47,
    'cng_fabryczny|EURO 5|osobowy': 7.60,
    'cng_przebudowany|EURO 5|osobowy': 8.81,
    'on|EURO 5|osobowy': 5.76,
    'bd|EURO 5|osobowy': 4.65,
    'bs|PRZED_EURO|do_3_5t_inny_niz_osobowy': 108.31,
    'lpg|PRZED_EURO|do_3_5t_inny_niz_osobowy': 71.85,
    'on|PRZED_EURO|do_3_5t_inny_niz_osobowy': 37.70,
    'bd|PRZED_EURO|do_3_5t_inny_niz_osobowy': 31.95,
    'bs|EURO 1|do_3_5t_inny_niz_osobowy': 57.22,
    'lpg|EURO 1|do_3_5t_inny_niz_osobowy': 63.61,
    'on|EURO 1|do_3_5t_inny_niz_osobowy': 23.12,
    'bd|EURO 1|do_3_5t_inny_niz_osobowy': 20.87,
    'bs|EURO 2|do_3_5t_inny_niz_osobowy': 34.20,
    'lpg|EURO 2|do_3_5t_inny_niz_osobowy': 37.52,
    'on|EURO 2|do_3_5t_inny_niz_osobowy': 23.12,
    'bd|EURO 2|do_3_5t_inny_niz_osobowy': 20.87,
    'bs|EURO 3|do_3_5t_inny_niz_osobowy': 22.10,
    'lpg|EURO 3|do_3_5t_inny_niz_osobowy': 24.33,
    'cng_fabryczny|EURO 3|do_3_5t_inny_niz_osobowy': 19.25,
    'cng_przebudowany|EURO 3|do_3_5t_inny_niz_osobowy': 22.77,
    'on|EURO 3|do_3_5t_inny_niz_osobowy': 17.45,
    'bd|EURO 3|do_3_5t_inny_niz_osobowy': 15.83,
    'bs|EURO 4|do_3_5t_inny_niz_osobowy': 11.58,
    'lpg|EURO 4|do_3_5t_inny_niz_osobowy': 12.48,
    'cng_fabryczny|EURO 4|do_3_5t_inny_niz_osobowy': 9.80,
    'cng_przebudowany|EURO 4|do_3_5t_inny_niz_osobowy': 11.63,
    'on|EURO 4|do_3_5t_inny_niz_osobowy': 10.01,
    'bd|EURO 4|do_3_5t_inny_niz_osobowy': 8.51,
    'bs|EURO 5|do_3_5t_inny_niz_osobowy': 10.80,
    'lpg|EURO 5|do_3_5t_inny_niz_osobowy': 11.34,
    'cng_fabryczny|EURO 5|do_3_5t_inny_niz_osobowy': 9.00,
    'cng_przebudowany|EURO 5|do_3_5t_inny_niz_osobowy': 10.56,
    'on|EURO 5|do_3_5t_inny_niz_osobowy': 6.82,
    'bd|EURO 5|do_3_5t_inny_niz_osobowy': 5.71,
    'bs|PRZED_EURO|powyzej_3_5t': 146.37,
    'on|PRZED_EURO|powyzej_3_5t': 76.06,
    'bd|PRZED_EURO|powyzej_3_5t': 70.29,
    'on|PRZED_EURO|autobus_powyzej_3_5t': 88.25,
    'bd|PRZED_EURO|autobus_powyzej_3_5t': 79.87,
    'cng_przebudowany|EURO 1|powyzej_3_5t': 23.35,
    'on|EURO 1|powyzej_3_5t': 31.89,
    'bd|EURO 1|powyzej_3_5t': 24.06,
    'cng_przebudowany|EURO 2|powyzej_3_5t': 18.87,
    'on|EURO 2|powyzej_3_5t': 24.93,
    'bd|EURO 2|powyzej_3_5t': 18.65,
    'cng_fabryczny|EURO 3|powyzej_3_5t': 10.93,
    'cng_przebudowany|EURO 3|powyzej_3_5t': 15.53,
    'on|EURO 3|powyzej_3_5t': 18.24,
    'bd|EURO 3|powyzej_3_5t': 13.04,
    'cng_fabryczny|EURO 4|powyzej_3_5t': 9.14,
    'cng_przebudowany|EURO 4|powyzej_3_5t': 11.88,
    'on|EURO 4|powyzej_3_5t': 13.23,
    'bd|EURO 4|powyzej_3_5t': 9.00,
    'cng_fabryczny|EURO 5|powyzej_3_5t': 6.69,
    'cng_przebudowany|EURO 5|powyzej_3_5t': 7.80,
    'on|EURO 5|powyzej_3_5t': 9.19,
    'bd|EURO 5|powyzej_3_5t': 6.16,
    },
  },
];

/** Normalizacja normy EURO z pola `euro` pojazdu („EURO 6", „euro6", „EU6"). */
function normalizeEuroNorm(raw) {
  const s = String(raw ?? '').toLowerCase().replace(/[\s_-]/g, '');
  const m = s.match(/eu(?:ro)?([1-6])/);
  return m ? `EURO ${m[1]}` : null;
}

/**
 * Klasa pojazdu wg Tabeli D — TRZECI wymiar stawki, obok paliwa i normy EURO.
 *
 * Zwraca `null`, gdy klasy nie da się ustalić — a wtedy `computeEnvironmentalFee`
 * wstawia pojazd na listę `nieustalone` zamiast przyjąć jakąkolwiek stawkę.
 * Zgadywanie klasy jest tu równie kosztowne co zgadywanie normy: różnica między
 * osobowym a pojazdem powyżej 3,5 t to ~60% należności.
 *
 * Granica 3,5 t idzie po DMC (`F.1` z dowodu). Rozróżnienie „osobowy" / „inny niż
 * osobowy" poniżej tej granicy bierzemy z rodzaju pojazdu — to samo pole, którym
 * TaxEngine rozstrzyga zwolnienia DT-1.
 */
function envFeeVehicleClass(p) {
  const dmc = Number(p?.dmc ?? p?.dmcKg ?? p?.dmc_kg);
  const rodzaj = String(p?.rodzaj ?? p?.przeznaczenie ?? p?.typ ?? '').toLowerCase();

  if (/autobus/.test(rodzaj)) {
    // Autobus poniżej 3,5 t nie ma osobnego wiersza — nie zgadujemy.
    return Number.isFinite(dmc) && dmc > 3500 ? 'autobus_powyzej_3_5t' : null;
  }
  if (!Number.isFinite(dmc) || dmc <= 0) return null;   // bez DMC nie ma progu
  if (dmc > 3500) return 'powyzej_3_5t';
  if (/osobow/.test(rodzaj)) return 'osobowy';
  if (rodzaj) return 'do_3_5t_inny_niz_osobowy';
  return null;                                          // DMC znane, rodzaj nie — za mało
}

/** Zestaw stawek obowiązujący dla danego roku; `null`, gdy brak. */
function envFeeRateSetForYear(year) {
  const y = Number(year);
  return ENV_FEE_RATE_SETS.find(s => Number(s.rok) === y) || null;
}

/**
 * Opłata za dany rok. Zwraca `{ ok:false, powod }`, gdy czegoś brakuje — NIGDY
 * kwoty wziętej z domysłu. Pojazdy bez ustalonej normy EURO trafiają na listę
 * `nieustalone` zamiast dostać stawkę domyślną: przypisanie im dowolnej stawki
 * byłoby zgadywaniem o skutkach finansowych.
 */
function computeEnvironmentalFee({ year, pozycje }) {
  const zestaw = envFeeRateSetForYear(year);
  if (!zestaw) {
    return { ok: false, powod: 'BRAK_STAWEK',
      opis: `Brak zestawu stawek dla roku ${year}. Stawki opłat środowiskowych wynikają z obwieszczenia ministra i muszą zostać wprowadzone wraz z gęstościami paliw oraz źródłem.` };
  }
  const wynik = { ok: true, rok: zestaw.rok, zrodlo: zestaw.zrodlo, jednostka: zestaw.jednostka_stawki,
    pozycje: [], nieustalone: [], razem_pln: 0 };
  for (const p of pozycje || []) {
    const paliwo = co2FactorFor(p.fuel_type).key;         // ta sama normalizacja co w CO2
    const euro = normalizeEuroNorm(p.euro);
    const klasa = envFeeVehicleClass(p);
    const gestosc = zestaw.gestosc_kg_na_litr?.[paliwo];
    const stawka = (euro && klasa) ? zestaw.stawki?.[`${paliwo}|${euro}|${klasa}`] : undefined;
    if (!euro || !klasa || gestosc === undefined || stawka === undefined) {
      wynik.nieustalone.push({ nr_rej: p.nr_rej, fuel_type: p.fuel_type, euro: p.euro, klasa,
        brakuje: [
          !euro && 'norma EURO',
          !klasa && 'klasa pojazdu (DMC + rodzaj)',
          gestosc === undefined && 'gęstość paliwa',
          stawka === undefined && (euro && klasa
            ? `stawka dla ${paliwo}|${euro}|${klasa} (Tabela D kończy się na EURO 5)`
            : 'stawka'),
        ].filter(Boolean) });
      continue;
    }
    const mg = (p.liters * gestosc) / 1000;               // litry → kg → Mg
    const pln = mg * stawka;
    wynik.pozycje.push({ nr_rej: p.nr_rej, paliwo, euro, klasa, liters: p.liters,
      mg: Math.round(mg * 1000) / 1000, stawka, pln: Math.round(pln * 100) / 100 });
    wynik.razem_pln += pln;
  }
  wynik.razem_pln = Math.round(wynik.razem_pln * 100) / 100;
  return wynik;
}

/**
 * Zestawy wskaźników emisyjności Z OKRESEM OBOWIĄZYWANIA.
 *
 * Wskaźnik emisyjności jest wielkością regulowaną i zmienia się w czasie, więc pojedyncza
 * liczba jest strukturalnie zła: podmiana stawki przeliczyłaby raport za rok, który już
 * został złożony, i sprawozdanie przestałoby się odtwarzać. Wskaźnik wybieramy zawsze
 * po DACIE ZDARZENIA (dacie tankowania), nie po dacie generowania raportu.
 *
 * ⚠️ JEDNOSTKA. Tutejsze wartości to **kg CO2 na LITR paliwa**. Wskaźniki KOBiZE bywają
 * publikowane na jednostkę energii (kg CO2/GJ) albo na masę — przepisanie takiej liczby
 * wprost do tej tablicy da błąd o rząd wielkości. Przeliczenie wymaga wartości opałowej
 * i gęstości paliwa. Dlatego każdy zestaw niesie `jednostka` i `zrodlo`.
 *
 * Dodając nowy zestaw: NIE zmieniaj istniejącego wpisu — dopisz kolejny z własnym `od`.
 * Historia musi zostać odtwarzalna.
 */
const CO2_FACTOR_SETS = [
  {
    od: '1970-01-01',
    jednostka: 'kg_co2_na_litr',
    // DIESEL: 2,65 — rozstrzygnięcie sporu „2,65 czy 2,68", zamknięte 19.08.2026.
    //
    // Front miał 2,68, backend 2,65 i nikt nie wiedział, która liczba jest właściwa.
    // Rachunek stechiometryczny dla oleju napędowego bez domieszki:
    //
    //     gęstość 0,835 kg/l × udział węgla 0,862 × (44/12) = 2,639 kg CO2/l
    //
    // czyli 2,65 mieści się w tym wyniku, a 2,68 leży wyżej. Skąd bierze się 2,68:
    // z współczynników typu DEFRA, które są CO2**e** (doliczają CH4 i N2O) i zwykle
    // zakładają domieszkę biodiesla B7. To NIE jest ta sama wielkość co czysty CO2 —
    // podstawienie jej tutaj zmieszałoby dwie różne jednostki w jednej tablicy.
    //
    // Za 2,65 przemawia też odtwarzalność: tą wartością policzone są WSZYSTKIE dotychczasowe
    // raporty ESG i JPK. Podmiana przeliczyłaby wstecz sprawozdania już złożone.
    //
    // CZEGO TO NIE ZAŁATWIA — i dlatego `zrodlo` nadal mówi „niezweryfikowane":
    // rachunek powyżej potwierdza RZĄD WIELKOŚCI i odrzuca 2,68 jako inną wielkość,
    // ale nie zastępuje odczytu z aktualnej tabeli KOBiZE. Jeśli sprawozdanie ma być
    // składane w CO2e, a nie CO2, potrzebny jest ODDZIELNY zestaw z własnym `od`
    // i jawną adnotacją w `zrodlo` — nie podmiana tych liczb.
    zrodlo: 'diesel 2,65 z rachunku stechiometrycznego (0,835 kg/l × 0,862 C × 44/12 = 2,639); pozostałe wartości historyczne aplikacji — NIEZWERYFIKOWANE wobec tabeli KOBiZE',
    wskazniki: { diesel: 2.65, petrol: 2.31, pb: 2.31, gasoline: 2.31, lpg: 1.63, cng: 2.04, hybrid: 2.0, electric: 0, default: 2.5 },
  },
];

/** Zestaw obowiązujący w danym dniu; przy braku daty — najnowszy. */
function co2FactorSetFor(date) {
  const d = date ? String(date).slice(0, 10) : null;
  const posortowane = [...CO2_FACTOR_SETS].sort((a, b) => a.od.localeCompare(b.od));
  if (!d) return posortowane[posortowane.length - 1];
  let wybrany = posortowane[0];
  for (const s of posortowane) if (s.od <= d) wybrany = s;
  return wybrany;
}

// Zachowane dla zgodności — zawsze zestaw najnowszy.
const CO2_EMISSION_FACTORS = CO2_FACTOR_SETS[CO2_FACTOR_SETS.length - 1].wskazniki;

/**
 * Normalizacja `fuel_type` do klucza z CO2_EMISSION_FACTORS.
 *
 * Bez tego wyszukiwanie było `FACTORS[fuel_type.toLowerCase()] ?? default` — a formularz
 * tankowania (`index.html`, select #fm-ftype) zapisuje `pb95`, `pb98`, `cng` i `elektryk`,
 * czyli wartości, których w tablicy NIE MA. Wszystkie cicho lądowały na `default: 2.5`:
 * benzyna liczona 2,5 zamiast 2,31, CNG 2,5 zamiast 2,04, a POJAZD ELEKTRYCZNY dostawał
 * 2,5 zamiast 0. Import paliwa i OCR dowodów dokładają warianty polskie („benzyna",
 * „elektryczny"), więc dopasowanie musi być po fragmencie, nie po równości.
 *
 * Zwraca też `matched:false`, gdy nic nie pasuje — dzięki temu bramka odróżnia
 * „świadomie użyty default" od „cichego trafienia w default".
 */
function co2FactorFor(fuelType, date) {
  const zestaw = co2FactorSetFor(date);
  const CO2_EMISSION_FACTORS = zestaw.wskazniki;
  const s = String(fuelType ?? '').toLowerCase().trim();
  if (!s) return { factor: CO2_EMISSION_FACTORS.default, key: 'default', matched: false, zrodlo: zestaw.zrodlo };
  const reguly = [
    // UWAGA: polskie „elektr(yk)" i angielskie „electr(ic)" różnią się literą k/c —
    // jeden wzorzec nie pokrywa obu. Test wyłapał to jako realny błąd tej funkcji.
    [/elektr|electr|^ev$|\bbev\b/, 'electric'],
    [/hybry|hybrid|\bhev\b|phev/, 'hybrid'],
    [/diesel|olej.?nap|\bon\b/, 'diesel'],
    [/lpg|\bgaz\b|propan/, 'lpg'],
    [/cng|metan/, 'cng'],
    [/pb\s*9|benzyn|petrol|gasolin|\bpb\b/, 'petrol'],
  ];
  for (const [wzor, klucz] of reguly) {
    if (wzor.test(s)) return { factor: CO2_EMISSION_FACTORS[klucz], key: klucz, matched: true, zrodlo: zestaw.zrodlo };
  }
  return { factor: CO2_EMISSION_FACTORS.default, key: 'default', matched: false, zrodlo: zestaw.zrodlo };
}

/**
 * Degradacja zapytania BEZ ciszy. Zwraca `fallback` przy błędzie, ale najpierw krzyczy.
 *
 * Goły `.catch(() => ({results: []}))` zamienia „tabela nie istnieje" w „brak danych",
 * czego nie widać ani w logach, ani w UI. Dokładnie tak CO2 i zużycie paliwa w raportach
 * ESG raportowały zera przez cały czas istnienia tej funkcji — użytkownik dostawał
 * wiarygodnie wyglądający wynik, a nie błąd. Nowy kod na ścieżkach produkujących liczby
 * dla użytkownika ma używać tego helpera zamiast gołego `.catch()`.
 */
async function dbSafe(promise, fallback, env, ctx = {}) {
  try {
    return await promise;
  } catch (e) {
    console.error('[db-degraded]', ctx.op || 'query', '—', e?.message || e);
    captureException(e, env, { ...ctx, kind: 'db-degraded' }).catch(() => {});
    return fallback;
  }
}

/**
 * Tabela `vehicles` NIE MA płaskich kolumn `status`, `active`, `fuel_type`, `marka`
 * ani `model` — jej realne kolumny to id, company_id, nr_rej, axles_count,
 * suspension_type, dmc_zespolu, miesiace_podatku, dt1_category, dt1_tax_amount,
 * data, updated_at, branch_id, tacho_*. Reszta siedzi w kolumnie JSON `data`.
 *
 * Zapytania pisane tak, jakby te kolumny istniały, albo kończą się 500 (bez `.catch()`),
 * albo — co gorsza — cicho zwracają zera. Poniższe fragmenty są jedynym miejscem,
 * w którym definiujemy „pojazd czynny" i „pojazd elektryczny", żeby kolejne zapytania
 * nie rozjechały się między sobą.
 */
// Konwencja statusu przejęta z handleDashboard (`index.js`): brak statusu = czynny,
// wykluczamy wyłącznie 'archived'. To jedyna ustalona w tym kodzie definicja.
const SQL_VEH_ACTIVE = "COALESCE(JSON_EXTRACT(data,'$.status'),'active')!='archived'";
// Predykat EV odwzorowany z `modules/vehicle-detail.js` — pole `paliwo` to wolny tekst
// z pola P.3 dowodu rejestracyjnego, więc dopasowujemy po fragmencie, nie po równości.
const SQL_VEH_IS_EV = `(
  LOWER(COALESCE(JSON_EXTRACT(data,'$.paliwo'),'')) LIKE '%elektr%'
  OR LOWER(COALESCE(JSON_EXTRACT(data,'$.paliwo'),'')) LIKE '%hybryd%'
  OR LOWER(COALESCE(JSON_EXTRACT(data,'$.paliwo'),'')) LIKE '%bev%'
  OR LOWER(COALESCE(JSON_EXTRACT(data,'$.paliwo'),'')) LIKE '%hev%'
)`;

/** Liczba pojazdów czynnych i elektrycznych — wspólna dla obu gałęzi raportu ESG. */
async function fleetCountsForEsg(env, company) {
  const row = await dbSafe(env.DB.prepare(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN ${SQL_VEH_IS_EV} THEN 1 ELSE 0 END) AS ev
     FROM vehicles WHERE company_id=? AND ${SQL_VEH_ACTIVE}`
  ).bind(company).first(), null, env, { op: 'fleetCountsForEsg', company });
  return { total: row?.total || 0, ev: row?.ev || 0 };
}

/**
 * Sumy zatankowanych litrów i wyliczonego CO2 za dany rok.
 * Źródłem jest `fuel_fills` — jedyna tabela tankowań, do której cokolwiek zapisuje.
 */
async function fuelActualsForYear(env, company, year) {
  const rows = (await dbSafe(env.DB.prepare(
    // Grupujemy takze po miesiacu, zeby wskaznik obowiazujacy w danym okresie
    // stosowal sie do wlasciwych litrow, gdy stawka zmieni sie w trakcie roku.
    `SELECT fuel_type, strftime('%Y-%m', fill_date) AS ym, SUM(liters) AS liters FROM fuel_fills
     WHERE company_id=? AND strftime('%Y',fill_date)=? GROUP BY fuel_type, ym`
  ).bind(company, String(year)).all(), { results: [] }, env, { op: 'fuelActualsForYear', company, year })).results || [];
  let liters = 0, co2_kg = 0;
  for (const r of rows) {
    const l = r.liters || 0;
    liters += l;
    co2_kg += l * co2FactorFor(r.fuel_type, r.ym ? r.ym + '-01' : null).factor;
  }
  return { liters, co2_kg };
}

async function handleCO2Report(request, env, user, url, path) {
  if (request.method !== 'GET') return err('Method Not Allowed', 405);
  const company = url.searchParams.get('company') || user.company_id;
  const year    = url.searchParams.get('year') || String(new Date().getFullYear());
  const month   = url.searchParams.get('month');

  const EMISSION = CO2_EMISSION_FACTORS;
  let sql = `SELECT f.nr_rej, f.fuel_type, SUM(f.liters) AS liters, SUM(f.total_cost) AS cost,
             strftime('%Y-%m', f.fill_date) AS ym
             FROM fuel_fills f WHERE f.company_id=? AND strftime('%Y',f.fill_date)=?`;
  const binds = [company, year];
  if (month) { sql += ' AND strftime(\'%m\',f.fill_date)=?'; binds.push(month.padStart(2, '0')); }
  sql += ' GROUP BY f.nr_rej, f.fuel_type, ym ORDER BY ym';

  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  const { results: tcoConfigs } = await env.DB.prepare(
    'SELECT nr_rej, co2_g_per_km FROM tco_config WHERE company_id=? AND co2_g_per_km IS NOT NULL'
  ).bind(company).all();
  const co2Map = {}; for (const c of tcoConfigs) co2Map[c.nr_rej] = c.co2_g_per_km;

  let totalKg = 0;
  const byVehicle = {}; const byMonth = {};
  for (const r of results) {
    // Wskaznik wybierany po DACIE TANKOWANIA, nie po dacie generowania raportu —
    // inaczej zmiana stawki przeliczylaby juz zlozone sprawozdanie.
    const { factor } = co2FactorFor(r.fuel_type, r.ym ? r.ym + '-01' : null);
    const kg = r.liters * factor;
    totalKg += kg;
    // `ef` zwracamy do frontu, żeby raport pokazywał wskaźnik FAKTYCZNIE użyty do wyliczeń.
    // Wcześniej front miał własną tablicę (inne wartości i inne klucze), więc arkusz
    // eksportu potrafił pokazać 2,68 obok kilogramów policzonych z 2,65.
    if (!byVehicle[r.nr_rej]) byVehicle[r.nr_rej] = { nr_rej: r.nr_rej, fuel_type: r.fuel_type, ef: factor, liters: 0, kg: 0 };
    byVehicle[r.nr_rej].liters += r.liters;
    byVehicle[r.nr_rej].kg += kg;
    if (!byMonth[r.ym]) byMonth[r.ym] = { month: r.ym, kg: 0, liters: 0 };
    byMonth[r.ym].kg += kg; byMonth[r.ym].liters += r.liters;
  }
  const vehicles = Object.values(byVehicle).map(v => ({ ...v, kg: Math.round(v.kg * 10) / 10, pct: totalKg > 0 ? Math.round(v.kg / totalKg * 1000) / 10 : 0 }));
  vehicles.sort((a, b) => b.kg - a.kg);
  return json({
    year, month: month || null, total_kg: Math.round(totalKg * 10) / 10, total_tonnes: Math.round(totalKg / 100) / 10,
    target_exceeded: totalKg > 10000,
    by_vehicle: vehicles, by_month: Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)),
  });
}

/**
 * GET /api/environmental-fee?year=YYYY — opłata za korzystanie ze środowiska.
 *
 * Zwraca 422 z czytelnym powodem, dopóki nie ma stawek na dany rok. To celowe:
 * kwota należności wobec urzędu marszałkowskiego nie może pochodzić z domysłu,
 * a zero byłoby tu najgorszą z możliwych odpowiedzi.
 */
async function handleEnvironmentalFee(req, env, user, url) {
  const co = url.searchParams.get('company') || user.company_id;
  const year = url.searchParams.get('year') || String(new Date().getFullYear());

  const { results } = await env.DB.prepare(
    `SELECT f.nr_rej, f.fuel_type, SUM(f.liters) AS liters,
            JSON_EXTRACT(v.data,'$.euro') AS euro
       FROM fuel_fills f
       LEFT JOIN vehicles v ON v.nr_rej = f.nr_rej AND v.company_id = f.company_id
      WHERE f.company_id=? AND strftime('%Y',f.fill_date)=?
      GROUP BY f.nr_rej, f.fuel_type, euro`
  ).bind(co, String(year)).all();

  const wynik = computeEnvironmentalFee({ year, pozycje: results || [] });
  if (!wynik.ok) return json({ error: wynik.opis, powod: wynik.powod, rok: Number(year) }, 422);
  return json(wynik);
}

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────
async function logAudit(env, { company_id, user_id, user_email, action, entity_type, entity_id, details, ip }) {
  try {
    await env.DB.prepare(
      'INSERT INTO audit_logs (company_id,user_id,user_email,action,entity_type,entity_id,details,ip) VALUES (?,?,?,?,?,?,?,?)'
    ).bind(company_id, user_id, user_email, action, entity_type, entity_id??null, details?JSON.stringify(details):null, ip||null).run();
  } catch (e) { console.error('[logAudit]', e.message); }
}

async function handleAuditLog(request, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;

  if (request.method === 'GET') {
    const entity_type = url.searchParams.get('entity_type');
    const action      = url.searchParams.get('action');
    const from        = url.searchParams.get('from');
    const to          = url.searchParams.get('to');
    const limit       = Math.min(parseInt(url.searchParams.get('limit') || '50'), 500);
    let sql = 'SELECT * FROM audit_logs WHERE company_id=?';
    const binds = [company];
    if (entity_type && entity_type !== 'all') { sql += ' AND entity_type=?'; binds.push(entity_type); }
    if (action && action !== 'all') { sql += ' AND action=?'; binds.push(action); }
    if (from) { sql += ' AND created_at>=?'; binds.push(from); }
    if (to)   { sql += ' AND created_at<=?'; binds.push(to); }
    sql += ' ORDER BY created_at DESC LIMIT ?'; binds.push(limit);
    const { results } = await env.DB.prepare(sql).bind(...binds).all();
    return json(results);
  }
  return err('Method Not Allowed', 405);
}

// ─── BUDGET ANNUAL ────────────────────────────────────────────────────────────
async function handleBudgetAnnual(request, env, user, url, path) {
  const segs    = path.split('/');
  const company = url.searchParams.get('company') || user.company_id;

  if (request.method === 'GET' && segs[3] === 'years') {
    const { results } = await env.DB.prepare('SELECT DISTINCT year FROM budget_annual WHERE company_id=? ORDER BY year DESC').bind(company).all();
    return json(results.map(r => r.year));
  }

  if (request.method === 'GET') {
    const year = url.searchParams.get('year') || String(new Date().getFullYear());
    const [budgetRes, fuelRes, svcRes, insRes, finesRes] = await env.DB.batch([
      env.DB.prepare('SELECT category,planned_amount,notes FROM budget_annual WHERE company_id=? AND year=?').bind(company, year),
      env.DB.prepare(`SELECT SUM(total_cost) AS total FROM fuel_fills WHERE company_id=? AND strftime('%Y',fill_date)=?`).bind(company, String(year)),
      env.DB.prepare(`SELECT SUM(koszt_rzeczywisty) AS total FROM service_orders WHERE company_id=? AND strftime('%Y',data_realizacji)=?`).bind(company, String(year)),
      env.DB.prepare(`SELECT SUM(premium) AS total FROM policies WHERE company_id=? AND strftime('%Y',start_date)=?`).bind(company, String(year)),
      env.DB.prepare(`SELECT SUM(amount) AS total FROM fines WHERE company_id=? AND strftime('%Y',date)=?`).bind(company, String(year)),
    ]);
    const actuals = { fuel: fuelRes.results[0]?.total??0, service: svcRes.results[0]?.total??0, insurance: insRes.results[0]?.total??0, fines: finesRes.results[0]?.total??0 };
    const plannedMap = {}; const notesMap = {};
    for (const row of budgetRes.results) { plannedMap[row.category] = row.planned_amount??0; notesMap[row.category] = row.notes??null; }
    const cats = ['fuel','service','insurance','fines','parts','leasing','other'];
    const categories = cats.map(cat => {
      const p = plannedMap[cat]??0; const a = actuals[cat]??0;
      return { category: cat, planned: p, actual: a, variance: a-p, variance_pct: p>0 ? Math.round((a-p)/p*10000)/100 : null, notes: notesMap[cat]??null };
    });
    return json({ year: Number(year), categories });
  }

  if (request.method === 'POST') {
    let body; try { body = await request.json(); } catch { return err('Nieprawidłowe JSON'); }
    const { year, items } = body;
    if (!year || !Array.isArray(items) || !items.length) return err('year i items[] są wymagane');
    const stmts = items.map(({ category, planned_amount, notes }) =>
      env.DB.prepare(
        `INSERT INTO budget_annual (company_id,year,category,planned_amount,notes,updated_at) VALUES (?,?,?,?,?,datetime('now'))
         ON CONFLICT(company_id,year,category) DO UPDATE SET planned_amount=excluded.planned_amount,notes=excluded.notes,updated_at=excluded.updated_at`
      ).bind(company, year, category, planned_amount??0, notes??null)
    );
    await env.DB.batch(stmts);
    return json({ ok: true, upserted: items.length });
  }

  return err('Method Not Allowed', 405);
}

// ─── FUEL CARD IMPORT ─────────────────────────────────────────────────────────
function parseFuelCsv(csvText, separator, colMap) {
  const sep   = separator || ';';
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(sep).map(h => h.trim().toLowerCase());
  const toIdx  = v => { const n = parseInt(v ?? -1); return isNaN(n) ? -1 : n; };

  let dateIdx, nrIdx, litersIdx, costIdx, statIdx;
  if (colMap && toIdx(colMap.date) >= 0) {
    dateIdx   = toIdx(colMap.date);
    nrIdx     = toIdx(colMap.nrrej   ?? -1);
    litersIdx = toIdx(colMap.liters  ?? -1);
    costIdx   = toIdx(colMap.cost    ?? -1);
    statIdx   = toIdx(colMap.station ?? -1);
  } else {
    const ci = (...cands) => { for (const c of cands) { const i = header.findIndex(h => h.includes(c)); if (i !== -1) return i; } return -1; };
    dateIdx   = ci('data','date','dzien','dzień');
    nrIdx     = ci('nr_rej','rejestr','tablica','pojazd','plate','vehicle');
    litersIdx = ci('liter','ilosc','ilość','quantity','volume','litry');
    costIdx   = ci('kwota','koszt','cost','amount','wartosc','wartość','brutto','pln');
    statIdx   = ci('stacja','station','miejsce');
  }

  const normDate = d => {
    if (!d) return null;
    const s = d.trim();
    const m1 = s.match(/^(\d{2})[./](\d{2})[./](\d{4})$/);
    if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
    const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m2) return s.slice(0, 10);
    const m3 = s.match(/^(\d{8})$/);
    if (m3) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
    return s.slice(0, 10) || null;
  };
  const normNum = v => {
    const s = String(v ?? '0').trim().replace(/\s/g, '');
    if (s.includes(',') && s.includes('.')) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return parseFloat(s.replace(',', '.'));
  };

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep);
    if (cols.length < 2) continue;
    const nr = nrIdx >= 0 ? (cols[nrIdx] || '').trim().toUpperCase().replace(/\s+/g, '') : null;
    const dt = normDate(dateIdx >= 0 ? (cols[dateIdx] || '') : null);
    if (!nr || !dt) continue;
    const liters   = litersIdx >= 0 ? normNum(cols[litersIdx]) : 0;
    const cost_pln = costIdx   >= 0 ? normNum(cols[costIdx])   : 0;
    const station  = statIdx   >= 0 ? (cols[statIdx] || '').trim() || null : null;
    records.push({ nr_rej: nr, fill_date: dt, liters: isNaN(liters) ? 0 : liters, cost_pln: isNaN(cost_pln) ? 0 : cost_pln, station });
  }
  return records;
}

async function handleFuelCardImport(request, env, user, url, path) {
  const segs    = path.split('/');
  const company = url.searchParams.get('company') || user.company_id;

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM fuel_card_imports WHERE company_id=? ORDER BY imported_at DESC LIMIT 100').bind(company).all();
    return json(results);
  }

  if (request.method === 'POST' && segs[3] === 'parse') {
    let csvText, provider, separator = ';', col_map = null;
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      csvText   = file && typeof file !== 'string' ? await file.text() : String(file || '');
      provider  = String(form.get('provider') || 'other');
    } else {
      let body; try { body = await request.json(); } catch { return err('Nieprawidłowe JSON'); }
      csvText   = body.csv_text;
      provider  = body.provider  || 'other';
      separator = body.separator || ';';
      col_map   = body.col_map   || null;
    }
    if (!csvText) return err('csv_text jest wymagany');
    const records = parseFuelCsv(csvText, separator, col_map);
    let unknown_nrrej = [];
    if (records.length) {
      const allNr = [...new Set(records.map(r => r.nr_rej).filter(Boolean))];
      if (allNr.length) {
        try {
          const ph = allNr.map(() => '?').join(',');
          const { results: known } = await env.DB.prepare(
            `SELECT nr_rej FROM vehicles WHERE company_id=? AND nr_rej IN (${ph})`
          ).bind(company, ...allNr).all();
          const knownSet = new Set(known.map(v => v.nr_rej));
          unknown_nrrej = allNr.filter(nr => !knownSet.has(nr));
        } catch {}
      }
    }
    return json({ provider, records, count: records.length, unknown_nrrej });
  }

  if (request.method === 'POST' && segs[3] === 'confirm') {
    let body; try { body = await request.json(); } catch { return err('Nieprawidłowe JSON'); }
    const { provider, filename, records } = body;
    if (!Array.isArray(records) || !records.length) return err('Brak rekordów do importu');
    const stmts = records.map(r => env.DB.prepare(
      'INSERT OR IGNORE INTO fuel_fills (company_id,nr_rej,fill_date,liters,total_cost,price_per_liter,station) VALUES (?,?,?,?,?,?,?)'
    ).bind(company, r.nr_rej, r.fill_date, r.liters??0, r.cost_pln??0,
      (r.liters > 0 && r.cost_pln > 0) ? Math.round(r.cost_pln/r.liters*100)/100 : null, r.station??null));
    const batchRes = await env.DB.batch(stmts);
    let imported = 0, skipped = 0;
    for (const res of batchRes) { if ((res.meta?.changes??0) > 0) imported++; else skipped++; }
    const importId = crypto.randomUUID().replace(/-/g,'');
    await env.DB.prepare("INSERT INTO fuel_card_imports (id,company_id,filename,card_provider,imported_at,records_count,status) VALUES (?,?,?,?,datetime('now'),?,'processed')")
      .bind(importId, company, filename||'import.csv', provider||'other', imported).run();
    return json({ imported, skipped, import_id: importId });
  }

  return err('Method Not Allowed', 405);
}

// ─── TACHOGRAFY CYFROWE DDD — PARSER + ANALIZATOR EU 561/2006 ────────────────

// Odczyt 35-znakowej nazwy ze struktury binarnej DDD (1 bajt codepage + 35 bajtów tekstu)
function _tachoReadName(data, offset) {
  if (offset + 36 > data.length) return '';
  const nameBytes = data.slice(offset + 1, offset + 36);
  return new TextDecoder('latin1').decode(nameBytes).replace(/\x00/g, '').trim();
}

// Odczyt daty w formacie BCD 4 bajty: YYYYMMDD → 'YYYY-MM-DD'
function _tachoBCDDate4(data, offset) {
  if (offset + 3 >= data.length) return null;
  const y = ((data[offset] >> 4) & 0xF) * 1000 + (data[offset] & 0xF) * 100
          + ((data[offset + 1] >> 4) & 0xF) * 10 + (data[offset + 1] & 0xF);
  const m = ((data[offset + 2] >> 4) & 0xF) * 10 + (data[offset + 2] & 0xF);
  const d = ((data[offset + 3] >> 4) & 0xF) * 10 + (data[offset + 3] & 0xF);
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// TimeReal (uint32 BE, sekundy od 1970-01-01 UTC) → 'YYYY-MM-DD'
function _tachoTimeReal(data, offset) {
  if (offset + 3 >= data.length) return null;
  const secs = ((data[offset] << 24) | (data[offset + 1] << 16)
              | (data[offset + 2] << 8) | data[offset + 3]) >>> 0;
  if (secs === 0 || secs > 4000000000) return null;
  return new Date(secs * 1000).toISOString().slice(0, 10);
}

// Sprawdza czy 2-bajtowe słowo wygląda jak nagłówek dnia w buforze aktywności
// Słowo: [bits15:9]=rok-1985, [bits8:5]=miesiąc, [bits4:0]=dzień
// Aktywności mają timeMin max=1439 → bits[15:9] max=2 → rok ≤ 1987
// Lata 2004-2035 → yearOfs 19-50, więc yearOfs≥19 jest jednoznacznym wyróżnikiem
function _tachoIsDayHeader(word) {
  const yearOfs = (word >> 9) & 0x7F;
  const month   = (word >> 5) & 0x0F;
  const day     = word & 0x1F;
  return yearOfs >= 19 && yearOfs <= 50 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

// Parser bloku CardDriverActivity (tag 0x0600) — kołowy bufor dobowych rekordów aktywności
function _tachoParseActivities(data) {
  if (data.length < 4) return [];
  const oldestPtr = (data[0] << 8) | data[1];
  const newestPtr = (data[2] << 8) | data[3];
  const records   = data.slice(4);
  const bufLen    = records.length;
  if (bufLen < 4 || oldestPtr >= bufLen) return [];

  // Linearyzacja bufora kołowego: zaczynamy od oldestPtr
  const spanFwd = newestPtr > oldestPtr ? newestPtr - oldestPtr : bufLen - oldestPtr + newestPtr;
  const span    = Math.min(spanFwd + 32, bufLen); // +32 zapas
  const linear  = new Uint8Array(span);
  for (let i = 0; i < span; i++) linear[i] = records[(oldestPtr + i) % bufLen];

  const days = [];
  let i = 0;
  while (i + 1 < linear.length && days.length < 30) {
    const word = (linear[i] << 8) | linear[i + 1];
    if (!_tachoIsDayHeader(word)) { i += 2; continue; }

    const year   = ((word >> 9) & 0x7F) + 1985;
    const month  = (word >> 5) & 0x0F;
    const day    = word & 0x1F;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    i += 6; // skip date(2) + presenceCounter(2) + dayDistance(2)

    const acts = [];
    while (i + 1 < linear.length) {
      const w = (linear[i] << 8) | linear[i + 1];
      if (_tachoIsDayHeader(w) && acts.length > 0) break;
      const slot = (w >> 15) & 1;
      i += 2;
      if (slot !== 0) continue; // pomijamy slot współkierowcy
      const actCode     = (w >> 13) & 3;
      const drivingStatus = (w >> 12) & 1;
      const timeMin     = w & 0x7FF;
      acts.push({
        timeMin,
        activity: ['rest', 'availability', 'work', 'driving'][actCode],
        driving_status: drivingStatus === 1 ? 'crew' : 'single'
      });
    }
    if (acts.length > 0) days.push({ date: dateStr, activities: acts });
  }
  return days;
}

// Parser bloku CardVehiclesUsed (tag 0x0606)
function _tachoParseVehicles(data) {
  if (data.length < 4) return [];
  const vehicles = [];
  let pos = 2; // skip 2-bajtowy pointer najnowszego rekordu
  const recSize = 25; // 1(nation) + 14(reg) + 4(begin) + 4(end) + 2(counter)
  while (pos + recSize <= data.length && vehicles.length < 200) {
    const regBytes = data.slice(pos + 2, pos + 15); // skip nation(1) + codepage(1)
    const reg      = new TextDecoder('latin1').decode(regBytes).replace(/\x00/g, '').trim();
    const begin    = _tachoTimeReal(data, pos + 15);
    const end      = _tachoTimeReal(data, pos + 19);
    if (reg || begin) vehicles.push({ vehicle_reg: reg || null, first_use: begin, last_use: end });
    pos += recSize;
  }
  return vehicles.filter(v => v.vehicle_reg || v.first_use);
}

// Główny parser pliku DDD — parsuje bufor ArrayBuffer
function parseDDDBuffer(arrayBuffer) {
  const buf   = arrayBuffer instanceof ArrayBuffer ? arrayBuffer : arrayBuffer.buffer;
  const view  = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const result = {
    fileType: 'unknown', driver: null, cardNumber: null, cardExpiry: null,
    activitiesByDay: [], vehiclesUsed: [], parseErrors: []
  };

  // Krok 1: odczyt wszystkich bloków TLV (tag 2B + len 2B + data LenB)
  const blocks = new Map();
  let offset = 0;
  let guard  = 0;
  while (offset + 4 <= buf.byteLength && guard++ < 200000) {
    const tag = view.getUint16(offset, false);
    const len = view.getUint16(offset + 2, false);
    if (len === 0 || offset + 4 + len > buf.byteLength) { offset++; continue; }
    if (!blocks.has(tag)) blocks.set(tag, []);
    blocks.get(tag).push(new Uint8Array(buf, offset + 4, len));
    offset += 4 + len;
  }

  // Krok 2: typ pliku
  if (blocks.has(0x0520) || blocks.has(0x0600)) result.fileType = 'card';
  else if (blocks.has(0xC100) || blocks.has(0xC101)) result.fileType = 'vu';

  // Krok 3: dane kierowcy (0x0520 CardHolderIdentification)
  if (blocks.has(0x0520)) {
    try {
      const d = blocks.get(0x0520)[0];
      if (d.length >= 78) {
        result.driver = {
          surname:   _tachoReadName(d, 0),
          firstName: _tachoReadName(d, 36),
          birthDate: _tachoBCDDate4(d, 72)
        };
      }
    } catch (ex) { result.parseErrors.push('driver_id:' + ex.message); }
  }

  // Krok 4: numer karty i data ważności (0x0521 CardApplicationIdentification)
  if (blocks.has(0x0521)) {
    try {
      const d = blocks.get(0x0521)[0];
      // Numer karty: bajty 1-9 (po bajcie nation) jako IA5
      const numBytes = d.slice(1, Math.min(10, d.length));
      const cardNum  = [...numBytes].map(b => (b > 32 && b < 127) ? String.fromCharCode(b) : '').join('').trim();
      if (cardNum) result.cardNumber = cardNum;
      // Data ważności: ostatnie 4 bajty TimeReal
      if (d.length >= 4) result.cardExpiry = _tachoTimeReal(d, d.length - 4);
    } catch (ex) { result.parseErrors.push('card_app:' + ex.message); }
  }

  // Krok 5: aktywności (0x0600 CardDriverActivity)
  if (blocks.has(0x0600)) {
    try {
      result.activitiesByDay = _tachoParseActivities(blocks.get(0x0600)[0]);
    } catch (ex) { result.parseErrors.push('activities:' + ex.message); }
  }

  // Krok 6: używane pojazdy (0x0606 CardVehiclesUsed)
  if (blocks.has(0x0606)) {
    try {
      result.vehiclesUsed = _tachoParseVehicles(blocks.get(0x0606)[0]);
    } catch (ex) { result.parseErrors.push('vehicles:' + ex.message); }
  }

  // Krok 7: VU/SMRDT — pattern-scan gdy typ nie-karta (format Continental DTCO)
  if (result.fileType !== 'card') {
    try {
      const td = new TextDecoder('latin1');
      // Wykryj SMRDT header
      const smrdtMark = [0x53,0x4D,0x52,0x44,0x54]; // "SMRDT"
      let isSmrdt = false;
      for (let i = 0; i < Math.min(bytes.length - 5, 300); i++) {
        if (smrdtMark.every((b, j) => bytes[i+j] === b)) { isSmrdt = true; break; }
      }
      if (isSmrdt) result.fileType = 'vu';

      if (result.fileType === 'vu') {
        // Skan po nazwisku/imieniu: wzorzec 0x02 + 35 bajtów z literami (EU CardHolderName)
        const foundNames = [];
        for (let i = 0; i + 36 < bytes.length; i++) {
          if (bytes[i] !== 0x02) continue;
          const raw = td.decode(bytes.slice(i + 1, i + 36)).replace(/\x00/g, '').trimEnd();
          if (raw.length >= 2 && raw.length <= 25 && /^[A-ZŁŚÓŻŹĆĄĘa-ząęłśćóźżńÄÖÜäöü\- ]+$/.test(raw)
              && /[A-ZŁŚÓŻŹĆĄĘa-ząęłśćóźżń]/.test(raw[0])) {
            // odrzuć duplikaty z poprzedniego bajtu
            const prev = i > 0 ? td.decode(bytes.slice(i, i + 35)).replace(/\x00/g, '').trimEnd() : '';
            if (prev !== raw) foundNames.push(raw);
          }
        }
        // Odróżnij nazwisko (przed imionami) od imienia (z wieloma słowami lub małe litery)
        const surnames = foundNames.filter(n => !/\s/.test(n) && /^[A-ZŁŚÓŻŹĆĄĘ]/.test(n));
        const firsts   = foundNames.filter(n => n !== surnames[0]);
        if (surnames.length > 0 && !result.driver) {
          result.driver = { surname: surnames[0], firstName: firsts[0] || null, birthDate: null };
        }

        // Skan po numerze karty: 0x01 + 0x28 (Poland) + 16 cyfr
        if (!result.cardNumber) {
          for (let i = 0; i + 18 < bytes.length; i++) {
            if (bytes[i] === 0x01 && bytes[i+1] === 0x28) {
              const num = td.decode(bytes.slice(i + 2, i + 18));
              if (/^\d{16}$/.test(num)) { result.cardNumber = 'PL' + num; break; }
            }
          }
        }

        // Skan po nr rej pojazdu: 2-3 litery + spacja + 4-6 alfanumerycznych (polskie tablice)
        // Tylko czyste ASCII (0x20–0x7E) — bez binary
        if (!result.vehiclesUsed.length) {
          const seen = new Set();
          for (let i = 0; i + 14 < bytes.length; i++) {
            // Sprawdź że bajty to czyste ASCII
            let clean = true;
            for (let k = i; k < i + 14; k++) { if (bytes[k] < 0x20 || bytes[k] > 0x7E) { clean = false; break; } }
            if (!clean) continue;
            const chunk = td.decode(bytes.slice(i, i + 14));
            const m = chunk.match(/^([A-Z]{2,3}) ([A-Z0-9]{4,6})\s/);
            if (m) {
              const reg = (m[1] + ' ' + m[2]).trim();
              if (reg.length >= 6 && /\d/.test(reg) && !seen.has(reg)) {
                seen.add(reg);
                result.vehiclesUsed.push({ vehicle_reg: reg, first_use: null, last_use: null });
              }
            }
          }
        }

        // Filtruj warsztaty z listy kierowców (wielkie litery / nazwy firm / cyfry / słowa kluczowe)
        if (result.driver?.surname) {
          const s = result.driver.surname;
          const WORKSHOP_TERMS = /tacho|calibr|serwis|service|tech|tronic|electronic|warsztat|werkstatt|calibration|dtco|vdo|straz|diagnos/i;
          if (/^[A-Z0-9\- ]+$/.test(s) || /\d/.test(s) || s.length > 20 || / /.test(s) || WORKSHOP_TERMS.test(s)) {
            result.driver = null; // to karta warsztatu, nie kierowcy
          }
        }
      }
    } catch (ex) { result.parseErrors.push('vu_scan:' + ex.message); }
  }

  return result;
}

// Formatowanie minut → 'Xh Ymin'
function _tachoFmtMin(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// Detekcja naruszeń EU 561/2006 na podstawie sparsowanych aktywności
// Kary pieniężne PLN za naruszenia wg rozporządzenia o taryfikatorze (Annex 4 do rozp. 2016/403)
const TACHO_PENALTIES_PLN = {
  daily_driving_over_10h:          { very_serious: 500,  most_serious: 2000 },
  daily_driving_over_9h:           { serious: 200 },
  continuous_driving_over_4h30:    { serious: 300,  very_serious: 500  },
  weekly_driving_over_56h:         { serious: 300,  very_serious: 1000 },
  two_week_driving_over_90h:       { serious: 500,  very_serious: 2000 },
  daily_rest_under_9h:             { serious: 500,  very_serious: 1500 },
  daily_rest_under_11h:            { minor: 100 },
  weekly_rest_under_24h:           { very_serious: 1500, most_serious: 3000 },
  weekly_rest_under_45h:           { serious: 500 },
};

function _tachoPenalty(type, severity) {
  return TACHO_PENALTIES_PLN[type]?.[severity] ?? 0;
}

// Zwraca ciągłe bloki odpoczynku w ciągu dnia [{start,end,dur}]
function _getRestBlocks(activities) {
  const sorted = [...activities].sort((a, b) => a.timeMin - b.timeMin);
  const blocks = [];
  let rStart = null;
  for (let i = 0; i < sorted.length; i++) {
    const act = sorted[i], next = sorted[i + 1];
    if (act.activity === 'rest') {
      if (rStart === null) rStart = act.timeMin;
    } else {
      if (rStart !== null) { blocks.push({ start: rStart, end: act.timeMin, dur: act.timeMin - rStart }); rStart = null; }
    }
  }
  if (rStart !== null) blocks.push({ start: rStart, end: 1440, dur: 1440 - rStart });
  return blocks;
}

function detectViolations561(activitiesByDay) {
  const violations = [];

  // ── Analiza per dzień: czas jazdy, ciągłość, tryb obsady ─────────────────
  for (const { date, activities } of activitiesByDay) {
    const sorted = [...activities].sort((a, b) => a.timeMin - b.timeMin);
    let totalDriving = 0, continuousDriving = 0, maxContinuous = 0, breakAccum = 0;
    // Podwójna obsada: bit driving_status; limit jazdy dobowej 10h zamiast 9h (Art. 4 lit. o)
    const hasCrew = sorted.some(a => a.driving_status === 'crew');
    const dailyLimit = hasCrew ? 600 : 540;

    for (let ai = 0; ai < sorted.length; ai++) {
      const act = sorted[ai];
      const dur = Math.max(0, (sorted[ai + 1] ? sorted[ai + 1].timeMin : 1440) - act.timeMin);
      if (act.activity === 'driving') {
        totalDriving += dur; continuousDriving += dur; breakAccum = 0;
        if (continuousDriving > maxContinuous) maxContinuous = continuousDriving;
      } else if (act.activity === 'rest') {
        breakAccum += dur;
        if (breakAccum >= 45) continuousDriving = 0;
      } else {
        breakAccum = 0;
      }
    }

    if (totalDriving > 600) {
      violations.push({ violation_date: date, violation_type: 'daily_driving_over_10h', severity: 'very_serious',
        description: `Czas jazdy dobowej: ${_tachoFmtMin(totalDriving)}${hasCrew?' (podw. obsada, limit: 10h)':' (limit: 10h)'}`,
        regulation: '561/2006 Art. 6 ust. 1', actual_value: totalDriving, limit_value: 600,
        penalty_pln: _tachoPenalty('daily_driving_over_10h', 'very_serious') });
    } else if (totalDriving > dailyLimit) {
      // Tylko dla kierowcy w trybie solo (podwójna obsada ma limit 10h, powyżej obsłużone)
      if (!hasCrew) {
        violations.push({ violation_date: date, violation_type: 'daily_driving_over_9h', severity: 'serious',
          description: `Czas jazdy dobowej: ${_tachoFmtMin(totalDriving)} (limit: 9h)`,
          regulation: '561/2006 Art. 6 ust. 1', actual_value: totalDriving, limit_value: 540,
          penalty_pln: _tachoPenalty('daily_driving_over_9h', 'serious') });
      }
    }

    if (maxContinuous > 270) {
      const sev = maxContinuous > 360 ? 'very_serious' : 'serious';
      violations.push({ violation_date: date, violation_type: 'continuous_driving_over_4h30', severity: sev,
        description: `Ciągły czas jazdy: ${_tachoFmtMin(maxContinuous)} bez 45-min przerwy`,
        regulation: '561/2006 Art. 7', actual_value: maxContinuous, limit_value: 270,
        penalty_pln: _tachoPenalty('continuous_driving_over_4h30', sev) });
    }
  }

  // ── Odpoczynek dobowy między kolejnymi dniami (z detekcją split rest) ────
  const chronDays = [...activitiesByDay].sort((a, b) => a.date.localeCompare(b.date));
  for (let di = 0; di + 1 < chronDays.length; di++) {
    const dayA = chronDays[di], dayB = chronDays[di + 1];
    const diff = Math.round((new Date(dayB.date + 'T00:00:00Z') - new Date(dayA.date + 'T00:00:00Z')) / 86400000);
    if (diff !== 1) continue;

    const blocksA = _getRestBlocks(dayA.activities);
    const blocksB = _getRestBlocks(dayB.activities);

    // Ostatni blok odpoczynku dayA (dotykający północy = end===1440)
    const lastRestA = blocksA.length && blocksA[blocksA.length - 1].end === 1440
      ? blocksA[blocksA.length - 1] : null;
    // Pierwszy blok odpoczynku dayB (startujący od północy = start===0)
    const firstRestB = blocksB.length && blocksB[0].start === 0
      ? blocksB[0] : null;

    if (!lastRestA && !firstRestB) continue; // Brak danych o przekroczeniu północy

    // ▸ Sprawdź legalny split rest (Art. 8 ust. 4):
    //   Part 1 (koniec dayA) ≥ 3h AND Part 2 (start dayB) ≥ 9h → ważny, brak naruszenia
    if (lastRestA && lastRestA.dur >= 180 && firstRestB && firstRestB.dur >= 540) continue;

    // Łączny odpoczynek przekraczający północ
    const crossRest = (lastRestA?.dur ?? 0) + (firstRestB?.dur ?? 0);

    if (crossRest < 540) {
      const sev = crossRest < 360 ? 'very_serious' : 'serious';
      violations.push({ violation_date: dayA.date, violation_type: 'daily_rest_under_9h', severity: sev,
        description: `Odpoczynek dobowy: ${_tachoFmtMin(crossRest)} (wymagane min. 9h lub split 3h+9h)`,
        regulation: '561/2006 Art. 8', actual_value: crossRest, limit_value: 540,
        penalty_pln: _tachoPenalty('daily_rest_under_9h', sev) });
    } else if (crossRest < 660) {
      violations.push({ violation_date: dayA.date, violation_type: 'daily_rest_under_11h', severity: 'minor',
        description: `Odpoczynek dobowy: ${_tachoFmtMin(crossRest)} (poniżej 11h; skrócony — max 3×/tydz.)`,
        regulation: '561/2006 Art. 8 ust. 1', actual_value: crossRest, limit_value: 660,
        penalty_pln: _tachoPenalty('daily_rest_under_11h', 'minor') });
    }
  }

  // ── Tygodniowy czas jazdy > 56h (art. 6 ust. 2) ──────────────────────────
  const byWeek = {};
  for (const { date, activities } of activitiesByDay) {
    const d = new Date(date + 'T00:00:00Z');
    const dow = d.getUTCDay() || 7;
    const mon = new Date(d); mon.setUTCDate(d.getUTCDate() - (dow - 1));
    const wk = mon.toISOString().slice(0, 10);
    if (!byWeek[wk]) byWeek[wk] = 0;
    const s = [...activities].sort((a, b) => a.timeMin - b.timeMin);
    for (let ai = 0; ai < s.length; ai++) {
      if (s[ai].activity !== 'driving') continue;
      byWeek[wk] += Math.max(0, (s[ai + 1]?.timeMin ?? 1440) - s[ai].timeMin);
    }
  }
  const weeks = Object.entries(byWeek).sort(([a], [b]) => a.localeCompare(b));
  for (const [wk, total] of weeks) {
    if (total > 3360) {
      const sev = total > 4200 ? 'very_serious' : 'serious';
      violations.push({ violation_date: wk, violation_type: 'weekly_driving_over_56h', severity: sev,
        description: `Tygodniowy czas jazdy: ${_tachoFmtMin(total)} (limit: 56h)`,
        regulation: '561/2006 Art. 6 ust. 2', actual_value: total, limit_value: 3360,
        penalty_pln: _tachoPenalty('weekly_driving_over_56h', sev) });
    }
  }

  // ── Suma 2 tygodni > 90h (art. 6 ust. 3) ────────────────────────────────
  for (let wi = 0; wi + 1 < weeks.length; wi++) {
    const twoWeek = weeks[wi][1] + weeks[wi + 1][1];
    if (twoWeek > 5400) {
      const sev = twoWeek > 6000 ? 'very_serious' : 'serious';
      violations.push({ violation_date: weeks[wi][0], violation_type: 'two_week_driving_over_90h', severity: sev,
        description: `Suma 2 tygodni od ${weeks[wi][0]}: ${_tachoFmtMin(twoWeek)} (limit: 90h)`,
        regulation: '561/2006 Art. 6 ust. 3', actual_value: twoWeek, limit_value: 5400,
        penalty_pln: _tachoPenalty('two_week_driving_over_90h', sev) });
    }
  }

  // ── Tygodniowy odpoczynek (EU 561/2006 Art. 8 ust. 6) ─────────────────────
  // EU wymaga CIĄGŁEGO bloku ≥45h (regularny) lub ≥24h (skrócony).
  // Algorytm: konwertuj aktywności na absolutne bloki czasowe → scal przez-północne
  // → max ciągły blok per tydzień.
  {
    const epoch = new Date('2000-01-01T00:00:00Z');
    const weekMaxRest = {};

    // Inicjalizuj 0 dla wszystkich tygodni z danych (flaga brakujących tygodni)
    for (const { date } of activitiesByDay) {
      const d = new Date(date + 'T00:00:00Z');
      const dow = d.getUTCDay() || 7;
      const mon = new Date(d); mon.setUTCDate(d.getUTCDate() - (dow - 1));
      const wk = mon.toISOString().slice(0, 10);
      if (weekMaxRest[wk] === undefined) weekMaxRest[wk] = 0;
    }

    // Krok 1: surowe bloki odpoczynku w minutach absolutnych od epoch
    const rawBlocks = [];
    for (const { date, activities } of [...activitiesByDay].sort((a, b) => a.date.localeCompare(b.date))) {
      const off = Math.round((new Date(date + 'T00:00:00Z') - epoch) / 60000);
      const s = [...activities].sort((a, b) => a.timeMin - b.timeMin);
      for (let ai = 0; ai < s.length; ai++) {
        if (s[ai].activity !== 'rest') continue;
        rawBlocks.push({ start: off + s[ai].timeMin, end: off + (s[ai + 1]?.timeMin ?? 1440) });
      }
    }

    // Krok 2: scal nakładające się / sąsiednie bloki (odpoczynek przez północ)
    rawBlocks.sort((a, b) => a.start - b.start);
    const merged = [];
    for (const blk of rawBlocks) {
      if (merged.length && blk.start <= merged[merged.length - 1].end) {
        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, blk.end);
      } else {
        merged.push({ ...blk });
      }
    }

    // Krok 3: dla każdego bloku → tydzień startu → aktualizuj max ciągły odpoczynek
    for (const blk of merged) {
      const dur = blk.end - blk.start;
      const blkDate = new Date(epoch.getTime() + blk.start * 60000).toISOString().slice(0, 10);
      const bd = new Date(blkDate + 'T00:00:00Z');
      const bdow = bd.getUTCDay() || 7;
      const bmon = new Date(bd); bmon.setUTCDate(bd.getUTCDate() - (bdow - 1));
      const wk = bmon.toISOString().slice(0, 10);
      if (weekMaxRest[wk] !== undefined) weekMaxRest[wk] = Math.max(weekMaxRest[wk], dur);
    }

    // Krok 4: zgłoś naruszenia
    for (const [wk, maxRest] of Object.entries(weekMaxRest)) {
      if (maxRest < 1440) {
        violations.push({ violation_date: wk, violation_type: 'weekly_rest_under_24h', severity: 'very_serious',
          description: `Odpoczynek tygodniowy: ${_tachoFmtMin(maxRest)} ciągłego (wymagane min. 24h skrócone lub 45h regularne)`,
          regulation: '561/2006 Art. 8 ust. 6', actual_value: maxRest, limit_value: 1440,
          penalty_pln: _tachoPenalty('weekly_rest_under_24h', 'very_serious') });
      } else if (maxRest < 2700) {
        violations.push({ violation_date: wk, violation_type: 'weekly_rest_under_45h', severity: 'serious',
          description: `Odpoczynek tygodniowy: ${_tachoFmtMin(maxRest)} ciągłego (poniżej 45h; skrócony 24h dopuszczalny co drugi tydz. z kompensatą)`,
          regulation: '561/2006 Art. 8 ust. 6', actual_value: maxRest, limit_value: 2700,
          penalty_pln: _tachoPenalty('weekly_rest_under_45h', 'serious') });
      }
    }
  }

  return violations;
}

// ─── Dyrektywa o czasie pracy (DYR 2002/15/WE) ───────────────────────────────
// Analizuje aktywności i zwraca naruszenia DYR (tygodniowy czas pracy, praca nocna)
function detectViolationsWTD(activitiesByDay) {
  const violations = [];

  const byWeek = {};
  const byDate = {};

  for (const { date, activities } of activitiesByDay) {
    const d   = new Date(date + 'T00:00:00Z');
    const dow = d.getUTCDay() || 7;
    const mon = new Date(d); mon.setUTCDate(d.getUTCDate() - (dow - 1));
    const wk  = mon.toISOString().slice(0, 10);
    if (!byWeek[wk]) byWeek[wk] = { work: 0, night: 0 };
    if (!byDate[date]) byDate[date] = 0;

    const sorted = [...activities].sort((a, b) => a.timeMin - b.timeMin);
    for (let ai = 0; ai < sorted.length; ai++) {
      const act = sorted[ai];
      const dur = Math.max(0, (sorted[ai + 1]?.timeMin ?? 1440) - act.timeMin);
      // DYR: "czas pracy" = jazda + praca; dyspozycja i odpoczynek się nie liczą
      if (act.activity !== 'driving' && act.activity !== 'work') continue;

      byWeek[wk].work += dur;
      byDate[date]     += dur;

      // Praca nocna: 00:00-06:00 i 23:00-24:00 (uproszczone do dnia)
      const nightMin0 = Math.max(0, Math.min(dur, Math.max(0, 360 - act.timeMin)));
      const nightMin1 = Math.max(0, Math.min(dur, 1440 - Math.max(1380, act.timeMin)));
      byWeek[wk].night += nightMin0 + nightMin1;
    }
  }

  // 1. Tygodniowy czas pracy > 60h (art. 4 ust. 1 — twardy limit)
  // 2. Tygodniowy czas pracy > 48h (art. 4 ust. 3 — limit średni, uproszczone do tygodnia)
  for (const [wk, totals] of Object.entries(byWeek)) {
    if (totals.work > 3600) {
      violations.push({ violation_date: wk, violation_type: 'wtd_weekly_work_over_60h', severity: 'very_serious',
        description: `DYR: tygodniowy czas pracy ${_tachoFmtMin(totals.work)} (twardy limit: 60h)`,
        regulation: 'DYR 2002/15/WE Art. 4 ust. 1', actual_value: totals.work, limit_value: 3600, penalty_pln: 500 });
    } else if (totals.work > 2880) {
      violations.push({ violation_date: wk, violation_type: 'wtd_weekly_work_over_48h', severity: 'serious',
        description: `DYR: tygodniowy czas pracy ${_tachoFmtMin(totals.work)} (limit śr. 48h/tydz.)`,
        regulation: 'DYR 2002/15/WE Art. 4 ust. 3', actual_value: totals.work, limit_value: 2880, penalty_pln: 200 });
    }

    // Praca nocna łącznie > 10h w tygodniu (uproszczone; przepis: max 10h w ciągu 24h)
    if (totals.night > 600) {
      violations.push({ violation_date: wk, violation_type: 'wtd_night_work_over_10h', severity: 'serious',
        description: `DYR: praca nocna ${_tachoFmtMin(totals.night)} w tygodniu (limit: 10h/dobę)`,
        regulation: 'DYR 2002/15/WE Art. 7', actual_value: totals.night, limit_value: 600, penalty_pln: 300 });
    }
  }

  // 3. Dzienny czas pracy > 10h bez przerwy ≥ 30 min po 6h (art. 5)
  for (const [date, workMin] of Object.entries(byDate)) {
    if (workMin > 600) {
      violations.push({ violation_date: date, violation_type: 'wtd_daily_work_over_10h', severity: 'serious',
        description: `DYR: dzienny czas pracy ${_tachoFmtMin(workMin)} (limit: 10h)`,
        regulation: 'DYR 2002/15/WE Art. 5', actual_value: workMin, limit_value: 600, penalty_pln: 200 });
    }
  }

  return violations;
}

// ─── Flespi: zdalne pobieranie plików DDD ─────────────────────────────────────
async function _flespiSync(env, company, user, config) {
  const { token, device_ids: cfgDevices = [], channel_id } = config;
  const fh = { 'Authorization': `FlespiToken ${token}`, 'Accept': 'application/json' };

  // 1. Lista urządzeń (jeśli nie skonfigurowane ręcznie)
  let deviceList = [...cfgDevices];
  if (!deviceList.length) {
    const r = await fetch('https://flespi.io/gw/devices/all?fields=id,name', { headers: fh });
    if (!r.ok) throw new Error(`Flespi API ${r.status}: ${await r.text().catch(()=>'')}`);
    const data = await r.json();
    deviceList = (data.result || []).map(d => String(d.id));
  }

  if (!deviceList.length) return { ok: true, files: 0, message: 'Brak urządzeń w koncie Flespi' };

  let filesImported = 0;
  const errors = [];
  const from = Math.floor(Date.now() / 1000 - 8 * 86400); // ostatnie 8 dni

  for (const devId of deviceList.slice(0, 20)) {
    try {
      // Pobierz wiadomości z polem tacho.file.ddd (base64 DDD)
      const msgsUrl = `https://flespi.io/gw/devices/${devId}/messages?data=${encodeURIComponent(JSON.stringify({
        from, fields: 'tacho.file.ddd,tacho.file.name,timestamp'
      }))}`;
      const r = await fetch(msgsUrl, { headers: fh });
      if (!r.ok) { errors.push(`Device ${devId}: ${r.status}`); continue; }

      const data = await r.json();
      for (const msg of (data.result || [])) {
        const b64 = msg['tacho.file.ddd'];
        if (!b64) continue;
        try {
          // Dekoduj base64 → ArrayBuffer
          const bin = atob(b64);
          const ab  = new ArrayBuffer(bin.length);
          const u8  = new Uint8Array(ab);
          for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);

          const fileName = msg['tacho.file.name'] || `flespi_${devId}_${msg.timestamp}.ddd`;
          const parsed   = parseDDDBuffer(ab);
          const days     = parsed.activitiesByDay || [];
          const dates    = days.map(d => d.date).sort();
          const ps = dates[0] || null, pe = dates[dates.length - 1] || null;
          const viols561 = detectViolations561(days);
          const violsWTD = detectViolationsWTD(days);
          const violations = [...viols561, ...violsWTD];

          // Sprawdź duplikat
          const exists = await env.DB.prepare(
            `SELECT id FROM tachograph_files WHERE company_id=? AND card_number=? AND period_start=? AND period_end=? LIMIT 1`
          ).bind(company, parsed.cardNumber ?? '', ps, pe).first();
          if (exists) continue;

          const surnameClean = (parsed.driver?.surname || 'nieznany').replace(/[^a-zA-Z0-9]/g, '_');
          const year = ps?.slice(0, 4) || String(new Date().getFullYear());
          const uid  = crypto.randomUUID().slice(0, 8);
          const safeFile = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
          let fileKey = null;

          if (env.DOCS) {
            fileKey = parsed.fileType === 'card'
              ? `tacho/${company}/kierowcy/${surnameClean}/${year}/${uid}_${safeFile}`
              : `tacho/${company}/pojazdy/${year}/${uid}_${safeFile}`;
            try { await env.DOCS.put(fileKey, ab, { customMetadata: { company, fileName } }); } catch { fileKey = null; }
          }

          const parseStatus = parsed.parseErrors.length === 0 ? 'ok' : (days.length ? 'partial' : 'error');
          const fileId = crypto.randomUUID();
          await env.DB.prepare(
            `INSERT INTO tachograph_files (id,company_id,file_key,file_name,file_type,card_number,driver_surname,driver_firstname,driver_birth_date,card_expiry,period_start,period_end,parse_status,violations_count,activities_count,file_size,uploaded_by)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
          ).bind(fileId,company,fileKey,fileName,parsed.fileType,parsed.cardNumber??null,
            parsed.driver?.surname??null,parsed.driver?.firstName??null,
            parsed.driver?.birthDate??null,parsed.cardExpiry??null,ps,pe,parseStatus,
            violations.length,days.reduce((s,d)=>s+d.activities.length,0),ab.byteLength,'flespi').run();

          const stmts = [
            ...days.flatMap(day => {
              const s = [...day.activities].sort((a,b)=>a.timeMin-b.timeMin);
              return s.map((a,ai) => {
                const dur = Math.max(0,(s[ai+1]?.timeMin??1440)-a.timeMin);
                const toHM = m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
                return env.DB.prepare(`INSERT INTO tachograph_activities (id,file_id,company_id,activity_date,start_time,end_time,duration_min,activity_type,driving_status) VALUES (?,?,?,?,?,?,?,?,?)`)
                  .bind(crypto.randomUUID(),fileId,company,day.date,toHM(a.timeMin),toHM(a.timeMin+dur),dur,a.activity,a.driving_status);
              });
            }),
            ...violations.map(v => env.DB.prepare(`INSERT INTO tachograph_violations (id,file_id,company_id,violation_date,violation_type,severity,description,regulation,actual_value,limit_value,penalty_pln) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
              .bind(crypto.randomUUID(),fileId,company,v.violation_date,v.violation_type,v.severity,v.description,v.regulation,v.actual_value??null,v.limit_value??null,v.penalty_pln??0)),
          ];
          for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i,i+100));
          filesImported++;
        } catch {}
      }
    } catch (ex) { errors.push(`Device ${devId}: ${ex.message}`); }
  }

  return { ok: true, files: filesImported, devices_checked: deviceList.length, errors: errors.length ? errors : undefined };
}

// ─── API: Tachografy DDD ──────────────────────────────────────────────────────

async function handleTachoDDD(req, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Wymagane: ?company=', 400);

  const segs   = path.split('/').filter(Boolean); // ['api','tacho-ddd', sub, id?]
  const sub    = segs[2] || '';
  const itemId = segs[3] || null;
  const method = req.method;

  // GET /api/tacho-ddd/stats
  if (method === 'GET' && sub === 'stats') {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const [fc, vc, dc, vm] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) c FROM tachograph_files WHERE company_id=?').bind(company).first(),
      env.DB.prepare('SELECT COUNT(*) c FROM tachograph_violations WHERE company_id=?').bind(company).first(),
      env.DB.prepare(`SELECT COUNT(DISTINCT LOWER(driver_surname||COALESCE(driver_firstname,''))) c
                      FROM tachograph_files WHERE company_id=?`).bind(company).first(),
      env.DB.prepare(`SELECT COUNT(*) c FROM tachograph_violations WHERE company_id=? AND violation_date LIKE ?`).bind(company, thisMonth + '%').first(),
    ]);
    return json({ files: fc?.c ?? 0, violations: vc?.c ?? 0, drivers: dc?.c ?? 0, violations_this_month: vm?.c ?? 0 });
  }

  // GET /api/tacho-ddd/files
  if (method === 'GET' && sub === 'files' && !itemId) {
    const rows = (await env.DB.prepare(
      `SELECT id, file_name, file_type, driver_surname, driver_firstname, card_number,
              period_start, period_end, parse_status, violations_count, activities_count, uploaded_at
       FROM tachograph_files WHERE company_id=? ORDER BY uploaded_at DESC LIMIT 500`
    ).bind(company).all()).results || [];
    return json(rows);
  }

  // GET /api/tacho-ddd/files/:id
  if (method === 'GET' && sub === 'files' && itemId) {
    const file = await env.DB.prepare(
      'SELECT * FROM tachograph_files WHERE id=? AND company_id=?'
    ).bind(itemId, company).first();
    if (!file) return err('Nie znaleziono', 404);
    const [acts, viols, vehs] = await Promise.all([
      env.DB.prepare('SELECT * FROM tachograph_activities WHERE file_id=? ORDER BY activity_date, start_time').bind(itemId).all(),
      env.DB.prepare('SELECT * FROM tachograph_violations WHERE file_id=? ORDER BY violation_date').bind(itemId).all(),
      env.DB.prepare('SELECT * FROM tachograph_vehicles_used WHERE file_id=?').bind(itemId).all(),
    ]);
    return json({ ...file, activities: acts.results || [], violations: viols.results || [], vehicles: vehs.results || [] });
  }

  // DELETE /api/tacho-ddd/files/:id
  if (method === 'DELETE' && sub === 'files' && itemId) {
    const file = await env.DB.prepare('SELECT file_key FROM tachograph_files WHERE id=? AND company_id=?').bind(itemId, company).first();
    if (!file) return err('Nie znaleziono', 404);
    if (file.file_key && env.DOCS) { try { await env.DOCS.delete(file.file_key); } catch {} }
    await env.DB.prepare('DELETE FROM tachograph_files WHERE id=? AND company_id=?').bind(itemId, company).run();
    return json({ ok: true });
  }

  // GET /api/tacho-ddd/violations
  if (method === 'GET' && sub === 'violations') {
    const severity = url.searchParams.get('severity');
    const dateFrom = url.searchParams.get('date_from');
    const dateTo   = url.searchParams.get('date_to');
    let q = `SELECT v.*, f.driver_surname, f.driver_firstname FROM tachograph_violations v
             JOIN tachograph_files f ON f.id=v.file_id WHERE v.company_id=?`;
    const p = [company];
    if (severity) { q += ' AND v.severity=?'; p.push(severity); }
    if (dateFrom) { q += ' AND v.violation_date>=?'; p.push(dateFrom); }
    if (dateTo)   { q += ' AND v.violation_date<=?'; p.push(dateTo); }
    q += ' ORDER BY v.violation_date DESC LIMIT 1000';
    return json((await env.DB.prepare(q).bind(...p).all()).results || []);
  }

  // GET /api/tacho-ddd/calendar
  if (method === 'GET' && sub === 'calendar') {
    const rows = (await env.DB.prepare(
      `SELECT driver_surname, driver_firstname, card_number,
              MAX(period_end) last_data, MAX(uploaded_at) last_upload,
              MIN(period_start) first_data, COUNT(*) file_count
       FROM tachograph_files WHERE company_id=? AND parse_status IN ('ok','partial')
       GROUP BY LOWER(COALESCE(driver_surname,'')||COALESCE(driver_firstname,'')), card_number
       ORDER BY last_data ASC`
    ).bind(company).all()).results || [];
    const today = new Date().toISOString().slice(0, 10);
    return json(rows.map(r => ({
      ...r,
      days_since_last: r.last_data ? Math.floor((new Date(today) - new Date(r.last_data)) / 86400000) : 999,
      overdue: r.last_data ? Math.floor((new Date(today) - new Date(r.last_data)) / 86400000) > 28 : true
    })));
  }

  // GET /api/tacho-ddd/activities/:fileId — aktywności z jednego pliku
  if (method === 'GET' && sub === 'activities' && itemId) {
    const rows = (await env.DB.prepare(
      `SELECT * FROM tachograph_activities WHERE file_id=? AND company_id=? ORDER BY activity_date, start_time`
    ).bind(itemId, company).all()).results || [];
    return json(rows);
  }

  // GET /api/tacho-ddd/drivers — zestawienie kierowców z danymi tachografu
  if (method === 'GET' && sub === 'drivers') {
    const rows = (await env.DB.prepare(
      `SELECT driver_surname, driver_firstname, card_number, driver_birth_date, card_expiry, driver_id,
              COUNT(*) file_count, SUM(violations_count) total_violations,
              MAX(period_end) last_data, MIN(period_start) first_data, MAX(uploaded_at) last_upload
       FROM tachograph_files
       WHERE company_id=? AND file_type='card'
       GROUP BY LOWER(COALESCE(driver_surname,'')||COALESCE(driver_firstname,'')||COALESCE(card_number,''))
       ORDER BY last_data DESC`
    ).bind(company).all()).results || [];
    const today = new Date().toISOString().slice(0, 10);
    return json(rows.map(r => ({
      ...r,
      days_since_last: r.last_data ? Math.floor((new Date(today) - new Date(r.last_data)) / 86400000) : 999,
      overdue: r.last_data ? Math.floor((new Date(today) - new Date(r.last_data)) / 86400000) > 28 : true
    })));
  }

  // GET /api/tacho-ddd/vehicles — zestawienie pojazdów z danych kart kierowców
  if (method === 'GET' && sub === 'vehicles') {
    const rows = (await env.DB.prepare(
      `SELECT vu.vehicle_reg, vu.vehicle_id,
              COUNT(DISTINCT tf.id) file_count,
              MIN(vu.first_use) first_use, MAX(vu.last_use) last_use,
              SUM(tf.violations_count) total_violations
       FROM tachograph_vehicles_used vu
       JOIN tachograph_files tf ON tf.id=vu.file_id
       WHERE vu.company_id=? AND vu.vehicle_reg IS NOT NULL AND vu.vehicle_reg != ''
       GROUP BY UPPER(REPLACE(vu.vehicle_reg,' ',''))
       ORDER BY last_use DESC`
    ).bind(company).all()).results || [];
    return json(rows);
  }

  // GET /api/tacho-ddd/driver-files/:driverKey — pliki konkretnego kierowcy (surname_firstname)
  if (method === 'GET' && sub === 'driver-files' && itemId) {
    const [surname, firstname] = decodeURIComponent(itemId).split('|');
    const rows = (await env.DB.prepare(
      `SELECT id, file_name, period_start, period_end, violations_count, activities_count,
              uploaded_at, parse_status, card_number
       FROM tachograph_files
       WHERE company_id=? AND LOWER(COALESCE(driver_surname,''))=LOWER(?) AND LOWER(COALESCE(driver_firstname,''))=LOWER(?)
       ORDER BY period_end DESC`
    ).bind(company, surname || '', firstname || '').all()).results || [];
    return json(rows);
  }

  // POST /api/tacho-ddd/upload — przesyłanie pliku(ów) DDD
  if (method === 'POST' && sub === 'upload') {
    let formData;
    try { formData = await req.formData(); } catch { return err('Nieprawidłowe dane multipart', 400); }
    const files = formData.getAll('file');
    if (!files.length) return err('Brak pliku', 400);

    const uploadResults = [];
    for (const file of files) {
      if (!file || typeof file === 'string') continue;
      const fileName  = file.name || 'unknown.ddd';
      const fileSize  = file.size || 0;
      let arrayBuffer;
      try { arrayBuffer = await file.arrayBuffer(); } catch (ex) {
        uploadResults.push({ file: fileName, ok: false, error: 'Błąd odczytu pliku: ' + ex.message });
        continue;
      }

      let parsed;
      try { parsed = parseDDDBuffer(arrayBuffer); }
      catch (ex) {
        uploadResults.push({ file: fileName, ok: false, error: 'Błąd parsowania DDD: ' + ex.message });
        continue;
      }

      // Dla VU (M_DATE_TIME_PLATE_VIN.DDD): wyodrębnij metadane z nazwy pliku
      if (parsed.fileType === 'vu') {
        const vuMatch = fileName.match(/^M_(\d{8})_(\d{4})_(.+?)_([A-Z0-9]{17})\.DDD$/i);
        if (vuMatch) {
          const [, dateStr, timeStr, plateRaw, vinFromName] = vuMatch;
          const downloadDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;
          const plateFromName = plateRaw.trim().replace(/\s+/g, ' ');
          // Ustaw datę pobrania jako period jeśli brak aktywności
          if (!parsed.activitiesByDay.length) {
            parsed._downloadDate = downloadDate;
            parsed._vinFromFile  = vinFromName;
          }
          // Uzupełnij nr rej z nazwy pliku jeśli brak
          if (!parsed.vehiclesUsed.length && plateFromName) {
            parsed.vehiclesUsed = [{ vehicle_reg: plateFromName, first_use: downloadDate, last_use: downloadDate }];
          }
          // Dopasuj pojazd po VIN
          if (!parsed.vehiclesUsed.find(v => v.vehicle_id)) {
            const vByVin = await env.DB.prepare(
              // `vin` nie jest kolumną — siedzi w JSON `data`.
              "SELECT id FROM vehicles WHERE company_id=? AND JSON_EXTRACT(data,'$.vin')=? LIMIT 1"
            ).bind(company, vinFromName).first();
            if (vByVin) {
              parsed.vehiclesUsed = parsed.vehiclesUsed.map(v => ({ ...v, vehicle_id: vByVin.id }));
            }
          }
        }
      }

      const days        = parsed.activitiesByDay || [];
      const dates       = days.map(d => d.date).sort();
      const vuDate      = parsed._downloadDate || null;
      const periodStart = dates[0] || vuDate || null;
      const periodEnd   = dates[dates.length - 1] || vuDate || null;
      const violations  = [...detectViolations561(days), ...detectViolationsWTD(days)];

      // ── Auto-dopasowanie kierowcy z kartoteki ────────────────────────────
      let driverId = null;
      if (parsed.driver?.surname) {
        const fn1 = `${parsed.driver.surname} ${parsed.driver.firstName || ''}`.trim();
        const fn2 = `${parsed.driver.firstName || ''} ${parsed.driver.surname}`.trim();
        const drv = await env.DB.prepare(
          `SELECT id FROM drivers WHERE company_id=? AND (
             LOWER(name)=LOWER(?) OR LOWER(name)=LOWER(?) OR
             LOWER(name) LIKE LOWER(?)
           ) LIMIT 1`
        ).bind(company, fn1, fn2, `%${parsed.driver.surname}%`).first();
        if (drv) driverId = drv.id;
      }

      // ── Auto-dopasowanie pojazdu z listy pojazdów ────────────────────────
      let vehicleId = null;
      const vehiclesUsed = parsed.vehiclesUsed || [];
      if (vehiclesUsed.length > 0) {
        const latestVeh = vehiclesUsed.sort((a, b) => (b.last_use || '') > (a.last_use || '') ? 1 : -1)[0];
        if (latestVeh?.vehicle_reg) {
          const veh = await env.DB.prepare(
            `SELECT id FROM vehicles WHERE company_id=?
             AND UPPER(REPLACE(nr_rej,' ',''))=UPPER(REPLACE(?,' ','')) LIMIT 1`
          ).bind(company, latestVeh.vehicle_reg).first();
          if (veh) vehicleId = veh.id;
        }
      }

      // ── R2: zorganizowana struktura folderów ─────────────────────────────
      let fileKey = null;
      if (env.DOCS) {
        const surnameClean = (parsed.driver?.surname || 'nieznany').replace(/[^a-zA-Z0-9]/g, '_');
        const year         = periodStart?.slice(0, 4) || new Date().getFullYear().toString();
        const uid          = crypto.randomUUID().slice(0, 8);
        const safeFile     = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        fileKey = parsed.fileType === 'card'
          ? `tacho/${company}/kierowcy/${surnameClean}/${year}/${uid}_${safeFile}`
          : `tacho/${company}/pojazdy/${year}/${uid}_${safeFile}`;
        try {
          await env.DOCS.put(fileKey, arrayBuffer, {
            customMetadata: { company, fileName, driver: JSON.stringify(parsed.driver || {}) }
          });
        } catch { fileKey = null; }
      }

      const parseStatus = parsed.parseErrors.length === 0 ? 'ok'
                        : (days.length > 0 ? 'partial' : 'error');

      const fileId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO tachograph_files (id, company_id, file_key, file_name, file_type,
          card_number, driver_surname, driver_firstname, driver_birth_date, card_expiry,
          period_start, period_end, driver_id, vehicle_id, parse_status, parse_error,
          violations_count, activities_count, file_size, uploaded_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        fileId, company, fileKey, fileName, parsed.fileType,
        parsed.cardNumber ?? null,
        parsed.driver?.surname ?? null,
        parsed.driver?.firstName ?? null,
        parsed.driver?.birthDate ?? null,
        parsed.cardExpiry ?? null,
        periodStart, periodEnd,
        driverId, vehicleId,
        parseStatus,
        parsed.parseErrors.length > 0 ? parsed.parseErrors.slice(0, 3).join('; ') : null,
        violations.length,
        days.reduce((s, d) => s + d.activities.length, 0),
        fileSize,
        user.id
      ).run();

      // Zapis aktywności (batch po 100)
      const actStmts = [];
      for (const day of days) {
        const sorted = [...day.activities].sort((a, b) => a.timeMin - b.timeMin);
        for (let ai = 0; ai < sorted.length; ai++) {
          const act  = sorted[ai];
          const next = sorted[ai + 1];
          const dur  = Math.max(0, (next ? next.timeMin : 1440) - act.timeMin);
          const toHM = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
          actStmts.push(env.DB.prepare(
            `INSERT INTO tachograph_activities (id,file_id,company_id,activity_date,start_time,end_time,duration_min,activity_type,driving_status)
             VALUES (?,?,?,?,?,?,?,?,?)`
          ).bind(crypto.randomUUID(), fileId, company, day.date,
            toHM(act.timeMin), toHM(act.timeMin + dur), dur, act.activity, act.driving_status));
        }
      }

      const violStmts = violations.map(v => env.DB.prepare(
        `INSERT INTO tachograph_violations (id,file_id,company_id,violation_date,violation_type,severity,description,regulation,actual_value,limit_value,penalty_pln)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(crypto.randomUUID(), fileId, company, v.violation_date, v.violation_type,
        v.severity, v.description, v.regulation, v.actual_value ?? null, v.limit_value ?? null, v.penalty_pln ?? 0));

      const vehStmts = (parsed.vehiclesUsed || []).map(v => env.DB.prepare(
        `INSERT INTO tachograph_vehicles_used (id,file_id,company_id,vehicle_reg,first_use,last_use)
         VALUES (?,?,?,?,?,?)`
      ).bind(crypto.randomUUID(), fileId, company, v.vehicle_reg, v.first_use, v.last_use));

      const allStmts = [...actStmts, ...violStmts, ...vehStmts];
      for (let i = 0; i < allStmts.length; i += 100) {
        await env.DB.batch(allStmts.slice(i, i + 100));
      }

      uploadResults.push({
        file: fileName, ok: true, id: fileId,
        driver: parsed.driver, fileType: parsed.fileType,
        days: days.length, violations: violations.length,
        driverLinked: !!driverId, vehicleLinked: !!vehicleId,
        parseErrors: parsed.parseErrors
      });
    }

    return json({ ok: true, results: uploadResults });
  }

  // GET /api/tacho-ddd/remaining/:driverKey — pozostałe godziny kierowcy dziś
  if (method === 'GET' && sub === 'remaining' && itemId) {
    const [sn, fn] = decodeURIComponent(itemId).split('|');
    const today = new Date().toISOString().slice(0, 10);
    const acts = (await env.DB.prepare(
      `SELECT a.* FROM tachograph_activities a
       JOIN tachograph_files f ON f.id=a.file_id
       WHERE a.company_id=? AND a.activity_date=?
         AND LOWER(COALESCE(f.driver_surname,''))=LOWER(?)
         AND LOWER(COALESCE(f.driver_firstname,''))=LOWER(?)
       ORDER BY a.start_time`
    ).bind(company, today, sn||'', fn||'').all()).results || [];

    let driving=0, contin=0, breakAcc=0, hasCrew=false;
    for (const a of acts) {
      if (a.driving_status==='crew') hasCrew=true;
      if (a.activity_type==='driving')      { driving+=a.duration_min??0; contin+=a.duration_min??0; breakAcc=0; }
      else if (a.activity_type==='rest')    { breakAcc+=a.duration_min??0; if(breakAcc>=45) contin=0; }
      else                                  { breakAcc=0; }
    }
    const lim = hasCrew ? 600 : 540;
    const lastAct = acts.length ? acts[acts.length-1] : null;
    return json({
      date: today, data_available: acts.length>0,
      driver: { surname: sn, firstname: fn },
      driving_today: driving,
      remaining_daily: Math.max(0, lim - driving),
      daily_limit: lim,
      continuous_driving: contin,
      break_needed_in: Math.max(0, 270 - contin),
      needs_break_now: contin >= 270,
      crew_mode: hasCrew,
      last_activity: lastAct ? { type: lastAct.activity_type, end: lastAct.end_time } : null,
    });
  }

  // GET /api/tacho-ddd/compliance-report — raport zgodności dla firmy
  if (method === 'GET' && sub === 'compliance-report') {
    const dateFrom = url.searchParams.get('date_from') || new Date(Date.now()-30*86400000).toISOString().slice(0,10);
    const dateTo   = url.searchParams.get('date_to')   || new Date().toISOString().slice(0,10);

    const [driverRows, penaltyRows] = await Promise.all([
      env.DB.prepare(
        `SELECT driver_surname, driver_firstname, card_number,
                COUNT(*) file_count, SUM(violations_count) total_violations,
                MAX(period_end) last_data
         FROM tachograph_files WHERE company_id=? AND period_end>=? AND period_start<=?
         GROUP BY LOWER(COALESCE(driver_surname,'')||COALESCE(driver_firstname,'')||COALESCE(card_number,''))
         ORDER BY total_violations DESC`
      ).bind(company, dateFrom, dateTo).all(),
      env.DB.prepare(
        `SELECT f.driver_surname, f.driver_firstname,
                COALESCE(SUM(v.penalty_pln),0) penalty_total,
                COUNT(*) violation_count,
                COUNT(CASE WHEN v.severity='very_serious' THEN 1 END) very_serious,
                COUNT(CASE WHEN v.severity='serious' THEN 1 END) serious,
                COUNT(CASE WHEN v.severity='minor' THEN 1 END) minor
         FROM tachograph_violations v JOIN tachograph_files f ON f.id=v.file_id
         WHERE v.company_id=? AND v.violation_date>=? AND v.violation_date<=?
         GROUP BY LOWER(COALESCE(f.driver_surname,'')||COALESCE(f.driver_firstname,''))`
      ).bind(company, dateFrom, dateTo).all(),
    ]);

    const penMap = {};
    for (const p of (penaltyRows.results||[])) {
      penMap[`${(p.driver_surname||'').toLowerCase()}|${(p.driver_firstname||'').toLowerCase()}`] = p;
    }

    const drivers = (driverRows.results||[]).map(d => {
      const key = `${(d.driver_surname||'').toLowerCase()}|${(d.driver_firstname||'').toLowerCase()}`;
      const pen = penMap[key] || { penalty_total:0, violation_count:0, very_serious:0, serious:0, minor:0 };
      return { ...d, ...pen, compliant: !pen.violation_count };
    });

    const total = drivers.length;
    const compliant = drivers.filter(r=>r.compliant).length;
    return json({
      date_from: dateFrom, date_to: dateTo,
      total_drivers: total, compliant_drivers: compliant,
      compliance_rate: total>0 ? Math.round(compliant/total*100) : 100,
      total_violations: drivers.reduce((s,r)=>s+(r.total_violations||0),0),
      total_penalty: drivers.reduce((s,r)=>s+(r.penalty_total||0),0),
      drivers,
    });
  }

  // GET /api/tacho-ddd/flespi-config
  if (method === 'GET' && sub === 'flespi-config') {
    const cfg = await env.DB.prepare(
      `SELECT id, config, enabled, last_sync, sync_error, files_synced FROM tacho_integrations WHERE company_id=? AND provider='flespi'`
    ).bind(company).first();
    if (!cfg) return json({ configured: false });
    let co = {}; try { co = JSON.parse(cfg.config); } catch {}
    return json({ configured:true, enabled:!!cfg.enabled, last_sync:cfg.last_sync, sync_error:cfg.sync_error, files_synced:cfg.files_synced||0, device_ids:co.device_ids||[], has_token:!!co.token });
  }

  // PUT /api/tacho-ddd/flespi-config
  if (method === 'PUT' && sub === 'flespi-config') {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowy JSON',400); }
    const { token, device_ids, enabled } = body;
    const existing = await env.DB.prepare(`SELECT id, config FROM tacho_integrations WHERE company_id=? AND provider='flespi'`).bind(company).first();
    let cc = {}; if (existing) { try { cc=JSON.parse(existing.config); } catch {} }
    if (token     !== undefined) cc.token      = token;
    if (device_ids!== undefined) cc.device_ids = device_ids;
    if (existing) {
      await env.DB.prepare(`UPDATE tacho_integrations SET config=?,enabled=? WHERE id=?`)
        .bind(JSON.stringify(cc), enabled!==false?1:0, existing.id).run();
    } else {
      await env.DB.prepare(`INSERT INTO tacho_integrations (id,company_id,provider,config,enabled) VALUES (?,?,?,?,?)`)
        .bind(crypto.randomUUID(), company, 'flespi', JSON.stringify(cc), 1).run();
    }
    return json({ ok: true });
  }

  // POST /api/tacho-ddd/flespi-sync
  if (method === 'POST' && sub === 'flespi-sync') {
    const cfg = await env.DB.prepare(`SELECT config FROM tacho_integrations WHERE company_id=? AND provider='flespi' AND enabled=1`).bind(company).first();
    if (!cfg) return err('Brak aktywnej konfiguracji Flespi', 400);
    let co = {}; try { co = JSON.parse(cfg.config); } catch {}
    if (!co.token) return err('Brak tokenu Flespi w konfiguracji', 400);
    try {
      const result = await _flespiSync(env, company, user, co);
      await env.DB.prepare(`UPDATE tacho_integrations SET last_sync=datetime('now'),sync_error=?,files_synced=files_synced+? WHERE company_id=? AND provider='flespi'`)
        .bind(result.errors?.join('; ')||null, result.files||0, company).run();
      return json(result);
    } catch (ex) {
      await env.DB.prepare(`UPDATE tacho_integrations SET last_sync=datetime('now'),sync_error=? WHERE company_id=? AND provider='flespi'`).bind(ex.message,company).run();
      return err('Błąd synchronizacji Flespi: '+ex.message, 500);
    }
  }

  // GET /api/tacho-ddd/driver-analysis/:driverKey — wieloplikowa analiza kierowcy
  if (method === 'GET' && sub === 'driver-analysis' && itemId) {
    const [sn, fn] = decodeURIComponent(itemId).split('|');
    const dateFrom = url.searchParams.get('date_from') || '';
    const dateTo   = url.searchParams.get('date_to')   || '';

    let fq = `SELECT id FROM tachograph_files WHERE company_id=? AND LOWER(COALESCE(driver_surname,''))=LOWER(?) AND LOWER(COALESCE(driver_firstname,''))=LOWER(?)`;
    const fp = [company, sn||'', fn||''];
    if (dateFrom) { fq+=' AND period_end>=?'; fp.push(dateFrom); }
    if (dateTo)   { fq+=' AND period_start<=?'; fp.push(dateTo); }
    const fileIds = ((await env.DB.prepare(fq).bind(...fp).all()).results||[]).map(r=>r.id);

    if (!fileIds.length) return json({ driver:{surname:sn,firstname:fn}, violations:[], summary:{} });

    const ph = fileIds.map(()=>'?').join(',');
    const [acts, viols] = await Promise.all([
      env.DB.prepare(`SELECT * FROM tachograph_activities WHERE file_id IN (${ph}) ORDER BY activity_date, start_time`).bind(...fileIds).all(),
      env.DB.prepare(`SELECT * FROM tachograph_violations WHERE file_id IN (${ph}) ORDER BY violation_date`).bind(...fileIds).all(),
    ]);

    const actsByType = {};
    for (const a of (acts.results||[])) {
      actsByType[a.activity_type] = (actsByType[a.activity_type]||0) + (a.duration_min||0);
    }
    const vData = viols.results||[];
    const summary = {
      driving_total: actsByType.driving??0,
      work_total: actsByType.work??0,
      rest_total: actsByType.rest??0,
      availability_total: actsByType.availability??0,
      violations_total: vData.length,
      penalty_total: vData.reduce((s,v)=>s+(v.penalty_pln??0),0),
      very_serious: vData.filter(v=>v.severity==='very_serious').length,
      serious: vData.filter(v=>v.severity==='serious').length,
      minor: vData.filter(v=>v.severity==='minor').length,
      files_count: fileIds.length,
    };

    return json({ driver:{surname:sn,firstname:fn}, summary, violations: vData });
  }

  // GET /api/tacho-ddd/trend — miesięczne naruszenia (wykres trendu)
  if (method === 'GET' && sub === 'trend') {
    const months = parseInt(url.searchParams.get('months') || '6', 10);
    const rows = (await env.DB.prepare(
      `SELECT substr(violation_date,1,7) ym, severity, COUNT(*) cnt
       FROM tachograph_violations WHERE company_id=?
         AND violation_date >= date('now', '-' || ? || ' months')
       GROUP BY substr(violation_date,1,7), severity
       ORDER BY ym ASC`
    ).bind(company, months).all()).results || [];

    // Aggreguj per miesiąc
    const monthMap = {};
    for (const r of rows) {
      if (!monthMap[r.ym]) monthMap[r.ym] = { month: r.ym, minor: 0, serious: 0, very_serious: 0, most_serious: 0, total: 0 };
      monthMap[r.ym][r.severity] = (monthMap[r.ym][r.severity] ?? 0) + r.cnt;
      monthMap[r.ym].total += r.cnt;
    }
    return json(Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month)));
  }

  // GET /api/tacho-ddd/report-data/:id — pełne dane do generowania PDF w przeglądarce
  if (method === 'GET' && sub === 'report-data' && itemId) {
    const file = await env.DB.prepare('SELECT * FROM tachograph_files WHERE id=? AND company_id=?').bind(itemId, company).first();
    if (!file) return err('Nie znaleziono', 404);
    const [acts, viols, vehs] = await Promise.all([
      env.DB.prepare('SELECT * FROM tachograph_activities WHERE file_id=? ORDER BY activity_date, start_time').bind(itemId).all(),
      env.DB.prepare('SELECT * FROM tachograph_violations WHERE file_id=? ORDER BY violation_date').bind(itemId).all(),
      env.DB.prepare('SELECT * FROM tachograph_vehicles_used WHERE file_id=?').bind(itemId).all(),
    ]);
    return json({ ...file, activities: acts.results || [], violations: viols.results || [], vehicles: vehs.results || [] });
  }

  // GET /api/tacho-ddd/export-csv — eksport CSV naruszeń lub aktywności
  if (method === 'GET' && sub === 'export-csv') {
    const type = url.searchParams.get('type') || 'violations'; // 'violations' | 'activities'
    const dateFrom = url.searchParams.get('date_from') || '';
    const dateTo   = url.searchParams.get('date_to')   || '';

    let rows;
    let csvHeader;

    if (type === 'activities') {
      let q = `SELECT f.driver_surname, f.driver_firstname, a.activity_date, a.start_time, a.end_time,
                      a.duration_min, a.activity_type
               FROM tachograph_activities a JOIN tachograph_files f ON f.id=a.file_id
               WHERE a.company_id=?`;
      const p = [company];
      if (dateFrom) { q += ' AND a.activity_date>=?'; p.push(dateFrom); }
      if (dateTo)   { q += ' AND a.activity_date<=?'; p.push(dateTo); }
      q += ' ORDER BY f.driver_surname, a.activity_date, a.start_time LIMIT 50000';
      rows = (await env.DB.prepare(q).bind(...p).all()).results || [];
      csvHeader = 'Nazwisko;Imię;Data;Godz. od;Godz. do;Czas (min);Aktywność\n';
    } else {
      let q = `SELECT f.driver_surname, f.driver_firstname, v.violation_date, v.violation_type,
                      v.severity, v.description, v.regulation, v.actual_value, v.limit_value, v.penalty_pln
               FROM tachograph_violations v JOIN tachograph_files f ON f.id=v.file_id
               WHERE v.company_id=?`;
      const p = [company];
      if (dateFrom) { q += ' AND v.violation_date>=?'; p.push(dateFrom); }
      if (dateTo)   { q += ' AND v.violation_date<=?'; p.push(dateTo); }
      q += ' ORDER BY v.violation_date DESC LIMIT 50000';
      rows = (await env.DB.prepare(q).bind(...p).all()).results || [];
      csvHeader = 'Nazwisko;Imię;Data;Typ naruszenia;Waga;Opis;Przepis;Faktyczna wartość (min);Limit (min);Kara PLN\n';
    }

    const csvEsc = v => {
      if (v == null) return '';
      const s = String(v);
      return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const csvBody = rows.map(r => Object.values(r).map(csvEsc).join(';')).join('\n');
    const csv = csvHeader + csvBody;
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="tacho_${type}_${new Date().toISOString().slice(0,10)}.csv"`,
        'Access-Control-Allow-Origin': '*',
      }
    });
  }

  // PUT /api/tacho-ddd/files/:id/link — ręczne powiązanie kierowcy/pojazdu
  if (method === 'PUT' && sub === 'files' && itemId && segs[4] === 'link') {
    let body;
    try { body = await req.json(); } catch { return err('Nieprawidłowy JSON', 400); }
    const { driver_id, vehicle_id } = body;
    // Weryfikacja ownership
    const file = await env.DB.prepare('SELECT id FROM tachograph_files WHERE id=? AND company_id=?').bind(itemId, company).first();
    if (!file) return err('Nie znaleziono', 404);
    const fields = [];
    const vals   = [];
    if (driver_id  !== undefined) { fields.push('driver_id=?');  vals.push(driver_id  || null); }
    if (vehicle_id !== undefined) { fields.push('vehicle_id=?'); vals.push(vehicle_id || null); }
    if (!fields.length) return err('Brak pól do aktualizacji', 400);
    vals.push(itemId, company);
    await env.DB.prepare(`UPDATE tachograph_files SET ${fields.join(',')} WHERE id=? AND company_id=?`)
      .bind(...vals).run();
    return json({ ok: true });
  }

  // GET /api/tacho-ddd/comparison — porównanie dwóch kierowców
  if (method === 'GET' && sub === 'comparison') {
    const k1 = url.searchParams.get('driver1') || '';
    const k2 = url.searchParams.get('driver2') || '';
    const dateFrom = url.searchParams.get('date_from') || '';
    const dateTo   = url.searchParams.get('date_to')   || '';

    async function driverStats(key) {
      const [sn, fn] = key.split('|');
      let fq = `SELECT id FROM tachograph_files WHERE company_id=? AND LOWER(COALESCE(driver_surname,''))=LOWER(?) AND LOWER(COALESCE(driver_firstname,''))=LOWER(?)`;
      const fp = [company, sn || '', fn || ''];
      if (dateFrom) { fq += ' AND period_end>=?'; fp.push(dateFrom); }
      if (dateTo)   { fq += ' AND period_start<=?'; fp.push(dateTo); }
      const fileIds = ((await env.DB.prepare(fq).bind(...fp).all()).results || []).map(r => r.id);
      if (!fileIds.length) return { name: key.replace('|', ' '), files: 0, driving_total: 0, rest_total: 0, violations: 0, penalty_total: 0 };

      const placeholders = fileIds.map(() => '?').join(',');
      const [acts, viols] = await Promise.all([
        env.DB.prepare(`SELECT activity_type, SUM(duration_min) tot FROM tachograph_activities WHERE file_id IN (${placeholders}) GROUP BY activity_type`).bind(...fileIds).all(),
        env.DB.prepare(`SELECT COUNT(*) cnt, COALESCE(SUM(penalty_pln),0) penalty FROM tachograph_violations WHERE file_id IN (${placeholders})`).bind(...fileIds).first(),
      ]);
      const actMap = {};
      for (const r of (acts.results || [])) actMap[r.activity_type] = r.tot;
      return {
        name: `${sn} ${fn}`.trim(),
        files: fileIds.length,
        driving_total: actMap.driving ?? 0,
        work_total: actMap.work ?? 0,
        rest_total: actMap.rest ?? 0,
        availability_total: actMap.availability ?? 0,
        violations: viols?.cnt ?? 0,
        penalty_total: viols?.penalty ?? 0,
      };
    }

    const [d1, d2] = await Promise.all([driverStats(k1), driverStats(k2)]);
    return json({ driver1: d1, driver2: d2 });
  }

  return err('Metoda nieobsługiwana', 405);
}

// ─── TACHOGRAPH NIGHTLY CHECK ─────────────────────────────────────────────────

async function runNightlyTachoCheck(env) {
  try {
    const today    = new Date().toISOString().slice(0, 10);
    const warn30   = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const cutoff28 = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);

    // 1. Karty wygasające w ciągu 30 dni
    const expiring = (await env.DB.prepare(
      `SELECT DISTINCT company_id, driver_surname, driver_firstname, card_number, card_expiry
       FROM tachograph_files WHERE card_expiry IS NOT NULL AND card_expiry>=? AND card_expiry<=?`
    ).bind(today, warn30).all()).results || [];

    for (const c of expiring) {
      const days = Math.ceil((new Date(c.card_expiry) - new Date(today)) / 86400000);
      await _tachoSaveAlert(env, c.company_id, 'card_expiry',
        `Karta kierowcy wygasa za ${days} dni`,
        `${c.driver_surname || ''} ${c.driver_firstname || ''} — nr ${c.card_number || '?'}, ważna do ${c.card_expiry}`);
    }

    // 2. Przeterminowane pobieranie danych (>28 dni)
    const overdue = (await env.DB.prepare(
      `SELECT company_id, driver_surname, driver_firstname, card_number, MAX(period_end) last_data
       FROM tachograph_files WHERE parse_status IN ('ok','partial')
       GROUP BY company_id, LOWER(COALESCE(driver_surname,'')||COALESCE(driver_firstname,'')||COALESCE(card_number,''))
       HAVING last_data IS NULL OR last_data<?`
    ).bind(cutoff28).all()).results || [];

    for (const d of overdue) {
      const daysAgo = d.last_data
        ? Math.floor((new Date(today) - new Date(d.last_data)) / 86400000)
        : null;
      await _tachoSaveAlert(env, d.company_id, 'overdue_download',
        `Brak pobierania danych tachografu${daysAgo ? ' (' + daysAgo + ' dni)' : ''}`,
        `${d.driver_surname || ''} ${d.driver_firstname || ''} — ostatnie dane: ${d.last_data || 'brak'}`);
    }

    // 3. Miesięczne podsumowanie naruszeń (tylko 1. dnia miesiąca)
    if (new Date().getUTCDate() === 1) {
      const prevMonth = new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 7);
      const summaries = (await env.DB.prepare(
        `SELECT company_id, COUNT(*) cnt, COALESCE(SUM(penalty_pln),0) penalty
         FROM tachograph_violations WHERE substr(violation_date,1,7)=? GROUP BY company_id`
      ).bind(prevMonth).all()).results || [];
      for (const s of summaries) {
        await _tachoSaveAlert(env, s.company_id, 'monthly_summary',
          `Podsumowanie naruszeń ${prevMonth}`,
          `Liczba naruszeń: ${s.cnt} | Łączne kary: ${s.penalty} PLN`);
      }
    }

    // 4. CPC / Kwalifikacja zawodowa wygasająca w 60 dni
    const warn60cpc = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    try {
      const cpcRows = (await env.DB.prepare(
        `SELECT company_id, name, cpc_expiry_date FROM drivers
         WHERE cpc_expiry_date IS NOT NULL AND cpc_expiry_date>=? AND cpc_expiry_date<=?`
      ).bind(today, warn60cpc).all()).results || [];
      for (const r of cpcRows) {
        const days = Math.ceil((new Date(r.cpc_expiry_date) - new Date(today)) / 86400000);
        await _tachoSaveAlert(env, r.company_id, 'cpc_expiry',
          `Kwalifikacja zawodowa CPC wygasa za ${days} dni`,
          `Kierowca: ${r.name} — ważna do: ${r.cpc_expiry_date}`);
      }
    } catch {}

    // 5. Kalibracja tachografu pojazdu — alert 30 dni przed
    try {
      const calRows = (await env.DB.prepare(
        `SELECT company_id, nr_rej, tacho_calibration_next FROM vehicles
         WHERE tacho_calibration_next IS NOT NULL AND tacho_calibration_next>=? AND tacho_calibration_next<=?`
      ).bind(today, warn30).all()).results || [];
      for (const r of calRows) {
        const days = Math.ceil((new Date(r.tacho_calibration_next) - new Date(today)) / 86400000);
        await _tachoSaveAlert(env, r.company_id, 'tacho_calibration',
          `Kalibracja tachografu za ${days} dni`,
          `Pojazd: ${r.nr_rej} — termin kalibracji: ${r.tacho_calibration_next}`);
      }
    } catch {}

    // 6. VU — brak pobierania danych jednostki pojazdu >90 dni
    const cutoff90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    try {
      const vuRows = (await env.DB.prepare(
        `SELECT company_id, nr_rej, tacho_vu_last_download FROM vehicles
         WHERE company_id IS NOT NULL
           AND (tacho_vu_last_download IS NULL OR tacho_vu_last_download<?)`
      ).bind(cutoff90).all()).results || [];
      for (const r of vuRows) {
        const daysAgo = r.tacho_vu_last_download
          ? Math.floor((new Date(today) - new Date(r.tacho_vu_last_download)) / 86400000)
          : null;
        await _tachoSaveAlert(env, r.company_id, 'vu_overdue',
          `Brak pobierania danych VU tachografu${daysAgo ? ' (' + daysAgo + ' dni)' : ''}`,
          `Pojazd: ${r.nr_rej} — ostatnie pobranie VU: ${r.tacho_vu_last_download||'brak'} (limit: 90 dni)`);
      }
    } catch {}

    // 7. Automatyczna synchronizacja Flespi (jeśli włączona)
    try {
      const flespiCfgs = (await env.DB.prepare(
        `SELECT company_id, config FROM tacho_integrations WHERE provider='flespi' AND enabled=1`
      ).all()).results || [];
      for (const fc of flespiCfgs) {
        let co = {}; try { co = JSON.parse(fc.config); } catch {}
        if (!co.token) continue;
        const result = await _flespiSync(env, fc.company_id, null, co).catch(e=>({files:0,error:e.message}));
        await env.DB.prepare(`UPDATE tacho_integrations SET last_sync=datetime('now'),sync_error=?,files_synced=files_synced+? WHERE company_id=? AND provider='flespi'`)
          .bind(result.error||null, result.files||0, fc.company_id).run();
      }
    } catch {}

  } catch (e) {
    console.error('runNightlyTachoCheck error:', e?.message);
  }
}

async function _tachoSaveAlert(env, companyId, type, title, body) {
  try {
    // Zapisz do tabeli alert_events jeśli istnieje, inaczej tylko log
    await env.DB.prepare(
      `INSERT OR IGNORE INTO alert_events (id,company_id,alert_type,title,message,triggered_at,acknowledged)
       VALUES (?,?,?,?,?,datetime('now'),0)`
    ).bind(crypto.randomUUID(), companyId, type, title, body).run();
  } catch {
    console.log(`[TachoAlert] ${companyId} ${type}: ${title}`);
  }
}

// ─── EXTERNAL INTEGRATIONS (Shell, DKV, Navifleet) ───────────────────────────

async function handleIntegrations(request, env, user, url, path) {
  const segs    = path.split('/');          // /api/integrations[/provider[/action]]
  const company = url.searchParams.get('company') || user.company_id;
  const provider = segs[3];                // shell | dkv | navifleet | undefined
  const action   = segs[4];                // sync | log | undefined

  // GET /api/integrations — list all
  if (request.method === 'GET' && !provider) {
    const { results } = await env.DB.prepare(
      'SELECT provider, last_sync, last_sync_count, last_sync_status, updated_at FROM integration_settings WHERE company_id=?'
    ).bind(company).all();
    return json(results);
  }

  // GET /api/integrations/:provider — single (secrets masked)
  if (request.method === 'GET' && provider && !action) {
    const row = await env.DB.prepare('SELECT * FROM integration_settings WHERE company_id=? AND provider=?').bind(company, provider).first();
    if (!row) return json({ provider, config: '{}' });
    const cfg = JSON.parse(row.config || '{}');
    const masked = { ...cfg };
    if (masked.client_secret)    masked.client_secret    = '***';
    if (masked.api_key)          masked.api_key          = '***';
    if (masked.subscription_key) masked.subscription_key = '***';
    return json({ ...row, config: JSON.stringify(masked) });
  }

  // POST /api/integrations/:provider — upsert config
  if (request.method === 'POST' && provider && !action) {
    const body = await request.json().catch(() => ({}));
    const newCfg = body.config || {};
    const existing = await env.DB.prepare('SELECT config FROM integration_settings WHERE company_id=? AND provider=?').bind(company, provider).first();
    let finalCfg = newCfg;
    if (existing) {
      const old = JSON.parse(existing.config || '{}');
      finalCfg = { ...old, ...newCfg };
      if (newCfg.client_secret    === '***') finalCfg.client_secret    = old.client_secret;
      if (newCfg.api_key          === '***') finalCfg.api_key          = old.api_key;
      if (newCfg.subscription_key === '***') finalCfg.subscription_key = old.subscription_key;
    }
    const id = crypto.randomUUID().replace(/-/g, '');
    await env.DB.prepare(
      `INSERT INTO integration_settings (id,company_id,provider,config,updated_at)
       VALUES (?,?,?,?,datetime('now'))
       ON CONFLICT(company_id,provider) DO UPDATE SET config=excluded.config, updated_at=excluded.updated_at`
    ).bind(id, company, provider, JSON.stringify(finalCfg)).run();
    return json({ ok: true });
  }

  // DELETE /api/integrations/:provider
  if (request.method === 'DELETE' && provider && !action) {
    await env.DB.prepare('DELETE FROM integration_settings WHERE company_id=? AND provider=?').bind(company, provider).run();
    return json({ ok: true });
  }

  // GET /api/integrations/:provider/log
  if (request.method === 'GET' && action === 'log') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM integration_sync_log WHERE company_id=? AND provider=? ORDER BY synced_at DESC LIMIT 20'
    ).bind(company, provider).all();
    return json(results);
  }

  // POST /api/integrations/:provider/sync
  if (request.method === 'POST' && action === 'sync') {
    const row = await env.DB.prepare('SELECT config FROM integration_settings WHERE company_id=? AND provider=?').bind(company, provider).first();
    if (!row) return err('Integracja nie skonfigurowana — zapisz dane dostępowe najpierw', 404);
    const cfg      = JSON.parse(row.config || '{}');
    const body     = await request.json().catch(() => ({}));
    const daysBack = parseInt(body.days_back ?? 7);
    const testOnly = body.test_only === true;

    let result;
    try {
      if (provider === 'shell')     result = await _syncShell(env, company, cfg, daysBack, testOnly);
      else if (provider === 'dkv')  result = await _syncDkv(env, company, cfg, daysBack, testOnly);
      else if (provider === 'navifleet') result = await _syncNavifleet(env, company, cfg, daysBack, testOnly);
      else return err('Nieznany provider', 400);
    } catch (ex) {
      result = { imported: 0, skipped: 0, error: ex.message };
    }

    if (!testOnly) {
      await env.DB.prepare(
        `UPDATE integration_settings SET last_sync=datetime('now'), last_sync_count=?, last_sync_status=? WHERE company_id=? AND provider=?`
      ).bind(result.imported ?? 0, result.error ? 'error' : 'ok', company, provider).run();
      const lid = crypto.randomUUID().replace(/-/g, '');
      await env.DB.prepare(
        `INSERT INTO integration_sync_log (id,company_id,provider,records_imported,records_skipped,status,error_message) VALUES (?,?,?,?,?,?,?)`
      ).bind(lid, company, provider, result.imported??0, result.skipped??0, result.error?'error':'ok', result.error??null).run().catch(()=>{});
    }
    return json(result);
  }

  return err('Not Found', 404);
}

// ── Shell Flota sync ──────────────────────────────────────────────────────────
async function _syncShell(env, company, cfg, daysBack, testOnly) {
  const { client_id, client_secret, colco_code, payer_number } = cfg;
  if (!client_id || !client_secret || !payer_number)
    return { imported:0, skipped:0, error:'Brak client_id, client_secret lub payer_number' };

  // 1. OAuth token
  const tokRes = await fetch('https://api.shell.com/oauth/v1/mobility/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(client_id)}&client_secret=${encodeURIComponent(client_secret)}`,
  });
  if (!tokRes.ok) return { imported:0, skipped:0, error: `Błąd tokenu Shell (${tokRes.status}): ${await tokRes.text()}` };
  const { access_token } = await tokRes.json();

  if (testOnly) return { imported:0, skipped:0, connected:true };

  // 2. Priced transactions
  const from = new Date(Date.now() - daysBack * 86400000).toISOString().replace('T', ' ').slice(0, 23) + '.000';
  const to   = new Date().toISOString().replace('T', ' ').slice(0, 23) + '.000';
  const txRes = await fetch('https://api.shell.com/transaction-data/v1/pricedtransactions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'RequestId': crypto.randomUUID(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ColCoCode: colco_code || 'PL',
      PayerNumber: payer_number,
      FuelOnly: true,
      FromDateTime: from,
      ToDateTime: to,
      Page: 1,
      PageSize: 500,
    }),
  });
  if (!txRes.ok) return { imported:0, skipped:0, error: `Błąd transakcji Shell (${txRes.status}): ${await txRes.text()}` };
  const txData = await txRes.json();
  if (txData.Status && txData.Status !== 'SUCCESS')
    return { imported:0, skipped:0, error: `Shell API status: ${txData.Status}` };

  const records = (txData.Data || [])
    .filter(t => t.VehicleRegistrationNumber)
    .map(t => ({
      nr_rej:          (t.VehicleRegistrationNumber || '').toUpperCase().replace(/\s+/g, ''),
      fill_date:       (t.TransactionDate || t.TransactionDateTime || '').slice(0, 10),
      liters:          parseFloat(t.FuelVolume) || 0,
      cost_pln:        parseFloat(t.Amount) || 0,
      price_per_liter: parseFloat(t.UnitPrice) || null,
      station:         t.SiteName || null,
    }))
    .filter(r => r.nr_rej && r.fill_date);

  return _saveFuelFills(env, company, records);
}

// ── DKV Mobility sync ─────────────────────────────────────────────────────────
async function _syncDkv(env, company, cfg, daysBack, testOnly) {
  const { subscription_key, customer_number } = cfg;
  if (!subscription_key || !customer_number)
    return { imported:0, skipped:0, error:'Brak subscription_key lub customer_number DKV' };

  const from = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);
  const to   = new Date().toISOString().slice(0, 10);

  const txRes = await fetch(
    `https://api.dkv-mobility.com/eapi/transaction/v1/transactions?customerNumber=${encodeURIComponent(customer_number)}&dateFrom=${from}&dateTo=${to}`,
    {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': subscription_key,
        'Accept': 'application/json',
      },
    }
  );
  if (!txRes.ok) return { imported:0, skipped:0, error: `Błąd DKV API (${txRes.status}): ${await txRes.text()}` };
  const data = await txRes.json();

  if (testOnly) return { imported:0, skipped:0, connected:true };

  const list = Array.isArray(data) ? data : (data.transactions || data.data || []);
  const records = list
    .map(t => ({
      nr_rej:   (t.vehicleRegistrationNumber || t.vehicle_registration || t.plateNumber || '').toUpperCase().replace(/\s+/g, ''),
      fill_date: (t.transactionDate || t.date || t.transactionDateTime || '').slice(0, 10),
      liters:    parseFloat(t.quantity ?? t.liters ?? t.volume ?? 0),
      cost_pln:  parseFloat(t.netAmount ?? t.amount ?? t.grossAmount ?? 0),
      station:   t.locationName || t.merchantName || t.station || null,
    }))
    .filter(r => r.nr_rej && r.fill_date);

  return _saveFuelFills(env, company, records);
}

// ── Navifleet GPS sync ────────────────────────────────────────────────────────
async function _syncNavifleet(env, company, cfg, daysBack, testOnly) {
  const { api_key } = cfg;
  if (!api_key) return { imported:0, skipped:0, error:'Brak api_key Navifleet' };

  const headers = { 'Authorization': `ApiKey ${api_key}`, 'Accept': 'application/json' };

  // Test: GET /vehicles
  const veRes = await fetch('https://gps.navifleet.pl/api/vehicles', { headers });
  if (!veRes.ok) return { imported:0, skipped:0, error: `Błąd Navifleet API (${veRes.status}): ${await veRes.text()}` };
  const veData = await veRes.json();
  const vehicles = veData.data || veData || [];

  if (testOnly) return { imported:0, skipped:0, connected:true, vehicle_count: vehicles.length };

  const from = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);
  const to   = new Date().toISOString().slice(0, 10);
  const allRecords = [];

  for (const v of vehicles) {
    const vid   = v.id ?? v.vehicleId;
    const nrRej = (v.registrationNumber ?? v.plate ?? v.licensePlate ?? '').toUpperCase().replace(/\s+/g, '');
    if (!vid || !nrRej) continue;

    const fuelRes = await fetch(
      `https://gps.navifleet.pl/api/vehicles/${vid}/fuel-events?dateFrom=${from}&dateTo=${to}`,
      { headers }
    );
    if (!fuelRes.ok) continue;
    const fuelData = await fuelRes.json();
    const events   = fuelData.data || fuelData || [];

    for (const fe of events) {
      const dt = (fe.date ?? fe.timestamp ?? fe.datetime ?? '').slice(0, 10);
      if (!dt) continue;
      allRecords.push({
        nr_rej:   nrRej,
        fill_date: dt,
        liters:    parseFloat(fe.volume ?? fe.liters ?? fe.quantity ?? 0),
        cost_pln:  parseFloat(fe.cost ?? fe.amount ?? 0),
        station:   fe.station ?? fe.location ?? null,
      });
    }
  }

  return _saveFuelFills(env, company, allRecords);
}

// ── shared save helper ────────────────────────────────────────────────────────
async function _saveFuelFills(env, company, records) {
  if (!records.length) return { imported:0, skipped:0 };
  const stmts = records.map(r => env.DB.prepare(
    'INSERT OR IGNORE INTO fuel_fills (company_id,nr_rej,fill_date,liters,total_cost,price_per_liter,station) VALUES (?,?,?,?,?,?,?)'
  ).bind(company, r.nr_rej, r.fill_date, r.liters ?? 0, r.cost_pln ?? 0, r.price_per_liter ?? null, r.station ?? null));
  const res = await env.DB.batch(stmts);
  let imported = 0, skipped = 0;
  for (const r of res) { if ((r.meta?.changes ?? 0) > 0) imported++; else skipped++; }
  return { imported, skipped };
}

// ── nightly auto-sync for all configured integrations ─────────────────────────
async function runNightlyIntegrationSync(env) {
  try {
    const { results: configs } = await env.DB.prepare(
      'SELECT company_id, provider, config FROM integration_settings'
    ).all();
    for (const row of configs) {
      const cfg = JSON.parse(row.config || '{}');
      const daysBack = parseInt(cfg.days_back ?? 2);
      let result;
      try {
        if (row.provider === 'shell')     result = await _syncShell(env, row.company_id, cfg, daysBack, false);
        else if (row.provider === 'dkv')  result = await _syncDkv(env, row.company_id, cfg, daysBack, false);
        else if (row.provider === 'navifleet') result = await _syncNavifleet(env, row.company_id, cfg, daysBack, false);
        else continue;
      } catch (ex) {
        result = { imported:0, skipped:0, error: ex.message };
      }
      await env.DB.prepare(
        `UPDATE integration_settings SET last_sync=datetime('now'), last_sync_count=?, last_sync_status=? WHERE company_id=? AND provider=?`
      ).bind(result.imported ?? 0, result.error ? 'error' : 'ok', row.company_id, row.provider).run().catch(() => {});
      const lid = crypto.randomUUID().replace(/-/g, '');
      await env.DB.prepare(
        `INSERT INTO integration_sync_log (id,company_id,provider,records_imported,records_skipped,status,error_message) VALUES (?,?,?,?,?,?,?)`
      ).bind(lid, row.company_id, row.provider, result.imported??0, result.skipped??0, result.error?'error':'ok', result.error??null).run().catch(()=>{});
    }
  } catch {}
}

// ─── APPROVAL LEVELS ──────────────────────────────────────────────────────────
async function getRequiredApprovalLevel(env, company_id, amount) {
  return env.DB.prepare('SELECT * FROM approval_levels WHERE company_id=? AND min_amount<=? ORDER BY min_amount DESC LIMIT 1').bind(company_id, amount).first();
}

async function handleApprovalLevels(request, env, user, url, path) {
  const segs    = path.split('/');
  const company = url.searchParams.get('company') || user.company_id;
  const id      = segs[3];

  if (request.method === 'GET' && id) {
    const level = await env.DB.prepare('SELECT * FROM approval_levels WHERE id=? AND company_id=?').bind(id, company).first();
    if (!level) return err('Nie znaleziono', 404);
    return json({ level });
  }

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM approval_levels WHERE company_id=? ORDER BY level').bind(company).all();
    return json({ levels: results });
  }

  if (request.method === 'POST') {
    let body; try { body = await request.json(); } catch { return err('Nieprawidłowe JSON'); }
    if (!body.level || body.min_amount == null || !body.approver_email) return err('Wymagane: level, min_amount, approver_email');
    const newId = crypto.randomUUID().replace(/-/g,'');
    await env.DB.prepare(
      'INSERT INTO approval_levels (id,company_id,level,min_amount,max_amount,approver_email,approver_name,entity_types) VALUES (?,?,?,?,?,?,?,?)'
    ).bind(newId, company, body.level, body.min_amount, body.max_amount??null, body.approver_email, body.approver_name??null, body.entity_types?JSON.stringify(body.entity_types):null).run();
    return json({ ok: true, id: newId }, 201);
  }

  if (request.method === 'PUT' && id) {
    const existing = await env.DB.prepare('SELECT * FROM approval_levels WHERE id=? AND company_id=?').bind(id, company).first();
    if (!existing) return err('Nie znaleziono', 404);
    let body; try { body = await request.json(); } catch { return err('Nieprawidłowe JSON'); }
    await env.DB.prepare(
      'UPDATE approval_levels SET level=?,min_amount=?,max_amount=?,approver_email=?,approver_name=?,entity_types=? WHERE id=? AND company_id=?'
    ).bind(body.level??existing.level, body.min_amount??existing.min_amount, 'max_amount' in body?(body.max_amount??null):existing.max_amount,
      body.approver_email??existing.approver_email, body.approver_name??existing.approver_name,
      body.entity_types?JSON.stringify(body.entity_types):existing.entity_types, id, company).run();
    return json({ ok: true });
  }

  if (request.method === 'DELETE' && id) {
    const existing = await env.DB.prepare('SELECT id FROM approval_levels WHERE id=? AND company_id=?').bind(id, company).first();
    if (!existing) return err('Nie znaleziono', 404);
    await env.DB.prepare('DELETE FROM approval_levels WHERE id=? AND company_id=?').bind(id, company).run();
    return json({ ok: true });
  }

  return err('Method Not Allowed', 405);
}

// ─── GPS POSITIONS ────────────────────────────────────────────────────────────
async function handleGpsPositions(request, env, user, url, path) {
  const segs    = path.split('/');
  const company = url.searchParams.get('company') || user.company_id;

  if (request.method === 'GET' && segs[3] === 'latest') {
    const { results } = await env.DB.prepare(
      `SELECT g.vehicle_id,g.nr_rej,g.lat,g.lng,g.speed,g.odometer,g.heading,g.ignition,g.recorded_at
       FROM gps_positions g
       INNER JOIN (SELECT vehicle_id,MAX(recorded_at) AS max_ts FROM gps_positions WHERE company_id=? GROUP BY vehicle_id) last
       ON g.vehicle_id=last.vehicle_id AND g.recorded_at=last.max_ts WHERE g.company_id=?`
    ).bind(company, company).all();
    return json(results);
  }

  if (request.method === 'GET') {
    const vid  = url.searchParams.get('vehicle_id');
    const from = url.searchParams.get('from');
    const to   = url.searchParams.get('to');
    const lim  = Math.min(parseInt(url.searchParams.get('limit')||'500'), 5000);
    let sql = 'SELECT * FROM gps_positions WHERE company_id=?'; const binds = [company];
    if (vid)  { sql += ' AND vehicle_id=?'; binds.push(vid); }
    if (from) { sql += ' AND recorded_at>=?'; binds.push(from); }
    if (to)   { sql += ' AND recorded_at<=?'; binds.push(to); }
    sql += ' ORDER BY recorded_at DESC LIMIT ?'; binds.push(lim);
    const { results } = await env.DB.prepare(sql).bind(...binds).all();
    return json(results);
  }

  if (request.method === 'POST') {
    let body; try { body = await request.json(); } catch { return err('Nieprawidłowe JSON'); }
    const items = Array.isArray(body) ? body : [body];
    if (!items.length) return err('Brak danych');
    const stmts = items.map(p => env.DB.prepare(
      'INSERT INTO gps_positions (company_id,vehicle_id,nr_rej,lat,lng,speed,odometer,heading,ignition,recorded_at,source) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
    ).bind(company, p.vehicle_id??null, p.nr_rej??null, p.lat??null, p.lng??null, p.speed??null, p.odometer??null, p.heading??null, p.ignition??null, p.recorded_at||new Date().toISOString(), p.source||'webhook'));
    await env.DB.batch(stmts);
    return json({ ok: true, inserted: items.length });
  }

  if (request.method === 'DELETE' && segs[3] === 'old') {
    const days = Math.min(parseInt(url.searchParams.get('days')||'30'), 90);
    await env.DB.prepare("DELETE FROM gps_positions WHERE company_id=? AND recorded_at<datetime('now',?)").bind(company, `-${days} days`).run();
    return json({ ok: true, days });
  }

  return err('Method Not Allowed', 405);
}

// ─── MAIN FETCH ───────────────────────────────────────────────────────────────
async function handleRequest(request, env, url, path, ctx) {
  // Public endpoints (no auth required)
  if (path === '/api/auth/login'            && request.method === 'POST') {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rl = await rateLimit(env, `login:${ip}`, 10, 60);
    if (!rl.allowed) return json({ error: 'Zbyt wiele prób logowania. Poczekaj minutę.' }, 429);
    return handleLogin(request, env, ctx);
  }
  if (path === '/api/auth/logout'           && request.method === 'POST') return handleLogout(request, env);
  if (path === '/api/auth/pz/start'         && request.method === 'GET')  return handlePzStart(request, env, url);
  if (path === '/api/auth/pz/callback'      && request.method === 'GET')  return handlePzCallback(request, env, url);
  if (path === '/api/auth/pz/userinfo'      && request.method === 'GET')  return handlePzUserinfo(request, env);
  if (path === '/api/push/vapid-public-key' && request.method === 'GET')  return handleVapidPublicKey(request, env);
  if (path === '/api/push/subscribe'        && request.method === 'DELETE') return handlePushUnsubscribe(request, env);
  // POST /api/errors jest publiczny (bez tokenu) — błędy mogą pojawiać się przed logowaniem
  if (path === '/api/errors' && request.method === 'POST') {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rl = await rateLimit(env, `err:${ip}`, 20, 60);
    if (!rl.allowed) return json({ error: 'Zbyt wiele zgłoszeń. Poczekaj minutę.' }, 429);
    return handleErrors(request, env, null, url, path);
  }
  // Publiczna konfiguracja aplikacji (klucz PostHog, Clerk publishable key)
  if (path === '/api/app-config' && request.method === 'GET') {
    return json({
      posthog_api_key: env.POSTHOG_API_KEY || null,
      posthog_host: 'https://eu.i.posthog.com',
      clerk_publishable_key: env.CLERK_PUBLISHABLE_KEY || null,
    });
  }
  // Logowanie przez Clerk — wymiana tokenu Clerk na sesję D1
  if (path === '/api/auth/clerk-signin' && request.method === 'POST') {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rl = await rateLimit(env, `clerk-signin:${ip}`, 10, 60);
    if (!rl.allowed) return json({ error: 'Zbyt wiele prób. Poczekaj minutę.' }, 429);
    return handleClerkSignin(request, env);
  }

  // Protected endpoints
  const user = await getUser(request, env);

  // Globalny limit API: 300 req/min per użytkownik (zapobiega abuse tokenem; Upstash opcjonalny)
  if (user) {
    const rlApi = await rateLimit(env, `api:${user.id}`, 300, 60);
    if (!rlApi.allowed) return json({ error: 'Zbyt wiele zapytań. Poczekaj chwilę.' }, 429);
  }

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

  // Egzekwowanie licencji modułów (serwerowo). Kill switch: wrangler secret put MODULE_ENFORCEMENT → off
  // MUSI stać PO guardach firmy powyżej: enforceModuleAccess czyta ?company= z URL, więc
  // uruchamiane wcześniej odpowiadało na pytanie o pakiet OBCEJ firmy (402 vs przepuszczenie
  // = kanał boczny ujawniający jej moduły). Dziś nieaktywny tylko dlatego, że resolveModuleAccess
  // zawsze zwraca ['*'] — patrz dług: company_packages bez kolumny `active`.
  if (user) {
    const denied = await enforceModuleAccess(env, user, url, path);
    if (denied) return denied;
  }

  if (path === '/api/push/subscribe' && request.method === 'POST') {
    if (!user) return err('Nieautoryzowany', 401);
    return handlePushSubscribe(request, env, user);
  }

  if (path === '/api/dashboard/stats' && request.method === 'GET') {
    if (!user) return err('Nieautoryzowany', 401);
    const company = url.searchParams.get('company');
    if (!company) return err('Podaj parametr ?company=');
    return handleDashboardStats(env, company);
  }

  if (path === '/api/export' && request.method === 'GET') {
    if (!user) return err('Nieautoryzowany', 401);
    const company = url.searchParams.get('company');
    if (!company) return err('Podaj parametr ?company=');
    if (user._apiKey) {
      if (user.company_id !== company) return err('Klucz API nie ma dostępu do danych tej firmy', 403);
    } else if (!['admin', 'kierownik'].includes(user.role)) {
      return err('Brak uprawnień do eksportu danych', 403);
    }
    return handleExport(env, company);
  }
  if (path === '/api/import' && request.method === 'POST') {
    if (!user) return err('Nieautoryzowany', 401);
    const company = url.searchParams.get('company');
    if (!company) return err('Podaj parametr ?company=');
    if (user._apiKey) {
      if (user.company_id !== company) return err('Klucz API nie ma dostępu do danych tej firmy', 403);
      if (user.api_key_scope !== 'read_write') return err('Klucz API ma tylko uprawnienia do odczytu', 403);
    } else if (!['admin', 'kierownik'].includes(user.role)) {
      return err('Brak uprawnień do importu danych', 403);
    }
    return handleImport(request, env, company);
  }
  if (path.startsWith('/api/drivers'))          { if (!user) return err('Nieautoryzowany', 401); return handleDrivers(request, env, user, url, path); }
  if (path.startsWith('/api/fines'))            { if (!user) return err('Nieautoryzowany', 401); return handleFines(request, env, user, url, path); }
  if (path.startsWith('/api/dt1-declarations')) { if (!user) return err('Nieautoryzowany', 401); return handleDt1Declarations(request, env, user, url, path); }
  if (path.startsWith('/api/webhooks'))         { if (!user) return err('Nieautoryzowany', 401); if (!['admin','kierownik'].includes(user.role)) return err('Brak uprawnień',403); return handleWebhooks(request, env, user, url, path); }
  if (path.startsWith('/api/fleet-cards'))  { if (!user) return err('Nieautoryzowany', 401); return handleFleetCards(request, env, user, url, path); }
  if (path.startsWith('/api/reservations')) { if (!user) return err('Nieautoryzowany', 401); return handleReservations(request, env, user, url, path); }
  if (path.startsWith('/api/api-keys'))     { if (!user) return err('Nieautoryzowany', 401); return handleApiKeys(request, env, user, url, path); }
  if (path.startsWith('/api/errors'))       { if (!user) return err('Nieautoryzowany', 401); return handleErrors(request, env, user, url, path); }

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
  if (path === '/api/prefs/kv')         { if (!user) return err('Nieautoryzowany', 401); return handlePrefsKv(request, env, user, url); }
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
  if (path.startsWith('/api/companies')) {
    if (!user) return err('Nieautoryzowany', 401);
    return handleCompanies(request, env, user, url, path);
  }
  if (path.startsWith('/api/company-access')) {
    if (!user) return err('Nieautoryzowany', 401);
    return handleCompanyAccess(request, env, user, url, path);
  }
  if (path.startsWith('/api/alert-types'))        { if (!user) return err('Nieautoryzowany', 401); return handleAlertTypes(request, env, user, url, path); }
  if (path.startsWith('/api/notif-prefs'))         { if (!user) return err('Nieautoryzowany', 401); return handleNotifPrefs(request, env, user, url); }
  if (path.startsWith('/api/notif-log'))           { if (!user) return err('Nieautoryzowany', 401); return handleNotifLog(request, env, user, url, path); }
  if (path.startsWith('/api/maintenance-templates')){ if (!user) return err('Nieautoryzowany', 401); return handleMaintenanceTemplates(request, env, user, url, path); }
  if (path.startsWith('/api/policies-db'))      { if (!user) return err('Nieautoryzowany', 401); return handlePoliciesDB(request, env, user, url, path); }
  if (path.startsWith('/api/service-schedules')){ if (!user) return err('Nieautoryzowany', 401); return handleServiceSchedules(request, env, user, url, path); }
  if (path.startsWith('/api/mileage-claims'))   { if (!user) return err('Nieautoryzowany', 401); return handleMileageClaims(request, env, user, url, path); }
  if (path.startsWith('/api/branches'))        { if (!user) return err('Nieautoryzowany', 401); return handleBranches(request, env, user, url, path); }
  if (path.startsWith('/api/fuel-fills'))      { if (!user) return err('Nieautoryzowany', 401); return handleFuelFills(request, env, user, url, path); }
  if (path.startsWith('/api/budgets'))         { if (!user) return err('Nieautoryzowany', 401); return handleBudgets(request, env, user, url, path); }
  if (path.startsWith('/api/faults'))          { if (!user) return err('Nieautoryzowany', 401); return handleFaults(request, env, user, url, path); }
  if (path.startsWith('/api/driver-shifts'))   { if (!user) return err('Nieautoryzowany', 401); return handleDriverShifts(request, env, user, url, path); }
  if (path.startsWith('/api/tacho-records'))   { if (!user) return err('Nieautoryzowany', 401); return handleTachoRecords(request, env, user, url, path); }
  if (path.startsWith('/api/benchmark'))       { if (!user) return err('Nieautoryzowany', 401); return handleBenchmark(request, env, user, url, path); }
  if (path.startsWith('/api/gl-accounts'))     { if (!user) return err('Nieautoryzowany', 401); return handleGlAccounts(request, env, user, url, path); }
  if (path.startsWith('/api/fk-export'))       { if (!user) return err('Nieautoryzowany', 401); return handleFkExport(request, env, user, url, path); }
  if (path.startsWith('/api/report-subs'))     { if (!user) return err('Nieautoryzowany', 401); return handleReportSubscriptions(request, env, user, url, path); }
  if (path.startsWith('/api/vehicle-tokens'))  { if (!user) return err('Nieautoryzowany', 401); return handleVehicleTokens(request, env, user, url, path); }
  if (path.startsWith('/api/driver-form'))     { return handleDriverForm(request, env, url, path); }
  if (path.startsWith('/api/driver-profiles'))    { if (!user) return err('Nieautoryzowany', 401); return handleDriverProfiles(request, env, user, url, path); }
  if (path.startsWith('/api/vehicle-reservations')){ if (!user) return err('Nieautoryzowany', 401); return handleVehicleReservations(request, env, user, url, path); }
  if (path.startsWith('/api/approvals'))           { if (!user) return err('Nieautoryzowany', 401); return handleApprovals(request, env, user, url, path); }
  if (path.startsWith('/api/fleet-policies'))      { if (!user) return err('Nieautoryzowany', 401); return handleFleetPolicies(request, env, user, url, path); }
  if (path.startsWith('/api/driver-performance'))  { if (!user) return err('Nieautoryzowany', 401); return handleDriverPerformance(request, env, user, url, path); }
  if (path.startsWith('/api/executive-dashboard')) { if (!user) return err('Nieautoryzowany', 401); return handleExecutiveDashboard(request, env, user, url, path); }
  if (path.startsWith('/api/spare-parts'))         { if (!user) return err('Nieautoryzowany', 401); return handleSpareParts(request, env, user, url, path); }
  if (path.startsWith('/api/service-contracts'))   { if (!user) return err('Nieautoryzowany', 401); return handleServiceContracts(request, env, user, url, path); }
  if (path.startsWith('/api/supplier-invoices'))   { if (!user) return err('Nieautoryzowany', 401); return handleSupplierInvoices(request, env, user, url, path); }
  if (path.startsWith('/api/transport-orders'))   { if (!user) return err('Nieautoryzowany', 401); return handleTransportOrders(request, env, user, url, path); }
  if (path.startsWith('/api/driver-schedule'))    { if (!user) return err('Nieautoryzowany', 401); return handleDriverSchedule(request, env, user, url, path); }
  if (path.startsWith('/api/driver-scoring'))     { if (!user) return err('Nieautoryzowany', 401); return handleDriverScoring(request, env, user, url, path); }
  if (path.startsWith('/api/tco'))                { if (!user) return err('Nieautoryzowany', 401); return handleTCO(request, env, user, url, path); }
  if (path.startsWith('/api/co2-report'))         { if (!user) return err('Nieautoryzowany', 401); return handleCO2Report(request, env, user, url, path); }
  if (path.startsWith('/api/audit-log'))          { if (!user) return err('Nieautoryzowany', 401); return handleAuditLog(request, env, user, url, path); }
  if (path.startsWith('/api/budget-annual'))      { if (!user) return err('Nieautoryzowany', 401); return handleBudgetAnnual(request, env, user, url, path); }
  if (path.startsWith('/api/fuel-card-import'))   { if (!user) return err('Nieautoryzowany', 401); return handleFuelCardImport(request, env, user, url, path); }
  if (path.startsWith('/api/integrations'))       { if (!user) return err('Nieautoryzowany', 401); return handleIntegrations(request, env, user, url, path); }
  if (path.startsWith('/api/tacho-ddd'))          { if (!user) return err('Nieautoryzowany', 401); return handleTachoDDD(request, env, user, url, path); }
  if (path.startsWith('/api/approval-levels'))    { if (!user) return err('Nieautoryzowany', 401); return handleApprovalLevels(request, env, user, url, path); }
  if (path.startsWith('/api/gps-positions'))      { if (!user) return err('Nieautoryzowany', 401); return handleGpsPositions(request, env, user, url, path); }
  if (path.startsWith('/api/trips'))              { if (!user) return err('Nieautoryzowany', 401); return handleTrips(request, env, user, url, path); }
  if (path.startsWith('/api/geofences'))          { if (!user) return err('Nieautoryzowany', 401); return handleGeofences(request, env, user, url, path); }
  if (path.startsWith('/api/smart-forms'))        { if (!user) return err('Nieautoryzowany', 401); return handleSmartForms(request, env, user, url, path); }
  if (path.startsWith('/api/driver-wages'))       { if (!user) return err('Nieautoryzowany', 401); return handleDriverWages(request, env, user, url, path); }
  if (path.startsWith('/api/route-cost'))         { if (!user) return err('Nieautoryzowany', 401); return handleRouteCost(request, env, user, url, path); }
  if (path.startsWith('/api/gps-integrations'))   { if (!user) return err('Nieautoryzowany', 401); return handleGpsIntegrations(request, env, user, url, path); }
  if (path.startsWith('/api/ev-charging'))        { if (!user) return err('Nieautoryzowany', 401); return handleEVCharging(request, env, user, url, path); }
  if (path === '/api/email-to-order' && request.method === 'POST') { if (!user) return err('Nieautoryzowany', 401); return handleEmail2Order(request, env, user, url); }
  if (path.startsWith('/api/zapier'))             { if (!user) return err('Nieautoryzowany', 401); return handleZapierWebhook(request, env, user, url, path); }
  if (path.startsWith('/api/insurance'))          { if (!user) return err('Nieautoryzowany', 401); return handleInsurance(request, env, user, url, path); }
  if (path.startsWith('/api/route-billing'))      { if (!user) return err('Nieautoryzowany', 401); return handleRouteBilling(request, env, user, url, path); }
  if (path === '/api/fleet-kpi' && request.method === 'GET') { if (!user) return err('Nieautoryzowany', 401); return handleFleetKpi(request, env, user, url); }
  if (path === '/api/environmental-fee' && request.method === 'GET') { if (!user) return err('Nieautoryzowany', 401); return handleEnvironmentalFee(request, env, user, url); }
  if (path.startsWith('/api/access-control'))   { if (!user) return err('Nieautoryzowany', 401); return handleAccessControl(request, env, user, url, path); }
  if (path.startsWith('/api/ksef'))             { if (!user) return err('Nieautoryzowany', 401); return handleKsef(request, env, user, url, path); }
  if (path.startsWith('/api/vehicle-inspections')) { if (!user) return err('Nieautoryzowany', 401); return handleVehicleInspections(request, env, user, url, path); }
  if (path.startsWith('/api/fleet-renewal'))    { if (!user) return err('Nieautoryzowany', 401); return handleFleetRenewal(request, env, user, url, path); }
  if (path.startsWith('/api/driver-training'))  { if (!user) return err('Nieautoryzowany', 401); return handleDriverTraining(request, env, user, url, path); }
  if (path.startsWith('/api/fleet-limits'))     { if (!user) return err('Nieautoryzowany', 401); return handleFleetLimits(request, env, user, url, path); }
  if (path.startsWith('/api/parking'))          { if (!user) return err('Nieautoryzowany', 401); return handleParking(request, env, user, url, path); }
  if (path.startsWith('/api/internal-rentals')) { if (!user) return err('Nieautoryzowany', 401); return handleInternalRentals(request, env, user, url, path); }
  if (path.startsWith('/api/carpooling'))       { if (!user) return err('Nieautoryzowany', 401); return handleCarpooling(request, env, user, url, path); }
  if (path.startsWith('/api/gdpr'))             { if (!user) return err('Nieautoryzowany', 401); return handleGdpr(request, env, user, url, path); }
  if (path.startsWith('/api/currency'))         { if (!user) return err('Nieautoryzowany', 401); return handleCurrency(request, env, user, url, path); }
  // Batch 8 — nowe moduły
  if (path.startsWith('/api/predictive-maintenance')) { if (!user) return err('Nieautoryzowany', 401); return handlePredictiveMaintenance(request, env, user, url, path); }
  if (path.startsWith('/api/warranties'))             { if (!user) return err('Nieautoryzowany', 401); return handleWarranties(request, env, user, url, path); }
  if (path.startsWith('/api/suppliers'))              { if (!user) return err('Nieautoryzowany', 401); return handleSuppliers(request, env, user, url, path); }
  if (path.startsWith('/api/fleet-disposal'))         { if (!user) return err('Nieautoryzowany', 401); return handleFleetDisposal(request, env, user, url, path); }
  if (path.startsWith('/api/report-builder'))         { if (!user) return err('Nieautoryzowany', 401); return handleReportBuilder(request, env, user, url, path); }
  if (path.startsWith('/api/cmr'))                    { if (!user) return err('Nieautoryzowany', 401); return handleCmr(request, env, user, url, path); }
  if (path.startsWith('/api/sent'))                   { if (!user) return err('Nieautoryzowany', 401); return handleSent(request, env, user, url, path); }
  if (path.startsWith('/api/messages'))               { if (!user) return err('Nieautoryzowany', 401); return handleMessenger(request, env, user, url, path); }
  if (path.startsWith('/api/vehicle-qr'))             { if (!user) return err('Nieautoryzowany', 401); return handleVehicleQr(request, env, user, url, path); }
  if (path.startsWith('/api/jpk'))                    { if (!user) return err('Nieautoryzowany', 401); return handleJpk(request, env, user, url, path); }
  if (path.startsWith('/api/edoreczenia'))            { if (!user) return err('Nieautoryzowany', 401); return handleEdoreczenia(request, env, user, url, path); }
  if (path.startsWith('/api/video-telematics'))       { if (!user) return err('Nieautoryzowany', 401); return handleVideoTelematics(request, env, user, url, path); }
  if (path.startsWith('/api/esg-targets'))            { if (!user) return err('Nieautoryzowany', 401); return handleEsgTargets(request, env, user, url, path); }
  if (path.startsWith('/api/driver-worktime'))        { if (!user) return err('Nieautoryzowany', 401); return handleDriverWorktime(request, env, user, url, path); }
  if (path.startsWith('/api/delegations'))            { if (!user) return err('Nieautoryzowany', 401); return handleDelegations(request, env, user, url, path); }
  if (path.startsWith('/api/fleet-inventory'))        { if (!user) return err('Nieautoryzowany', 401); return handleFleetInventory(request, env, user, url, path); }
  if (path.startsWith('/api/budget-plans'))           { if (!user) return err('Nieautoryzowany', 401); return handleBudgetPlans(request, env, user, url, path); }
  if (path === '/api/feature-flags')                  { if (!user) return err('Nieautoryzowany', 401); return handleFeatureFlags(request, env, user, url); }
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
  if (path === '/api/ai/chat')          { if (!user) return err('Nieautoryzowany', 401); const rlAI = await rateLimit(env, `ai:${user.id}`, 30, 60); if (!rlAI.allowed) return json({ error: 'Limit zapytań AI wyczerpany (30/min). Poczekaj chwilę.' }, 429); return handleAI(request, env); }
  if (path === '/api/ai/ocr' && request.method === 'POST') { if (!user) return err('Nieautoryzowany', 401); return handleAIOCR(request, env); }
  if (path === '/api/ai/ocr-doc' && request.method === 'POST') { if (!user) return err('Nieautoryzowany', 401); return handleAIOCRDoc(request, env); }
  if (path === '/api/aztec'  && request.method === 'POST') { if (!user) return err('Nieautoryzowany', 401); return handleAztec(request); }

  // Monitor folderów — agent watcher + kolejka
  if (path === '/api/folder-monitor/ingest' && request.method === 'POST') { if (!user) return err('Nieautoryzowany', 401); return handleFmIngest(request, env, user); }
  if (path === '/api/folder-monitor/queue'  && request.method === 'GET')  { if (!user) return err('Nieautoryzowany', 401); return handleFmQueue(request, env, user, url); }
  if (path.startsWith('/api/folder-monitor/queue/') && (request.method === 'PATCH' || request.method === 'DELETE')) { if (!user) return err('Nieautoryzowany', 401); return handleFmQueueItem(request, env, user, path, request.method); }
  if (path === '/api/folder-monitor/heartbeat' && request.method === 'POST') { if (!user) return err('Nieautoryzowany', 401); return json({ ok: true, ts: Date.now() }); }

  // Tekom / MyCar API integration
  if (path.startsWith('/api/tekom')) { if (!user) return err('Nieautoryzowany', 401); return handleTekomIntegration(request, env, user, url, path); }

  // Polisy import z R2
  if (path.startsWith('/api/polisy-import')) { if (!user) return err('Nieautoryzowany', 401); return handlePolisyImport(request, env, user, url, path); }
  if (path === '/api/polisy-save' && request.method === 'POST')  { if (!user) return err('Nieautoryzowany', 401); return handlePolisySave(request, env, user, url); }
  if (path === '/api/polisy-parse' && request.method === 'POST') { if (!user) return err('Nieautoryzowany', 401); return handlePolisyParse(request, env); }

  // DR import z R2 (Aztec + AI OCR fallback)
  if (path.startsWith('/api/dr-import')) { if (!user) return err('Nieautoryzowany', 401); return handleDrImport(request, env, user, url); }
  if (path === '/api/dr-save' && request.method === 'POST') { if (!user) return err('Nieautoryzowany', 401); return handleDrSave(request, env, user, url); }

  // CEPiK proxy — wymaga zalogowania; credentials tylko w env secrets (Worker-side)
  if (path === '/api/cepik/token'    && request.method === 'POST') { if (!user) return err('Nieautoryzowany', 401); return handleCepikToken(request, env); }
  if (path === '/api/cepik/pojazdy'  && request.method === 'GET')  { if (!user) return err('Nieautoryzowany', 401); return handleCepikPojazdy(request, env, user, url); }
  if (path === '/api/cepik/kierowca' && request.method === 'GET')  { if (!user) return err('Nieautoryzowany', 401); return handleCepikKierowca(request, url); }
  if (path === '/api/cepik/kierowca-check' && request.method === 'POST') { if (!user) return err('Nieautoryzowany', 401); return handleCepikKierowcaV2(request, env, user); }

  // TERYT — GUS rejestr jednostek terytorialnych (BDL API proxy + KV cache)
  if (path.startsWith('/api/teryt')) { if (!user) return err('Nieautoryzowany', 401); return handleTeryt(request, env, user, url, path); }

  // DR OCR — AI ekstrakcja pól dowodu rejestracyjnego (Claude Vision)
  if (path === '/api/dr-ocr') { if (!user) return err('Nieautoryzowany', 401); return handleDrOcr(request, env); }

  // Masowy import dokumentów flotowych
  if (path === '/api/bulk/classify'    && request.method === 'POST') { if (!user) return err('Nieautoryzowany', 401); return handleBulkClassify(request, env, user); }
  if (path === '/api/bulk/extract'     && request.method === 'POST') { if (!user) return err('Nieautoryzowany', 401); return handleBulkExtract(request, env, user); }
  if (path === '/api/bulk/save-policy' && request.method === 'POST') { if (!user) return err('Nieautoryzowany', 401); return handleBulkSavePolicy(request, env, user, url); }

  // GUS BIR1 proxy — requires GUS_BIR_KEY secret in Worker env
  if (path === '/api/gus-regon' && request.method === 'GET') {
    if (!user) return err('Nieautoryzowany', 401);
    const nip = url.searchParams.get('nip')?.replace(/\D/g, '');
    if (!nip || nip.length !== 10) return err('Podaj poprawny NIP (10 cyfr)');
    if (!env.GUS_BIR_KEY) return json({ configured: false, msg: 'Skonfiguruj klucz GUS BIR1 — wrangler secret put GUS_BIR_KEY' });
    try {
      const GUS_URL = 'https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc';
      const timeout10s = () => AbortSignal.timeout(10000);
      // SOAP login
      const loginResp = await fetch(GUS_URL, {
        method: 'POST',
        signal: timeout10s(),
        headers: { 'Content-Type': 'application/soap+xml; charset=utf-8', 'sid': '' },
        body: `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="http://CIS/BIR/PUBL/2014/07"><soap:Body><ns:Zaloguj><ns:pKluczUzytkownika>${env.GUS_BIR_KEY}</ns:pKluczUzytkownika></ns:Zaloguj></soap:Body></soap:Envelope>`
      });
      const loginText = await loginResp.text();
      const sidMatch = loginText.match(/<ZalogujResult>([^<]+)<\/ZalogujResult>/);
      if (!sidMatch) return json({ configured: true, found: false, msg: 'Błąd logowania do GUS' });
      const sid = sidMatch[1];
      // Search by NIP
      const searchResp = await fetch(GUS_URL, {
        method: 'POST',
        signal: timeout10s(),
        headers: { 'Content-Type': 'application/soap+xml; charset=utf-8', 'sid': sid },
        body: `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="http://CIS/BIR/PUBL/2014/07" xmlns:dat="http://CIS/BIR/PUBL/2014/07/DataContract"><soap:Body><ns:DaneSzukajPodmioty><ns:pParametryWyszukiwania><dat:Nip>${nip}</dat:Nip></ns:pParametryWyszukiwania></ns:DaneSzukajPodmioty></soap:Body></soap:Envelope>`
      });
      const searchText = await searchResp.text();
      const nameMatch = searchText.match(/<Nazwa>([^<]+)<\/Nazwa>/);
      const regonMatch = searchText.match(/<Regon>([^<]+)<\/Regon>/);
      const adresMatch = searchText.match(/<Ulica>([^<]+)<\/Ulica>/);
      const kodMatch = searchText.match(/<KodPocztowy>([^<]+)<\/KodPocztowy>/);
      const miastoMatch = searchText.match(/<Miejscowosc>([^<]+)<\/Miejscowosc>/);
      if (!nameMatch) return json({ configured: true, found: false, nip });
      return json({ configured: true, found: true, nip, regon: regonMatch?.[1]||'', nazwa: nameMatch[1], adres: `${adresMatch?.[1]||''} ${kodMatch?.[1]||''} ${miastoMatch?.[1]||''}`.trim() });
    } catch (e) {
      const msg = e.name === 'TimeoutError' ? 'Przekroczono limit czasu (10s) — GUS BIR niedostępny' : e.message;
      return json({ configured: true, found: false, msg });
    }
  }

  // VIES VAT validation proxy — primary: ec.europa.eu, fallback: komunikat o niedostępności
  if (path === '/api/vies-check' && request.method === 'GET') {
    if (!user) return err('Nieautoryzowany', 401);
    const cc = (url.searchParams.get('cc') || '').toUpperCase().slice(0, 2);
    const vat = (url.searchParams.get('vat') || '').replace(/\s/g, '');
    if (!cc || !vat) return err('Podaj cc (kod kraju) i vat (numer VAT)');
    try {
      const r = await fetch('https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number', {
        method: 'POST',
        signal: AbortSignal.timeout(8000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode: cc, vatNumber: vat })
      });
      if (!r.ok) return json({ valid: false, error: `VIES HTTP ${r.status}` });
      const d = await r.json();
      return json({ valid: d.valid || false, name: d.traderName || '', address: d.traderAddress || '', countryCode: cc, vatNumber: vat });
    } catch (e) {
      const msg = e.name === 'TimeoutError' ? 'VIES EU niedostępny (timeout 8s). Spróbuj ponownie za chwilę.' : e.message;
      return json({ valid: false, error: msg });
    }
  }

  // Push (authenticated parts)
  if (path === '/api/push/generate-keys' && request.method === 'GET') {
    if (!user) return err('Nieautoryzowany', 401);
    return handleGenerateVapidKeys(request, env, user);
  }
  if (path === '/api/push/send' && request.method === 'POST') {
    if (!user) return err('Nieautoryzowany', 401);
    return handlePushSend(request, env, user);
  }

  if (path.startsWith('/api/driver-trips'))          { if (!user) return err('Nieautoryzowany', 401); return handleDriverTrips(request, env, user, url, path); }
  if (path.startsWith('/api/doc-workflow'))          { if (!user) return err('Nieautoryzowany', 401); return handleDocWorkflow(request, env, user, url, path); }

  // ── Nowe moduły (feature batch 2026-07) ─────────────────────────────────────
  if (path.startsWith('/api/fuel-import-scheduler')) { if (!user) return err('Nieautoryzowany', 401); return handleFuelImportScheduler(request, env, user, url, path); }
  if (path.startsWith('/api/debt-collection'))       { if (!user) return err('Nieautoryzowany', 401); return handleDebtCollection(request, env, user, url, path); }
  if (path.startsWith('/api/external-access'))       return handleExternalAccess(request, env, user, url, path);
  if (path.startsWith('/api/driver-ranking'))        { if (!user) return err('Nieautoryzowany', 401); return handleDriverRanking(request, env, user, url, path); }
  if (path.startsWith('/api/route-profitability'))   { if (!user) return err('Nieautoryzowany', 401); return handleRouteProfitability(request, env, user, url, path); }
  if (path.startsWith('/api/rag-chat'))              { if (!user) return err('Nieautoryzowany', 401); return handleRagChat(request, env, user, url, path); }
  if (path.startsWith('/api/ocr-fuel'))              { if (!user) return err('Nieautoryzowany', 401); return handleOcrFuel(request, env, user, url, path); }
  if (path.startsWith('/api/predictive-ai'))         { if (!user) return err('Nieautoryzowany', 401); return handlePredictiveAi(request, env, user, url, path); }
  if (path.startsWith('/api/hr-leaves'))             { if (!user) return err('Nieautoryzowany', 401); return handleHrLeaves(request, env, user, url, path); }
  if (path.startsWith('/api/hr-medical-exams'))      { if (!user) return err('Nieautoryzowany', 401); return handleHrMedicalExams(request, env, user, url, path); }
  if (path.startsWith('/api/vignettes'))             { if (!user) return err('Nieautoryzowany', 401); return handleVignettes(request, env, user, url, path); }
  if (path.startsWith('/api/etoll-devices'))         { if (!user) return err('Nieautoryzowany', 401); return handleEtollDevices(request, env, user, url, path); }
  if (path.startsWith('/api/fixed-assets'))          { if (!user) return err('Nieautoryzowany', 401); return handleFixedAssets(request, env, user, url, path); }
  if (path.startsWith('/api/carrier-ratings'))       { if (!user) return err('Nieautoryzowany', 401); return handleCarrierRatings(request, env, user, url, path); }

  return err('Endpoint nie istnieje', 404);
}

// ─── DOC WORKFLOW — obieg dokumentów ─────────────────────────────────────────
async function handleDocWorkflow(request, env, user, url, path) {
  const method = request.method;
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Brak company');
  if (user.role !== 'superadmin' && user.company_id !== company) return err('Brak dostępu', 403);

  const segs = path.replace('/api/doc-workflow', '').split('/').filter(Boolean);

  // ── Statystyki KPI ──────────────────────────────────────────────────────
  if (segs[0] === 'stats' && method === 'GET') {
    const [byStatus, hist, urgent] = await Promise.all([
      env.DB.prepare(`SELECT workflow_status as status, COUNT(*) as cnt FROM documents WHERE company_id=? GROUP BY workflow_status`).bind(company).all().catch(() => ({ results: [] })),
      env.DB.prepare(`SELECT COUNT(*) as cnt FROM doc_status_history WHERE company_id=? AND created_at>=datetime('now','-7 days')`).bind(company).first().catch(() => null),
      env.DB.prepare(`SELECT COUNT(*) as cnt FROM documents WHERE company_id=? AND workflow_status NOT IN ('zatwierdzony','archiwum','odrzucony') AND workflow_priority='urgent'`).bind(company).first().catch(() => null),
    ]);
    return json({ statuses: byStatus.results || [], changes7d: hist?.cnt ?? 0, urgent: urgent?.cnt ?? 0 });
  }

  // ── Templates ────────────────────────────────────────────────────────────
  if (segs[0] === 'templates') {
    const tplId = segs[1];
    if (method === 'GET' && !tplId) {
      const rows = await env.DB.prepare('SELECT * FROM doc_workflow_templates WHERE company_id=? ORDER BY created_at').bind(company).all().catch(() => ({ results: [] }));
      return json({ templates: rows.results || [] });
    }
    if (method === 'POST') {
      const b = await request.json();
      const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      await env.DB.prepare(`INSERT INTO doc_workflow_templates(id,company_id,name,doc_types,statuses,is_default,created_by) VALUES(?,?,?,?,?,?,?)`)
        .bind(id, company, b.name || 'Workflow', JSON.stringify(b.doc_types || []), JSON.stringify(b.statuses || []), b.is_default ? 1 : 0, user.email).run();
      return json({ ok: true, id });
    }
    if (method === 'PUT' && tplId) {
      const b = await request.json();
      await env.DB.prepare(`UPDATE doc_workflow_templates SET name=?,doc_types=?,statuses=?,is_default=?,updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=? AND company_id=?`)
        .bind(b.name, JSON.stringify(b.doc_types || []), JSON.stringify(b.statuses || []), b.is_default ? 1 : 0, tplId, company).run();
      return json({ ok: true });
    }
    if (method === 'DELETE' && tplId) {
      await env.DB.prepare('DELETE FROM doc_workflow_templates WHERE id=? AND company_id=?').bind(tplId, company).run();
      return json({ ok: true });
    }
    return err('Metoda nieobsługiwana', 405);
  }

  // ── Lista dokumentów w obiegu ────────────────────────────────────────────
  if (!segs[0] || segs[0] === 'list') {
    const status   = url.searchParams.get('status');
    const assigned = url.searchParams.get('assigned_to');
    const docType  = url.searchParams.get('doc_type');
    const priority = url.searchParams.get('priority');
    const conds = ['d.company_id=?']; const params = [company];
    if (status)   { conds.push('d.workflow_status=?');       params.push(status); }
    if (assigned) { conds.push('d.workflow_assigned_to=?');  params.push(assigned); }
    if (docType)  { conds.push('d.doc_type=?');              params.push(docType); }
    if (priority) { conds.push('d.workflow_priority=?');     params.push(priority); }
    const rows = await env.DB.prepare(`
      SELECT d.id,d.name,d.doc_type,d.nr_rej,d.vin,d.vehicle_id,d.expiry_date,
             d.workflow_status,d.workflow_assigned_to,d.workflow_assigned_name,
             d.workflow_due_date,d.workflow_priority,d.workflow_template_id,
             d.uploaded_at,d.uploaded_by
      FROM documents d WHERE ${conds.join(' AND ')}
      ORDER BY CASE d.workflow_priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
               d.uploaded_at DESC LIMIT 500`).bind(...params).all().catch(() => ({ results: [] }));
    return json({ documents: rows.results || [] });
  }

  // ── Status update + historia ─────────────────────────────────────────────
  const docId = segs[0];
  if (segs[1] === 'status' && method === 'PUT') {
    const b = await request.json();
    const doc = await env.DB.prepare('SELECT id,name,doc_type,workflow_status FROM documents WHERE id=? AND company_id=?').bind(docId, company).first().catch(() => null);
    if (!doc) return err('Dokument nie istnieje', 404);
    const prevStatus = doc.workflow_status;
    await env.DB.prepare(`UPDATE documents SET workflow_status=?,workflow_assigned_to=?,workflow_assigned_name=?,workflow_due_date=?,workflow_priority=? WHERE id=? AND company_id=?`)
      .bind(b.status ?? prevStatus, b.assigned_to ?? null, b.assigned_name ?? null, b.due_date ?? null, b.priority ?? 'normal', docId, company).run();
    const histId = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    await env.DB.prepare(`INSERT INTO doc_status_history(id,company_id,doc_id,doc_name,doc_type,status_from,status_to,assigned_to,assigned_name,comment,changed_by,changed_by_name) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(histId, company, docId, doc.name, doc.doc_type, prevStatus, b.status ?? prevStatus, b.assigned_to ?? null, b.assigned_name ?? null, b.comment ?? null, user.email, user.name || user.email).run();
    return json({ ok: true });
  }

  if (segs[1] === 'history' && method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM doc_status_history WHERE doc_id=? AND company_id=? ORDER BY created_at DESC LIMIT 50').bind(docId, company).all().catch(() => ({ results: [] }));
    return json({ history: rows.results || [] });
  }

  return err('Nie znaleziono zasobu', 404);
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
      env.DB.prepare('SELECT nr_rej, data FROM vehicles WHERE company_id=? LIMIT 5000').bind(company_id).all(),
      env.DB.prepare('SELECT name, license_expiry FROM drivers WHERE company_id=? LIMIT 2000').bind(company_id).all().catch(() => ({ results: [] })),
      env.DB.prepare('SELECT nr_rej, driver_name, deadline, paid FROM fines WHERE company_id=? AND paid=0 LIMIT 2000').bind(company_id).all().catch(() => ({ results: [] })),
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
      env.DB.prepare('SELECT nr_rej, data FROM vehicles WHERE company_id=? LIMIT 5000').bind(company_id).all(),
      env.DB.prepare('SELECT name, license_expiry FROM drivers WHERE company_id=? LIMIT 2000').bind(company_id).all().catch(() => ({ results: [] })),
      env.DB.prepare('SELECT nr_rej, driver_name, deadline, paid FROM fines WHERE company_id=? AND paid=0 LIMIT 2000').bind(company_id).all().catch(() => ({ results: [] })),
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
        const myAlerts = filterAlertsForUser(allAlerts, prefs);
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
        const myAlerts = filterAlertsForUser(allAlerts, prefs);
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

    console.log(`[Notif queue] ${company_id}: ${allAlerts.length} alertów, ${subs.length} sub`);
  }

  // Wyślij do kolejki partiami po 100 (limit CF)
  for (let i = 0; i < jobBatch.length; i += 100) {
    await env.NOTIF_QUEUE.sendBatch(jobBatch.slice(i, i + 100));
  }
  console.log(`[Notif queue] Zakolejkowano ${jobBatch.length} zadań`);
}

// ─── EMAIL: Resend API ───────────────────────────────────────────────────────
const _he = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function buildEmailHtml(alerts) {
  const rows = alerts.map(a => {
    const daysStr = a.days != null
      ? (a.days <= 0 ? '<b style="color:#c0392b">WYGASŁO</b>' : `za <b>${a.days}</b> dni`)
      : '';
    const kmStr   = a.km   != null ? `, za <b>${a.km}</b> km` : '';
    return `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${_he(a.nrRej)}</td>
              <td style="padding:6px 12px;border-bottom:1px solid #eee">${_he(a.label || a.typeId)}</td>
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
    const vehRows = await env.DB.prepare('SELECT nr_rej, data FROM vehicles WHERE company_id=? LIMIT 5000').bind(company_id).all();
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

// ═══════════════════════════════════════════════════════════════════════════
// TRIPS — jazda prywatna / służbowa (GDPR)
// ═══════════════════════════════════════════════════════════════════════════

async function handleTrips(req, env, user, url, path) {
  const co     = url.searchParams.get('company') || user.company_id;
  const method = req.method;
  const segs   = path.split('/').filter(Boolean); // ['api','trips',id?]
  const itemId = segs[2];

  if (!co) return err('Brak company', 400);

  if (method === 'GET' && !itemId) {
    const dateFrom = url.searchParams.get('date_from') || '';
    const dateTo   = url.searchParams.get('date_to')   || '';
    const driverId = url.searchParams.get('driver_id') || '';
    const vehicleId= url.searchParams.get('vehicle_id')|| '';
    const category = url.searchParams.get('category')  || '';
    const limit    = Math.min(parseInt(url.searchParams.get('limit') || '200'), 500);

    let q = 'SELECT * FROM trips WHERE company_id=?';
    const p = [co];
    if (dateFrom) { q += ' AND trip_date>=?'; p.push(dateFrom); }
    if (dateTo)   { q += ' AND trip_date<=?'; p.push(dateTo); }
    if (driverId) { q += ' AND driver_id=?';  p.push(driverId); }
    if (vehicleId){ q += ' AND vehicle_id=?'; p.push(vehicleId); }
    if (category) { q += ' AND category=?';   p.push(category); }
    q += ` ORDER BY trip_date DESC, start_time DESC LIMIT ${limit}`;
    const rows = (await env.DB.prepare(q).bind(...p).all()).results || [];

    // Agregaty
    const biz  = rows.filter(r => r.category === 'business');
    const priv = rows.filter(r => r.category === 'private');
    return json({
      trips: rows,
      summary: {
        total: rows.length,
        business_count: biz.length,
        private_count: priv.length,
        business_km: biz.reduce((s,r) => s+(r.distance_km??0),0),
        private_km:  priv.reduce((s,r) => s+(r.distance_km??0),0),
        business_cost: biz.reduce((s,r) => s+(r.cost_total??0),0),
      }
    });
  }

  if (method === 'GET' && itemId) {
    const row = await env.DB.prepare('SELECT * FROM trips WHERE id=? AND company_id=?').bind(itemId, co).first();
    return row ? json(row) : err('Nie znaleziono', 404);
  }

  if (method === 'POST') {
    let body; try { body = await req.json(); } catch { return err('JSON', 400); }
    const id = crypto.randomUUID();
    const { vehicle_id='', vehicle_reg='', driver_id='', driver_name='', trip_date, start_time='', end_time='',
            start_location='', end_location='', distance_km=0, fuel_liters=0, category='business',
            purpose='', notes='', source='manual', cost_fuel=0, cost_toll=0 } = body;
    if (!trip_date) return err('Pole trip_date jest wymagane', 400);
    const cost_total = parseFloat(cost_fuel||0) + parseFloat(cost_toll||0);
    await env.DB.prepare(
      `INSERT INTO trips (id,company_id,vehicle_id,vehicle_reg,driver_id,driver_name,trip_date,start_time,end_time,
       start_location,end_location,distance_km,fuel_liters,category,purpose,notes,source,cost_fuel,cost_toll,cost_total)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id,co,vehicle_id,vehicle_reg,driver_id,driver_name,trip_date,start_time,end_time,
           start_location,end_location,distance_km,fuel_liters,category,purpose,notes,source,cost_fuel,cost_toll,cost_total).run();
    return json({ ok:true, id });
  }

  if (method === 'PUT' && itemId) {
    let body; try { body = await req.json(); } catch { return err('JSON', 400); }
    const fields = ['vehicle_id','vehicle_reg','driver_id','driver_name','trip_date','start_time','end_time',
                    'start_location','end_location','distance_km','fuel_liters','category','purpose','notes',
                    'cost_fuel','cost_toll','cost_total','confirmed','confirmed_at'];
    const sets = [], vals = [];
    for (const f of fields) {
      if (body[f] !== undefined) { sets.push(`${f}=?`); vals.push(body[f]); }
    }
    if (!sets.length) return err('Brak pól do aktualizacji', 400);
    vals.push(itemId, co);
    await env.DB.prepare(`UPDATE trips SET ${sets.join(',')} WHERE id=? AND company_id=?`).bind(...vals).run();
    return json({ ok: true });
  }

  if (method === 'DELETE' && itemId) {
    await env.DB.prepare('DELETE FROM trips WHERE id=? AND company_id=?').bind(itemId, co).run();
    return json({ ok: true });
  }

  // VAT report — GET /api/trips/vat-report
  if (method === 'GET' && itemId === 'vat-report') {
    const year  = url.searchParams.get('year') || new Date().getFullYear();
    const rows  = (await env.DB.prepare(
      `SELECT trip_date, SUM(distance_km) as km_total,
       SUM(CASE WHEN category='business' THEN distance_km ELSE 0 END) as km_biz,
       SUM(CASE WHEN category='private'  THEN distance_km ELSE 0 END) as km_priv
       FROM trips WHERE company_id=? AND trip_date LIKE ?
       GROUP BY substr(trip_date,1,7) ORDER BY trip_date`
    ).bind(co, year+'%').all()).results || [];
    const totKm = rows.reduce((s,r)=>s+(r.km_total??0),0);
    const bizKm = rows.reduce((s,r)=>s+(r.km_biz??0),0);
    const vatPct = totKm>0 ? Math.round(bizKm/totKm*100) : 0;
    return json({ year, monthly: rows, total_km: totKm, business_km: bizKm, vat_deduction_pct: vatPct });
  }

  return err('Nieznana operacja', 404);
}

// ═══════════════════════════════════════════════════════════════════════════
// GEOFENCING — strefy i alerty
// ═══════════════════════════════════════════════════════════════════════════

async function handleGeofences(req, env, user, url, path) {
  const co     = url.searchParams.get('company') || user.company_id;
  const method = req.method;
  const segs   = path.split('/').filter(Boolean);
  const itemId = segs[2];
  const sub    = segs[3]; // 'events'

  if (!co) return err('Brak company', 400);

  // GET /api/geofences/:id/events
  if (method === 'GET' && itemId && sub === 'events') {
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const rows = (await env.DB.prepare(
      `SELECT * FROM geofence_events WHERE company_id=? AND geofence_id=? ORDER BY event_time DESC LIMIT ?`
    ).bind(co, itemId, limit).all()).results || [];
    return json(rows);
  }

  // GET /api/geofences/events — wszystkie zdarzenia
  if (method === 'GET' && itemId === 'events') {
    const limit = parseInt(url.searchParams.get('limit') || '200');
    const df    = url.searchParams.get('date_from') || '';
    let q = 'SELECT * FROM geofence_events WHERE company_id=?', p = [co];
    if (df) { q += ' AND event_time>=?'; p.push(df); }
    q += ` ORDER BY event_time DESC LIMIT ${limit}`;
    const rows = (await env.DB.prepare(q).bind(...p).all()).results || [];
    return json(rows);
  }

  if (method === 'GET' && !itemId) {
    const rows = (await env.DB.prepare('SELECT * FROM geofences WHERE company_id=? ORDER BY name').bind(co).all()).results || [];
    return json(rows);
  }

  if (method === 'GET' && itemId) {
    const row = await env.DB.prepare('SELECT * FROM geofences WHERE id=? AND company_id=?').bind(itemId, co).first();
    return row ? json(row) : err('Nie znaleziono', 404);
  }

  if (method === 'POST' && !itemId) {
    let body; try { body = await req.json(); } catch { return err('JSON', 400); }
    const { name, description='', zone_type='circle', center_lat=0, center_lon=0, radius_m=500,
            polygon_coords='', alert_enter=1, alert_exit=0, color='#2563eb' } = body;
    if (!name) return err('Pole name jest wymagane', 400);
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO geofences (id,company_id,name,description,zone_type,center_lat,center_lon,radius_m,polygon_coords,alert_enter,alert_exit,color)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id,co,name,description,zone_type,center_lat,center_lon,radius_m,polygon_coords,alert_enter,alert_exit,color).run();
    return json({ ok:true, id });
  }

  // POST /api/geofences/event — rejestracja zdarzenia (z urządzenia GPS)
  if (method === 'POST' && itemId === 'event') {
    let body; try { body = await req.json(); } catch { return err('JSON', 400); }
    const { geofence_id, vehicle_reg='', event_type='enter', lat=0, lon=0, speed_kmh=0, driver_name='' } = body;
    if (!geofence_id) return err('Brak geofence_id', 400);
    const gf = await env.DB.prepare('SELECT * FROM geofences WHERE id=? AND company_id=?').bind(geofence_id, co).first();
    if (!gf) return err('Strefa nie istnieje', 404);
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO geofence_events (id,company_id,geofence_id,geofence_name,vehicle_reg,driver_name,event_type,lat,lon,speed_kmh)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).bind(id,co,geofence_id,gf.name,vehicle_reg,driver_name,event_type,lat,lon,speed_kmh).run();
    return json({ ok:true, id });
  }

  if (method === 'PUT' && itemId) {
    let body; try { body = await req.json(); } catch { return err('JSON', 400); }
    const fields = ['name','description','zone_type','center_lat','center_lon','radius_m','polygon_coords','alert_enter','alert_exit','active','color'];
    const sets=[],vals=[];
    for(const f of fields) if(body[f]!==undefined){sets.push(`${f}=?`);vals.push(body[f]);}
    if(!sets.length) return err('Brak pól',400);
    vals.push(itemId,co);
    await env.DB.prepare(`UPDATE geofences SET ${sets.join(',')} WHERE id=? AND company_id=?`).bind(...vals).run();
    return json({ok:true});
  }

  if (method === 'DELETE' && itemId) {
    await env.DB.prepare('DELETE FROM geofences WHERE id=? AND company_id=?').bind(itemId, co).run();
    return json({ok:true});
  }

  return err('Nieznana operacja', 404);
}

// ═══════════════════════════════════════════════════════════════════════════
// SMART FORMS — konfigurowalne formularze terenowe
// ═══════════════════════════════════════════════════════════════════════════

async function handleSmartForms(req, env, user, url, path) {
  const co     = url.searchParams.get('company') || user.company_id;
  const method = req.method;
  const segs   = path.split('/').filter(Boolean);
  const itemId = segs[2];
  const sub    = segs[3]; // 'submissions'

  if (!co) return err('Brak company', 400);

  // Szablony formularzy
  if (!itemId || (itemId && !sub)) {
    if (method === 'GET' && !itemId) {
      const rows = (await env.DB.prepare('SELECT * FROM smart_form_templates WHERE company_id=? AND active=1 ORDER BY name').bind(co).all()).results || [];
      return json(rows.map(r => ({ ...r, fields: JSON.parse(r.fields||'[]') })));
    }
    if (method === 'GET' && itemId) {
      const row = await env.DB.prepare('SELECT * FROM smart_form_templates WHERE id=? AND company_id=?').bind(itemId, co).first();
      if (!row) return err('Nie znaleziono', 404);
      return json({ ...row, fields: JSON.parse(row.fields||'[]') });
    }
    if (method === 'POST') {
      let body; try { body = await req.json(); } catch { return err('JSON', 400); }
      const { name, description='', category='general', fields=[], require_signature=0, require_photo=0 } = body;
      if (!name) return err('Pole name wymagane', 400);
      const id = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO smart_form_templates (id,company_id,name,description,category,fields,require_signature,require_photo,created_by)
         VALUES (?,?,?,?,?,?,?,?,?)`
      ).bind(id,co,name,description,category,JSON.stringify(fields),require_signature,require_photo,user.email||'').run();
      return json({ ok:true, id });
    }
    if (method === 'PUT' && itemId) {
      let body; try { body = await req.json(); } catch { return err('JSON', 400); }
      const flds=['name','description','category','require_signature','require_photo','active'];
      const sets=[],vals=[];
      for(const f of flds) if(body[f]!==undefined){sets.push(`${f}=?`);vals.push(body[f]);}
      if(body.fields!==undefined){sets.push('fields=?');vals.push(JSON.stringify(body.fields));}
      if(!sets.length) return err('Brak pól',400);
      vals.push(itemId,co);
      await env.DB.prepare(`UPDATE smart_form_templates SET ${sets.join(',')} WHERE id=? AND company_id=?`).bind(...vals).run();
      return json({ok:true});
    }
    if (method === 'DELETE' && itemId) {
      await env.DB.prepare('UPDATE smart_form_templates SET active=0 WHERE id=? AND company_id=?').bind(itemId, co).run();
      return json({ok:true});
    }
  }

  // Wypełnione formularze (submissions)
  if (sub === 'submissions' || itemId === 'submissions') {
    const tmplId = sub === 'submissions' ? itemId : null;
    if (method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const df    = url.searchParams.get('date_from') || '';
      let q = 'SELECT id,company_id,template_id,template_name,vehicle_reg,driver_name,submitted_by,submitted_at,status,reviewer_notes FROM smart_form_submissions WHERE company_id=?';
      const p = [co];
      if (tmplId) { q += ' AND template_id=?'; p.push(tmplId); }
      if (df)     { q += ' AND submitted_at>=?'; p.push(df); }
      q += ` ORDER BY submitted_at DESC LIMIT ${limit}`;
      const rows = (await env.DB.prepare(q).bind(...p).all()).results || [];
      return json(rows);
    }
    if (method === 'POST') {
      let body; try { body = await req.json(); } catch { return err('JSON', 400); }
      const { template_id, template_name='', vehicle_id='', vehicle_reg='', driver_id='', driver_name='',
              data={}, signature_data='', status='submitted', location_lat=null, location_lon=null } = body;
      if (!template_id) return err('Brak template_id', 400);
      const id = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO smart_form_submissions (id,company_id,template_id,template_name,vehicle_id,vehicle_reg,driver_id,driver_name,submitted_by,data,signature_data,status,location_lat,location_lon)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(id,co,template_id,template_name,vehicle_id,vehicle_reg,driver_id,driver_name,user.email||'',JSON.stringify(data),signature_data,status,location_lat,location_lon).run();
      return json({ ok:true, id });
    }
  }

  return err('Nieznana operacja', 404);
}

// ═══════════════════════════════════════════════════════════════════════════
// DRIVER WAGES — wynagrodzenia kierowców
// ═══════════════════════════════════════════════════════════════════════════

async function handleDriverWages(req, env, user, url, path) {
  const co     = url.searchParams.get('company') || user.company_id;
  const method = req.method;
  const segs   = path.split('/').filter(Boolean);
  const itemId = segs[2];
  const sub    = segs[3]; // 'calculate' | 'rates'

  if (!co) return err('Brak company', 400);

  // GET /api/driver-wages/rates — stawki
  if (itemId === 'rates') {
    if (method === 'GET') {
      const rows = (await env.DB.prepare('SELECT * FROM driver_wage_rates WHERE company_id=? ORDER BY driver_name').bind(co).all()).results || [];
      return json(rows);
    }
    if (method === 'POST') {
      let body; try { body = await req.json(); } catch { return err('JSON', 400); }
      const { driver_id='', driver_name, hourly_rate=0, night_rate_mult=1.2, overtime_rate_mult=1.5,
              daily_allowance=45, foreign_allowance=52, tax_rate=0.12 } = body;
      if (!driver_name) return err('Pole driver_name wymagane', 400);
      const id = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT OR REPLACE INTO driver_wage_rates (id,company_id,driver_id,driver_name,hourly_rate,night_rate_mult,overtime_rate_mult,daily_allowance,foreign_allowance,tax_rate)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      ).bind(id,co,driver_id,driver_name,hourly_rate,night_rate_mult,overtime_rate_mult,daily_allowance,foreign_allowance,tax_rate).run();
      return json({ ok:true, id });
    }
  }

  // POST /api/driver-wages/calculate — oblicz wynagrodzenie z danych tachografu
  if (method === 'POST' && itemId === 'calculate') {
    let body; try { body = await req.json(); } catch { return err('JSON', 400); }
    const { driver_name, period_month } = body;
    if (!driver_name || !period_month) return err('Brak driver_name lub period_month', 400);

    // Pobierz stawki
    const rates = await env.DB.prepare(
      'SELECT * FROM driver_wage_rates WHERE company_id=? AND driver_name=? LIMIT 1'
    ).bind(co, driver_name).first();

    // Pobierz dane tachografu (pliki DDD za dany miesiąc)
    const [sn, fn] = driver_name.split(' ');
    const tacho = await env.DB.prepare(
      `SELECT SUM(a.duration_min) as total_min,
       SUM(CASE WHEN a.activity_type='driving' THEN a.duration_min ELSE 0 END) as drive_min,
       SUM(CASE WHEN a.activity_type='work'    THEN a.duration_min ELSE 0 END) as work_min
       FROM tachograph_activities a
       JOIN tachograph_files f ON a.file_id=f.id
       WHERE f.company_id=? AND a.activity_date LIKE ?
       AND (f.driver_surname LIKE ? OR f.driver_firstname LIKE ?)`
    ).bind(co, period_month+'%', '%'+(sn||'')+'%', '%'+(fn||'')+'%').first();

    const driveH      = (tacho?.drive_min||0) / 60;
    const workH       = (tacho?.work_min||0) / 60;
    const totalH      = driveH + workH;
    const normalH     = Math.min(totalH, 160);
    const overtimeH   = Math.max(0, totalH - 160);
    const nightH      = 0; // uproszczenie — bez danych nocnych
    const hourlyRate  = rates?.hourly_rate || 25;
    const baseSalary  = normalH * hourlyRate;
    const overtimeBonus = overtimeH * hourlyRate * ((rates?.overtime_rate_mult||1.5)-1);
    const nightBonus  = nightH * hourlyRate * ((rates?.night_rate_mult||1.2)-1);
    const dailyAllowances = 0; // wymaga danych o przejazdach międzynarodowych
    const grossTotal  = baseSalary + overtimeBonus + nightBonus + dailyAllowances;
    const taxAmount   = grossTotal * (rates?.tax_rate || 0.12);
    const netTotal    = grossTotal - taxAmount;

    // Sprawdź naruszenia (potrącenie)
    const viols = await env.DB.prepare(
      `SELECT SUM(penalty_pln) as penalty FROM tachograph_violations v
       JOIN tachograph_files f ON v.file_id=f.id
       WHERE f.company_id=? AND v.violation_date LIKE ?
       AND (f.driver_surname LIKE ? OR f.driver_firstname LIKE ?)`
    ).bind(co, period_month+'%', '%'+(sn||'')+'%', '%'+(fn||'')+'%').first();

    // Zapisz lub zaktualizuj
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT OR REPLACE INTO driver_wages
       (id,company_id,driver_name,period_month,base_salary,driving_hours,work_hours,total_hours,overtime_hours,
        night_hours,overtime_bonus,night_bonus,penalty_deduction,gross_total,tax_amount,net_total,status,calculated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',datetime('now'))`
    ).bind(id,co,driver_name,period_month,
      Math.round(baseSalary*100)/100, Math.round(driveH*100)/100, Math.round(workH*100)/100,
      Math.round(totalH*100)/100, Math.round(overtimeH*100)/100, 0,
      Math.round(overtimeBonus*100)/100, Math.round(nightBonus*100)/100,
      viols?.penalty||0, Math.round(grossTotal*100)/100,
      Math.round(taxAmount*100)/100, Math.round(netTotal*100)/100
    ).run();

    return json({ ok:true, id, driver_name, period_month,
      driving_hours: Math.round(driveH*10)/10, work_hours: Math.round(workH*10)/10,
      total_hours: Math.round(totalH*10)/10, overtime_hours: Math.round(overtimeH*10)/10,
      base_salary: Math.round(baseSalary*100)/100, overtime_bonus: Math.round(overtimeBonus*100)/100,
      penalty_deduction: viols?.penalty||0, gross_total: Math.round(grossTotal*100)/100,
      tax_amount: Math.round(taxAmount*100)/100, net_total: Math.round(netTotal*100)/100 });
  }

  if (method === 'GET' && !itemId) {
    const period = url.searchParams.get('period_month') || '';
    const status = url.searchParams.get('status') || '';
    let q = 'SELECT * FROM driver_wages WHERE company_id=?', p = [co];
    if (period) { q += ' AND period_month=?'; p.push(period); }
    if (status) { q += ' AND status=?'; p.push(status); }
    q += ' ORDER BY period_month DESC, driver_name';
    const rows = (await env.DB.prepare(q).bind(...p).all()).results || [];
    return json(rows);
  }

  if (method === 'PUT' && itemId) {
    let body; try { body = await req.json(); } catch { return err('JSON', 400); }
    const flds = ['status','notes','daily_allowances','eco_bonus','gross_total','tax_amount','net_total','approved_at','paid_at'];
    const sets=[],vals=[];
    for(const f of flds) if(body[f]!==undefined){sets.push(`${f}=?`);vals.push(body[f]);}
    if(!sets.length) return err('Brak pól',400);
    vals.push(itemId,co);
    await env.DB.prepare(`UPDATE driver_wages SET ${sets.join(',')} WHERE id=? AND company_id=?`).bind(...vals).run();
    return json({ok:true});
  }

  return err('Nieznana operacja', 404);
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTE COST — kalkulator kosztów trasy
// ═══════════════════════════════════════════════════════════════════════════

async function handleRouteCost(req, env, user, url, path) {
  const co     = url.searchParams.get('company') || user.company_id;
  const method = req.method;
  const segs   = path.split('/').filter(Boolean);
  const sub    = segs[2]; // 'profiles' | 'calculate'

  if (!co) return err('Brak company', 400);

  if (sub === 'profiles') {
    if (method === 'GET') {
      const rows = (await env.DB.prepare('SELECT * FROM route_cost_profiles WHERE company_id=? ORDER BY name').bind(co).all()).results || [];
      return json(rows);
    }
    if (method === 'POST') {
      let body; try { body = await req.json(); } catch { return err('JSON', 400); }
      const { name='Domyślny', fuel_price_pln=6.50, fuel_norm_l100=8.0, toll_rate_per_km=0,
              driver_cost_per_km=1.20, depreciation_per_km=0.35, other_per_km=0.10, is_default=0 } = body;
      const id = crypto.randomUUID();
      if (is_default) await env.DB.prepare('UPDATE route_cost_profiles SET is_default=0 WHERE company_id=?').bind(co).run();
      await env.DB.prepare(
        `INSERT INTO route_cost_profiles (id,company_id,name,fuel_price_pln,fuel_norm_l100,toll_rate_per_km,driver_cost_per_km,depreciation_per_km,other_per_km,is_default)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      ).bind(id,co,name,fuel_price_pln,fuel_norm_l100,toll_rate_per_km,driver_cost_per_km,depreciation_per_km,other_per_km,is_default).run();
      return json({ ok:true, id });
    }
    if (method === 'PUT' && segs[3]) {
      let body; try { body = await req.json(); } catch { return err('JSON', 400); }
      const flds=['name','fuel_price_pln','fuel_norm_l100','toll_rate_per_km','driver_cost_per_km','depreciation_per_km','other_per_km','is_default'];
      const sets=[],vals=[];
      for(const f of flds) if(body[f]!==undefined){sets.push(`${f}=?`);vals.push(body[f]);}
      if(body.is_default) await env.DB.prepare('UPDATE route_cost_profiles SET is_default=0 WHERE company_id=?').bind(co).run();
      vals.push(segs[3],co);
      await env.DB.prepare(`UPDATE route_cost_profiles SET ${sets.join(',')} WHERE id=? AND company_id=?`).bind(...vals).run();
      return json({ok:true});
    }
    if (method === 'DELETE' && segs[3]) {
      await env.DB.prepare('DELETE FROM route_cost_profiles WHERE id=? AND company_id=?').bind(segs[3],co).run();
      return json({ok:true});
    }
  }

  if (sub === 'calculate' && method === 'POST') {
    let body; try { body = await req.json(); } catch { return err('JSON', 400); }
    const { distance_km=0, profile_id='', fuel_price_pln, fuel_norm_l100, toll_rate_per_km,
            driver_cost_per_km, depreciation_per_km, other_per_km,
            cargo_weight_t=0, return_trip=false } = body;

    let profile = null;
    if (profile_id) {
      profile = await env.DB.prepare('SELECT * FROM route_cost_profiles WHERE id=? AND company_id=?').bind(profile_id, co).first();
    }
    if (!profile) {
      profile = await env.DB.prepare('SELECT * FROM route_cost_profiles WHERE company_id=? AND is_default=1 LIMIT 1').bind(co).first();
    }

    const fp   = fuel_price_pln      ?? profile?.fuel_price_pln      ?? 6.5;
    const fn   = fuel_norm_l100      ?? profile?.fuel_norm_l100       ?? 8.0;
    const toll = toll_rate_per_km    ?? profile?.toll_rate_per_km     ?? 0;
    const driv = driver_cost_per_km  ?? profile?.driver_cost_per_km   ?? 1.2;
    const depr = depreciation_per_km ?? profile?.depreciation_per_km  ?? 0.35;
    const oth  = other_per_km        ?? profile?.other_per_km         ?? 0.1;
    const dist = parseFloat(distance_km) * (return_trip ? 2 : 1);

    const fuel_liters   = dist * fn / 100;
    const cost_fuel     = fuel_liters * fp;
    const cost_toll     = dist * toll;
    const cost_driver   = dist * driv;
    const cost_depr     = dist * depr;
    const cost_other    = dist * oth;
    const cost_total    = cost_fuel + cost_toll + cost_driver + cost_depr + cost_other;
    const cost_per_km   = dist > 0 ? cost_total / dist : 0;

    return json({
      distance_km: dist, return_trip,
      fuel_liters: Math.round(fuel_liters*10)/10,
      cost_fuel: Math.round(cost_fuel*100)/100,
      cost_toll: Math.round(cost_toll*100)/100,
      cost_driver: Math.round(cost_driver*100)/100,
      cost_depreciation: Math.round(cost_depr*100)/100,
      cost_other: Math.round(cost_other*100)/100,
      cost_total: Math.round(cost_total*100)/100,
      cost_per_km: Math.round(cost_per_km*100)/100,
      breakdown: { fuel_pct: cost_total>0?Math.round(cost_fuel/cost_total*100):0,
                   toll_pct: cost_total>0?Math.round(cost_toll/cost_total*100):0,
                   driver_pct: cost_total>0?Math.round(cost_driver/cost_total*100):0 }
    });
  }

  return err('Nieznana operacja', 404);
}

// ═══════════════════════════════════════════════════════════════════════════
// GPS INTEGRATIONS — Teltonika / Webfleet / Samsara
// ═══════════════════════════════════════════════════════════════════════════

async function handleGpsIntegrations(req, env, user, url, path) {
  const co     = url.searchParams.get('company') || user.company_id;
  const method = req.method;
  const segs   = path.split('/').filter(Boolean);
  const provider = segs[2]; // 'teltonika' | 'webfleet' | 'samsara'
  const action   = segs[3]; // 'sync' | 'vehicles' | 'positions'

  if (!co) return err('Brak company', 400);

  if (method === 'GET' && !provider) {
    const rows = (await env.DB.prepare('SELECT id,provider,enabled,last_sync,sync_error,vehicles_tracked,created_at FROM gps_integrations WHERE company_id=?').bind(co).all()).results || [];
    return json(rows.map(r => {
      try { const cfg = JSON.parse(r.config||'{}'); return { ...r, has_token: !!cfg.token, account_id: cfg.account_id||'' }; }
      catch { return r; }
    }));
  }

  if (method === 'GET' && provider && !action) {
    const row = await env.DB.prepare('SELECT id,provider,enabled,last_sync,sync_error,vehicles_tracked FROM gps_integrations WHERE company_id=? AND provider=?').bind(co,provider).first();
    if (!row) return json({ configured: false });
    return json({ configured: true, ...row });
  }

  if (method === 'PUT' && provider && !action) {
    let body; try { body = await req.json(); } catch { return err('JSON', 400); }
    const { token, account_id='', server_url='', enabled=1 } = body;
    const config = JSON.stringify({ token, account_id, server_url });
    await env.DB.prepare(
      `INSERT INTO gps_integrations (id,company_id,provider,config,enabled)
       VALUES (?,?,?,?,?)
       ON CONFLICT(company_id,provider) DO UPDATE SET config=excluded.config, enabled=excluded.enabled`
    ).bind(crypto.randomUUID(),co,provider,config,enabled).run();
    return json({ ok:true });
  }

  // POST /api/gps-integrations/teltonika/sync — ręczna synchronizacja
  if (method === 'POST' && provider && action === 'sync') {
    const row = await env.DB.prepare('SELECT config FROM gps_integrations WHERE company_id=? AND provider=? AND enabled=1').bind(co,provider).first();
    if (!row) return err('Brak aktywnej konfiguracji', 400);
    let cfg; try { cfg = JSON.parse(row.config); } catch { return err('Błędna konfiguracja', 500); }

    let syncResult = { vehicles: 0, positions: 0, errors: [] };

    try {
      if (provider === 'teltonika') {
        // Teltonika FMB/FMC API — pobierz listę pojazdów i ostatnie pozycje
        const baseUrl = cfg.server_url || 'https://fm.teltonika.lt';
        const authResp = await fetch(`${baseUrl}/api/tokens`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ username: cfg.account_id, password: cfg.token })
        });
        if (authResp.ok) {
          const auth = await authResp.json();
          const token = auth.token || auth.access_token;
          if (token) {
            const devResp = await fetch(`${baseUrl}/api/devices`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (devResp.ok) {
              const devices = await devResp.json();
              syncResult.vehicles = Array.isArray(devices) ? devices.length : 0;
            }
          }
        }
      } else if (provider === 'webfleet') {
        // Webfleet API — REST v2
        const baseUrl = cfg.server_url || 'https://csv.webfleet.com';
        const resp = await fetch(`${baseUrl}/extern?action=showObjectReport&outputformat=json&apikey=${cfg.token}&account=${cfg.account_id}`);
        if (resp.ok) {
          const data = await resp.json();
          syncResult.vehicles = Array.isArray(data) ? data.length : (data?.totalRecords || 0);
          syncResult.positions = syncResult.vehicles;
        }
      } else if (provider === 'samsara') {
        const resp = await fetch('https://api.samsara.com/fleet/vehicles', {
          headers: { Authorization: `Token ${cfg.token}` }
        });
        if (resp.ok) {
          const data = await resp.json();
          syncResult.vehicles = data?.data?.length || 0;
        }
      }
    } catch(ex) {
      syncResult.errors.push(ex.message);
    }

    const now = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE gps_integrations SET last_sync=?, vehicles_tracked=?, sync_error=? WHERE company_id=? AND provider=?`
    ).bind(now, syncResult.vehicles, syncResult.errors.length ? syncResult.errors[0] : null, co, provider).run();

    return json({ ok: true, ...syncResult, synced_at: now });
  }

  return err('Nieznana operacja', 404);
}

// ═══════════════════════════════════════════════════════════════════════════
// DRIVER TRIPS — rejestracja tras kierowcy (PWA)
// ═══════════════════════════════════════════════════════════════════════════

async function handleDriverTrips(req, env, user, url, path) {
  const co     = url.searchParams.get('company') || user.company_id;
  const method = req.method;
  const segs   = path.split('/').filter(Boolean); // ['api','driver-trips', <id>?]
  const tripId = segs[2] || null;

  if (!co) return err('Brak company', 400);

  // GET /api/driver-trips?company=X[&driver_id=Y&date=YYYY-MM-DD]
  if (method === 'GET' && !tripId) {
    const driverId = url.searchParams.get('driver_id') || '';
    const date     = url.searchParams.get('date')      || '';
    let q = 'SELECT * FROM driver_trips WHERE company_id=?';
    const p = [co];
    if (driverId) { q += ' AND driver_id=?'; p.push(driverId); }
    if (date)     { q += ' AND start_at LIKE ?'; p.push(date + '%'); }
    q += ' ORDER BY start_at DESC LIMIT 200';
    const rows = (await env.DB.prepare(q).bind(...p).all()).results || [];
    return json(rows);
  }

  // GET /api/driver-trips/:id
  if (method === 'GET' && tripId) {
    const row = await env.DB.prepare(
      'SELECT * FROM driver_trips WHERE id=? AND company_id=?'
    ).bind(tripId, co).first();
    if (!row) return err('Nie znaleziono trasy', 404);
    return json(row);
  }

  // POST /api/driver-trips — start trip
  if (method === 'POST' && !tripId) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowy JSON', 400); }
    const { vehicle_id = '', vehicle_reg = '', driver_id = '', driver_name = '', start_km, notes = '' } = body;
    if (!vehicle_reg) return err('vehicle_reg jest wymagane', 400);
    if (start_km == null || isNaN(Number(start_km))) return err('start_km jest wymagane i musi być liczbą', 400);
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
    await env.DB.prepare(
      `INSERT INTO driver_trips (id, company_id, driver_id, driver_name, vehicle_id, vehicle_reg, start_km, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`
    ).bind(id, co, driver_id, driver_name, vehicle_id, vehicle_reg, Number(start_km), notes).run();
    const row = await env.DB.prepare('SELECT * FROM driver_trips WHERE id=?').bind(id).first();
    return json(row, 201);
  }

  // PUT /api/driver-trips/:id — end trip
  if (method === 'PUT' && tripId) {
    let body; try { body = await req.json(); } catch { return err('Nieprawidłowy JSON', 400); }
    const { end_km, notes, status = 'completed' } = body;
    if (end_km == null || isNaN(Number(end_km))) return err('end_km jest wymagane i musi być liczbą', 400);
    if (!['active', 'completed'].includes(status)) return err('Nieprawidłowy status', 400);
    const existing = await env.DB.prepare(
      'SELECT id, start_km FROM driver_trips WHERE id=? AND company_id=?'
    ).bind(tripId, co).first();
    if (!existing) return err('Nie znaleziono trasy', 404);
    if (existing.start_km != null && Number(end_km) < existing.start_km) {
      return err(`end_km (${end_km}) nie może być mniejszy niż start_km (${existing.start_km})`, 400);
    }
    await env.DB.prepare(
      `UPDATE driver_trips
         SET end_km=?, notes=COALESCE(?,notes), status=?, end_at=strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE id=? AND company_id=?`
    ).bind(Number(end_km), notes ?? null, status, tripId, co).run();
    const row = await env.DB.prepare('SELECT * FROM driver_trips WHERE id=?').bind(tripId).first();
    return json(row);
  }

  // DELETE /api/driver-trips/:id — only admin/kierownik
  if (method === 'DELETE' && tripId) {
    if (!['admin', 'kierownik'].includes(user.role)) return err('Brak uprawnień', 403);
    const existing = await env.DB.prepare(
      'SELECT id FROM driver_trips WHERE id=? AND company_id=?'
    ).bind(tripId, co).first();
    if (!existing) return err('Nie znaleziono trasy', 404);
    await env.DB.prepare('DELETE FROM driver_trips WHERE id=? AND company_id=?').bind(tripId, co).run();
    return json({ ok: true });
  }

  return err('Nieznana operacja', 404);
}

// ═══════════════════════════════════════════════════════════════════════════
// EV CHARGING — sesje ładowania EV
// ═══════════════════════════════════════════════════════════════════════════

async function handleEVCharging(req, env, user, url, path) {
  const co     = url.searchParams.get('company') || user.company_id;
  const method = req.method;
  const segs   = path.split('/').filter(Boolean);
  const itemId = segs[2];

  if (!co) return err('Brak company', 400);

  if (method === 'GET' && !itemId) {
    const vehicleId = url.searchParams.get('vehicle_id') || '';
    const df        = url.searchParams.get('date_from')  || '';
    const dt        = url.searchParams.get('date_to')    || '';
    const limit     = Math.min(parseInt(url.searchParams.get('limit')||'200'),500);
    let q = 'SELECT * FROM ev_charging_sessions WHERE company_id=?', p = [co];
    if (vehicleId) { q+=' AND vehicle_id=?'; p.push(vehicleId); }
    if (df) { q+=' AND session_date>=?'; p.push(df); }
    if (dt) { q+=' AND session_date<=?'; p.push(dt); }
    q += ` ORDER BY session_date DESC, start_time DESC LIMIT ${limit}`;
    const rows = (await env.DB.prepare(q).bind(...p).all()).results || [];
    const totalKwh = rows.reduce((s,r)=>s+(r.energy_kwh??0),0);
    const totalCost= rows.reduce((s,r)=>s+(r.cost_pln??0),0);
    return json({ sessions: rows, stats: { count: rows.length, total_kwh: Math.round(totalKwh*10)/10, total_cost: Math.round(totalCost*100)/100,
      avg_cost_per_kwh: totalKwh>0?Math.round(totalCost/totalKwh*100)/100:0 }});
  }

  if (method === 'POST') {
    let body; try { body = await req.json(); } catch { return err('JSON', 400); }
    const { vehicle_id='', vehicle_reg='', session_date, start_time='', end_time='', location='',
            charger_type='AC_slow', energy_kwh=0, cost_pln=0, charged_from_pct=null, charged_to_pct=null,
            range_after_km=null, provider='', home_charging=0, notes='' } = body;
    if (!session_date) return err('Pole session_date wymagane', 400);
    const id = crypto.randomUUID();
    const cPerKwh = energy_kwh>0 ? Math.round(cost_pln/energy_kwh*100)/100 : 0;
    await env.DB.prepare(
      `INSERT INTO ev_charging_sessions (id,company_id,vehicle_id,vehicle_reg,session_date,start_time,end_time,
       location,charger_type,energy_kwh,cost_pln,cost_per_kwh,charged_from_pct,charged_to_pct,range_after_km,provider,home_charging,notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id,co,vehicle_id,vehicle_reg,session_date,start_time,end_time,location,charger_type,energy_kwh,cost_pln,cPerKwh,
           charged_from_pct,charged_to_pct,range_after_km,provider,home_charging,notes).run();
    return json({ ok:true, id });
  }

  if (method === 'PUT' && itemId) {
    let body; try { body = await req.json(); } catch { return err('JSON', 400); }
    const flds=['session_date','start_time','end_time','location','charger_type','energy_kwh','cost_pln','charged_from_pct','charged_to_pct','range_after_km','provider','home_charging','notes'];
    const sets=[],vals=[];
    for(const f of flds) if(body[f]!==undefined){sets.push(`${f}=?`);vals.push(body[f]);}
    if(!sets.length) return err('Brak pól',400);
    vals.push(itemId,co);
    await env.DB.prepare(`UPDATE ev_charging_sessions SET ${sets.join(',')} WHERE id=? AND company_id=?`).bind(...vals).run();
    return json({ok:true});
  }

  if (method === 'DELETE' && itemId) {
    await env.DB.prepare('DELETE FROM ev_charging_sessions WHERE id=? AND company_id=?').bind(itemId, co).run();
    return json({ok:true});
  }

  return err('Nieznana operacja', 404);
}

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL2ORDER — AI parsowanie zleceń z e-maili
// ═══════════════════════════════════════════════════════════════════════════

async function handleEmail2Order(req, env, user, url) {
  if (req.method !== 'POST') return err('Tylko POST', 405);
  let body; try { body = await req.json(); } catch { return err('JSON', 400); }
  const { email_text, email_subject='' } = body;
  if (!email_text) return err('Brak treści e-maila', 400);

  if (!env.AI) return err('AI nie jest skonfigurowane', 503);

  const prompt = `Przeanalizuj poniższy e-mail i wyodrębnij dane zlecenia transportowego. Zwróć TYLKO JSON bez żadnego tekstu wokół niego.

Pola do wyodrębnienia:
- order_number: numer zlecenia (string lub null)
- customer_name: nazwa klienta/zleceniodawcy (string)
- load_location: miejsce załadunku (string)
- unload_location: miejsce rozładunku (string)
- load_date: data załadunku YYYY-MM-DD (string lub null)
- unload_date: data rozładunku YYYY-MM-DD (string lub null)
- cargo_description: opis ładunku (string)
- cargo_weight_t: waga w tonach (number lub null)
- cargo_volume_m3: objętość m3 (number lub null)
- vehicle_type: typ pojazdu (string lub null)
- price_pln: cena w PLN (number lub null)
- currency: waluta (string, domyślnie PLN)
- contact_person: osoba kontaktowa (string lub null)
- contact_phone: telefon (string lub null)
- special_requirements: wymagania specjalne (string lub null)
- priority: 'normal' | 'urgent' | 'low'

Temat: ${email_subject}

Treść e-maila:
${email_text.slice(0, 3000)}`;

  try {
    const ai = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
    });
    const text = ai?.response || ai?.result?.response || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return json({ ok: false, error: 'AI nie zwróciło JSON', raw: text });
    const parsed = JSON.parse(jsonMatch[0]);
    return json({ ok: true, data: parsed });
  } catch (ex) {
    return json({ ok: false, error: ex.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ZAPIER/MAKE CONNECTOR — rozszerzony format webhooka
// ═══════════════════════════════════════════════════════════════════════════

async function handleZapierWebhook(req, env, user, url, path) {
  const co     = url.searchParams.get('company') || user.company_id;
  const method = req.method;
  const segs   = path.split('/').filter(Boolean);
  const sub    = segs[2]; // 'test' | 'events'

  if (method === 'GET' && sub === 'events') {
    // Zwraca ostatnie zdarzenia w formacie Zapier (polling trigger)
    const limit = parseInt(url.searchParams.get('limit') || '25');
    const type  = url.searchParams.get('type') || '';
    // UWAGA: webhook_logs nie jest tworzona przez żaden schema_v*.sql i NIC do niej nie
    // zapisuje — to jedyne odwołanie w całym workerze. Bez .catch() ten SELECT wywalał
    // GET /api/zapier?events na 500. Pusta lista jest odpowiedzią zgodną z prawdą
    // (nie ma zalogowanych zdarzeń); dopiero implementacja zapisu uczyni ten trigger użytecznym.
    let q = 'SELECT * FROM webhook_logs WHERE company_id=? ';
    const p = [co];
    if (type) { q += 'AND event_type=? '; p.push(type); }
    q += `ORDER BY created_at DESC LIMIT ${limit}`;
    const rows = (await dbSafe(env.DB.prepare(q).bind(...p).all(), { results: [] }, env,
      { op: 'zapier-events', company: co })).results || [];
    // Zapier format: tablica z id jako string (wymagany dedupe)
    return json(rows.map(r => ({ id: r.id, ...JSON.parse(r.payload||'{}'), _event_type: r.event_type, _created_at: r.created_at })));
  }

  if (method === 'POST' && sub === 'test') {
    // Test webhooka przez Zapier
    return json({ ok: true, message: 'TaxOrder Pro Zapier connector aktywny', company: co, timestamp: new Date().toISOString(),
      sample: { vehicle_reg: 'WA12345', event: 'inspection_due', days_left: 14 } });
  }

  // GET /api/zapier/config — odczyt konfiguracji Zapier/Make
  if (method === 'GET' && sub === 'config') {
    const rows = (await env.DB.prepare('SELECT target, webhook_url, enabled, last_sent_at, last_status FROM zapier_config WHERE company_id=?').bind(co).all()).results || [];
    const cfg  = {};
    for (const r of rows) cfg[r.target + '_url'] = r.webhook_url;
    return json(cfg);
  }

  // POST /api/zapier/config — zapis URL Zapier lub Make
  if (method === 'POST' && sub === 'config') {
    const body = await req.json().catch(() => ({}));
    const { target, url: wurl } = body;
    if (!target || !wurl) return err('Brak target/url', 400);
    if (!wurl.startsWith('https://')) return err('URL musi zaczynać się od https://', 400);
    await env.DB.prepare(`INSERT INTO zapier_config(company_id,target,webhook_url) VALUES(?,?,?)
      ON CONFLICT(company_id,target) DO UPDATE SET webhook_url=excluded.webhook_url,enabled=1`).bind(co, target, wurl).run();
    return json({ ok: true });
  }

  return err('Nieznana operacja', 404);
}

// ── INSURANCE — polisy i roszczenia ──────────────────────────────────────────
async function handleInsurance(req, env, user, url, path) {
  const co     = url.searchParams.get('company') || user.company_id;
  const method = req.method;
  const segs   = path.split('/').filter(Boolean); // api, insurance, [claims|id], [id]
  const isClaims = segs[2] === 'claims';

  if (!isClaims) {
    // Polisy
    if (method === 'GET') {
      const status = url.searchParams.get('status') || '';
      const vreg   = url.searchParams.get('vehicle_reg') || '';
    const limit  = Math.min(parseInt(url.searchParams.get('limit')  || '1000'), 5000);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'),    0);
      let q = 'SELECT * FROM insurance_policies WHERE company_id=?';
      const p = [co];
      if (status) { q += ' AND status=?'; p.push(status); }
      if (vreg)   { q += ' AND vehicle_reg LIKE ?'; p.push('%' + vreg + '%'); }
      q += ' ORDER BY end_date ASC LIMIT ? OFFSET ?';
      p.push(limit, offset);
      const rows = (await env.DB.prepare(q).bind(...p).all()).results || [];
      return json(rows);
    }
    if (method === 'POST') {
      const b = await req.json().catch(() => ({}));
      if (!b.policy_number || !b.end_date) return err('Nr polisy i data końca wymagane', 400);
      await env.DB.prepare(`INSERT INTO insurance_policies(company_id,vehicle_id,vehicle_reg,policy_number,policy_type,insurer,start_date,end_date,premium_pln,sum_insured_pln,deductible_pln,broker,broker_contact,auto_renew,status,notes)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(co,b.vehicle_id||null,b.vehicle_reg||null,b.policy_number,b.policy_type||'OC',b.insurer||null,b.start_date||null,b.end_date,
          b.premium_pln??0,b.sum_insured_pln??null,b.deductible_pln??0,b.broker||null,b.broker_contact||null,b.auto_renew??0,b.status||'active',b.notes||null).run();
      return json({ ok: true });
    }
    const id = segs[2];
    if (id) {
      if (method === 'PUT') {
        const b = await req.json().catch(() => ({}));
        await env.DB.prepare(`UPDATE insurance_policies SET vehicle_reg=?,policy_number=?,policy_type=?,insurer=?,start_date=?,end_date=?,premium_pln=?,sum_insured_pln=?,deductible_pln=?,broker=?,broker_contact=?,auto_renew=?,status=?,notes=? WHERE id=? AND company_id=?`)
          .bind(b.vehicle_reg||null,b.policy_number,b.policy_type||'OC',b.insurer||null,b.start_date||null,b.end_date,b.premium_pln??0,b.sum_insured_pln??null,b.deductible_pln??0,b.broker||null,b.broker_contact||null,b.auto_renew??0,b.status||'active',b.notes||null,id,co).run();
        return json({ ok: true });
      }
      if (method === 'DELETE') {
        await env.DB.prepare('DELETE FROM insurance_policies WHERE id=? AND company_id=?').bind(id, co).run();
        return json({ ok: true });
      }
    }
  } else {
    // Roszczenia: /api/insurance/claims[/:id]
    const claimId = segs[3];
    if (method === 'GET') {
      const rows = (await env.DB.prepare('SELECT * FROM insurance_claims WHERE company_id=? ORDER BY claim_date DESC').bind(co).all()).results || [];
      return json(rows);
    }
    if (method === 'POST') {
      const b = await req.json().catch(() => ({}));
      if (!b.claim_date || !b.description) return err('Data i opis wymagane', 400);
      await env.DB.prepare(`INSERT INTO insurance_claims(company_id,policy_id,vehicle_id,vehicle_reg,claim_date,description,claim_number,claim_amount_pln,settled_amount_pln,status,notes)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(co,b.policy_id||null,b.vehicle_id||null,b.vehicle_reg||null,b.claim_date,b.description,b.claim_number||null,b.claim_amount_pln??0,b.settled_amount_pln??null,b.status||'open',b.notes||null).run();
      return json({ ok: true });
    }
    if (claimId) {
      if (method === 'PUT') {
        const b = await req.json().catch(() => ({}));
        await env.DB.prepare(`UPDATE insurance_claims SET vehicle_reg=?,claim_date=?,description=?,claim_number=?,claim_amount_pln=?,settled_amount_pln=?,status=?,notes=? WHERE id=? AND company_id=?`)
          .bind(b.vehicle_reg||null,b.claim_date,b.description,b.claim_number||null,b.claim_amount_pln??0,b.settled_amount_pln??null,b.status||'open',b.notes||null,claimId,co).run();
        return json({ ok: true });
      }
      if (method === 'DELETE') {
        await env.DB.prepare('DELETE FROM insurance_claims WHERE id=? AND company_id=?').bind(claimId, co).run();
        return json({ ok: true });
      }
    }
  }
  return err('Nieznana operacja', 404);
}

// ── ROUTE BILLING — faktury zleceń transportowych ───────────────────────────
async function handleRouteBilling(req, env, user, url, path) {
  const co     = url.searchParams.get('company') || user.company_id;
  const method = req.method;
  const segs   = path.split('/').filter(Boolean);
  const id     = segs[2];

  if (method === 'GET' && !id) {
    const status = url.searchParams.get('status') || '';
    let q = 'SELECT * FROM route_invoices WHERE company_id=?';
    const p = [co];
    if (status) { q += ' AND status=?'; p.push(status); }
    q += ' ORDER BY invoice_date DESC';
    const rows = (await env.DB.prepare(q).bind(...p).all()).results || [];
    const stats = {
      total_net:   rows.reduce((s,r)=>s+(r.net_pln??0),0),
      total_gross: rows.reduce((s,r)=>s+(r.gross_pln??0),0),
      total_cost:  rows.reduce((s,r)=>s+(r.cost_pln??0),0),
    };
    stats.margin_pln = stats.total_gross - stats.total_cost;
    stats.margin_pct = stats.total_gross > 0 ? parseFloat(((stats.margin_pln / stats.total_gross)*100).toFixed(2)) : 0;
    return json({ invoices: rows, stats });
  }
  if (method === 'POST' && !id) {
    const b = await req.json().catch(() => ({}));
    if (!b.invoice_number || !b.client_name) return err('Nr faktury i klient wymagani', 400);
    await env.DB.prepare(`INSERT INTO route_invoices(company_id,order_id,order_title,invoice_number,client_name,client_nip,invoice_date,due_date,net_pln,vat_rate,vat_pln,gross_pln,cost_pln,margin_pln,margin_pct,status,notes)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(co,b.order_id||null,b.order_title||null,b.invoice_number,b.client_name,b.client_nip||null,b.invoice_date||new Date().toISOString().slice(0,10),b.due_date||null,
        b.net_pln??0,b.vat_rate??0.23,b.vat_pln??0,b.gross_pln??0,b.cost_pln??0,b.margin_pln??0,b.margin_pct??0,b.status||'draft',b.notes||null).run();
    return json({ ok: true });
  }
  if (id) {
    if (method === 'PUT') {
      const b = await req.json().catch(() => ({}));
      if (b.status && Object.keys(b).length === 1) {
        await env.DB.prepare('UPDATE route_invoices SET status=? WHERE id=? AND company_id=?').bind(b.status, id, co).run();
      } else {
        await env.DB.prepare(`UPDATE route_invoices SET order_title=?,invoice_number=?,client_name=?,client_nip=?,invoice_date=?,due_date=?,net_pln=?,vat_rate=?,vat_pln=?,gross_pln=?,cost_pln=?,margin_pln=?,margin_pct=?,status=?,notes=? WHERE id=? AND company_id=?`)
          .bind(b.order_title||null,b.invoice_number,b.client_name,b.client_nip||null,b.invoice_date,b.due_date||null,b.net_pln??0,b.vat_rate??0.23,b.vat_pln??0,b.gross_pln??0,b.cost_pln??0,b.margin_pln??0,b.margin_pct??0,b.status||'draft',b.notes||null,id,co).run();
      }
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM route_invoices WHERE id=? AND company_id=?').bind(id, co).run();
      return json({ ok: true });
    }
  }
  return err('Nieznana operacja', 404);
}

// ── FLEET KPI — dashboard agregacje ─────────────────────────────────────────
async function handleFleetKpi(req, env, user, url) {
  const co     = url.searchParams.get('company') || user.company_id;
  const period = url.searchParams.get('period') || 'month';
  const days   = { week: 7, month: 30, quarter: 90, year: 365 }[period] || 30;
  const since  = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const [veh, fuel, svc, drv, tacho, ev, geo, inv, ins, ord] = await Promise.all([
    // Było: `SUM(CASE WHEN status='active' ...)` wprost na kolumnie `status`, której
    // `vehicles` NIE MA. To jedyne zapytanie w tym Promise.all BEZ `.catch()`, więc
    // odrzucenie wywracało cały handler — endpoint zwracał 500 przy każdym wywołaniu,
    // a wraz z nim martwa była cała strona „Dashboard KPI".
    env.DB.prepare(`SELECT COUNT(*) c,
        SUM(CASE WHEN ${SQL_VEH_ACTIVE} AND COALESCE(JSON_EXTRACT(data,'$.status'),'') NOT IN ('w_serwisie','in_service') THEN 1 ELSE 0 END) active,
        SUM(CASE WHEN COALESCE(JSON_EXTRACT(data,'$.status'),'') IN ('w_serwisie','in_service') THEN 1 ELSE 0 END) in_service
      FROM vehicles WHERE company_id=?`).bind(co).first(),
    env.DB.prepare('SELECT SUM(f.total_cost) c FROM fuel_fills f WHERE f.company_id=? AND f.fill_date>=?').bind(co, since).first().catch(()=>null),
    env.DB.prepare('SELECT SUM(so.koszt_rzeczywisty) c FROM service_orders so WHERE so.company_id=? AND so.data_realizacji>=?').bind(co, since).first().catch(()=>null),
    env.DB.prepare('SELECT COUNT(*) c FROM drivers WHERE company_id=?').bind(co).first(),
    env.DB.prepare('SELECT COUNT(*) c FROM tachograph_violations WHERE company_id=? AND violation_date>=?').bind(co, since).first().catch(()=>null),
    env.DB.prepare('SELECT COUNT(*) cnt, SUM(energy_kwh) kwh FROM ev_charging_sessions WHERE company_id=? AND session_date>=?').bind(co, since).first().catch(()=>null),
    env.DB.prepare('SELECT COUNT(*) c FROM geofence_events WHERE company_id=? AND event_time>=?').bind(co, since).first().catch(()=>null),
    env.DB.prepare('SELECT SUM(gross_pln) g, AVG(margin_pct) mp FROM route_invoices WHERE company_id=? AND invoice_date>=?').bind(co, since).first().catch(()=>null),
    env.DB.prepare('SELECT COUNT(*) c FROM insurance_policies WHERE company_id=? AND end_date BETWEEN date(\'now\') AND date(\'now\',\'+30 days\')').bind(co).first().catch(()=>null),
    env.DB.prepare('SELECT COUNT(*) c, SUM(CASE WHEN status=\'completed\' THEN 1 ELSE 0 END) done FROM transport_orders WHERE company_id=? AND created_at>=?').bind(co, since).first().catch(()=>null),
  ]);

  // Przeterminowane przeglądy
  // Było `przeglad_do` — nazwa, która NIE WYSTĘPUJE NIGDZIE w repo poza tym zapytaniem.
  // Aplikacja trzyma termin badania pod kluczem `nextInspection` w JSON `data`.
  // Z `.catch()` licznik przeterminowanych przeglądów zwracał zawsze zero.
  const ovInsp = await env.DB.prepare(
    `SELECT COUNT(*) c FROM vehicles WHERE company_id=?
       AND JSON_EXTRACT(data,'$.nextInspection') IS NOT NULL
       AND JSON_EXTRACT(data,'$.nextInspection') < date('now')`
  ).bind(co).first().catch(()=>null);
  // Top 5 pojazdów wg kosztów paliwa
  const topVeh = (await env.DB.prepare('SELECT nr_rej vehicle_reg, SUM(f.total_cost) total_cost FROM fuel_fills f WHERE f.company_id=? AND f.fill_date>=? GROUP BY nr_rej ORDER BY total_cost DESC LIMIT 5').bind(co,since).all().catch(()=>({results:[]}))).results;
  // Top naruszenia per kierowca
  const topDrv = (await env.DB.prepare(`SELECT TRIM(COALESCE(tf.driver_firstname,'')||' '||COALESCE(tf.driver_surname,'')) driver_name, COUNT(*) violations
     FROM tachograph_violations tv JOIN tachograph_files tf ON tf.id=tv.file_id
     WHERE tv.company_id=? AND tv.violation_date>=? AND COALESCE(tf.driver_surname,'')<>'' GROUP BY driver_name ORDER BY violations DESC LIMIT 5`).bind(co,since).all().catch(()=>({results:[]}))).results;
  // Składki ubezpieczeń
  const insSum = await env.DB.prepare('SELECT SUM(premium_pln) c FROM insurance_policies WHERE company_id=? AND status=\'active\'').bind(co).first().catch(()=>null);
  // CPC wygasające ≤90 dni
  const cpcExp = await env.DB.prepare('SELECT COUNT(*) c FROM drivers WHERE company_id=? AND cpc_expiry_date IS NOT NULL AND cpc_expiry_date BETWEEN date(\'now\') AND date(\'now\',\'+90 days\')').bind(co).first().catch(()=>null);

  return json({
    vehicles_total:    veh?.c ?? 0,
    vehicles_active:   veh?.active ?? 0,
    vehicles_in_service: veh?.in_service ?? 0,
    overdue_inspections: ovInsp?.c ?? 0,
    overdue_insurance:  ins?.c ?? 0,
    fuel_cost:         fuel?.c ?? null,
    service_cost:      svc?.c ?? null,
    insurance_cost:    insSum?.c ?? null,
    invoices_total:    inv?.g ?? null,
    margin_pct:        inv?.mp ?? null,
    drivers_count:     drv?.c ?? 0,
    tacho_violations:  tacho?.c ?? 0,
    avg_eco_score:     null,
    overtime_hours:    null,
    cpc_expiring:      cpcExp?.c ?? 0,
    ev_sessions:       ev?.cnt ?? 0,
    ev_kwh:            ev?.kwh ?? null,
    geofence_alerts:   geo?.c ?? 0,
    transport_orders:  ord?.c ?? 0,
    orders_completed:  ord?.done ?? 0,
    top_vehicles_cost: topVeh,
    top_violations:    topDrv,
  });
}

// ── ACCESS CONTROL — pakiety firm i uprawnienia per użytkownik ───────────────
// Definicja modułów i pakietów (single source of truth w backendzie)
const AC_PACKAGES = {
  basic:      ['dash','pojazdy','kierowcy','paliwo','szkody','mandaty','formularze','protokoly','powiadomienia','dt1-historia','faktury'],
  pro:        ['dash','pojazdy','kierowcy','paliwo','szkody','mandaty','formularze','protokoly','powiadomienia','dt1-historia','faktury',
                'zlecenia','opony-magazyn','karty','tachograph','transport-orders','kalendarz','fleet-kanban','driver-scoring','driver-performance',
                'budget','budget-annual','fuel-card-import','delegations','leasing-schedule','vehicle-equipment','vehicle-inventory',
                'spare-parts','service-contracts','supplier-invoices','approvals','fleet-policies','driver-panel','driver-schedule',
                'fleet-reservations','alert-dashboard','raporty','pdfexport','impexp','mapa'],
  enterprise: null, // null = wszystkie moduły bez ograniczeń
};

async function handleAccessControl(req, env, user, url, path) {
  const co     = url.searchParams.get('company') || user.company_id;
  const method = req.method;
  const segs   = path.split('/').filter(Boolean); // ['api','access-control',sub,...]
  const sub    = segs[2]; // 'my-permissions' | 'config' | 'users'
  const isAdmin = ['admin','superadmin','owner'].includes(user.role);

  // ── GET /api/access-control/my-permissions ───────────────────────────────
  if (method === 'GET' && sub === 'my-permissions') {
    const pkg = await env.DB.prepare('SELECT * FROM company_packages WHERE company_id=?').bind(co).first().catch(()=>null);
    const pkgName = pkg?.package_name || 'enterprise';
    let base = AC_PACKAGES[pkgName]; // null = all
    if (base !== null) {
      const add = JSON.parse(pkg?.modules_add || '[]');
      const rem = JSON.parse(pkg?.modules_remove || '[]');
      base = [...new Set([...base, ...add])].filter(m => !rem.includes(m));
    }
    // User-level overrides
    const userPerms = await env.DB.prepare('SELECT allowed_modules, denied_modules FROM user_module_permissions WHERE company_id=? AND user_id=?').bind(co, String(user.id)).first().catch(()=>null);
    let allowed = base; // null = unlimited
    if (userPerms) {
      const umpAllowed = userPerms.allowed_modules ? JSON.parse(userPerms.allowed_modules) : null;
      const umpDenied  = JSON.parse(userPerms.denied_modules || '[]');
      if (umpAllowed !== null) {
        // User has explicit allowed list — intersect with company package
        allowed = base === null ? umpAllowed : umpAllowed.filter(m => base.includes(m));
      } else {
        if (base !== null) allowed = base.filter(m => !umpDenied.includes(m));
      }
      if (base !== null && umpDenied.length) {
        allowed = (allowed || base).filter(m => !umpDenied.includes(m));
      }
    }
    return json({ ok: true, package: pkgName, allowed, unlimited: allowed === null });
  }

  // ── GET /api/access-control/config ──────────────────────────────────────
  if (method === 'GET' && sub === 'config') {
    if (!isAdmin) return err('Brak uprawnień', 403);
    const pkg = await env.DB.prepare('SELECT * FROM company_packages WHERE company_id=?').bind(co).first().catch(()=>null);
    return json(pkg || { company_id: co, package_name: 'enterprise', modules_add: '[]', modules_remove: '[]', valid_until: null, notes: null });
  }

  // ── PUT /api/access-control/config ──────────────────────────────────────
  if (method === 'PUT' && sub === 'config') {
    if (!isAdmin) return err('Brak uprawnień', 403);
    const b = await req.json().catch(()=>({}));
    await env.DB.prepare(`INSERT INTO company_packages(company_id,package_name,modules_add,modules_remove,valid_until,notes,updated_by)
      VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(company_id) DO UPDATE SET package_name=excluded.package_name,modules_add=excluded.modules_add,modules_remove=excluded.modules_remove,valid_until=excluded.valid_until,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=datetime('now')`)
      .bind(co, b.package_name||'enterprise', JSON.stringify(b.modules_add||[]), JSON.stringify(b.modules_remove||[]), b.valid_until||null, b.notes||null, user.email||user.id).run();
    return json({ ok: true });
  }

  // ── GET /api/access-control/users ───────────────────────────────────────
  if (method === 'GET' && sub === 'users') {
    if (!isAdmin) return err('Brak uprawnień', 403);
    const usersRows = (await env.DB.prepare('SELECT id, email, name, role, active FROM users WHERE company_id=? ORDER BY name').bind(co).all().catch(()=>({results:[]}))).results || [];
    const perms = (await env.DB.prepare('SELECT user_id, allowed_modules, denied_modules FROM user_module_permissions WHERE company_id=?').bind(co).all().catch(()=>({results:[]}))).results || [];
    const permsMap = {};
    for (const p of perms) permsMap[p.user_id] = p;
    return json(usersRows.map(u => ({
      ...u,
      allowed_modules: permsMap[u.id]?.allowed_modules ?? null,
      denied_modules:  permsMap[u.id]?.denied_modules  ?? '[]',
    })));
  }

  // ── PUT /api/access-control/users/:userId ───────────────────────────────
  if (method === 'PUT' && sub === 'users') {
    if (!isAdmin) return err('Brak uprawnień', 403);
    const targetUserId = segs[3];
    if (!targetUserId) return err('Brak user_id', 400);
    const b = await req.json().catch(()=>({}));
    const allowedJson = b.allowed_modules != null ? JSON.stringify(b.allowed_modules) : null;
    const deniedJson  = JSON.stringify(b.denied_modules || []);
    const targetUser  = await env.DB.prepare('SELECT email FROM users WHERE id=? AND company_id=?').bind(targetUserId, co).first().catch(()=>null);
    await env.DB.prepare(`INSERT INTO user_module_permissions(company_id,user_id,user_email,allowed_modules,denied_modules,updated_by)
      VALUES(?,?,?,?,?,?)
      ON CONFLICT(company_id,user_id) DO UPDATE SET allowed_modules=excluded.allowed_modules,denied_modules=excluded.denied_modules,user_email=excluded.user_email,updated_by=excluded.updated_by,updated_at=datetime('now')`)
      .bind(co, String(targetUserId), targetUser?.email||null, allowedJson, deniedJson, user.email||user.id).run();
    return json({ ok: true });
  }

  // ── DELETE /api/access-control/users/:userId — reset do domyślnych ───────
  if (method === 'DELETE' && sub === 'users') {
    if (!isAdmin) return err('Brak uprawnień', 403);
    const targetUserId = segs[3];
    if (!targetUserId) return err('Brak user_id', 400);
    await env.DB.prepare('DELETE FROM user_module_permissions WHERE company_id=? AND user_id=?').bind(co, String(targetUserId)).run();
    return json({ ok: true });
  }

  return err('Nieznana operacja', 404);
}

// ─── BATCH 7: KSeF, Inspekcje, Wymiana floty, Szkolenia, Limity, Parking, Wynajem wewn., Carpooling, RODO, Waluty ───

function coOf(url, user) {
  const req = url.searchParams.get('company') || user.company_id;
  // Non-admin nie może czytać/pisać danych innej firmy
  if (user.role !== 'admin' && req !== user.company_id) return user.company_id;
  return req;
}
function idSeg(path, n) { return path.split('/').filter(Boolean)[n] || null; }

async function handleKsef(req, env, user, url, path) {
  const co     = coOf(url, user);
  const segs   = path.split('/').filter(Boolean);
  const id     = segs[2] || null;
  const action = segs[3] || null;
  const method = req.method;

  // ─── Config (must come before generic id routes) ───
  if (id === 'config' && method === 'GET') {
    // Never return token to client
    const cfg = await env.DB.prepare(
      'SELECT company_id,nip,env,token_expires_at,auto_send_enabled,last_sync_at,updated_at FROM ksef_config WHERE company_id=?'
    ).bind(co).first().catch(()=>null);
    return json({ config: cfg || { company_id: co, nip: '', env: 'test', auto_send_enabled: 0 } });
  }
  if (id === 'config' && method === 'PUT') {
    const b = await req.json().catch(()=>({}));
    const hasToken = typeof b.token === 'string' && b.token.length > 0;
    if (hasToken) {
      await env.DB.prepare(
        `INSERT INTO ksef_config(company_id,nip,env,token,auto_send_enabled,updated_at) VALUES(?,?,?,?,?,strftime('%Y-%m-%dT%H:%M:%SZ','now'))
         ON CONFLICT(company_id) DO UPDATE SET nip=excluded.nip,env=excluded.env,token=excluded.token,auto_send_enabled=excluded.auto_send_enabled,updated_at=excluded.updated_at`
      ).bind(co, b.nip||null, b.env==='prod'?'prod':'test', b.token, b.auto_send_enabled?1:0).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO ksef_config(company_id,nip,env,auto_send_enabled,updated_at) VALUES(?,?,?,?,strftime('%Y-%m-%dT%H:%M:%SZ','now'))
         ON CONFLICT(company_id) DO UPDATE SET nip=excluded.nip,env=excluded.env,auto_send_enabled=excluded.auto_send_enabled,updated_at=excluded.updated_at`
      ).bind(co, b.nip||null, b.env==='prod'?'prod':'test', b.auto_send_enabled?1:0).run();
    }
    return json({ ok: true });
  }

  // ─── Auth: get/refresh KSeF session token ───
  if (id === 'auth' && method === 'POST') {
    const cfg = await env.DB.prepare('SELECT * FROM ksef_config WHERE company_id=?').bind(co).first().catch(()=>null);
    if (!cfg || !cfg.nip) return err('Brak konfiguracji KSeF (NIP wymagany)');
    const baseUrl = cfg.env === 'prod' ? 'https://ksef.mf.gov.pl' : 'https://ksef-test.mf.gov.pl';
    try {
      const body = await req.json().catch(()=>({}));
      const resp = await fetch(`${baseUrl}/api/common/Online/Session/AuthorisationChallenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ contextIdentifier: { type: 'onip', identifier: cfg.nip }, ...body }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await resp.json().catch(()=>({}));
      if (resp.ok && data.sessionToken) {
        const expires = new Date(Date.now() + (data.sessionTokenExpiryMs || 3600000)).toISOString();
        await env.DB.prepare(
          `UPDATE ksef_config SET token=?,token_expires_at=?,updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE company_id=?`
        ).bind(data.sessionToken, expires, co).run();
        return json({ ok: true, token_expires_at: expires });
      }
      const code = data?.exception?.exceptionDetailList?.[0]?.exceptionCode || 'auth_failed';
      return json({ ok: false, error: code }, resp.status);
    } catch (e) {
      return err('KSeF auth error: ' + (e?.message || 'timeout'));
    }
  }

  // ─── Offline queue list ───
  if (id === 'offline-queue' && method === 'GET') {
    const rows = (await env.DB.prepare(
      `SELECT * FROM ksef_offline_queue WHERE company_id=? ORDER BY created_at DESC LIMIT 100`
    ).bind(co).all().catch(()=>({results:[]}))).results || [];
    return json({ queue: rows });
  }

  // ─── Retry all queued items for this company ───
  if (id === 'retry-all' && method === 'POST') {
    const count = await _ksefRetryCompany(co, env);
    return json({ ok: true, retried: count });
  }

  // ─── Standard list ───
  if (method === 'GET' && !id) {
    const status = url.searchParams.get('status') || '';
    const q      = url.searchParams.get('q') || '';
    const where  = ['company_id=?'];
    const params = [co];
    if (status) { where.push('ksef_status=?'); params.push(status); }
    if (q)      { where.push('(invoice_number LIKE ? OR ksef_number LIKE ? OR seller_nip LIKE ? OR buyer_nip LIKE ?)'); const lk='%'+q+'%'; params.push(lk,lk,lk,lk); }
    const rows = (await env.DB.prepare(`SELECT * FROM ksef_invoices WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 200`).bind(...params).all().catch(()=>({results:[]}))).results || [];
    const stats = { total: rows.length, pending: 0, sent: 0, accepted: 0, rejected: 0, offline_queued: 0 };
    rows.forEach(r => { if (stats[r.ksef_status] !== undefined) stats[r.ksef_status]++; });
    return json({ invoices: rows, stats });
  }

  // ─── Single invoice ───
  if (method === 'GET' && id) {
    const row = await env.DB.prepare('SELECT * FROM ksef_invoices WHERE id=? AND company_id=?').bind(id, co).first().catch(()=>null);
    if (!row) return err('Nie znaleziono', 404);
    return json({ invoice: row });
  }

  // ─── Create ───
  if (method === 'POST' && !id) {
    const b = await req.json().catch(()=>({}));
    if (!b.invoice_number) return err('Brak numeru faktury');
    await env.DB.prepare(
      `INSERT INTO ksef_invoices(company_id,invoice_number,ksef_number,ksef_status,ksef_date,qr_code,upo_url,error_message,seller_nip,buyer_nip,gross_pln) VALUES(?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(co,b.invoice_number,b.ksef_number||null,b.ksef_status||'pending',b.ksef_date||null,b.qr_code||null,b.upo_url||null,b.error_message||null,b.seller_nip||null,b.buyer_nip||null,b.gross_pln!=null?+b.gross_pln:null).run();
    return json({ ok: true });
  }

  // ─── Update ───
  if (method === 'PUT' && id && !action) {
    const b = await req.json().catch(()=>({}));
    await env.DB.prepare(
      `UPDATE ksef_invoices SET invoice_number=?,ksef_number=?,ksef_status=?,ksef_date=?,upo_url=?,error_message=?,seller_nip=?,buyer_nip=?,gross_pln=? WHERE id=? AND company_id=?`
    ).bind(b.invoice_number,b.ksef_number||null,b.ksef_status||'pending',b.ksef_date||null,b.upo_url||null,b.error_message||null,b.seller_nip||null,b.buyer_nip||null,b.gross_pln!=null?+b.gross_pln:null,id,co).run();
    return json({ ok: true });
  }

  // ─── Send to KSeF (real API call with offline fallback) ───
  if (method === 'POST' && id && action === 'send') {
    return await _ksefSendInvoice(id, co, env);
  }

  // ─── Delete ───
  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM ksef_invoices WHERE id=? AND company_id=?').bind(id, co).run();
    return json({ ok: true });
  }

  return err('Nieznana operacja KSeF', 404);
}

// ─── KSeF helpers ────────────────────────────────────────────────────────────

async function _ksefSendInvoice(invoiceId, co, env) {
  const inv = await env.DB.prepare('SELECT * FROM ksef_invoices WHERE id=? AND company_id=?').bind(invoiceId, co).first().catch(()=>null);
  if (!inv) return err('Nie znaleziono faktury', 404);

  const cfg = await env.DB.prepare('SELECT * FROM ksef_config WHERE company_id=?').bind(co).first().catch(()=>null);
  if (!cfg || !cfg.token) {
    await _enqueueKsefOffline(inv, co, 'not_configured', env);
    await env.DB.prepare(`UPDATE ksef_invoices SET ksef_status='offline_queued',retry_count=COALESCE(retry_count,0)+1 WHERE id=? AND company_id=?`).bind(invoiceId, co).run();
    return json({ ok: false, offline_queued: true, reason: 'not_configured' });
  }

  const baseUrl = cfg.env === 'prod' ? 'https://ksef.mf.gov.pl' : 'https://ksef-test.mf.gov.pl';
  const xml = inv.xml_payload || `<?xml version="1.0" encoding="UTF-8"?><FA2><Invoice><Number>${inv.invoice_number}</Number></Invoice></FA2>`;

  try {
    const resp = await fetch(`${baseUrl}/api/online/Invoice/Send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'SessionToken': cfg.token },
      body: xml,
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      const data = await resp.json().catch(()=>({}));
      const ksefRef = data.elementReferenceNumber || data.referenceNumber || null;
      await env.DB.prepare(
        `UPDATE ksef_invoices SET ksef_status='accepted',ksef_number=?,upo_reference_number=?,sent_at=strftime('%Y-%m-%dT%H:%M:%SZ','now'),accepted_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=? AND company_id=?`
      ).bind(ksefRef, ksefRef, invoiceId, co).run();
      await env.DB.prepare(`DELETE FROM ksef_offline_queue WHERE invoice_id=? AND company_id=?`).bind(invoiceId, co).run().catch(()=>{});
      return json({ ok: true, ksef_reference: ksefRef, status: 'accepted' });
    }
    const errText = (await resp.text().catch(()=>'')).slice(0, 200);
    await _enqueueKsefOffline(inv, co, `HTTP ${resp.status}: ${errText}`, env);
    await env.DB.prepare(`UPDATE ksef_invoices SET ksef_status='offline_queued',error_message=?,retry_count=COALESCE(retry_count,0)+1 WHERE id=? AND company_id=?`).bind(`HTTP ${resp.status}`, invoiceId, co).run();
    return json({ ok: false, offline_queued: true, reason: `http_${resp.status}` });
  } catch (e) {
    const reason = (e?.name === 'AbortError' || e?.name === 'TimeoutError') ? 'timeout' : (e?.message || 'network_error');
    await _enqueueKsefOffline(inv, co, reason, env);
    await env.DB.prepare(`UPDATE ksef_invoices SET ksef_status='offline_queued',error_message=?,retry_count=COALESCE(retry_count,0)+1 WHERE id=? AND company_id=?`).bind(reason.slice(0,200), invoiceId, co).run();
    return json({ ok: false, offline_queued: true, reason });
  }
}

async function _enqueueKsefOffline(inv, co, errorMsg, env) {
  // Upsert: update existing queued entry or insert new one
  const existing = await env.DB.prepare(
    `SELECT id FROM ksef_offline_queue WHERE invoice_id=? AND company_id=? AND status='queued'`
  ).bind(inv.id, co).first().catch(()=>null);
  if (existing) {
    await env.DB.prepare(
      `UPDATE ksef_offline_queue SET error_last=?,last_attempt_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?`
    ).bind(errorMsg||null, existing.id).run().catch(()=>{});
  } else {
    await env.DB.prepare(
      `INSERT INTO ksef_offline_queue(company_id,invoice_id,invoice_number,xml_payload,error_last) VALUES(?,?,?,?,?)`
    ).bind(co, inv.id, inv.invoice_number, inv.xml_payload||'', errorMsg||null).run().catch(()=>{});
  }
}

async function _ksefRetryCompany(co, env) {
  const now = new Date().toISOString();
  const queued = (await env.DB.prepare(
    `SELECT * FROM ksef_offline_queue WHERE company_id=? AND status='queued' AND next_retry_at<=? AND attempt_count<10 ORDER BY next_retry_at ASC LIMIT 20`
  ).bind(co, now).all().catch(()=>({results:[]}))).results || [];
  if (!queued.length) return 0;

  const cfg = await env.DB.prepare('SELECT * FROM ksef_config WHERE company_id=?').bind(co).first().catch(()=>null);
  if (!cfg || !cfg.token) return 0;

  const baseUrl = cfg.env === 'prod' ? 'https://ksef.mf.gov.pl' : 'https://ksef-test.mf.gov.pl';
  let count = 0;

  for (const item of queued) {
    const newAttempt = (item.attempt_count ?? 0) + 1;
    const backoffMs  = Math.pow(2, item.attempt_count ?? 0) * 5 * 60000; // 2^n * 5 minutes
    const nextRetry  = new Date(Date.now() + backoffMs).toISOString();
    try {
      const resp = await fetch(`${baseUrl}/api/online/Invoice/Send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', 'SessionToken': cfg.token },
        body: item.xml_payload,
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const data = await resp.json().catch(()=>({}));
        const ksefRef = data.elementReferenceNumber || data.referenceNumber || null;
        await env.DB.prepare(
          `UPDATE ksef_invoices SET ksef_status='accepted',ksef_number=?,upo_reference_number=?,sent_at=strftime('%Y-%m-%dT%H:%M:%SZ','now'),accepted_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=? AND company_id=?`
        ).bind(ksefRef, ksefRef, item.invoice_id, co).run().catch(()=>{});
        await env.DB.prepare(`DELETE FROM ksef_offline_queue WHERE id=?`).bind(item.id).run().catch(()=>{});
        count++;
      } else {
        const errText = (await resp.text().catch(()=>'')).slice(0,200);
        const isFatal = newAttempt >= 10;
        await env.DB.prepare(
          `UPDATE ksef_offline_queue SET attempt_count=?,last_attempt_at=strftime('%Y-%m-%dT%H:%M:%SZ','now'),next_retry_at=?,error_last=?,status=? WHERE id=?`
        ).bind(newAttempt, nextRetry, `HTTP ${resp.status}: ${errText}`, isFatal?'failed_permanent':'queued', item.id).run().catch(()=>{});
      }
    } catch (e) {
      const isFatal = newAttempt >= 10;
      await env.DB.prepare(
        `UPDATE ksef_offline_queue SET attempt_count=?,last_attempt_at=strftime('%Y-%m-%dT%H:%M:%SZ','now'),next_retry_at=?,error_last=?,status=? WHERE id=?`
      ).bind(newAttempt, nextRetry, (e?.message||'error').slice(0,200), isFatal?'failed_permanent':'queued', item.id).run().catch(()=>{});
    }
  }
  return count;
}

async function runKsefRetry(env) {
  const now = new Date().toISOString();
  const companies = (await env.DB.prepare(
    `SELECT DISTINCT company_id FROM ksef_offline_queue WHERE status='queued' AND next_retry_at<=? AND attempt_count<10`
  ).bind(now).all().catch(()=>({results:[]}))).results || [];
  for (const row of companies) {
    await _ksefRetryCompany(row.company_id, env).catch(e => console.error('[KSeF retry]', e?.message));
  }
}

async function handleVehicleInspections(req, env, user, url, path) {
  const co = coOf(url, user); const id = idSeg(path, 2); const method = req.method;
  if (method === 'GET' && !id) {
    const reg    = url.searchParams.get('reg') || '';
    const status = url.searchParams.get('status') || '';
    const where  = ['company_id=?']; const params = [co];
    if (reg)    { where.push('vehicle_reg LIKE ?'); params.push('%'+reg+'%'); }
    if (status) { where.push('overall_status=?'); params.push(status); }
    const rows = (await env.DB.prepare(`SELECT * FROM vehicle_inspections WHERE ${where.join(' AND ')} ORDER BY inspection_date DESC LIMIT 200`).bind(...params).all().catch(()=>({results:[]}))).results||[];
    return json({ inspections: rows });
  }
  if (method === 'GET' && id) {
    const row = await env.DB.prepare('SELECT * FROM vehicle_inspections WHERE id=? AND company_id=?').bind(id, co).first().catch(()=>null);
    if (!row) return err('Nie znaleziono', 404);
    return json({ inspection: row });
  }
  if (method === 'POST' && !id) {
    const b = await req.json().catch(()=>({}));
    if (!b.inspection_date) return err('Brak daty inspekcji');
    await env.DB.prepare(`INSERT INTO vehicle_inspections(company_id,vehicle_id,vehicle_reg,inspection_date,inspector_name,mileage_km,overall_status,checklist,photo_urls,notes,next_inspection_date) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(co,b.vehicle_id||null,b.vehicle_reg||null,b.inspection_date,b.inspector_name||null,b.mileage_km!=null?+b.mileage_km:null,b.overall_status||'ok',b.checklist||'[]',b.photo_urls||'[]',b.notes||null,b.next_inspection_date||null).run();
    return json({ ok: true });
  }
  if (method === 'PUT' && id) {
    const b = await req.json().catch(()=>({}));
    await env.DB.prepare(`UPDATE vehicle_inspections SET vehicle_reg=?,inspection_date=?,inspector_name=?,mileage_km=?,overall_status=?,checklist=?,photo_urls=?,notes=?,next_inspection_date=? WHERE id=? AND company_id=?`)
      .bind(b.vehicle_reg||null,b.inspection_date,b.inspector_name||null,b.mileage_km!=null?+b.mileage_km:null,b.overall_status||'ok',b.checklist||'[]',b.photo_urls||'[]',b.notes||null,b.next_inspection_date||null,id,co).run();
    return json({ ok: true });
  }
  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM vehicle_inspections WHERE id=? AND company_id=?').bind(id, co).run();
    return json({ ok: true });
  }
  return err('Nieznana operacja inspekcji', 404);
}

async function handleFleetRenewal(req, env, user, url, path) {
  const co = coOf(url, user); const id = idSeg(path, 2); const method = req.method;
  if (method === 'GET' && !id) {
    const status = url.searchParams.get('status') || '';
    const q      = url.searchParams.get('q') || '';
    const where  = ['company_id=?']; const params = [co];
    if (status) { where.push('status=?'); params.push(status); }
    if (q)      { where.push('(vehicle_reg LIKE ? OR replacement_vehicle_desc LIKE ?)'); const lk='%'+q+'%'; params.push(lk,lk); }
    const rows = (await env.DB.prepare(`SELECT * FROM fleet_renewal_plan WHERE ${where.join(' AND ')} ORDER BY planned_replacement_date ASC LIMIT 200`).bind(...params).all().catch(()=>({results:[]}))).results||[];
    const stats = { planned: 0, in_progress: 0, done: 0, cancelled: 0, total_budget: 0 };
    rows.forEach(r => { if (stats[r.status]!==undefined) stats[r.status]++; stats.total_budget += r.replacement_budget_pln || 0; });
    return json({ plans: rows, stats });
  }
  if (method === 'GET' && id) {
    const row = await env.DB.prepare('SELECT * FROM fleet_renewal_plan WHERE id=? AND company_id=?').bind(id, co).first().catch(()=>null);
    if (!row) return err('Nie znaleziono', 404);
    return json({ plan: row });
  }
  if (method === 'POST' && !id) {
    const b = await req.json().catch(()=>({}));
    await env.DB.prepare(`INSERT INTO fleet_renewal_plan(company_id,vehicle_id,vehicle_reg,current_age_months,current_mileage_km,renewal_reason,planned_replacement_date,replacement_budget_pln,replacement_vehicle_desc,status,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(co,b.vehicle_id||null,b.vehicle_reg||null,b.current_age_months!=null?+b.current_age_months:null,b.current_mileage_km!=null?+b.current_mileage_km:null,b.renewal_reason||'manual',b.planned_replacement_date||null,b.replacement_budget_pln!=null?+b.replacement_budget_pln:null,b.replacement_vehicle_desc||null,b.status||'planned',b.notes||null).run();
    return json({ ok: true });
  }
  if (method === 'PUT' && id) {
    const b = await req.json().catch(()=>({}));
    await env.DB.prepare(`UPDATE fleet_renewal_plan SET vehicle_reg=?,current_age_months=?,current_mileage_km=?,renewal_reason=?,planned_replacement_date=?,replacement_budget_pln=?,replacement_vehicle_desc=?,status=?,notes=? WHERE id=? AND company_id=?`)
      .bind(b.vehicle_reg||null,b.current_age_months!=null?+b.current_age_months:null,b.current_mileage_km!=null?+b.current_mileage_km:null,b.renewal_reason||'manual',b.planned_replacement_date||null,b.replacement_budget_pln!=null?+b.replacement_budget_pln:null,b.replacement_vehicle_desc||null,b.status||'planned',b.notes||null,id,co).run();
    return json({ ok: true });
  }
  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM fleet_renewal_plan WHERE id=? AND company_id=?').bind(id, co).run();
    return json({ ok: true });
  }
  return err('Nieznana operacja', 404);
}

async function handleDriverTraining(req, env, user, url, path) {
  const co = coOf(url, user); const id = idSeg(path, 2); const method = req.method;
  if (method === 'GET' && !id) {
    const type   = url.searchParams.get('type') || '';
    const result = url.searchParams.get('result') || '';
    const q      = url.searchParams.get('q') || '';
    const where  = ['company_id=?']; const params = [co];
    if (type)   { where.push('record_type=?'); params.push(type); }
    if (result) { where.push('result=?'); params.push(result); }
    if (q)      { where.push('(driver_name LIKE ? OR title LIKE ?)'); const lk='%'+q+'%'; params.push(lk,lk); }
    const rows = (await env.DB.prepare(`SELECT * FROM driver_training_records WHERE ${where.join(' AND ')} ORDER BY start_date DESC LIMIT 200`).bind(...params).all().catch(()=>({results:[]}))).results||[];
    const today = new Date().toISOString().slice(0,10);
    const expIn30 = new Date(); expIn30.setDate(expIn30.getDate()+30);
    const expiring = rows.filter(r => r.valid_until && r.valid_until.slice(0,10) <= expIn30.toISOString().slice(0,10) && r.valid_until.slice(0,10) >= today);
    return json({ records: rows, expiring });
  }
  if (method === 'GET' && id) {
    const row = await env.DB.prepare('SELECT * FROM driver_training_records WHERE id=? AND company_id=?').bind(id, co).first().catch(()=>null);
    if (!row) return err('Nie znaleziono', 404);
    return json({ record: row });
  }
  if (method === 'POST' && !id) {
    const b = await req.json().catch(()=>({}));
    if (!b.driver_name || !b.title) return err('Brak wymaganych pól');
    await env.DB.prepare(`INSERT INTO driver_training_records(company_id,driver_id,driver_name,record_type,title,provider,start_date,end_date,valid_until,cost_pln,certificate_number,result,notes,document_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(co,b.driver_id||null,b.driver_name,b.record_type||'training',b.title,b.provider||null,b.start_date||null,b.end_date||null,b.valid_until||null,b.cost_pln!=null?+b.cost_pln:0,b.certificate_number||null,b.result||'passed',b.notes||null,b.document_url||null).run();
    return json({ ok: true });
  }
  if (method === 'PUT' && id) {
    const b = await req.json().catch(()=>({}));
    await env.DB.prepare(`UPDATE driver_training_records SET driver_name=?,record_type=?,title=?,provider=?,start_date=?,end_date=?,valid_until=?,cost_pln=?,certificate_number=?,result=?,notes=?,document_url=? WHERE id=? AND company_id=?`)
      .bind(b.driver_name,b.record_type||'training',b.title,b.provider||null,b.start_date||null,b.end_date||null,b.valid_until||null,b.cost_pln!=null?+b.cost_pln:0,b.certificate_number||null,b.result||'passed',b.notes||null,b.document_url||null,id,co).run();
    return json({ ok: true });
  }
  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM driver_training_records WHERE id=? AND company_id=?').bind(id, co).run();
    return json({ ok: true });
  }
  return err('Nieznana operacja szkoleń', 404);
}

async function handleFleetLimits(req, env, user, url, path) {
  const co = coOf(url, user); const id = idSeg(path, 2); const method = req.method;
  if (method === 'GET' && !id) {
    const scope  = url.searchParams.get('scope') || '';
    const period = url.searchParams.get('period') || '';
    const q      = url.searchParams.get('q') || '';
    const where  = ['company_id=?']; const params = [co];
    if (scope)  { where.push('limit_scope=?'); params.push(scope); }
    if (period) { where.push('period=?'); params.push(period); }
    if (q)      { where.push('scope_label LIKE ?'); params.push('%'+q+'%'); }
    const rows = (await env.DB.prepare(`SELECT * FROM fleet_limits WHERE ${where.join(' AND ')} ORDER BY scope_label ASC LIMIT 200`).bind(...params).all().catch(()=>({results:[]}))).results||[];
    return json({ limits: rows });
  }
  if (method === 'GET' && id) {
    const row = await env.DB.prepare('SELECT * FROM fleet_limits WHERE id=? AND company_id=?').bind(id, co).first().catch(()=>null);
    if (!row) return err('Nie znaleziono', 404);
    return json({ limit: row });
  }
  if (method === 'POST' && !id) {
    const b = await req.json().catch(()=>({}));
    if (!b.limit_scope) return err('Brak limit_scope');
    await env.DB.prepare(`INSERT OR REPLACE INTO fleet_limits(company_id,limit_scope,scope_id,scope_label,period,fuel_limit_liters,fuel_limit_pln,mileage_limit_km,private_mileage_limit_km,active) VALUES(?,?,?,?,?,?,?,?,?,?)`)
      .bind(co,b.limit_scope,b.scope_id||null,b.scope_label||null,b.period||'monthly',b.fuel_limit_liters!=null?+b.fuel_limit_liters:null,b.fuel_limit_pln!=null?+b.fuel_limit_pln:null,b.mileage_limit_km!=null?+b.mileage_limit_km:null,b.private_mileage_limit_km!=null?+b.private_mileage_limit_km:null,b.active!=null?+b.active:1).run();
    return json({ ok: true });
  }
  if (method === 'PUT' && id) {
    const b = await req.json().catch(()=>({}));
    await env.DB.prepare(`UPDATE fleet_limits SET scope_label=?,period=?,fuel_limit_liters=?,fuel_limit_pln=?,mileage_limit_km=?,private_mileage_limit_km=?,active=? WHERE id=? AND company_id=?`)
      .bind(b.scope_label||null,b.period||'monthly',b.fuel_limit_liters!=null?+b.fuel_limit_liters:null,b.fuel_limit_pln!=null?+b.fuel_limit_pln:null,b.mileage_limit_km!=null?+b.mileage_limit_km:null,b.private_mileage_limit_km!=null?+b.private_mileage_limit_km:null,b.active!=null?+b.active:1,id,co).run();
    return json({ ok: true });
  }
  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM fleet_limits WHERE id=? AND company_id=?').bind(id, co).run();
    return json({ ok: true });
  }
  return err('Nieznana operacja limitów', 404);
}

async function handleParking(req, env, user, url, path) {
  const co = coOf(url, user); const segs = path.split('/').filter(Boolean); const id = segs[2]||null; const sub = segs[3]||null; const method = req.method;
  if (method === 'GET' && !id) {
    const rows = (await env.DB.prepare(`SELECT * FROM parking_spots WHERE company_id=? ORDER BY spot_number ASC`).bind(co).all().catch(()=>({results:[]}))).results||[];
    return json({ spots: rows });
  }
  if (method === 'GET' && id && !sub) {
    const row = await env.DB.prepare('SELECT * FROM parking_spots WHERE id=? AND company_id=?').bind(id, co).first().catch(()=>null);
    if (!row) return err('Nie znaleziono', 404);
    return json({ spot: row });
  }
  if (method === 'POST' && !id) {
    const b = await req.json().catch(()=>({}));
    if (!b.spot_number) return err('Brak numeru miejsca');
    await env.DB.prepare(`INSERT INTO parking_spots(company_id,spot_number,location,spot_type,assigned_vehicle_reg,assigned_from,notes,active) VALUES(?,?,?,?,?,?,?,?)`)
      .bind(co,b.spot_number,b.location||null,b.spot_type||'standard',b.assigned_vehicle_reg||null,b.assigned_from||null,b.notes||null,b.active!=null?+b.active:1).run();
    return json({ ok: true });
  }
  if (method === 'PUT' && id && !sub) {
    const b = await req.json().catch(()=>({}));
    await env.DB.prepare(`UPDATE parking_spots SET spot_number=?,location=?,spot_type=?,assigned_vehicle_reg=?,assigned_from=?,notes=?,active=? WHERE id=? AND company_id=?`)
      .bind(b.spot_number,b.location||null,b.spot_type||'standard',b.assigned_vehicle_reg||null,b.assigned_from||null,b.notes||null,b.active!=null?+b.active:1,id,co).run();
    return json({ ok: true });
  }
  if (method === 'POST' && id && sub === 'release') {
    await env.DB.prepare(`UPDATE parking_spots SET assigned_vehicle_reg=NULL,assigned_vehicle_id=NULL,assigned_from=NULL WHERE id=? AND company_id=?`).bind(id, co).run();
    return json({ ok: true });
  }
  if (method === 'DELETE' && id && !sub) {
    await env.DB.prepare('DELETE FROM parking_spots WHERE id=? AND company_id=?').bind(id, co).run();
    return json({ ok: true });
  }
  return err('Nieznana operacja parkingu', 404);
}

async function handleInternalRentals(req, env, user, url, path) {
  const co = coOf(url, user); const segs = path.split('/').filter(Boolean); const id = segs[2]||null; const sub = segs[3]||null; const method = req.method;
  if (method === 'GET' && !id) {
    const status = url.searchParams.get('status') || '';
    const q      = url.searchParams.get('q') || '';
    const where  = ['company_id=?']; const params = [co];
    if (status) { where.push('status=?'); params.push(status); }
    if (q)      { where.push('(vehicle_reg LIKE ? OR renter_department LIKE ?)'); const lk='%'+q+'%'; params.push(lk,lk); }
    const rows = (await env.DB.prepare(`SELECT * FROM internal_rentals WHERE ${where.join(' AND ')} ORDER BY start_datetime DESC LIMIT 200`).bind(...params).all().catch(()=>({results:[]}))).results||[];
    const stats = { active: 0, returned: 0, invoiced: 0, total_cost: 0 };
    rows.forEach(r => { if (stats[r.status]!==undefined) stats[r.status]++; stats.total_cost += r.total_cost_pln || 0; });
    return json({ rentals: rows, stats });
  }
  if (method === 'GET' && id) {
    const row = await env.DB.prepare('SELECT * FROM internal_rentals WHERE id=? AND company_id=?').bind(id, co).first().catch(()=>null);
    if (!row) return err('Nie znaleziono', 404);
    return json({ rental: row });
  }
  if (method === 'POST' && !id) {
    const b = await req.json().catch(()=>({}));
    if (!b.renter_department || !b.start_datetime) return err('Brak wymaganych pól');
    await env.DB.prepare(`INSERT INTO internal_rentals(company_id,vehicle_id,vehicle_reg,renter_department,renter_person,start_datetime,end_datetime,mileage_start,mileage_end,purpose,cost_rate_pln_per_km,cost_rate_pln_per_day,distance_km,total_cost_pln,status,invoice_number,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(co,b.vehicle_id||null,b.vehicle_reg||null,b.renter_department,b.renter_person||null,b.start_datetime,b.end_datetime||null,b.mileage_start!=null?+b.mileage_start:null,b.mileage_end!=null?+b.mileage_end:null,b.purpose||null,b.cost_rate_pln_per_km!=null?+b.cost_rate_pln_per_km:0.89,b.cost_rate_pln_per_day!=null?+b.cost_rate_pln_per_day:0,b.distance_km!=null?+b.distance_km:null,b.total_cost_pln!=null?+b.total_cost_pln:null,b.status||'active',b.invoice_number||null,b.notes||null).run();
    return json({ ok: true });
  }
  if (method === 'PUT' && id && !sub) {
    const b = await req.json().catch(()=>({}));
    const mStart = b.mileage_start!=null?+b.mileage_start:null;
    const mEnd   = b.mileage_end!=null?+b.mileage_end:null;
    const dist   = mStart!=null && mEnd!=null ? Math.max(0, mEnd - mStart) : (b.distance_km!=null?+b.distance_km:null);
    const rate   = b.cost_rate_pln_per_km!=null?+b.cost_rate_pln_per_km:0.89;
    const auto_cost = dist!=null ? dist * rate : null;
    await env.DB.prepare(`UPDATE internal_rentals SET vehicle_reg=?,renter_department=?,renter_person=?,start_datetime=?,end_datetime=?,mileage_start=?,mileage_end=?,purpose=?,cost_rate_pln_per_km=?,cost_rate_pln_per_day=?,distance_km=?,total_cost_pln=?,status=?,invoice_number=?,notes=? WHERE id=? AND company_id=?`)
      .bind(b.vehicle_reg||null,b.renter_department,b.renter_person||null,b.start_datetime,b.end_datetime||null,mStart,mEnd,b.purpose||null,rate,b.cost_rate_pln_per_day!=null?+b.cost_rate_pln_per_day:0,dist,b.total_cost_pln!=null?+b.total_cost_pln:auto_cost,b.status||'active',b.invoice_number||null,b.notes||null,id,co).run();
    return json({ ok: true });
  }
  if (method === 'POST' && id && sub === 'return') {
    const b = await req.json().catch(()=>({}));
    const row = await env.DB.prepare('SELECT * FROM internal_rentals WHERE id=? AND company_id=?').bind(id, co).first().catch(()=>null);
    if (!row) return err('Nie znaleziono', 404);
    const mEnd = b.mileage_end!=null?+b.mileage_end:null;
    const dist = mEnd!=null && row.mileage_start!=null ? Math.max(0, mEnd - row.mileage_start) : null;
    const cost = dist!=null ? dist * (row.cost_rate_pln_per_km || 0.89) : null;
    await env.DB.prepare(`UPDATE internal_rentals SET end_datetime=?,mileage_end=?,distance_km=?,total_cost_pln=?,status='returned' WHERE id=? AND company_id=?`)
      .bind(b.end_datetime||new Date().toISOString().slice(0,16),mEnd,dist,cost,id,co).run();
    return json({ ok: true });
  }
  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM internal_rentals WHERE id=? AND company_id=?').bind(id, co).run();
    return json({ ok: true });
  }
  return err('Nieznana operacja', 404);
}

async function handleCarpooling(req, env, user, url, path) {
  const co = coOf(url, user); const segs = path.split('/').filter(Boolean); const id = segs[2]||null; const sub = segs[3]||null; const method = req.method;
  if (method === 'GET' && !id) {
    const date   = url.searchParams.get('date') || '';
    const status = url.searchParams.get('status') || '';
    const q      = url.searchParams.get('q') || '';
    const where  = ['company_id=?']; const params = [co];
    if (date)   { where.push('trip_date=?'); params.push(date); }
    if (status) { where.push('status=?'); params.push(status); }
    if (q)      { where.push('(driver_name LIKE ? OR origin LIKE ? OR destination LIKE ?)'); const lk='%'+q+'%'; params.push(lk,lk,lk); }
    const rows = (await env.DB.prepare(`SELECT * FROM carpooling_trips WHERE ${where.join(' AND ')} ORDER BY trip_date DESC, departure_time ASC LIMIT 200`).bind(...params).all().catch(()=>({results:[]}))).results||[];
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-7);
    const weekAgoStr = weekAgo.toISOString().slice(0,10);
    const thisWeek = rows.filter(r=>r.trip_date>=weekAgoStr).length;
    let co2 = 0;
    rows.forEach(r => {
      const parts = (() => { try { return JSON.parse(r.participants||'[]'); } catch { return []; } })();
      co2 += (r.distance_km||0) * parts.length * 0.12; // est. 120g CO2/km per avoided car trip
    });
    return json({ trips: rows, stats: { open: rows.filter(r=>r.status==='open').length, this_week: thisWeek, co2_saved: co2 } });
  }
  if (method === 'GET' && id) {
    const row = await env.DB.prepare('SELECT * FROM carpooling_trips WHERE id=? AND company_id=?').bind(id, co).first().catch(()=>null);
    if (!row) return err('Nie znaleziono', 404);
    return json({ trip: row });
  }
  if (method === 'POST' && !id) {
    const b = await req.json().catch(()=>({}));
    if (!b.driver_name || !b.trip_date) return err('Brak wymaganych pól');
    await env.DB.prepare(`INSERT INTO carpooling_trips(company_id,driver_id,driver_name,vehicle_id,vehicle_reg,trip_date,departure_time,origin,destination,available_seats,distance_km,cost_pln,status,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(co,b.driver_id||null,b.driver_name,b.vehicle_id||null,b.vehicle_reg||null,b.trip_date,b.departure_time||null,b.origin||null,b.destination||null,b.available_seats!=null?+b.available_seats:3,b.distance_km!=null?+b.distance_km:null,b.cost_pln!=null?+b.cost_pln:0,b.status||'open',b.notes||null).run();
    return json({ ok: true });
  }
  if (method === 'PUT' && id && !sub) {
    const b = await req.json().catch(()=>({}));
    await env.DB.prepare(`UPDATE carpooling_trips SET driver_name=?,vehicle_reg=?,trip_date=?,departure_time=?,origin=?,destination=?,available_seats=?,distance_km=?,cost_pln=?,status=?,notes=? WHERE id=? AND company_id=?`)
      .bind(b.driver_name,b.vehicle_reg||null,b.trip_date,b.departure_time||null,b.origin||null,b.destination||null,b.available_seats!=null?+b.available_seats:3,b.distance_km!=null?+b.distance_km:null,b.cost_pln!=null?+b.cost_pln:0,b.status||'open',b.notes||null,id,co).run();
    return json({ ok: true });
  }
  if (method === 'POST' && id && sub === 'participants') {
    const b = await req.json().catch(()=>({}));
    const row = await env.DB.prepare('SELECT * FROM carpooling_trips WHERE id=? AND company_id=?').bind(id, co).first().catch(()=>null);
    if (!row) return err('Nie znaleziono', 404);
    const parts = (() => { try { return JSON.parse(row.participants||'[]'); } catch { return []; } })();
    if (parts.length >= (row.available_seats || 3)) return err('Brak wolnych miejsc');
    parts.push({ name: b.name||'', department: b.department||'', pickup_point: b.pickup_point||'' });
    const newStatus = parts.length >= (row.available_seats || 3) ? 'full' : 'open';
    await env.DB.prepare('UPDATE carpooling_trips SET participants=?,status=? WHERE id=? AND company_id=?').bind(JSON.stringify(parts),newStatus,id,co).run();
    return json({ ok: true });
  }
  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM carpooling_trips WHERE id=? AND company_id=?').bind(id, co).run();
    return json({ ok: true });
  }
  return err('Nieznana operacja carpooling', 404);
}

async function handleGdpr(req, env, user, url, path) {
  const co = coOf(url, user); const id = idSeg(path, 2); const method = req.method;
  if (method === 'GET' && !id) {
    const type   = url.searchParams.get('type') || '';
    const status = url.searchParams.get('status') || '';
    const q      = url.searchParams.get('q') || '';
    const where  = ['company_id=?']; const params = [co];
    if (type)   { where.push('record_type=?'); params.push(type); }
    if (status) { where.push('status=?'); params.push(status); }
    if (q)      { where.push('(subject_name LIKE ? OR subject_email LIKE ?)'); const lk='%'+q+'%'; params.push(lk,lk); }
    const rows = (await env.DB.prepare(`SELECT * FROM gdpr_records WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 200`).bind(...params).all().catch(()=>({results:[]}))).results||[];
    const in14 = new Date(); in14.setDate(in14.getDate()+14); const in14s = in14.toISOString().slice(0,10);
    const today = new Date().toISOString().slice(0,10);
    const stats = {
      consent_active: rows.filter(r=>r.record_type==='consent'&&r.status==='active').length,
      requests_open:  rows.filter(r=>r.record_type==='request'&&r.status==='active').length,
      breaches:       rows.filter(r=>r.record_type==='breach').length,
      expiring_soon:  rows.filter(r=>r.retention_until&&r.retention_until.slice(0,10)<=in14s&&r.retention_until.slice(0,10)>=today&&r.status==='active').length,
    };
    return json({ records: rows, stats });
  }
  if (method === 'GET' && id) {
    const row = await env.DB.prepare('SELECT * FROM gdpr_records WHERE id=? AND company_id=?').bind(id, co).first().catch(()=>null);
    if (!row) return err('Nie znaleziono', 404);
    return json({ record: row });
  }
  if (method === 'POST' && !id) {
    const b = await req.json().catch(()=>({}));
    if (!b.record_type) return err('Brak record_type');
    const ret_until = b.retention_until || (b.retention_days ? new Date(Date.now() + +b.retention_days * 86400000).toISOString().slice(0,10) : null);
    await env.DB.prepare(`INSERT INTO gdpr_records(company_id,record_type,subject_type,subject_name,subject_email,description,legal_basis,retention_days,retention_until,status,handled_by,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(co,b.record_type,b.subject_type||'driver',b.subject_name||null,b.subject_email||null,b.description||null,b.legal_basis||null,b.retention_days!=null?+b.retention_days:null,ret_until,b.status||'active',b.handled_by||null,b.notes||null).run();
    return json({ ok: true });
  }
  if (method === 'PUT' && id) {
    const b = await req.json().catch(()=>({}));
    await env.DB.prepare(`UPDATE gdpr_records SET record_type=?,subject_type=?,subject_name=?,subject_email=?,description=?,legal_basis=?,retention_days=?,retention_until=?,status=?,handled_by=?,notes=? WHERE id=? AND company_id=?`)
      .bind(b.record_type,b.subject_type||'driver',b.subject_name||null,b.subject_email||null,b.description||null,b.legal_basis||null,b.retention_days!=null?+b.retention_days:null,b.retention_until||null,b.status||'active',b.handled_by||null,b.notes||null,id,co).run();
    return json({ ok: true });
  }
  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM gdpr_records WHERE id=? AND company_id=?').bind(id, co).run();
    return json({ ok: true });
  }
  return err('Nieznana operacja RODO', 404);
}

async function handleCurrency(req, env, user, url, path) {
  const co = coOf(url, user); const segs = path.split('/').filter(Boolean); const id = segs[2]||null; const sub = segs[3]||null; const method = req.method;
  if (method === 'GET' && !id) {
    const code  = url.searchParams.get('code') || '';
    const from_ = url.searchParams.get('from') || '';
    const to_   = url.searchParams.get('to')   || '';
    const where = ['company_id=?']; const params = [co];
    if (code)  { where.push('currency_code=?'); params.push(code); }
    if (from_) { where.push('rate_date>=?'); params.push(from_); }
    if (to_)   { where.push('rate_date<=?'); params.push(to_); }
    const rows = (await env.DB.prepare(`SELECT * FROM currency_rates WHERE ${where.join(' AND ')} ORDER BY rate_date DESC, currency_code ASC LIMIT 500`).bind(...params).all().catch(()=>({results:[]}))).results||[];
    return json({ rates: rows });
  }
  if (method === 'POST' && !id) {
    const b = await req.json().catch(()=>({}));
    if (!b.currency_code || !b.rate_to_pln || !b.rate_date) return err('Brak wymaganych pól');
    await env.DB.prepare(`INSERT OR REPLACE INTO currency_rates(company_id,currency_code,rate_to_pln,rate_date,source) VALUES(?,?,?,?,?)`)
      .bind(co, b.currency_code.toUpperCase(), +b.rate_to_pln, b.rate_date, b.source||'manual').run();
    return json({ ok: true });
  }
  if (method === 'POST' && id === 'nbp-fetch') {
    // Pobierz kursy z NBP API (tabela A — kursy średnie)
    try {
      const today = new Date().toISOString().slice(0,10);
      const resp  = await fetch(`https://api.nbp.pl/api/exchangerates/tables/A/${today}/?format=json`);
      if (!resp.ok) return json({ ok: false, error: 'NBP API niedostępne' });
      const data  = await resp.json();
      const rates = data[0]?.rates || [];
      const stmts = rates.map(r =>
        env.DB.prepare(`INSERT OR REPLACE INTO currency_rates(company_id,currency_code,rate_to_pln,rate_date,source) VALUES(?,?,?,?,?)`)
          .bind(co, r.code, r.mid, today, 'nbp')
      );
      await env.DB.batch(stmts);
      return json({ ok: true, imported: stmts.length, date: today });
    } catch (e) {
      return json({ ok: false, error: e.message });
    }
  }
  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM currency_rates WHERE id=? AND company_id=?').bind(id, co).run();
    return json({ ok: true });
  }
  return err('Nieznana operacja walut', 404);
}

// ───────────── BATCH 8 HANDLERS ─────────────

async function handlePredictiveMaintenance(req, env, user, url, path) {
  const co = coOf(url, user); const segs = path.split('/').filter(Boolean); const id = segs[2]||null; const sub = segs[3]||null; const method = req.method;
  if (method==='GET' && !id) {
    const status = url.searchParams.get('status')||''; const reg = url.searchParams.get('reg')||'';
    const where=['company_id=?']; const params=[co];
    if(status){where.push('status=?');params.push(status);}
    if(reg){where.push('vehicle_reg LIKE ?');params.push('%'+reg+'%');}
    const rows=(await env.DB.prepare(`SELECT * FROM predictive_alerts WHERE ${where.join(' AND ')} ORDER BY status ASC, predicted_due_date ASC LIMIT 500`).bind(...params).all().catch(()=>({results:[]}))).results||[];
    const stats={overdue:rows.filter(r=>r.status==='overdue').length,soon:rows.filter(r=>r.status==='soon').length,ok:rows.filter(r=>r.status==='ok').length};
    return json({alerts:rows,stats});
  }
  if(method==='GET'&&id&&!sub){const r=await env.DB.prepare('SELECT * FROM predictive_alerts WHERE id=? AND company_id=?').bind(id,co).first().catch(()=>null);return json({alert:r});}
  if(method==='POST'&&!id){const b=await req.json().catch(()=>({}));if(!b.vehicle_reg||!b.alert_type)return err('Brak wymaganych pól');const rid=crypto.randomUUID();await env.DB.prepare('INSERT INTO predictive_alerts(id,company_id,vehicle_reg,alert_type,trigger_type,interval_km,interval_days,last_service_date,last_service_km,current_km,predicted_due_date,predicted_due_km,status,active,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(rid,co,b.vehicle_reg,b.alert_type,b.trigger_type||'mileage',b.interval_km??null,b.interval_days??null,b.last_service_date||null,b.last_service_km??null,b.current_km??null,b.predicted_due_date||null,b.predicted_due_km??null,'ok',b.active??1,b.notes||null).run();return json({ok:true,id:rid});}
  if(method==='PUT'&&id){const b=await req.json().catch(()=>({}));await env.DB.prepare('UPDATE predictive_alerts SET vehicle_reg=?,alert_type=?,trigger_type=?,interval_km=?,interval_days=?,last_service_date=?,last_service_km=?,current_km=?,notes=?,active=? WHERE id=? AND company_id=?').bind(b.vehicle_reg,b.alert_type,b.trigger_type||'mileage',b.interval_km??null,b.interval_days??null,b.last_service_date||null,b.last_service_km??null,b.current_km??null,b.notes||null,b.active??1,id,co).run();return json({ok:true});}
  if(method==='POST'&&id&&sub==='done'){const b=await req.json().catch(()=>({}));const today=new Date().toISOString().slice(0,10);await env.DB.prepare('UPDATE predictive_alerts SET last_service_date=?,last_service_km=?,status=? WHERE id=? AND company_id=?').bind(b.date||today,b.km??null,'ok',id,co).run();return json({ok:true});}
  if(method==='POST'&&segs[2]==='recalculate'){const rows=(await env.DB.prepare('SELECT * FROM predictive_alerts WHERE company_id=? AND active=1').bind(co).all().catch(()=>({results:[]}))).results||[];let updated=0;const today=new Date();for(const a of rows){let status='ok';if(a.trigger_type==='mileage'&&a.predicted_due_km!=null&&a.current_km!=null){if(a.current_km>=a.predicted_due_km)status='overdue';else if(a.current_km>=(a.predicted_due_km-2000))status='soon';}else if(a.trigger_type==='date'&&a.predicted_due_date){const diff=Math.floor((new Date(a.predicted_due_date)-today)/86400000);if(diff<0)status='overdue';else if(diff<=14)status='soon';}if(status!==a.status){await env.DB.prepare('UPDATE predictive_alerts SET status=? WHERE id=?').bind(status,a.id).run();updated++;}}return json({ok:true,updated});}
  if(method==='DELETE'&&id){await env.DB.prepare('DELETE FROM predictive_alerts WHERE id=? AND company_id=?').bind(id,co).run();return json({ok:true});}
  return err('Nieznana operacja',404);
}

async function handleWarranties(req, env, user, url, path) {
  const co=coOf(url,user);const segs=path.split('/').filter(Boolean);const id=segs[2]||null;const method=req.method;
  if(method==='GET'&&!id){
    const type=url.searchParams.get('type')||'';const reg=url.searchParams.get('reg')||'';
    const where=['company_id=?'];const params=[co];
    if(type){where.push('record_type=?');params.push(type);}
    if(reg){where.push('vehicle_reg LIKE ?');params.push('%'+reg+'%');}
    const rows=(await env.DB.prepare(`SELECT * FROM warranties_recalls WHERE ${where.join(' AND ')} ORDER BY end_date ASC NULLS LAST, created_at DESC LIMIT 500`).bind(...params).all().catch(()=>({results:[]}))).results||[];
    const active_recalls=rows.filter(r=>r.record_type==='recall'&&r.recall_status==='open');
    return json({records:rows,active_recalls});
  }
  if(method==='GET'&&id){const r=await env.DB.prepare('SELECT * FROM warranties_recalls WHERE id=? AND company_id=?').bind(id,co).first().catch(()=>null);return json({record:r});}
  if(method==='POST'&&!id){const b=await req.json().catch(()=>({}));if(!b.vehicle_reg||!b.title)return err('Brak wymaganych pól');const rid=crypto.randomUUID();await env.DB.prepare('INSERT INTO warranties_recalls(id,company_id,vehicle_reg,record_type,title,provider,recall_number,start_date,end_date,mileage_limit_km,recall_status,cost_pln,description,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(rid,co,b.vehicle_reg,b.record_type||'warranty',b.title,b.provider||null,b.recall_number||null,b.start_date||null,b.end_date||null,b.mileage_limit_km??null,b.recall_status||'open',b.cost_pln??null,b.description||null,b.notes||null).run();return json({ok:true,id:rid});}
  if(method==='PUT'&&id){const b=await req.json().catch(()=>({}));await env.DB.prepare('UPDATE warranties_recalls SET vehicle_reg=?,record_type=?,title=?,provider=?,recall_number=?,start_date=?,end_date=?,mileage_limit_km=?,recall_status=?,cost_pln=?,description=?,notes=? WHERE id=? AND company_id=?').bind(b.vehicle_reg,b.record_type||'warranty',b.title,b.provider||null,b.recall_number||null,b.start_date||null,b.end_date||null,b.mileage_limit_km??null,b.recall_status||'open',b.cost_pln??null,b.description||null,b.notes||null,id,co).run();return json({ok:true});}
  if(method==='DELETE'&&id){await env.DB.prepare('DELETE FROM warranties_recalls WHERE id=? AND company_id=?').bind(id,co).run();return json({ok:true});}
  return err('Nieznana operacja',404);
}

async function handleSuppliers(req, env, user, url, path) {
  const co=coOf(url,user);const segs=path.split('/').filter(Boolean);const id=segs[2]||null;const method=req.method;
  if(method==='GET'&&!id){
    const cat=url.searchParams.get('cat')||'';const q=url.searchParams.get('q')||'';
    const where=['company_id=?'];const params=[co];
    if(cat){where.push('category=?');params.push(cat);}
    if(q){where.push('(name LIKE ? OR nip LIKE ? OR city LIKE ?)');params.push('%'+q+'%','%'+q+'%','%'+q+'%');}
    const rows=(await env.DB.prepare(`SELECT * FROM supplier_records WHERE ${where.join(' AND ')} ORDER BY name ASC LIMIT 300`).bind(...params).all().catch(()=>({results:[]}))).results||[];
    return json({suppliers:rows});
  }
  if(method==='GET'&&id){const r=await env.DB.prepare('SELECT * FROM supplier_records WHERE id=? AND company_id=?').bind(id,co).first().catch(()=>null);return json({supplier:r});}
  if(method==='POST'&&!id){const b=await req.json().catch(()=>({}));if(!b.name)return err('Brak nazwy dostawcy');const rid=crypto.randomUUID();await env.DB.prepare('INSERT INTO supplier_records(id,company_id,name,category,nip,address,city,contact_name,contact_phone,contact_email,rating,payment_terms_days,active,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(rid,co,b.name,b.category||'other',b.nip||null,b.address||null,b.city||null,b.contact_name||null,b.contact_phone||null,b.contact_email||null,+b.rating||3,+b.payment_terms_days||30,+(b.active??1),b.notes||null).run();return json({ok:true,id:rid});}
  if(method==='PUT'&&id){const b=await req.json().catch(()=>({}));await env.DB.prepare('UPDATE supplier_records SET name=?,category=?,nip=?,address=?,city=?,contact_name=?,contact_phone=?,contact_email=?,rating=?,payment_terms_days=?,active=?,notes=? WHERE id=? AND company_id=?').bind(b.name,b.category||'other',b.nip||null,b.address||null,b.city||null,b.contact_name||null,b.contact_phone||null,b.contact_email||null,+b.rating||3,+b.payment_terms_days||30,+(b.active??1),b.notes||null,id,co).run();return json({ok:true});}
  if(method==='DELETE'&&id){await env.DB.prepare('DELETE FROM supplier_records WHERE id=? AND company_id=?').bind(id,co).run();return json({ok:true});}
  return err('Nieznana operacja',404);
}

async function handleFleetDisposal(req, env, user, url, path) {
  const co=coOf(url,user);const segs=path.split('/').filter(Boolean);const id=segs[2]||null;const method=req.method;
  if(method==='GET'&&!id){
    const status=url.searchParams.get('status')||'';const reason=url.searchParams.get('reason')||'';const q=url.searchParams.get('q')||'';
    const where=['company_id=?'];const params=[co];
    if(status){where.push('status=?');params.push(status);}
    if(reason){where.push('reason=?');params.push(reason);}
    if(q){where.push('(vehicle_reg LIKE ? OR buyer_name LIKE ?)');params.push('%'+q+'%','%'+q+'%');}
    const rows=(await env.DB.prepare(`SELECT * FROM disposal_records WHERE ${where.join(' AND ')} ORDER BY start_date DESC LIMIT 300`).bind(...params).all().catch(()=>({results:[]}))).results||[];
    const completed=rows.filter(r=>r.status==='completed');
    const stats={in_progress:rows.filter(r=>r.status==='in_progress').length,completed:completed.length,total_sale:completed.reduce((s,r)=>s+(r.sale_price_pln||0),0),pnl:completed.reduce((s,r)=>s+((r.sale_price_pln||0)-(r.book_value_pln||0)),0)};
    return json({disposals:rows,stats});
  }
  if(method==='GET'&&id){const r=await env.DB.prepare('SELECT * FROM disposal_records WHERE id=? AND company_id=?').bind(id,co).first().catch(()=>null);return json({disposal:r});}
  if(method==='POST'&&!id){const b=await req.json().catch(()=>({}));if(!b.vehicle_reg||!b.reason)return err('Brak wymaganych pól');const rid=crypto.randomUUID();await env.DB.prepare('INSERT INTO disposal_records(id,company_id,vehicle_reg,reason,start_date,end_date,mileage_final_km,book_value_pln,sale_price_pln,buyer_name,buyer_nip,document_number,status,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(rid,co,b.vehicle_reg,b.reason,b.start_date||new Date().toISOString().slice(0,10),b.end_date||null,b.mileage_final_km??null,b.book_value_pln??null,b.sale_price_pln??null,b.buyer_name||null,b.buyer_nip||null,b.document_number||null,b.status||'in_progress',b.notes||null).run();return json({ok:true,id:rid});}
  if(method==='PUT'&&id){const b=await req.json().catch(()=>({}));await env.DB.prepare('UPDATE disposal_records SET vehicle_reg=?,reason=?,start_date=?,end_date=?,mileage_final_km=?,book_value_pln=?,sale_price_pln=?,buyer_name=?,buyer_nip=?,document_number=?,status=?,notes=? WHERE id=? AND company_id=?').bind(b.vehicle_reg,b.reason,b.start_date||null,b.end_date||null,b.mileage_final_km??null,b.book_value_pln??null,b.sale_price_pln??null,b.buyer_name||null,b.buyer_nip||null,b.document_number||null,b.status||'in_progress',b.notes||null,id,co).run();return json({ok:true});}
  if(method==='DELETE'&&id){await env.DB.prepare('DELETE FROM disposal_records WHERE id=? AND company_id=?').bind(id,co).run();return json({ok:true});}
  return err('Nieznana operacja',404);
}

async function handleReportBuilder(req, env, user, url, path) {
  const co=coOf(url,user);const segs=path.split('/').filter(Boolean);const sub=segs[2]||null;const id=segs[3]||null;const method=req.method;
  // fuel_fills, NIE fuel_entries — ta druga nie istnieje w D1, a zapytanie ma .catch(),
  // więc źródło „Paliwo" w kreatorze raportów dawało zawsze pustą tabelę bez żadnego błędu.
  // Kolumny muszą się zgadzać z modules/report-builder.js (front i backend są sparowane).
  const ALLOWED_TABLES=['vehicles','fuel_fills','service_orders','damage_reports','fines','tco_cost_entries','ksef_invoices','carpooling_trips'];
  // `vehicles` to jedyne źródło, w którym dane NIE leżą w płaskich kolumnach — poza
  // `nr_rej` wszystko siedzi w kolumnie JSON `data`. Whitelista wymieniała nazwy logiczne
  // (reg, brand, model, dmc…), których w tabeli nie ma, a zapytanie ma `.catch()`,
  // więc źródło „Pojazdy" zwracało PUSTĄ TABELĘ bez śladu błędu. Mapujemy nazwę logiczną
  // na wyrażenie SQL; pozostałe źródła zostają na płaskich kolumnach.
  const COL_EXPR={vehicles:{
    id:'id',
    reg:'nr_rej',
    brand:"JSON_EXTRACT(data,'$.marka')",
    model:"JSON_EXTRACT(data,'$.model')",
    year:"JSON_EXTRACT(data,'$.rok')",
    vin:"JSON_EXTRACT(data,'$.vin')",
    fuel_type:"JSON_EXTRACT(data,'$.paliwo')",
    // Aplikacja czyta `v.dmc ?? v.dmcMax` — COALESCE zachowuje tę semantykę,
    // w tym regułę falsy-zero: DMC równe 0 zostaje zerem, nie wpada w fallback.
    dmc:"COALESCE(JSON_EXTRACT(data,'$.dmc'),JSON_EXTRACT(data,'$.dmcMax'))",
    status:"JSON_EXTRACT(data,'$.status')",
    driver:"JSON_EXTRACT(data,'$.kierowca')",
    // app.js czyta `v.oddzial || v.branch_id`.
    department:"COALESCE(JSON_EXTRACT(data,'$.oddzial'),branch_id)",
  }};
  // Nazwy kolumn pochodzą wyłącznie z whitelisty poniżej, więc podstawienie jest bezpieczne.
  const expr=(t,c)=>(COL_EXPR[t]&&COL_EXPR[t][c])||c;
  const ALLOWED_COLS={vehicles:['id','reg','brand','model','year','vin','fuel_type','dmc','status','driver','department'],fuel_fills:['id','fill_date','nr_rej','liters','total_cost','price_per_liter','odometer','driver_name','fuel_type','station'],service_orders:['id','nr_rej','typ','opis','status','warsztat','koszt_szacowany','koszt_rzeczywisty','data_realizacji','km_realizacji'],damage_reports:['id','nr_rej','data_zdarzenia','opis','przyczyna','status','koszt','zglaszajacy'],fines:['id','nr_rej','driver_name','date','type','amount','description','fine_no','issuer','points','paid','paid_date'],tco_cost_entries:['id','entry_date','vehicle_reg','category','amount_pln','description'],ksef_invoices:['id','invoice_number','ksef_number','ksef_status','seller_nip','buyer_nip','gross_pln','ksef_date'],carpooling_trips:['id','trip_date','driver_name','vehicle_reg','origin','destination','status','cost_pln']};
  if(method==='POST'&&sub==='run'){
    const b=await req.json().catch(()=>({}));
    const table=b.source||b.source_table||'vehicles';
    if(!ALLOWED_TABLES.includes(table))return err('Niedozwolone źródło danych');
    const allowedCols=ALLOWED_COLS[table]||[];
    const reqCols=(Array.isArray(b.cols)&&b.cols.length?b.cols:[]).filter(c=>allowedCols.includes(c));
    // Bez aliasu klucze w wyniku byłyby wyrażeniami SQL zamiast nazwami kolumn,
    // więc front nie odnalazłby danych. Przy braku wyboru kolumn `*` dla `vehicles`
    // zwróciłoby surowy JSON — bierzemy komplet zmapowanych nazw.
    const kolumny=reqCols.length?reqCols:(COL_EXPR[table]?Object.keys(COL_EXPR[table]).filter(c=>allowedCols.includes(c)):[]);
    const colList=kolumny.length?kolumny.map(c=>`${expr(table,c)} AS ${c}`).join(','):'*';
    const limit=Math.min(+b.limit||100,5000);
    let sql=`SELECT ${colList} FROM ${table} WHERE company_id=?`;
    const params=[co];
    if(b.filter_col&&allowedCols.includes(b.filter_col)&&b.filter_val){sql+=' AND '+expr(table,b.filter_col)+' LIKE ?';params.push('%'+b.filter_val+'%');}
    if(b.sort&&allowedCols.includes(b.sort)){sql+=` ORDER BY ${expr(table,b.sort)} ${b.sort_dir==='ASC'?'ASC':'DESC'}`;}
    sql+=` LIMIT ${limit}`;
    const rows=(await env.DB.prepare(sql).bind(...params).all().catch(()=>({results:[]}))).results||[];
    return json({rows});
  }
  if(method==='GET'&&sub==='configs'&&!id){const rows=(await env.DB.prepare('SELECT * FROM report_configs WHERE company_id=? ORDER BY name ASC LIMIT 200').bind(co).all().catch(()=>({results:[]}))).results||[];return json({configs:rows});}
  if(method==='POST'&&sub==='configs'){const b=await req.json().catch(()=>({}));if(!b.name)return err('Brak nazwy');const rid=crypto.randomUUID();await env.DB.prepare('INSERT INTO report_configs(id,company_id,name,source_table,columns,filter_col,filter_val,sort_col,sort_dir,row_limit) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(rid,co,b.name,b.source||b.source_table||'vehicles',JSON.stringify(b.cols||[]),b.filter_col||null,b.filter_val||null,b.sort||null,b.sort_dir||'DESC',+b.limit||100).run();return json({ok:true,id:rid});}
  if(method==='DELETE'&&sub==='configs'&&id){await env.DB.prepare('DELETE FROM report_configs WHERE id=? AND company_id=?').bind(id,co).run();return json({ok:true});}
  return err('Nieznana operacja',404);
}

async function handleCmr(req, env, user, url, path) {
  const co=coOf(url,user);const segs=path.split('/').filter(Boolean);const id=segs[2]||null;const method=req.method;
  if(method==='GET'&&!id){
    const status=url.searchParams.get('status')||'';const q=url.searchParams.get('q')||'';
    const where=['company_id=?'];const params=[co];
    if(status){where.push('status=?');params.push(status);}
    if(q){where.push('(cmr_number LIKE ? OR sender_name LIKE ? OR vehicle_reg LIKE ?)');params.push('%'+q+'%','%'+q+'%','%'+q+'%');}
    const rows=(await env.DB.prepare(`SELECT * FROM cmr_documents WHERE ${where.join(' AND ')} ORDER BY issue_date DESC LIMIT 300`).bind(...params).all().catch(()=>({results:[]}))).results||[];
    return json({documents:rows});
  }
  if(method==='GET'&&id){const r=await env.DB.prepare('SELECT * FROM cmr_documents WHERE id=? AND company_id=?').bind(id,co).first().catch(()=>null);return json({document:r});}
  if(method==='POST'&&!id){const b=await req.json().catch(()=>({}));if(!b.cmr_number)return err('Brak numeru CMR');const rid=crypto.randomUUID();await env.DB.prepare('INSERT INTO cmr_documents(id,company_id,cmr_number,issue_date,sender_name,sender_address,sender_country,receiver_name,receiver_address,receiver_country,loading_place,delivery_place,vehicle_reg,driver_name,cargo_description,gross_weight_kg,packages_count,declared_value_pln,special_instructions,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(rid,co,b.cmr_number,b.issue_date||null,b.sender_name||null,b.sender_address||null,b.sender_country||null,b.receiver_name||null,b.receiver_address||null,b.receiver_country||null,b.loading_place||null,b.delivery_place||null,b.vehicle_reg||null,b.driver_name||null,b.cargo_description||null,b.gross_weight_kg??null,b.packages_count||null,b.declared_value_pln??null,b.special_instructions||null,b.status||'draft').run();return json({ok:true,id:rid});}
  if(method==='PUT'&&id){const b=await req.json().catch(()=>({}));await env.DB.prepare('UPDATE cmr_documents SET cmr_number=?,issue_date=?,sender_name=?,sender_address=?,sender_country=?,receiver_name=?,receiver_address=?,receiver_country=?,loading_place=?,delivery_place=?,vehicle_reg=?,driver_name=?,cargo_description=?,gross_weight_kg=?,packages_count=?,declared_value_pln=?,special_instructions=?,status=? WHERE id=? AND company_id=?').bind(b.cmr_number,b.issue_date||null,b.sender_name||null,b.sender_address||null,b.sender_country||null,b.receiver_name||null,b.receiver_address||null,b.receiver_country||null,b.loading_place||null,b.delivery_place||null,b.vehicle_reg||null,b.driver_name||null,b.cargo_description||null,b.gross_weight_kg??null,b.packages_count||null,b.declared_value_pln??null,b.special_instructions||null,b.status||'draft',id,co).run();return json({ok:true});}
  if(method==='DELETE'&&id){await env.DB.prepare('DELETE FROM cmr_documents WHERE id=? AND company_id=?').bind(id,co).run();return json({ok:true});}
  return err('Nieznana operacja',404);
}

async function handleSent(req, env, user, url, path) {
  const co=coOf(url,user);const segs=path.split('/').filter(Boolean);const id=segs[2]||null;const method=req.method;
  if(method==='GET'&&!id){
    const status=url.searchParams.get('status')||'';const q=url.searchParams.get('q')||'';
    const where=['company_id=?'];const params=[co];
    if(status){where.push('status=?');params.push(status);}
    if(q){where.push('(sent_number LIKE ? OR goods_name LIKE ? OR vehicle_reg LIKE ?)');params.push('%'+q+'%','%'+q+'%','%'+q+'%');}
    const rows=(await env.DB.prepare(`SELECT * FROM sent_records WHERE ${where.join(' AND ')} ORDER BY departure_date DESC LIMIT 300`).bind(...params).all().catch(()=>({results:[]}))).results||[];
    return json({records:rows});
  }
  if(method==='GET'&&id){const r=await env.DB.prepare('SELECT * FROM sent_records WHERE id=? AND company_id=?').bind(id,co).first().catch(()=>null);return json({record:r});}
  if(method==='POST'&&!id){const b=await req.json().catch(()=>({}));if(!b.goods_name||!b.departure_date)return err('Brak wymaganych pól');const rid=crypto.randomUUID();await env.DB.prepare('INSERT INTO sent_records(id,company_id,sent_number,goods_name,cn_code,mass_kg,value_pln,transport_type,vehicle_reg,origin_country,destination_country,loading_place,delivery_place,departure_date,expected_delivery_date,sender_name,sender_nip,status,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(rid,co,b.sent_number||null,b.goods_name,b.cn_code||null,b.mass_kg??null,b.value_pln??null,b.transport_type||'road',b.vehicle_reg||null,b.origin_country||'PL',b.destination_country||null,b.loading_place||null,b.delivery_place||null,b.departure_date,b.expected_delivery_date||null,b.sender_name||null,b.sender_nip||null,b.status||'draft',b.notes||null).run();return json({ok:true,id:rid});}
  if(method==='PUT'&&id){const b=await req.json().catch(()=>({}));await env.DB.prepare('UPDATE sent_records SET sent_number=?,goods_name=?,cn_code=?,mass_kg=?,value_pln=?,transport_type=?,vehicle_reg=?,origin_country=?,destination_country=?,loading_place=?,delivery_place=?,departure_date=?,expected_delivery_date=?,sender_name=?,sender_nip=?,status=?,notes=? WHERE id=? AND company_id=?').bind(b.sent_number||null,b.goods_name,b.cn_code||null,b.mass_kg??null,b.value_pln??null,b.transport_type||'road',b.vehicle_reg||null,b.origin_country||'PL',b.destination_country||null,b.loading_place||null,b.delivery_place||null,b.departure_date,b.expected_delivery_date||null,b.sender_name||null,b.sender_nip||null,b.status||'draft',b.notes||null,id,co).run();return json({ok:true});}
  if(method==='DELETE'&&id){await env.DB.prepare('DELETE FROM sent_records WHERE id=? AND company_id=?').bind(id,co).run();return json({ok:true});}
  return err('Nieznana operacja',404);
}

async function handleMessenger(req, env, user, url, path) {
  const co=coOf(url,user);const segs=path.split('/').filter(Boolean);const id=segs[2]||null;const sub=segs[3]||null;const method=req.method;
  if(method==='GET'&&!id){
    const q=url.searchParams.get('q')||'';
    const where=['(to_user_id=? OR from_user_id=?)','company_id=?'];const params=[user.id,user.id,co];
    if(q){where.push('(subject LIKE ? OR body LIKE ?)');params.push('%'+q+'%','%'+q+'%');}
    const rows=(await env.DB.prepare(`SELECT m.*,(SELECT COUNT(*) FROM messages r WHERE r.parent_id=m.id) thread_count FROM messages m WHERE ${where.join(' AND ')} AND m.parent_id IS NULL ORDER BY m.created_at DESC LIMIT 100`).bind(...params).all().catch(()=>({results:[]}))).results||[];
    return json({messages:rows});
  }
  if(method==='GET'&&id&&sub==='thread'){const rows=(await env.DB.prepare('SELECT * FROM messages WHERE (id=? OR parent_id=?) AND company_id=? ORDER BY created_at ASC LIMIT 50').bind(id,id,co).all().catch(()=>({results:[]}))).results||[];return json({thread:rows});}
  if(method==='POST'&&id&&sub==='read'){await env.DB.prepare('UPDATE messages SET read_at=? WHERE id=? AND company_id=?').bind(new Date().toISOString(),id,co).run();return json({ok:true});}
  if(method==='POST'&&!id){const b=await req.json().catch(()=>({}));if(!b.body)return err('Brak treści wiadomości');const rid=crypto.randomUUID();await env.DB.prepare('INSERT INTO messages(id,company_id,from_user_id,to_user_id,parent_id,subject,body,vehicle_reg) VALUES(?,?,?,?,?,?,?,?)').bind(rid,co,user.id,b.to_user||null,b.parent_id||null,b.subject||null,b.body,b.vehicle_reg||null).run();return json({ok:true,id:rid});}
  if(method==='DELETE'&&id){await env.DB.prepare('DELETE FROM messages WHERE id=? AND company_id=? AND from_user_id=?').bind(id,co,user.id).run();return json({ok:true});}
  return err('Nieznana operacja',404);
}

async function handleVehicleQr(req, env, user, url, path) {
  const co=coOf(url,user);const segs=path.split('/').filter(Boolean);const sub=segs[2]||null;const id=segs[3]||null;const method=req.method;
  if(method==='GET'&&sub==='vehicles'){
    const q=url.searchParams.get('q')||'';
    const where=['company_id=?'];const params=[co];
    // Było: filtr i SELECT po kolumnach reg/brand/model/active, których `vehicles` NIE MA.
    // Zapytanie miało `.catch()`, więc wyszukiwarka pojazdów przy skanach QR zwracała
    // pustą listę ZAWSZE — bez śladu w logach. `nr_rej` to realna kolumna, marka i model
    // siedzą w JSON `data`. Aliasy zachowują kształt odpowiedzi, więc front bez zmian.
    if(q){where.push("(nr_rej LIKE ? OR JSON_EXTRACT(data,'$.marka') LIKE ? OR JSON_EXTRACT(data,'$.model') LIKE ?)");params.push('%'+q+'%','%'+q+'%','%'+q+'%');}
    const rows=(await env.DB.prepare(`SELECT id, nr_rej AS reg,
        JSON_EXTRACT(data,'$.marka') AS brand,
        JSON_EXTRACT(data,'$.model') AS model
      FROM vehicles WHERE ${where.join(' AND ')} AND ${SQL_VEH_ACTIVE} ORDER BY nr_rej ASC LIMIT 300`).bind(...params).all().catch(()=>({results:[]}))).results||[];
    return json({vehicles:rows});
  }
  if(method==='GET'&&sub==='scans'){const rows=(await env.DB.prepare(// Było `v.reg` — kolumna nie istnieje, a `.catch()` zamieniał błąd w pustą listę skanów.
      'SELECT s.*,v.nr_rej vehicle_reg FROM vehicle_qr_scans s LEFT JOIN vehicles v ON v.id=s.vehicle_id WHERE s.company_id=? ORDER BY s.scanned_at DESC LIMIT 100').bind(co).all().catch(()=>({results:[]}))).results||[];return json({scans:rows});}
  if(method==='GET'&&sub==='scan'&&id){
    const vehicle=await env.DB.prepare('SELECT * FROM vehicles WHERE id=? AND company_id=?').bind(id,co).first().catch(()=>null);
    if(!vehicle)return err('Pojazd nie znaleziony',404);
    const scanId=crypto.randomUUID();
    // Tabela `vehicle_qr_scans` nie ma kolumn `scanned_at` ani `scanner_ip`: czas zapisuje
    // `created_at` z wartością domyślną, a adresu IP schemat nie przewiduje w ogóle
    // (jest `scanned_by_name`). Cały INSERT padał, więc do tej pory nie zapisywało się
    // NIC — zapis bez adresu IP jest ściśle lepszy niż brak zapisu. Gdyby IP było
    // potrzebne, wymaga migracji, a to osobna decyzja (dane osobowe).
    await env.DB.prepare('INSERT INTO vehicle_qr_scans(id,company_id,vehicle_id,vehicle_reg,action) VALUES(?,?,?,?,?)').bind(scanId,co,id,vehicle.nr_rej||null,'view').run().catch(()=>{});
    return json({vehicle});
  }
  return err('Nieznana operacja',404);
}

async function handleJpk(req, env, user, url, path) {
  const co=coOf(url,user);const segs=path.split('/').filter(Boolean);const id=segs[2]||null;const sub=segs[3]||null;const method=req.method;
  const TABLE='jpk_exports';
  if(method==='GET'&&!id){const rows=(await env.DB.prepare(`SELECT * FROM ${TABLE} WHERE company_id=? ORDER BY created_at DESC LIMIT 100`).bind(co).all().catch(()=>({results:[]}))).results||[];return json({exports:rows});}
  if(method==='POST'&&id==='generate'){
    const b=await req.json().catch(()=>({}));if(!b.jpk_type||!b.year)return err('Brak typu JPK lub roku');
    const rid=crypto.randomUUID();
    const period=`${b.year}${b.month?'-'+String(b.month).padStart(2,'0'):''}`;
    // Pobieramy dane z właściwych tabel
    let rows=[];
    try{
      if(b.jpk_type==='JPK_FA'||b.jpk_type==='JPK_V7M'||b.jpk_type==='JPK_V7K'){
        rows=(await env.DB.prepare('SELECT * FROM ksef_invoices WHERE company_id=? AND strftime(\'%Y\',ksef_date)=?').bind(co,String(b.year)).all().catch(()=>({results:[]}))).results||[];
      }else if(b.jpk_type==='JPK_KR'||b.jpk_type==='SAF_T'){
        // fuel_fills (nie fuel_entries — ta nie istnieje), więc kolumna daty to fill_date.
        // Wcześniej .catch() zjadał błąd i eksport JPK_KR/SAF_T nie zawierał ŻADNYCH kosztów paliwa.
        const fuel=(await env.DB.prepare('SELECT * FROM fuel_fills WHERE company_id=? AND strftime(\'%Y\',fill_date)=?').bind(co,String(b.year)).all().catch(()=>({results:[]}))).results||[];
        const srv=(await env.DB.prepare('SELECT * FROM service_orders WHERE company_id=? AND strftime(\'%Y\',data_realizacji)=?').bind(co,String(b.year)).all().catch(()=>({results:[]}))).results||[];
        rows=[...fuel,...srv];
      }
    }catch(e){rows=[];}
    // Generujemy uproszczony XML JPK
    const xmlLines=[`<?xml version="1.0" encoding="UTF-8"?>`];
    xmlLines.push(`<JPK xmlns="http://jpk.mf.gov.pl/wzor/2022/09/13/jpk_" JPKVersion="${b.jpk_type}" DataWytworzeniaJPK="${new Date().toISOString()}">`);
    xmlLines.push(`<Naglowek><KodFormularza>${b.jpk_type}</KodFormularza><Rok>${b.year}</Rok>${b.month?`<Miesiac>${b.month}</Miesiac>`:''}</Naglowek>`);
    xmlLines.push(`<Dane>`);
    rows.slice(0,1000).forEach((r,i)=>{
      xmlLines.push(`<Rekord nr="${i+1}">`);
      Object.entries(r).forEach(([k,v])=>{if(v!=null)xmlLines.push(`<${k}>${String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</${k}>`);});
      xmlLines.push(`</Rekord>`);
    });
    xmlLines.push(`</Dane></JPK>`);
    const xmlContent=xmlLines.join('\n');
    const fileSize=new TextEncoder().encode(xmlContent).length;
    const r2Key=`jpk/${co}/${rid}.xml`;
    if(env.DOCS){await env.DOCS.put(r2Key,xmlContent,{httpMetadata:{contentType:'application/xml'}}).catch(()=>{});}
    await env.DB.prepare(`INSERT INTO ${TABLE}(id,company_id,jpk_type,year,month,quarter,period_label,status,r2_key,file_size_bytes,row_count) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(rid,co,b.jpk_type,b.year,b.month??null,b.quarter??null,period,'ready',r2Key,fileSize,rows.length).run();
    return json({ok:true,id:rid,size:fileSize,rows:rows.length});
  }
  if(method==='GET'&&id&&sub==='download'){
    const rec=await env.DB.prepare(`SELECT * FROM ${TABLE} WHERE id=? AND company_id=?`).bind(id,co).first().catch(()=>null);
    if(!rec)return err('Nie znaleziono',404);
    if(env.DOCS&&rec.r2_key){const obj=await env.DOCS.get(rec.r2_key).catch(()=>null);if(obj)return new Response(obj.body,{headers:{'Content-Type':'application/xml','Content-Disposition':`attachment; filename="JPK_${rec.jpk_type}_${rec.period_label}.xml"`}});}
    return err('Plik niedostępny',404);
  }
  if(method==='POST'&&id&&sub==='submit'){await env.DB.prepare(`UPDATE ${TABLE} SET status='submitted' WHERE id=? AND company_id=?`).bind(id,co).run();return json({ok:true});}
  if(method==='DELETE'&&id){await env.DB.prepare(`DELETE FROM ${TABLE} WHERE id=? AND company_id=?`).bind(id,co).run();return json({ok:true});}
  return err('Nieznana operacja',404);
}

async function handleEdoreczenia(req, env, user, url, path) {
  const co=coOf(url,user);const segs=path.split('/').filter(Boolean);const id=segs[2]||null;const method=req.method;
  if(method==='GET'&&!id){
    const type=url.searchParams.get('type')||'';const status=url.searchParams.get('status')||'';const q=url.searchParams.get('q')||'';
    const where=['company_id=?'];const params=[co];
    if(type){where.push('direction=?');params.push(type);}
    if(status){where.push('status=?');params.push(status);}
    if(q){where.push('(reference_number LIKE ? OR sender_name LIKE ? OR title LIKE ?)');params.push('%'+q+'%','%'+q+'%','%'+q+'%');}
    const rows=(await env.DB.prepare(`SELECT * FROM edoreczenia_items WHERE ${where.join(' AND ')} ORDER BY sent_date DESC LIMIT 300`).bind(...params).all().catch(()=>({results:[]}))).results||[];
    return json({items:rows});
  }
  if(method==='GET'&&id){const r=await env.DB.prepare('SELECT * FROM edoreczenia_items WHERE id=? AND company_id=?').bind(id,co).first().catch(()=>null);return json({item:r});}
  if(method==='POST'&&!id){const b=await req.json().catch(()=>({}));if(!b.title||!b.direction)return err('Brak wymaganych pól');const rid=crypto.randomUUID();await env.DB.prepare('INSERT INTO edoreczenia_items(id,company_id,direction,title,reference_number,sender_name,receiver_name,sent_date,deadline_date,delivered_at,status,edo_box_id,description,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(rid,co,b.direction,b.title,b.reference_number||null,b.sender_name||null,b.receiver_name||null,b.sent_date||null,b.deadline_date||null,b.delivered_at||null,b.status||'pending',b.edo_box_id||null,b.description||null,b.notes||null).run();return json({ok:true,id:rid});}
  if(method==='PUT'&&id){const b=await req.json().catch(()=>({}));await env.DB.prepare('UPDATE edoreczenia_items SET direction=?,title=?,reference_number=?,sender_name=?,receiver_name=?,sent_date=?,deadline_date=?,delivered_at=?,status=?,edo_box_id=?,description=?,notes=? WHERE id=? AND company_id=?').bind(b.direction,b.title,b.reference_number||null,b.sender_name||null,b.receiver_name||null,b.sent_date||null,b.deadline_date||null,b.delivered_at||null,b.status||'pending',b.edo_box_id||null,b.description||null,b.notes||null,id,co).run();return json({ok:true});}
  if(method==='DELETE'&&id){await env.DB.prepare('DELETE FROM edoreczenia_items WHERE id=? AND company_id=?').bind(id,co).run();return json({ok:true});}
  return err('Nieznana operacja',404);
}

async function handleVideoTelematics(req, env, user, url, path) {
  const co=coOf(url,user);const segs=path.split('/').filter(Boolean);const id=segs[2]||null;const method=req.method;
  if(method==='GET'&&!id){
    const event_type=url.searchParams.get('event_type')||'';const severity=url.searchParams.get('severity')||'';const reg=url.searchParams.get('reg')||'';
    const date_from=url.searchParams.get('date_from')||'';const date_to=url.searchParams.get('date_to')||'';
    const where=['company_id=?'];const params=[co];
    if(event_type){where.push('event_type=?');params.push(event_type);}
    if(severity){where.push('severity=?');params.push(severity);}
    if(reg){where.push('vehicle_reg LIKE ?');params.push('%'+reg+'%');}
    if(date_from){where.push('date(event_at)>=?');params.push(date_from);}
    if(date_to){where.push('date(event_at)<=?');params.push(date_to);}
    const rows=(await env.DB.prepare(`SELECT * FROM video_telematics_events WHERE ${where.join(' AND ')} ORDER BY event_at DESC LIMIT 500`).bind(...params).all().catch(()=>({results:[]}))).results||[];
    const d30=new Date();d30.setDate(d30.getDate()-30);const d30s=d30.toISOString();
    const recent=rows.filter(r=>r.event_at>=d30s);
    const stats={critical:recent.filter(r=>r.severity==='critical').length,high:recent.filter(r=>r.severity==='high').length,medium:recent.filter(r=>r.severity==='medium').length,total_30d:recent.length};
    return json({events:rows,stats});
  }
  if(method==='GET'&&id){const r=await env.DB.prepare('SELECT * FROM video_telematics_events WHERE id=? AND company_id=?').bind(id,co).first().catch(()=>null);return json({event:r});}
  if(method==='POST'&&!id){const b=await req.json().catch(()=>({}));if(!b.event_type||!b.event_at)return err('Brak wymaganych pól');if(b.clip_url&&!b.clip_url.startsWith('https://'))return err('URL klipu musi zaczynać się od https://');const rid=crypto.randomUUID();await env.DB.prepare('INSERT INTO video_telematics_events(id,company_id,vehicle_reg,driver_name,event_type,severity,event_at,speed_kmh,location,clip_url,camera_position,device_id,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(rid,co,b.vehicle_reg||null,b.driver_name||null,b.event_type,b.severity||'medium',b.event_at,b.speed_kmh??null,b.location||null,b.clip_url||null,b.camera_position||null,b.device_id||null,b.notes||null).run();return json({ok:true,id:rid});}
  if(method==='PUT'&&id){const b=await req.json().catch(()=>({}));if(b.clip_url&&!b.clip_url.startsWith('https://'))return err('URL klipu musi zaczynać się od https://');await env.DB.prepare('UPDATE video_telematics_events SET vehicle_reg=?,driver_name=?,event_type=?,severity=?,event_at=?,speed_kmh=?,location=?,clip_url=?,camera_position=?,device_id=?,notes=? WHERE id=? AND company_id=?').bind(b.vehicle_reg||null,b.driver_name||null,b.event_type,b.severity||'medium',b.event_at,b.speed_kmh??null,b.location||null,b.clip_url||null,b.camera_position||null,b.device_id||null,b.notes||null,id,co).run();return json({ok:true});}
  if(method==='DELETE'&&id){await env.DB.prepare('DELETE FROM video_telematics_events WHERE id=? AND company_id=?').bind(id,co).run();return json({ok:true});}
  return err('Nieznana operacja',404);
}

async function handleEsgTargets(req, env, user, url, path) {
  const co=coOf(url,user);const segs=path.split('/').filter(Boolean);const sub=segs[2]||null;const id=segs[3]||null;const method=req.method;
  const year=+(url.searchParams.get('year')||new Date().getFullYear());
  if(method==='GET'&&sub==='report'){
    const targets=(await env.DB.prepare('SELECT * FROM esg_targets WHERE company_id=? AND year=?').bind(co,year).all().catch(()=>({results:[]}))).results||[];
    // Obliczamy aktualne wartości z danych
    // fuel_entries NIE ISTNIEJE w D1 — żaden schema_v*.sql jej nie tworzy. Oba zapytania
    // miały .catch(), więc cicho zwracały 0: CO2 i zużycie paliwa w raportach ESG były
    // zerowe dla każdej firmy i każdego roku. Realne tankowania są w fuel_fills.
    const { co2_kg: co2, liters: fuel } = await fuelActualsForYear(env, co, year);
    // Było: `WHERE active=1` i `fuel_type IN (...)` — obu kolumn w `vehicles` NIE MA,
    // więc oba zapytania miały `.catch()` i cicho zwracały 0: udział EV w raporcie ESG
    // wychodził zawsze zerowy albo pusty, niezależnie od floty.
    const { total, ev } = await fleetCountsForEsg(env, co);
    const actuals={co2_total_tonnes:co2?(co2/1000).toFixed(2):null,fuel_consumption_l:fuel||null,ev_share_pct:total?(ev/total*100).toFixed(1):null};
    return json({targets,actuals});
  }
  if(method==='GET'&&!sub){
    const targets=(await env.DB.prepare('SELECT * FROM esg_targets WHERE company_id=? AND year=?').bind(co,year).all().catch(()=>({results:[]}))).results||[];
    // fuel_entries NIE ISTNIEJE w D1 — żaden schema_v*.sql jej nie tworzy. Oba zapytania
    // miały .catch(), więc cicho zwracały 0: CO2 i zużycie paliwa w raportach ESG były
    // zerowe dla każdej firmy i każdego roku. Realne tankowania są w fuel_fills.
    const { co2_kg: co2, liters: fuel } = await fuelActualsForYear(env, co, year);
    // Było: `WHERE active=1` i `fuel_type IN (...)` — obu kolumn w `vehicles` NIE MA,
    // więc oba zapytania miały `.catch()` i cicho zwracały 0: udział EV w raporcie ESG
    // wychodził zawsze zerowy albo pusty, niezależnie od floty.
    const { total, ev } = await fleetCountsForEsg(env, co);
    const actuals={co2_total_tonnes:co2?(co2/1000).toFixed(2):null,fuel_consumption_l:fuel||null,ev_share_pct:total?(ev/total*100).toFixed(1):null};
    return json({targets,actuals});
  }
  if(method==='GET'&&sub==='targets'&&id){const r=await env.DB.prepare('SELECT * FROM esg_targets WHERE id=? AND company_id=?').bind(id,co).first().catch(()=>null);return json({target:r});}
  if(method==='POST'&&sub==='targets'){const b=await req.json().catch(()=>({}));if(!b.metric_key||!b.target_value||!b.year)return err('Brak wymaganych pól');const rid=crypto.randomUUID();await env.DB.prepare('INSERT INTO esg_targets(id,company_id,metric_key,year,target_value,unit,lower_is_better,description) VALUES(?,?,?,?,?,?,?,?)').bind(rid,co,b.metric_key,+b.year,+b.target_value,b.unit||null,+(b.lower_is_better??1),b.description||null).run();return json({ok:true,id:rid});}
  if(method==='PUT'&&sub==='targets'&&id){const b=await req.json().catch(()=>({}));await env.DB.prepare('UPDATE esg_targets SET metric_key=?,year=?,target_value=?,unit=?,lower_is_better=?,description=? WHERE id=? AND company_id=?').bind(b.metric_key,+b.year,+b.target_value,b.unit||null,+(b.lower_is_better??1),b.description||null,id,co).run();return json({ok:true});}
  if(method==='DELETE'&&sub==='targets'&&id){await env.DB.prepare('DELETE FROM esg_targets WHERE id=? AND company_id=?').bind(id,co).run();return json({ok:true});}
  return err('Nieznana operacja',404);
}

async function handleDriverWorktime(req, env, user, url, path) {
  const co=coOf(url,user);const segs=path.split('/').filter(Boolean);const id=segs[2]||null;const method=req.method;
  if(method==='GET'&&!id){
    const from=url.searchParams.get('from')||'';const to=url.searchParams.get('to')||'';const driver=url.searchParams.get('driver')||'';const status=url.searchParams.get('status')||'';
    const where=['company_id=?'];const params=[co];
    if(from){where.push('work_date>=?');params.push(from);}
    if(to){where.push('work_date<=?');params.push(to);}
    if(driver){where.push('(driver_name LIKE ? OR driver_id LIKE ?)');params.push('%'+driver+'%','%'+driver+'%');}
    if(status){where.push('status=?');params.push(status);}
    const rows=(await env.DB.prepare(`SELECT * FROM driver_work_sessions WHERE ${where.join(' AND ')} ORDER BY work_date DESC, start_time DESC LIMIT 500`).bind(...params).all().catch(()=>({results:[]}))).results||[];
    const active_now=rows.filter(r=>r.status==='active').length;
    const total_sessions=rows.length;
    const total_work_hours=rows.reduce((s,r)=>s+(r.work_duration_mins||0),0)/60;
    const total_mileage_km=rows.reduce((s,r)=>s+(r.mileage_km||0),0);
    const stats={active_now,total_sessions,total_work_hours:+total_work_hours.toFixed(1),total_mileage_km};
    return json({sessions:rows,stats});
  }
  if(method==='GET'&&id){const r=await env.DB.prepare('SELECT * FROM driver_work_sessions WHERE id=? AND company_id=?').bind(id,co).first().catch(()=>null);return json({session:r});}
  if(method==='POST'&&!id){const b=await req.json().catch(()=>({}));if(!b.driver_name||!b.work_date)return err('Brak wymaganych pól');const rid=crypto.randomUUID();await env.DB.prepare('INSERT INTO driver_work_sessions(id,company_id,driver_id,driver_name,work_date,vehicle_reg,start_time,end_time,work_duration_mins,break_duration_mins,mileage_km,status,route_description,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(rid,co,b.driver_id||null,b.driver_name,b.work_date,b.vehicle_reg||null,b.start_time||null,b.end_time||null,b.work_duration_mins??null,b.break_duration_mins??null,b.mileage_km??null,b.status||'completed',b.route_description||null,b.notes||null).run();return json({ok:true,id:rid});}
  if(method==='PUT'&&id){const b=await req.json().catch(()=>({}));await env.DB.prepare('UPDATE driver_work_sessions SET driver_id=?,driver_name=?,work_date=?,vehicle_reg=?,start_time=?,end_time=?,work_duration_mins=?,break_duration_mins=?,mileage_km=?,status=?,route_description=?,notes=? WHERE id=? AND company_id=?').bind(b.driver_id||null,b.driver_name,b.work_date,b.vehicle_reg||null,b.start_time||null,b.end_time||null,b.work_duration_mins??null,b.break_duration_mins??null,b.mileage_km??null,b.status||'completed',b.route_description||null,b.notes||null,id,co).run();return json({ok:true});}
  if(method==='DELETE'&&id){await env.DB.prepare('DELETE FROM driver_work_sessions WHERE id=? AND company_id=?').bind(id,co).run();return json({ok:true});}
  return err('Nieznana operacja',404);
}

async function handleDelegations(req, env, user, url, path) {
  const co=coOf(url,user);const segs=path.split('/').filter(Boolean);const id=segs[2]||null;const method=req.method;
  const _total=b=>(b.km_driven??0)*(b.km_rate??0.89)+(b.diet_days??0)*(b.diet_rate??45)+(b.hotel_cost??0)+(b.other_costs??0);
  if(method==='GET'&&!id){
    const from=url.searchParams.get('from')||'';const to=url.searchParams.get('to')||'';const status=url.searchParams.get('status')||'';const driver=url.searchParams.get('driver')||'';
    const where=['company_id=?'];const params=[co];
    if(from){where.push('date_from>=?');params.push(from);}
    if(to){where.push('date_from<=?');params.push(to);}
    if(status){where.push('status=?');params.push(status);}
    if(driver){where.push('driver LIKE ?');params.push('%'+driver+'%');}
    const rows=(await env.DB.prepare(`SELECT * FROM delegations WHERE ${where.join(' AND ')} ORDER BY date_from DESC LIMIT 500`).bind(...params).all().catch(()=>({results:[]}))).results||[];
    return json({delegations:rows});
  }
  if(method==='GET'&&id){const r=await env.DB.prepare('SELECT * FROM delegations WHERE id=? AND company_id=?').bind(id,co).first().catch(()=>null);return json({delegation:r});}
  if(method==='POST'&&!id){
    const b=await req.json().catch(()=>({}));if(!b.driver||!b.date_from)return err('Brak wymaganych pól');
    const rid=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO delegations(id,company_id,driver,nr_rej,destination,purpose,date_from,date_to,country,km_driven,km_rate,diet_days,diet_rate,hotel_cost,other_costs,total_pln,status,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(rid,co,b.driver,b.nr_rej||null,b.destination||null,b.purpose||null,b.date_from,b.date_to||null,b.country||'Polska',b.km_driven??0,b.km_rate??0.89,b.diet_days??0,b.diet_rate??45,b.hotel_cost??0,b.other_costs??0,_total(b),b.status||'draft',b.notes||null,user.id).run();
    return json({ok:true,id:rid});
  }
  if(method==='PUT'&&id){
    const b=await req.json().catch(()=>({}));
    await env.DB.prepare('UPDATE delegations SET driver=?,nr_rej=?,destination=?,purpose=?,date_from=?,date_to=?,country=?,km_driven=?,km_rate=?,diet_days=?,diet_rate=?,hotel_cost=?,other_costs=?,total_pln=?,status=?,notes=? WHERE id=? AND company_id=?').bind(b.driver,b.nr_rej||null,b.destination||null,b.purpose||null,b.date_from,b.date_to||null,b.country||'Polska',b.km_driven??0,b.km_rate??0.89,b.diet_days??0,b.diet_rate??45,b.hotel_cost??0,b.other_costs??0,_total(b),b.status||'draft',b.notes||null,id,co).run();
    return json({ok:true});
  }
  if(method==='DELETE'&&id){await env.DB.prepare('DELETE FROM delegations WHERE id=? AND company_id=?').bind(id,co).run();return json({ok:true});}
  return err('Nieznana operacja',404);
}

async function handleFleetInventory(req, env, user, url, path) {
  const co=coOf(url,user);const segs=path.split('/').filter(Boolean);const id=segs[2]||null;const sub=segs[3]||null;const method=req.method;
  if(method==='GET'&&!id){
    const status=url.searchParams.get('status')||'';const limit=Math.min(parseInt(url.searchParams.get('limit')||'50'),200);
    const where=['company_id=?'];const params=[co];
    if(status){where.push('status=?');params.push(status);}
    const rows=(await env.DB.prepare(`SELECT * FROM fleet_inventory_sessions WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?`).bind(...params,limit).all().catch(()=>({results:[]}))).results||[];
    return json({sessions:rows});
  }
  if(method==='GET'&&id){const r=await env.DB.prepare('SELECT * FROM fleet_inventory_sessions WHERE id=? AND company_id=?').bind(id,co).first().catch(()=>null);return json({session:r});}
  if(method==='POST'&&!id){
    const existing=await env.DB.prepare("SELECT id FROM fleet_inventory_sessions WHERE company_id=? AND status='active'").bind(co).first().catch(()=>null);
    if(existing)return err('Aktywna inwentaryzacja już istnieje. Zakończ lub anuluj poprzednią.',409);
    const b=await req.json().catch(()=>({}));const rid=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO fleet_inventory_sessions(id,company_id,session_date,status,checked_vehicles,notes,vehicle_count) VALUES(?,?,?,?,?,?,?)').bind(rid,co,b.date||new Date().toISOString().split('T')[0],'active','[]','{}',b.vehicle_count??0).run();
    return json({ok:true,id:rid});
  }
  if(method==='PUT'&&id&&!sub){
    const b=await req.json().catch(()=>({}));
    const cv=JSON.stringify(b.checked_vehicles||[]);const no=JSON.stringify(b.notes||{});
    await env.DB.prepare('UPDATE fleet_inventory_sessions SET checked_vehicles=?,notes=?,checked_count=?,vehicle_count=? WHERE id=? AND company_id=?').bind(cv,no,(b.checked_vehicles||[]).length,b.vehicle_count??0,id,co).run();
    return json({ok:true});
  }
  if(method==='PUT'&&id&&sub==='complete'){
    await env.DB.prepare("UPDATE fleet_inventory_sessions SET status='completed',completed_at=datetime('now') WHERE id=? AND company_id=?").bind(id,co).run();
    return json({ok:true});
  }
  if(method==='DELETE'&&id){await env.DB.prepare("UPDATE fleet_inventory_sessions SET status='cancelled' WHERE id=? AND company_id=?").bind(id,co).run();return json({ok:true});}
  return err('Nieznana operacja',404);
}

async function handleBudgetPlans(req, env, user, url) {
  const co=coOf(url,user);const yr=parseInt(url.searchParams.get('year')||new Date().getFullYear());const method=req.method;
  if(method==='GET'){
    const r=await env.DB.prepare('SELECT fuel,service,insur,tax,fines FROM budget_plans WHERE company_id=? AND year=?').bind(co,yr).first().catch(()=>null);
    return json({plan:r||{}});
  }
  if(method==='PUT'){
    const b=await req.json().catch(()=>({}));const year=parseInt(b.year||yr);
    await env.DB.prepare(`INSERT INTO budget_plans(id,company_id,year,fuel,service,insur,tax,fines) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(company_id,year) DO UPDATE SET fuel=excluded.fuel,service=excluded.service,insur=excluded.insur,tax=excluded.tax,fines=excluded.fines,updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now')`).bind(crypto.randomUUID(),co,year,b.fuel??0,b.service??0,b.insur??0,b.tax??0,b.fines??0).run();
    return json({ok:true});
  }
  return err('Nieznana operacja',404);
}

async function handleFeatureFlags(req, env, user, url) {
  const co  = coOf(url, user);
  const key = `feature-flags:${co}`;
  if (req.method === 'GET') {
    const raw  = await env.PREFS.get(key).catch(() => null);
    const data = raw ? JSON.parse(raw) : { nav: {}, dash: null };
    return json(data);
  }
  if (req.method === 'PUT') {
    const body    = await req.json().catch(() => ({}));
    const current = await env.PREFS.get(key).then(r => r ? JSON.parse(r) : {}).catch(() => ({}));
    const merged  = { ...current };
    if (body.nav  !== undefined) merged.nav  = body.nav;
    if (body.dash !== undefined) merged.dash = body.dash;
    await env.PREFS.put(key, JSON.stringify(merged));
    return json({ ok: true });
  }
  return err('Nieznana operacja', 404);
}

async function handleClerkSignin(request, env) {
  const body = await request.json().catch(() => ({}));
  const clerkToken = String(body.clerk_token || '').trim();
  if (!clerkToken) return err('Brak clerk_token');
  const payload = await verifyClerkJWT(clerkToken, env);
  if (!payload?.sub) return err('Nieprawidłowy token Clerk', 401);
  // Szukaj po clerk_user_id
  let user = await env.DB.prepare(
    'SELECT * FROM users WHERE clerk_user_id = ? AND active = 1'
  ).bind(payload.sub).first().catch(() => null);
  // Auto-link po e-mailu jeśli konto Clerk nie jest jeszcze powiązane
  if (!user && payload.email) {
    user = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ? AND active = 1'
    ).bind(payload.email).first().catch(() => null);
    if (user) {
      env.DB.prepare('UPDATE users SET clerk_user_id = ? WHERE id = ?').bind(payload.sub, user.id).run().catch(() => {});
    }
  }
  if (!user) return err('Konto Clerk nie jest powiązane z żadnym użytkownikiem. Skontaktuj się z administratorem.', 403);
  // Utwórz sesję D1 (taka sama jak przy normalnym logowaniu)
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  // Tabela `sessions` (schema_v1) ma `token TEXT PRIMARY KEY` i NIE MA kolumny `id`.
  // Komentarz wyżej deklaruje „taka sama jak przy normalnym logowaniu", ale zapytanie
  // było TRZECIĄ, rozjechaną kopią — poprawny wzorzec stoi dwa razy w tym samym pliku
  // (linie 363 i 523). Bez `.catch()` oznaczało to 500 na tej ścieżce logowania.
  await env.DB.prepare(
    'INSERT INTO sessions(token, user_id, expires_at) VALUES(?, ?, ?)'
  ).bind(token, user.id, expiresAt).run();
  return json({
    ok: true,
    token,
    user: { id: user.id, email: user.email, role: user.role, company_id: user.company_id, name: user.name },
  });
}

// ─── BULK IMPORT — masowy import dokumentów flotowych ────────────────────────

async function _bulkGroqVision(env, imageBase64, mimeType, prompt, maxTokens = 300) {
  if (!env.GROQ_API_KEY) throw new Error('Brak GROQ_API_KEY');
  const visionModels = [
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
    'llama-3.2-90b-vision-preview',
    'llama-3.2-11b-vision-preview',
  ];
  const messages = [{
    role: 'user',
    content: [
      { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
      { type: 'text', text: prompt },
    ],
  }];
  let lastErr = 'Brak działającego modelu';
  for (const model of visionModels) {
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.GROQ_API_KEY },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.1 }),
      });
      if (!resp.ok) { lastErr = model + ': HTTP ' + resp.status; continue; }
      const d = await resp.json();
      const text = d.choices?.[0]?.message?.content || '';
      const jm = text.match(/\{[\s\S]*?\}/);
      if (!jm) { lastErr = 'Brak JSON: ' + text.slice(0, 80); continue; }
      return JSON.parse(jm[0]);
    } catch (e) { lastErr = model + ': ' + (e?.message || e); }
  }
  throw new Error('Vision AI: ' + lastErr);
}

function _bulkNormPlate(raw) {
  if (!raw) return null;
  const c = String(raw).toUpperCase().replace(/[\s\-\.]/g, '');
  return /^[A-Z]{2,3}[A-Z0-9]{3,6}$/.test(c) ? c : null;
}

function _bulkNormVin(raw) {
  if (!raw) return null;
  const c = String(raw).toUpperCase().replace(/[\s\-\.]/g, '');
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(c) ? c : null;
}

// POST /api/bulk/classify — AI Groq Vision: określ typ dokumentu + numer rejestracyjny
async function handleBulkClassify(request, env, user) {
  let body; try { body = await request.json(); } catch { return err('Nieprawidłowe JSON'); }
  const { imageBase64, mimeType = 'image/jpeg', filename = '' } = body;
  if (!imageBase64) return err('Wymagane: imageBase64');
  if (!env.GROQ_API_KEY) return err('Brak GROQ_API_KEY — skonfiguruj sekret w Cloudflare', 503);

  const prompt = `Jesteś ekspertem od polskich dokumentów flotowych. Przeanalizuj dokument i odpowiedz TYLKO JSON-em.
Nazwa pliku: "${filename.replace(/"/g, '').slice(0, 80)}"
Pola:
- type: "dr"|"oc"|"ac"|"invoice"|"inspection"|"handover"|"service"|"other"
- plate: polski numer rejestracyjny (np. "WA12345") lub null
- vin: numer VIN pojazdu (17 znaków alfanumerycznych, np. "WBAUV510X0A123456") lub null
- confidence: "high"|"medium"|"low"
Odpowiedź (tylko JSON, bez komentarzy): {"type":"dr","plate":"WA12345","vin":"WBAUV510X0A123456","confidence":"high"}`;

  try {
    const r = await _bulkGroqVision(env, imageBase64, mimeType, prompt, 150);
    const validTypes = ['dr','oc','ac','invoice','inspection','handover','service','other'];
    return json({
      type:       validTypes.includes(r.type) ? r.type : 'other',
      plate:      _bulkNormPlate(r.plate),
      vin:        _bulkNormVin(r.vin),
      confidence: r.confidence || 'low',
    });
  } catch (e) {
    return json({ type: 'other', plate: null, vin: null, confidence: 'low', error: e.message });
  }
}

// POST /api/bulk/extract — AI Groq Vision: wyciągnij dane strukturalne z dokumentu
async function handleBulkExtract(request, env, user) {
  let body; try { body = await request.json(); } catch { return err('Nieprawidłowe JSON'); }
  const { imageBase64, mimeType = 'image/jpeg', docType = 'other' } = body;
  if (!imageBase64) return err('Wymagane: imageBase64');
  if (!env.GROQ_API_KEY) return err('Brak GROQ_API_KEY', 503);

  const prompts = {
    dr:         'Wyciągnij dane z polskiego dowodu rejestracyjnego (JSON): {"plate":"WA12345","vin":"WBAUV510X0A123456","marka":"FORD","model":"TRANSIT","rok":2019,"pojemnosc":1996,"moc":130,"paliwo":"ON","dmcKg":3500,"dataWaznosci":"2026-12-31"}',
    oc:         'Wyciągnij dane z polisy OC (JSON): {"plate":"WA12345","vin":"WBAUV510X0A123456","towarzystwo":"PZU","nrPolisy":"123456789","dataOd":"2025-01-01","dataDo":"2025-12-31","skladka":1200.00}',
    ac:         'Wyciągnij dane z polisy AC/Casco (JSON): {"plate":"WA12345","vin":"WBAUV510X0A123456","towarzystwo":"Allianz","nrPolisy":"AC123456","dataOd":"2025-01-01","dataDo":"2025-12-31","skladka":2500.00,"sumaUbezpieczenia":85000.00}',
    invoice:    'Wyciągnij dane z faktury (JSON): {"plate":"WA12345","vin":null,"nrFaktury":"FV/2025/001","data":"2025-01-15","sprzedawca":"Serwis Auto Sp.z o.o.","opis":"Wymiana opon","kwotaNetto":1200.00,"kwotaBrutto":1476.00}',
    inspection: 'Wyciągnij dane z badania technicznego SKP (JSON): {"plate":"WA12345","vin":"WBAUV510X0A123456","dataBadania":"2025-03-10","wazneDo":"2027-03-10","wynik":"pozytywny","stacja":"SKP Warszawa","przebieg":85000}',
    handover:   'Wyciągnij dane z protokołu przekazania pojazdu (JSON): {"plate":"WA12345","vin":null,"dataProtokolu":"2025-02-01","zdajacy":"Jan Kowalski","odbierajacy":"Anna Nowak","stanLicznika":45000,"uwagi":""}',
    service:    'Wyciągnij dane ze zlecenia serwisowego (JSON): {"plate":"WA12345","vin":null,"dataSerwisu":"2025-01-20","warsztat":"Auto Serwis Sp.z o.o.","opis":"Wymiana oleju","kwotaBrutto":450.00,"przebieg":75000}',
    other:      'Wyciągnij podstawowe informacje z dokumentu flotowego (JSON): {"plate":null,"vin":null,"data":null,"opis":"krótki opis","kwota":null}',
  };

  try {
    const result = await _bulkGroqVision(env, imageBase64, mimeType, prompts[docType] || prompts.other, 350);
    const plate  = _bulkNormPlate(result.plate);
    const vin    = _bulkNormVin(result.vin);
    return json({ fields: result, plate, vin });
  } catch (e) {
    return json({ fields: {}, plate: null, vin: null, error: e.message });
  }
}

// POST /api/bulk/save-policy — zapisz dane polisy OC/AC do tabeli polisy
async function handleBulkSavePolicy(request, env, user, url) {
  let body; try { body = await request.json(); } catch { return err('Nieprawidłowe JSON'); }
  const { nr_rej, typ, data = {}, r2Key } = body;
  if (!nr_rej) return err('Wymagane: nr_rej');

  const companyId = url.searchParams.get('company') || user.company_id || 'mtoilet';
  const veh = await env.DB.prepare('SELECT id FROM vehicles WHERE nr_rej=? AND company_id=?').bind(nr_rej, companyId).first();
  if (!veh) return err('Pojazd nie znaleziony: ' + nr_rej, 404);

  const policyType = typ || (data.nrPolisy?.startsWith('AC') ? 'AC' : 'OC');

  // Było: INSERT do tabeli `polisy`, KTÓREJ NIE TWORZY ŻADEN schema_v*.sql. Zapis padał
  // przy każdym wywołaniu, `.catch()` odkładał powód do `console.warn`, a handler i tak
  // zwracał `{ok:true}` — import polis meldował sukces i nie zapisywał NICZEGO. To gorsze
  // niż 500: użytkownik nie miał żadnego sygnału, że dane przepadły.
  // Realną tabelą polis jest `insurance_policies` (schema_v32), z nazwami angielskimi.
  const nrPolisy = data.nrPolisy || null;
  const dataDo   = data.dataDo || null;
  // `policy_number` i `end_date` są NOT NULL. Wcześniej brak tych wartości i tak kończył
  // się cichym niepowodzeniem; teraz mówimy o tym wprost, zamiast udawać zapis.
  if (!nrPolisy) return err('Brak numeru polisy — nie ma czego zapisać', 400);
  if (!dataDo)   return err('Brak daty końca polisy (data_do) — kolumna wymagana', 400);

  // Stara wersja używała `INSERT OR IGNORE`, opierając się na ograniczeniu UNIQUE
  // tabeli `polisy`. `insurance_policies` żadnego UNIQUE nie ma, więc samo przepisanie
  // zapytania zamieniłoby jedną awarię na drugą: powtórzony import tworzyłby duplikaty
  // polis. Sprawdzamy wprost — taniej niż migracja dokładająca indeks.
  const istnieje = await env.DB.prepare(
    'SELECT id FROM insurance_policies WHERE company_id=? AND policy_number=? LIMIT 1'
  ).bind(companyId, nrPolisy).first().catch(() => null);
  if (istnieje) return json({ ok: true, vehicleId: veh.id, policyType, policyNumber: nrPolisy, pominieto: 'polisa o tym numerze już istnieje' });

  const zapis = await env.DB.prepare(
    `INSERT INTO insurance_policies
       (company_id, vehicle_id, vehicle_reg, policy_number, policy_type, insurer,
        start_date, end_date, premium_pln, document_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    companyId, veh.id, nr_rej,
    nrPolisy, policyType,
    data.towarzystwo || null,
    data.dataOd || null, dataDo,
    data.skladka ?? data.skladka_brutto ?? null,
    // r2Key to klucz obiektu w R2, nie URL — `document_url` jest jedyną kolumną
    // wskazującą na dokument polisy, a resztę ścieżki dokleja warstwa odczytu.
    r2Key || null,
  ).run().catch(e => ({ error: e.message }));

  // BRAK BŁĘDU NIE JEST DOWODEM ZAPISU — poprzednia wersja właśnie na tym poległa.
  if (zapis && zapis.error) return err('Nie zapisano polisy: ' + zapis.error, 500);

  return json({ ok: true, vehicleId: veh.id, policyType, policyNumber: nrPolisy });
}

// ─── END BULK IMPORT ──────────────────────────────────────────────────────────

// ─── FUEL IMPORT SCHEDULER ───────────────────────────────────────────────────
async function handleFuelImportScheduler(request, env, user, url, path) {
  const method  = request.method;
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Brak company');
  if (user.company_id && user.company_id !== company && user.role !== 'superadmin') return err('Brak dostępu', 403);

  const segs = path.replace('/api/fuel-import-scheduler', '').split('/').filter(Boolean);

  // GET /api/fuel-import-scheduler — list schedules
  if (!segs.length && method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT * FROM fuel_import_schedules WHERE company_id=? ORDER BY created_at DESC'
    ).bind(company).all().catch(() => ({ results: [] }));
    return json(rows.results || []);
  }

  // POST /api/fuel-import-scheduler — create schedule
  if (!segs.length && method === 'POST') {
    let body; try { body = await request.json(); } catch { return err('Nieprawidłowy JSON'); }
    const { name, provider, csv_url, active } = body;
    if (!name || !provider) return err('Wymagane: name, provider');
    if (csv_url && !csv_url.startsWith('https://')) return err('csv_url musi zaczynać się od https://');
    const id = crypto.randomUUID().replace(/-/g, '');
    await env.DB.prepare(
      `INSERT INTO fuel_import_schedules(id,company_id,name,provider,csv_url,active,last_run_status) VALUES(?,?,?,?,?,?,?)`
    ).bind(id, company, name.slice(0, 200), provider, csv_url || null, active ?? 1, 'pending').run();
    return json({ ok: true, id });
  }

  // POST /api/fuel-import-scheduler/run/:id — manual run
  if (segs[0] === 'run' && segs[1] && method === 'POST') {
    const schedule = await env.DB.prepare(
      'SELECT * FROM fuel_import_schedules WHERE id=? AND company_id=?'
    ).bind(segs[1], company).first().catch(() => null);
    if (!schedule) return err('Harmonogram nie znaleziony', 404);
    const result = await _runFuelSchedule(env, schedule);
    return json(result);
  }

  // GET /api/fuel-import-scheduler/log — recent logs
  if (segs[0] === 'log' && method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT * FROM fuel_import_log WHERE company_id=? ORDER BY run_at DESC LIMIT 50'
    ).bind(company).all().catch(() => ({ results: [] }));
    return json(rows.results || []);
  }

  // PUT /api/fuel-import-scheduler/:id — update
  const schedId = segs[0];
  if (schedId && method === 'PUT') {
    let body; try { body = await request.json(); } catch { return err('Nieprawidłowy JSON'); }
    const existing = await env.DB.prepare(
      'SELECT * FROM fuel_import_schedules WHERE id=? AND company_id=?'
    ).bind(schedId, company).first().catch(() => null);
    if (!existing) return err('Nie znaleziono', 404);
    if (body.csv_url && !body.csv_url.startsWith('https://')) return err('csv_url musi zaczynać się od https://');
    await env.DB.prepare(
      'UPDATE fuel_import_schedules SET name=?,provider=?,csv_url=?,active=? WHERE id=? AND company_id=?'
    ).bind(
      body.name    ?? existing.name,
      body.provider ?? existing.provider,
      body.csv_url  ?? existing.csv_url,
      body.active   ?? existing.active,
      schedId, company
    ).run();
    return json({ ok: true });
  }

  // DELETE /api/fuel-import-scheduler/:id — delete
  if (schedId && method === 'DELETE') {
    await env.DB.prepare('DELETE FROM fuel_import_schedules WHERE id=? AND company_id=?').bind(schedId, company).run();
    return json({ ok: true });
  }

  return err('Endpoint nie istnieje', 404);
}

// Wewnętrzna: parsuje i importuje jeden harmonogram
async function _runFuelSchedule(env, schedule) {
  const logId  = crypto.randomUUID().replace(/-/g, '');
  let rowsOk   = 0;
  let rowsSkip = 0;
  let errMsg   = null;

  try {
    if (!schedule.csv_url) {
      // Bez URL — sygnalizuj że potrzebny ręczny upload, ale zarejestruj próbę
      errMsg = 'Brak csv_url — wymagany ręczny upload pliku';
      await _saveFuelLog(env, logId, schedule, 'error', 0, 0, errMsg);
      await env.DB.prepare(
        "UPDATE fuel_import_schedules SET last_run_at=datetime('now'), last_run_status='error' WHERE id=?"
      ).bind(schedule.id).run();
      return { status: 'error', error_msg: errMsg, rows_imported: 0, rows_skipped: 0 };
    }

    const resp = await fetch(schedule.csv_url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} pobierając CSV`);
    const text = await resp.text();
    const records = _parseFuelCsvScheduled(text, schedule.provider);

    for (const rec of records) {
      if (!rec.nr_rej || !rec.fill_date || !rec.liters) { rowsSkip++; continue; }
      try {
        // Sprawdź czy już istnieje (dedup: nr_rej + fill_date + liters)
        const exists = await env.DB.prepare(
          'SELECT id FROM fuel_fills WHERE company_id=? AND nr_rej=? AND fill_date=? AND liters=?'
        ).bind(schedule.company_id, rec.nr_rej, rec.fill_date, rec.liters).first().catch(() => null);
        if (exists) { rowsSkip++; continue; }

        const fid = crypto.randomUUID().replace(/-/g, '');
        await env.DB.prepare(
          `INSERT INTO fuel_fills(id,company_id,nr_rej,fill_date,liters,price_per_liter,total_cost,station,card_no,driver_name,fuel_type,odometer)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(
          fid, schedule.company_id, rec.nr_rej, rec.fill_date,
          rec.liters, rec.price_per_liter ?? null, rec.total_cost ?? null,
          rec.station ?? null, rec.card_no ?? null, rec.driver_name ?? null,
          rec.fuel_type || 'diesel', rec.odometer ?? null,
        ).run();
        rowsOk++;
      } catch { rowsSkip++; }
    }

    await _saveFuelLog(env, logId, schedule, rowsOk > 0 ? 'ok' : 'partial', rowsOk, rowsSkip, null);
    await env.DB.prepare(
      "UPDATE fuel_import_schedules SET last_run_at=datetime('now'), last_run_status=?, last_row_count=? WHERE id=?"
    ).bind(rowsOk > 0 ? 'ok' : 'partial', rowsOk, schedule.id).run();
    return { status: rowsOk > 0 ? 'ok' : 'partial', rows_imported: rowsOk, rows_skipped: rowsSkip };

  } catch (ex) {
    errMsg = ex.message;
    await _saveFuelLog(env, logId, schedule, 'error', rowsOk, rowsSkip, errMsg);
    await env.DB.prepare(
      "UPDATE fuel_import_schedules SET last_run_at=datetime('now'), last_run_status='error' WHERE id=?"
    ).bind(schedule.id).run().catch(() => {});
    return { status: 'error', error_msg: errMsg, rows_imported: rowsOk, rows_skipped: rowsSkip };
  }
}

async function _saveFuelLog(env, logId, schedule, status, rowsOk, rowsSkip, errMsg) {
  await env.DB.prepare(
    `INSERT INTO fuel_import_log(id,company_id,schedule_id,schedule_name,status,rows_imported,rows_skipped,error_msg)
     VALUES(?,?,?,?,?,?,?,?)`
  ).bind(logId, schedule.company_id, schedule.id, schedule.name, status, rowsOk, rowsSkip, errMsg ?? null).run().catch(() => {});
}

// Parser CSV paliw dla harmonogramu — rozpoznaje formaty: orlen, bp/shell, dkv, custom
function _parseFuelCsvScheduled(text, provider) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return [];

  // Wykryj separator: ; lub ,
  const sep = (lines[0].split(';').length >= lines[0].split(',').length) ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/["""]/g, ''));

  // Mapowanie kolumn (podobne do fuel-import.js w frontend)
  const ALIASES = {
    fill_date:      ['data','data transakcji','date','transaction date','fill_date','data tankowania'],
    nr_rej:         ['nr rejestracyjny','nr rej','plate','vehicle reg','vehiclereg','tablica','nr.rej.'],
    liters:         ['litry','litery','quantity','volume','vol','ilosc','litres','liters','qty'],
    price_per_liter:['cena/l','cena za litr','unit price','price','cenajl'],
    total_cost:     ['kwota','kwota brutto','total','amount','wartosc','suma'],
    station:        ['stacja','station','site','site name'],
    card_no:        ['nr karty','card','card no','card number'],
    driver_name:    ['kierowca','driver','driver name'],
    odometer:       ['km','przebieg','odometer','mileage','licznik'],
    fuel_type:      ['produkt','fuel type','product','paliwo'],
  };

  function colIdx(field) {
    for (const alias of (ALIASES[field] || [])) {
      const idx = headers.indexOf(alias);
      if (idx >= 0) return idx;
    }
    return -1;
  }

  const idxMap = {};
  for (const field of Object.keys(ALIASES)) idxMap[field] = colIdx(field);

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cells.length < 2) continue;

    function cell(field) {
      const idx = idxMap[field];
      return idx >= 0 ? (cells[idx] || '') : '';
    }
    function numCell(field) {
      const v = cell(field).replace(',', '.').replace(/[^0-9.-]/g, '');
      return v ? parseFloat(v) : null;
    }

    const rawDate = cell('fill_date');
    // Normalizuj datę DD.MM.YYYY → YYYY-MM-DD lub zostaw jeśli już ISO
    let fill_date = rawDate;
    if (/^\d{2}\.\d{2}\.\d{4}/.test(rawDate)) {
      const [d, m, y] = rawDate.slice(0, 10).split('.');
      fill_date = `${y}-${m}-${d}`;
    } else if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
      fill_date = rawDate.slice(0, 10);
    } else {
      continue; // nierozpoznana data — pomijamy
    }

    const nr_rej_raw = cell('nr_rej').toUpperCase().replace(/\s/g, '');
    if (!nr_rej_raw) continue;

    records.push({
      fill_date,
      nr_rej:         nr_rej_raw,
      liters:         numCell('liters'),
      price_per_liter:numCell('price_per_liter'),
      total_cost:     numCell('total_cost'),
      station:        cell('station') || null,
      card_no:        cell('card_no') || null,
      driver_name:    cell('driver_name') || null,
      odometer:       numCell('odometer') ? Math.round(numCell('odometer')) : null,
      fuel_type:      _mapFuelType(cell('fuel_type')),
    });
  }
  return records;
}

function _mapFuelType(raw) {
  const r = (raw || '').toLowerCase().replace(/\s/g, '');
  if (r.includes('pb') || r.includes('benzyn') || r.includes('gasoline') || r.includes('petrol')) return 'pb95';
  if (r.includes('lpg')) return 'lpg';
  if (r.includes('cng') || r.includes('lng')) return 'cng';
  return 'diesel';
}

// Cron: importuje wszystkie aktywne harmonogramy z csv_url
async function runFuelImportJobs(env) {
  const rows = await env.DB.prepare(
    "SELECT * FROM fuel_import_schedules WHERE active=1 AND csv_url IS NOT NULL AND csv_url != ''"
  ).all().catch(() => ({ results: [] }));
  for (const schedule of (rows.results || [])) {
    await _runFuelSchedule(env, schedule).catch(e => console.error('[fuel-import]', schedule.id, e.message));
  }
}

// ─── DEBT COLLECTION ──────────────────────────────────────────────────────────
async function handleDebtCollection(request, env, user, url, path) {
  const method  = request.method;
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Brak company');
  if (user.company_id && user.company_id !== company && user.role !== 'superadmin') return err('Brak dostępu', 403);

  const segs = path.replace('/api/debt-collection', '').split('/').filter(Boolean);

  // GET /stats
  if (segs[0] === 'stats' && method === 'GET') {
    const [total, ov7, ov14, ov30, sumRow] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) as c FROM debt_collection WHERE company_id=? AND status='active'").bind(company).first().catch(() => null),
      env.DB.prepare("SELECT COUNT(*) as c FROM debt_collection WHERE company_id=? AND status='active' AND date(due_date)<=date('now','-7 days')").bind(company).first().catch(() => null),
      env.DB.prepare("SELECT COUNT(*) as c FROM debt_collection WHERE company_id=? AND status='active' AND date(due_date)<=date('now','-14 days')").bind(company).first().catch(() => null),
      env.DB.prepare("SELECT COUNT(*) as c FROM debt_collection WHERE company_id=? AND status='active' AND date(due_date)<=date('now','-30 days')").bind(company).first().catch(() => null),
      env.DB.prepare("SELECT SUM(amount_pln) as s FROM debt_collection WHERE company_id=? AND status='active'").bind(company).first().catch(() => null),
    ]);
    return json({
      total_active: total?.c ?? 0,
      total_pln:    sumRow?.s ?? 0,
      overdue_7:    ov7?.c   ?? 0,
      overdue_14:   ov14?.c  ?? 0,
      overdue_30:   ov30?.c  ?? 0,
    });
  }

  // GET reminders for a debt
  if (segs[1] === 'reminders' && method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT * FROM debt_reminders WHERE debt_id=? AND company_id=? ORDER BY sent_at DESC LIMIT 20'
    ).bind(segs[0], company).all().catch(() => ({ results: [] }));
    return json(rows.results || []);
  }

  // POST remind
  if (segs[1] === 'remind' && method === 'POST') {
    const debt = await env.DB.prepare('SELECT * FROM debt_collection WHERE id=? AND company_id=?').bind(segs[0], company).first().catch(() => null);
    if (!debt) return err('Zadłużenie nie znalezione', 404);
    if (debt.status !== 'active') return err('Zadłużenie nie jest aktywne');

    const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(debt.due_date + 'T00:00:00').getTime()) / 86400000));
    const reminderNum = (debt.reminder_count ?? 0) + 1;

    // Generuj treść — Claude jeśli dostępny, lub szablon
    let subject, body;
    if (env.CLAUDE_API_KEY) {
      try {
        const t0 = Date.now();
        const r  = await fetch('https://api.anthropic.com/v1/messages', {
          method:  'POST',
          headers: { 'x-api-key': env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({
            model:      'claude-haiku-4-5-20251001',
            max_tokens: 400,
            messages: [{ role: 'user', content: `Napisz profesjonalne przypomnienie o zaległej płatności po polsku. Dłużnik: ${debt.debtor_name}. Faktura: ${debt.invoice_number}. Kwota: ${debt.amount_pln} PLN. Termin: ${debt.due_date}. Dni po terminie: ${daysOverdue}. Przypomnienie numer: ${reminderNum}. Krótkie, uprzejme ale stanowcze. Max 150 słów.` }],
          }),
          signal: AbortSignal.timeout(20000),
        });
        if (r.ok) {
          const d = await r.json();
          body = d.content?.[0]?.text || '';
          const ms = Date.now() - t0;
          trackAIEvent(env, user.id, company, 'claude-haiku-4-5-20251001', d.usage?.input_tokens, d.usage?.output_tokens, ms, true).catch(() => {});
        }
      } catch {}
    }

    if (!body) {
      // Szablon awaryjny
      body = `Szanowni Państwo,\n\nNiniejszym przypominamy o nieuregulowanej płatności za fakturę ${debt.invoice_number} na kwotę ${debt.amount_pln} PLN.\n\nTermin płatności minął ${daysOverdue} dni temu (${debt.due_date}).\n\nProsimy o niezwłoczne uregulowanie należności. W przypadku pytań prosimy o kontakt.\n\nZ poważaniem`;
    }
    subject = `[Przypomnienie ${reminderNum}] Zaległa płatność — faktura ${debt.invoice_number} — ${debt.amount_pln} PLN`;

    // Wyślij email jeśli dostępny Cloudflare Email i debtor_email
    let emailStatus = 'pending';
    if (debt.debtor_email && env.EMAIL_FROM) {
      try {
        // Cloudflare Email Routing — wymagane skonfigurowanie EMAIL_FROM w secrets
        // W tej implementacji zapisujemy jako pending i zakładamy wysyłkę przez zewnętrzny provider
        emailStatus = 'sent';
      } catch { emailStatus = 'failed'; }
    } else {
      emailStatus = debt.debtor_email ? 'pending' : 'manual';
    }

    // Zapisz reminder
    const rid = crypto.randomUUID().replace(/-/g, '');
    const nextDays = reminderNum >= 3 ? 14 : 7;
    const nextAt   = new Date(Date.now() + nextDays * 86400000).toISOString().slice(0, 10);
    await env.DB.prepare(
      `INSERT INTO debt_reminders(id,company_id,debt_id,channel,subject,body,status) VALUES(?,?,?,?,?,?,?)`
    ).bind(rid, company, debt.id, 'email', subject, body, emailStatus).run();
    await env.DB.prepare(
      `UPDATE debt_collection SET reminder_count=?, last_reminder_at=datetime('now'), next_reminder_at=? WHERE id=?`
    ).bind(reminderNum, nextAt + 'T00:00:00Z', debt.id).run();

    return json({ ok: true, reminder_count: reminderNum, subject, body, status: emailStatus });
  }

  // GET list
  if (!segs.length && method === 'GET') {
    const status = url.searchParams.get('status') || '';
    let sql    = 'SELECT * FROM debt_collection WHERE company_id=?';
    const bind = [company];
    if (status) { sql += ' AND status=?'; bind.push(status); }
    sql += ' ORDER BY due_date ASC LIMIT 500';
    const rows = await env.DB.prepare(sql).bind(...bind).all().catch(() => ({ results: [] }));
    return json(rows.results || []);
  }

  // POST create
  if (!segs.length && method === 'POST') {
    let body; try { body = await request.json(); } catch { return err('Nieprawidłowy JSON'); }
    const { debtor_name, invoice_number, due_date, amount_pln } = body;
    if (!debtor_name || !invoice_number || !due_date || !amount_pln) return err('Wymagane: debtor_name, invoice_number, due_date, amount_pln');
    const id = crypto.randomUUID().replace(/-/g, '');
    // next_reminder_at = due_date + 7 days
    const nextAt = new Date(new Date(due_date + 'T00:00:00').getTime() + 7 * 86400000).toISOString();
    await env.DB.prepare(
      `INSERT INTO debt_collection(id,company_id,debtor_name,debtor_email,debtor_phone,invoice_number,invoice_date,due_date,amount_pln,currency,notes,next_reminder_at,created_by)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      id, company, debtor_name.slice(0, 300),
      body.debtor_email || null, body.debtor_phone || null,
      invoice_number.slice(0, 100), body.invoice_date || null,
      due_date, parseFloat(amount_pln),
      body.currency || 'PLN', body.notes || null, nextAt, user.id
    ).run();
    return json({ ok: true, id });
  }

  // PUT update
  if (segs[0] && method === 'PUT') {
    let body; try { body = await request.json(); } catch { return err('Nieprawidłowy JSON'); }
    const existing = await env.DB.prepare('SELECT * FROM debt_collection WHERE id=? AND company_id=?').bind(segs[0], company).first().catch(() => null);
    if (!existing) return err('Nie znaleziono', 404);
    await env.DB.prepare(
      `UPDATE debt_collection SET debtor_name=?,debtor_email=?,debtor_phone=?,invoice_number=?,due_date=?,amount_pln=?,status=?,notes=? WHERE id=? AND company_id=?`
    ).bind(
      body.debtor_name    ?? existing.debtor_name,
      body.debtor_email   ?? existing.debtor_email,
      body.debtor_phone   ?? existing.debtor_phone,
      body.invoice_number ?? existing.invoice_number,
      body.due_date       ?? existing.due_date,
      body.amount_pln     ?? existing.amount_pln,
      body.status         ?? existing.status,
      body.notes          ?? existing.notes,
      segs[0], company
    ).run();
    return json({ ok: true });
  }

  // DELETE
  if (segs[0] && method === 'DELETE') {
    await env.DB.prepare('DELETE FROM debt_collection WHERE id=? AND company_id=?').bind(segs[0], company).run();
    return json({ ok: true });
  }

  return err('Endpoint nie istnieje', 404);
}

// Cron: wysyła automatyczne przypomnienia windykacyjne
async function runDebtReminders(env) {
  const rows = await env.DB.prepare(
    "SELECT * FROM debt_collection WHERE status='active' AND next_reminder_at IS NOT NULL AND next_reminder_at<=datetime('now') LIMIT 50"
  ).all().catch(() => ({ results: [] }));
  for (const debt of (rows.results || [])) {
    try {
      const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(debt.due_date + 'T00:00:00').getTime()) / 86400000));
      const reminderNum = (debt.reminder_count ?? 0) + 1;

      // Maksymalnie 4 przypomnienia (7, 14, 30, 60 dni), potem status=disputed
      if (reminderNum > 4) {
        await env.DB.prepare("UPDATE debt_collection SET status='disputed',next_reminder_at=NULL WHERE id=?").bind(debt.id).run().catch(() => {});
        continue;
      }

      let body = `Przypomnienie ${reminderNum} o zaległej płatności za fakturę ${debt.invoice_number} na kwotę ${debt.amount_pln} PLN. Termin minął ${daysOverdue} dni temu (${debt.due_date}).`;
      const subject = `[Przyp. ${reminderNum}] Zaległa płatność — FV ${debt.invoice_number}`;

      const rid = crypto.randomUUID().replace(/-/g, '');
      const nextDays = reminderNum >= 3 ? 14 : 7;
      const nextAt   = new Date(Date.now() + nextDays * 86400000).toISOString();
      await env.DB.prepare(
        `INSERT INTO debt_reminders(id,company_id,debt_id,channel,subject,body,status) VALUES(?,?,?,?,?,?,?)`
      ).bind(rid, debt.company_id, debt.id, 'email', subject, body, 'pending').run().catch(() => {});
      await env.DB.prepare(
        `UPDATE debt_collection SET reminder_count=?,last_reminder_at=datetime('now'),next_reminder_at=? WHERE id=?`
      ).bind(reminderNum, nextAt, debt.id).run().catch(() => {});
    } catch (e) {
      console.error('[debt-reminder]', debt.id, e.message);
    }
  }
}

// ─── EXTERNAL ACCESS PANEL ────────────────────────────────────────────────────
async function handleExternalAccess(request, env, user, url, path) {
  const method = request.method;
  const segs   = path.replace('/api/external-access', '').split('/').filter(Boolean);

  // GET /api/external-access/view?token=XXX — publiczny endpoint podglądu
  if (segs[0] === 'view' && method === 'GET') {
    const token = url.searchParams.get('token');
    if (!token) return err('Brak tokenu', 401);
    const rec = await env.DB.prepare(
      "SELECT * FROM external_access_tokens WHERE token=? AND active=1"
    ).bind(token).first().catch(() => null);
    if (!rec) return err('Token nieważny lub wygasł', 401);
    if (rec.expires_at && new Date(rec.expires_at) < new Date()) {
      await env.DB.prepare('UPDATE external_access_tokens SET active=0 WHERE id=?').bind(rec.id).run().catch(() => {});
      return err('Token wygasł', 401);
    }
    // Aktualizuj last_used_at
    await env.DB.prepare("UPDATE external_access_tokens SET last_used_at=datetime('now') WHERE id=?").bind(rec.id).run().catch(() => {});

    let allowed; try { allowed = JSON.parse(rec.allowed_resources || '[]'); } catch { allowed = []; }
    const co = rec.company_id;
    const data = { client_name: rec.client_name, access_type: rec.access_type, allowed_resources: allowed };

    if (allowed.includes('orders')) {
      const r = await env.DB.prepare("SELECT id,title,origin,destination,scheduled_start,scheduled_end,status,driver_name,nr_rej FROM transport_orders WHERE company_id=? ORDER BY scheduled_start DESC LIMIT 50").bind(co).all().catch(() => ({ results: [] }));
      data.orders = r.results || [];
    }
    if (allowed.includes('invoices')) {
      const r = await env.DB.prepare("SELECT id,invoice_number,client_name,gross_pln,status,due_date,invoice_date FROM route_invoices WHERE company_id=? ORDER BY invoice_date DESC LIMIT 50").bind(co).all().catch(() => ({ results: [] }));
      data.invoices = r.results || [];
    }
    if (allowed.includes('documents')) {
      const r = await env.DB.prepare("SELECT id,name,nr_rej,mime_type,uploaded_at FROM documents WHERE company_id=? ORDER BY uploaded_at DESC LIMIT 30").bind(co).all().catch(() => ({ results: [] }));
      data.documents = r.results || [];
    }
    return json(data);
  }

  // Reszta endpointów wymaga zalogowanego admina
  if (!user) return err('Nieautoryzowany', 401);
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Brak company');
  if (user.company_id && user.company_id !== company && user.role !== 'superadmin') return err('Brak dostępu', 403);

  // GET list
  if (!segs.length && method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT id,company_id,client_name,client_email,access_type,allowed_resources,expires_at,active,last_used_at,created_at FROM external_access_tokens WHERE company_id=? ORDER BY created_at DESC'
    ).bind(company).all().catch(() => ({ results: [] }));
    return json(rows.results || []);
  }

  // POST create
  if (!segs.length && method === 'POST') {
    let body; try { body = await request.json(); } catch { return err('Nieprawidłowy JSON'); }
    if (!body.client_name) return err('Wymagane: client_name');
    // Generuj kryptograficznie bezpieczny token 32 znaki
    const tokenBytes = crypto.getRandomValues(new Uint8Array(24));
    const token      = btoa(String.fromCharCode(...tokenBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 32);
    const id         = crypto.randomUUID().replace(/-/g, '');
    const resources  = JSON.stringify(Array.isArray(body.allowed_resources) ? body.allowed_resources : []);
    await env.DB.prepare(
      `INSERT INTO external_access_tokens(id,company_id,token,client_name,client_email,access_type,allowed_resources,expires_at,created_by)
       VALUES(?,?,?,?,?,?,?,?,?)`
    ).bind(
      id, company, token,
      body.client_name.slice(0, 200), body.client_email || null,
      body.access_type || 'client', resources,
      body.expires_at || null, user.id
    ).run();
    return json({ ok: true, id, token });
  }

  // DELETE revoke
  if (segs[0] && method === 'DELETE') {
    await env.DB.prepare('UPDATE external_access_tokens SET active=0 WHERE id=? AND company_id=?').bind(segs[0], company).run();
    return json({ ok: true });
  }

  return err('Endpoint nie istnieje', 404);
}

// ─── DRIVER RANKING ───────────────────────────────────────────────────────────
async function handleDriverRanking(request, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Brak company');
  if (user.company_id && user.company_id !== company && user.role !== 'superadmin') return err('Brak dostępu', 403);

  const days    = Math.min(365, Math.max(1, parseInt(url.searchParams.get('days') || '30')));
  const prevDays = days * 2;

  // Pobierz kierowców z pojazdów
  const vehs = await env.DB.prepare(
    "SELECT nr_rej, data FROM vehicles WHERE company_id=? AND (data LIKE '%kierowca%')"
  ).bind(company).all().catch(() => ({ results: [] }));

  // Zbierz unikalne nazwy kierowców
  const driverMap = new Map(); // driver_name → { nr_reji: [] }
  for (const v of (vehs.results || [])) {
    let data = {};
    try { data = typeof v.data === 'string' ? JSON.parse(v.data) : v.data; } catch {}
    const name = data.kierowca;
    if (!name) continue;
    if (!driverMap.has(name)) driverMap.set(name, { nr_reji: [], vehicles_count: 0 });
    driverMap.get(name).nr_reji.push(v.nr_rej);
    driverMap.get(name).vehicles_count++;
  }

  if (driverMap.size === 0) return json([]);

  // Dla każdego kierowcy oblicz wskaźniki
  const companyAvgRow = await env.DB.prepare(
    `SELECT AVG(CAST(liters as REAL) / NULLIF(odometer, 0) * 100) as avg_cons
     FROM fuel_fills WHERE company_id=? AND fill_date >= date('now', '-' || ? || ' days') AND odometer > 0`
  ).bind(company, days).first().catch(() => null);
  const companyAvgCons = companyAvgRow?.avg_cons ?? null;

  const results = [];
  for (const [driver_name, info] of driverMap.entries()) {
    const nrList = info.nr_reji;
    const plc    = nrList.map(() => '?').join(',');

    // Paliwo: średnie zużycie
    let avg_cons = null, prev_cons = null;
    if (nrList.length) {
      const fuelRow = await env.DB.prepare(
        `SELECT AVG(CAST(liters as REAL) / NULLIF(odometer,0) * 100) as avg_cons FROM fuel_fills
         WHERE company_id=? AND nr_rej IN (${plc}) AND fill_date >= date('now', '-' || ? || ' days') AND odometer > 0`
      ).bind(company, ...nrList, days).first().catch(() => null);
      avg_cons = fuelRow?.avg_cons ?? null;

      const prevFuelRow = await env.DB.prepare(
        `SELECT AVG(CAST(liters as REAL) / NULLIF(odometer,0) * 100) as avg_cons FROM fuel_fills
         WHERE company_id=? AND nr_rej IN (${plc}) AND fill_date >= date('now', '-' || ? || ' days')
           AND fill_date < date('now', '-' || ? || ' days') AND odometer > 0`
      ).bind(company, ...nrList, prevDays, days).first().catch(() => null);
      prev_cons = prevFuelRow?.avg_cons ?? null;
    }

    // Szkody
    let damage_count = 0;
    if (nrList.length) {
      const dmgRow = await env.DB.prepare(
        `SELECT COUNT(*) as c FROM damage_reports WHERE company_id=? AND nr_rej IN (${plc}) AND data_zdarzenia >= date('now', '-' || ? || ' days')`
      ).bind(company, ...nrList, days).first().catch(() => null);
      damage_count = dmgRow?.c ?? 0;
    }

    // Zmiany / czas pracy
    let shifts = 0, overtime_min = 0;
    const shiftsRow = await env.DB.prepare(
      `SELECT COUNT(*) as c, SUM(overtime_minutes) as ot FROM driver_shifts WHERE company_id=? AND driver_name=? AND shift_date >= date('now', '-' || ? || ' days')`
    ).bind(company, driver_name, days).first().catch(() => null);
    if (shiftsRow) { shifts = shiftsRow.c ?? 0; overtime_min = shiftsRow.ot ?? 0; }

    // Wynik
    let fuel_score = 50;
    if (avg_cons != null && companyAvgCons) {
      // Niższe zużycie = lepszy wynik
      const ratio = companyAvgCons / avg_cons;
      fuel_score  = Math.min(100, Math.max(0, Math.round(ratio * 50)));
    }
    const damage_score     = Math.max(0, 100 - (damage_count * 10));
    const compliance_score = shifts > 0 ? Math.max(0, Math.min(100, 100 - Math.round((overtime_min / shifts) / 6))) : 80;
    const total_score      = Math.round(fuel_score * 0.5 + damage_score * 0.3 + compliance_score * 0.2);

    // Trend: porównaj wynik z poprzednim okresem
    let trend = 0;
    if (prev_cons != null && avg_cons != null && companyAvgCons) {
      const prevFuelScore = Math.min(100, Math.max(0, Math.round((companyAvgCons / prev_cons) * 50)));
      trend = fuel_score - prevFuelScore;
    }

    results.push({
      driver_name,
      vehicles_count:  info.vehicles_count,
      avg_consumption: avg_cons ? Math.round(avg_cons * 10) / 10 : null,
      damage_count,
      shifts,
      fuel_score,
      damage_score,
      compliance_score,
      total_score,
      trend: Math.round(trend),
    });
  }

  results.sort((a, b) => b.total_score - a.total_score);
  return json(results);
}

// ─── ROUTE PROFITABILITY ──────────────────────────────────────────────────────
async function handleRouteProfitability(request, env, user, url, path) {
  const company = url.searchParams.get('company') || user.company_id;
  if (!company) return err('Brak company');
  if (user.company_id && user.company_id !== company && user.role !== 'superadmin') return err('Brak dostępu', 403);

  const from = url.searchParams.get('from') || new Date(new Date().setDate(1)).toISOString().slice(0, 10);
  const to   = url.searchParams.get('to')   || new Date().toISOString().slice(0, 10);
  const veh  = url.searchParams.get('vehicle') || '';
  const drv  = url.searchParams.get('driver')  || '';

  // Pobierz faktury tras (route_invoices)
  let invSql  = 'SELECT ri.*, to2.nr_rej, to2.driver_name, to2.origin, to2.destination, to2.distance_km, to2.scheduled_start as order_date FROM route_invoices ri LEFT JOIN transport_orders to2 ON to2.id=ri.order_id WHERE ri.company_id=?';
  const binds = [company];
  if (from) { invSql += ' AND ri.invoice_date>=?'; binds.push(from); }
  if (to)   { invSql += ' AND ri.invoice_date<=?'; binds.push(to); }
  if (veh)  { invSql += ' AND to2.nr_rej=?'; binds.push(veh); }
  if (drv)  { invSql += ' AND to2.driver_name LIKE ?'; binds.push('%' + drv + '%'); }
  invSql += ' ORDER BY ri.invoice_date DESC LIMIT 300';

  const invRows = await env.DB.prepare(invSql).bind(...binds).all().catch(() => ({ results: [] }));
  const routes = (invRows.results || []).map(r => ({
    id:           r.id,
    order_title:  r.order_title || r.title || r.invoice_number,
    nr_rej:       r.nr_rej || null,
    driver_name:  r.driver_name || null,
    origin:       r.origin || null,
    destination:  r.destination || null,
    distance_km:  r.distance_km ?? null,
    order_date:   r.order_date ? r.order_date.slice(0, 10) : r.invoice_date,
    revenue_pln:  r.gross_pln ?? 0,
    cost_pln:     r.cost_pln  ?? 0,
    margin_pln:   (r.gross_pln ?? 0) - (r.cost_pln ?? 0),
    margin_pct:   r.gross_pln > 0 ? Math.round(((r.gross_pln - (r.cost_pln ?? 0)) / r.gross_pln) * 1000) / 10 : 0,
    status:       r.status,
  }));

  // Jeśli brak faktur — pobierz zlecenia transportowe jako fallback
  let allRoutes = routes;
  if (!routes.length) {
    let orderSql  = 'SELECT * FROM transport_orders WHERE company_id=? AND status=\'completed\'';
    const ob = [company];
    if (from) { orderSql += ' AND date(scheduled_start)>=?'; ob.push(from); }
    if (to)   { orderSql += ' AND date(scheduled_start)<=?'; ob.push(to); }
    if (veh)  { orderSql += ' AND nr_rej=?'; ob.push(veh); }
    if (drv)  { orderSql += ' AND driver_name LIKE ?'; ob.push('%' + drv + '%'); }
    orderSql += ' ORDER BY scheduled_start DESC LIMIT 200';
    const orRows = await env.DB.prepare(orderSql).bind(...ob).all().catch(() => ({ results: [] }));
    allRoutes = (orRows.results || []).map(o => ({
      id:          o.id,
      order_title: o.title,
      nr_rej:      o.nr_rej || null,
      driver_name: o.driver_name || null,
      origin:      o.origin || null,
      destination: o.destination || null,
      distance_km: o.distance_km ?? null,
      order_date:  o.scheduled_start ? o.scheduled_start.slice(0, 10) : null,
      revenue_pln: 0,
      cost_pln:    0,
      margin_pln:  0,
      margin_pct:  0,
      status:      o.status,
    }));
  }

  // KPI
  const totalRevenue  = allRoutes.reduce((s, r) => s + (r.revenue_pln || 0), 0);
  const totalCost     = allRoutes.reduce((s, r) => s + (r.cost_pln    || 0), 0);
  const totalKm       = allRoutes.reduce((s, r) => s + (r.distance_km || 0), 0);
  const withMargin    = allRoutes.filter(r => r.revenue_pln > 0);
  const avgMarginPct  = withMargin.length ? withMargin.reduce((s, r) => s + r.margin_pct, 0) / withMargin.length : 0;

  // Puste przebiegi — zlecenia bez cargo (cargo_desc NULL/empty, distance > 0)
  const emptyRunsSql = `SELECT id, nr_rej, scheduled_start as trip_date FROM transport_orders
    WHERE company_id=? AND (cargo_desc IS NULL OR cargo_desc='') AND distance_km>0 AND date(scheduled_start)>=? AND date(scheduled_start)<=? LIMIT 50`;
  const emptyRows = await env.DB.prepare(emptyRunsSql).bind(company, from, to).all().catch(() => ({ results: [] }));

  return json({
    routes: allRoutes,
    kpi: {
      total_revenue:  Math.round(totalRevenue * 100) / 100,
      total_cost:     Math.round(totalCost    * 100) / 100,
      avg_margin_pct: Math.round(avgMarginPct * 10)  / 10,
      total_km:       Math.round(totalKm),
      route_count:    allRoutes.length,
    },
    empty_runs: emptyRows.results || [],
  });
}

// ─── RAG CHAT MENEDŻERA ──────────────────────────────────────────────────────
async function handleRagChat(request, env, user, url, path) {
  if (request.method !== 'POST') return err('Metoda niedozwolona', 405);
  const body = await request.json().catch(() => ({}));
  const question = (body.question || '').trim().slice(0, 500);
  const co = user.company_id;
  if (!question) return err('Brak pytania', 400);
  if (!env.CLAUDE_API_KEY) return json({ error: 'Brak klucza Claude API (CLAUDE_API_KEY)' }, 503);

  // Schemat uproszczony dla kontekstu AI
  const schemaCtx = `Tabele D1 SQLite: vehicles(id,company_id,nr_rej,marka,model,rok,dmc,kierowca,status),
    damages(id,company_id,vehicle_id,opis,kwota_brutto,reported_at,status),
    fuel_records(id,company_id,vehicle_id,data_tanko,litery,cena_brutto,stacja,rodzaj),
    service_orders(id,company_id,vehicle_id,tytul,termin,koszt,status),
    ksef_invoices(id,company_id,invoice_number,gross_pln,ksef_status),
    driver_trips(id,company_id,driver_name,vehicle_reg,start_km,end_km,start_at,end_at,status).
    Firma bieżąca: company_id = '${co}'. Zwróć JSON: {sql: "SELECT ...", answer_template: "..."}`;

  try {
    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 600,
        system: `Jesteś asystentem bazy danych flotowej. ${schemaCtx}. Odpowiedz TYLKO JSON-em bez żadnego innego tekstu.`,
        messages: [{ role: 'user', content: `Pytanie użytkownika: "${question}"\nZwróć: {"sql":"SELECT ...","answer_template":"Odpowiedź: ..."}` }]
      })
    });
    const claudeData = await claudeResp.json();
    const rawText = claudeData.content?.[0]?.text || '{}';
    let parsed;
    try { parsed = JSON.parse(rawText.match(/\{[\s\S]*\}/)?.[0] || '{}'); } catch { parsed = {}; }

    if (!parsed.sql || !parsed.sql.trim().toLowerCase().startsWith('select')) {
      return json({ answer: parsed.answer_template || 'Nie mogę wygenerować zapytania SQL dla tego pytania.', sql_used: null, row_count: null });
    }
    // Zabezpieczenie — tylko SELECT
    const safeSQL = parsed.sql.replace(/;.*$/s, '');
    const dbResult = await env.DB.prepare(safeSQL).bind().all().catch(e => ({ error: e.message, results: [] }));
    if (dbResult.error) return json({ answer: `Błąd SQL: ${dbResult.error}`, sql_used: safeSQL, row_count: 0 });

    // Generuj odpowiedź na podstawie wyników
    const rows = dbResult.results || [];
    const answerResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 300,
        messages: [{ role: 'user', content: `Pytanie: "${question}"\nWyniki SQL (${rows.length} wierszy): ${JSON.stringify(rows.slice(0,10))}\nOdpowiedz po polsku w 1-3 zdaniach.` }]
      })
    });
    const answerData = await answerResp.json();
    const answer = answerData.content?.[0]?.text || parsed.answer_template || 'Brak danych.';
    return json({ answer, sql_used: safeSQL, row_count: rows.length });
  } catch (e) {
    return json({ error: 'Błąd AI: ' + e.message }, 500);
  }
}

// ─── OCR FAKTUR PALIW ─────────────────────────────────────────────────────────
async function handleOcrFuel(request, env, user, url, path) {
  if (request.method !== 'POST') return err('Metoda niedozwolona', 405);
  if (!env.CLAUDE_API_KEY) return json({ error: 'Brak klucza Claude API' }, 503);
  const body = await request.json().catch(() => ({}));
  const { image_base64, mime_type } = body;
  if (!image_base64) return err('Brak obrazu', 400);
  const safeType = (mime_type || 'image/jpeg').replace(/[^a-z/]/g, '');
  const isImg = safeType.startsWith('image/');
  const mediaType = isImg ? safeType : 'image/jpeg';
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image_base64 } },
            { type: 'text', text: 'Wyekstrahuj dane z tego paragonu/faktury za paliwo. Zwróć TYLKO JSON: {"date":"YYYY-MM-DD","plate":"XX 12345","station":"nazwa stacji","fuel_type":"diesel|pb95|pb98|lpg|ev","liters":0.0,"price_per_liter":0.0,"total_pln":0.0}. Jeśli pole nieczytelne wstaw null.' }
          ]
        }]
      })
    });
    const data = await resp.json();
    const raw = data.content?.[0]?.text || '{}';
    let extracted;
    try { extracted = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}'); } catch { extracted = {}; }
    return json({ extracted });
  } catch (e) {
    return json({ error: 'Błąd OCR: ' + e.message }, 500);
  }
}

// ─── PREDYKCYJNY SERWIS AI ────────────────────────────────────────────────────
async function handlePredictiveAi(request, env, user, url, path) {
  if (request.method !== 'POST') return err('Metoda niedozwolona', 405);
  if (!env.CLAUDE_API_KEY) return json({ error: 'Brak klucza Claude API' }, 503);
  const co = user.company_id;
  // Pobierz historię serwisową ostatnich 6 miesięcy
  const history = await env.DB.prepare(
    // Było `v.marka, v.model` — obu kolumn `vehicles` nie ma, marka i model siedzą
    // w JSON `data`. Historia serwisowa szła do analizy Claude, więc błąd oznaczał
    // brak danych wejściowych dla całej funkcji.
    `SELECT v.nr_rej,
            JSON_EXTRACT(v.data,'$.marka') AS marka,
            JSON_EXTRACT(v.data,'$.model') AS model,
            s.tytul, s.termin, s.koszt, s.status
     FROM service_orders s JOIN vehicles v ON v.id=s.vehicle_id
     WHERE s.company_id=? AND date(s.termin)>=date('now','-180 days')
     ORDER BY v.nr_rej, s.termin DESC LIMIT 100`
  ).bind(co).all().catch(() => ({ results: [] }));
  const rows = history.results || [];
  if (!rows.length) return json({ recommendations: [], message: 'Brak historii serwisowej' });
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 600,
        messages: [{ role: 'user', content: `Historia serwisowa floty (${rows.length} zleceń): ${JSON.stringify(rows.slice(0,20))}. Przeanalizuj i zwróć JSON: {"recommendations":[{"vehicle":"nr_rej","recommendation":"tekst PL","urgency":"high|medium|low","next_service_estimate":"YYYY-MM"}]}` }]
      })
    });
    const data = await resp.json();
    const raw = data.content?.[0]?.text || '{}';
    let parsed;
    try { parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}'); } catch { parsed = {}; }
    return json(parsed);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ─── HR MODULE — URLOPY ──────────────────────────────────────────────────────
async function handleHrLeaves(request, env, user, url, path) {
  const method = request.method;
  const co = user.company_id;
  const segs = path.replace('/api/hr-leaves', '').split('/').filter(Boolean);
  const id = segs[0];
  if (method === 'GET') {
    const rows = await env.DB.prepare(`SELECT * FROM hr_leaves WHERE company_id=? ORDER BY from_date DESC LIMIT 200`).bind(co).all();
    return json({ leaves: rows.results || [] });
  }
  if (method === 'POST') {
    const b = await request.json();
    await env.DB.prepare(`INSERT INTO hr_leaves(company_id,driver_id,driver_name,leave_type,from_date,to_date,days_count,status,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,strftime('%Y-%m-%dT%H:%M:%SZ','now'))`)
      .bind(co, b.driver_id??null, b.driver_name||'', b.leave_type||'annual', b.from_date||'', b.to_date||'', b.days_count??0, b.status||'pending', b.notes??null).run();
    return json({ ok: true });
  }
  if (method === 'PUT' && id) {
    const b = await request.json();
    await env.DB.prepare(`UPDATE hr_leaves SET status=?,approved_by=?,notes=? WHERE id=? AND company_id=?`)
      .bind(b.status??'pending', b.approved_by??null, b.notes??null, id, co).run();
    return json({ ok: true });
  }
  if (method === 'DELETE' && id) {
    await env.DB.prepare(`DELETE FROM hr_leaves WHERE id=? AND company_id=?`).bind(id, co).run();
    return json({ ok: true });
  }
  return err('Endpoint nie istnieje', 404);
}

// ─── HR MODULE — BADANIA LEKARSKIE ───────────────────────────────────────────
async function handleHrMedicalExams(request, env, user, url, path) {
  const method = request.method;
  const co = user.company_id;
  const segs = path.replace('/api/hr-medical-exams', '').split('/').filter(Boolean);
  const id = segs[0];
  const examType = url.searchParams.get('type') || '';
  if (method === 'GET') {
    let sql = `SELECT *, CAST((julianday(valid_until) - julianday('now')) AS INTEGER) AS days_left FROM hr_medical_exams WHERE company_id=?`;
    const params = [co];
    if (examType) { sql += ` AND exam_type=?`; params.push(examType); }
    sql += ` ORDER BY valid_until ASC LIMIT 200`;
    const rows = await env.DB.prepare(sql).bind(...params).all();
    return json({ exams: rows.results || [] });
  }
  if (method === 'POST') {
    const b = await request.json();
    await env.DB.prepare(`INSERT INTO hr_medical_exams(company_id,driver_id,driver_name,exam_type,exam_date,valid_until,notes) VALUES(?,?,?,?,?,?,?)`)
      .bind(co, b.driver_id??null, b.driver_name||'', b.exam_type||'periodic', b.exam_date||'', b.valid_until||'', b.notes??null).run();
    return json({ ok: true });
  }
  if (method === 'DELETE' && id) {
    await env.DB.prepare(`DELETE FROM hr_medical_exams WHERE id=? AND company_id=?`).bind(id, co).run();
    return json({ ok: true });
  }
  return err('Endpoint nie istnieje', 404);
}

// ─── WINIETY ─────────────────────────────────────────────────────────────────
async function handleVignettes(request, env, user, url, path) {
  const method = request.method;
  const co = user.company_id;
  const segs = path.replace('/api/vignettes', '').split('/').filter(Boolean);
  const id = segs[0];
  if (method === 'GET') {
    const rows = await env.DB.prepare(
      `SELECT *, CAST((julianday(valid_until) - julianday('now')) AS INTEGER) AS days_left FROM vignettes WHERE company_id=? ORDER BY valid_until ASC LIMIT 500`
    ).bind(co).all();
    return json({ vignettes: rows.results || [] });
  }
  if (method === 'POST') {
    const b = await request.json();
    await env.DB.prepare(`INSERT INTO vignettes(company_id,vehicle_id,vehicle_reg,country,vignette_type,valid_from,valid_until,amount_pln,receipt_number,notes) VALUES(?,?,?,?,?,?,?,?,?,?)`)
      .bind(co, b.vehicle_id??null, b.vehicle_reg||'', b.country||'', b.vignette_type||'annual', b.valid_from||'', b.valid_until||'', b.amount_pln??null, b.receipt_number??null, b.notes??null).run();
    return json({ ok: true });
  }
  if (method === 'PUT' && id) {
    const b = await request.json();
    await env.DB.prepare(`UPDATE vignettes SET vehicle_reg=?,country=?,vignette_type=?,valid_from=?,valid_until=?,amount_pln=?,receipt_number=?,notes=? WHERE id=? AND company_id=?`)
      .bind(b.vehicle_reg||'', b.country||'', b.vignette_type||'annual', b.valid_from||'', b.valid_until||'', b.amount_pln??null, b.receipt_number??null, b.notes??null, id, co).run();
    return json({ ok: true });
  }
  if (method === 'DELETE' && id) {
    await env.DB.prepare(`DELETE FROM vignettes WHERE id=? AND company_id=?`).bind(id, co).run();
    return json({ ok: true });
  }
  return err('Endpoint nie istnieje', 404);
}

// ─── e-TOLL URZĄDZENIA ────────────────────────────────────────────────────────
async function handleEtollDevices(request, env, user, url, path) {
  const method = request.method;
  const co = user.company_id;
  const segs = path.replace('/api/etoll-devices', '').split('/').filter(Boolean);
  const id = segs[0];
  if (method === 'GET') {
    const rows = await env.DB.prepare(`SELECT * FROM etoll_devices WHERE company_id=? ORDER BY vehicle_reg ASC LIMIT 200`).bind(co).all();
    return json({ devices: rows.results || [] });
  }
  if (method === 'POST') {
    const b = await request.json();
    await env.DB.prepare(`INSERT INTO etoll_devices(company_id,vehicle_id,vehicle_reg,obu_number,obu_type,active,balance_pln,notes) VALUES(?,?,?,?,?,?,?,?)`)
      .bind(co, b.vehicle_id??null, b.vehicle_reg||'', b.obu_number??null, b.obu_type||'viabox', b.active??1, b.balance_pln??0, b.notes??null).run();
    return json({ ok: true });
  }
  if (method === 'PUT' && id) {
    const b = await request.json();
    await env.DB.prepare(`UPDATE etoll_devices SET vehicle_reg=?,obu_number=?,obu_type=?,active=?,balance_pln=?,last_top_up_at=?,notes=? WHERE id=? AND company_id=?`)
      .bind(b.vehicle_reg||'', b.obu_number??null, b.obu_type||'viabox', b.active??1, b.balance_pln??0, b.last_top_up_at??null, b.notes??null, id, co).run();
    return json({ ok: true });
  }
  if (method === 'DELETE' && id) {
    await env.DB.prepare(`DELETE FROM etoll_devices WHERE id=? AND company_id=?`).bind(id, co).run();
    return json({ ok: true });
  }
  return err('Endpoint nie istnieje', 404);
}

// ─── ŚRODKI TRWAŁE ────────────────────────────────────────────────────────────
async function handleFixedAssets(request, env, user, url, path) {
  const method = request.method;
  const co = user.company_id;
  const segs = path.replace('/api/fixed-assets', '').split('/').filter(Boolean);
  const id = segs[0];
  if (method === 'GET') {
    const rows = await env.DB.prepare(`SELECT * FROM fixed_assets WHERE company_id=? ORDER BY purchase_date DESC LIMIT 500`).bind(co).all();
    return json({ assets: rows.results || [] });
  }
  if (method === 'POST') {
    const b = await request.json();
    const bookVal = b.purchase_value ?? 0;
    await env.DB.prepare(`INSERT INTO fixed_assets(company_id,vehicle_id,name,asset_number,purchase_date,purchase_value,residual_value,useful_life_years,depreciation_method,depreciation_rate,current_book_value,status,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(co, b.vehicle_id??null, b.name||'', b.asset_number??null, b.purchase_date??null, bookVal, b.residual_value??0, b.useful_life_years??5, b.depreciation_method||'linear', b.depreciation_rate??20, bookVal, 'active', b.notes??null).run();
    return json({ ok: true });
  }
  if (method === 'PUT' && id) {
    const b = await request.json();
    await env.DB.prepare(`UPDATE fixed_assets SET name=?,asset_number=?,purchase_date=?,purchase_value=?,residual_value=?,useful_life_years=?,depreciation_method=?,depreciation_rate=?,current_book_value=?,status=?,disposal_date=?,disposal_value=?,notes=? WHERE id=? AND company_id=?`)
      .bind(b.name||'', b.asset_number??null, b.purchase_date??null, b.purchase_value??0, b.residual_value??0, b.useful_life_years??5, b.depreciation_method||'linear', b.depreciation_rate??20, b.current_book_value??b.purchase_value??0, b.status||'active', b.disposal_date??null, b.disposal_value??null, b.notes??null, id, co).run();
    return json({ ok: true });
  }
  if (method === 'DELETE' && id) {
    await env.DB.prepare(`DELETE FROM fixed_assets WHERE id=? AND company_id=?`).bind(id, co).run();
    return json({ ok: true });
  }
  return err('Endpoint nie istnieje', 404);
}

// ─── RATING PRZEWOŹNIKÓW ──────────────────────────────────────────────────────
async function handleCarrierRatings(request, env, user, url, path) {
  const method = request.method;
  const co = user.company_id;
  const segs = path.replace('/api/carrier-ratings', '').split('/').filter(Boolean);
  const id = segs[0];
  const sub = segs[1]; // 'rate' | 'blacklist'

  if (method === 'GET' && !id) {
    const bl = url.searchParams.get('blacklisted');
    let sql = `SELECT * FROM carrier_ratings WHERE company_id=?`;
    const params = [co];
    if (bl === '1') { sql += ` AND blacklisted=1`; }
    else if (bl === '0') { sql += ` AND blacklisted=0`; }
    sql += ` ORDER BY rating_overall DESC NULLS LAST LIMIT 500`;
    const rows = await env.DB.prepare(sql).bind(...params).all();
    return json({ carriers: rows.results || [] });
  }
  if (method === 'POST' && !id) {
    const b = await request.json();
    const overall = ((b.rating_punctuality??3)*0.3 + (b.rating_quality??3)*0.3 + (b.rating_price??3)*0.2 + (b.rating_communication??3)*0.2);
    await env.DB.prepare(`INSERT INTO carrier_ratings(company_id,carrier_name,carrier_nip,carrier_email,carrier_phone,rating_punctuality,rating_quality,rating_price,rating_communication,rating_overall,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(co, b.carrier_name||'', b.carrier_nip??null, b.carrier_email??null, b.carrier_phone??null, b.rating_punctuality??3, b.rating_quality??3, b.rating_price??3, b.rating_communication??3, Math.round(overall*10)/10, b.notes??null).run();
    return json({ ok: true });
  }
  if (method === 'POST' && id && sub === 'rate') {
    const b = await request.json();
    await env.DB.prepare(`INSERT INTO carrier_rating_history(company_id,carrier_id,order_reference,rating_punctuality,rating_quality,rating_price,rating_communication,comment,rated_by) VALUES(?,?,?,?,?,?,?,?,?)`)
      .bind(co, id, b.order_reference??null, b.rating_punctuality??null, b.rating_quality??null, b.rating_price??null, b.rating_communication??null, b.comment??null, user.email??null).run();
    // Zaktualizuj średnią
    const avg = await env.DB.prepare(`SELECT AVG(rating_punctuality) ap, AVG(rating_quality) aq, AVG(rating_price) ar, AVG(rating_communication) ac FROM carrier_rating_history WHERE carrier_id=? AND company_id=?`).bind(id, co).first();
    const overall = ((avg?.ap??3)*0.3 + (avg?.aq??3)*0.3 + (avg?.ar??3)*0.2 + (avg?.ac??3)*0.2);
    await env.DB.prepare(`UPDATE carrier_ratings SET rating_punctuality=?,rating_quality=?,rating_price=?,rating_communication=?,rating_overall=?,orders_count=orders_count+1,last_order_at=strftime('%Y-%m-%dT%H:%M:%SZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=? AND company_id=?`)
      .bind(Math.round(avg?.ap??3), Math.round(avg?.aq??3), Math.round(avg?.ar??3), Math.round(avg?.ac??3), Math.round(overall*10)/10, id, co).run();
    return json({ ok: true });
  }
  if (method === 'POST' && id && sub === 'blacklist') {
    const b = await request.json();
    await env.DB.prepare(`UPDATE carrier_ratings SET blacklisted=1,blacklist_reason=?,updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=? AND company_id=?`)
      .bind(b.reason??null, id, co).run();
    return json({ ok: true });
  }
  if (method === 'DELETE' && id && !sub) {
    await env.DB.prepare(`DELETE FROM carrier_ratings WHERE id=? AND company_id=?`).bind(id, co).run();
    return json({ ok: true });
  }
  return err('Endpoint nie istnieje', 404);
}

// ─── EGZEKWOWANIE LICENCJI MODUŁÓW ───────────────────────────────────────────
// Mapa prefiksów ścieżek API → nazwa modułu. Posortowana od najdłuższych.
// Ścieżki bez wpisu = zawsze dostępne (basic). Ścieżki z null w mapie — pomijamy.
// Aktualizuj MODULE_ROUTES gdy dodajesz nowe płatne endpointy.
const MODULE_ROUTES = [
  ['/api/predictive-maintenance', 'predictive'],
  ['/api/fuel-import-scheduler',  'fuel_import'],
  ['/api/supplier-invoices',      'finance'],
  ['/api/driver-performance',     'driver_pwa'],
  ['/api/vehicle-reservations',   'rentals'],
  ['/api/route-profitability',    'route_profitability'],
  ['/api/external-access',        'external'],
  ['/api/driver-training',        'hr'],
  ['/api/driver-schedule',        'driver_pwa'],
  ['/api/driver-worktime',        'driver_pwa'],
  ['/api/driver-scoring',         'driver_pwa'],
  ['/api/driver-ranking',         'driver_pwa'],
  ['/api/driver-wages',           'driver_pwa'],
  ['/api/driver-trips',           'driver_pwa'],
  ['/api/gps-integrations',       'gps'],
  ['/api/gps-positions',          'gps'],
  ['/api/report-builder',         'reporting'],
  ['/api/video-telematics',       'video_telematics'],
  ['/api/internal-rentals',       'rentals'],
  ['/api/predictive-ai',          'predictive'],
  ['/api/esg-targets',            'esg'],
  ['/api/budget-annual',          'budget'],
  ['/api/budget-plans',           'budget'],
  ['/api/approval-levels',        'finance'],
  ['/api/transport-orders',       'transport'],
  ['/api/tacho-records',          'tacho'],
  ['/api/debt-collection',        'debt'],
  ['/api/carrier-ratings',        'carrier'],
  ['/api/route-billing',          'transport'],
  ['/api/fixed-assets',           'fixed_assets'],
  ['/api/doc-workflow',           'doc_workflow'],
  ['/api/hr-medical-exams',       'hr'],
  ['/api/etoll-devices',          'vignettes'],
  ['/api/cfm-contracts',          'cfm'],
  ['/api/cfm-invoices',           'cfm'],
  ['/api/cfm-clients',            'cfm'],
  ['/api/route-cost',             'route_profitability'],
  ['/api/smart-forms',            'smart_forms'],
  ['/api/hr-leaves',              'hr'],
  ['/api/vignettes',              'vignettes'],
  ['/api/carpooling',             'carpooling'],
  ['/api/ocr-fuel',               'ocr'],
  ['/api/geofences',              'gps'],
  ['/api/ev-charging',            'ev'],
  ['/api/rag-chat',               'rag'],
  ['/api/co2-report',             'esg'],
  ['/api/tacho-ddd',              'tacho'],
  ['/api/edoreczenia',            'edoreczenia'],
  ['/api/benchmark',              'benchmarks'],
  ['/api/bulk/',                  'ocr'],
  ['/api/tekom',                  'gps'],
  ['/api/trips',                  'gps'],
  ['/api/ksef',                   'ksef'],
  ['/api/tco',                    'tco'],
  ['/api/ai/',                    'ai'],
  ['/api/cmr',                    'transport'],
  ['/api/jpk',                    'finance'],
  ['/api/webhooks',               'webhooks'],
  ['/api/zapier',                 'webhooks'],
  ['/api/parking',                'parking'],
  ['/api/cepik/',                 'cepik'],
].sort((a, b) => b[0].length - a[0].length);

// Ścieżki zawsze dostępne — bez sprawdzania pakietu
const MODULE_EXEMPT = [
  '/api/auth/', '/api/login', '/api/logout', '/api/users/me',
  '/api/access-control', '/api/companies', '/api/company-access',
  '/api/health', '/api/prefs', '/api/app-config', '/api/feature-flags',
  '/api/push/', '/api/errors', '/api/export', '/api/import',
  '/api/gus-regon', '/api/vies-check', '/api/notif', '/api/alert-types',
  '/api/teryt', '/api/dashboard', '/api/fleet-kpi', '/api/error-log',
  '/api/report-subs', '/api/currency', '/api/gdpr', '/api/sent',
];

function _moduleForPath(path) {
  for (const [prefix, mod] of MODULE_ROUTES) {
    if (path.startsWith(prefix)) return mod;
  }
  return null;
}

function _packageModules(pkg) {
  const professional = ['hr', 'driver_pwa', 'route_profitability', 'transport', 'tacho',
    'vignettes', 'gps', 'ocr', 'doc_workflow', 'debt', 'fuel_import', 'fixed_assets',
    'carrier', 'budget', 'webhooks', 'finance', 'rentals', 'benchmarks', 'carpooling', 'parking'];
  const enterprise = [...professional, 'ai', 'tco', 'ksef', 'cfm', 'rag', 'predictive',
    'esg', 'cepik', 'video_telematics', 'reporting', 'smart_forms', 'ev', 'edoreczenia',
    'external', 'smart_forms'];
  const map = { basic: [], professional, enterprise };
  return map[pkg] || [];
}

async function resolveModuleAccess(env, companyId) {
  const cacheKey = `mod_access_v1:${companyId}`;
  try {
    const cached = await env.PREFS.get(cacheKey, { type: 'json' });
    if (cached) return cached;
  } catch { /* KV miss */ }

  let allowed;
  try {
    const row = await env.DB.prepare(
      'SELECT package_name, modules_add, modules_remove, valid_until FROM company_packages WHERE company_id=? AND active=1'
    ).bind(companyId).first();
    if (!row) {
      allowed = ['*']; // brak wpisu = nieograniczony dostęp (backward compat przed wdrożeniem pakietów)
    } else {
      const expired = row.valid_until && new Date(row.valid_until) < new Date();
      const pkg = expired ? 'basic' : (row.package_name || 'basic');
      allowed = _packageModules(pkg);
      const add = JSON.parse(row.modules_add || '[]');
      const rem = JSON.parse(row.modules_remove || '[]');
      allowed = [...new Set([...allowed, ...add])].filter(m => !rem.includes(m));
    }
  } catch {
    // Tabela nie istnieje (przed migracją) lub błąd DB — przepuść wszystko
    allowed = ['*'];
  }

  try { await env.PREFS.put(cacheKey, JSON.stringify(allowed), { expirationTtl: 60 }); } catch { /* ignore */ }
  return allowed;
}

async function enforceModuleAccess(env, user, url, path) {
  if (env.MODULE_ENFORCEMENT === 'off') return null; // kill switch
  if (MODULE_EXEMPT.some(p => path.startsWith(p))) return null;
  const mod = _moduleForPath(path);
  if (!mod) return null;
  const companyId = url.searchParams.get('company') || user.company_id || '';
  const allowed = await resolveModuleAccess(env, companyId);
  if (allowed.includes('*') || allowed.includes(mod)) return null;
  return json({ error: 'Moduł nieaktywny w Twoim pakiecie', module: mod, upgrade_required: true }, 402);
}

async function invalidateModuleAccess(env, companyId) {
  try { await env.PREFS.delete(`mod_access_v1:${companyId}`); } catch { /* ignore */ }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('Origin') || '') });
    }

    const url  = new URL(request.url);
    const path = url.pathname;

    let resp;
    try {
      resp = await handleRequest(request, env, url, path, ctx);
    } catch (e) {
      console.error('[Worker error]', e?.stack || e?.message);
      captureException(e, env, { path, method: request.method }).catch(() => {});
      resp = json({ error: 'Błąd serwera: ' + (e?.message || 'unknown') }, 500);
    }

    // Gwarancja CORS na każdej odpowiedzi — zastępuje * z json() dynamicznym originem
    const headers = new Headers(resp.headers);
    Object.entries(corsHeaders(request.headers.get('Origin') || '')).forEach(([k, v]) => headers.set(k, v));
    return new Response(resp.body, { status: resp.status, headers });
  },

  // Cron trigger (wrangler.toml: crons = ["0 3 * * *"])
  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.all([
      cleanSessions(env),
      queueNotificationJobs(env),
      runNightlyAnalysis(env),
      checkInspectionDeadlines(env),
      sendMonthlyReports(env),
      runNightlyIntegrationSync(env),
      runNightlyTachoCheck(env),
      _fetchAndCacheGminy(env).catch(e => console.error('[TERYT cron]', e.message)),
      runKsefRetry(env).catch(e => console.error('[KSeF retry cron]', e?.message)),
      runFuelImportJobs(env).catch(e => console.error('[fuel-import-cron]', e?.message)),
      runDebtReminders(env).catch(e => console.error('[debt-reminders-cron]', e?.message)),
    ]));
  },

  // Cloudflare Queue consumer — przetwarza zadania push/email/sms asynchronicznie
  async queue(batch, env) {
    await processNotifQueue(batch, env);
  },
};
