(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtN = (v, d=0) => v != null ? parseFloat(v).toLocaleString('pl-PL', {minimumFractionDigits:d,maximumFractionDigits:d}) : '—';
  const fmtD = s => s ? new Date(s+'T00:00:00').toLocaleDateString('pl-PL') : '—';

  const CAT_LBL = { business:'Służbowa', private:'Prywatna' };
  const CAT_CLR = { business:'#16a34a', private:'#6366f1' };

  let _trips = [];
  let _summary = {};
  let _activeTab = 'list';

  async function renderTripPrivate() {
    const co   = Co();
    const df   = document.getElementById('tp-df')?.value || new Date(Date.now()-30*86400000).toISOString().slice(0,10);
    const dt   = document.getElementById('tp-dt')?.value || new Date().toISOString().slice(0,10);
    const cat  = document.getElementById('tp-cat')?.value || '';
    const params = new URLSearchParams({ company: co, date_from: df, date_to: dt });
    if (cat) params.set('category', cat);
    try {
      const r = await fetch(`${API()}/api/trips?${params}`, { headers: H() });
      if (r.ok) { const d = await r.json(); _trips = d.trips || []; _summary = d.summary || {}; }
    } catch {}
    _render();
  }

  function _render() {
    const el = document.getElementById('page-trip-private');
    if (!el) return;
    el.innerHTML = `
<div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px">
  <h2 style="margin:0;font-size:18px"><i class="ti ti-car"></i> Jazda prywatna / służbowa <span style="font-size:12px;color:var(--text3)">(GDPR)</span></h2>
  <button class="btn btn-primary" onclick="window.TripPrivate._openAdd()"><i class="ti ti-plus"></i> Dodaj przejazd</button>
</div>

<!-- Filtry -->
<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px">
  <div><label style="font-size:12px;color:var(--text3)">Od</label><br>
    <input type="date" id="tp-df" class="sel" value="${e(new Date(Date.now()-30*86400000).toISOString().slice(0,10))}" onchange="window.TripPrivate.renderTripPrivate()"></div>
  <div><label style="font-size:12px;color:var(--text3)">Do</label><br>
    <input type="date" id="tp-dt" class="sel" value="${e(new Date().toISOString().slice(0,10))}" onchange="window.TripPrivate.renderTripPrivate()"></div>
  <div><label style="font-size:12px;color:var(--text3)">Kategoria</label><br>
    <select id="tp-cat" class="sel" onchange="window.TripPrivate.renderTripPrivate()">
      <option value="">Wszystkie</option>
      <option value="business">Służbowe</option>
      <option value="private">Prywatne</option>
    </select></div>
  <button class="btn btn-sm" onclick="window.TripPrivate._showVatReport()"><i class="ti ti-receipt-tax"></i> Raport VAT</button>
  <button class="btn btn-sm" onclick="window.TripPrivate._exportCSV()"><i class="ti ti-table-export"></i> Eksport CSV</button>
</div>

<!-- Karty KPI -->
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:20px">
  <div style="background:var(--bg2);border-radius:10px;padding:14px;border-left:3px solid #16a34a">
    <div style="font-size:22px;font-weight:700;color:#16a34a">${fmtN(_summary.business_km??0,1)} km</div>
    <div style="font-size:12px;color:var(--text3)">Służbowe (${_summary.business_count??0} przejaz.)</div>
  </div>
  <div style="background:var(--bg2);border-radius:10px;padding:14px;border-left:3px solid #6366f1">
    <div style="font-size:22px;font-weight:700;color:#6366f1">${fmtN(_summary.private_km??0,1)} km</div>
    <div style="font-size:12px;color:var(--text3)">Prywatne (${_summary.private_count??0} przejaz.)</div>
  </div>
  <div style="background:var(--bg2);border-radius:10px;padding:14px;border-left:3px solid #2563eb">
    <div style="font-size:22px;font-weight:700">${fmtN((_summary.business_km??0)+(_summary.private_km??0),1)} km</div>
    <div style="font-size:12px;color:var(--text3)">Łącznie</div>
  </div>
  <div style="background:var(--bg2);border-radius:10px;padding:14px;border-left:3px solid #d97706">
    <div style="font-size:22px;font-weight:700;color:#d97706">
      ${((_summary.business_km??0)+((_summary.private_km??0))>0) ? Math.round((_summary.business_km??0)/((_summary.business_km??0)+(_summary.private_km??0))*100) : 0}%
    </div>
    <div style="font-size:12px;color:var(--text3)">Udział służbowych → odliczenie VAT</div>
  </div>
  <div style="background:var(--bg2);border-radius:10px;padding:14px;border-left:3px solid #059669">
    <div style="font-size:22px;font-weight:700;color:#059669">${fmtN(_summary.business_cost??0,2)} PLN</div>
    <div style="font-size:12px;color:var(--text3)">Koszt przejazdów służbowych</div>
  </div>
</div>

<!-- Tabela przejazdów -->
<div style="overflow-x:auto">
<table class="tach-table">
  <thead>
    <tr>
      <th>Data</th>
      <th>Pojazd</th>
      <th>Kierowca</th>
      <th>Skąd → Dokąd</th>
      <th style="text-align:right">Km</th>
      <th>Kategoria</th>
      <th>Cel</th>
      <th style="text-align:right">Koszt</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    ${_trips.length === 0 ? '<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:20px">Brak przejazdów w wybranym okresie</td></tr>' :
      _trips.map(t => `<tr>
        <td style="font-size:12px;white-space:nowrap">${fmtD(t.trip_date)}${t.start_time?'<br><span style="color:var(--text3)">' + e(t.start_time) + (t.end_time?' – '+e(t.end_time):'') + '</span>':''}</td>
        <td style="font-size:12px;font-weight:600">${e(t.vehicle_reg||'—')}</td>
        <td style="font-size:12px">${e(t.driver_name||'—')}</td>
        <td style="font-size:12px">
          ${t.start_location||t.end_location ? `${e(t.start_location||'?')} <i class="ti ti-arrow-right" style="font-size:10px;color:var(--text3)"></i> ${e(t.end_location||'?')}` : '—'}
        </td>
        <td style="text-align:right;font-weight:600">${fmtN(t.distance_km??0,1)}</td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${t.category==='business'?'#dcfce7':'#ede9fe'};color:${CAT_CLR[t.category]||'#64748b'}">
            <i class="ti ${t.category==='business'?'ti-briefcase':'ti-home'}"></i> ${CAT_LBL[t.category]||e(t.category)}
          </span>
        </td>
        <td style="font-size:12px;max-width:150px;overflow:hidden;text-overflow:ellipsis">${e(t.purpose||'—')}</td>
        <td style="text-align:right;font-size:12px">${(t.cost_total??0)>0?fmtN(t.cost_total,2)+' PLN':'—'}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm" data-id="${e(t.id)}" data-cat="${e(t.category)}"
              onclick="window.TripPrivate._toggleCategory(this.dataset.id, this.dataset.cat)"
              title="Przełącz kategoria">
              <i class="ti ti-refresh"></i>
            </button>
            <button class="btn btn-sm" data-id="${e(t.id)}"
              onclick="window.TripPrivate._delete(this.dataset.id)"
              title="Usuń" style="color:#dc2626">
              <i class="ti ti-trash"></i>
            </button>
          </div>
        </td>
      </tr>`).join('')}
  </tbody>
</table>
</div>

<div style="margin-top:12px;padding:12px;background:var(--bg2);border-radius:8px;font-size:12px;color:var(--text3)">
  <i class="ti ti-info-circle"></i>
  <strong>Odliczenie VAT 50%:</strong> Gdy pojazd jest używany zarówno do celów służbowych jak i prywatnych, firma może odliczyć 50% VAT od kosztów eksploatacji (Art. 86a ustawy o VAT).
  Aby odliczyć 100% VAT, konieczne jest prowadzenie ewidencji przejazdów i wyłączenie pojazdu z użytku prywatnego.
</div>

<!-- Modal dodawania -->
<div id="tp-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9200;display:none;align-items:center;justify-content:center" onclick="if(event.target===this)this.style.display='none'">
  <div style="background:var(--bg);border-radius:12px;padding:24px;width:min(560px,96vw);max-height:90vh;overflow-y:auto" id="tp-modal-inner"></div>
</div>`;
  }

  function _openAdd(trip = null) {
    const m = document.getElementById('tp-modal');
    const inner = document.getElementById('tp-modal-inner');
    if (!m || !inner) return;
    inner.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
  <h3 style="margin:0">${trip ? 'Edytuj przejazd' : 'Nowy przejazd'}</h3>
  <button onclick="window.TripPrivate._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
  <div><label style="font-size:12px;color:var(--text3)">Data *</label><br><input type="date" id="tp-f-date" class="sel" value="${trip?.trip_date||new Date().toISOString().slice(0,10)}" required></div>
  <div><label style="font-size:12px;color:var(--text3)">Kategoria</label><br>
    <select id="tp-f-cat" class="sel">
      <option value="business" ${(!trip||trip.category==='business')?'selected':''}>Służbowa</option>
      <option value="private" ${trip?.category==='private'?'selected':''}>Prywatna</option>
    </select></div>
  <div><label style="font-size:12px;color:var(--text3)">Nr rejestracyjny</label><br><input type="text" id="tp-f-reg" class="sel" placeholder="WA 12345" value="${e(trip?.vehicle_reg||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Kierowca</label><br><input type="text" id="tp-f-driver" class="sel" placeholder="Jan Kowalski" value="${e(trip?.driver_name||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Czas od</label><br><input type="time" id="tp-f-start" class="sel" value="${e(trip?.start_time||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Czas do</label><br><input type="time" id="tp-f-end" class="sel" value="${e(trip?.end_time||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Skąd</label><br><input type="text" id="tp-f-from" class="sel" placeholder="Warszawa, ul. ..." value="${e(trip?.start_location||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Dokąd</label><br><input type="text" id="tp-f-to" class="sel" placeholder="Kraków, ul. ..." value="${e(trip?.end_location||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Dystans (km)</label><br><input type="number" id="tp-f-km" class="sel" step="0.1" min="0" value="${trip?.distance_km||''}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Koszt paliwa (PLN)</label><br><input type="number" id="tp-f-fuel-cost" class="sel" step="0.01" min="0" value="${trip?.cost_fuel||''}"></div>
  <div style="grid-column:1/-1"><label style="font-size:12px;color:var(--text3)">Cel podróży</label><br><input type="text" id="tp-f-purpose" class="sel" placeholder="np. spotkanie z klientem, dostawa" value="${e(trip?.purpose||'')}"></div>
  <div style="grid-column:1/-1"><label style="font-size:12px;color:var(--text3)">Notatki</label><br><input type="text" id="tp-f-notes" class="sel" value="${e(trip?.notes||'')}"></div>
</div>
<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
  <button class="btn" onclick="window.TripPrivate._closeModal()">Anuluj</button>
  <button class="btn btn-primary" onclick="window.TripPrivate._save('${e(trip?.id||'')}')"><i class="ti ti-check"></i> Zapisz</button>
</div>`;
    m.style.display = 'flex';
  }

  function _closeModal() {
    const m = document.getElementById('tp-modal');
    if (m) m.style.display = 'none';
  }

  async function _save(id) {
    const data = {
      trip_date:      document.getElementById('tp-f-date')?.value || '',
      category:       document.getElementById('tp-f-cat')?.value || 'business',
      vehicle_reg:    document.getElementById('tp-f-reg')?.value || '',
      driver_name:    document.getElementById('tp-f-driver')?.value || '',
      start_time:     document.getElementById('tp-f-start')?.value || '',
      end_time:       document.getElementById('tp-f-end')?.value || '',
      start_location: document.getElementById('tp-f-from')?.value || '',
      end_location:   document.getElementById('tp-f-to')?.value || '',
      distance_km:    parseFloat(document.getElementById('tp-f-km')?.value || 0),
      cost_fuel:      parseFloat(document.getElementById('tp-f-fuel-cost')?.value || 0),
      purpose:        document.getElementById('tp-f-purpose')?.value || '',
      notes:          document.getElementById('tp-f-notes')?.value || '',
    };
    if (!data.trip_date) { alert('Pole Data jest wymagane'); return; }
    try {
      const url = id ? `${API()}/api/trips/${id}?company=${encodeURIComponent(Co())}` : `${API()}/api/trips?company=${encodeURIComponent(Co())}`;
      const r = await fetch(url, { method: id ? 'PUT' : 'POST', headers: { ...H(), 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (r.ok) { _closeModal(); await renderTripPrivate(); }
      else alert('Błąd zapisu');
    } catch (ex) { alert(ex.message); }
  }

  async function _toggleCategory(id, currentCat) {
    const newCat = currentCat === 'business' ? 'private' : 'business';
    try {
      await fetch(`${API()}/api/trips/${id}?company=${encodeURIComponent(Co())}`, {
        method: 'PUT', headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCat })
      });
      await renderTripPrivate();
    } catch (ex) { alert(ex.message); }
  }

  async function _delete(id) {
    if (!confirm('Usunąć przejazd?')) return;
    await fetch(`${API()}/api/trips/${id}?company=${encodeURIComponent(Co())}`, { method: 'DELETE', headers: H() });
    await renderTripPrivate();
  }

  async function _showVatReport() {
    const year = new Date().getFullYear();
    try {
      const r = await fetch(`${API()}/api/trips/vat-report?company=${encodeURIComponent(Co())}&year=${year}`, { headers: H() });
      const data = r.ok ? await r.json() : {};
      const el = document.getElementById('tp-modal-inner');
      const m  = document.getElementById('tp-modal');
      if (!el || !m) return;
      el.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
  <h3 style="margin:0"><i class="ti ti-receipt-tax"></i> Raport VAT — ${year}</h3>
  <button onclick="window.TripPrivate._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
</div>
<div style="display:flex;gap:10px;margin-bottom:16px">
  <div style="background:#dcfce7;border-radius:8px;padding:12px;flex:1;text-align:center">
    <div style="font-size:20px;font-weight:700;color:#16a34a">${fmtN(data.business_km??0,1)} km</div>
    <div style="font-size:12px;color:#16a34a">Służbowe</div>
  </div>
  <div style="background:#ede9fe;border-radius:8px;padding:12px;flex:1;text-align:center">
    <div style="font-size:20px;font-weight:700;color:#6366f1">${fmtN((data.total_km??0)-(data.business_km??0),1)} km</div>
    <div style="font-size:12px;color:#6366f1">Prywatne</div>
  </div>
  <div style="background:var(--bg2);border-radius:8px;padding:12px;flex:1;text-align:center">
    <div style="font-size:20px;font-weight:700;color:#d97706">${data.vat_deduction_pct??0}%</div>
    <div style="font-size:12px;color:#d97706">Odliczenie VAT</div>
  </div>
</div>
<table class="tach-table">
  <thead><tr><th>Miesiąc</th><th style="text-align:right">Km łącznie</th><th style="text-align:right">Km służbowe</th><th style="text-align:right">Km prywatne</th><th style="text-align:right">% VAT</th></tr></thead>
  <tbody>
    ${(data.monthly||[]).map(m => {
      const pct = (m.km_total||0)>0 ? Math.round((m.km_biz||0)/(m.km_total||1)*100) : 0;
      return `<tr>
        <td>${e(m.trip_date?.slice(0,7)||'—')}</td>
        <td style="text-align:right">${fmtN(m.km_total??0,1)}</td>
        <td style="text-align:right;color:#16a34a">${fmtN(m.km_biz??0,1)}</td>
        <td style="text-align:right;color:#6366f1">${fmtN(m.km_priv??0,1)}</td>
        <td style="text-align:right;font-weight:600;color:${pct>=50?'#16a34a':'#dc2626'}">${pct}%</td>
      </tr>`;
    }).join('')}
  </tbody>
</table>`;
      m.style.display = 'flex';
    } catch (ex) { alert(ex.message); }
  }

  function _exportCSV() {
    const rows = [['Data','Pojazd','Kierowca','Skąd','Dokąd','Km','Kategoria','Cel','Koszt PLN']];
    _trips.forEach(t => rows.push([t.trip_date, t.vehicle_reg, t.driver_name, t.start_location, t.end_location,
      t.distance_km, t.category, t.purpose, t.cost_total]));
    const csv = rows.map(r => r.map(c => '"'+(String(c??'').replace(/"/g,'""'))+'"').join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,﻿' + encodeURIComponent(csv);
    a.download = `przejazdy_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  window.TripPrivate = { renderTripPrivate, _openAdd, _closeModal, _save, _toggleCategory, _delete, _showVatReport, _exportCSV };
})();
