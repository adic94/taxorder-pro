// ==================== BACKUP / RESTORE ====================
// Eksport i import pełnych danych floty (pojazdy + historia + mandaty + dokumenty + kierowcy + budżet)

window.FleetBackup = (function () {

  const BACKUP_VERSION = 2;

  const LS_KEYS = [
    'taxFines', 'taxDrivers', 'taxFleetBudget', 'taxColVis',
    'dt1_users', 'dt1_karty', 'dt1_company_states', 'dt1_current_company',
    'dt1_cepik_proxy', 'dt1_cepik_settings',
    'taxDocuments',
  ];

  function exportBackup() {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);

    const lsData = {};
    LS_KEYS.forEach(key => {
      const val = localStorage.getItem(key);
      if (val !== null) lsData[key] = val;
    });

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
    toast(`${t('backup.toast.saved')} — ${vehicles.length} ${t('backup.vehicles')}, ${Object.keys(lsData).length} ${t('backup.datasets')}`);
  }

  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      let backup;
      try {
        backup = JSON.parse(e.target.result);
      } catch {
        toast(t('backup.err.json'));
        return;
      }
      if (!backup._app || !backup.vehicles) {
        toast(t('backup.err.app'));
        return;
      }

      const vCount  = backup.vehicles?.length || 0;
      const lsCount = Object.keys(backup.localStorage || {}).length;
      const date    = backup._exportedAt?.slice(0, 10) || '?';

      const msg = `${t('backup.confirm.from')} ${date}.\n\n${t('backup.confirm.contains')} ${vCount} ${t('backup.vehicles')}, ${lsCount} ${t('backup.datasets')}.\n\n${t('backup.confirm.overwrite')}`;
      if (!confirm(msg)) return;

      const ls = backup.localStorage || {};
      Object.entries(ls).forEach(([key, val]) => {
        try { localStorage.setItem(key, val); } catch(e) {}
      });

      if (backup.vehicles?.length && typeof window.setTaxOrderVehicles === 'function') {
        window.setTaxOrderVehicles(backup.vehicles);
      }

      if (typeof renderVeh === 'function') renderVeh();
      if (typeof renderDash === 'function') renderDash();
      if (typeof updateCounters === 'function') updateCounters();

      toast(`${t('backup.toast.restored')} — ${vCount} ${t('backup.toast.loaded')}`);
      _closeModal();
    };
    reader.readAsText(file, 'utf-8');
  }

  function openModal() {
    // Always rebuild so language changes take effect
    const existing = document.getElementById('backup-modal');
    if (existing) existing.remove();

    const vCount = (window.vehs || []).length;
    const modal  = document.createElement('div');
    modal.id = 'backup-modal';
    modal.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;align-items:center;justify-content:center';
    modal.innerHTML = `
      <div style="background:var(--bg);border-radius:var(--radius-lg);padding:28px;width:480px;max-width:95vw;box-shadow:0 8px 48px rgba(0,0,0,.4)">
        <div style="font-size:17px;font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:8px">
          <i class="ti ti-database-export" style="color:var(--blue)"></i>${t('backup.title')}
        </div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:20px">
          ${t('backup.sub')}
        </div>

        <div style="background:var(--bg2);border-radius:var(--radius);padding:16px;margin-bottom:14px">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px"><i class="ti ti-download"></i> ${t('backup.export.h')}</div>
          <div style="font-size:11px;color:var(--text2);margin-bottom:10px">
            Zapisuje: ${vCount} ${t('backup.export.desc')}
          </div>
          <button class="btn btn-green" onclick="FleetBackup.exportBackup()" style="width:100%;justify-content:center">
            <i class="ti ti-database-export"></i>${t('backup.export.btn')}
          </button>
        </div>

        <div style="background:var(--bg2);border-radius:var(--radius);padding:16px;margin-bottom:20px">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px"><i class="ti ti-upload"></i> ${t('backup.import.h')}</div>
          <div style="font-size:11px;color:var(--red);margin-bottom:10px">
            ${t('backup.import.warn')}
          </div>
          <input type="file" accept=".json" id="backup-file-input" style="display:none" onchange="FleetBackup.importBackup(this.files[0])">
          <button class="btn btn-amber" onclick="document.getElementById('backup-file-input').click()" style="width:100%;justify-content:center">
            <i class="ti ti-database-import"></i>${t('backup.import.btn')}
          </button>
        </div>

        <button class="btn btn-gray" onclick="FleetBackup._closeModal()" style="width:100%;justify-content:center">${t('btn.close')}</button>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) _closeModal(); });
  }

  function _closeModal() {
    const m = document.getElementById('backup-modal');
    if (m) m.style.display = 'none';
  }

  return { exportBackup, importBackup, openModal, _closeModal };
})();
