/**
 * TaxOrder Pro — Panel zewnętrzny (klient/przewoźnik)
 * Generowanie tokenów dostępu dla klientów i przewoźników
 * SCHEMA_NEEDED: uruchom worker/schema_v47.sql (external_access_tokens)
 */
window.ExternalPanel = (function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtD = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pl-PL') : '—';

  let _tokens = [];

  const ACCESS_TYPES = {
    client:  { lbl: 'Klient',      icon: 'ti-building' },
    carrier: { lbl: 'Przewoźnik',  icon: 'ti-truck' },
  };
  const RESOURCES = [
    { key: 'orders',    lbl: 'Zlecenia transportowe' },
    { key: 'documents', lbl: 'Dokumenty pojazdów' },
    { key: 'invoices',  lbl: 'Faktury' },
    { key: 'positions', lbl: 'Pozycje GPS (live)' },
  ];

  async function _load() {
    const co = Co();
    try {
      const r = await fetch(`${API()}/api/external-access?company=${encodeURIComponent(co)}`, { headers: H() });
      if (r.ok) _tokens = await r.json();
    } catch {}
  }

  async function renderExternalPanel() {
    const el = document.getElementById('page-external-panel');
    if (!el) return;
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)"><i class="ti ti-loader" style="font-size:32px"></i></div>`;
    await _load();
    _render();
  }

  function _render() {
    const el = document.getElementById('page-external-panel');
    if (!el) return;

    const active   = _tokens.filter(t => t.active);
    const inactive = _tokens.filter(t => !t.active);

    el.innerHTML = `
<div class="page-header" style="margin-bottom:16px">
  <div>
    <h2 style="margin:0"><i class="ti ti-users"></i> Panel zewnętrzny — dostęp klientów</h2>
    <p style="margin:4px 0 0;font-size:13px;color:var(--text3)">Generuj jednorazowe linki dla klientów i przewoźników do podglądu zleceń i dokumentów.</p>
  </div>
  <button class="btn-primary" onclick="window.ExternalPanel.openAddModal()">
    <i class="ti ti-plus"></i> Nowy token dostępu
  </button>
</div>

<!-- Info box -->
<div style="background:rgba(37,99,235,.08);border:1px solid rgba(37,99,235,.2);border-radius:8px;padding:12px 16px;margin-bottom:18px;font-size:13px">
  <i class="ti ti-info-circle" style="color:var(--primary)"></i>
  Wygenerowane tokeny tworzą linki w formacie: <code style="font-size:12px">${e(location.origin)}/?ext_token=<em>TOKEN</em></code><br>
  Dostęp jest read-only. Token można cofnąć w dowolnym momencie.
</div>

<!-- Aktywne tokeny -->
<h3 style="font-size:14px;margin:0 0 10px">Aktywne tokeny (${active.length})</h3>
${active.length ? `
<div class="table-wrap" style="overflow-x:auto;margin-bottom:20px">
<table class="data-table">
<thead><tr>
  <th>Nazwa</th>
  <th>Typ</th>
  <th>Email</th>
  <th>Uprawnienia</th>
  <th>Ważność</th>
  <th>Ostatnio użyty</th>
  <th>Akcje</th>
</tr></thead>
<tbody>
${active.map(t => {
  const typ     = ACCESS_TYPES[t.access_type] || ACCESS_TYPES.client;
  let resources = [];
  try { resources = JSON.parse(t.allowed_resources || '[]'); } catch {}
  const resLabels = resources.map(k => RESOURCES.find(r => r.key === k)?.lbl || k).join(', ');
  const expired   = t.expires_at && new Date(t.expires_at) < new Date();
  return `<tr style="opacity:${expired?0.6:1}">
    <td>
      <strong>${e(t.client_name)}</strong>
      ${expired ? '<span style="font-size:10px;color:var(--red);margin-left:6px">Wygasł</span>' : ''}
    </td>
    <td><i class="ti ${typ.icon}"></i> ${e(typ.lbl)}</td>
    <td style="font-size:12px">${e(t.client_email||'—')}</td>
    <td style="font-size:12px;color:var(--text3)">${e(resLabels||'Brak uprawnień')}</td>
    <td style="font-size:12px">${fmtD(t.expires_at?.slice?.(0,10)) || 'Bezterminowy'}</td>
    <td style="font-size:12px;color:var(--text3)">${t.last_used_at ? new Date(t.last_used_at).toLocaleDateString('pl-PL') : 'Nigdy'}</td>
    <td>
      <div style="display:flex;gap:4px">
        <button class="btn-secondary" style="font-size:11px;padding:4px 8px"
          data-token="${e(t.token)}" onclick="window.ExternalPanel.copyLink(this.dataset.token)" title="Kopiuj link">
          <i class="ti ti-link"></i> Kopiuj link
        </button>
        <button class="btn-danger" style="font-size:11px;padding:4px 8px"
          data-id="${e(t.id)}" onclick="window.ExternalPanel.revokeToken(this.dataset.id)" title="Cofnij dostęp">
          <i class="ti ti-ban"></i>
        </button>
      </div>
    </td>
  </tr>`;
}).join('')}
</tbody>
</table>
</div>` : `<div style="padding:30px;text-align:center;color:var(--text3);border:1px dashed var(--border);border-radius:8px;margin-bottom:20px">
  Brak aktywnych tokenów. Kliknij "Nowy token dostępu" aby wygenerować link dla klienta.
</div>`}

<!-- Cofnięte/nieaktywne -->
${inactive.length ? `
<details style="margin-top:8px">
  <summary style="font-size:13px;color:var(--text3);cursor:pointer">Cofnięte tokeny (${inactive.length})</summary>
  <div class="table-wrap" style="overflow-x:auto;margin-top:8px">
    <table class="data-table" style="opacity:.6">
    <thead><tr><th>Nazwa</th><th>Typ</th><th>Wygasł / Cofnięty</th></tr></thead>
    <tbody>
    ${inactive.map(t => `<tr>
      <td>${e(t.client_name)}</td>
      <td>${e((ACCESS_TYPES[t.access_type]||ACCESS_TYPES.client).lbl)}</td>
      <td style="font-size:12px;color:var(--text3)">${fmtD(t.expires_at?.slice?.(0,10))}</td>
    </tr>`).join('')}
    </tbody>
    </table>
  </div>
</details>` : ''}

<!-- Modal -->
<div id="ep-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;align-items:center;justify-content:center" onclick="if(event.target===this)window.ExternalPanel.closeModal()"></div>
`;
  }

  function openAddModal() {
    const modal = document.getElementById('ep-modal');
    if (!modal) return;
    const next30 = new Date(Date.now() + 30*86400000).toISOString().slice(0,10);
    modal.style.display = 'flex';
    modal.innerHTML = `
<div style="background:var(--bg);border-radius:12px;padding:24px;width:480px;max-width:95vw;box-shadow:0 8px 32px rgba(0,0,0,.25)">
  <h3 style="margin:0 0 16px;font-size:16px"><i class="ti ti-key"></i> Nowy token dostępu zewnętrznego</h3>
  <div style="display:flex;flex-direction:column;gap:11px">
    <label style="font-size:12px;color:var(--text3)">Nazwa klienta / przewoźnika *
      <input id="ep-name" class="sel" style="width:100%;margin-top:3px" placeholder="Firma ABC Sp. z o.o.">
    </label>
    <label style="font-size:12px;color:var(--text3)">Email (opcjonalnie)
      <input id="ep-email" class="sel" style="width:100%;margin-top:3px" type="email" placeholder="kontakt@firma.pl">
    </label>
    <label style="font-size:12px;color:var(--text3)">Typ dostępu
      <select id="ep-type" class="sel" style="width:100%;margin-top:3px">
        <option value="client">Klient (podgląd zleceń)</option>
        <option value="carrier">Przewoźnik (podgląd tras)</option>
      </select>
    </label>
    <div>
      <span style="font-size:12px;color:var(--text3);display:block;margin-bottom:6px">Uprawnienia (co może zobaczyć):</span>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        ${RESOURCES.map(r => `
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
          <input type="checkbox" class="ep-res" value="${r.key}" ${r.key==='orders'?'checked':''}> ${r.lbl}
        </label>`).join('')}
      </div>
    </div>
    <label style="font-size:12px;color:var(--text3)">Data ważności (puste = bezterminowy)
      <input id="ep-exp" class="sel" style="width:100%;margin-top:3px" type="date" value="${next30}">
    </label>
  </div>
  <div style="display:flex;gap:8px;margin-top:18px;justify-content:flex-end">
    <button class="btn-secondary" onclick="window.ExternalPanel.closeModal()">Anuluj</button>
    <button class="btn-primary" onclick="window.ExternalPanel.saveToken()"><i class="ti ti-key"></i> Generuj token</button>
  </div>
</div>`;
  }

  function closeModal() {
    const m = document.getElementById('ep-modal');
    if (m) m.style.display = 'none';
  }

  async function saveToken() {
    const name  = document.getElementById('ep-name')?.value.trim();
    const email = document.getElementById('ep-email')?.value.trim()||null;
    const type  = document.getElementById('ep-type')?.value || 'client';
    const exp   = document.getElementById('ep-exp')?.value || null;
    const res   = [...document.querySelectorAll('.ep-res:checked')].map(c => c.value);

    if (!name) { if(typeof toast==='function') toast('Podaj nazwę','error'); return; }

    const co = Co();
    try {
      const r = await fetch(`${API()}/api/external-access?company=${encodeURIComponent(co)}`, {
        method: 'POST',
        headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: name, client_email: email, access_type: type, expires_at: exp, allowed_resources: res }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Błąd'); }
      const d = await r.json();
      closeModal();
      // Show link in a new dialog
      const link = `${location.origin}/?ext_token=${d.token}`;
      _showLinkDialog(name, link);
      renderExternalPanel();
    } catch(ex) {
      if(typeof toast==='function') toast(ex.message,'error');
    }
  }

  // Przechowuje link dla dialogu (lokalnie — bez interpolacji w onclick)
  let _pendingLink = '';

  function _showLinkDialog(name, link) {
    _pendingLink = link;
    const modal = document.getElementById('ep-modal');
    if (!modal) { navigator.clipboard?.writeText(link); if(typeof toast==='function') toast('Link skopiowany'); return; }
    modal.style.display = 'flex';
    modal.innerHTML = `
<div style="background:var(--bg);border-radius:12px;padding:24px;width:480px;max-width:95vw;box-shadow:0 8px 32px rgba(0,0,0,.25)">
  <h3 style="margin:0 0 10px;font-size:16px;color:var(--green)"><i class="ti ti-check-circle"></i> Token wygenerowany!</h3>
  <p style="font-size:13px;color:var(--text2)">Link dla: <strong>${e(name)}</strong></p>
  <div style="background:var(--bg2);border-radius:6px;padding:10px 12px;word-break:break-all;font-size:12px;font-family:monospace;border:1px solid var(--border);margin:10px 0">${e(link)}</div>
  <p style="font-size:12px;color:var(--text3)">Wyślij ten link klientowi. Posiada on dostęp read-only do wybranych sekcji. Link można cofnąć w dowolnym momencie.</p>
  <div style="display:flex;gap:8px;justify-content:flex-end">
    <button class="btn-secondary" onclick="window.ExternalPanel.closeModal()">Zamknij</button>
    <button class="btn-primary" onclick="window.ExternalPanel._copyPendingLink()">
      <i class="ti ti-copy"></i> Kopiuj link
    </button>
  </div>
</div>`;
  }

  function _copyPendingLink() {
    if (!_pendingLink) return;
    navigator.clipboard?.writeText(_pendingLink).then(() => {
      if(typeof toast==='function') toast('Link skopiowany do schowka');
    }).catch(() => { prompt('Skopiuj link ręcznie:', _pendingLink); });
    closeModal();
  }

  function copyLink(token) {
    const link = `${location.origin}/?ext_token=${token}`;
    navigator.clipboard?.writeText(link).then(() => {
      if(typeof toast==='function') toast('Link skopiowany do schowka');
    }).catch(() => {
      prompt('Skopiuj link ręcznie:', link);
    });
  }

  async function revokeToken(id) {
    if (!confirm('Cofnąć dostęp? Token przestanie działać natychmiast.')) return;
    const co = Co();
    try {
      const r = await fetch(`${API()}/api/external-access/${id}?company=${encodeURIComponent(co)}`, { method: 'DELETE', headers: H() });
      if (!r.ok) throw new Error('Błąd');
      if(typeof toast==='function') toast('Token cofnięty');
      renderExternalPanel();
    } catch(ex) {
      if(typeof toast==='function') toast(ex.message,'error');
    }
  }

  return { renderExternalPanel, openAddModal, closeModal, saveToken, copyLink, revokeToken, _copyPendingLink };
})();
