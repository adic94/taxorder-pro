// ==================== BACKUP / RESTORE ====================
// Eksport i import pełnych danych floty (pojazdy + historia + mandaty + dokumenty + kierowcy + budżet)

window.FleetBackup = (function () {

  const BACKUP_VERSION = 2;

  // Wszystkie klucze localStorage które backupujemy
  const LS_KEYS = [
    'taxFines', 'taxDrivers', 'taxFleetBudget', 'taxColVis',
    'dt1_users', 'dt1_karty', 'dt1_company_states', 'dt1_current_company',
    'dt1_cepik_proxy', 'dt1_cepik_settings',
    'taxDocuments',
  ];

  function exportBackup() {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);

    // localStorage
    const lsData = {};
    LS_KEYS.forEach(key => {
      const val = localStorage.getItem(key);
      if (val !== null) lsData[key] = val;
    });

    // Pojazdy z pełną historią (z window.vehs — po załadowaniu z Supabase mogą być bogatsze)
    const vehicles = (window.vehs || []).map(v => ({ ...v }));

    const backup = {
      _version:   BACKUP_VERSION,
      _exportedAt: now.toISOString(),
      _app:       'TaxOrder Pro',
      _company:   window.currentCompanyId || 'unknown',
      _vehicleCount: vehicles.length,
      vehicles,
      localStorage: lsData,
    };

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `taxorder_backup_${dateStr}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`✓ Backup zapisany — ${vehicles.length} pojazdów, ${Object.keys(lsData).length} zbiorów danych`);
  }

  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      let backup;
      try {
        backup = JSON.parse(e.target.result);
      } catch {
        toast('❌ Nieprawidłowy plik backup — oczekiwany format JSON');
        return;
      }
      if (!backup._app || !backup.vehicles) {
        toast('❌ Plik nie jest kopią zapasową TaxOrder Pro');
        return;
      }

      const vCount = backup.vehicles?.length || 0;
      const lsCount = Object.keys(backup.localStorage || {}).length;

      if (!confirm(`Importujesz backup z ${backup._exportedAt?.slice(0,10) || '?'}.\n\nZawiera: ${vCount} pojazdów, ${lsCount} zbiorów danych.\n\nTO NADPISZE aktualne dane. Kontynuować?`)) return;

      // Przywróć localStorage
      const ls = backup.localStorage || {};
      Object.entries(ls).forEach(([key, val]) => {
        try { localStorage.setItem(key, val); } catch(e) {}
      });

      // Przywróć pojazdy
      if (backup.vehicles?.length && typeof window.setTaxOrderVehicles === 'function') {
        window.setTaxOrderVehicles(backup.vehicles);
      }

      // Odśwież UI
      if (typeof renderVeh === 'function') renderVeh();
      if (typeof renderDash === 'function') renderDash();
      if (typeof updateCounters === 'function') updateCounters();

      toast(`✅ Backup przywrócony — ${vCount} pojazdów załadowanych`);
      _closeModal();
    };
    reader.readAsText(file, 'utf-8');
  }

  function openModal() {
    let modal = document.getElementById('backup-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'backup-modal';
      modal.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;align-items:center;justify-content:center';
      modal.innerHTML = `
        <div style="background:var(--bg);border-radius:var(--radius-lg);padding:28px;width:480px;max-width:95vw;box-shadow:0 8px 48px rgba(0,0,0,.4)">
          <div style="font-size:17px;font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:8px">
            <i class="ti ti-database-export" style="color:var(--blue)"></i>Backup i przywracanie danych
          </div>
          <div style="font-size:12px;color:var(--text2);margin-bottom:20px">
            Eksportuj pełne dane floty do pliku JSON lub przywróć z wcześniejszej kopii.
          </div>

          <div style="background:var(--bg2);border-radius:var(--radius);padding:16px;margin-bottom:14px">
            <div style="font-size:13px;font-weight:600;margin-bottom:8px"><i class="ti ti-download"></i> Eksport kopii zapasowej</div>
            <div style="font-size:11px;color:var(--text2);margin-bottom:10px">
              Zapisuje: ${(window.vehs||[]).length} pojazdów z pełną historią + mandaty + serwis + dokumenty + kierowcy + budżet + ustawienia
            </div>
            <button class="btn btn-green" onclick="FleetBackup.exportBackup()" style="width:100%;justify-content:center">
              <i class="ti ti-database-export"></i>Pobierz backup (.json)
            </button>
          </div>

          <div style="background:var(--bg2);border-radius:var(--radius);padding:16px;margin-bottom:20px">
            <div style="font-size:13px;font-weight:600;margin-bottom:8px"><i class="ti ti-upload"></i> Import kopii zapasowej</div>
            <div style="font-size:11px;color:var(--red);margin-bottom:10px">
              ⚠ Nadpisuje aktualne dane — zalecane tylko przy migracji lub odtwarzaniu po awarii
            </div>
            <input type="file" accept=".json" id="backup-file-input" style="display:none" onchange="FleetBackup.importBackup(this.files[0])">
            <button class="btn btn-amber" onclick="document.getElementById('backup-file-input').click()" style="width:100%;justify-content:center">
              <i class="ti ti-database-import"></i>Wybierz plik backup (.json)
            </button>
          </div>

          <button class="btn btn-gray" onclick="FleetBackup._closeModal()" style="width:100%;justify-content:center">Zamknij</button>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', e => { if (e.target === modal) _closeModal(); });
    } else {
      modal.style.display = 'flex';
      // Aktualizuj licznik pojazdów
      modal.querySelector('.btn-green').previousElementSibling.textContent =
        `Zapisuje: ${(window.vehs||[]).length} pojazdów z pełną historią + mandaty + serwis + dokumenty + kierowcy + budżet + ustawienia`;
    }
  }

  function _closeModal() {
    const m = document.getElementById('backup-modal');
    if (m) m.style.display = 'none';
  }

  return { exportBackup, importBackup, openModal, _closeModal };
})();
