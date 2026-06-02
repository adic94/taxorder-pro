/**
 * System alertów dla Fleet Manager
 * Zarządzanie priorytetami i statusami
 */

class AlertSystem {
  constructor() {
    this.alerts = [];
    this.listeners = [];
  }

  /**
   * Dodaj alert
   */
  addAlert(type, vehicleId, message, priority = 'medium') {
    const alert = new FleetManager.FleetAlert(type, vehicleId, message, priority);
    this.alerts.push(alert);
    this.notifyListeners();
    return alert;
  }

  /**
   * Rozwiąż alert
   */
  resolveAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolve();
      this.notifyListeners();
    }
  }

  /**
   * Pobierz nierozwiązane alerty
   */
  getUnresolvedAlerts() {
    return this.alerts.filter(a => !a.resolved);
  }

  /**
   * Pobierz alerty dla pojazdu
   */
  getVehicleAlerts(vehicleId) {
    return this.alerts.filter(a => a.vehicleId === vehicleId && !a.resolved);
  }

  /**
   * Wyczyść wszystkie alerty
   */
  clearAll() {
    this.alerts = [];
    this.notifyListeners();
  }

  /**
   * Subscribe na zmiany
   */
  subscribe(callback) {
    this.listeners.push(callback);
  }

  /**
   * Powiadom słuchaczy
   */
  notifyListeners() {
    this.listeners.forEach(cb => cb(this.getUnresolvedAlerts()));
  }

  /**
   * Sortuj alerty
   */
  getSorted(field = 'priority') {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return [...this.alerts].sort((a, b) => {
      if (field === 'priority') {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a[field] > b[field] ? 1 : -1;
    });
  }
}

// Globalna instancja
const alertSystem = new AlertSystem();

// ==================== EKSPORT ====================

window.AlertSystem = {
  AlertSystem,
  instance: alertSystem
};
