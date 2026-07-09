// TaxOrder Fleet Manager — Tax Engine v1
// Silnik kategorii DT-1 i podatku transportowego (art. 10 ustawy o podatkach i opłatach lokalnych)

// ─── Stawki 2026 (zł/rok) — aktualizować tu przy zmianie uchwały ──────────────
const STAWKI_2026 = {
  // Autobusy
  autobus_new:          1320,  // rok >= 2024
  autobus_lt30:         1488,  // < 30 miejsc
  autobus_ge30:         1872,  // >= 30 miejsc

  // Naczepy / przyczepy 7–12t
  przyczepa_7_12_new:   1128,
  przyczepa_7_12_old:   1248,

  // Naczepy / przyczepy >= 12t, 1 oś
  przyczepa_ge12_1os_lt18:  744,
  przyczepa_ge12_1os_lt25:  840,
  przyczepa_ge12_1os_le36:  984,
  przyczepa_ge12_1os_gt36: 1128,

  // Naczepy / przyczepy >= 12t, 2 osie
  przyczepa_ge12_2os_lt28: 1488,
  przyczepa_ge12_2os_lt33: 1776,
  przyczepa_ge12_2os_lt38: 2256,
  przyczepa_ge12_2os_ge38: 2976,

  // Naczepy / przyczepy >= 12t, 3+ osie
  przyczepa_ge12_3os_le36: 1872,
  przyczepa_ge12_3os_lt38: 2040,
  przyczepa_ge12_3os_ge38: 2232,

  // Ciągniki siodłowe / balastowe 3.5–12t
  ciagnik_lt12_new:     1248,
  ciagnik_lt12_old:     1392,

  // Ciągniki >= 12t, <= 2 osie
  ciagnik_ge12_2os_lt18: 1128,
  ciagnik_ge12_2os_lt25: 1680,
  ciagnik_ge12_2os_lt31: 2232,
  ciagnik_ge12_2os_ge31: 3384,

  // Ciągniki >= 12t, 3+ osie
  ciagnik_ge12_3os_le36: 2784,
  ciagnik_ge12_3os_lt40: 2832,
  ciagnik_ge12_3os_ge40: 4200,

  // Samochody ciężarowe < 12t, rok >= 2024 (§2 obniżone)
  ciezar_lt55_new:       744,
  ciezar_55_9_new:      1008,
  ciezar_9_12_new:      1344,

  // Samochody ciężarowe < 12t, starsze
  ciezar_lt55_old:       840,
  ciezar_55_9_old:      1128,
  ciezar_9_12_old:      1488,

  // Samochody ciężarowe >= 12t, 2 osie
  ciezar_ge12_2os_lt13: 1200,
  ciezar_ge12_2os_lt14: 1488,
  ciezar_ge12_2os_lt15: 1680,
  ciezar_ge12_2os_ge15: 2184,

  // Samochody ciężarowe >= 12t, 3 osie
  ciezar_ge12_3os_lt17: 1488,
  ciezar_ge12_3os_lt19: 1704,
  ciezar_ge12_3os_lt21: 1872,
  ciezar_ge12_3os_lt23: 2136,
  ciezar_ge12_3os_ge23: 2760,

  // Samochody ciężarowe >= 12t, 4+ osie
  ciezar_ge12_4os_lt25: 1488,
  ciezar_ge12_4os_lt27: 1824,
  ciezar_ge12_4os_lt29: 2880,
  ciezar_ge12_4os_ge29: 4296,
};

