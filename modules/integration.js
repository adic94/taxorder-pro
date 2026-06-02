/**
 * Integracja Fleet Manager z TaxOrder Pro
 * Mostek między dwoma systemami
 */

// ==================== INICJALIZACJA ====================

function initializeFleetManager() {
  console.log('🚀 Inicjalizacja Fleet Manager...');
  
  // 1. Załaduj dane z localStorage
  DataSchema.initializeDatabase();
  
  // 2. Załaduj alerty
  const alerts = FleetManager.generateTodayAlerts();
  console.log(`📋 ${alerts.length} alertów do wyświetlenia`);
  
  // 3. Renderuj Dashboard
  renderFleetManagerDashboard();
  
  console.log('✓ Fleet Manager gotowy');
}

// ==================== POKAZYWANIE STRON ====================

const originalShowPage = window.showPage;

window.showPage = function(pageId) {
  // Jeśli to strona Fleet Manager, renderuj dynamicznie
  if (pageId.startsWith('fm-')) {
    handleFleetManagerPage(pageId);
    return;
  }
  
  // W przeciwnym razie użyj oryginalnej funkcji
  if (originalShowPage) {
    originalShowPage(pageId);
  }
};

function handleFleetManagerPage(pageId) {
  // Ukryj wszystkie strony
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  // Zmień aktywny guzik nawigacji
  document.querySelectorAll('.topnav .tnb').forEach(b => b.classList.remove('active'));
  const btnId = 'tnb-' + pageId.replace('page-', '');
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('active');
  
  // Pokaż wybraną stronę
  const page = document.getElementById('page-' + pageId.replace('fm-', 'fm-'));
  if (page) {
    page.classList.add('active');
    
    // Renderuj treść
    switch(pageId) {
      case 'fm-dashboard':
        renderFleetManagerDashboard();
        break;
      case 'fm-vehicles':
        renderFleetManagerVehicles();
        break;
      case 'fm-drivers':
        renderFleetManagerDrivers();
        break;
      case 'fm-documents':
        renderFleetManagerDocuments();
        break;
      case 'fm-costs':
        renderFleetManagerCosts();
        break;
    }
  }
}

// ==================== RENDEROWANIE FLEET MANAGER DASHBOARD ====================

