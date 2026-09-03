/**
 * TaxOrder Pro — DocViewer
 * Podgląd dokumentów (PDF, obrazy) z możliwością drukowania i pobierania.
 * API: window.DocViewer.open(src, opts) | openFile(file, opts) | openUrl(url, title, mime)
 */
window.DocViewer = (function () {
  'use strict';

  let _objUrl   = null;   // aktualny Object URL (do revoke po zamknięciu)
  let _blob     = null;   // aktualny Blob
  let _filename = '';

  // ── Otwieranie ─────────────────────────────────────────────────────────────

  /** Otwiera plik File/Blob */
  function openFile(file, opts) {
    if (!file) return;
    _filename = (opts && opts.title) || file.name || 'Dokument';
    _render(file, file.type);
  }

  /** Otwiera data URL lub blob URL */
  function openDataUrl(dataUrl, mimeType, title) {
    _filename = title || 'Dokument';
    fetch(dataUrl).then(r => r.blob()).then(blob => _render(blob, mimeType || blob.type || 'application/octet-stream')).catch(() => _showError('Nie można otworzyć pliku.'));
  }

  /** Otwiera URL z R2 (pobiera blob z nagłówkiem auth) */
  async function openUrl(url, title, mimeType) {
    _filename = title || 'Dokument';
    _setTitle(_filename);
    _showLoading();
    _openModal();
    try {
      const tok = localStorage.getItem('cf_token') || localStorage.getItem('session_token') || '';
      const r = await fetch(url, tok ? { headers: { 'Authorization': `Bearer ${  tok}` } } : {});
      if (!r.ok) {
        // Backend zwraca czytelny komunikat w {error:"..."} (np. "Dokument nie
        // znaleziony" gdy wiersz w D1 istnieje, ale plik zniknął z R2) — poprzednia
        // wersja go odrzucała i pokazywała gołe "HTTP 404" zamiast tego tekstu.
        let msg = `HTTP ${  r.status}`;
        try { const body = await r.clone().json(); if (body?.error) msg = body.error; } catch (_) {}
        throw new Error(msg);
      }
      const blob = await r.blob();
      _render(blob, mimeType || blob.type || 'application/octet-stream');
    } catch (e) {
      _showError(e.message || 'Błąd pobierania pliku');
    }
  }

  /** Otwiera dokument z API /api/docs — podaj R2 key lub pełny URL */
  async function openDocKey(r2Key, title, mimeType) {
    const base = (window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev').replace(/\/$/, '');
    await openUrl(`${base}/api/docs/file/${encodeURIComponent(r2Key)}`, title, mimeType);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function _render(blob, mimeType) {
    _blob = blob;
    if (_objUrl) { URL.revokeObjectURL(_objUrl); }
    _objUrl = URL.createObjectURL(blob);
    const mime = (mimeType || blob.type || '').toLowerCase();
    const el = document.getElementById('dv-content');
    if (!el) return;
    if (mime.includes('pdf')) {
      el.innerHTML = `<iframe id="dv-iframe" src="${_objUrl}" style="width:100%;height:100%;border:none;display:block" title="${esc(_filename)}"></iframe>`;
    } else if (mime.startsWith('image/')) {
      el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#111;padding:16px;box-sizing:border-box;overflow:auto">
        <img src="${_objUrl}" alt="${esc(_filename)}" style="max-width:100%;max-height:calc(100vh - 120px);object-fit:contain;box-shadow:0 4px 32px rgba(0,0,0,.6);border-radius:4px">
      </div>`;
    } else {
      el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;color:var(--text2)">
        <i class="ti ti-file" style="font-size:64px;color:var(--text3)"></i>
        <div>Podgląd niedostępny dla formatu: <strong>${esc(mime || 'nieznany')}</strong></div>
        <button class="btn btn-blue" onclick="DocViewer.download()"><i class="ti ti-download"></i> Pobierz plik</button>
      </div>`;
    }
    _setTitle(_filename);
    _openModal();
  }

  // ── Akcje ─────────────────────────────────────────────────────────────────

  function print() {
    const iframe = document.getElementById('dv-iframe');
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        return;
      } catch (_) {}
    }
    // Fallback — otwórz w nowym oknie i drukuj
    if (_objUrl) {
      const w = window.open(_objUrl, '_blank');
      if (w) { w.addEventListener('load', () => setTimeout(() => { try { w.print(); } catch (_) {} }, 400)); }
    }
  }

  function download() {
    if (!_objUrl || !_blob) return;
    const a = document.createElement('a');
    a.href = _objUrl;
    a.download = _filename || 'dokument';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function close() {
    document.getElementById('doc-viewer-modal')?.classList.add('hidden');
    const el = document.getElementById('dv-content');
    if (el) el.innerHTML = '';
    if (_objUrl) { URL.revokeObjectURL(_objUrl); _objUrl = null; }
    _blob = null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _openModal()   { document.getElementById('doc-viewer-modal')?.classList.remove('hidden'); }
  function _setTitle(t)   { const el = document.getElementById('dv-title'); if (el) el.textContent = t; }
  function _showLoading() {
    const el = document.getElementById('dv-content');
    if (el) el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:12px;color:var(--text3)"><i class="ti ti-loader-2" style="font-size:40px;animation:spin 1s linear infinite"></i><span>Ładowanie dokumentu…</span></div>';
  }
  function _showError(msg) {
    const el = document.getElementById('dv-content');
    if (el) el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:12px;color:var(--red)"><i class="ti ti-alert-circle" style="font-size:40px"></i><div>${esc(msg)}</div></div>`;
  }

  // ── Karta pojazdu (wydruk A4) ────────────────────────────────────────────

  async function printVehicleCard(nrRej) {
    const v = (window.vehs || []).find(x => x.nrRej === nrRej);
    if (!v) { if (typeof toast === 'function') toast('Pojazd nie znaleziony'); return; }

    const base   = (window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev').replace(/\/$/, '');
    const company= window._currentCompany || window.currentCompanyId || 'mtoilet';
    const tok    = localStorage.getItem('cf_token') || '';
    const H      = { 'Authorization': `Bearer ${  tok}`, 'Content-Type': 'application/json' };

    let docs = [], policies = [];
    try {
      const [dR, pR] = await Promise.allSettled([
        fetch(`${base}/api/docs?nrRej=${encodeURIComponent(nrRej)}&company=${encodeURIComponent(company)}`, { headers: H }).then(r => r.json()),
        fetch(`${base}/api/policies-db?nrRej=${encodeURIComponent(nrRej)}&company=${encodeURIComponent(company)}`, { headers: H }).then(r => r.json()),
      ]);
      if (dR.status === 'fulfilled' && Array.isArray(dR.value)) docs = dR.value;
      if (pR.status === 'fulfilled' && Array.isArray(pR.value)) policies = pR.value;
    } catch (_) {}

    // Dane DT-1
    const tax = (typeof calcTax === 'function') ? (calcTax({ ...v, _taxYear: new Date().getFullYear() }) || {}) : {};

    // Dokumenty z modułu DocumentsModule (metadane)
    const moduleDocs = v.documents || [];

    const now   = new Date();
    const datePL = now.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });

    function fmtDate(d) {
      if (!d) return '—';
      try {
        const dt = new Date(d.includes('T') ? d : `${d  }T00:00:00`);
        return dt.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
      } catch(_) { return d; }
    }

    function field(label, val) {
      const safe = (val != null && val !== '') ? esc(String(val)) : '—';
      return `<div class="field"><div class="fl">${label}</div><div class="fv">${safe}</div></div>`;
    }

    // Aktywne polisy OC / AC
    const oc = policies.find(p => p.type === 'OC' || p.typ === 'OC' || (p.rodzaj||'').includes('OC'));
    const ac = policies.find(p => p.type === 'AC' || p.typ === 'AC' || (p.rodzaj||'').includes('AC'));

    // Status badge
    const statusColor = { 'Własny': '#16a34a', 'Leasing': '#2563eb', 'Wynajęty': '#d97706', 'Archiwalny': '#6b7280' };
    const scol = statusColor[v.status] || '#6b7280';

    const html = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<title>Karta pojazdu — ${esc(v.nrRej)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1e293b;background:#fff;padding:20px}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:3px solid #2563eb;margin-bottom:18px}
.logo{font-size:18px;font-weight:700;color:#2563eb;letter-spacing:-0.5px}
.logo-sub{font-size:10px;color:#64748b;margin-top:3px}
.nr-rej{font-size:26px;font-weight:800;color:#1e40af;border:3px solid #2563eb;padding:6px 18px;border-radius:8px;letter-spacing:1px;background:#eff6ff}
.section{margin-bottom:16px}
.section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid #e2e8f0}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.field{}
.fl{font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px}
.fv{font-size:13px;font-weight:600;color:#0f172a}
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:99px;font-size:10px;font-weight:700;border:1.5px solid currentColor}
.policy-row{display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:#f8fafc;border-radius:6px;margin-bottom:5px;border:1px solid #e2e8f0}
.doc-list{list-style:none}
.doc-list li{padding:5px 10px;border-radius:5px;background:#f8fafc;border:1px solid #e2e8f0;margin-bottom:4px;display:flex;justify-content:space-between;font-size:11px}
.tax-box{background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:8px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center}
.tax-amount{font-size:22px;font-weight:800;color:#1e40af}
.footer{margin-top:20px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8}
@media print{
  body{padding:10px}
  @page{margin:10mm;size:A4}
  .no-print{display:none}
}
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">🚛 TaxOrder Pro</div>
    <div class="logo-sub">Karta pojazdu &bull; wydruk: ${datePL}</div>
  </div>
  <div style="text-align:right">
    <div class="nr-rej">${esc(v.nrRej)}</div>
    <div style="margin-top:6px;text-align:right"><span class="badge" style="color:${scol}">${esc(v.status || '—')}</span></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Dane pojazdu</div>
  <div class="grid">
    ${field('Marka', v.marka)}
    ${field('Model', v.model)}
    ${field('Rok produkcji', v.rok)}
    ${field('Typ', v.typ)}
    ${field('DMC (kg)', v.dmc ? `${(v.dmc).toLocaleString('pl-PL')  } kg` : '—')}
    ${field('Paliwo', v.paliwo)}
    ${field('Norma emisji', v.euro)}
    ${field('Właściciel', v.wlasciciel)}
  </div>
</div>

${v.vin ? `<div class="section">
  <div class="section-title">Identyfikacja</div>
  <div class="grid-2">
    ${field('Numer VIN', v.vin)}
    ${field('Nr rej.', v.nrRej)}
  </div>
</div>` : ''}

${tax.cat ? `<div class="section">
  <div class="section-title">Podatek od środków transportu (DT-1)</div>
  <div class="tax-box">
    <div class="grid-3" style="flex:1">
      ${field('Kategoria', tax.cat)}
      ${field('Miesięcy opodatkowania', v.miesiacePodatku || 12)}
      ${field('Gmina', v.gmina || 'Warszawa')}
    </div>
    <div style="text-align:right;padding-left:20px">
      <div style="font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:4px">Kwota podatku</div>
      <div class="tax-amount">${tax.amount != null ? `${Math.round(tax.amount).toLocaleString('pl-PL')  } zł` : '—'}</div>
      <div style="font-size:9px;color:#64748b">rocznie</div>
    </div>
  </div>
</div>` : ''}

${policies.length ? `<div class="section">
  <div class="section-title">Ubezpieczenia</div>
  ${policies.map(p => {
    const expiry = p.expiry_date || p.dataKonca || p.valid_to;
    const typeLabel = p.type || p.typ || p.rodzaj || 'Polisa';
    let daysLeft = null;
    if (expiry) {
      const d = new Date(expiry.includes('T') ? expiry : `${expiry  }T00:00:00`);
      daysLeft = Math.round((d - now) / 86400000);
    }
    const color = daysLeft === null ? '#64748b' : daysLeft < 0 ? '#dc2626' : daysLeft <= 30 ? '#d97706' : '#16a34a';
    return `<div class="policy-row">
      <div><strong>${esc(typeLabel)}</strong>${p.towarzystwo || p.insurer ? ` &bull; ${esc(p.towarzystwo || p.insurer)}` : ''}</div>
      <div style="color:${color};font-weight:600;font-size:11px">${expiry ? `Ważna do: ${fmtDate(expiry)}${daysLeft !== null ? ` (${daysLeft < 0 ? `${Math.abs(daysLeft)} dni temu` : `za ${daysLeft} dni`})` : ''}` : '—'}</div>
    </div>`;
  }).join('')}
</div>` : ''}

${(docs.length || moduleDocs.length) ? `<div class="section">
  <div class="section-title">Dokumenty (${docs.length + moduleDocs.length})</div>
  <ul class="doc-list">
    ${docs.map(d => `<li>
      <span><strong>${esc(d.name || d.filename || 'Dokument')}</strong>${d.doc_type ? ` &bull; ${esc(d.doc_type)}` : ''}</span>
      <span style="color:#64748b">${fmtDate(d.created_at || d.uploaded_at)}</span>
    </li>`).join('')}
    ${moduleDocs.map(d => {
      const expiry = d.expiry;
      let ds = null;
      if (expiry) { const dt = new Date(`${expiry  }T00:00:00`); ds = Math.round((dt-now)/86400000); }
      const col = ds === null ? '#64748b' : ds < 0 ? '#dc2626' : ds <= 30 ? '#d97706' : '#16a34a';
      return `<li>
        <span>${esc(d.name || '—')}${d.type ? ` &bull; ${esc(d.type)}` : ''}</span>
        <span style="color:${col}">${expiry ? fmtDate(expiry) : '—'}</span>
      </li>`;
    }).join('')}
  </ul>
</div>` : ''}

<div class="footer">
  <span>TaxOrder Pro &bull; ${company}</span>
  <span>Wygenerowano: ${datePL}</span>
</div>

<script>setTimeout(()=>window.print(),400);<\/script>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=960,height=700,menubar=no,toolbar=no');
    if (!w) { if (typeof toast === 'function') toast('⚠ Zezwól na otwieranie okien wyskakujących'); return; }
    w.document.write(html);
    w.document.close();
  }

  return { openFile, openDataUrl, openUrl, openDocKey, print, download, close, printVehicleCard };
})();
