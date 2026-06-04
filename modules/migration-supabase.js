window.TaxOrderMigration = {
  async migrateVehiclesFromLocalStorage() {
    const companyId = "c2b40585-e8ca-4928-8d7b-db82600979bf";
    const states = JSON.parse(localStorage.getItem("dt1_company_states") || "{}");
    const currentCompany = localStorage.getItem("dt1_current_company") || "mtoilet";
    const state = states[currentCompany] || {};
    const vehicles = state.vehs || window.vehs || [];

    if (!vehicles.length) {
      console.warn("[Migracja] Brak pojazdów do migracji");
      return { ok: false, count: 0 };
    }

    const rows = vehicles.map(v => ({
      company_id: companyId,
      registration_number: v.nrRej || "",
      vin: v.vin || null,
      brand: v.marka || null,
      model: v.model || null,
      production_year: v.rok ? Number(v.rok) : null,
      vehicle_type: v.typ || null,
      dmc_kg: v.dmc ? Number(v.dmc) : null,
      euro_standard: v.euro || null,
      ownership_status: v.status || null,
      owner_name: v.wlasciciel || null,
      axles_count: v.osie ? Number(v.osie) : null,
      suspension_type: v.zawieszenie || null,
      dmc_team_kg: v.dmcZespolu ? Number(v.dmcZespolu) : null,
      taxable_months: v.months ? Number(v.months) : 12,
      dt1_category: v.cat || null,
      dt1_tax_amount: v.amount ? Number(v.amount) : null,
      raw_data: v
    }));

    const { data, error } = await window.supabaseClient
      .from("vehicles")
      .insert(rows)
      .select();

    if (error) {
      console.error("[Migracja] Błąd migracji pojazdów:", error);
      return { ok: false, error };
    }

    console.log("[Migracja] Przeniesiono pojazdy:", data.length, data);
    return { ok: true, count: data.length, data };
  }
};
