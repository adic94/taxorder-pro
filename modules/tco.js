(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmtN = (v, d = 0) => v != null ? parseFloat(v).toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const fmtPLN = v => v != null ? fmtN(v, 2) + ' PLN' : '—';

  let _data = [];

  async function renderTco() {
    const co = Co();
    try {
      const r = await fetch(`${API()}/api/tco?company=${encodeURIComponent(co)}`, { headers: H() });
      if (r.ok) _data = await r.json();
    } catch {}
    _render();
  }

  function _render() {
    const el = document.getElementById('page-tco');
    if (!el) return;
    let totalMon = 0;
    _data.forEach(v => { totalMon += v.costs?.tco_monthly ?? 0; });

    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-calculator"></i> TCO — Całkowity koszt posiadania</h2>
  <div style="display:flex;gap:6px">
    ${_data.length ? `<button class="btn-secondary" onclick="window.TcoModule.askAiForecast()"><i class="ti ti-robot"></i> Prognoza AI</button>` : ''}
    <button class="btn-primary" onclick="window.TcoModule.openModal()"><i class="ti ti-plus"></i> Skonfiguruj pojazd</button>
  </div>
</div>
${_data.length ? `<div class="kpi-chip" style="margin-bottom:16px;display:inline-flex">
  <i class="ti ti-coin"></i><span class="kpi-val">${fmtPLN(totalMon)}</span><span class="kpi-lbl">Łączne TCO / miesiąc</span>
</div>` : ''}
<div class="table-wrap"><table class="data-table">
<thead><tr>
  <th>Nr rej.</th><th>Pojazd</th><th>Cena zakupu</th><th>Amort./mies.</th><th>Leasing/mies.</th>
  <th>Paliwo/mies.</th><th>Serwis/mies.</th><th>TCO/mies.</th><th>TCO/rok</th><th></th>
</tr></thead>
<tbody>
${_data.length ? _data.map(v => {
  const c = v.costs || {};
  return `<tr>
  <td><strong>${e(v.nr_rej || '—')}</strong></td>
  <td>${e([v.make, v.model, v.vehicle_year].filter(Boolean).join(' ') || '—')}</td>
  <td>${fmtPLN(v.purchase_price)}</td>
  <td>${fmtPLN(c.depreciation_monthly)}</td>
  <td>${fmtPLN(v.monthly_leasing)}</td>
  <td>${fmtPLN(c.fuel_12m ? c.fuel_12m / 12 : null)}</td>
  <td>${fmtPLN(c.service_12m ? c.service_12m / 12 : null)}</td>
  <td style="font-weight:600">${fmtPLN(c.tco_monthly)}</td>
  <td>${fmtPLN(c.tco_annual)}</td>
  <td style="display:flex;gap:4px">
    <button class="btn-icon" data-vid="${e(v.vehicle_id)}" onclick="window.TcoModule.openModal(this.dataset.vid)"><i class="ti ti-edit"></i></button>
    <button class="btn-icon danger" data-vid="${e(v.vehicle_id)}" onclick="window.TcoModule.deleteTco(this.dataset.vid)"><i class="ti ti-trash"></i></button>
  </td>
</tr>`;
}).join('') : '<tr><td colspan="10" class="empty">Brak konfiguracji TCO — dodaj pojazd</td></tr>'}
${_data.length ? `<tr style="font-weight:600;background:var(--bg-card)">
  <td colspan="7">Suma TCO</td><td>${fmtPLN(totalMon)}</td><td>${fmtPLN(totalMon * 12)}</td><td></td>
</tr>` : ''}
</tbody></table></div>
<p style="font-size:12px;color:var(--text-muted);margin-top:8px">Koszty paliwa i serwisu na podstawie ostatnich 12 miesięcy</p>`;
  }

  function openModal(vehicleId) {
    const v = vehicleId ? _data.find(x => x.vehicle_id === vehicleId) : null;
    const modal = document.getElementById('tco-modal');
    if (!modal) return;
    const gi = k => document.getElementById(k);
    gi('tco-vid').value      = v?.vehicle_id || '';
    gi('tco-nrrej').value    = v?.nr_rej || '';
    gi('tco-price').value    = v?.purchase_price || '';
    gi('tco-date').value     = v?.purchase_date || '';
    gi('tco-life').value     = v?.expected_life_years || 5;
    gi('tco-residual').value = v?.residual_value ?? 0;
    gi('tco-method').value   = v?.depreciation_method || 'linear';
    gi('tco-leasing').value  = v?.monthly_leasing || '';
    gi('tco-co2').value      = v?.co2_g_per_km || '';
    gi('tco-notes').value    = v?.notes || '';
    calcDeprPreview();
    modal.style.display = 'flex';
  }

  function closeModal() {
    const m = document.getElementById('tco-modal');
    if (m) m.style.display = 'none';
  }

  function calcDeprPreview() {
    const price    = parseFloat(document.getElementById('tco-price')?.value) || 0;
    const residual = parseFloat(document.getElementById('tco-residual')?.value) || 0;
    const life     = parseFloat(document.getElementById('tco-life')?.value) || 5;
    const monthly  = life > 0 ? (price - residual) / (life * 12) : 0;
    const el = document.getElementById('tco-depr-display');
    if (el) el.textContent = monthly > 0 ? `Amortyzacja: ${monthly.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN/mies.` : '';
  }

  async function saveTco() {
    const gi = k => document.getElementById(k);
    const vehicleId = gi('tco-vid').value;
    const nrRej     = gi('tco-nrrej').value;
    if (!vehicleId && !nrRej) { alert('Podaj ID pojazdu lub nr rej.'); return; }
    const body = {
      vehicle_id: vehicleId || null, nr_rej: nrRej || null,
      purchase_price: parseFloat(gi('tco-price').value) || null,
      purchase_date:  gi('tco-date').value || null,
      expected_life_years: parseInt(gi('tco-life').value) || 5,
      residual_value: parseFloat(gi('tco-residual').value) ?? 0,
      depreciation_method: gi('tco-method').value || 'linear',
      monthly_leasing: parseFloat(gi('tco-leasing').value) || null,
      co2_g_per_km: parseFloat(gi('tco-co2').value) || null,
      notes: gi('tco-notes').value || null,
    };
    try {
      const r = await fetch(`${API()}/api/tco?company=${encodeURIComponent(Co())}`, {
        method: 'POST', headers: { ...H(), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      closeModal(); await renderTco();
    } catch (ex) { alert('Błąd: ' + ex.message); }
  }

  async function deleteTco(vehicleId) {
    if (!confirm('Usunąć konfigurację TCO dla tego pojazdu?')) return;
    try {
      await fetch(`${API()}/api/tco/${encodeURIComponent(vehicleId)}?company=${encodeURIComponent(Co())}`, { method: 'DELETE', headers: H() });
      await renderTco();
    } catch (ex) { alert('Błąd: ' + ex.message); }
  }

  let _aiModal = null;

  function _ensureAiModal() {
    if (document.getElementById('tco-ai-modal')) return;
    const d = document.createElement('div');
    d.id = 'tco-ai-modal';
    d.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9200;align-items:center;justify-content:center;padding:1rem';
    d.innerHTML = `<div style="background:var(--bg-card);border-radius:var(--radius-lg);width:700px;max-width:98vw;max-height:88vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.25);padding:24px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <i class="ti ti-robot" style="font-size:22px;color:var(--blue)"></i>
        <div style="font-weight:700;font-size:15px">Prognoza kosztów AI</div>
        <button onclick="window.TcoModule.closeAiModal()" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:18px;color:var(--text2)">✕</button>
      </div>
      <div id="tco-ai-body" style="font-size:13px;line-height:1.7;color:var(--text)">
        <div style="display:flex;align-items:center;gap:8px;color:var(--text2)"><i class="ti ti-loader ti-spin"></i> Analizuję dane floty...</div>
      </div>
    </div>`;
    document.body.appendChild(d);
  }

  async function askAiForecast() {
    _ensureAiModal();
    const modal = document.getElementById('tco-ai-modal');
    modal.style.display = 'flex';
    const body = document.getElementById('tco-ai-body');
    body.innerHTML = '<div style="display:flex;align-items:center;gap:8px;color:var(--text2)"><i class="ti ti-loader ti-spin"></i> Analizuję dane floty...</div>';

    const vehiclesSummary = _data.map(v => {
      const c = v.costs || {};
      return `${v.nr_rej} (${[v.make,v.model,v.vehicle_year].filter(Boolean).join(' ')}): TCO=${c.tco_monthly?.toFixed(0)||'?'} PLN/mies, paliwo=${c.fuel_12m?.toFixed(0)||'?'} PLN/rok, serwis=${c.service_12m?.toFixed(0)||'?'} PLN/rok`;
    }).join('\n');

    const totalMon = _data.reduce((s,v)=>s+(v.costs?.tco_monthly??0),0);
    const prompt = `Jesteś ekspertem fleet management. Analizujesz flotę pojazdów polskiej firmy.\n\nDANE TCO (Całkowity koszt posiadania):\n${vehiclesSummary || 'Brak danych TCO'}\n\nŁączne TCO floty: ${totalMon.toFixed(0)} PLN/miesiąc\n\nProszę:\n1. Zidentyfikuj pojazdy z najwyższymi kosztami relatywnie do wartości\n2. Podaj prognozę kosztów na następne 12 miesięcy (trend)\n3. Wskaż 3 konkretne działania optymalizacyjne\n4. Oceń potencjalne oszczędności w PLN/rok\n\nOdpowiedz po polsku, konkretnie i strukturalnie.`;

    try {
      const r = await fetch(`${API()}/api/ai/chat`, {
        method: 'POST',
        headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, company: Co() }),
      });
      if (!r.ok) throw new Error('AI niedostępne — sprawdź konfigurację');
      const d = await r.json();
      const text = d.response || d.content || d.message || JSON.stringify(d);
      body.innerHTML = `<div style="white-space:pre-wrap;font-family:inherit">${e(text)}</div>
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);font-size:11px;color:var(--text3)">
          <i class="ti ti-info-circle"></i> Prognoza generowana przez AI na podstawie danych TCO. Nie stanowi porady finansowej.
        </div>`;
    } catch (ex) {
      body.innerHTML = `<div style="color:var(--red)"><i class="ti ti-alert-circle"></i> ${e(ex.message)}</div>`;
    }
  }

  function closeAiModal() {
    const m = document.getElementById('tco-ai-modal');
    if (m) m.style.display = 'none';
  }

  window.TcoModule = { renderTco, openModal, closeModal, calcDeprPreview, saveTco, deleteTco, askAiForecast, closeAiModal };
})();
