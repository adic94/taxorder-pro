/**
 * Testy silnika podatkowego DT-1 (TaxEngine)
 * Pokrywa: getCat(), getRate(), calcTax(), obsługę null/edge-case
 */
(function () {
  const { describe, it, expect } = window.TaxOrderTests;
  const E = window.TaxEngine;

  describe('TaxEngine — kategorie DT-1', () => {

    it('samochód ciężarowy 3.5–5.5t → D1', () => {
      expect(E.getCat({ typ: 'samochód ciężarowy', dmc: 5000 })).toBe('D1');
    });

    it('samochód ciężarowy 5.5–9t → D2', () => {
      expect(E.getCat({ typ: 'samochód ciężarowy', dmc: 7000 })).toBe('D2');
    });

    it('samochód ciężarowy 9–12t → D3', () => {
      expect(E.getCat({ typ: 'samochód ciężarowy', dmc: 10000 })).toBe('D3');
    });

    it('samochód ciężarowy >= 12t, 2 osie → D8', () => {
      expect(E.getCat({ typ: 'samochód ciężarowy', dmc: 18000, osie: 2 })).toBe('D8');
    });

    it('samochód ciężarowy >= 12t, 3 osie → D9', () => {
      expect(E.getCat({ typ: 'samochód ciężarowy', dmc: 18000, osie: 3 })).toBe('D9');
    });

    it('samochód ciężarowy >= 12t, 4+ osie → D10', () => {
      expect(E.getCat({ typ: 'samochód ciężarowy', dmc: 30000, osie: 4 })).toBe('D10');
    });

    it('autobus < 22 miejsca → D6', () => {
      expect(E.getCat({ typ: 'autobus', dmc: 18000, miejsca: 20 })).toBe('D6');
    });

    it('autobus >= 22 miejsca → D7', () => {
      expect(E.getCat({ typ: 'autobus', dmc: 18000, miejsca: 35 })).toBe('D7');
    });

    it('ciągnik siodłowy 3.5–12t → D4', () => {
      expect(E.getCat({ typ: 'ciągnik siodłowy', dmc: 8000, dmcZespolu: 8000 })).toBe('D4');
    });

    it('ciągnik siodłowy >= 12t, <= 2 osie → D11', () => {
      expect(E.getCat({ typ: 'ciągnik', dmc: 18000, dmcZespolu: 40000, osie: 2 })).toBe('D11');
    });

    it('ciągnik siodłowy >= 12t, 3+ osie → D12', () => {
      expect(E.getCat({ typ: 'ciagnik', dmc: 18000, dmcZespolu: 40000, osie: 3 })).toBe('D12');
    });

    it('naczepa 7–12t → D5', () => {
      expect(E.getCat({ typ: 'naczepa', dmc: 10000, dmcZespolu: 10000 })).toBe('D5');
    });

    it('naczepa >= 12t, 1 oś → D13', () => {
      expect(E.getCat({ typ: 'naczepa', dmc: 15000, dmcZespolu: 15000, osie: 1 })).toBe('D13');
    });

    it('naczepa >= 12t, 2 osie → D14', () => {
      expect(E.getCat({ typ: 'naczepa', dmc: 20000, dmcZespolu: 20000, osie: 2 })).toBe('D14');
    });

    it('naczepa >= 12t, 3+ osie → D15', () => {
      expect(E.getCat({ typ: 'naczepa', dmc: 30000, dmcZespolu: 30000, osie: 3 })).toBe('D15');
    });

    it('pojazd poniżej 3.5t → null (brak opodatkowania)', () => {
      expect(E.getCat({ typ: 'samochód ciężarowy', dmc: 2000 })).toBeNull();
    });
  });

  describe('TaxEngine — stawki i rok produkcji', () => {

    it('samochód ciężarowy < 12t, nowy (>= 2024) → niższa stawka', () => {
      const rateNew = E.getRate({ typ: 'samochód ciężarowy', dmc: 5000, rok: 2024 });
      const rateOld = E.getRate({ typ: 'samochód ciężarowy', dmc: 5000, rok: 2020 });
      expect(rateNew).toBeLessThan(rateOld);
    });

    it('autobus nowy (>= 2024) → najniższa stawka autobusowa', () => {
      const rateNew = E.getRate({ typ: 'autobus', dmc: 18000, miejsca: 35, rok: 2024 });
      const rateOld = E.getRate({ typ: 'autobus', dmc: 18000, miejsca: 35, rok: 2019 });
      expect(rateNew).toBeLessThan(rateOld);
    });

    it('stawka > 0 dla pojazdu opodatkowanego', () => {
      const rate = E.getRate({ typ: 'samochód ciężarowy', dmc: 10000, rok: 2020 });
      expect(rate).toBeGreaterThan(0);
    });

    it('stawka null dla pojazdu poniżej 3.5t', () => {
      const rate = E.getRate({ typ: 'samochód ciężarowy', dmc: 3000, rok: 2020 });
      expect(rate).toBeNull();
    });
  });

  describe('TaxEngine — calcTax() pełny', () => {

    it('calcTax zwraca obiekt z cat, amount, rate, months, isNew', () => {
      const r = E.calcTax({ typ: 'samochód ciężarowy', dmc: 10000, osie: 2, rok: 2020, miesiacePodatku: 12 });
      expect(typeof r.cat).toBe('string');
      expect(typeof r.amount).toBe('number');
      expect(typeof r.rate).toBe('number');
      expect(r.months).toBe(12);
      expect(r.isNew).toBe(false);
    });

    it('calcTax dla pojazdu nowego: isNew = true', () => {
      const r = E.calcTax({ typ: 'samochód ciężarowy', dmc: 10000, osie: 2, rok: 2024, miesiacePodatku: 12 });
      expect(r.isNew).toBe(true);
    });

    it('calcTax poniżej 3.5t → {cat:null, amount:0}', () => {
      const r = E.calcTax({ typ: 'samochód ciężarowy', dmc: 2000, rok: 2020, miesiacePodatku: 12 });
      expect(r.cat).toBeNull();
      expect(r.amount).toBe(0);
    });

    it('calcTax 6 miesięcy → połowa stawki rocznej', () => {
      const r12 = E.calcTax({ typ: 'samochód ciężarowy', dmc: 10000, osie: 2, rok: 2020, miesiacePodatku: 12 });
      const r6  = E.calcTax({ typ: 'samochód ciężarowy', dmc: 10000, osie: 2, rok: 2020, miesiacePodatku: 6 });
      expect(r6.amount).toBe(Math.round(r12.amount / 2 * 100) / 100);
    });

    it('calcTax miesiacePodatku poza zakresem → clamp do 1–12', () => {
      const r0  = E.calcTax({ typ: 'samochód ciężarowy', dmc: 10000, osie: 2, rok: 2020, miesiacePodatku: 0 });
      const r99 = E.calcTax({ typ: 'samochód ciężarowy', dmc: 10000, osie: 2, rok: 2020, miesiacePodatku: 99 });
      expect(r0.months).toBe(1);
      expect(r99.months).toBe(12);
    });

    it('calcTax kwota zaokrąglona do 2 miejsc po przecinku', () => {
      const r = E.calcTax({ typ: 'samochód ciężarowy', dmc: 10000, osie: 2, rok: 2020, miesiacePodatku: 7 });
      const decimals = (r.amount.toString().split('.')[1] || '').length;
      expect(decimals).toBeLessThan(3);
    });
  });
})();
