(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';

  let _policy = {};

  async function renderFleetPolicies() {
    const co = Co();
    try {
      const r = await fetch(`${API()}/api/fleet-policies?company=${encodeURIComponent(co)}`, { headers: H() });
      if (r.ok) _policy = await r.json();
    } catch {}

    const el = document.getElementById('page-fleet-policies');
    if (!el) return;
    const p = _policy;
    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-settings-2"></i> Polityki flotowe</h2>
  <button class="btn-primary" onclick="window.FleetPoliciesModule.save()"><i class="ti ti-device-floppy"></i> Zapisz</button>
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:20px">

  <div class="card" style="padding:20px">
    <h3 style="margin:0 0 16px;font-size:15px"><i class="ti ti-checks"></i> Progi zatwierdzania</h3>
    <p style="font-size:12px;color:var(--text-muted);margin:0 0 12px">Koszty powyżej tych kwot trafią automatycznie do kolejki zatwierdzeń managera.</p>
    <div class="form-group"><label class="form-label">Zlecenia serwisowe (PLN)</label>
      <input type="number" id="fp-svc" class="form-input" value="${p.service_approval_threshold??2000}">
    </div>
    <div class="form-group"><label class="form-label">Szkody (PLN)</label>
      <input type="number" id="fp-dmg" class="form-input" value="${p.damage_approval_threshold??500}">
    </div>
    <div class="form-group"><label class="form-label">Rozliczenia km (PLN)</label>
      <input type="number" id="fp-mil" class="form-input" value="${p.mileage_approval_threshold??1000}">
    </div>
  </div>

  <div class="card" style="padding:20px">
    <h3 style="margin:0 0 16px;font-size:15px"><i class="ti ti-droplet"></i> Normy paliwa</h3>
    <p style="font-size:12px;color:var(--text-muted);margin:0 0 12px">Przekroczenie normy oznaczy tankowanie w raporcie wydajności.</p>
    <div class="form-group"><label class="form-label">Diesel — norma (l/100km)</label>
      <input type="number" step="0.1" id="fp-diesel" class="form-input" value="${p.fuel_norm_diesel??8.0}">
    </div>
    <div class="form-group"><label class="form-label">Benzyna — norma (l/100km)</label>
      <input type="number" step="0.1" id="fp-petrol" class="form-input" value="${p.fuel_norm_petrol??9.0}">
    </div>
    <div class="form-group"><label class="form-label">Maks. km prywatnych / miesiąc</label>
      <input type="number" id="fp-private-km" class="form-input" value="${p.max_private_km??0}">
    </div>
  </div>

  <div class="card" style="padding:20px">
    <h3 style="margin:0 0 16px;font-size:15px"><i class="ti ti-calendar-event"></i> Rezerwacje & Alerty</h3>
    <div class="form-group" style="display:flex;align-items:center;gap:10px">
      <input type="checkbox" id="fp-res-approval" ${p.reservation_requires_approval?'checked':''}>
      <label for="fp-res-approval" style="font-size:14px">Rezerwacje wymagają zatwierdzenia managera</label>
    </div>
    <div class="form-group" style="margin-top:16px"><label class="form-label">Alert ważności prawa jazdy (dni przed wygaśnięciem)</label>
      <input type="number" id="fp-lic-days" class="form-input" value="${p.license_alert_days??30}">
    </div>
    <div class="form-group"><label class="form-label">Alert badań lekarskich (dni przed wygaśnięciem)</label>
      <input type="number" id="fp-med-days" class="form-input" value="${p.medical_alert_days??30}">
    </div>
  </div>

</div>`;
  }

  async function save() {
    const gi = id => document.getElementById(id);
    const body = {
      service_approval_threshold:  parseFloat(gi('fp-svc')?.value)   || 2000,
      damage_approval_threshold:   parseFloat(gi('fp-dmg')?.value)   || 500,
      mileage_approval_threshold:  parseFloat(gi('fp-mil')?.value)   || 1000,
      fuel_norm_diesel:            parseFloat(gi('fp-diesel')?.value) || 8.0,
      fuel_norm_petrol:            parseFloat(gi('fp-petrol')?.value) || 9.0,
      max_private_km:              parseInt(gi('fp-private-km')?.value) || 0,
      reservation_requires_approval: gi('fp-res-approval')?.checked ? 1 : 0,
      license_alert_days:          parseInt(gi('fp-lic-days')?.value) || 30,
      medical_alert_days:          parseInt(gi('fp-med-days')?.value) || 30,
    };
    try {
      const r = await fetch(`${API()}/api/fleet-policies?company=${encodeURIComponent(Co())}`, {
        method:'PUT', headers:{...H(),'Content-Type':'application/json'}, body:JSON.stringify(body)
      });
      if (!r.ok) throw new Error(await r.text());
      if (typeof window.showToast === 'function') window.showToast('Polityki zapisane');
      else alert('Polityki zapisane');
    } catch(ex) { alert('Błąd: '+ex.message); }
  }

  window.FleetPoliciesModule = { renderFleetPolicies, save };
})();
