/**
 * Moduł Pojazdy — zarządzanie flotą
 * Integracja z istniejącym kodem TaxOrder Pro
 */

function renderVehiclesModule() {
  return `
    <div class="page" id="page-vehicles-module">
      <div class="pg-title"><i class="ti ti-truck"></i>Zarządzanie flotą pojazdów</div>
      <div class="pg-sub">Dodawaj, edytuj i zarządzaj pojazdem w systemie Fleet Manager</div>
      
      <div class="toolbar">
        <input id="v-search" placeholder="🔍 Szukaj nr rej., marki, VIN..." oninput="filterVehicles()">
        <select id="v-type-filter" onchange="filterVehicles()">
          <option value="">Wszystkie typy</option>
          <option value="Ciężarowy">Ciężarowy</option>
          <option value="Przyczepa">Przyczepa</option>
          <option value="Naczepa">Naczepa</option>
          <option value="Ciągnik siodłowy">Ciągnik siodłowy</option>
          <option value="Autobus">Autobus</option>
        </select>
        <select id="v-status-filter" onchange="filterVehicles()">
          <option value="">Wszystkie statusy</option>
          <option value="Własny">Własny</option>
          <option value="Leasing">Leasing</option>
          <option value="Wynajęty">Wynajęty</option>
        </select>
        <button class="btn btn-blue" onclick="openVehicleForm(null)"><i class="ti ti-plus"></i>Dodaj pojazd</button>
        <button class="btn btn-gray" onclick="exportVehicles()"><i class="ti ti-download"></i>Eksport</button>
      </div>

      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Nr rej.</th>
              <th>Marka / Model</th>
              <th>Rok</th>
              <th>Typ</th>
              <th>DMC</th>
              <th>VIN</th>
              <th>EURO</th>
              <th>Status</th>
              <th>Dokumenty</th>
              <th style="text-align: right">Akcje</th>
            </tr>
          </thead>
          <tbody id="vehicles-tbody"></tbody>
        </table>
      </div>
    </div>
  `;
}

function filterVehicles() {
  const search = (document.getElementById('v-search') || {}).value || '';
  const typeFilter = (document.getElementById('v-type-filter') || {}).value || '';
  const statusFilter = (document.getElementById('v-status-filter') || {}).value || '';

  const filtered = vehs.filter(v => {
    const matchSearch = !search || 
      v.nrRej.toLowerCase().includes(search.toLowerCase()) ||
      (v.marka + ' ' + v.model).toLowerCase().includes(search.toLowerCase()) ||
      (v.vin || '').toLowerCase().includes(search.toLowerCase());
    
    const matchType = !typeFilter || v.typ === typeFilter;
    const matchStatus = !statusFilter || v.status === statusFilter;

    return matchSearch && matchType && matchStatus;
  });

  renderVehiclesTable(filtered);
}

function renderVehiclesTable(vehicles) {
  const tbody = document.getElementById('vehicles-tbody');
  if (!tbody) return;

  tbody.innerHTML = vehicles.map(v => {
    const tax = calcTax(v);
    const isMissingData = !v.vin || !v.dmc || !v.euro;
    
    return `
      <tr class="${isMissingData ? 'row-warning' : ''}">
        <td><strong>${v.nrRej}</strong></td>
        <td>${v.marka} ${v.model}</td>
        <td>${v.rok}</td>
        <td>
          <span class="pill pill-blue">${v.typ}</span>
        </td>
        <td>${v.dmc || '—'}</td>
        <td>${v.vin ? v.vin.slice(-4).toUpperCase() : '<span style="color: var(--red)">BRAK</span>'}</td>
        <td>${v.euro || '<span style="color: var(--red)">BRAK</span>'}</td>
        <td>
          <span class="pill ${v.status === 'Leasing' ? 'pill-amber' : 'pill-green'}">${v.status}</span>
        </td>
        <td>
          <button class="btn btn-sm" onclick="showVehicleDocuments('${v.id}')">
            <i class="ti ti-file-text"></i>${v.documents ? v.documents.length : 0}
          </button>
        </td>
        <td style="text-align: right">
          <button class="btn btn-sm" onclick="editVehicle('${v.id}')"><i class="ti ti-edit"></i></button>
          <button class="btn btn-sm" onclick="deleteVehicle('${v.id}')"><i class="ti ti-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

function openVehicleForm(vehicleId) {
  const v = vehicleId ? vehs.find(x => x.id === vehicleId) : {};
  
  const modal = `
    <div class="modal-bg" id="vehicle-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>${vehicleId ? 'Edytuj pojazd' : 'Nowy pojazd'}</h3>
          <button onclick="closeModal('vehicle-modal')" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <form id="vehicle-form">
            <div class="form-group">
              <label>Nr rejestracyjny *</label>
              <input type="text" name="nrRej" value="${v.nrRej || ''}" required>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Marka *</label>
                <input type="text" name="marka" value="${v.marka || ''}" required>
              </div>
              <div class="form-group">
                <label>Model *</label>
                <input type="text" name="model" value="${v.model || ''}" required>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Rok produkcji</label>
                <input type="number" name="rok" value="${v.rok || new Date().getFullYear()}" min="1990" max="2099">
              </div>
              <div class="form-group">
                <label>VIN</label>
                <input type="text" name="vin" value="${v.vin || ''}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>DMC (kg) *</label>
                <input type="number" name="dmc" value="${v.dmc || ''}" required>
              </div>
              <div class="form-group">
                <label>Norma EURO</label>
                <input type="text" name="euro" value="${v.euro || ''}" placeholder="np. EURO 6">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Typ pojazdu</label>
                <select name="typ">
                  <option value="${v.typ || 'Ciężarowy'}">${v.typ || 'Ciężarowy'}</option>
                  <option>Ciężarowy</option>
                  <option>Przyczepa</option>
                  <option>Naczepa</option>
                  <option>Ciągnik siodłowy</option>
                  <option>Autobus</option>
                </select>
              </div>
              <div class="form-group">
                <label>Status</label>
                <select name="status">
                  <option value="${v.status || 'Własny'}">${v.status || 'Własny'}</option>
                  <option>Własny</option>
                  <option>Leasing</option>
                  <option>Wynajęty</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Data nabycia</label>
              <input type="date" name="dataNabycia" value="${v.dataNabycia || ''}">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-gray" onclick="closeModal('vehicle-modal')">Anuluj</button>
          <button class="btn btn-blue" onclick="saveVehicle()">Zapisz pojazd</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modal);
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.remove();
}

function saveVehicle() {
  const form = document.getElementById('vehicle-form');
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);
  
  console.log('Zapisuję pojazd:', data);
  closeModal('vehicle-modal');
  filterVehicles();
}

function editVehicle(vehicleId) {
  openVehicleForm(vehicleId);
}

function deleteVehicle(vehicleId) {
  if (confirm('Czy na pewno chcesz usunąć pojazd?')) {
    const idx = vehs.findIndex(v => v.id === vehicleId);
    if (idx >= 0) vehs.splice(idx, 1);
    filterVehicles();
  }
}

function exportVehicles() {
  console.log('Eksportowanie pojazdów...');
}

// ==================== EKSPORT ====================

window.VehiclesModule = {
  renderVehiclesModule,
  filterVehicles,
  openVehicleForm
};
