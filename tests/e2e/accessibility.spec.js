/**
 * Smoke test WCAG for the main authenticated workspace.
 * It reports all findings, but blocks releases only on critical violations.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { login } = require('./helpers');

const hasTestAuth = Boolean(
  process.env.TEST_TOKEN
  || (process.env.TEST_EMAIL && process.env.TEST_PASS)
);

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(ch => ch + ch).join('') : clean;
  const num = Number.parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function parseRgb(value) {
  if (!value || value === 'rgba(0, 0, 0, 0)') return null;
  if (value.startsWith('#')) return hexToRgb(value);
  const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return null;
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
}

function luminance({ r, g, b }) {
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(fg, bg) {
  const a = parseRgb(fg);
  const b = parseRgb(bg);
  if (!a || !b) return null;
  const L1 = luminance(a);
  const L2 = luminance(b);
  const light = Math.max(L1, L2);
  const dark = Math.min(L1, L2);
  return (light + 0.05) / (dark + 0.05);
}

test.describe('Dostępność interfejsu', () => {
  test('kokpit nie ma krytycznych naruszeń axe', async ({ page }) => {
    test.skip(!hasTestAuth, 'Wymaga TEST_TOKEN albo TEST_EMAIL i TEST_PASS');
    await login(page);
    await page.waitForSelector('#page-dash', { state: 'visible', timeout: 10_000 });

    const axeSource = fs.readFileSync(
      path.join(__dirname, '..', '..', 'node_modules', 'axe-core', 'axe.min.js'),
      'utf8',
    );
    await page.evaluate(axeSource);
    const result = await page.evaluate(async () => window.axe.run(document, {
      resultTypes: ['violations', 'incomplete'],
    }));

    const reportDir = path.join(__dirname, '..', 'results');
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(
      path.join(reportDir, 'axe-dashboard.json'),
      JSON.stringify(result, null, 2),
      'utf8',
    );

    const critical = result.violations.filter(v => v.impact === 'critical');
    expect(critical, critical.map(v => `${v.id}: ${v.help}`).join('\n')).toHaveLength(0);
  });

  test('klawiatura porusza fokus po elementach interaktywnych', async ({ page }) => {
    test.skip(!hasTestAuth, 'Wymaga TEST_TOKEN albo TEST_EMAIL i TEST_PASS');
    await login(page);
    await page.waitForSelector('#page-dash', { state: 'visible', timeout: 10_000 });

    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? { tag: el.tagName, role: el.getAttribute('role'), text: (el.textContent || '').trim().slice(0, 30) } : null;
    });

    expect(active).not.toBeNull();
    expect(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(active.tag);
  });

  test('główne przyciski mają kontrast i rozmiar touch target', async ({ page }) => {
    test.skip(!hasTestAuth, 'Wymaga TEST_TOKEN albo TEST_EMAIL i TEST_PASS');
    await login(page);
    await page.waitForSelector('#page-dash', { state: 'visible', timeout: 10_000 });

    const report = await page.evaluate(() => {
      const elements = [...document.querySelectorAll('button, .btn, .tnb, a[href]')].slice(0, 12);
      const ratios = [];
      let minSize = Number.POSITIVE_INFINITY;

      for (const el of elements) {
        const style = getComputedStyle(el);
        const fg = style.color;
        const bg = style.backgroundColor || 'rgb(255,255,255)';
        const ratio = (() => {
          const parse = (value) => {
            if (!value || value === 'rgba(0, 0, 0, 0)') return null;
            if (value.startsWith('#')) {
              const hex = value.slice(1);
              const full = hex.length === 3 ? hex.split('').map(ch => ch + ch).join('') : hex;
              const num = Number.parseInt(full, 16);
              return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
            }
            const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
            if (!m) return null;
            return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
          };
          const lum = (c) => {
            const s = c / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          const al = parse(fg); const bl = parse(bg);
          if (!al || !bl) return null;
          const L1 = 0.2126 * lum(al.r) + 0.7152 * lum(al.g) + 0.0722 * lum(al.b);
          const L2 = 0.2126 * lum(bl.r) + 0.7152 * lum(bl.g) + 0.0722 * lum(bl.b);
          const light = Math.max(L1, L2);
          const dark = Math.min(L1, L2);
          return (light + 0.05) / (dark + 0.05);
        })();
        if (ratio !== null) ratios.push({ ratio, tag: el.tagName });
        const rect = el.getBoundingClientRect();
        minSize = Math.min(minSize, rect.width, rect.height);
      }

      return { ratios, minSize };
    });

    const weakContrast = report.ratios.filter(item => item.ratio < 4.5);
    expect(weakContrast, `Niskie kontrasty: ${JSON.stringify(weakContrast)}`).toHaveLength(0);
    expect(report.minSize, `Najmniejszy touch target: ${report.minSize}px`).toBeGreaterThanOrEqual(44);
  });
});
