// ==================== IMPORT e-TOLL ====================
// Obsługa CSV z portalu e-TOLL (motopay.pl)

window.ETollImport = (function () {

  // Mapowania nagłówków CSV — e-TOLL eksportuje z polskimi lub angielskimi nagłówkami
  const COL_MAP = {
    date:     ['data i godzina','data transakcji','transaction date','data','date','timestamp'],
    nrRej:    ['nr rejestracyjny','numer rejestracyjny','registration number','nr rej','vehicle plate','rejestracja'],
    route:    ['trasa','odcinek','section','droga','route','road','opis'],
    amount:   ['opłata [pln]','opłata','kwota','amount','fee','toll [pln]','wartość','value'],
    category: ['klasa pojazdu','kategoria','category','vehicle class','klasa'],
    txId:     ['nr transakcji','id transakcji','transaction id','nr tx'],
  };

  let _preview = [];   // parsed rows before import
  let _headers = [];
  let _colIdx  = {};

  function _findColIdx(headers) {
    const out = {};
    const lh = headers.map(h => (h||'').toLowerCase().trim());
    Object.entries(COL_MAP).forEach(([field, aliases]) => {
      const i = lh.findIndex(h => aliases.some(a => h === a || h.includes(a)));
      if (i >= 0) out[field] = i;
    });
    return out;
  }

  function _parseCsv(text) {
    // Detect separator: ; or ,
    const sep = (text.split('\n')[0]?.split(';').length || 0) >= (text.split('\n')[0]?.split(',').length || 0) ? ';' : ',';
    const lines = text.split('\n').map(l => l.replace(/\r/g, ''));
    const rows = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const cols = line.split(sep).map(c => c.replace(/^"|"$/g, '').trim());
      rows.push(cols);
    }
    return rows;
  }

  function handleFile(input) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      // Try UTF-8 first, fall back to Latin-2
      let text = e.target.result;
      _processText(text);
    };
    reader.readAsText(file, 'UTF-8');
    input.value = '';
  }

  function _processText(text) {
    const rows = _parseCsv(text);
    if (rows.length < 2) { toast('Plik CSV jest pusty lub nieczytelny'); return; }

    _headers = rows[0];
    _colIdx  = _findColIdx(_headers);

    if (_colIdx.nrRej == null) {
      toast('Nie znaleziono kolumny z numerem rejestracyjnym. Sprawdź format pliku e-TOLL.');
      return;
    }

    const _seenKeys = new Set();
    _preview = rows.slice(1).map((cols, i) => {
      const nrRej  = cols[_colIdx.nrRej]  || '';
      const date   = _parseDate(cols[_colIdx.date])  || '';
      const amount = _parseAmount(cols[_colIdx.amount]);
      const route  = (cols[_colIdx.route]  || '').substring(0, 80);
      const txId   = cols[_colIdx.txId]   || '';
      return { nrRej, date, amount, route, txId, _ok: !!(nrRej && date) };
    }).filter(r => {
      if (!r._ok || !r.nrRej) return false;
      const key = `${r.nrRej}|${r.date}|${r.amount}|${r.txId || r.route}`;
      if (_seenKeys.has(key)) return false;
      _seenKeys.add(key);
      return true;
    });

    _renderPreview();
  }

  function _parseDate(raw) {
    if (!raw) return '';
    const s = raw.trim();
    // "2024-01-15 08:23:45" or "15.01.2024 08:23"
    const iso = s.replace(' ', 'T');
    if (iso.match(/^\d{4}-\d{2}-\d{2}/)) return iso.substring(0, 10);
    const pl = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
    if (pl) return `${pl[3]}-${pl[2]}-${pl[1]}`;
    return s.substring(0, 10);
  }

  function _parseAmount(raw) {
    if (raw == null) return 0;
    return parseFloat(String(raw).replace(',', '.').replace(/[^\d.]/g, '')) || 0;
  }

  function _renderPreview() {
    const el = document.getElementById('etoll-preview');
    if (!el) return;

    if (!_preview.length) {
      el.innerHTML = `<div style="padding:16px;color:var(--text3);font-size:13px">Nie znaleziono pasujących wierszy. Sprawdź format pliku.</div>`;
      return;
    }

    const vehs = window.vehs || [];
    const knownNr = new Set(vehs.map(v => (v.nrRej||'').toUpperCase().replace(/\s/g,'')));
    const matched = _preview.filter(r => knownNr.has(r.nrRej.toUpperCase().replace(/\s/g,'')));
    const unmatched = _preview.filter(r => !knownNr.has(r.nrRej.toUpperCase().replace(/\s/g,'')));

    const byNr = {};
    matched.forEach(r => {
      byNr[r.nrRej] = (byNr[r.nrRej] || 0) + r.amount;
    });

    const totalAmt = _preview.reduce((s, r) => s + r.amount, 0);
    const fmt = n => n.toFixed(2).replace('.', ',');

    el.innerHTML = `
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
        <div class="fkpi-card" style="flex:1;min-width:140px;padding:12px 16px">
          <div style="font-size:20px;font-weight:800">${_preview.length}</div>
          <div style="font-size:11px;color:var(--text2)">Transakcji</div>
        </div>
        <div class="fkpi-card" style="flex:1;min-width:140px;padding:12px 16px">
          <div style="font-size:20px;font-weight:800">${matched.length}</div>
          <div style="font-size:11px;color:var(--text2)">Dopasowanych do floty</div>
        </div>
        <div class="fkpi-card" style="flex:1;min-width:140px;padding:12px 16px">
          <div style="font-size:20px;font-weight:800">${fmt(totalAmt)} zł</div>
          <div style="font-size:11px;color:var(--text2)">Łączna kwota</div>
        </div>
      </div>
      ${unmatched.length ? `<div class="gbox" style="margin-bottom:10px"><i class="ti ti-alert-triangle"></i>${unmatched.length} transakcji z nieznanymi tablicami: ${[...new Set(unmatched.map(r=>r.nrRej))].slice(0,6).join(', ')}${unmatched.length>6?'…':''}</div>` : ''}
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px">
        <thead><tr style="background:var(--bg2)">
          <th style="padding:6px 10px;text-align:left">Nr rej.</th>
          <th style="padding:6px 10px;text-align:left">Data</th>
          <th style="padding:6px 10px;text-align:left">Trasa</th>
          <th style="padding:6px 10px;text-align:right">Kwota</th>
        </tr></thead>
        <tbody>
          ${_preview.slice(0, 30).map((r, i) => {
            const known = knownNr.has(r.nrRej.toUpperCase().replace(/\s/g,''));
            return `<tr style="${i%2?'background:var(--bg2)':''}${!known?';opacity:.5':''}">
              <td style="padding:5px 10px;font-family:var(--mono)">${r.nrRej}</td>
              <td style="padding:5px 10px">${r.date}</td>
              <td style="padding:5px 10px;font-size:11px;color:var(--text2)">${r.route||'—'}</td>
              <td style="padding:5px 10px;text-align:right;font-weight:600">${fmt(r.amount)} zł</td>
            </tr>`;
          }).join('')}
          ${_preview.length > 30 ? `<tr><td colspan="4" style="padding:6px 10px;color:var(--text3);text-align:center;font-size:11px">… i jeszcze ${_preview.length - 30} wierszy</td></tr>` : ''}
        </tbody>
      </table>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-blue" onclick="ETollImport.importData()"><i class="ti ti-check"></i>Importuj ${matched.length} transakcji</button>
        <button class="btn btn-gray" onclick="ETollImport.reset()"><i class="ti ti-x"></i>Anuluj</button>
      </div>`;
  }

  async function importData() {
    if (!_preview.length) return;
    const vehs = window.vehs || [];
    const nrMap = {};
    vehs.forEach(v => { nrMap[(v.nrRej||'').toUpperCase().replace(/\s/g,'')] = v; });

    let count = 0;
    _preview.forEach(r => {
      const v = nrMap[r.nrRej.toUpperCase().replace(/\s/g,'')];
      if (!v) return;
      if (!Array.isArray(v.tollHistory)) v.tollHistory = [];
      const _txKey = t => t.txId || `${t.date}|${t.amount}|${t.route}`;
      const exists = v.tollHistory.some(t => _txKey(t) === _txKey(r));
      if (!exists) {
        v.tollHistory.push({ date: r.date, amount: r.amount, route: r.route, txId: r.txId });
        count++;
      }
    });

    if (typeof saveVehs === 'function') await saveVehs();
    else if (typeof window.TaxOrderFleetCloud?.bulkSaveVehicles === 'function')
      await window.TaxOrderFleetCloud.bulkSaveVehicles(vehs);

    toast(`✓ Zaimportowano ${count} nowych transakcji e-TOLL`);
    reset();
  }

  function reset() {
    _preview = []; _headers = []; _colIdx = {};
    const el = document.getElementById('etoll-preview');
    if (el) el.innerHTML = '';
  }

  function downloadSample() {
    const csv = `"Data i godzina";"Nr rejestracyjny";"Klasa pojazdu";"Trasa";"Opłata [PLN]";"Nr transakcji"
"2026-01-15 08:23:45";"WA12345";"Klasa 1";"A1 Opole-Gliwice";"4,20";"TX001"
"2026-01-15 09:11:02";"WA12345";"Klasa 1";"A4 Kraków-Katowice";"6,00";"TX002"
"2026-01-16 07:45:00";"WB98765";"Klasa 2";"S8 Warszawa-Poznań";"12,50";"TX003"`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'etoll_sample.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return { handleFile, importData, reset, downloadSample };
})();
