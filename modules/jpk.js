(function () {
  'use strict';
  const API = () => window.CF_WORKER_URL || '';
  const co  = () => window.currentCompanyId || localStorage.getItem('currentCompany') || '';
  const JPK_TYPES = {
    JPK_V7M: { lbl:'JPK_V7M (miesięczny VAT)', freq:'month' },
    JPK_V7K: { lbl:'JPK_V7K (kwartalny VAT)', freq:'quarter' },
    JPK_FA:  { lbl:'JPK_FA (faktury)', freq:'month' },
    JPK_WB:  { lbl:'JPK_WB (wyciąg bankowy)', freq:'month' },
    JPK_KR:  { lbl:'JPK_KR (księgi rachunkowe)', freq:'year' },
    SAF_T:   { lbl:'SAF-T (wszystkie dane)', freq:'year' },
  };
  const STATUS_CLR = { generating:'#f59e0b', ready:'#22c55e', error:'#ef4444', submitted:'#8b5cf6' };
  const STATUS_LBL = { generating:'Generowanie…', ready:'Gotowy', error:'Błąd', submitted:'Wysłany do MF' };

  async function api(path, opts={}) {
    const r = await fetch(`${API()}/api/jpk${path}${path.includes('?')?'&':'?'}company=${co()}`, { headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('cf_token')}`}, ...opts });
    return r.json();
  }

  function renderJpk() {
    const el = document.getElementById('page-jpk');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-file-type-xml"></i> JPK / SAF-T Export</h2>
        <button class="btn btn-primary" onclick="window.JpkModule._openGenerate()"><i class="ti ti-plus"></i> Generuj nowy JPK</button>
      </div>
      <p style="color:var(--text-muted);margin-bottom:16px;font-size:.9em">Jednolity Plik Kontrolny — eksport danych podatkowych dla Urzędu Skarbowego. Pliki generowane w formacie XML zgodnym z wymaganiami MF.</p>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Typ JPK</th><th>Okres</th><th>Data generowania</th><th>Rozmiar</th><th>Status</th><th>Akcje</th></tr></thead>
        <tbody id="jpk-tbody"><tr><td colspan="6" class="loading-row">Ładowanie...</td></tr></tbody>
      </table></div>
      <div id="jpk-generate-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.JpkModule._closeGenerate()">
        <div class="modal-box" style="max-width:480px">
          <div class="modal-header"><h3>Generuj plik JPK</h3><button class="modal-close" onclick="window.JpkModule._closeGenerate()">×</button></div>
          <div class="modal-body">
            <form id="jpk-gen-form" onsubmit="window.JpkModule._generate(event)">
              <div class="form-row"><label>Typ pliku JPK *</label>
                <select name="jpk_type" class="form-control" required>
                  ${Object.entries(JPK_TYPES).map(([v,t])=>`<option value="${v}">${esc(t.lbl)}</option>`).join('')}
                </select>
              </div>
              <div class="form-row"><label>Rok *</label>
                <input name="year" type="number" class="form-control" required value="${new Date().getFullYear()}" min="2010" max="2099">
              </div>
              <div class="form-row"><label>Miesiąc (1-12, 0 = cały rok)</label>
                <input name="month" type="number" class="form-control" min="0" max="12" value="${new Date().getMonth()}">
              </div>
              <div class="form-row"><label>Kwartał (1-4, 0 = cały rok)</label>
                <input name="quarter" type="number" class="form-control" min="0" max="4" value="0">
              </div>
              <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="window.JpkModule._closeGenerate()">Anuluj</button><button type="submit" class="btn btn-primary"><i class="ti ti-file-type-xml"></i> Generuj</button></div>
            </form>
          </div>
        </div>
      </div>`;
    _load();
  }

  async function _load() {
    const tbody = document.getElementById('jpk-tbody');
    if (!tbody) return;
    const data = await api('');
    const list = data.exports || [];
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Brak wygenerowanych plików JPK</td></tr>'; return; }
    tbody.innerHTML = list.map(e => `<tr>
      <td><strong>${esc(JPK_TYPES[e.jpk_type]?.lbl||e.jpk_type)}</strong></td>
      <td>${esc(e.period_label||e.year+'-'+String(e.month||0).padStart(2,'0'))}</td>
      <td>${esc(e.created_at?.replace('T',' ').slice(0,16)||'—')}</td>
      <td>${e.file_size_bytes ? _fmtSize(e.file_size_bytes) : '—'}</td>
      <td><span class="pill" style="background:${STATUS_CLR[e.status]||'#999'}20;color:${STATUS_CLR[e.status]||'#999'}">${esc(STATUS_LBL[e.status]||e.status)}</span></td>
      <td>
        ${e.status==='ready'?`<button class="btn-icon" title="Pobierz XML" data-id="${esc(e.id)}" onclick="window.JpkModule._download(this.dataset.id)"><i class="ti ti-download"></i></button>`:''}
        ${e.status==='ready'?`<button class="btn-icon" title="Oznacz jako wysłany" data-id="${esc(e.id)}" onclick="window.JpkModule._markSubmitted(this.dataset.id)"><i class="ti ti-send"></i></button>`:''}
        <button class="btn-icon danger" data-id="${esc(e.id)}" onclick="window.JpkModule._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
      </td>
    </tr>`).join('');
  }

  function _fmtSize(bytes) {
    if (bytes > 1024*1024) return (bytes/1024/1024).toFixed(1)+' MB';
    if (bytes > 1024) return (bytes/1024).toFixed(1)+' KB';
    return bytes+' B';
  }

  function _openGenerate() { document.getElementById('jpk-generate-modal').style.display='flex'; }
  function _closeGenerate() { document.getElementById('jpk-generate-modal').style.display='none'; }

  async function _generate(ev) {
    ev.preventDefault();
    const body = Object.fromEntries(new FormData(ev.target).entries());
    body.year  = +body.year;
    body.month = +body.month||null;
    body.quarter = +body.quarter||null;
    const btn = ev.target.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Generowanie…';
    const data = await api('/generate', { method:'POST', body: JSON.stringify(body) });
    btn.disabled = false; btn.innerHTML = '<i class="ti ti-file-type-xml"></i> Generuj';
    if (data.error) { alert('Błąd: '+esc(data.error)); return; }
    alert(`Plik JPK "${esc(JPK_TYPES[body.jpk_type]?.lbl||body.jpk_type)}" wygenerowany. Rozmiar: ${data.size ? _fmtSize(data.size) : '?'}`);
    _closeGenerate(); _load();
  }

  async function _download(id) {
    const r = await fetch(`${API()}/api/jpk/${id}/download?company=${co()}`, { headers:{'Authorization':`Bearer ${localStorage.getItem('cf_token')}`} });
    if (!r.ok) { alert('Błąd pobierania pliku.'); return; }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `JPK_${id}.xml`; a.click();
    URL.revokeObjectURL(url);
  }

  async function _markSubmitted(id) {
    if (!confirm('Oznaczyć plik jako wysłany do Ministerstwa Finansów?')) return;
    await api(`/${id}/submit`, { method:'POST', body:'{}' });
    _load();
  }

  async function _delete(id) {
    if (!confirm('Usunąć plik JPK?')) return;
    await api(`/${id}`, { method:'DELETE' });
    _load();
  }

  window.JpkModule = { renderJpk, _load, _openGenerate, _closeGenerate, _generate, _download, _markSubmitted, _delete };
})();


