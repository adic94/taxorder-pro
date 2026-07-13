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
  <button class="btn-primary" onclick="window.TcoModule.openModal()"><i class="ti ti-plus"></i> Skonfiguruj pojazd</button>
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

  window.TcoModule = { renderTco, openModal, closeModal, calcDeprPreview, saveTco, deleteTco };
})();