const TaxEngine = {
  getRate(v) {
    if (window.GminyRates) {
      const r = window.GminyRates.getGminaRate(v);
      if (r != null) return r;
    }
    const S = STAWKI_2026;
    const dT = (v.dmc ?? v.dmcMax ?? 0) / 1000;
    const dzT = (v.dmcZespolu || 0) / 1000;
    const refZ = dzT > 0 ? dzT : dT;
    const typ = (v.typ || "").toLowerCase();
    const osie = parseInt(v.osie) || 2;
    const isNew = (parseInt(v.rok) || 0) >= 2024;

    if (typ.includes("autobus")) return isNew ? S.autobus_new : (parseInt(v.miejsca) || 0) < 30 ? S.autobus_lt30 : S.autobus_ge30;

    if (typ.includes("naczepa") || typ.includes("przyczepa")) {
      if (refZ >= 7 && refZ < 12) return isNew ? S.przyczepa_7_12_new : S.przyczepa_7_12_old;
      if (refZ >= 12) {
        if (osie === 1) {
          if (refZ < 18) return S.przyczepa_ge12_1os_lt18;
          if (refZ < 25) return S.przyczepa_ge12_1os_lt25;
          if (refZ <= 36) return S.przyczepa_ge12_1os_le36;
          return S.przyczepa_ge12_1os_gt36;
        }
        if (osie === 2) {
          if (refZ < 28) return S.przyczepa_ge12_2os_lt28;
          if (refZ < 33) return S.przyczepa_ge12_2os_lt33;
          if (refZ < 38) return S.przyczepa_ge12_2os_lt38;
          return S.przyczepa_ge12_2os_ge38;
        }
        if (refZ <= 36) return S.przyczepa_ge12_3os_le36;
        if (refZ < 38)  return S.przyczepa_ge12_3os_lt38;
        return S.przyczepa_ge12_3os_ge38;
      }
      return null;
    }

    if (typ.includes("ciągnik") || typ.includes("ciagnik")) {
      if (refZ >= 3.5 && refZ < 12) return isNew ? S.ciagnik_lt12_new : S.ciagnik_lt12_old;
      if (refZ >= 12) {
        if (osie <= 2) {
          if (refZ < 18) return S.ciagnik_ge12_2os_lt18;
          if (refZ < 25) return S.ciagnik_ge12_2os_lt25;
          if (refZ < 31) return S.ciagnik_ge12_2os_lt31;
          return S.ciagnik_ge12_2os_ge31;
        }
        if (refZ <= 36) return S.ciagnik_ge12_3os_le36;
        if (refZ < 40)  return S.ciagnik_ge12_3os_lt40;
        return S.ciagnik_ge12_3os_ge40;
      }
      return null;
    }

    if (dT <= 3.5) return null;

    if (dT < 12) {
      if (isNew) {
        if (dT <= 5.5) return S.ciezar_lt55_new;
        if (dT <= 9)   return S.ciezar_55_9_new;
        return S.ciezar_9_12_new;
      }
      if (dT <= 5.5) return S.ciezar_lt55_old;
      if (dT <= 9)   return S.ciezar_55_9_old;
      return S.ciezar_9_12_old;
    }

    if (osie === 2) {
      if (dT < 13) return S.ciezar_ge12_2os_lt13;
      if (dT < 14) return S.ciezar_ge12_2os_lt14;
      if (dT < 15) return S.ciezar_ge12_2os_lt15;
      return S.ciezar_ge12_2os_ge15;
    }

    if (osie === 3) {
      if (dT < 17) return S.ciezar_ge12_3os_lt17;
      if (dT < 19) return S.ciezar_ge12_3os_lt19;
      if (dT < 21) return S.ciezar_ge12_3os_lt21;
      if (dT < 23) return S.ciezar_ge12_3os_lt23;
      return S.ciezar_ge12_3os_ge23;
    }

    if (dT < 25) return S.ciezar_ge12_4os_lt25;
    if (dT < 27) return S.ciezar_ge12_4os_lt27;
    if (dT < 29) return S.ciezar_ge12_4os_lt29;
    return S.ciezar_ge12_4os_ge29;
  },

  getCat(v) {
    if (v.dmc == null && v.dmcMax == null) return null;
    const dT = (v.dmc ?? v.dmcMax ?? 0) / 1000;
    const dzT = (v.dmcZespolu || 0) / 1000;
    const refZ = dzT > 0 ? dzT : dT;
    const typ = (v.typ || "").toLowerCase();
    const osie = parseInt(v.osie) || 2;

    if (typ.includes("specjaln") || (v.przeznaczenie || "").toLowerCase().includes("specjaln")) return null;
    if (typ.includes("autobus")) return (parseInt(v.miejsca) || 0) < 22 ? "D6" : "D7";

    if (typ.includes("naczepa") || typ.includes("przyczepa")) {
      if (refZ >= 12) return osie === 1 ? "D13" : osie === 2 ? "D14" : "D15";
      if (refZ >= 7) return "D5";
      return null;
    }

    if (typ.includes("ciągnik") || typ.includes("ciagnik")) {
      if (refZ >= 12) return osie <= 2 ? "D11" : "D12";
      if (refZ >= 3.5) return "D4";
      return null;
    }

    if (dT <= 3.5) return null;
    if (dT >= 12) return osie === 2 ? "D8" : osie === 3 ? "D9" : "D10";
    if (dT <= 5.5) return "D1";
    if (dT <= 9) return "D2";
    if (dT < 12) return "D3";

    return null;
  },

  calcTax(v) {
    const cat = this.getCat(v);
    if (!cat) return { cat: null, amount: 0, rate: 0 };

    const rate = this.getRate(v) || 0;
    const months = Math.min(Math.max(parseInt(v.miesiacePodatku) || 12, 1), 12);

    return {
      cat,
      amount: Math.round((rate * months) / 12 * 100) / 100,
      rate,
      months,
      isNew: (parseInt(v.rok) || 0) >= 2024
    };
  }
};

window.TaxEngine = TaxEngine;
