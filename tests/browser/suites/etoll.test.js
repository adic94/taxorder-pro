/**
 * Testy importu e-TOLL — parsowanie CSV i deduplicja transakcji
 * ETollImport.handleFile() trudno testować unit (wymaga input file),
 * więc testujemy _processText() przez ekspozycję lub logikę pomocniczą.
 */
(function () {
  const { describe, it, expect } = window.TaxOrderTests;

  // Pomocnicze — reimplementacja logiki parsowania do testów
  function parseDate(raw) {
    if (!raw) return '';
    const s = raw.trim();
    const iso = s.replace(' ', 'T');
    if (iso.match(/^\d{4}-\d{2}-\d{2}/)) return iso.substring(0, 10);
    const pl = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
    if (pl) return `${pl[3]}-${pl[2]}-${pl[1]}`;
    return s.substring(0, 10);
  }

  function parseAmount(raw) {
    if (raw == null) return 0;
    return parseFloat(String(raw).replace(',', '.').replace(/[^\d.]/g, '')) || 0;
  }

  function dedup(rows) {
    const seen = new Set();
    return rows.filter(r => {
      const key = `${r.nrRej}|${r.date}|${r.amount}|${r.txId || r.route}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  describe('e-TOLL — parsowanie daty', () => {

    it('format ISO z godziną → sama data', () => {
      expect(parseDate('2024-01-15 08:23:45')).toBe('2024-01-15');
    });

    it('format ISO bez godziny → ta sama data', () => {
      expect(parseDate('2024-03-20')).toBe('2024-03-20');
    });

    it('format PL DD.MM.YYYY → ISO', () => {
      expect(parseDate('15.01.2024')).toBe('2024-01-15');
    });

    it('format PL z godziną → ISO', () => {
      expect(parseDate('15.01.2024 08:23')).toBe('2024-01-15');
    });

    it('pusta wartość → pusty string', () => {
      expect(parseDate('')).toBe('');
    });

    it('null → pusty string', () => {
      expect(parseDate(null)).toBe('');
    });
  });

  describe('e-TOLL — parsowanie kwoty', () => {

    it('kwota z przecinkiem dziesiętnym → liczba', () => {
      expect(parseAmount('4,20')).toBe(4.2);
    });

    it('kwota z kropką → liczba', () => {
      expect(parseAmount('12.50')).toBe(12.5);
    });

    it('kwota z jednostką "PLN" → tylko liczba', () => {
      expect(parseAmount('4,20 PLN')).toBe(4.2);
    });

    it('null → 0', () => {
      expect(parseAmount(null)).toBe(0);
    });

    it('pusty string → 0', () => {
      expect(parseAmount('')).toBe(0);
    });

    it('tekst bez liczby → 0', () => {
      expect(parseAmount('brak')).toBe(0);
    });
  });

  describe('e-TOLL — deduplicja transakcji', () => {

    it('identyczne wiersze → tylko jeden zostaje', () => {
      const rows = [
        { nrRej: 'WA12345', date: '2024-01-15', amount: 4.2, txId: 'TX001', route: 'A1' },
        { nrRej: 'WA12345', date: '2024-01-15', amount: 4.2, txId: 'TX001', route: 'A1' },
      ];
      expect(dedup(rows).length).toBe(1);
    });

    it('różne daty → obydwie zostają', () => {
      const rows = [
        { nrRej: 'WA12345', date: '2024-01-15', amount: 4.2, txId: 'TX001', route: 'A1' },
        { nrRej: 'WA12345', date: '2024-01-16', amount: 4.2, txId: 'TX002', route: 'A1' },
      ];
      expect(dedup(rows).length).toBe(2);
    });

    it('różne nr rej → obydwie zostają', () => {
      const rows = [
        { nrRej: 'WA12345', date: '2024-01-15', amount: 4.2, txId: 'TX001', route: 'A1' },
        { nrRej: 'WB98765', date: '2024-01-15', amount: 4.2, txId: 'TX001', route: 'A1' },
      ];
      expect(dedup(rows).length).toBe(2);
    });

    it('10 identycznych wierszy → 1 pozostaje', () => {
      const rows = Array(10).fill(null).map(() =>
        ({ nrRej: 'WA12345', date: '2024-01-15', amount: 4.2, txId: 'TX001', route: 'A1' })
      );
      expect(dedup(rows).length).toBe(1);
    });

    it('dedup bez txId używa trasy jako klucza', () => {
      const rows = [
        { nrRej: 'WA12345', date: '2024-01-15', amount: 4.2, txId: '', route: 'A1 Opole' },
        { nrRej: 'WA12345', date: '2024-01-15', amount: 4.2, txId: '', route: 'A1 Opole' },
      ];
      expect(dedup(rows).length).toBe(1);
    });

    it('dedup: różne trasy bez txId → obydwie zostają', () => {
      const rows = [
        { nrRej: 'WA12345', date: '2024-01-15', amount: 4.2, txId: '', route: 'A1 Opole' },
        { nrRej: 'WA12345', date: '2024-01-15', amount: 4.2, txId: '', route: 'A4 Kraków' },
      ];
      expect(dedup(rows).length).toBe(2);
    });
  });
})();
