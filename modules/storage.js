// TaxOrder Fleet Manager
// Storage Adapter v2
// Etap: localStorage teraz, Supabase póŸniej

const Storage = {
  getJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (e) {
      console.error("B³¹d odczytu localStorage:", key, e);
      return fallback;
    }
  },

  setJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  getCurrentCompany() {
    return localStorage.getItem("dt1_current_company") || "mtoilet";
  },

  setCurrentCompany(companyId) {
    localStorage.setItem("dt1_current_company", companyId);
  },

  getCompanyStates() {
    return this.getJson("dt1_company_states", {});
  },

  saveCompanyStates(data) {
    this.setJson("dt1_company_states", data);
  },

  getUsers() {
    return this.getJson("dt1_users", []);
  },

  saveUsers(users) {
    this.setJson("dt1_users", users);
  },

  getFleetCards() {
    return this.getJson("dt1_karty", []);
  },

  saveFleetCards(cards) {
    this.setJson("dt1_karty", cards);
  },

  getCepikSettings() {
    return {
      key: localStorage.getItem("dt1_cepik_key") || "",
      secret: localStorage.getItem("dt1_cepik_secret") || "",
      token: localStorage.getItem("dt1_cepik_token") || "",
      tokenExp: localStorage.getItem("dt1_cepik_token_exp") || "",
      proxy: localStorage.getItem("dt1_cepik_proxy") || "",
      settings: this.getJson("dt1_cepik_settings", {}),
      cache: this.getJson("dt1_cepik_cache", {}),
      lastCheck: localStorage.getItem("dt1_cepik_last_check") || ""
    };
  },

  saveCepikSettings(data) {
    if (data.key !== undefined) localStorage.setItem("dt1_cepik_key", data.key);
    if (data.secret !== undefined) localStorage.setItem("dt1_cepik_secret", data.secret);
    if (data.token !== undefined) localStorage.setItem("dt1_cepik_token", data.token);
    if (data.tokenExp !== undefined) localStorage.setItem("dt1_cepik_token_exp", data.tokenExp);
    if (data.proxy !== undefined) localStorage.setItem("dt1_cepik_proxy", data.proxy);
    if (data.settings !== undefined) this.setJson("dt1_cepik_settings", data.settings);
    if (data.cache !== undefined) this.setJson("dt1_cepik_cache", data.cache);
    if (data.lastCheck !== undefined) localStorage.setItem("dt1_cepik_last_check", data.lastCheck);
  },

  normalizeVehicle(vehicle, index = 0) {
    return {
      id: vehicle.id || crypto.randomUUID?.() || String(Date.now() + index),

      registrationNumber: vehicle.nrRej || vehicle.registrationNumber || "",
      vin: vehicle.vin || "",

      brand: vehicle.marka || vehicle.brand || "",
      model: vehicle.model || "",
      productionYear: vehicle.rok || vehicle.productionYear || null,

      vehicleType: vehicle.typ || vehicle.vehicleType || "",
      dmcKg: vehicle.dmc || vehicle.dmcKg || null,
      euroStandard: vehicle.euro || vehicle.euroStandard || "",

      ownershipStatus: vehicle.status || vehicle.ownershipStatus || "",
      ownerName: vehicle.wlasciciel || vehicle.ownerName || "",

      axlesCount: vehicle.osie || vehicle.axlesCount || null,
      suspensionType: vehicle.zawieszenie || vehicle.suspensionType || "",
      dmcTeamKg: vehicle.dmcZespolu || vehicle.dmcTeamKg || null,
      taxableMonths: vehicle.miesiacePodatku || vehicle.taxableMonths || 12,

      acquisitionDate: vehicle.dataNabycia || vehicle.acquisitionDate || null,
      saleDate: vehicle.dataSprzedazy || vehicle.saleDate || null,

      dt1Category: vehicle.cat || vehicle.dt1Category || "",
      dt1TaxAmount: vehicle.tax || vehicle.dt1TaxAmount || 0,

      raw: vehicle
    };
  },

  normalizeVehicles(vehicles) {
    return (vehicles || []).map((vehicle, index) => this.normalizeVehicle(vehicle, index));
  }
};

window.Storage = Storage;
