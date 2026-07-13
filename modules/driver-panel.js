(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmtN = (v, d = 0) => v != null ? parseFloat(v).toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

  async function renderDriverPanel() {
    const co   = Co();
    const user = window._currentUser || {};
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.name || user.email || '';

    const el = document.getElementById('page-driver-panel');
    if (!el) return;

    el.innerHTML = `<div class="page-header"><h2><i class="ti ti-steering-wheel"></i> Mój panel kierowcy</h2></div>
<p style="color:var(--text-muted);margin-bottom:20px">Witaj${name ? ', <strong>' + e(name) + '</strong>' : ''}! Oto Twoje dane.</p>
<div id="dp-content" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start">
  <div id="dp-shifts" style="background:var(--bg-card);border-radius:var(--radius);padding:16px;border:1px solid var(--border)"><i class="ti ti-loader ti-spin"></i> Ładowanie...</div>
  <div id="dp-fault-form" style="background:var(--bg-card);border-radius:var(--radius);padding:16px;border:1px solid var(--border)">
    <h3 style="font-size:14px;margin-bottom:12px"><i class="ti ti-alert-triangle"></i> Zgłoś usterkę</h3>
    <div class="f" style="margin-bottom:8px"><label>Nr rej. pojazdu</label><input id="dp-fault-nrrej" class="form-input" placeholder="np. WA1234X"></div>
    <div class="f" style="margin-bottom:8px"><label>Opis usterki</label><textarea id="dp-fault-desc" class="form-input" rows="3" placeholder="Opisz usterkę..."></textarea></div>
    <div class="f" style="margin-bottom:12px"><label>Ciężkość</label>
      <select id="dp-fault-sev" class="form-input">
        <option value="low">Niska</option><option value="medium" selected>Średnia</option><option value="high">Wysoka</option>
      </select>
    </div>
    <button class="btn-primary" onclick="window.DriverPanelModule.submitFault()"><i class="ti ti-send"></i> Zgłoś</button>
  </div>
  <div id="dp-claims" style="background:var(--bg-card);border-radius:var(--radius);padding:16px;border:1px solid var(--border)"><i class="ti ti-loader ti-spin"></i> Ładowanie...</div>
  <div id="dp-orders" style="background:var(--bg-card);border-radius:var(--radius);padding:16px;border:1px solid var(--border)"><i class="ti ti-loader ti-spin"></i> Ładowanie...</div>
</div>`;

    try {
      const params = `company=${encodeURIComponent(co)}&limit=10`;
      const nameParam = name ? `&driver_name=${encodeURIComponent(name)}` : '';
      const [shiftsR, claimsR, ordersR] = await Promise.all([
        fetch(`${API()}/api/driver-shifts?${params}${nameParam}`, { headers: H() }),
        fetch(`${API()}/api/mileage-claims?${params}${user.id ? '&driver_id='+encodeURIComponent(user.id) : nameParam}`, { headers: H() }),
        fetch(`${API()}/api/transport-orders?${params}${nameParam}`, { headers: H() }),
      ]);

      const shifts = shiftsR.ok ? await shiftsR.json() : [];
      const claims = claimsR.ok ? await claimsR.json() : [];
      const orders = ordersR.ok ? await ordersR.json() : [];

      document.getElementById('dp-shifts').innerHTML = `
        <h3 style="font-size:14px;margin-bottom:10px"><i class="ti ti-clock"></i> Moje ostatnie zmiany</h3>
        ${shifts.length ? `<table class="data-table" style="font-size:12px"><thead><tr><th>Data</th><th>Pojazd</th><th>Km</th></tr></thead><tbody>
        ${shifts.map(s => `<tr><td>${e(s.shift_date||'')}</td><td>${e(s.nr_rej||'—')}</td><td>${s.end_km&&s.start_km?fmtN(s.end_km-s.start_km)+' km':'—'}</td></tr>`).join('')}
        </tbody></table>` : '<p style="color:var(--text-muted);font-size:13px">Brak zmian</p>'}`;

      document.getElementById('dp-claims').innerHTML = `
        <h3 style="font-size:14px;margin-bottom:10px"><i class="ti ti-receipt"></i> Moje rozliczenia km</h3>
        ${claims.length ? `<table class="data-table" style="font-size:12px"><thead><tr><th>Data</th><th>Km</th><th>Kwota</th><th>Status</th></tr></thead><tbody>
        ${claims.map(c => `<tr><td>${e(c.claim_date||'')}</td><td>${fmtN(c.km_driven)} km</td><td>${fmtN(c.amount_pln,2)} PLN</td>
        <td><span class="pill ${c.status==='approved'?'ok':c.status==='rejected'?'danger':'warn'}">${e(c.status||'pending')}</span></td></tr>`).join('')}
        </tbody></table>` : '<p style="color:var(--text-muted);font-size:13px">Brak rozliczeń</p>'}`;

      document.getElementById('dp-orders').innerHTML = `
        <h3 style="font-size:14px;margin-bottom:10px"><i class="ti ti-truck"></i> Moje zlecenia transportowe</h3>
        ${orders.length ? `<table class="data-table" style="font-size:12px"><thead><tr><th>Tytuł</th><th>Start</th><th>Status</th></tr></thead><tbody>
        ${orders.map(o => `<tr><td>${e(o.title)}</td><td style="white-space:nowrap">${e(o.scheduled_start?.slice(0,16)||'')}</td>
        <td><span class="pill ${o.status==='completed'?'ok':o.status==='in_progress'?'warn':''}">${e(o.status||'')}</span></td></tr>`).join('')}
        </tbody></table>` : '<p style="color:var(--text-muted);font-size:13px">Brak zleceń</p>'}`;
    } catch {}
  }

  async function submitFault() {
    const nrRej = document.getElementById('dp-fault-nrrej')?.value?.trim();
    const desc  = document.getElementById('dp-fault-desc')?.value?.trim();
    const sev   = document.getElementById('dp-fault-sev')?.value || 'medium';
    if (!nrRej || !desc) { alert('Podaj nr rej. i opis usterki'); return; }
    const user = window._currentUser || {};
    try {
      const r = await fetch(`${API()}/api/faults?company=${encodeURIComponent(Co())}`, {
        method: 'POST', headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ nr_rej: nrRej, description: desc, severity: sev, driver_name: user.name || user.email || '' }),
      });
      if (!r.ok) throw new Error(await r.text());
      alert('Usterka zgłoszona!');
      document.getElementById('dp-fault-nrrej').value = '';
      document.getElementById('dp-fault-desc').value  = '';
    } catch (ex) { alert('Błąd: ' + ex.message); }
  }

  window.DriverPanelModule = { renderDriverPanel, submitFault };
})();
