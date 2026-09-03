/* Historia polis ubezpieczeniowych (OC/AC/NNW) per pojazd */
(function () {
  const BASE = () => (localStorage.getItem('cf_worker_url') || 'https://taxorder-pro-api.adamus1000.workers.dev');
  const COMPANY = () => localStorage.getItem('cf_company') || '';
  const TOKEN = () => localStorage.getItem('cf_token') || '';
  const hdrs = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${  TOKEN()}` });

  const TYPE_LABELS = { oc: 'OC', ac: 'AC', nnw: 'NNW', assistance: 'Assistance', inne: 'Inne' };
  const TYPE_COLORS = { oc: '#2196f3', ac: '#4caf50', nnw: '#ff9800', assistance: '#9c27b0', inne: '#607d8b' };

  function typeChip(type) {
    const color = TYPE_COLORS[type] || '#607d8b';
    const label = esc(TYPE_LABELS[type] || type);
    return `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">${label}</span>`;
  }

  function fd(ds) {
    if (!ds) return '—';
    const d = new Date(ds);
    return isNaN(d) ? '—' : d.toLocaleDateString('pl-PL');
  }

  function expiryClass(dateStr) {
    if (!dateStr) return '';
    const days = Math.round((new Date(dateStr) - new Date()) / 86400000);
    if (days < 0)  return 'color:#f44336;font-weight:700';
    if (days < 30) return 'color:#ff9800;font-weight:700';
    if (days < 60) return 'color:#ffc107';
    return 'color:#4caf50';
  }

  async function fetchPolicies(params) {
    const qs = new URLSearchParams({ company: COMPANY(), ...params });
    const r = await fetch(`${BASE()}/api/policies-db?${qs}`, { headers: hdrs() });
    return r.ok ? r.json() : [];
  }

  async function savePolicy(data, id) {
    const url = id ? `${BASE()}/api/policies-db/${id}?company=${COMPANY()}` : `${BASE()}/api/policies-db?company=${COMPANY()}`;
    const r = await fetch(url, { method: id ? 'PUT' : 'POST', headers: hdrs(), body: JSON.stringify(data) });
    return r.json();
  }

  async function deletePolicy(id) {
    await fetch(`${BASE()}/api/policies-db/${id}?company=${COMPANY()}`, { method: 'DELETE', headers: hdrs() });
  }

  // ─── Render dla karty pojazdu (zakładka Polisy) ───────────────────────────
  function renderForVehicle(v) {
    const div = document.createElement('div');
    div.id = `pm-veh-${esc(v.nrRej || v.id)}`;
    div.innerHTML = `<div style="padding:12px 0;color:#888;font-style:italic">Ładowanie polis...</div>`;
    loadForVehicle(v, div);
    return div;
  }

  async function loadForVehicle(v, container) {
    if (!container) container = document.getElementById(`pm-veh-${v.nrRej || v.id}`);
    if (!container) return;
    const params = v.nrRej ? { nrRej: v.nrRej } : {};
    const policies = await fetchPolicies(params);
    container.innerHTML = _renderVehicleHtml(v, policies);
  }

  function _renderVehicleHtml(v, policies) {
    const nrRej = esc(v.nrRej || '');
    let rows = '';
    for (const p of policies) {
      const style = expiryClass(p.end_date);
      rows += `<tr>
        <td>${typeChip(p.type)}</td>
        <td>${esc(p.policy_number || '—')}</td>
        <td>${esc(p.insurer || '—')}</td>
        <td>${fd(p.start_date)}</td>
        <td style="${esc(style)}">${fd(p.end_date)}</td>
        <td>${p.premium != null ? (`${p.premium.toFixed(2)  } zł`) : '—'}</td>
        <td>
          <button class="btn-icon" title="Edytuj" data-id="${esc(p.id)}" data-nrrej="${nrRej}" onclick="PoliciesModule._openEdit(this.dataset.id,this.dataset.nrrej)"><i class="ti ti-edit"></i></button>
          <button class="btn-icon" title="Usuń" data-id="${esc(p.id)}" data-nrrej="${nrRej}" onclick="PoliciesModule._del(this.dataset.id,this.dataset.nrrej)" style="color:#f44336"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }
    if (!rows) rows = `<tr><td colspan="7" style="text-align:center;color:#888;padding:16px">Brak polis ubezpieczeniowych</td></tr>`;
    return `
      <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
        <button class="btn-sm btn-primary" data-nrrej="${nrRej}" onclick="PoliciesModule._openEdit(null,this.dataset.nrrej)"><i class="ti ti-plus"></i> Dodaj polisę</button>
      </div>
      <div style="overflow-x:auto">
        <table class="data-table" style="font-size:13px">
          <thead><tr><th>Typ</th><th>Nr polisy</th><th>Ubezpieczyciel</th><th>Od</th><th>Do</th><th>Składka</th><th>Akcje</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ─── Modal dodaj/edytuj ───────────────────────────────────────────────────
  let _editId = null;
  let _editNrRej = null;

  function _openEdit(id, nrRej) {
    _editId = id;
    _editNrRej = nrRej;
    const modal = document.getElementById('pm-modal');
    if (!modal) return;
    const title = document.getElementById('pm-modal-title');
    if (title) title.textContent = id ? 'Edytuj polisę' : 'Nowa polisa';
    document.getElementById('pm-f-id').value = id || '';
    document.getElementById('pm-f-nrrej').value = nrRej || '';
    // Clear fields for new
    if (!id) {
      document.getElementById('pm-f-type').value = 'oc';
      document.getElementById('pm-f-number').value = '';
      document.getElementById('pm-f-insurer').value = '';
      document.getElementById('pm-f-premium').value = '';
      document.getElementById('pm-f-installments').value = '1';
      document.getElementById('pm-f-start').value = '';
      document.getElementById('pm-f-end').value = '';
      document.getElementById('pm-f-notes').value = '';
    } else {
      // Load existing data
      fetchPolicies({ nrRej }).then(list => {
        const p = list.find(x => x.id === id);
        if (!p) return;
        document.getElementById('pm-f-type').value = p.type || 'oc';
        document.getElementById('pm-f-number').value = p.policy_number || '';
        document.getElementById('pm-f-insurer').value = p.insurer || '';
        document.getElementById('pm-f-premium').value = p.premium ?? '';
        document.getElementById('pm-f-installments').value = p.installments ?? 1;
        document.getElementById('pm-f-start').value = p.start_date || '';
        document.getElementById('pm-f-end').value = p.end_date || '';
        document.getElementById('pm-f-notes').value = p.notes || '';
      });
    }
    modal.style.display = 'flex';
  }

  function _closeEdit() {
    const modal = document.getElementById('pm-modal');
    if (modal) modal.style.display = 'none';
  }

  async function _submitEdit() {
    const id     = document.getElementById('pm-f-id').value || null;
    const nrRej  = document.getElementById('pm-f-nrrej').value;
    const data = {
      nr_rej:       nrRej,
      type:         document.getElementById('pm-f-type').value,
      policy_number:document.getElementById('pm-f-number').value.trim(),
      insurer:      document.getElementById('pm-f-insurer').value.trim(),
      premium:      parseFloat(document.getElementById('pm-f-premium').value) || null,
      installments: parseInt(document.getElementById('pm-f-installments').value) || 1,
      start_date:   document.getElementById('pm-f-start').value || null,
      end_date:     document.getElementById('pm-f-end').value || null,
      notes:        document.getElementById('pm-f-notes').value.trim(),
    };
    const res = await savePolicy(data, id);
    if (!res.ok && !res.id) { alert('Błąd zapisu polisy'); return; }
    _closeEdit();
    // Refresh vehicle panel
    const v = (window.vehs || []).find(x => x.nrRej === nrRej) || { nrRej };
    loadForVehicle(v);
    // Also refresh global page if visible
    const page = document.getElementById('page-policies');
    if (page && page.style.display !== 'none') _renderGlobalPage();
  }

  async function _del(id, nrRej) {
    if (!confirm('Usunąć polisę?')) return;
    try {
      await deletePolicy(id);
      const v = (window.vehs || []).find(x => x.nrRej === nrRej) || { nrRej };
      loadForVehicle(v);
      const page = document.getElementById('page-policies');
      if (page && page.style.display !== 'none') _renderGlobalPage();
    } catch (e) { if (window.toast) toast('Błąd usuwania — spróbuj ponownie'); }
  }

  // ─── Strona globalna ──────────────────────────────────────────────────────
  async function _renderGlobalPage() {
    const container = document.getElementById('policies-global-content');
    if (!container) return;
    container.innerHTML = '<div style="padding:24px;color:#888">Ładowanie...</div>';
    const all = await fetchPolicies({});
    if (!all.length) {
      container.innerHTML = '<div style="padding:24px;color:#888;text-align:center">Brak polis w systemie</div>';
      return;
    }
    // Group by nr_rej
    const byVeh = {};
    for (const p of all) {
      const k = p.nr_rej || '—';
      if (!byVeh[k]) byVeh[k] = [];
      byVeh[k].push(p);
    }
    let html = '';
    for (const [nrRej, list] of Object.entries(byVeh)) {
      html += `<div class="veh-doc-group" style="margin-bottom:24px">
        <h4 style="margin:0 0 8px;font-size:14px;color:var(--accent)"><i class="ti ti-car"></i> ${esc(nrRej)}</h4>
        ${_renderVehicleHtml({ nrRej }, list)}
      </div>`;
    }
    container.innerHTML = html;
  }

  async function fetchExpiringSoon(days) {
    const all = await fetchPolicies({});
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + days);
    return all.filter(p => {
      if (!p.end_date) return false;
      const d = new Date(p.end_date);
      return !isNaN(d) && d <= cutoff;
    }).sort((a, b) => new Date(a.end_date) - new Date(b.end_date));
  }

  window.PoliciesModule = {
    renderForVehicle, loadForVehicle,
    _openEdit, _closeEdit, _submitEdit, _del,
    _renderGlobalPage, fetchExpiringSoon,
  };
})();
