/**
 * Moduł Dokumenty — zarządzanie ważnymi dokumentami
 * OC, badania techniczne, DPF, itp.
 */

const DOCUMENT_TYPES = {
  OC: { label: 'Ubezpieczenie OC', icon: 'shield', color: 'blue' },
  TECH_INSPECTION: { label: 'Badania techniczne', icon: 'certificate', color: 'green' },
  DPF: { label: 'Certyfikat DPF', icon: 'file-check', color: 'amber' },
  REGISTRATION: { label: 'Dowód rejestracyjny', icon: 'card-id', color: 'blue' },
  DT1: { label: 'Deklaracja DT-1', icon: 'file', color: 'blue' }
};

function renderDocumentsModule() {
  const stats = getDocumentsStats();
  
  return `
    <div class="page" id="page-documents-module">
      <div class="pg-title"><i class="ti ti-file-text"></i>Dokumenty pojazdów</div>
      <div class="pg-sub">Monitoruj terminy ważności ubezpieczenia, badań technicznych i innych dokumentów</div>
      
      <!-- Karty alertów -->
      <div class="docs-alerts-grid">
        <div class="alert-card urgent">
          <div class="alert-number" style="color: var(--red)">${stats.expired.length}</div>
          <div class="alert-label">Wygasłe</div>
        </div>
        <div class="alert-card warning">
          <div class="alert-number" style="color: var(--amber)">${stats.expiringSoon.length}</div>
          <div class="alert-label">Wkrótce wygasną</div>
        </div>
        <div class="alert-card">
          <div class="alert-number" style="color: var(--green)">${stats.active.length}</div>
          <div class="alert-label">Ważne</div>
        </div>
      </div>

      <div class="toolbar">
        <input id="d-search" placeholder="🔍 Szukaj nr rej. lub dokumentu..." oninput="filterDocuments()">
        <select id="d-type-filter" onchange="filterDocuments()">
          <option value="">Wszystkie typy</option>
          ${Object.entries(DOCUMENT_TYPES).map(([key, val]) => 
            `<option value="${key}">${val.label}</option>`
          ).join('')}
        </select>
        <button class="btn btn-blue" onclick="addDocumentModal()"><i class="ti ti-plus"></i>Dodaj dokument</button>
      </div>

      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Pojazd</th>
              <th>Typ dokumentu</th>
              <th>Nr dokumentu</th>
              <th>Wydany</th>
              <th>Ważny do</th>
              <th>Status</th>
              <th style="text-align: right">Akcje</th>
            </tr>
          </thead>
          <tbody id="documents-tbody"></tbody>
        </table>
      </div>
    </div>
  `;
}

function getDocumentsStats() {
  const docs = FleetManager.DB.documents || [];
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 dni

  return {
    expired: docs.filter(d => new Date(d.expiryDate) < now),
    expiringSoon: docs.filter(d => {
      const expiry = new Date(d.expiryDate);
      return expiry >= now && expiry <= soon;
    }),
    active: docs.filter(d => new Date(d.expiryDate) > soon)
  };
}

function filterDocuments() {
  const search = (document.getElementById('d-search') || {}).value || '';
  const typeFilter = (document.getElementById('d-type-filter') || {}).value || '';

  // Implementacja filtrowania
  console.log('Filtrowanie dokumentów:', { search, typeFilter });
}

function addDocumentModal() {
  console.log('Otwarcie modalu dodawania dokumentu');
}

// ==================== EKSPORT ====================

window.DocumentsModule = {
  DOCUMENT_TYPES,
  renderDocumentsModule,
  getDocumentsStats,
  filterDocuments
};
