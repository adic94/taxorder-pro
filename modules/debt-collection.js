/**
 * TaxOrder Pro — Windykacja Automatyczna
 * Śledzenie zaległych płatności i automatyczne przypomnienia
 *
 * SCHEMA_NEEDED: uruchom worker/schema_v47.sql (debt_collection, debt_reminders)
 */
window.DebtCollection = (function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtPLN = v => v != null ? parseFloat(v).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' }) : '—';
  const fmtD   = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pl-PL') : '—';

  let _debts   = [];
  let _stats   = {};
  let _remHist = {}; // debt_id → reminders[]
  let _expanded = new Set();
  let _filter  = 'all'; // 'all' | 'active' | 'overdue7' | 'overdue14' | 'overdue30' | 'paid'

  const STATUS_CFG = {
    active:      { lbl: 'Aktywne',      color: 'var(--blue)'   },
    paid:        { lbl: 'Zapłacone',    color: 'var(--green)'  },
    disputed:    { lbl: 'Sporne',       color: 'var(--orange)' },
    written_off: { lbl: 'Umorzone',     color: 'var(--text3)'  },
  };

  function _daysOverdue(dueDate) {
    if (!dueDate) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(dueDate + 'T00:00:00').getTime()) / 86400000));
  }

  function _overdueColor(days) {
    if (days >= 30) return 'var(--red)';
    if (days >= 14) return 'var(--orange)';
    if (days >= 7)  return '#eab308';
    return 'var(--text2)';
  }

  async function _load() {
    const co = Co();
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API()}/api/debt-collection?company=${encodeURIComponent(co)}`, { headers: H() }),
        fetch(`${API()}/api/debt-collection/stats?company=${encodeURIComponent(co)}`, { headers: H() }),
      ]);
      if (r1.ok) _debts = await r1.json();
      if (r2.ok) _stats = await r2.json();
    } catch {}
  }

  async function renderDebtCollection() {
    const el = document.getElementById('page-debt-collection');
    if (!el) return;
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)"><i class="ti ti-loader" style="font-size:32px"></i></div>`;
    await _load();
    _render();
  }

  function _render() {
    const el = document.getElementById('page-debt-collection');
    if (!el) return;

    const filtered = _filteredDebts();
    const totalActive = _stats.total_active ?? 0;
    const totalPLN    = _stats.total_pln ?? 0;
    const ov7  = _stats.overdue_7 ?? 0;
    const ov14 = _stats.overdue_14 ?? 0;
    const ov30 = _stats.overdue_30 ?? 0;

    el.innerHTML = `
<div class="page-header" style="margin-bottom:16px">
  <h2 style="margin:0"><i class="ti ti-gavel"></i> Windykacja</h2>
  <button class="btn-primary" onclick="window.DebtCollection.openAddModal()">
    <i class="ti ti-plus"></i> Nowe zadłużenie
  </button>
</div>

<!-- KPI -->
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px">
  <div class="kpi-chip" style="cursor:pointer" onclick="window.DebtCollection.setFilter('active')">
    <span class="kpi-val">${totalActive}</span>
    <span class="kpi-lbl">Aktywnych spraw</span>
  </div>
  <div class="kpi-chip">
    <span class="kpi-val" style="font-size:16px">${fmtPLN(totalPLN)}</span>
    <span class="kpi-lbl">Łączna kwota</span>
  </div>
  <div class="kpi-chip" style="cursor:pointer;border-color:#eab308" onclick="window.DebtCollection.setFilter('overdue7')">
    <span class="kpi-val" style="color:#eab308">${ov7}</span>
    <span class="kpi-lbl">Przeterminowane >7 dni</span>
  </div>
  <div class="kpi-chip" style="cursor:pointer;border-color:var(--orange)" onclick="window.DebtCollection.setFilter('overdue14')">
    <span class="kpi-val" style="color:var(--orange)">${ov14}</span>
    <span class="kpi-lbl">Przeterminowane >14 dni</span>
  </div>
  <div class="kpi-chip" style="cursor:pointer;border-color:var(--red)" onclick="window.DebtCollection.setFilter('overdue30')">
    <span class="kpi-val" style="color:var(--red)">${ov30}</span>
    <span class="kpi-lbl">Przeterminowane >30 dni</span>
  </div>
</div>

<!-- Filtry -->
<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
  ${[
    ['all','Wszystkie'],['active','Aktywne'],['overdue7','>7 dni'],
    ['overdue14','>14 dni'],['overdue30','>30 dni'],['paid','Zapłacone']
  ].map(([f,l]) => `<button
    style="padding:5px 12px;border-radius:20px;border:1px solid ${_filter===f?'var(--primary)':'var(--border)'};background:${_filter===f?'var(--primary)':'transparent'};color:${_filter===f?'#fff':'var(--text2)'};cursor:pointer;font-size:12px"
    onclick="window.DebtCollection.setFilter('${f}')">${l}</button>`).join('')}
</div>

<!-- Tabela -->
${filtered.length ? `
<div class="table-wrap" style="overflow-x:auto">
<table class="data-table">
<thead><tr>
  <th>Dłużnik</th>
  <th>Nr faktury</th>
  <th>Kwota</th>
  <th>Termin</th>
  <th>Po terminie</th>
  <th>Status</th>
  <th>Przypomnień</th>
  <th>Akcje</th>
</tr></thead>
<tbody>
${filtered.map(d => {
  const days  = _daysOverdue(d.due_date);
  const st    = STATUS_CFG[d.status] || { lbl: e(d.status), color: 'var(--text3)' };
  const expd  = _expanded.has(d.id);
  const hist  = _remHist[d.id] || [];
  return `
<tr style="background:${days>=30&&d.status==='active'?'rgba(239,68,68,.05)':''}">
  <td>
    <div><strong>${e(d.debtor_name)}</strong></div>
    ${d.debtor_email ? `<div style="font-size:11px;color:var(--text3)">${e(d.debtor_email)}</div>` : ''}
    ${d.debtor_phone ? `<div style="font-size:11px;color:var(--text3)">${e(d.debtor_phone)}</div>` : ''}
  </td>
  <td><code style="font-size:12px">${e(d.invoice_number)}</code></td>
  <td style="font-weight:600">${fmtPLN(d.amount_pln)}</td>
  <td>${fmtD(d.due_date)}</td>
  <td style="color:${_overdueColor(days)};font-weight:600">${days > 0 && d.status==='active' ? `${days} dni` : '—'}</td>
  <td><span style="color:${st.color};font-weight:600">${st.lbl}</span></td>
  <td style="text-align:center">${d.reminder_count ?? 0}</td>
  <td>
    <div style="display:flex;gap:4px;flex-wrap:wrap">
      ${d.status === 'active' ? `
      <button class="btn-primary" style="font-size:11px;padding:4px 8px" title="Wyślij przypomnienie"
        data-id="${e(d.id)}" onclick="window.DebtCollection.sendReminder(this.dataset.id)">
        <i class="ti ti-send"></i> Przypomnij
      </button>
      <button class="btn-secondary" style="font-size:11px;padding:4px 8px" title="Oznacz jako zapłacone"
        data-id="${e(d.id)}" onclick="window.DebtCollection.markPaid(this.dataset.id)">
        <i class="ti ti-check"></i>
      </button>` : ''}
      <button class="btn-secondary" style="font-size:11px;padding:4px 8px"
        data-id="${e(d.id)}" onclick="window.DebtCollection.toggleHistory(this.dataset.id)" title="Historia przypomnień">
        <i class="ti ti-history"></i>
      </button>
      <button class="btn-danger" style="font-size:11px;padding:4px 6px"
        data-id="${e(d.id)}" onclick="window.DebtCollection.deleteDebt(this.dataset.id)">
        <i class="ti ti-trash"></i>
      </button>
    </div>
    ${expd && hist.length ? `<div style="margin-top:8px;font-size:11px;background:var(--bg2);padding:8px;border-radius:6px;max-width:280px">
      ${hist.slice(0,5).map(r => `<div style="margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid var(--border)">
        <span style="color:var(--text3)">${new Date(r.sent_at).toLocaleString('pl-PL')}</span>
        <span style="margin-left:6px">${e(r.subject||'Przypomnienie')}</span>
      </div>`).join('')}
    </div>` : ''}
  </td>
</tr>`;
}).join('')}
</tbody>
</table>
</div>` : `<div style="padding:40px;text-align:center;color:var(--text3)">
  <i class="ti ti-check-circle" style="font-size:40px;display:block;margin-bottom:10px;color:var(--green)"></i>
  Brak zadłużeń w tym filtrze.
</div>`}

<!-- Modal -->
<div id="dc-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;align-items:center;justify-content:center" onclick="if(event.target===this)window.DebtCollection.closeModal()"></div>
`;
  }

  function _filteredDebts() {
    return _debts.filter(d => {
      if (_filter === 'paid') return d.status === 'paid';
      if (_filter === 'active') return d.status === 'active';
      const days = _daysOverdue(d.due_date);
      if (_filter === 'overdue7')  return d.status === 'active' && days >= 7;
      if (_filter === 'overdue14') return d.status === 'active' && days >= 14;
      if (_filter === 'overdue30') return d.status === 'active' && days >= 30;
      return true;
    });
  }

  function openAddModal() {
    const modal = document.getElementById('dc-modal');
    if (!modal) return;
    const today = new Date().toISOString().slice(0,10);
    const due   = new Date(Date.now() + 30*86400000).toISOString().slice(0,10);
    modal.style.display = 'flex';
    modal.innerHTML = `
<div style="background:var(--bg);border-radius:12px;padding:24px;width:500px;max-width:95vw;box-shadow:0 8px 32px rgba(0,0,0,.25);max-height:90vh;overflow-y:auto">
  <h3 style="margin:0 0 16px;font-size:16px"><i class="ti ti-gavel"></i> Nowe zadłużenie</h3>
  <div style="display:flex;flex-direction:column;gap:10px">
    <label style="font-size:12px;color:var(--text3)">Nazwa dłużnika *
      <input id="dc-name" class="sel" style="width:100%;margin-top:3px" placeholder="Firma XYZ Sp. z o.o.">
    </label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <label style="font-size:12px;color:var(--text3)">Email dłużnika
        <input id="dc-email" class="sel" style="width:100%;margin-top:3px" type="email" placeholder="kontakt@firma.pl">
      </label>
      <label style="font-size:12px;color:var(--text3)">Telefon
        <input id="dc-phone" class="sel" style="width:100%;margin-top:3px" placeholder="+48 500 000 000">
      </label>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <label style="font-size:12px;color:var(--text3)">Nr faktury *
        <input id="dc-invoice" class="sel" style="width:100%;margin-top:3px" placeholder="FV/2024/001">
      </label>
      <label style="font-size:12px;color:var(--text3)">Data faktury
        <input id="dc-inv-date" class="sel" style="width:100%;margin-top:3px" type="date" value="${today}">
      </label>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <label style="font-size:12px;color:var(--text3)">Kwota (PLN) *
        <input id="dc-amount" class="sel" style="width:100%;margin-top:3px" type="number" step="0.01" placeholder="1500.00">
      </label>
      <label style="font-size:12px;color:var(--text3)">Termin płatności *
        <input id="dc-due" class="sel" style="width:100%;margin-top:3px" type="date" value="${due}">
      </label>
    </div>
    <label style="font-size:12px;color:var(--text3)">Uwagi
      <textarea id="dc-notes" class="sel" style="width:100%;margin-top:3px;min-height:60px;resize:vertical" placeholder="Informacje dodatkowe..."></textarea>
    </label>
  </div>
  <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
    <button class="btn-secondary" onclick="window.DebtCollection.closeModal()">Anuluj</button>
    <button class="btn-primary" onclick="window.DebtCollection.saveDebt()"><i class="ti ti-check"></i> Dodaj</button>
  </div>
</div>`;
  }

  function closeModal() {
    const m = document.getElementById('dc-modal');
    if (m) m.style.display = 'none';
  }

  async function saveDebt() {
    const name    = document.getElementById('dc-name')?.value.trim();
    const invoice = document.getElementById('dc-invoice')?.value.trim();
    const due     = document.getElementById('dc-due')?.value;
    const amount  = parseFloat(document.getElementById('dc-amount')?.value);
    if (!name || !invoice || !due || isNaN(amount)) {
      if(typeof toast==='function') toast('Wypełnij wymagane pola','error'); return;
    }
    const body = {
      debtor_name:    name,
      debtor_email:   document.getElementById('dc-email')?.value.trim()||null,
      debtor_phone:   document.getElementById('dc-phone')?.value.trim()||null,
      invoice_number: invoice,
      invoice_date:   document.getElementById('dc-inv-date')?.value||null,
      due_date:       due,
      amount_pln:     amount,
      notes:          document.getElementById('dc-notes')?.value.trim()||null,
    };
    const co = Co();
    try {
      const r = await fetch(`${API()}/api/debt-collection?company=${encodeURIComponent(co)}`, {
        method: 'POST', headers: { ...H(), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Błąd'); }
      if(typeof toast==='function') toast('Zadłużenie dodane');
      closeModal();
      renderDebtCollection();
    } catch(ex) {
      if(typeof toast==='function') toast(ex.message,'error');
    }
  }

  async function markPaid(id) {
    if (!confirm('Oznaczyć jako zapłacone?')) return;
    const co = Co();
    try {
      const r = await fetch(`${API()}/api/debt-collection/${id}?company=${encodeURIComponent(co)}`, {
        method: 'PUT', headers: { ...H(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'paid' }),
      });
      if (!r.ok) throw new Error('Błąd');
      if(typeof toast==='function') toast('Oznaczono jako zapłacone');
      renderDebtCollection();
    } catch(ex) {
      if(typeof toast==='function') toast(ex.message,'error');
    }
  }

  async function deleteDebt(id) {
    if (!confirm('Usunąć zadłużenie?')) return;
    const co = Co();
    try {
      const r = await fetch(`${API()}/api/debt-collection/${id}?company=${encodeURIComponent(co)}`, { method: 'DELETE', headers: H() });
      if (!r.ok) throw new Error('Błąd');
      if(typeof toast==='function') toast('Usunięto');
      renderDebtCollection();
    } catch(ex) {
      if(typeof toast==='function') toast(ex.message,'error');
    }
  }

  async function sendReminder(id) {
    const debt = _debts.find(d => d.id === id);
    if (!debt) return;
    const co = Co();
    const btn = event?.target?.closest('button');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try {
      const r = await fetch(`${API()}/api/debt-collection/${id}/remind?company=${encodeURIComponent(co)}`, { method: 'POST', headers: H() });
      const d = await r.json();
      if (d.ok) {
        if(typeof toast==='function') toast(`Przypomnienie #${d.reminder_count} wysłane`);
        renderDebtCollection();
      } else {
        throw new Error(d.error || 'Błąd');
      }
    } catch(ex) {
      if(typeof toast==='function') toast(ex.message,'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-send"></i> Przypomnij'; }
    }
  }

  async function toggleHistory(id) {
    if (_expanded.has(id)) { _expanded.delete(id); _render(); return; }
    _expanded.add(id);
    // Wczytaj historię jeśli nie mamy
    if (!_remHist[id]) {
      const co = Co();
      try {
        const r = await fetch(`${API()}/api/debt-collection/${id}/reminders?company=${encodeURIComponent(co)}`, { headers: H() });
        if (r.ok) _remHist[id] = await r.json();
      } catch {}
    }
    _render();
  }

  function setFilter(f) { _filter = f; _render(); }

  return { renderDebtCollection, openAddModal, closeModal, saveDebt, markPaid, deleteDebt, sendReminder, toggleHistory, setFilter };
})();
