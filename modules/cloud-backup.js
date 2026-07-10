/**
 * TaxOrder Pro — Cloud Backup / Restore
 * Pobiera wszystkie dane firmy z Cloudflare D1 (GET /api/export) lub
 * przywraca je z pliku JSON (POST /api/import).
 */
window.CloudBackup = (function () {
  const _api  = () => window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const _tok  = () => localStorage.getItem('cf_token');
  const _co   = () => window.currentCompanyId || 'mtoilet';
  const _hdrs = (extra) => ({ ...(_tok() ? { Authorization: 'Bearer ' + _tok() } : {}), ...(extra || {}) });
  const _set  = (html) => { const el = document.getElementById('cloud-backup-result'); if (el) el.innerHTML = html; };

  async function download() {
    _set('<span style="color:var(--text3)"><i class="ti ti-loader ti-spin"></i> Pobieranie danych z chmury...</span>');
    try {
      const r = await fetch(_api() + '/api/export?company=' + _co(), { headers: _hdrs() });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        _set('<div style="color:var(--red)"><i class="ti ti-alert-triangle"></i> Błąd ' + r.status + ': ' + esc(d.error || r.statusText || '') + '</div>');
        return;
      }
      const data = await r.json();
      const vehCount = (data.vehicles || []).length;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'backup_' + _co() + '_' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
      _set('<div style="color:var(--green)"><i class="ti ti-circle-check"></i> Pobrano backup: ' + vehCount + ' pojazdów + historia, szkody, opony, zlecenia…</div>');
      window.toast?.('✓ Backup pobrany (' + vehCount + ' pojazdów)');
    } catch (e) {
      _set('<div style="color:var(--red)">Błąd sieci: ' + esc(e.message) + '</div>');
    }
  }

  async function restore(input) {
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    _set('<span style="color:var(--text3)"><i class="ti ti-loader ti-spin"></i> Wczytywanie pliku…</span>');

    let data;
    try { data = JSON.parse(await file.text()); } catch {
      _set('<div style="color:var(--red)"><i class="ti ti-alert-triangle"></i> Nieprawidłowy plik JSON</div>');
      return;
    }

    const vehCount = (data.vehicles || []).length;
    if (!vehCount && !data.exportedAt) {
      _set('<div style="color:var(--red)">Plik nie wygląda jak backup TaxOrder Pro &mdash; brak pola <code>vehicles</code> lub <code>exportedAt</code>.</div>');
      return;
    }

    const exportDate = data.exportedAt ? new Date(data.exportedAt).toLocaleString('pl-PL') : 'nieznana data';
    if (!confirm('Przywrócić backup z ' + exportDate + '?\n\nBackup zawiera ' + vehCount + ' pojazdów. Istniejące rekordy zostaną zaktualizowane (upsert), nic nie zostanie usunięte.')) {
      _set('');
      return;
    }

    _set('<span style="color:var(--text3)"><i class="ti ti-loader ti-spin"></i> Importowanie danych…</span>');
    try {
      const r = await fetch(_api() + '/api/import?company=' + _co(), {
        method: 'POST',
        headers: _hdrs({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(data),
      });
      const d = await r.json();
      if (d.ok) {
        const counts = Object.entries(d.counts || {}).map(([k, n]) => k + ': ' + n).join(', ');
        _set('<div style="color:var(--green)"><i class="ti ti-circle-check"></i> Import zakończony &mdash; ' + counts + '</div>');
        window.toast?.('✓ Backup przywrócony &mdash; odśwież stronę aby zobaczyć zmiany');
      } else {
        _set('<div style="color:var(--red)"><i class="ti ti-alert-triangle"></i> ' + esc(d.error || 'Błąd importu') + '</div>');
      }
    } catch (e) {
      _set('<div style="color:var(--red)">Błąd sieci: ' + esc(e.message) + '</div>');
    }
  }

  return { download, restore };
})();
