/**
 * TaxOrder Fleet Manager — Dashboard
 * System wsparcia dla pracownika floty, księgowości i administracji
 * 
 * Moduły:
 * 1. Dashboard (strona główna)
 * 2. Pojazdy (zarządzanie flotą)
 * 3. Kierowcy (rejestr kierowców)
 * 4. Dokumenty (DPF, OC, badania tech.)
 * 5. Koszty (koszty operacyjne)
 * 6. Podatki DT-1 (deklaracje)
 * 7. Raporty (analiza floty)
 * 8. Integracje (CEPiK, eHanuta)
 * 9. Administracja (ustawienia, użytkownicy)
 */

// ==================== STRUKTURA DANYCH ====================

// Główny state aplikacji
const FleetManagerDB = {
  vehicles: [],
  drivers: [],
  documents: [],
  costs: [],
  alerts: [],
  users: [],
  companies: [],
  integrations: {
    cepik: { enabled: false, token: '' },
    ehanuta: { enabled: false, token: '' }
  }
};

// Typy alertów
const ALERT_TYPES = {
  MISSING_DATA: 'MISSING_DATA',
  EXPIRING_DOCUMENT: 'EXPIRING_DOCUMENT',
  DT1_READY: 'DT1_READY',
  DOCUMENT_NEEDS_REVIEW: 'DOCUMENT_NEEDS_REVIEW',
  UNASSIGNED_COST: 'UNASSIGNED_COST'
};

// Priorytety
const ALERT_PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

// ==================== KLASA ALERTU ====================

class FleetAlert {
  constructor(type, vehicleId, message, priority = 'medium') {
    this.id = 'alert_' + Date.now() + '_' + Math.random();
    this.type = type;
    this.vehicleId = vehicleId;
    this.message = message;
    this.priority = priority;
    this.createdAt = new Date();
    this.resolved = false;
  }

  resolve() {
    this.resolved = true;
    this.resolvedAt = new Date();
  }
}

// ==================== GENEROWANIE STATYSTYK ====================

function generateFleetStats() {
  const stats = {
    totalVehicles: vehs.length,
    activeVehicles: vehs.filter(v => v.status === 'Własny' || v.status === 'Leasing').length,
    leasingVehicles: vehs.filter(v => v.status === 'Leasing').length,
    ownedVehicles: vehs.filter(v => v.status === 'Własny').length,
    missingData: [],
    expiringOC: [],
    expiringTechInspection: [],
    readyForDT1: [],
    missingCriticalData: []
  };

  vehs.forEach(v => {
    // Pojazdy z brakującymi danymi
    if (!v.vin || !v.dmc || !v.euro || !v.dataNabycia) {
      stats.missingData.push(v);
    }
    
    // Pojazdy gotowe do DT-1
    const tax = calcTax(v);
    if (tax.cat) {
      stats.readyForDT1.push(v);
    }

    // Pojazdy z brakującymi VIN, DMC, EURO
    if (!v.vin || !v.dmc || !v.euro) {
      stats.missingCriticalData.push(v);
    }
  });

  return stats;
}

// ==================== GENEROWANIE ALERTÓW ====================

function generateTodayAlerts() {
  const alerts = [];
  const stats = generateFleetStats();

  // Alerty: brakuje danych
  stats.missingCriticalData.forEach(v => {
    const missing = [];
    if (!v.vin) missing.push('VIN');
    if (!v.dmc) missing.push('DMC');
    if (!v.euro) missing.push('norma EURO');
    if (!v.dataNabycia) missing.push('data nabycia');

    alerts.push(new FleetAlert(
      ALERT_TYPES.MISSING_DATA,
      v.id,
      `${v.nrRej}: brakuje ${missing.join(', ')}`,
      ALERT_PRIORITY.HIGH
    ));
  });

  // Alerty: pojazdy gotowe do DT-1
  stats.readyForDT1.forEach(v => {
    if (!v._dt1Submitted) {
      const tax = calcTax(v);
      alerts.push(new FleetAlert(
        ALERT_TYPES.DT1_READY,
        v.id,
        `${v.nrRej}: pojazd gotów do deklaracji DT-1 (kategoria ${tax.cat})`,
        ALERT_PRIORITY.MEDIUM
      ));
    }
  });

  // Sortuj po priorytecie
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return alerts.filter(a => !a.resolved);
}

// ==================== EKSPORT ====================

window.FleetManager = {
  DB: FleetManagerDB,
  ALERT_TYPES,
  FleetAlert,
  generateFleetStats,
  generateTodayAlerts
};
