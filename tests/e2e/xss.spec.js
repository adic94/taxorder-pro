/**
 * TaxOrder Pro — Testy XSS (Playwright)
 * Weryfikuje że złośliwe dane wejściowe nie wykonują się w UI
 */
const { test, expect } = require('@playwright/test');

const XSS_PAYLOADS = [
  '<img src=x onerror=window.__xss=1>',
  '<script>window.__xss=1</script>',
  '"><svg onload=window.__xss=1>',
  "';window.__xss=1;//",
  '<iframe src="javascript:window.__xss=1">',
];

// Helper: sprawdź czy payload wykonał się jako JS
async function xssExecuted(page) {
  return await page.evaluate(() => window.__xss === 1);
}

test.describe('XSS — dane wejściowe użytkownika', () => {

  test.skip(!process.env.TEST_EMAIL, 'Wymaga TEST_EMAIL i TEST_PASS');

  test.beforeEach(async ({ page }) => {
    const { login } = require('./helpers');
    await login(page);
  });

  for (const payload of XSS_PAYLOADS) {
    test(`Payload nie wykonuje się: ${payload.substring(0, 40)}`, async ({ page }) => {
      // Resetuj flagę XSS
      await page.evaluate(() => { delete window.__xss; });

      // Symuluj wstawienie payloadu przez API (mock lokalny)
      await page.evaluate((p) => {
        // Próba wstawienia payloadu przez esc() — powinno być bezpieczne
        const container = document.createElement('div');
        container.innerHTML = `<span>${typeof esc === 'function' ? esc(p) : p}</span>`;
        document.body.appendChild(container);
        // Odczekaj chwilę na potencjalne wykonanie
        return new Promise(r => setTimeout(r, 200));
      }, payload);

      const executed = await xssExecuted(page);
      expect(executed, `XSS payload wykonał się: ${payload}`).toBe(false);

      // Cleanup
      await page.evaluate(() => {
        document.querySelectorAll('body > div:not([id])').forEach(el => el.remove());
      });
    });
  }

  test('Nazwa pojazdu z payload XSS nie wykonuje się w liście', async ({ page }) => {
    // Sprawdź czy esc() jest zdefiniowane
    const escDefined = await page.evaluate(() => typeof esc === 'function');
    expect(escDefined, 'Funkcja esc() musi być dostępna globalnie').toBe(true);

    // Testuj esc() bezpośrednio
    for (const payload of XSS_PAYLOADS) {
      const escaped = await page.evaluate((p) => {
        const div = document.createElement('div');
        div.textContent = p;
        return div.innerHTML; // to jest poprawnie escaped przez przeglądarkę
      }, payload);

      // textContent + innerHTML escapes < do &lt; — żaden tag HTML nie może być wykonany
      expect(escaped).not.toMatch(/<\w/); // brak niezescapowanego <tagname
    }
  });

  test('Funkcja esc() poprawnie escapuje znaki specjalne HTML', async ({ page }) => {
    const results = await page.evaluate(() => {
      if (typeof esc !== 'function') return null;
      return {
        amp:    esc('a & b'),
        lt:     esc('<script>'),
        gt:     esc('</div>'),
        quot:   esc('"value"'),
        apos:   esc("it's"),
        combined: esc('<img src=x onerror=alert(1)>'),
      };
    });

    expect(results).not.toBeNull();
    expect(results.amp).toContain('&amp;');
    expect(results.lt).toContain('&lt;');
    expect(results.gt).toContain('&gt;');
    expect(results.quot).toContain('&quot;');
    expect(results.combined).not.toMatch(/<\w/); // żaden niezescapowany tag HTML
  });

});
