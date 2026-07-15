(function () {
  'use strict';

  const API = window.API || 'https://taxorder-pro-api.adamus1000.workers.dev';
  let clerk = null;
  let _injected = false;

  function _showErr(msg) {
    const el = document.getElementById('login-err');
    if (el) { el.textContent = msg; el.style.display = 'flex'; }
    else console.error('[ClerkAuth]', msg);
  }

  async function _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[data-clerk-js]`)) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.crossOrigin = 'anonymous';
      s.dataset.clerkJs = '1';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Nie udało się załadować Clerk JS'));
      document.head.appendChild(s);
    });
  }

  async function _exchangeClerkToken(session) {
    try {
      const clerkToken = await session.getToken();
      if (!clerkToken) throw new Error('Brak tokenu sesji Clerk');
      const res = await fetch(`${API}/api/auth/clerk-signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerk_token: clerkToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Błąd logowania przez Clerk');
      localStorage.setItem('cf_token', data.token);
      window.location.reload();
    } catch (e) {
      _showErr(e.message);
    }
  }

  function _injectButton(publishableKey) {
    if (_injected) return;
    const loginBtn = document.getElementById('login-btn');
    if (!loginBtn) return;
    _injected = true;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'clerk-login-btn';
    btn.className = 'btn';
    btn.style.cssText = 'width:100%;justify-content:center;padding:12px;font-size:14px;margin-top:10px;border:1.5px solid #6c47ff;color:#6c47ff;background:transparent;gap:10px;display:flex;align-items:center';
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>Zaloguj przez Clerk';
    btn.onclick = signInWithClerk;
    loginBtn.parentNode.insertBefore(btn, loginBtn.nextSibling);
  }

  async function signInWithClerk() {
    if (!clerk) { _showErr('Clerk nie jest załadowany'); return; }
    const btn = document.getElementById('clerk-login-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Ładowanie...'; }

    try {
      let unsub;
      unsub = clerk.addListener(async ({ session }) => {
        if (!session) return;
        unsub();
        await _exchangeClerkToken(session);
      });
      clerk.openSignIn();
    } catch (e) {
      _showErr(e.message);
      if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>Zaloguj przez Clerk'; }
    }
  }

  async function init() {
    try {
      const res = await fetch(`${API}/api/app-config`).catch(() => null);
      if (!res?.ok) return;
      const cfg = await res.json().catch(() => ({}));
      if (!cfg.clerk_publishable_key) return;

      await _loadScript('https://npm.clerk.com/npm/@clerk/clerk-js@latest/dist/clerk.browser.js');
      clerk = new window.Clerk(cfg.clerk_publishable_key);
      await clerk.load();

      // If already signed in via Clerk, silently exchange token
      if (clerk.session) {
        const existing = localStorage.getItem('cf_token');
        if (!existing) await _exchangeClerkToken(clerk.session);
      }

      _injectButton();
    } catch (e) {
      console.warn('[ClerkAuth] Inicjalizacja nieudana:', e.message);
    }
  }

  window.ClerkAuth = { init, signInWithClerk };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
