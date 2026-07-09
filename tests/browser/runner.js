/**
 * TaxOrder Pro — In-Browser Test Runner
 * Uruchom: otwórz tests/browser/index.html w przeglądarce
 * Nie wymaga Node.js ani żadnych zewnętrznych zależności.
 */
(function () {
  'use strict';

  const suites = [];
  let _cur = null;

  function describe(name, fn) {
    _cur = { name, tests: [] };
    suites.push(_cur);
    try { fn(); } catch (e) { _cur.setupError = e.message; }
    _cur = null;
  }

  function it(name, fn) {
    if (!_cur) throw new Error('it() wywołane poza describe()');
    _cur.tests.push({ name, fn });
  }

  function expect(actual) {
    const fail = msg => { throw new Error(msg); };
    const fmt = v => v === null ? 'null' : v === undefined ? 'undefined' : JSON.stringify(v);
    return {
      toBe:          (e) => { if (actual !== e) fail(`Oczekiwano ${fmt(e)}, otrzymano ${fmt(actual)}`); },
      toEqual:       (e) => { if (JSON.stringify(actual) !== JSON.stringify(e)) fail(`Oczekiwano ${fmt(e)}, otrzymano ${fmt(actual)}`); },
      toBeTruthy:    ()  => { if (!actual) fail(`Oczekiwano wartości truthy, otrzymano ${fmt(actual)}`); },
      toBeFalsy:     ()  => { if (actual)  fail(`Oczekiwano wartości falsy, otrzymano ${fmt(actual)}`); },
      toBeNull:      ()  => { if (actual !== null) fail(`Oczekiwano null, otrzymano ${fmt(actual)}`); },
      toBeUndefined: ()  => { if (actual !== undefined) fail(`Oczekiwano undefined, otrzymano ${fmt(actual)}`); },
      toBeGreaterThan: (n) => { if (actual <= n) fail(`Oczekiwano ${fmt(actual)} > ${n}`); },
      toBeLessThan:    (n) => { if (actual >= n) fail(`Oczekiwano ${fmt(actual)} < ${n}`); },
      toBeGreaterThanOrEqual: (n) => { if (actual < n) fail(`Oczekiwano ${fmt(actual)} >= ${n}`); },
      toContain:     (s) => { if (!String(actual).includes(s)) fail(`Oczekiwano że "${actual}" zawiera "${s}"`); },
      toMatch:       (r) => { if (!r.test(actual)) fail(`Oczekiwano że "${actual}" pasuje do ${r}`); },
      not: {
        toBe:       (e) => { if (actual === e) fail(`Nie oczekiwano ${fmt(e)}`); },
        toBeNull:   ()  => { if (actual === null) fail('Nie oczekiwano null'); },
        toContain:  (s) => { if (String(actual).includes(s)) fail(`Oczekiwano że "${actual}" NIE zawiera "${s}"`); },
        toBeTruthy: ()  => { if (actual) fail(`Oczekiwano wartości falsy`); },
      },
    };
  }

  async function run(targetId = 'test-results') {
    const el = document.getElementById(targetId);
    if (!el) { console.error('[TestRunner] Brak elementu #' + targetId); return; }

    let totalPass = 0, totalFail = 0, totalSkip = 0;
    const blocks = [];

    for (const suite of suites) {
      const rows = [];
      if (suite.setupError) {
        rows.push(`<tr><td colspan="3" style="color:var(--red);padding:8px 12px">⚠ Błąd inicjalizacji: ${suite.setupError}</td></tr>`);
        totalFail++;
        continue;
      }
      for (const test of suite.tests) {
        try {
          const result = test.fn();
          if (result && typeof result.then === 'function') await result;
          totalPass++;
          rows.push(_row('✓', test.name, 'pass', ''));
        } catch (e) {
          totalFail++;
          rows.push(_row('✗', test.name, 'fail', e.message));
        }
      }
      blocks.push(`
        <div class="dash-card" style="margin-bottom:1rem">
          <div class="dash-card-hdr" style="font-size:13px">
            <i class="ti ti-test-pipe" style="color:var(--blue)"></i>${suite.name}
            <span style="margin-left:auto;font-size:11px;color:var(--text3)">${suite.tests.length} testów</span>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <tbody>${rows.join('')}</tbody>
          </table>
        </div>`);
    }

    const allGood = totalFail === 0;
    el.innerHTML = `
      <div style="display:flex;gap:10px;margin-bottom:1.5rem;flex-wrap:wrap">
        <div class="fkpi-card ${allGood ? '' : 'fkpi-red'}" style="flex:1;min-width:120px">
          <div class="fkpi-val">${totalPass + totalFail}</div>
          <div class="fkpi-lab">Testów razem</div>
        </div>
        <div class="fkpi-card" style="flex:1;min-width:120px;border-color:var(--green);background:rgba(16,185,129,.05)">
          <div class="fkpi-val" style="color:var(--green)">${totalPass}</div>
          <div class="fkpi-lab">PASS</div>
        </div>
        <div class="fkpi-card ${totalFail > 0 ? 'fkpi-red' : ''}" style="flex:1;min-width:120px">
          <div class="fkpi-val" style="color:${totalFail > 0 ? 'var(--red)' : 'var(--text3)'}">${totalFail}</div>
          <div class="fkpi-lab">FAIL</div>
        </div>
      </div>
      <div style="font-size:13px;font-weight:600;margin-bottom:1rem;color:${allGood ? 'var(--green)' : 'var(--red)'}">
        ${allGood ? '✓ Wszystkie testy zdane' : `✗ ${totalFail} test(ów) nie zdało`}
      </div>
      ${blocks.join('')}`;
    console.log(`[TestRunner] ${totalPass} PASS / ${totalFail} FAIL`);
    return { pass: totalPass, fail: totalFail };
  }

  function _row(icon, name, cls, msg) {
    const color = cls === 'pass' ? 'var(--green)' : 'var(--red)';
    return `<tr style="border-top:1px solid var(--border)">
      <td style="padding:6px 12px;color:${color};width:20px;font-size:14px">${icon}</td>
      <td style="padding:6px 12px">${name}</td>
      <td style="padding:6px 12px;font-size:11px;color:var(--red);word-break:break-all">${msg}</td>
    </tr>`;
  }

  window.TaxOrderTests = { describe, it, expect, run };
})();
