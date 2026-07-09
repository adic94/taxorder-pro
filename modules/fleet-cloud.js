// ==================== FLEET CLOUD — Supabase sync ====================
// Obsługuje: loadVehicles(), saveVehicle(), saveVehicles()
// Zapis: osie, zawieszenie, DMC zespołu, miesiące podatkowe (pola DT-1)

window.TaxOrderFleetCloud = {

  // Mapowanie slug firmy → UUID w Supabase
  COMPANY_IDS: {
    mtoilet:   "c2b40585-e8ca-4928-8d7b-db82600979bf",
    gcon:      "a22a62ff-4dcb-420b-a697-3fa9193d3d74",
    grental:   "554657e4-292d-448a-b5a9-abe3969c32d6",
    kjrsupply: "759cce3a-02ea-4ddd-a537-febf67b4666d",
    nwkinvest: "5d755df6-3a4d-4d8b-a4de-a4b0e6467b29",
    wolund:    "5ddf9f8e-791e-4948-b9bf-dd144258008d"
  },

  // Pobierz UUID aktualnej firmy (na podstawie currentCompanyId z app.js)
  getCompanyUUID(slug) {
    const s = (slug || window.currentCompanyId || "mtoilet").toLowerCase();
    return this.COMPANY_IDS[s] || this.COMPANY_IDS["mtoilet"];
  },

  // Mapowanie wiersza DB → obiekt pojazdu w app.js
  mapDbVehicle(row, index) {
    const raw = row.raw_data || {};
    return {
      ...raw,
      id:             index,
      dbId:           row.id,
      nrRej:          row.registration_number || raw.nrRej || "",
      vin:            row.vin            || raw.vin    || "",
      marka:          row.brand          || raw.marka  || "",
      model:          row.model          || raw.model  || "",
      rok:            row.production_year|| raw.rok    || null,
      typ:            row.vehicle_type   || raw.typ    || "",
      dmc:            row.dmc_kg         ?? raw.dmc    ?? 0,
      euro:           row.euro_standard  || raw.euro   || "",
      status:         row.ownership_status || raw.status || "",
      wlasciciel:     row.owner_name     || raw.wlasciciel || "",
      // Pola edytowalne przez użytkownika — priorytet: DB > raw_data > domyślne
      osie:           row.axles_count    != null ? row.axles_count    : (raw.osie    ?? 2),
      zawieszenie:    row.suspension_type|| raw.zawieszenie || "pneumatyczne",
      dmcZespolu:     row.dmc_team_kg    != null ? row.dmc_team_kg    : (raw.dmcZespolu ?? 0),
      miesiacePodatku:row.taxable_months != null ? row.taxable_months : (raw.miesiacePodatku ?? 12),
      cat:            row.dt1_category   || raw.cat    || null,
      amount:         row.dt1_tax_amount != null ? Number(row.dt1_tax_amount) : (raw.amount ?? null)
    };
  },

  // Mapowanie obiektu pojazdu → payload do Supabase UPDATE
  mapVehicleToDb(v) {
    const tax = (typeof calcTax === "function") ? calcTax(v) : {};

    // Pełne dane pojazdu (meta + DT-1/A) w raw_data JSONB
    const raw = {
      nrRej: v.nrRej, marka: v.marka, model: v.model, rok: v.rok,
      typ: v.typ, dmc: v.dmc, euro: v.euro, vin: v.vin,
      status: v.status, wlasciciel: v.wlasciciel, miejsca: v.miejsca,
      // Dowód rejestracyjny
      dataRejestracji: v.dataRejestracji, przeznaczenie: v.przeznaczenie, wariant: v.wariant,
      dmcMax: v.dmcMax, masaWlasna: v.masaWlasna,
      pojSilnika: v.pojSilnika, mocKW: v.mocKW, paliwo: v.paliwo,
      miejscaSied: v.miejscaSied, homologacja: v.homologacja,
      docDataWydania: v.docDataWydania, docWaznyDo: v.docWaznyDo,
      drivetype: v.drivetype, bodyType: v.bodyType,
      // Własność
      ownership_type: v.ownership_type,
      leasingCompany: v.leasingCompany, leasingContractNo: v.leasingContractNo,
      leasingStart: v.leasingStart, leasingEnd: v.leasingEnd,
      leasingRate: v.leasingRate, leasingBuyout: v.leasingBuyout,
      leasingKmLimit: v.leasingKmLimit,
      rentalCompany: v.rentalCompany, rentalStart: v.rentalStart, rentalEnd: v.rentalEnd,
      // Zakup / sprzedaż
      purchaseDate: v.purchaseDate, purchasePrice: v.purchasePrice, purchaseInvoice: v.purchaseInvoice,
      saleDate: v.saleDate, saleInvoice: v.saleInvoice, saleBuyer: v.saleBuyer, salePrice: v.salePrice,
      // DT-1/A daty
      dataNabycia: v.dataNabycia || v.purchaseDate,
      dataZbycia: v.dataZbycia || v.saleDate,
      dataWycofania: v.dataWycofania,
      dataDopuszczenia: v.dataDopuszczenia,
      dataWyrejestrowania: v.dataWyrejestrowania,
      // Inne
      uwagi: v.uwagi, insurancePolicyNo: v.insurancePolicyNo,
      is_active: v.is_active, archivedAt: v.archivedAt, archivedReason: v.archivedReason,
      cepikSyncStatus: v.cepikSyncStatus
    };
    Object.keys(raw).forEach(k => { if (raw[k] === undefined) delete raw[k]; });

    return {
      axles_count:      parseInt(v.osie)            || 2,
      suspension_type:  v.zawieszenie               || "pneumatyczne",
      dmc_team_kg:      parseInt(v.dmcZespolu)       || 0,
      taxable_months:   parseInt(v.miesiacePodatku)  || 12,
      dt1_category:     tax.cat    || v.cat          || null,
      dt1_tax_amount:   tax.amount != null ? tax.amount : (v.amount ?? null),
      raw_data:         raw
    };
  },

  // Śledzenie własnych zapisów — tłumi echo real-time
  _selfSavedIds: new Set(),
  // Aktywny kanał real-time Supabase
  _realtimeChannel: null,

  // Zapisuje jeden pojazd do Supabase
  // Wywołuj po każdej zmianie osi/zawieszenia/DMC/miesięcy
  async saveVehicle(v) {
    if (!v.dbId) {
      console.warn("[FleetCloud] Brak dbId — pomijam zapis:", v.nrRej);
      return { ok: false };
    }
    if (!window.supabaseClient) return { ok: false };

    // Oznaczymy własny zapis — real-time echo będzie pominięte
    this._selfSavedIds.add(v.dbId);
    setTimeout(() => this._selfSavedIds.delete(v.dbId), 8000);

    const payload = this.mapVehicleToDb(v);

    const { error } = await window.supabaseClient
      .from("vehicles")
      .update(payload)
      .eq("id", v.dbId);

    if (error) {
      this._selfSavedIds.delete(v.dbId);
      console.error("[FleetCloud] Błąd zapisu:", v.nrRej, error.message);
      return { ok: false, error };
    }

    console.log("[FleetCloud] ✓ Zapisano:", v.nrRej, payload);
    return { ok: true };
  },

  // Zapisuje wiele pojazdów naraz (np. po bulk-edycji lub przed switchCompany)
  async saveVehicles(vehicles) {
    if (!window.supabaseClient) return { ok: false };
    const toSave = vehicles.filter(v => v.dbId);
    if (!toSave.length) return { ok: true, saved: 0 };

    const results = await Promise.allSettled(
      toSave.map(v => this.saveVehicle(v))
    );

    const saved  = results.filter(r => r.value?.ok).length;
    const failed = results.length - saved;

    if (failed) console.warn("[FleetCloud] Błędy batch-save:", failed, "pojazdów");
    toast(`✓ Zapisano ${saved} pojazdów do bazy${failed ? ` (${failed} błędów)` : ""}`);

    return { ok: failed === 0, saved, failed };
  },

  // Usuwa pojazd z Supabase
  async deleteVehicle(v) {
    if (!v.dbId || !window.supabaseClient) return { ok: false };

    const { error } = await window.supabaseClient
      .from("vehicles")
      .delete()
      .eq("id", v.dbId);

    if (error) {
      console.error("[FleetCloud] Błąd usunięcia:", v.nrRej, error.message);
      return { ok: false, error };
    }

    console.log("[FleetCloud] ✓ Usunięto z Supabase:", v.nrRej);
    return { ok: true };
  },

  // Synchronizuje dane pojazdu z CEPiK przez skonfigurowany proxy
  async syncFromCepik(v) {
    const proxyUrl = (localStorage.getItem('dt1_cepik_proxy') || '').trim();
    if (!proxyUrl) {
      return { ok: false, message: 'Brak proxy CEPiK — skonfiguruj w Ustawienia → CEPiK.' };
    }

    const fetchUrl = proxyUrl.replace(/\/$/, '') + `?nr=${encodeURIComponent(v.nrRej)}`;
    let resp;
    try {
      resp = await fetch(fetchUrl, { signal: AbortSignal.timeout(15000) });
    } catch(e) {
      return { ok: false, message: `Błąd połączenia z proxy: ${e.message}` };
    }
    if (!resp.ok) {
      return { ok: false, message: `Proxy HTTP ${resp.status} — sprawdź adres URL` };
    }

    let text;
    try { text = await resp.text(); } catch(e) {
      return { ok: false, message: 'Błąd odczytu odpowiedzi proxy' };
    }

    const mapped = window.CepikXML?.parseOneFromText(text, v.nrRej);
    if (!mapped || Object.keys(mapped).length < 3) {
      return { ok: false, message: 'Brak danych pojazdu w odpowiedzi CEPiK. Sprawdź nr rej. i konfigurację proxy.' };
    }

    // Aplikuj pola — nie nadpisuj historii ani klucza ID
    const SKIP = new Set(['nrRej','id','dbId','fuelHistory','serviceHistory','gpsHistory','inspectionHistory',
                          'osie','zawieszenie','dmcZespolu','miesiacePodatku','cat','amount']);
    let updated = 0;
    for (const [key, val] of Object.entries(mapped)) {
      if (SKIP.has(key) || val === null || val === undefined || val === '') continue;
      if (Array.isArray(v[key])) continue;
      v[key] = val;
      updated++;
    }

    v.cepikSyncStatus = 'ok';
    v.cepikSyncDate   = new Date().toISOString().slice(0,10);

    const saveResult = await this.saveVehicle(v);
    return { ok: true, fields: updated, saved: saveResult.ok };
  },

  // Wczytuje pojazdy aktualnej firmy z Supabase
  async loadVehicles(companySlug) {
    if (!window.supabaseClient) return { ok: false };

    const companyUUID = this.getCompanyUUID(companySlug);

    const { data, error } = await window.supabaseClient
      .from("vehicles")
      .select("*")
      .eq("company_id", companyUUID)
      .order("registration_number", { ascending: true });

    if (error) {
      console.error("[FleetCloud] Błąd pobierania pojazdów:", error.message);
      return { ok: false, error };
    }

    const mapped = (data || []).map((row, index) => this.mapDbVehicle(row, index));

    if (typeof window.setTaxOrderVehicles === "function") {
      window.setTaxOrderVehicles(mapped);
    }

    console.log("[FleetCloud] Pobrano pojazdy z Supabase:", mapped.length,
      "| firma:", companySlug || window.currentCompanyId || "mtoilet");

    if (!mapped.length) {
      console.warn("[FleetCloud] 0 pojazdów — zachowuję lokalną flotę z app.js");
      return { ok: false, count: 0, vehicles: [] };
    }

    return { ok: true, count: mapped.length, vehicles: mapped };
  },

  // ==================== REAL-TIME ====================

  // Subskrybuj zmiany w tabeli vehicles dla aktualnej firmy
  subscribeRealTime(companySlug) {
    if (!window.supabaseClient) return;
    this.unsubscribeRealTime();

    const companyUUID = this.getCompanyUUID(companySlug);

    this._realtimeChannel = window.supabaseClient
      .channel('fleet-' + companyUUID)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'vehicles',
        filter: `company_id=eq.${companyUUID}`
      }, (payload) => this._handleRealTimeChange(payload))
      .subscribe((status) => {
        console.log('[FleetCloud RT] Status:', status, '| firma:', companySlug);
      });
  },

  // Odsubskrybuj aktywny kanał (np. przy zmianie firmy lub wylogowaniu)
  unsubscribeRealTime() {
    if (this._realtimeChannel && window.supabaseClient) {
      window.supabaseClient.removeChannel(this._realtimeChannel);
      this._realtimeChannel = null;
    }
  },

  // Obsługa zdarzeń real-time — INSERT / UPDATE / DELETE
  _handleRealTimeChange(payload) {
    const changedId = payload.new?.id || payload.old?.id;

    // Pomiń echo własnych zapisów
    if (changedId && this._selfSavedIds.has(changedId)) {
      this._selfSavedIds.delete(changedId);
      return;
    }

    const plate = payload.new?.registration_number || payload.old?.registration_number || '?';
    const ev    = payload.eventType;

    console.log('[FleetCloud RT] Zdarzenie zewnętrzne:', ev, plate);
    if (typeof toast === 'function') {
      const msg = ev === 'DELETE'
        ? `🔄 Inny użytkownik usunął pojazd ${plate}`
        : `🔄 Aktualizacja floty: ${plate}`;
      toast(msg);
    }

    const slug = window.currentCompanyId || 'mtoilet';
    this.loadVehicles(slug).then(result => {
      if (result.ok) {
        if (typeof renderVeh === 'function')       renderVeh();
        if (typeof _renderFleetKpi === 'function') _renderFleetKpi();
        if (typeof updateCounters === 'function')  updateCounters();
      }
    });
  }
};