function renderFleetManagerDashboard() {
  const page = document.getElementById('page-fm-dashboard');
  if (!page) return;
  
  const stats = FleetManager.generateFleetStats();
  const alerts = FleetManager.generateTodayAlerts();
  
  page.innerHTML = `
    <div class="pg-title"><i class="ti ti-truck"></i>TaxOrder Fleet Manager</div>
    <div class="pg-sub">System wsparcia dla pracownika floty, księgowości i administracji</div>
    
    <!-- KPI Karty -->
    <div class="fleet-stats-grid">
      <div class="fleet-stat-card" onclick="showPage('fm-vehicles')">
        <div class="stat-icon"><i class="ti ti-truck"></i></div>
        <div class="stat-number">${stats.totalVehicles}</div>
        <div class="stat-label">Pojazdy w bazie</div>
        <div class="stat-sub">${stats.activeVehicles} aktywnych</div>
      </div>
      
      <div class="fleet-stat-card" onclick="showPage('fm-documents')">
        <div class="stat-icon"><i class="ti ti-alert-circle"></i></div>
        <div class="stat-number" style="color: var(--red)">${stats.missingData.length}</div>
        <div class="stat-label">Brakuje danych</div>
        <div class="stat-sub">wymaga uzupełnienia</div>
      </div>
      
      <div class="fleet-stat-card" onclick="showPage('fm-documents')">
        <div class="stat-icon"><i class="ti ti-calendar-x"></i></div>
        <div class="stat-number" style="color: var(--amber)">${stats.expiringOC.length}</div>
        <div class="stat-label">Dokumenty</div>
        <div class="stat-sub">wkrótce wygasają</div>
      </div>
      
      <div class="fleet-stat-card" onclick="showPage('dash')">
        <div class="stat-icon"><i class="ti ti-file-check"></i></div>
        <div class="stat-number" style="color: var(--green)">${stats.readyForDT1.length}</div>
        <div class="stat-label">Gotowe do DT-1</div>
        <div class="stat-sub">kategoria przypisana</div>
      </div>
    </div>
    
    <!-- Alerty -->
    <div class="fleet-today-section">
      <div class="section-title">
        <i class="ti ti-checklist"></i>
        Dzisiaj do zrobienia (${alerts.length})
      </div>
      
      ${alerts.length === 0 ? `
        <div class="empty-state">
          <i class="ti ti-mood-smile" style="font-size: 48px; color: var(--green)"></i>
          <div style="margin-top: 12px; color: var(--text2)">Brak zadań na dzisiaj — wszystko w porządku!</div>
        </div>
      ` : `
        <div class="alerts-list">
          ${alerts.slice(0, 5).map(alert => `
            <div class="alert-item alert-${alert.priority}">
              <div class="alert-left">
                <i class="ti ti-alert-circle"></i>
              </div>
              <div class="alert-content">
                <div class="alert-message">${alert.message}</div>
                <div class="alert-time">Priorytet: ${alert.priority.toUpperCase()}</div>
              </div>
              <div class="alert-actions">
                <button class="btn btn-sm" onclick="alertSystem.instance.resolveAlert('${alert.id}'); renderFleetManagerDashboard()">
                  <i class="ti ti-check"></i>Gotowe
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
    
    <!-- Szybkie akcje -->
    <div class="fleet-quick-actions">
      <div class="section-title"><i class="ti ti-lightning-bolt"></i>Szybkie akcje</div>
      <div class="actions-grid">
        <button class="action-btn" onclick="showPage('fm-vehicles')">
          <i class="ti ti-plus"></i>
          <span>Dodaj pojazd</span>
        </button>
        <button class="action-btn" onclick="showPage('pojazdy')">
          <i class="ti ti-upload"></i>
          <span>Import Excel</span>
        </button>
        <button class="action-btn" onclick="showPage('formularze')">
          <i class="ti ti-file"></i>
          <span>Generuj DT-1</span>
        </button>
        <button class="action-btn" onclick="showPage('raporty')">
          <i class="ti ti-chart-bar"></i>
          <span>Eksport raportu</span>
        </button>
      </div>
    </div>
  `;
}

// ==================== RENDEROWANIE FLEET MANAGER POJAZDY ====================

function renderFleetManagerVehicles() {
  const page = document.getElementById('page-fm-vehicles');
  if (!page) return;
  
  page.innerHTML = VehiclesModule.renderVehiclesModule();
  setTimeout(() => VehiclesModule.filterVehicles(), 100);
}

// ==================== RENDEROWANIE FLEET MANAGER KIEROWCY ====================

function renderFleetManagerDrivers() {
  const page = document.getElementById('page-fm-drivers');
  if (!page) return;
  
  page.innerHTML = `
    <div class="pg-title"><i class="ti ti-user"></i>Kierowcy</div>
    <div class="pg-sub">Zarządzanie kierowcami i ich przypisaniem do pojazdów</div>
    <div class="empty" style="margin-top: 2rem">
      <i class="ti ti-user"></i>
      Moduł Kierowcy — wkrótce
    </div>
  `;
}

// ==================== RENDEROWANIE FLEET MANAGER DOKUMENTY ====================

function renderFleetManagerDocuments() {
  const page = document.getElementById('page-fm-documents');
  if (!page) return;
  
  page.innerHTML = DocumentsModule.renderDocumentsModule();
  setTimeout(() => DocumentsModule.filterDocuments(), 100);
}

// ==================== RENDEROWANIE FLEET MANAGER KOSZTY ====================

function renderFleetManagerCosts() {
  const page = document.getElementById('page-fm-costs');
  if (!page) return;
  
  page.innerHTML = `
    <div class="pg-title"><i class="ti ti-cash"></i>Koszty</div>
    <div class="pg-sub">Tracking wydatków operacyjnych floty</div>
    <div class="empty" style="margin-top: 2rem">
      <i class="ti ti-cash"></i>
      Moduł Koszty — wkrótce
    </div>
  `;
}

// ==================== INICJALIZACJA PO ZALOGOWANIU ====================

const originalDoLogin = window.doLogin;

window.doLogin = function() {
  if (originalDoLogin) originalDoLogin();
  
  // Po zalogowaniu inicjalizuj Fleet Manager
  setTimeout(() => {
    if (document.getElementById('app').style.display !== 'none') {
      initializeFleetManager();
      // Pokaż dashboard
      showPage('fm-dashboard');
    }
  }, 500);
};

// ==================== EKSPORT ====================

window.FleetManagerIntegration = {
  initializeFleetManager,
  handleFleetManagerPage,
  renderFleetManagerDashboard,
  renderFleetManagerVehicles,
  renderFleetManagerDocuments,
  renderFleetManagerCosts
};
