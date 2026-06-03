// TaxOrder Fleet Manager
// Tax Engine v1
// Silnik kategorii DT-1 i podatku transportowego

const TaxEngine = {
  getRate(v) {
    const dT = v.dmc / 1000;
    const dzT = (v.dmcZespolu || 0) / 1000;
    const refZ = dzT > 0 ? dzT : dT;
    const typ = (v.typ || "").toLowerCase();
    const osie = parseInt(v.osie) || 2;
    const rok = parseInt(v.rok) || 0;
    const isNew = rok >= 2024;

    if (typ.includes("autobus")) return isNew ? 1320 : (parseInt(v.miejsca) || 0) < 30 ? 1488 : 1872;

    if (typ.includes("naczepa") || typ.includes("przyczepa")) {
      if (refZ >= 7 && refZ < 12) return isNew ? 1128 : 1248;
      if (refZ >= 12) {
        if (osie === 1) {
          if (refZ < 18) return 744;
          if (refZ < 25) return 840;
          if (refZ <= 36) return 984;
          return 1128;
        }
        if (osie === 2) {
          if (refZ < 28) return 1488;
          if (refZ < 33) return 1776;
          if (refZ < 38) return 2256;
          return 2976;
        }
        if (refZ <= 36) return 1872;
        if (refZ < 38) return 2040;
        return 2232;
      }
      return null;
    }

    if (typ.includes("ci¹gnik") || typ.includes("ciagnik")) {
      if (refZ >= 3.5 && refZ < 12) return isNew ? 1248 : 1392;
      if (refZ >= 12) {
        if (osie <= 2) {
          if (refZ < 18) return 1128;
          if (refZ < 25) return 1680;
          if (refZ < 31) return 2232;
          return 3384;
        }
        if (refZ <= 36) return 2784;
        if (refZ < 40) return 2832;
        return 4200;
      }
      return null;
    }

    if (dT <= 3.5) return null;

    if (dT < 12) {
      if (isNew) {
        if (dT <= 5.5) return 744;
        if (dT <= 9) return 1008;
        return 1344;
      }
      if (dT <= 5.5) return 840;
      if (dT <= 9) return 1128;
      return 1488;
    }

    if (osie === 2) {
      if (dT < 13) return 1200;
      if (dT < 14) return 1488;
      if (dT < 15) return 1680;
      return 2184;
    }

    if (osie === 3) {
      if (dT < 17) return 1488;
      if (dT < 19) return 1704;
      if (dT < 21) return 1872;
      if (dT < 23) return 2136;
      return 2760;
    }

    if (dT < 25) return 1488;
    if (dT < 27) return 1824;
    if (dT < 29) return 2880;
    return 4296;
  },

  getCat(v) {
    const dT = v.dmc / 1000;
    const dzT = (v.dmcZespolu || 0) / 1000;
    const refZ = dzT > 0 ? dzT : dT;
    const typ = (v.typ || "").toLowerCase();
    const osie = parseInt(v.osie) || 2;

    if (typ.includes("autobus")) return (parseInt(v.miejsca) || 0) < 22 ? "D6" : "D7";

    if (typ.includes("naczepa") || typ.includes("przyczepa")) {
      if (refZ >= 12) return osie === 1 ? "D13" : osie === 2 ? "D14" : "D15";
      if (refZ >= 7) return "D5";
      return null;
    }

    if (typ.includes("ci¹gnik") || typ.includes("ciagnik")) {
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
