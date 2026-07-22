// ==================== HISTORIA DEKLARACJI DT-1 ====================
// Archiwum złożonych deklaracji — zapisuje snapshot przy każdym generowaniu PDF

window.Dt1Declarations = (function () {

  let _decls = [];

  // ── Ładowanie z API ────────────────────────────────────────────────────────
  async function load() {
    const apiBase = window.CF_WORKER_URL || '';
    if (!apiBase) { renderPage(); return; }
    try {
      const company = window.currentCompanyId || 'mtoilet';
      const token   = localStorage.getItem('cf_token') || '';
      const r = await fetch(`${apiBase}/api/dt1-declarations?company=${encodeURIComponent(company)}`,
        { headers: { Authorization: 'Bearer ' + token } });
      if (r.ok) _decls = await r.json();
    } catch {}
    renderPage();
  }

  // ── Zapisz deklarację (wywoływane przy generowaniu PDF DT-1) ───────────────
  async function saveDeclaration({ rok, total_tax, vehicle_count, gmina, vehicles, notes }) {
    const apiBase = window.CF_WORKER_URL || '';
    if (!apiBase) return null;
    try {
      const company = window.currentCompanyId || 'mtoilet';
      const token   = localStorage.getItem('cf_token') || '';
      const r = await fetch(`${apiBase}/api/dt1-declarations?company=${encodeURIComponent(company)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ rok, total_tax, vehicle_count, gmina, vehicles, notes }),
      });
      if (r.ok) {
        const res = await r.json();
        await load();
        return res.id;
      }
    } catch {}
    return null;
  }

  // ── Usuń ──────────────────────────────────────────────────────────────────
  async function deleteDecl(id) {
    if (!confirm('Usunąć tę deklarację z archiwum?')) return;
    const apiBase = window.CF_WORKER_URL || '';
    if (!apiBase) return;
    const company = window.currentCompanyId || 'mtoilet';
    const token   = localStorage.getItem('cf_token') || '';
    await fetch(`${apiBase}/api/dt1-declarations/${id}?company=${encodeURIComponent(company)}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token },
    });
    await load();
  }

  // ── Szczegóły — modal z listą pojazdów ────────────────────────────────────
  async function showDetail(id) {
    const apiBase = window.CF_WORKER_URL || '';
    if (!apiBase) return;
    const company = window.currentCompanyId || 'mtoilet';
    const token   = localStorage.getItem('cf_token') || '';
    let decl;
    try {
      const r = await fetch(`${apiBase}/api/dt1-declarations/${id}?company=${encodeURIComponent(company)}`,
        { headers: { Authorization: 'Bearer ' + token } });
      if (!r.ok) { if (typeof toast === 'function') toast('Błąd pobierania danych'); return; }
      decl = await r.json();
    } catch (e) {
      if (typeof toast === 'function') toast('Błąd sieci — nie można załadować deklaracji');
      console.error('[DT1] showDetail fetch error:', e);
      return;
    }
    const _e = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    let modal = document.getElementById('dt1decl-detail-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'dt1decl-detail-modal';
    modal.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;align-items:center;justify-content:center;padding:24px';
    modal.innerHTML = `
      <div style="background:var(--bg);border-radius:var(--radius-lg);padding:28px;width:700px;max-width:97vw;box-shadow:0 8px 48px rgba(0,0,0,.4);max-height:90vh;overflow-y:auto">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <i class="ti ti-file-certificate" style="font-size:22px;color:var(--blue)"></i>
          <div>
            <div style="font-size:16px;font-weight:700">DT-1 ${_e(decl.rok)}</div>
            <div style="font-size:12px;color:var(--text2)">${_e(decl.gmina||'—')} · ${new Date(decl.created_at).toLocaleDateString('pl-PL')} · ${_e(decl.created_by||'—')}</div>
          </div>
          <button onclick="document.getElementById('dt1decl-detail-modal').remove()" style="margin-left:auto;background:none;border:none;font-size:24px;cursor:pointer;color:var(--text3)">×</button>
        </div>
        <div style="display:flex;gap:16px;margin-bottom:18px">
          <div style="flex:1;background:var(--bg2);border-radius:var(--radius);padding:12px 16px;text-align:center">
            <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Łączna kwota podatku</div>
            <div style="font-size:22px;font-weight:700;color:var(--blue)">${Number(decl.total_tax||0).toLocaleString('pl-PL',{minimumFractionDigits:2})} zł</div>
          </div>
          <div style="flex:1;background:var(--bg2);border-radius:var(--radius);padding:12px 16px;text-align:center">
            <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Liczba pojazdów</div>
            <div style="font-size:22px;font-weight:700">${decl.vehicle_count}</div>
          </div>
          <div style="flex:1;background:var(--bg2);border-radius:var(--radius);padding:12px 16px;text-align:center">
            <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Rok podatkowy</div>
            <div style="font-size:22px;font-weight:700">${decl.rok}</div>
          </div>
        </div>
        ${decl.notes ? `<div style="background:var(--bg2);border-radius:var(--radius);padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--text2)"><i class="ti ti-note"></i> ${_e(decl.notes)}</div>` : ''}
        <div style="max-height:360px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius)">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:var(--bg2);position:sticky;top:0">
                <th style="padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Nr rej.</th>
                <th style="padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Pojazd</th>
                <th style="padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Kat.</th>
                <th style="padding:7px 10px;text-align:right;border-bottom:1px solid var(--border)">Mies.</th>
                <th style="padding:7px 10px;text-align:right;border-bottom:1px solid var(--border)">Kwota</th>
              </tr>
            </thead>
            <tbody>
              ${(decl.vehicles||[]).map(v => `
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:5px 10px;font-weight:600;font-family:var(--mono)">${_e(v.nrRej||v.nr_rej||'—')}</td>
                <td style="padding:5px 10px">${_e([v.marka,v.model].filter(Boolean).join(' ')||'—')}</td>
                <td style="padding:5px 10px;color:var(--text2)">${_e(v.cat||'—')}</td>
                <td style="padding:5px 10px;text-align:right">${v.miesiacePodatku||12}</td>
                <td style="padding:5px 10px;text-align:right;font-weight:600;color:var(--blue)">${Number(v.amount||0).toLocaleString('pl-PL',{minimumFractionDigits:2})} zł</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  // ── Render strony ──────────────────────────────────────────────────────────
  function renderPage() {
    const el = document.getElementById('dt1decl-list');
    if (!el) return;

    if (!_decls.length) {
      el.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text3)">
        <i class="ti ti-file-certificate" style="font-size:48px;display:block;margin-bottom:12px"></i>
        <div style="font-size:14px;font-weight:500;margin-bottom:6px">Brak zapisanych deklaracji</div>
        <div style="font-size:12px">Deklaracje są zapisywane automatycznie po wygenerowaniu PDF DT-1.</div>
      </div>`;
      return;
    }

    // Grupuj po roku
    const byYear = {};
    _decls.forEach(d => { (byYear[d.rok]||(byYear[d.rok]=[])).push(d); });

    el.innerHTML = Object.keys(byYear).sort((a,b)=>b-a).map(rok => `
      <div style="margin-bottom:24px">
        <div style="font-size:12px;font-weight:700;color:var(--text3);letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
          Rok ${rok} — ${byYear[rok].length} deklaracj${byYear[rok].length===1?'a':'e/i'}
        </div>
        ${byYear[rok].map(d => {
          const dt = new Date(d.created_at).toLocaleDateString('pl-PL');
          const tm = new Date(d.created_at).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'});
          return `
          <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:8px;background:var(--bg)">
            <div style="width:40px;height:40px;border-radius:var(--radius);background:var(--blue-light);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <i class="ti ti-file-certificate" style="color:var(--blue);font-size:20px"></i>
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:13px">DT-1 ${d.rok} — ${esc(d.gmina||'gmina')}</div>
              <div style="font-size:11px;color:var(--text3)">${dt} ${tm} · ${esc(d.created_by||'—')} · ${d.vehicle_count} pojazdów</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-weight:700;color:var(--blue);font-size:15px">${Number(d.total_tax||0).toLocaleString('pl-PL',{minimumFractionDigits:2})} zł</div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button class="btn btn-gray" style="padding:5px 10px;font-size:11px" data-id="${esc(d.id)}" onclick="Dt1Declarations.showDetail(this.dataset.id)">
                <i class="ti ti-eye"></i>
              </button>
              <button class="btn btn-gray" style="padding:5px 10px;font-size:11px;color:var(--red)" data-id="${esc(d.id)}" onclick="Dt1Declarations.deleteDecl(this.dataset.id)">
                <i class="ti ti-trash"></i>
              </button>
            </div>
          </div>`;
        }).join('')}
      </div>`).join('');
  }

  return { load, renderPage, saveDeclaration, deleteDecl, showDetail };
})();
