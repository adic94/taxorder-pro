/**
 * TaxOrder Pro — Import CSV danych ubezpieczeń i przeglądów
 * Obsługuje pliki CSV z separatorem ; lub ,
 * Dopasowuje wiersze do pojazdów po numerze rejestracyjnym
 */
window.CSVImport = (function () {

  let _data = null;
  let _headers = [];
  let _mapping = {};

  // Aliasy nagłówków kolumn w różnych wersjach (bez polskich znaków dla niezawodnego dopasowania)
  const FIELD_ALIASES = {
    nrRej:           ['nr rej', 'rejestracja', 'tablica', 'nrrej', 'nr.rej', 'nr rejestracyjny', 'registration'],
    ocPolicyNo:      ['oc nr polisy', 'nr polisy oc', 'polisa oc', 'oc - nr polisy', 'numer polisy oc', 'oc nr'],
    ocInsurer:       ['oc towarzystwo', 'ubezpieczyciel oc', 'oc firma', 'oc - towarzystwo', 'oc tow'],
    ocStart:         ['oc od', 'oc start', 'oc poczatek', 'oc - od', 'oc od (rrrr'],
    ocEnd:           ['oc do', 'oc koniec', 'oc waznosc', 'oc - do', 'oc do (rrrr', 'oc wygasa'],
    ocPremium:       ['oc skladka', 'oc - skladka', 'skladka oc'],
    acPolicyNo:      ['ac nr polisy', 'nr polisy ac', 'polisa ac', 'ac - nr polisy', 'casco nr'],
    acInsurer:       ['ac towarzystwo', 'ubezpieczyciel ac', 'ac firma', 'ac - towarzystwo', 'ac tow'],
    acStart:         ['ac od', 'ac start', 'ac - od', 'ac od (rrrr'],
    acEnd:           ['ac do', 'ac koniec', 'ac waznosc', 'ac - do', 'ac do (rrrr', 'ac wygasa'],
    acPremium:       ['ac skladka', 'ac - skladka', 'skladka ac'],
    lastInspection:  ['ostatni przeglad', 'przeglad - ostatni', 'data przegladu', 'przeglad ostatni'],
    nextInspection:  ['nastepny przeglad', 'przeglad - nastepny', 'termin przegladu', 'kolejny przeglad', 'przeglad do'],
    inspectionResult:['wynik przegladu', 'przeglad - wynik', 'wynik'],
    inspectionStation:['stacja', 'sktd', 'stacja kontroli'],
    kierowca:        ['kierowca', 'driver', 'operator', 'przypisany kierowca'],
    stanKilometrow:  ['km', 'kilometry', 'stan licznika', 'przebieg', 'stan km'],
    kartaOrlen:      ['karta flotowa', 'karta orlen', 'orlen', 'karta paliwa', 'nr karty'],
  };

  const NUMERIC_FIELDS = new Set(['ocPremium', 'acPremium', 'stanKilometrow']);

  function _normalize(str) {
    return str.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function open() {
    const el = document.getElementById('csv-import-modal');
    if (el) el.style.display = 'flex';
    _reset();
  }

  function close() {
    const el = document.getElementById('csv-import-modal');
    if (el) el.style.display = 'none';
    _reset();
  }

  function _reset() {
    _data = null; _headers = []; _mapping = {};
    const p = document.getElementById('csv-preview');
    if (p) p.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:24px">Wgraj plik CSV aby zobaczyć podgląd</div>';
    const fi = document.getElementById('csv-file-input');
    if (fi) fi.value = '';
  }

  function downloadTemplate() {
    const headers = [
      'Nr rej.',
      'OC - Nr polisy', 'OC - Towarzystwo', 'OC - Od (RRRR-MM-DD)', 'OC - Do (RRRR-MM-DD)', 'OC - Składka (zł)',
      'AC - Nr polisy', 'AC - Towarzystwo', 'AC - Od (RRRR-MM-DD)', 'AC - Do (RRRR-MM-DD)', 'AC - Składka (zł)',
      'Przegląd - Ostatni (RRRR-MM-DD)', 'Przegląd - Następny (RRRR-MM-DD)', 'Przegląd - Wynik', 'Przegląd - Stacja',
      'Kierowca', 'Stan km', 'Karta flotowa'
    ];
    const examples = (window.vehs || []).slice(0, 5).map(v => [
      v.nrRej, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
    ]);
    const rows = [headers, ...examples];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    _download(`﻿${  csv}`, 'szablon_ubezpieczenia.csv', 'text/csv;charset=utf-8');
    if (typeof toast === 'function') toast(t('csvi.toast.template.dl'));
  }

  function handleFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => _parse(e.target.result);
    reader.onerror = () => { if (typeof toast === 'function') toast(t('csvi.toast.file.err')); };
    reader.readAsText(file, 'UTF-8');
  }

  function _parse(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const sep = (text.split(';').length >= text.split(',').length) ? ';' : ',';
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      if (typeof toast === 'function') toast(t('csvi.toast.empty'));
      return;
    }

    const parseRow = line => {
      const cells = []; let inQ = false, cur = '';
      for (const c of line) {
        if (c === '"') inQ = !inQ;
        else if (c === sep && !inQ) { cells.push(cur.trim()); cur = ''; }
        else cur += c;
      }
      cells.push(cur.trim());
      return cells;
    };

    _headers = parseRow(lines[0]);
    _data = lines.slice(1).map(parseRow);
    _autoMap();
    _renderPreview();
  }

  function _autoMap() {
    _mapping = {};
    const used = new Set();
    _headers.forEach((h, idx) => {
      const hN = _normalize(h);
      for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
        if (used.has(field)) continue;
        if (aliases.some(a => hN.includes(_normalize(a)))) {
          _mapping[idx] = field;
          used.add(field);
          break;
        }
      }
    });
  }

  function _renderPreview() {
    const el = document.getElementById('csv-preview');
    if (!el || !_data) return;

    const nrRejIdx = parseInt(Object.keys(_mapping).find(k => _mapping[k] === 'nrRej'));
    const hasNrRej = !isNaN(nrRejIdx);
    const mappedCount = Object.keys(_mapping).length;

    const matchCount = hasNrRej ? _data.filter(r => {
      const nr = (r[nrRejIdx] || '').trim().toUpperCase();
      return nr && (window.vehs || []).some(v => v.nrRej.toUpperCase() === nr);
    }).length : 0;

    const notMatchedSample = hasNrRej ? _data
      .filter(r => {
        const nr = (r[nrRejIdx] || '').trim().toUpperCase();
        return nr && !(window.vehs || []).some(v => v.nrRej.toUpperCase() === nr);
      }).slice(0, 3).map(r => r[nrRejIdx]) : [];

    const preview = _data.slice(0, 6);

    el.innerHTML = `
      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
        <div style="background:var(--bg3);border-radius:var(--radius);padding:10px 16px;text-align:center;min-width:90px">
          <div style="font-size:20px;font-weight:700">${_data.length}</div>
          <div style="font-size:11px;color:var(--text2)">Wierszy</div>
        </div>
        <div style="background:var(--bg3);border-radius:var(--radius);padding:10px 16px;text-align:center;min-width:90px">
          <div style="font-size:20px;font-weight:700;color:var(--blue)">${mappedCount}</div>
          <div style="font-size:11px;color:var(--text2)">Zmapowanych pól</div>
        </div>
        <div style="background:var(--bg3);border-radius:var(--radius);padding:10px 16px;text-align:center;min-width:90px">
          <div style="font-size:20px;font-weight:700;color:${matchCount > 0 ? 'var(--green)' : 'var(--red)'}">${matchCount}</div>
          <div style="font-size:11px;color:var(--text2)">Dopasowanych pojazdów</div>
        </div>
      </div>

      ${!hasNrRej ? '<div class="wbox" style="margin-bottom:12px"><i class="ti ti-alert-triangle"></i>Nie wykryto kolumny z nr rejestracyjnym. Upewnij się, że nagłówek zawiera np. "Nr rej." lub "Rejestracja".</div>' : ''}
      ${notMatchedSample.length ? `<div class="ibox" style="margin-bottom:12px"><i class="ti ti-info-circle"></i>Nie znaleziono w flocie: <strong>${notMatchedSample.map(s=>esc(s)).join(', ')}${notMatchedSample.length === 3 ? '...' : ''}</strong></div>` : ''}

      <div style="overflow-x:auto;margin-bottom:14px;max-height:220px;overflow-y:auto">
        <table style="font-size:11px;border-collapse:collapse;width:100%;min-width:500px">
          <thead><tr>
            ${_headers.map((h, i) => `<th style="background:var(--bg3);padding:5px 8px;border:1px solid var(--border);white-space:nowrap;text-align:left;position:sticky;top:0">
              <div style="font-weight:600">${esc(h)}</div>
              <div style="color:${_mapping[i] ? 'var(--green)' : 'var(--text3)'};font-size:10px;font-weight:400;margin-top:1px">
                ${_mapping[i] ? `→ ${  _mapping[i]}` : '—'}
              </div>
            </th>`).join('')}
          </tr></thead>
          <tbody>
            ${preview.map(row => `<tr>${row.map((c, i) =>
              `<td style="padding:4px 8px;border:1px solid var(--border);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${_mapping[i] ? 'var(--text)' : 'var(--text3)'}">${esc(c || '—')}</td>`
            ).join('')}</tr>`).join('')}
          </tbody>
        </table>
        ${_data.length > 6 ? `<div style="font-size:11px;color:var(--text3);padding:4px 0">...i ${_data.length - 6} dalszych wierszy</div>` : ''}
      </div>

      <button class="btn btn-green" style="width:100%;justify-content:center;padding:10px"
        onclick="CSVImport.doImport()"
        ${hasNrRej && matchCount > 0 ? '' : 'disabled'}>
        <i class="ti ti-file-import"></i>Importuj dane dla ${matchCount} pojazdów
      </button>
    `;
  }

  async function doImport() {
    if (!_data) return;
    const nrRejIdx = parseInt(Object.keys(_mapping).find(k => _mapping[k] === 'nrRej'));
    if (isNaN(nrRejIdx)) return;

    let updated = 0, skipped = 0;
    const rowLog = [];
    const updatedVehs = [];

    _data.forEach((row, rowIdx) => {
      const nr = (row[nrRejIdx] || '').trim().toUpperCase();
      if (!nr) {
        skipped++;
        rowLog.push({ rowIdx: rowIdx + 2, nr: '—', result: 'empty' });
        return;
      }
      const v = (window.vehs || []).find(x => x.nrRej.toUpperCase() === nr);
      if (!v) {
        rowLog.push({ rowIdx: rowIdx + 2, nr, result: 'notFound' });
        return;
      }

      let fieldsUpdated = 0;
      Object.entries(_mapping).forEach(([colIdx, field]) => {
        if (field === 'nrRej') return;
        let val = (row[parseInt(colIdx)] || '').trim() || null;
        if (val && NUMERIC_FIELDS.has(field)) {
          val = parseFloat(val.replace(',', '.').replace(/\s/g, '')) || null;
        }
        if (val !== null) { v[field] = val; fieldsUpdated++; }
      });
      updated++;
      updatedVehs.push(v);
      rowLog.push({ rowIdx: rowIdx + 2, nr, result: 'ok', fieldsUpdated });
    });

    if (window.TaxOrderFleetCloud?.saveVehicle) {
      for (const v of updatedVehs) {
        await window.TaxOrderFleetCloud.saveVehicle(v).catch(() => {});
      }
    }

    if (typeof renderVeh === 'function') renderVeh();
    if (typeof renderDash === 'function') renderDash();

    // Pokaż raport w oknie zamiast toast+zamknij
    const preview = document.getElementById('csv-preview');
    if (!preview) { close(); return; }

    const problemRows = rowLog.filter(r => r.result !== 'ok');
    const notFoundCount = rowLog.filter(r => r.result === 'notFound').length;

    preview.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
        <div style="padding:12px;background:var(--green-light,#f0fdf4);border:1px solid var(--green,#22c55e);border-radius:var(--radius);text-align:center">
          <div style="font-size:22px;font-weight:700;color:var(--green,#22c55e)">${updated}</div>
          <div style="font-size:11px;color:var(--text2)">Zaktualizowanych</div>
        </div>
        <div style="padding:12px;background:${notFoundCount ? 'var(--amber-light,#fffbeb)' : 'var(--bg3)'};border:1px solid ${notFoundCount ? 'var(--amber,#f59e0b)' : 'var(--border)'};border-radius:var(--radius);text-align:center">
          <div style="font-size:22px;font-weight:700;color:${notFoundCount ? 'var(--amber,#f59e0b)' : 'var(--text3)'}">${notFoundCount}</div>
          <div style="font-size:11px;color:var(--text2)">Nie znaleziono w flocie</div>
        </div>
        <div style="padding:12px;background:var(--bg3);border-radius:var(--radius);text-align:center">
          <div style="font-size:22px;font-weight:700;color:var(--text3)">${skipped}</div>
          <div style="font-size:11px;color:var(--text2)">Pominiętych (brak nr rej.)</div>
        </div>
      </div>
      ${problemRows.length ? `
        <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;margin-bottom:8px">Wiersze z problemami (${problemRows.length})</div>
        <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:16px">
          <table style="width:100%;font-size:11px;border-collapse:collapse">
            <thead><tr style="background:var(--bg3);position:sticky;top:0">
              <th style="padding:5px 8px;text-align:left">Wiersz CSV</th>
              <th style="padding:5px 8px;text-align:left">Nr rejestracyjny</th>
              <th style="padding:5px 8px;text-align:left">Problem</th>
            </tr></thead>
            <tbody>
              ${problemRows.map(r => `<tr style="border-top:1px solid var(--border)">
                <td style="padding:4px 8px;font-family:var(--mono);color:var(--text3)">${r.rowIdx}</td>
                <td style="padding:4px 8px;font-weight:500">${esc(r.nr)}</td>
                <td style="padding:4px 8px;color:${r.result === 'notFound' ? 'var(--amber,#f59e0b)' : 'var(--text3)'}">
                  ${r.result === 'notFound' ? 'Brak pojazdu w flocie' : 'Pusty numer rej.'}
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : `
        <div style="padding:12px;background:var(--green-light,#f0fdf4);border-radius:var(--radius);text-align:center;margin-bottom:16px;color:var(--green,#22c55e);font-weight:600">
          <i class="ti ti-check"></i> Wszystkie wiersze przetworzone bez błędów!
        </div>`}
      <button class="btn btn-blue" style="width:100%;justify-content:center;padding:10px" onclick="CSVImport.close()">
        <i class="ti ti-check"></i>Zamknij — import zakończony
      </button>
    `;
  }

  function _download(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  return { open, close, downloadTemplate, handleFile, doImport };
})();
