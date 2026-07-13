(function () {
  'use strict';

  const API = () => window._cfApi ? window._cfApi() : window.WORKER_URL;
  const H   = () => window._cfHdrs ? window._cfHdrs() : {};
  const Co  = () => window._cfCo   ? window._cfCo()   : '';
  const e   = (s) => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtN = (v) => v != null ? parseFloat(v).toLocaleString('pl-PL', { minimumFractionDigits:2, maximumFractionDigits:2 }) : '0,00';

  const CAT_LABELS = {
    service: 'Serwis', fine: 'Mandaty', fuel: 'Paliwo',
    damage: 'Szkody', mileage: 'Rozliczenia km', insurance: 'Ubezpieczenia', total: 'RAZEM'
  };

  let _budgets = [];
  let _year = new Date().getFullYear();
  let _month = null;

  async function renderBudgets() {
    const co = Co();
    _year  = parseInt(document.getElementById('budg-year')?.value  || _year);
    _month = parseInt(document.getElementById('budg-month')?.value || 0) || null;
    const mq = _month ? `&month=${_month}` : '';
    let data = [];
    try {
      const r = await fetch(`${API()}/api/budgets/actual?company=${encodeURIComponent(co)}&year=${_year}${mq}`, { headers: H() });
      if (r.ok) data = await r.json();
    } catch {}
    _budgets = Array.isArray(data) ? data : [];
    _renderTable();
  }

  function _renderTable() {
    const el = document.getElementById('budgets-body');
    if (!el) return;
    if (!_budgets.length) { el.innerHTML = '<tr><td colspan="6" class="empty">Brak budżetów — dodaj pierwszy</td></tr>'; return; }
    el.innerHTML = _budgets.map(b => {
      const pct = b.budget_amount > 0 ? Math.min(100, (b.actual/b.budget_amount*100)) : 0;
      const cls = pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : 'ok';
      return `<tr>
  <td>${e(CAT_LABELS[b.category]||b.category)}</td>
  <td>${e(b.nr_rej||'Cała flota')}</td>
  <td>${e(b.branch_name||'—')}</td>
  <td>${fmtN(b.budget_amount)} PLN</td>
  <td>${fmtN(b.actual)} PLN</td>
  <td>
    <div class="progress-wrap">
      <div class="progress-bar ${e(cls)}" style="width:${pct.toFixed(0)}%"></div>
      <span class="progress-lbl">${pct.toFixed(0)}%</span>
    </div>
  </td>
  <td>
    <button class="btn-icon" data-id="${b.id}" onclick="window.BudgetsModule.editBudget(this.dataset.id)" title="Edytuj"><i class="ti ti-edit"></i></button>
    <button class="btn-icon danger" data-id="${b.id}" onclick="window.BudgetsModule.deleteBudget(this.dataset.id)" title="Usuń"><i class="ti ti-trash"></i></button>
  </td>
</tr>`;
    }).join('');
  }

  function openBudgetModal(id) {
    const b = id ? _budgets.find(x => String(x.id) === String(id)) : null;
    const modal = document.getElementById('budget-modal');
    if (!modal) return;
    document.getElementById('bm-id').value       = b?.id || '';
    document.getElementById('bm-category').value = b?.category || 'fuel';
    document.getElementById('bm-nr-rej').value   = b?.nr_rej || '';
    document.getElementById('bm-year').value      = b?.year || _year;
    document.getElementById('bm-month').value     = b?.month || '';
    document.getElementById('bm-amount').value    = b?.budget_amount || '';
    modal.style.display = 'flex';
  }

  function closeBudgetModal() {
    const modal = document.getElementById('budget-modal');
    if (modal) modal.style.display = 'none';
  }

  async function saveBudget() {
    const id = document.getElementById('bm-id').value;
    const amount = parseFloat(document.getElementById('bm-amount').value);
    if (!amount) { alert('Wpisz kwotę budżetu'); return; }
    const body = {
      category: document.getElementById('bm-category').value,
      nr_rej:   document.getElementById('bm-nr-rej').value || null,
      year:     parseInt(document.getElementById('bm-year').value) || _year,
      month:    parseInt(document.getElementById('bm-month').value) || null,
      amount,
    };
    const method = id ? 'PUT' : 'POST';
    const url    = id
      ? `${API()}/api/budgets/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`
      : `${API()}/api/budgets?company=${encodeURIComponent(Co())}`;
    try {
      const r = await fetch(url, { method, headers: { ...H(), 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      closeBudgetModal();
      await renderBudgets();
    } catch(ex) { alert('Błąd: '+ex.message); }
  }

  function editBudget(id) { openBudgetModal(id); }

  async function deleteBudget(id) {
    if (!confirm('Usunąć ten budżet?')) return;
    try {
      await fetch(`${API()}/api/budgets/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`, { method:'DELETE', headers: H() });
      await renderBudgets();
    } catch(ex) { alert('Błąd: '+ex.message); }
  }

  window.BudgetsModule = { renderBudgets, openBudgetModal, closeBudgetModal, saveBudget, editBudget, deleteBudget };
})();
