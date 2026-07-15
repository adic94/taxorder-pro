/**
 * ZsiaImporter — import danych z ZSIA (ERP mToilet) do TaxOrder Pro
 * Format wejściowy: JSON wygenerowany przez tools/zsia-sync.ps1
 */
window.ZsiaImporter = (() => {

  // ──────────────────────────────────────────────────────────────
  // Mapowanie KodOddzialu ZSIA → company_id TaxOrder Pro
  // ──────────────────────────────────────────────────────────────
  const BRANCH_MAP = {
    MTL:  'mtoilet',
    GCON: 'gcon',
    GR:   'grental',
    KJR:  'kjrsupply',
    NWK:  'nwkinvest',
    WOL:  'wolund',
  };

  function _mapCompany(kod) {
    if (!kod) return null;
    return BRANCH_MAP[kod.toUpperCase()] || null;
  }

  // ──────────────────────────────────────────────────────────────
  // Obsługa pliku
  // ──────────────────────────────────────────────────────────────
  function handleFile(input) {
    const file = input.files[0];
    if (!file) return;
    input.value = '';
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        _processPayload(data, file.name);
      } catch (err) {
        _showResult('error', `Błąd parsowania JSON: ${err.message}`);
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  // ──────────────────────────────────────────────────────────────
  // Przetwarza payload ZSIA
  // ──────────────────────────────────────────────────────────────
  function _processPayload(data, filename) {
    if (!data.vehicles && !data.drivers) {
      _showResult('error', 'Plik nie zawiera danych ZSIA (brak kluczy vehicles/drivers).');
      return;
    }

    const vehicles = data.vehicles || [];
    const drivers  = data.drivers  || [];

    // Mapuj pojazdy do formatu TaxOrder Pro
    const mapped = vehicles.map(z => _mapVehicle(z)).filter(Boolean);
    const mappedDrivers = drivers.map(d => _mapDriver(d)).filter(Boolean);

    // Pokaż podgląd i pozwól zatwierdzić
    _showPreview(data, mapped, mappedDrivers, filename);
  }

  function _mapVehicle(z) {
    if (!z.nr_rej) return null;
    const nrRej = z.nr_rej.replace(/\s/g, '').toUpperCase();

    return {
      nrRej,
      marka:          z.marka       || '',
      model:          z.model       || '',
      rok:            z.rok         || '',
      vin:            z.vin         || '',
      dmcKg:          z.dmcKg       || '',
      ladownosc:      z.ladownosc   || '',
      euro:           z.euro        || '',
      typ:            z.typ         || '',
      status:         z.status      || 'AKTYWNY',
      przebiegKm:     z.przebiegKm  || '',
      avgFuel:        z.avgFuel     || '',
      ocEnd:          z.ocEnd       || '',
      acEnd:          z.acEnd       || '',
      nextInspection: z.nextInspection || '',
      udtNextDate:    z.udtNextDate || '',
      tachoNextCalib: z.tachoNextCalib || '',
      hasUdt:         !!z.udtNextDate,
      hasTacho:       !!z.tachoNextCalib,
      uwagi:          z.uwagi       || '',
      odpisVat:       z.odpisVat    || '',
      kierowca:       z.kierowca    || '',
      _zsiaSource:    true,
      _companyId:     z.company_id  || _mapCompany(z.kodOddzialu),
    };
  }

  function _mapDriver(d) {
    if (!d.name) return null;
    return {
      name:             d.name,
      license_no:       d.license_no       || '',
      license_category: d.license_category || '',
      license_expiry:   d.license_expiry   || '',
      phone:            d.phone            || '',
      email:            d.email            || '',
      _companyId:       d.company_id       || _mapCompany(d.kodOddzialu),
    };
  }

  // ──────────────────────────────────────────────────────────────
  // Podgląd importu
  // ──────────────────────────────────────────────────────────────
  function _showPreview(raw, vehicles, drivers, filename) {
    // Statystyki
    const comps  = [...new Set(vehicles.map(v => v._companyId).filter(Boolean))];
    const active = vehicles.filter(v => v.status === 'AKTYWNY').length;

    // Sprawdź które pojazdy już istnieją (po nrRej)
    const existing = typeof vehs !== 'undefined' ? vehs.map(v => v.nrRej) : [];
    const newVehs  = vehicles.filter(v => !existing.includes(v.nrRej));
    const updVehs  = vehicles.filter(v =>  existing.includes(v.nrRej));

    const html = `
      <div style="background:var(--bg2);border:1px solid var(--blue);border-radius:var(--radius-lg);padding:20px;margin-top:1rem">
        <div style="font-size:14px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <i class="ti ti-database-import" style="color:var(--blue)"></i>
          Podgląd importu ZSIA — <span style="color:var(--text2);font-weight:400">${esc(filename)}</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:16px">
          ${_chip('ti-truck',        vehicles.length,  'Pojazdy łącznie', 'blue')}
          ${_chip('ti-plus',         newVehs.length,   'Nowe',            'green')}
          ${_chip('ti-refresh',      updVehs.length,   'Aktualizacje',    'amber')}
          ${_chip('ti-id-badge',     drivers.length,   'Kierowcy',        'blue')}
          ${_chip('ti-circle-check', active,           'Aktywne',         'green')}
          ${_chip('ti-building',     comps.length,     'Firm',            'gray')}
        </div>

        ${newVehs.length ? `
        <div style="font-size:12px;font-weight:600;margin-bottom:8px"><i class="ti ti-plus" style="color:var(--green)"></i> Nowe pojazdy (${newVehs.length})</div>
        <div class="tbl-wrap" style="margin-bottom:12px;max-height:200px;overflow-y:auto"><table>
          <thead><tr><th>Nr rej.</th><th>Marka/Model</th><th>Rok</th><th>VIN</th><th>Firma</th><th>OC do</th></tr></thead>
          <tbody>${newVehs.slice(0,30).map(v => `<tr>
            <td><strong style="font-family:var(--mono)">${esc(v.nrRej)}</strong></td>
            <td>${esc(v.marka)} ${esc(v.model)}</td>
            <td>${esc(v.rok||'—')}</td>
            <td style="font-family:var(--mono);font-size:11px">${esc(v.vin||'—')}</td>
            <td><span class="pill pill-blue" style="font-size:10px">${esc(v._companyId||'?')}</span></td>
            <td style="font-size:11px">${esc(v.ocEnd||'—')}</td>
          </tr>`).join('')}
          ${newVehs.length>30?`<tr><td colspan="6" style="color:var(--text3);text-align:center">... i ${newVehs.length-30} kolejnych</td></tr>`:''}</tbody>
        </table></div>` : ''}

        ${updVehs.length ? `
        <div style="font-size:12px;font-weight:600;margin-bottom:8px"><i class="ti ti-refresh" style="color:var(--amber)"></i> Aktualizacje (${updVehs.length} istniejących pojazdów)</div>
        <div class="tbl-wrap" style="margin-bottom:12px;max-height:150px;overflow-y:auto"><table>
          <thead><tr><th>Nr rej.</th><th>Marka/Model</th><th>Firma</th><th>Status w ZSIA</th></tr></thead>
          <tbody>${updVehs.slice(0,20).map(v => `<tr>
            <td><strong style="font-family:var(--mono)">${esc(v.nrRej)}</strong></td>
            <td>${esc(v.marka)} ${esc(v.model)}</td>
            <td><span class="pill pill-blue" style="font-size:10px">${esc(v._companyId||'?')}</span></td>
            <td><span class="pill ${v.status==='AKTYWNY'?'pill-green':'pill-gray'}" style="font-size:10px">${esc(v.status)}</span></td>
          </tr>`).join('')}</tbody>
        </table></div>` : ''}

        <div style="background:var(--amber-light);border:1px solid var(--amber);border-radius:var(--radius);padding:10px 14px;font-size:12px;margin-bottom:14px">
          <i class="ti ti-alert-triangle" style="color:var(--amber)"></i>
          <strong>Aktualizacje nie nadpisują danych z TaxOrder Pro</strong> — zachowujesz historię serwisów, paliwa i dokumenty.
          Importowane są tylko pola podstawowe z ZSIA (nr rej, daty OC/AC/przeglądu, przebieg).
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-blue" onclick="ZsiaImporter._executeImport(${JSON.stringify(vehicles).replace(/</g,'\\u003c')}, ${JSON.stringify(drivers).replace(/</g,'\\u003c')}, this)">
            <i class="ti ti-database-import"></i>Importuj ${vehicles.length} pojazdów${drivers.length?` i ${drivers.length} kierowców`:''}
          </button>
          <button class="btn btn-gray" onclick="this.closest('div[style]').remove()">
            <i class="ti ti-x"></i>Anuluj
          </button>
        </div>
      </div>`;

    // Wstaw podgląd po bannerze ZSIA
    const banner = document.querySelector('#page-impexp > div[style*="linear-gradient"]');
    if (banner) {
      const existing = document.getElementById('zsia-preview');
      if (existing) existing.remove();
      const div = document.createElement('div');
      div.id = 'zsia-preview';
      div.innerHTML = html;
      banner.insertAdjacentElement('afterend', div);
    }
  }

  function _chip(icon, val, label, color) {
    const colors = { blue:'var(--blue)', green:'var(--green)', amber:'var(--amber)', gray:'var(--text2)' };
    return `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px;text-align:center">
      <div style="font-size:20px;font-weight:700;color:${colors[color]||'var(--text)'}">${val}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:2px">${label}</div>
    </div>`;
  }

  // ──────────────────────────────────────────────────────────────
  // Wykonaj import
  // ──────────────────────────────────────────────────────────────
  async function _executeImport(vehicles, drivers, btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader" style="animation:spin .8s linear infinite"></i> Importuję...';

    let addedV = 0, updatedV = 0, addedD = 0;
    const errors = [];

    // Import pojazdów przez istniejący mechanizm (bulk upsert do D1)
    try {
      const company = typeof currentCompanyId !== 'undefined' ? currentCompanyId : 'mtoilet';
      const token   = localStorage.getItem('cf_token');
      const url     = `${window.CF_API_URL}/api/vehicles/bulk`;

      // Grupuj po company_id
      const byCompany = {};
      vehicles.forEach(v => {
        const c = v._companyId || company;
        if (!byCompany[c]) byCompany[c] = [];
        const { _zsiaSource, _companyId, ...vClean } = v;
        byCompany[c].push(vClean);
      });

      for (const [cId, vList] of Object.entries(byCompany)) {
        const r = await fetch(`${url}?company=${cId}`, {
          method: 'POST',
          headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
          body: JSON.stringify({ vehicles: vList })
        });
        const j = await r.json();
        if (j.ok) {
          addedV   += j.inserted || 0;
          updatedV += j.updated  || 0;
        } else {
          errors.push(`Firma ${cId}: ${j.error || 'błąd API'}`);
        }
      }
    } catch (e) {
      errors.push(`Błąd API: ${e.message}`);
    }

    // Import kierowców (jeśli są)
    if (drivers.length && window.TaxOrderDrivers?.importBulk) {
      try {
        addedD = await window.TaxOrderDrivers.importBulk(drivers);
      } catch (e) {
        errors.push(`Kierowcy: ${e.message}`);
      }
    }

    // Odśwież widok
    if (typeof refreshAll === 'function') refreshAll();

    // Pokaż wynik
    const preview = document.getElementById('zsia-preview');
    if (preview) {
      preview.innerHTML = `
        <div style="background:${errors.length?'var(--amber-light)':'var(--green-light)'};border:1px solid ${errors.length?'var(--amber)':'var(--green)'};border-radius:var(--radius-lg);padding:16px 20px;margin-top:1rem">
          <div style="font-size:14px;font-weight:700;margin-bottom:8px;color:${errors.length?'var(--amber)':'var(--green)'}">
            <i class="ti ti-${errors.length?'alert-triangle':'circle-check'}"></i>
            Import ZSIA ${errors.length?'zakończony z ostrzeżeniami':'zakończony pomyślnie'}
          </div>
          <div style="font-size:12px;line-height:1.8">
            ${addedV   ? `<div><i class="ti ti-plus" style="color:var(--green)"></i> Dodano nowych pojazdów: <strong>${addedV}</strong></div>`:''}
            ${updatedV ? `<div><i class="ti ti-refresh" style="color:var(--amber)"></i> Zaktualizowano pojazdów: <strong>${updatedV}</strong></div>`:''}
            ${addedD   ? `<div><i class="ti ti-id-badge" style="color:var(--blue)"></i> Zaimportowano kierowców: <strong>${addedD}</strong></div>`:''}
            ${errors.map(e=>`<div style="color:var(--red)"><i class="ti ti-x"></i> ${e}</div>`).join('')}
          </div>
        </div>`;
    }

    _showResult(errors.length ? 'warn' : 'ok',
      `Import ZSIA: +${addedV} nowych, ~${updatedV} zaktualizowanych${addedD?`, ${addedD} kierowców`:''}.`);
  }

  function _showResult(type, msg) {
    const icons = { ok:'circle-check', warn:'alert-triangle', error:'alert-circle' };
    const colors= { ok:'var(--green)', warn:'var(--amber)', error:'var(--red)' };
    if (typeof showToast === 'function') showToast(msg);
    console.log(`[ZsiaImporter] ${type}: ${msg}`);
  }

  // ──────────────────────────────────────────────────────────────
  // Pobierz skrypt PS1
  // ──────────────────────────────────────────────────────────────
  function downloadScript() {
    fetch('tools/zsia-sync.ps1')
      .then(r => r.text())
      .then(text => {
        const blob = new Blob([text], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'zsia-sync.ps1';
        a.click();
      })
      .catch(() => showToast('Nie można pobrać skryptu — sprawdź czy plik istnieje w tools/'));
  }

  return { handleFile, downloadScript, _executeImport };
})();
