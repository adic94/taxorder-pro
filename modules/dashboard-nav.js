// ==================== DASHBOARD NAWIGACJI (kafelki) ====================
// Zastępuje przeładowany topbar — moduły wybierane przez kafelki

window.TaxOrderDashNav = {

  MODULES: [
    { id:'dash',        icon:'ti-chart-bar',          label:'Pulpit',             color:'blue',  desc:'KPI i podsumowanie' },
    { id:'pojazdy',     icon:'ti-truck',               label:'Pojazdy',            color:'blue',  desc:'Baza 161 pojazdów' },
    { id:'kalkulator',  icon:'ti-calculator',          label:'Kalkulator DT-1',    color:'green', desc:'Wylicz podatek' },
    { id:'formularze',  icon:'ti-file-text',           label:'DT-1 / DT-1/A',     color:'green', desc:'Formularze MF' },
    { id:'pd',          icon:'ti-upload',              label:'Eksport PD',         color:'green', desc:'Przyjazne Dekl.' },
    { id:'pdfexport',   icon:'ti-file-type-pdf',       label:'Eksport PDF',        color:'red',   desc:'Pobierz formularze' },
    { id:'walidacja',   icon:'ti-shield-check',        label:'Walidacja',          color:'amber', desc:'Sprawdź deklarację' },
    { id:'raporty',     icon:'ti-chart-line',          label:'Raporty',            color:'blue',  desc:'Analiza kosztów' },
    { id:'ocr',         icon:'ti-scan',                label:'OCR Dowody',         color:'purple',desc:'Skanuj dowód rej.' },
    { id:'faktury',     icon:'ti-file-invoice',        label:'Faktury',            color:'amber', desc:'Historia zakupów' },
    { id:'karty',       icon:'ti-credit-card',         label:'Karty flotowe',      color:'teal',  desc:'Zarządzaj kartami' },
    { id:'impexp',      icon:'ti-arrows-exchange',     label:'Import / Eksport',   color:'gray',  desc:'XLS, CSV, JSON' },
    { id:'cepik',       icon:'ti-database',            label:'CEPiK',              color:'teal',  desc:'Weryfikacja danych' },
    { id:'stawki',      icon:'ti-building-bank',       label:'Stawki 2026',        color:'gray',  desc:'Uchwała Warszawa' },
    { id:'podatnik',    icon:'ti-building',            label:'Podatnik',           color:'gray',  desc:'Dane firmy' },
    { id:'firmy',       icon:'ti-building-community',  label:'Firmy',              color:'purple',desc:'6 spółek grupy' },
    { id:'uzytkownicy', icon:'ti-users',               label:'Użytkownicy',        color:'gray',  desc:'Role i dostęp' },
  ],

  COLOR_MAP: {
    blue:   { bg: '#E6F1FB', color: '#0C447C', border: '#B5D4F4' },
    green:  { bg: '#EAF3DE', color: '#27500A', border: '#C0DD97' },
    red:    { bg: '#FCEBEB', color: '#791F1F', border: '#F7C1C1' },
    amber:  { bg: '#FAEEDA', color: '#633806', border: '#FAC775' },
    teal:   { bg: '#E1F5EE', color: '#085041', border: '#9FE1CB' },
    purple: { bg: '#EEEDFE', color: '#3C3489', border: '#CECBF6' },
    gray:   { bg: '#F1EFE8', color: '#444441', border: '#D3D1C7' },
  },

  render() {
    const el = document.getElementById('module-launcher');
    if (!el) return;
    const c = window.currentCompanyId || 'mtoilet';
    const company = typeof COMPANIES !== 'undefined' ? COMPANIES[c] : null;

    el.innerHTML = `
      <div style="padding:1.5rem">
        <!-- Nagłówek firmy -->
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:24px;padding-bottom:20px;border-bottom:0.5px solid var(--border)">
          <div style="width:48px;height:48px;border-radius:var(--radius-lg);background:${company?.color || '#185FA5'}22;display:flex;align-items:center;justify-content:center">
            <i class="ti ti-building-community" style="font-size:24px;color:${company?.color || '#185FA5'}"></i>
          </div>
          <div>
            <div style="font-size:18px;font-weight:700">${company?.shortName || 'TaxOrder Pro'}</div>
            <div style="font-size:12px;color:var(--text2)">${company?.name || 'System DT-1'}</div>
          </div>
          <select onchange="switchCompany(this.value)" style="margin-left:auto;padding:6px 10px;border-radius:var(--radius);border:1px solid var(--border);font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font)">
            ${Object.entries(typeof COMPANIES !== 'undefined' ? COMPANIES : {}).map(([k,v]) => 
              `<option value="${k}" ${k===c?'selected':''}>${v.shortName}</option>`
            ).join('')}
          </select>
        </div>

        <!-- Siatka kafelków -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">
          ${this.MODULES.map(m => {
            const col = this.COLOR_MAP[m.color] || this.COLOR_MAP.gray;
            return `
              <button onclick="TaxOrderDashNav.launch('${m.id}')"
                style="background:${col.bg};border:1px solid ${col.border};border-radius:var(--radius-lg);padding:14px 12px;cursor:pointer;text-align:left;transition:transform .15s,box-shadow .15s;display:flex;flex-direction:column;gap:6px"
                onmouseover="this.style.transform='translateY(-2px)'" 
                onmouseout="this.style.transform=''">
                <i class="ti ${m.icon}" style="font-size:22px;color:${col.color}"></i>
                <div style="font-size:12px;font-weight:600;color:${col.color};line-height:1.3">${m.label}</div>
                <div style="font-size:10px;color:${col.color};opacity:.7">${m.desc}</div>
              </button>`;
          }).join('')}
        </div>

        <!-- Szybkie statsy -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:24px;padding-top:20px;border-top:0.5px solid var(--border)">
          <div style="background:var(--bg2);border-radius:var(--radius);padding:12px;text-align:center">
            <div style="font-size:22px;font-weight:700;color:var(--blue)" id="ml-total-vehs">—</div>
            <div style="font-size:11px;color:var(--text2)">Pojazdy aktywne</div>
          </div>
          <div style="background:var(--bg2);border-radius:var(--radius);padding:12px;text-align:center">
            <div style="font-size:22px;font-weight:700;color:var(--green)" id="ml-tax">—</div>
            <div style="font-size:11px;color:var(--text2)">Podatek DT-1</div>
          </div>
          <div style="background:var(--bg2);border-radius:var(--radius);padding:12px;text-align:center">
            <div style="font-size:22px;font-weight:700;color:var(--amber)" id="ml-leasing">—</div>
            <div style="font-size:11px;color:var(--text2)">Na leasingu</div>
          </div>
          <div style="background:var(--bg2);border-radius:var(--radius);padding:12px;text-align:center">
            <div style="font-size:22px;font-weight:700;color:var(--red)" id="ml-alerts">0</div>
            <div style="font-size:11px;color:var(--text2)">Alerty (wkrótce)</div>
          </div>
        </div>
      </div>`;

    this._updateStats();
  },

  launch(moduleId) {
    document.getElementById('page-launcher').classList.remove('active');
    if (typeof showPage === 'function') showPage(moduleId);
  },

  _updateStats() {
    try {
      const active = (window.vehs || []).filter(v => v.is_active !== false);
      const tax = active.reduce((s,v) => {
        const t = (typeof calcTax === 'function') ? calcTax(v) : {};
        return s + (t.amount || 0);
      }, 0);
      const leasing = active.filter(v => (v.status||'').toLowerCase() === 'leasing' || v.ownership_type === 'leasing').length;

      const el = id => document.getElementById(id);
      if (el('ml-total-vehs')) el('ml-total-vehs').textContent = active.length;
      if (el('ml-tax')) el('ml-tax').textContent = Math.round(tax).toLocaleString('pl-PL') + ' zł';
      if (el('ml-leasing')) el('ml-leasing').textContent = leasing;
    } catch(e) {}
  }
};
