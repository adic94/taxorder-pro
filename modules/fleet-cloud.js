window.TaxOrderFleetCloud = {
  companyId: "c2b40585-e8ca-4928-8d7b-db82600979bf",

  mapDbVehicle(row, index) {
    const raw = row.raw_data || {};

    return {
      ...raw,
      id: index,
      dbId: row.id,
      nrRej: row.registration_number || raw.nrRej || "",
      vin: row.vin || raw.vin || "",
      marka: row.brand || raw.marka || "",
      model: row.model || raw.model || "",
      rok: row.production_year || raw.rok || null,
      typ: row.vehicle_type || raw.typ || "",
      dmc: row.dmc_kg || raw.dmc || 0,
      euro: row.euro_standard || raw.euro || "",
      status: row.ownership_status || raw.status || "",
      wlasciciel: row.owner_name || raw.wlasciciel || "",
      osie: row.axles_count || raw.osie || 2,
      zawieszenie: row.suspension_type || raw.zawieszenie || "pneumatyczne",
      dmcZespolu: row.dmc_team_kg || raw.dmcZespolu || 0,
      miesiacePodatku: row.taxable_months || raw.miesiacePodatku || 12,
      cat: row.dt1_category || raw.cat || null,
      amount: row.dt1_tax_amount || raw.amount || null
    };
  },

  async loadVehicles() {
    const { data, error } = await window.supabaseClient
      .from("vehicles")
      .select("*")
      .eq("company_id", this.companyId)
      .order("registration_number", { ascending: true });

    if (error) {
      console.error("[FleetCloud] Błąd pobierania pojazdów:", error);
      return { ok: false, error };
    }

    const mapped = (data || []).map((row, index) => this.mapDbVehicle(row, index));

    if (typeof window.setTaxOrderVehicles === "function") {
      window.setTaxOrderVehicles(mapped);
    }

    console.log("[FleetCloud] Pobrano pojazdy z Supabase:", mapped.length);
    return { ok: true, count: mapped.length, vehicles: mapped };
  }
};
