// ==================== STAWKI DT-1 PER GMINA ====================
// Obsługuje różne stawki podatku od środków transportu dla każdej gminy w Polsce

window.GminyRates = (function () {

  const LS_KEY = 'taxGminyRates';

  // Kompletny schemat stawek — każdy klucz odpowiada jednej gałęzi calcTax()
  const SCHEMA = [
    // Autobusy
    { key:'bus_any_new',    label:'Autobus (rok≥2024)',                  cat:'D6/D7', default:1320 },
    { key:'bus_lt30',       label:'Autobus < 30 miejsc (starsze)',        cat:'D6',    default:1488 },
    { key:'bus_ge30',       label:'Autobus ≥ 30 miejsc (starsze)',        cat:'D7',    default:1872 },
    // Naczepy/Przyczepy 7–12t
    { key:'tr_7_12_new',    label:'Naczepa/Przyczepa 7–12t (rok≥2024)',  cat:'D5',    default:1128 },
    { key:'tr_7_12_old',    label:'Naczepa/Przyczepa 7–12t (starsze)',   cat:'D5',    default:1248 },
    // Naczepy ≥12t — 1 oś (D13)
    { key:'tr_1ax_lt18',    label:'Naczepa ≥12t, 1oś, 12–18t',          cat:'D13',   default:744  },
    { key:'tr_1ax_18_25',   label:'Naczepa ≥12t, 1oś, 18–25t',          cat:'D13',   default:840  },
    { key:'tr_1ax_25_36',   label:'Naczepa ≥12t, 1oś, 25–36t',          cat:'D13',   default:984  },
    { key:'tr_1ax_gt36',    label:'Naczepa ≥12t, 1oś, >36t',            cat:'D13',   default:1128 },
    // Naczepy ≥12t — 2 osie (D14)
    { key:'tr_2ax_lt28',    label:'Naczepa ≥12t, 2osie, 12–28t',        cat:'D14',   default:1488 },
    { key:'tr_2ax_28_33',   label:'Naczepa ≥12t, 2osie, 28–33t',        cat:'D14',   default:1776 },
    { key:'tr_2ax_33_38',   label:'Naczepa ≥12t, 2osie, 33–38t',        cat:'D14',   default:2256 },
    { key:'tr_2ax_ge38',    label:'Naczepa ≥12t, 2osie, ≥38t',          cat:'D14',   default:2976 },
    // Naczepy ≥12t — 3+ osie (D15)
    { key:'tr_3ax_le36',    label:'Naczepa ≥12t, 3+osie, ≤36t',         cat:'D15',   default:1872 },
    { key:'tr_3ax_36_38',   label:'Naczepa ≥12t, 3+osie, 36–38t',       cat:'D15',   default:2040 },
    { key:'tr_3ax_ge38',    label:'Naczepa ≥12t, 3+osie, ≥38t',         cat:'D15',   default:2232 },
    // Ciągniki siodłowe 3,5–12t (D4)
    { key:'ct_lt12_new',    label:'Ciągnik 3,5–12t (rok≥2024)',          cat:'D4',    default:1248 },
    { key:'ct_lt12_old',    label:'Ciągnik 3,5–12t (starsze)',           cat:'D4',    default:1392 },
    // Ciągniki siodłowe ≥12t — 2 osie (D11)
    { key:'ct_2ax_lt18',    label:'Ciągnik ≥12t, 2osie, 12–18t',        cat:'D11',   default:1128 },
    { key:'ct_2ax_18_25',   label:'Ciągnik ≥12t, 2osie, 18–25t',        cat:'D11',   default:1680 },
    { key:'ct_2ax_25_31',   label:'Ciągnik ≥12t, 2osie, 25–31t',        cat:'D11',   default:2232 },
    { key:'ct_2ax_31_36',   label:'Ciągnik ≥12t, 2osie, 31–36t',        cat:'D11',   default:3384 },
    { key:'ct_2ax_gt36',    label:'Ciągnik ≥12t, 2osie, >36t',          cat:'D11',   default:3384 },
    // Ciągniki siodłowe ≥12t — 3+ osie (D12)
    { key:'ct_3ax_le36',    label:'Ciągnik ≥12t, 3+osie, ≤36t',         cat:'D12',   default:2784 },
    { key:'ct_3ax_36_40',   label:'Ciągnik ≥12t, 3+osie, 36–40t',       cat:'D12',   default:2832 },
    { key:'ct_3ax_ge40',    label:'Ciągnik ≥12t, 3+osie, ≥40t',         cat:'D12',   default:4200 },
    // Samochody ciężarowe 3,5–12t
    { key:'car_lt55_new',   label:'Sam.cięż. 3,5–5,5t (rok≥2024)',      cat:'D1',    default:744  },
    { key:'car_lt55_old',   label:'Sam.cięż. 3,5–5,5t (starsze)',       cat:'D1',    default:840  },
    { key:'car_55_90_new',  label:'Sam.cięż. 5,5–9t (rok≥2024)',        cat:'D2',    default:1008 },
    { key:'car_55_90_old',  label:'Sam.cięż. 5,5–9t (starsze)',         cat:'D2',    default:1128 },
    { key:'car_90_12_new',  label:'Sam.cięż. 9–12t (rok≥2024)',         cat:'D3',    default:1344 },
    { key:'car_90_12_old',  label:'Sam.cięż. 9–12t (starsze)',          cat:'D3',    default:1488 },
    // Sam. ciężarowe ≥12t — 2 osie (D8)
    { key:'car_2ax_lt13',   label:'Sam.cięż. ≥12t, 2osie, 12–13t',     cat:'D8',    default:1200 },
    { key:'car_2ax_13_14',  label:'Sam.cięż. ≥12t, 2osie, 13–14t',     cat:'D8',    default:1488 },
    { key:'car_2ax_14_15',  label:'Sam.cięż. ≥12t, 2osie, 14–15t',     cat:'D8',    default:1680 },
    { key:'car_2ax_ge15',   label:'Sam.cięż. ≥12t, 2osie, ≥15t',       cat:'D8',    default:2184 },
    // Sam. ciężarowe ≥12t — 3 osie (D9)
    { key:'car_3ax_lt17',   label:'Sam.cięż. ≥12t, 3osie, 12–17t',     cat:'D9',    default:1488 },
    { key:'car_3ax_17_19',  label:'Sam.cięż. ≥12t, 3osie, 17–19t',     cat:'D9',    default:1704 },
    { key:'car_3ax_19_21',  label:'Sam.cięż. ≥12t, 3osie, 19–21t',     cat:'D9',    default:1872 },
    { key:'car_3ax_21_23',  label:'Sam.cięż. ≥12t, 3osie, 21–23t',     cat:'D9',    default:2136 },
    { key:'car_3ax_ge23',   label:'Sam.cięż. ≥12t, 3osie, ≥23t',       cat:'D9',    default:2760 },
    // Sam. ciężarowe ≥12t — 4+ osie (D10)
    { key:'car_4ax_lt25',   label:'Sam.cięż. ≥12t, 4+osie, 12–25t',    cat:'D10',   default:1488 },
    { key:'car_4ax_25_27',  label:'Sam.cięż. ≥12t, 4+osie, 25–27t',    cat:'D10',   default:1824 },
    { key:'car_4ax_27_29',  label:'Sam.cięż. ≥12t, 4+osie, 27–29t',    cat:'D10',   default:2880 },
    { key:'car_4ax_ge29',   label:'Sam.cięż. ≥12t, 4+osie, ≥29t',      cat:'D10',   default:4296 },
  ];

  const SCHEMA_MAP = Object.fromEntries(SCHEMA.map(s => [s.key, s]));
  const WARSZAWA_DEFAULTS = Object.fromEntries(SCHEMA.map(s => [s.key, s.default]));

  // ── URZĘDY PODATKOWE PER GMINA ──────────────────────────────────────────
  //
  // Pole 5 deklaracji DT-1 ("Nazwa i adres siedziby organu podatkowego") ma
  // wynikać z gminy, w której zarejestrowana jest siedziba podatnika — NIE
  // z nazwy spółki ani z dzielnicy wpisanej ręcznie przy zakładaniu firmy
  // w tym programie. Dla Warszawy adres jest SCENTRALIZOWANY — każda
  // dzielnica składa DT-1 w to samo miejsce — co potwierdza wzorcowa
  // deklaracja pobrana z systemu Moja Warszawa 01.09.2026:
  // „PREZYDENT M.ST. WARSZAWY, CENTRUM OBSŁUGI PODATNIKA UL. OBOZOWA 57
  // 01-161 WARSZAWA". Wcześniej `COMPANIES` w app.js miało dla różnych
  // spółek różne „Dzielnica Białołęka" / „Dzielnica Rembertów" itd. —
  // to było błędne dla podatku od środków transportowych (deklaracja idzie
  // do jednego centralnego punktu, nie do urzędu dzielnicy).
  //
  // Adresy innych gmin CELOWO nie są tu wpisane, dopóki nie zostaną
  // zweryfikowane u źródła — ta sama zasada co przy `LIMITY_USTAWOWE`
  // i gęstościach paliw w opłacie środowiskowej: brak danych nie jest
  // zerem, jest brakiem danych. `getUrzad()` zwraca `null`, gdy gminy nie
  // ma w słowniku — wywołujący ma wtedy spaść na ręczny wpis, a nie zgadnąć
  // adres.
  const URZEDY_GMIN = {
    'Warszawa': 'PREZYDENT M.ST. WARSZAWY, CENTRUM OBSŁUGI PODATNIKA, UL. OBOZOWA 57, 01-161 WARSZAWA',
  };

  const URZEDY_GMIN_LC = Object.fromEntries(Object.entries(URZEDY_GMIN).map(([k, v]) => [k.toLowerCase(), v]));

  function getUrzad(gmina) {
    if (!gmina) return null;
    return URZEDY_GMIN_LC[String(gmina).trim().toLowerCase()] || null;
  }

  // ── WIDEŁKI USTAWOWE ────────────────────────────────────────────────────────
  //
  // Rada gminy NIE uchwala stawki dowolnie — uchwala ją w widełkach, i to
  // DWUSTRONNYCH:
  //   • górna granica dotyczy WSZYSTKICH środków transportowych i wynika
  //     z obwieszczenia Ministra Finansów (waloryzacja, Monitor Polski);
  //   • stawka MINIMALNA dotyczy WYŁĄCZNIE pojazdów od 12 t i wynika
  //     z załączników do ustawy o podatkach i opłatach lokalnych, również
  //     waloryzowanych obwieszczeniem MF. Bierze się stąd, że stawki dla
  //     ciężkiego transportu są związane prawem unijnym, więc gmina nie może
  //     ich dowolnie obniżyć.
  //
  // Ta flota ma 28 pojazdów od 12 t — czyli dolne ograniczenie jej dotyczy,
  // i to przy pozycjach o najwyższych kwotach (do 4 296 zł).
  //
  // ⛔ `widelki` JEST CELOWO PUSTE. Kwot nie ma, bo nie zostały odczytane ze
  // źródła — a wpisanie ich z pamięci dałoby kontrolę, która wygląda na
  // działającą i przepuszcza błędne stawki. Do czasu odczytu `sprawdzWidelki()`
  // ODMAWIA orzeczenia (`ok: false`), zamiast zwracać zielone światło.
  // Ta sama zasada co przy gęstościach paliw w `ENV_FEE_RATE_SETS`.
  //
  // Uzupełniając: obwieszczenie MF publikowane jest w Monitorze Polskim, więc
  // pobiera się je tym samym wzorcem co inne akty — patrz `.claude/commands/`,
  // polecenie `/akt-prawny`. Każdy zestaw musi nieść `zrodlo` z rokiem i pozycją.
  const LIMITY_USTAWOWE = [
    {
      rok: 2026,
      zrodlo: '',   // do wypełnienia: obwieszczenie MF, M.P. rok/pozycja + adres PDF
      // klucz SCHEMA -> { max: <zł>, min: <zł albo null gdy ustawa nie określa> }
      widelki: {},
    },
  ];

  function limityDlaRoku(rok) {
    const y = Number(rok) || new Date().getFullYear();
    return LIMITY_USTAWOWE.find(l => Number(l.rok) === y) || null;
  }

  /**
   * Czy stawki gminy mieszczą się w widełkach ustawowych.
   *
   * BRAK DANYCH TO NIE JEST ZGODNOŚĆ. Pozycja bez widełek trafia na listę
   * `nieustalone`, a `ok` wymaga pustych OBU list — inaczej wynik „ok: true"
   * przy pustej tablicy limitów oznaczałby, że każda stawka jest legalna.
   */
  function sprawdzWidelki(stawki, rok) {
    const zestaw = limityDlaRoku(rok);
    if (!zestaw || !zestaw.zrodlo) {
      return { ok: false, powod: 'BRAK_LIMITOW', rok: Number(rok) || null,
        opis: 'Brak odczytanych widełek ustawowych dla tego roku. Górne granice ogłasza '
            + 'obwieszczenie Ministra Finansów (Monitor Polski), a stawki minimalne dla '
            + 'pojazdów od 12 t wynikają z załączników do ustawy. Bez nich nie da się '
            + 'orzec, czy stawka gminy jest zgodna z prawem.',
        naruszenia: [], nieustalone: [] };
    }
    const naruszenia = [], nieustalone = [];
    for (const [key, kwota] of Object.entries(stawki || {})) {
      const w = zestaw.widelki[key];
      if (!w) { nieustalone.push({ key, powod: 'brak widełek dla tej pozycji' }); continue; }
      const k = Number(kwota);
      if (!Number.isFinite(k)) { nieustalone.push({ key, powod: 'stawka nie jest liczbą' }); continue; }
      // `??` a nie `||` — limit równy 0 jest wartością, nie brakiem.
      const max = w.max ?? null, min = w.min ?? null;
      if (max !== null && k > max) naruszenia.push({ key, kwota: k, limit: max, rodzaj: 'powyżej maksimum ustawowego' });
      if (min !== null && k < min) naruszenia.push({ key, kwota: k, limit: min, rodzaj: 'poniżej minimum ustawowego (pojazd od 12 t)' });
    }
    return { ok: naruszenia.length === 0 && nieustalone.length === 0,
      rok: zestaw.rok, zrodlo: zestaw.zrodlo, naruszenia, nieustalone };
  }


  // ── Persistence ──────────────────────────────────────────────────────────

  function _load() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
  }
  // Uwaga: nie wolno nazwać tej funkcji _save — niżej jest _save(name) eksportowane do UI
  function _persist(data) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[GminyRates] Nie można zapisać stawek do localStorage (quota?):', e.message);
      if (typeof toast === 'function') toast('⚠ Nie udało się zapisać stawek — pamięć przeglądarki pełna');
    }
  }

  function listGminy() {
    return ['Warszawa', ...Object.keys(_load())];
  }

  function getGminaRates(name) {
    if (!name || name === 'Warszawa') return { ...WARSZAWA_DEFAULTS };
    const data = _load();
    if (!data[name]) return { ...WARSZAWA_DEFAULTS };
    return { ...WARSZAWA_DEFAULTS, ...data[name] };
  }

  function saveGminaRates(name, rates) {
    if (!name || name === 'Warszawa') return;
    // Kontrola OSTRZEGA, nie blokuje: dopóki widełki nie są odczytane, blokada
    // uniemożliwiłaby dodanie jakiejkolwiek gminy. Gdy kwoty się pojawią, to jest
    // miejsce, w którym błędna stawka wchodzi do systemu — literówka `2280`
    // zamiast `2880` daje deklarację wyglądającą wiarygodnie i niezgodną z prawem.
    const kontrola = sprawdzWidelki(rates, new Date().getFullYear());
    if (kontrola.naruszenia.length) {
      const opis = kontrola.naruszenia
        .map(n => `${n.key}: ${n.kwota} zł ${n.rodzaj} (${n.limit} zł)`).join('; ');
      console.warn(`[GminyRates] Stawki gminy ${name} poza widełkami ustawowymi — ${opis}`);
      if (typeof toast === 'function') toast(`⚠ ${kontrola.naruszenia.length} stawek poza widełkami ustawowymi — sprawdź przed złożeniem deklaracji`);
    }
    const data = _load();
    data[name] = rates;
    _persist(data);
  }

  function deleteGmina(name) {
    if (!name || name === 'Warszawa') return;
    const data = _load();
    delete data[name];
    _persist(data);
  }

  function copyFrom(targetName, sourceName) {
    const src = getGminaRates(sourceName);
    saveGminaRates(targetName, { ...src });
  }

  // ── Rate key lookup — mirrors every branch of app.js getRate() ───────────

  function getRateKey(v) {
    if (!v) return null;
    const dT   = (parseFloat(v.dmc ?? v.dmcMax) || 0) / 1000;
    const dzT  = (parseFloat(v.dmcZespolu) || 0) / 1000;
    const refZ = dzT > 0 ? dzT : dT;
    const typ  = (v.typ || '').toLowerCase();
    const osie = parseInt(v.osie) || 2;
    const isNew = (parseInt(v.rok) || 0) >= 2024;

    if (typ.includes('specjaln') || (v.przeznaczenie || '').toLowerCase().includes('specjaln')) return null;

    if (typ.includes('autobus')) {
      if (isNew) return 'bus_any_new';
      return (parseInt(v.miejsca) || 0) < 30 ? 'bus_lt30' : 'bus_ge30';
    }

    if (typ.includes('naczepa') || typ.includes('przyczepa')) {
      if (refZ >= 7 && refZ < 12) return isNew ? 'tr_7_12_new' : 'tr_7_12_old';
      if (refZ >= 12) {
        if (osie === 1) {
          if (refZ < 18)  return 'tr_1ax_lt18';
          if (refZ < 25)  return 'tr_1ax_18_25';
          if (refZ <= 36) return 'tr_1ax_25_36';
          return 'tr_1ax_gt36';
        }
        if (osie === 2) {
          if (refZ < 28)  return 'tr_2ax_lt28';
          if (refZ < 33)  return 'tr_2ax_28_33';
          if (refZ < 38)  return 'tr_2ax_33_38';
          return 'tr_2ax_ge38';
        }
        if (refZ <= 36) return 'tr_3ax_le36';
        if (refZ < 38)  return 'tr_3ax_36_38';
        return 'tr_3ax_ge38';
      }
      return null;
    }

    if (typ.includes('ciągnik') || typ.includes('ciagnik')) {
      if (refZ >= 3.5 && refZ < 12) return isNew ? 'ct_lt12_new' : 'ct_lt12_old';
      if (refZ >= 12) {
        if (osie <= 2) {
          if (refZ < 18)  return 'ct_2ax_lt18';
          if (refZ < 25)  return 'ct_2ax_18_25';
          if (refZ < 31)  return 'ct_2ax_25_31';
          if (refZ <= 36) return 'ct_2ax_31_36';
          return 'ct_2ax_gt36';
        }
        if (refZ <= 36) return 'ct_3ax_le36';
        if (refZ < 40)  return 'ct_3ax_36_40';
        return 'ct_3ax_ge40';
      }
      return null;
    }

    // Samochód ciężarowy
    if (dT <= 3.5) return null;
    if (dT < 12) {
      if (isNew) {
        if (dT <= 5.5) return 'car_lt55_new';
        if (dT <= 9)   return 'car_55_90_new';
        return 'car_90_12_new';
      }
      if (dT <= 5.5) return 'car_lt55_old';
      if (dT <= 9)   return 'car_55_90_old';
      return 'car_90_12_old';
    }
    if (osie === 2) {
      if (dT < 13) return 'car_2ax_lt13';
      if (dT < 14) return 'car_2ax_13_14';
      if (dT < 15) return 'car_2ax_14_15';
      return 'car_2ax_ge15';
    }
    if (osie === 3) {
      if (dT < 17) return 'car_3ax_lt17';
      if (dT < 19) return 'car_3ax_17_19';
      if (dT < 21) return 'car_3ax_19_21';
      if (dT < 23) return 'car_3ax_21_23';
      return 'car_3ax_ge23';
    }
    if (dT < 25) return 'car_4ax_lt25';
    if (dT < 27) return 'car_4ax_25_27';
    if (dT < 29) return 'car_4ax_27_29';
    return 'car_4ax_ge29';
  }

  function getGminaRate(v) {
    const key = getRateKey(v);
    if (!key) return null;
    const rates = getGminaRates(v.gmina || 'Warszawa');
    const val = rates[key];
    return val != null ? val : null;
  }

  // ── Modal UI ──────────────────────────────────────────────────────────────

  const GROUPS = [
    { label: 'Autobusy',                              keys: ['bus_any_new','bus_lt30','bus_ge30'] },
    { label: 'Naczepy/Przyczepy 7–12t (D5)',          keys: ['tr_7_12_new','tr_7_12_old'] },
    { label: 'Naczepy/Przyczepy ≥12t — 1 oś (D13)',  keys: ['tr_1ax_lt18','tr_1ax_18_25','tr_1ax_25_36','tr_1ax_gt36'] },
    { label: 'Naczepy/Przyczepy ≥12t — 2 osie (D14)', keys: ['tr_2ax_lt28','tr_2ax_28_33','tr_2ax_33_38','tr_2ax_ge38'] },
    { label: 'Naczepy/Przyczepy ≥12t — 3+ osie (D15)', keys: ['tr_3ax_le36','tr_3ax_36_38','tr_3ax_ge38'] },
    { label: 'Ciągniki siodłowe 3,5–12t (D4)',        keys: ['ct_lt12_new','ct_lt12_old'] },
    { label: 'Ciągniki siodłowe ≥12t — 2 osie (D11)', keys: ['ct_2ax_lt18','ct_2ax_18_25','ct_2ax_25_31','ct_2ax_31_36','ct_2ax_gt36'] },
    { label: 'Ciągniki siodłowe ≥12t — 3+ osie (D12)', keys: ['ct_3ax_le36','ct_3ax_36_40','ct_3ax_ge40'] },
    { label: 'Samochody ciężarowe 3,5–12t',            keys: ['car_lt55_new','car_lt55_old','car_55_90_new','car_55_90_old','car_90_12_new','car_90_12_old'] },
    { label: 'Sam. ciężarowe ≥12t — 2 osie (D8)',     keys: ['car_2ax_lt13','car_2ax_13_14','car_2ax_14_15','car_2ax_ge15'] },
    { label: 'Sam. ciężarowe ≥12t — 3 osie (D9)',     keys: ['car_3ax_lt17','car_3ax_17_19','car_3ax_19_21','car_3ax_21_23','car_3ax_ge23'] },
    { label: 'Sam. ciężarowe ≥12t — 4+ osie (D10)',   keys: ['car_4ax_lt25','car_4ax_25_27','car_4ax_27_29','car_4ax_ge29'] },
  ];

  function openModal(editGmina) {
    let modal = document.getElementById('gminy-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'gminy-modal';
    modal.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;align-items:flex-start;justify-content:center;padding:40px 16px 40px;overflow-y:auto';
    modal.innerHTML = _buildHtml(editGmina || null);
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  function _buildHtml(editGmina) {
    const gminy   = listGminy();
    const editing = editGmina ? getGminaRates(editGmina) : null;

    const gminyRows = gminy.map(g => `
      <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
        <i class="ti ti-map-pin" style="color:var(--blue);font-size:14px"></i>
        <span style="flex:1;font-weight:600;font-size:13px">${esc(g)}</span>
        ${g === 'Warszawa'
          ? '<span style="font-size:11px;color:var(--text3)">wbudowane (Warszawa 2026, uchwała XXIX/1065/2025)</span>'
          : `<button class="btn btn-gray" style="font-size:11px" data-gmina="${esc(g)}" onclick="GminyRates.openModal(this.dataset.gmina)"><i class="ti ti-pencil"></i>${t('btn.edit')}</button>
             <button class="btn btn-red" style="font-size:11px" data-gmina="${esc(g)}" onclick="GminyRates._del(this.dataset.gmina)"><i class="ti ti-trash"></i></button>`
        }
      </div>`).join('');

    const rateEditor = !editing ? '' : GROUPS.map(g => `
      <div style="margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--border)">${g.label}</div>
        ${g.keys.map(k => {
          const s = SCHEMA_MAP[k]; if (!s) return '';
          const val = editing[k] ?? s.default;
          return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
            <label style="flex:1;font-size:12px;color:var(--text)">${s.label}</label>
            <input type="number" id="gr-${k}" value="${val}" min="0" style="width:88px;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:12px;text-align:right">
            <span style="font-size:11px;color:var(--text3);width:18px">zł</span>
            <button class="btn btn-gray" title="${t('gminy.restore.default')}" style="font-size:10px;padding:2px 7px;min-width:24px" onclick="document.getElementById('gr-${k}').value=${s.default}">W</button>
          </div>`;
        }).join('')}
      </div>`).join('');

    return `
      <div style="background:var(--bg);border-radius:var(--radius-lg);padding:24px 28px;width:660px;max-width:97vw;box-shadow:0 8px 48px rgba(0,0,0,.4)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <i class="ti ti-map-pin" style="color:var(--blue);font-size:18px"></i>
          <span style="font-size:17px;font-weight:700">${editing ? `${t('gminy.edit.title')} ${editGmina}` : t('gminy.title')}</span>
          <button onclick="document.getElementById('gminy-modal').remove()" style="margin-left:auto;background:none;border:none;font-size:22px;cursor:pointer;color:var(--text3);line-height:1">×</button>
        </div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:20px">
          ${editing ? 'Edytuj stawki dla tej gminy. Przycisk <b>W</b> przywraca stawkę Warszawa 2026.' : 'Każda gmina może mieć własne stawki (do maksimum wg obwieszczenia MF). Dodaj swoją gminę i ustaw stawki.'}
        </div>

        ${editing ? `
          <div style="max-height:65vh;overflow-y:auto;padding-right:6px">${rateEditor}</div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-green" data-gmina="${esc(editGmina)}" onclick="GminyRates._save(this.dataset.gmina)" style="flex:1;justify-content:center"><i class="ti ti-check"></i>${t('btn.save')} — ${esc(editGmina)}</button>
            <button class="btn btn-gray" onclick="GminyRates.openModal()"><i class="ti ti-list"></i>${t('gminy.title')}</button>
          </div>
        ` : `
          <div style="margin-bottom:20px">${gminyRows}</div>
          <div style="background:var(--bg2);border-radius:var(--radius);padding:14px">
            <div style="font-size:13px;font-weight:600;margin-bottom:10px"><i class="ti ti-plus"></i> Dodaj gminę</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <input type="text" id="new-gmina-name" placeholder="Nazwa gminy (np. Kraków)" style="flex:1;min-width:160px;padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px">
              <label style="font-size:12px;color:var(--text2);align-self:center">${t('gminy.copy.from')}</label>
              <select id="new-gmina-src" style="padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px">
                ${gminy.map(g => `<option>${g}</option>`).join('')}
              </select>
              <button class="btn btn-blue" onclick="GminyRates._add()"><i class="ti ti-plus"></i>${t('btn.add')}</button>
            </div>
          </div>
        `}
      </div>`;
  }

  function _add() {
    const name = (document.getElementById('new-gmina-name')?.value || '').trim();
    const src  = document.getElementById('new-gmina-src')?.value || 'Warszawa';
    if (!name) { if (typeof toast === 'function') toast(t('gminy.toast.no.name')); return; }
    if (name === 'Warszawa') { if (typeof toast === 'function') toast(t('gminy.toast.default')); return; }
    copyFrom(name, src);
    if (typeof toast === 'function') toast(t('gminy.toast.added').replace('{0}', name));
    openModal(name);
  }

  function _del(name) {
    if (!confirm(t('gminy.confirm.del').replace('{0}', name))) return;
    deleteGmina(name);
    if (typeof toast === 'function') toast(t('gminy.toast.deleted').replace('{0}', name));
    openModal();
  }

  function _save(name) {
    const rates = {};
    SCHEMA.forEach(s => {
      const el = document.getElementById(`gr-${  s.key}`);
      if (el) { const r = parseFloat(el.value); rates[s.key] = isNaN(r) ? s.default : r; }
    });
    saveGminaRates(name, rates);
    if (typeof toast === 'function') toast(t('gminy.toast.saved').replace('{0}', name));
    openModal();
    if (typeof renderVeh === 'function') renderVeh();
    if (typeof renderFormularze === 'function') renderFormularze();
  }

  // ── Porównanie stawek gmin dla aktualnej floty ───────────────────────────

  function calcFleetTaxForGmina(gminaName, vehs, rok) {
    const rates = getGminaRates(gminaName);
    let total = 0;
    (vehs || []).forEach(v => {
      const key = getRateKey(v);
      if (!key) return;
      const rate = rates[key];
      if (rate == null) return;
      const months = (typeof window.calcMiesiacePodatku === 'function')
        ? window.calcMiesiacePodatku(v, rok)
        : (v.miesiacePodatku != null ? +v.miesiacePodatku : 12);
      total += rate * months / 12;
    });
    return Math.round(total * 100) / 100;
  }

  function renderComparison(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const vehs = (window.vehs || []).filter(v => !v.archived);
    const gminy = listGminy();
    const rok = new Date().getFullYear();

    if (gminy.length < 2) {
      el.innerHTML = `<div style="padding:24px;color:var(--text3);text-align:center;font-size:13px">
        <i class="ti ti-info-circle" style="font-size:24px;display:block;margin-bottom:8px"></i>
        Dodaj co najmniej jedną gminę poza Warszawą, aby zobaczyć porównanie.
        <br><button class="btn btn-blue" style="margin-top:12px" onclick="GminyRates.openModal()"><i class="ti ti-plus"></i>Dodaj gminę</button>
      </div>`;
      return;
    }

    const taxable = vehs.filter(v => getRateKey(v) !== null);
    if (!taxable.length) {
      el.innerHTML = `<div style="padding:24px;color:var(--text3);text-align:center;font-size:13px">Brak pojazdów podlegających podatkowi DT-1 w flocie.</div>`;
      return;
    }

    const results = gminy.map(g => ({ name: g, total: calcFleetTaxForGmina(g, taxable, rok) }));
    results.sort((a, b) => a.total - b.total);
    const best = results[0].total;
    const current = results.find(r => r.name === (vehs[0]?.gmina || 'Warszawa'))?.total || results[0].total;
    const fmt = n => n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    el.innerHTML = `
      <div style="margin-bottom:12px;font-size:13px;color:var(--text2)">
        Szacunkowy podatek DT-1 za rok <strong>${rok}</strong> dla <strong>${taxable.length}</strong> opodatkowanych pojazdów wg stawek każdej gminy.
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:var(--bg2)">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text3)">#</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text3)">Gmina</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text3)">Łączny podatek</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text3)">vs najtańsza</th>
          </tr>
        </thead>
        <tbody>
          ${results.map((r, i) => {
            const isBest = r.total === best;
            const diff = r.total - best;
            const bg = isBest ? 'background:#f0fdf4' : i % 2 === 0 ? '' : 'background:var(--bg2)';
            return `<tr style="${bg};border-bottom:1px solid var(--border)">
              <td style="padding:8px 12px;color:var(--text3);font-size:11px">${i + 1}</td>
              <td style="padding:8px 12px;font-weight:${isBest ? '700' : '400'};color:${isBest ? '#166534' : 'var(--text)'}">
                ${isBest ? '<span style="font-size:10px;background:#bbf7d0;color:#166534;padding:2px 6px;border-radius:99px;margin-right:6px">✓ najtańsza</span>' : ''}
                ${esc(r.name)}
              </td>
              <td style="padding:8px 12px;text-align:right;font-family:var(--mono);font-weight:700;color:${isBest ? '#166534' : 'var(--text)'}">
                ${fmt(r.total)} zł
              </td>
              <td style="padding:8px 12px;text-align:right;font-size:12px;color:${diff > 0 ? '#dc2626' : '#16a34a'}">
                ${diff > 0 ? `+${  fmt(diff)  } zł` : '—'}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  return {
    SCHEMA, WARSZAWA_DEFAULTS, LIMITY_USTAWOWE, sprawdzWidelki,
    URZEDY_GMIN, getUrzad,
    getRateKey, getGminaRate, getGminaRates,
    listGminy, saveGminaRates, deleteGmina, copyFrom,
    calcFleetTaxForGmina, renderComparison,
    openModal, _add, _del, _save,
  };
})();
