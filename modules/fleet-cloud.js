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
window.TaxOrderFleetCloud = window.TaxOrderFleetCloud || {};

window.TaxOrderFleetCloud.vehicleToDbPatch = function(v) {
  const cat = typeof getCat === "function" ? getCat(v) : v.cat;
  const tax = typeof getRate === "function" && typeof getCat === "function"
    ? Number(getRate(cat, v))
    : Number(v.amount || 0);

  return {
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
    taxable_months: v.miesiacePodatku ? Number(v.miesiacePodatku) : 12,
    dt1_category: cat || null,
    dt1_tax_amount: tax || null,
    raw_data: {
      ...v,
      cat,
      amount: tax
    }
  };
};

window.TaxOrderFleetCloud.saveVehicle = async function(v) {
  if (!v) return { ok: false, error: "Brak pojazdu" };

  const patch = window.TaxOrderFleetCloud.vehicleToDbPatch(v);

  let query = window.supabaseClient
    .from("vehicles")
    .update(patch)
    .eq("company_id", window.TaxOrderFleetCloud.companyId);

  if (v.dbId) {
    query = query.eq("id", v.dbId);
  } else {
    query = query.eq("registration_number", v.nrRej);
  }

  const { data, error } = await query.select();

  if (error) {
    console.error("[FleetCloud] Błąd zapisu pojazdu:", v.nrRej, error);
    return { ok: false, error };
  }

  console.log("[FleetCloud] Zapisano pojazd:", v.nrRej, data);
  return { ok: true, data };
};
