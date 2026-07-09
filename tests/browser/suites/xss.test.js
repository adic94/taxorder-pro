/**
 * Testy ochrony przed XSS — funkcja esc()
 */
(function () {
  const { describe, it, expect } = window.TaxOrderTests;
  const e = window.esc;

  describe('esc() — ochrona przed XSS', () => {

    it('escapuje < i >', () => {
      expect(e('<script>')).toContain('&lt;');
      expect(e('<script>')).toContain('&gt;');
      expect(e('<script>')).not.toContain('<');
    });

    it('escapuje cudzysłów "', () => {
      expect(e('"alert"')).toContain('&quot;');
      expect(e('"alert"')).not.toContain('"');
    });

    it('escapuje ampersand &', () => {
      expect(e('a&b')).toContain('&amp;');
    });

    it('pełny payload XSS jest escapowany', () => {
      const payload = '<img src=x onerror="alert(1)">';
      const result = e(payload);
      expect(result).not.toContain('<img');
      expect(result).toContain('&lt;img');
      // onerror tekst pozostaje jako nieszkodliwy tekst — tag jest złamany przez escape'owanie <
    });

    it('null → pusty string (brak wyjątku)', () => {
      expect(e(null)).toBe('');
    });

    it('undefined → pusty string (brak wyjątku)', () => {
      expect(e(undefined)).toBe('');
    });

    it('liczba → string bez zmian', () => {
      expect(e(42)).toBe('42');
    });

    it('bezpieczny tekst → bez zmian', () => {
      expect(e('Normalny tekst 123')).toBe('Normalny tekst 123');
    });

    it('wielokrotne escapowanie nie podwaja encji', () => {
      const once = e('<b>');
      const twice = e(once);
      expect(twice).toContain('&amp;lt;');
    });
  });
})();
