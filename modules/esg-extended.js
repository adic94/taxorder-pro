/**
 * TaxOrder Pro — ESG Rozszerzony (CSRD compliance)
 * Buduje NA WIERZCHU istniejącego modules/esg-report.js (EsgReport).
 * Nie duplikuje funkcjonalności — dodaje: Scope 1/2/3, CSRD Ocena Istotności, GRI, TCFD.
 *
 * SCHEMA_NEEDED:
 * CREATE TABLE IF NOT EXISTS esg_scope_data (
 *   id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
 *   company_id TEXT NOT NULL,
 *   year INTEGER NOT NULL,
 *   scope INTEGER NOT NULL,           -- 1, 2 lub 3
 *   category TEXT NOT NULL,           -- np. 'fleet_fuel', 'ev_charging', 'supplier_transport'
 *   value_tonnes_co2 REAL DEFAULT 0,
 *   notes TEXT,
 *   updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 *   UNIQUE(company_id, year, scope, category)
 * );
 * CREATE TABLE IF NOT EXISTS esg_materiality (
 *   id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
 *   company_id TEXT NOT NULL,
 *   topic TEXT NOT NULL,
 *   topic_category TEXT DEFAULT 'environmental', -- environmental | social | governance
 *   impact_score INTEGER DEFAULT 3,    -- 1-5
 *   financial_score INTEGER DEFAULT 3, -- 1-5
 *   notes TEXT,
 *   updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 *   UNIQUE(company_id, topic)
 * );
 * CREATE INDEX IF NOT EXISTS idx_esg_scope ON esg_scope_data(company_id, year);
 * CREATE INDEX IF NOT EXISTS idx_esg_mat   ON esg_materiality(company_id);
 *
 * ENDPOINT_NEEDED:
 * GET    /api/esg-scope?company=X&year=Y        — list scope data for year
 * POST   /api/esg-scope                         — upsert scope entry
 * GET    /api/esg-materiality?company=X         — list materiality topics
 * POST   /api/esg-materiality                   — upsert topic
 * DELETE /api/esg-materiality/:id               — delete topic
 */
(function () {
  'use strict';

  const API = () => window._cfApi?.() || window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const H   = () => window._cfHdrs?.() || { Authorization: `Bearer ${localStorage.getItem('cf_token')}` };
  const Co  = () => window._cfCo?.() || window.currentCompanyId || localStorage.getItem('currentCompany') || '';

  const SCOPE1_CATS = [
    { key: 'fleet_diesel',  label: 'Flota — diesel (t CO₂)' },
    { key: 'fleet_petrol',  label: 'Flota — benzyna (t CO₂)' },
    { key: 'fleet_lpg',     label: 'Flota — LPG (t CO₂)' },
    { key: 'fleet_cng',     label: 'Flota — CNG (t CO₂)' },
    { key: 'refrigerants',  label: 'Czynniki chłodnicze (t CO₂e)' },
  ];
  const SCOPE2_CATS = [
    { key: 'ev_charging',   label: 'Ładowanie EV — energia elektryczna (t CO₂e)' },
    { key: 'office_energy', label: 'Energia biura / floty (t CO₂e)' },
  ];
  const SCOPE3_CATS = [
    { key: 'supplier_transport', label: 'Transport dostawców (t CO₂)' },
    { key: 'commuting',          label: 'Dojazdy pracowników (t CO₂)' },
    { key: 'business_travel',    label: 'Podróże służbowe (t CO₂)' },
    { key: 'waste',              label: 'Odpady i utylizacja (t CO₂e)' },
  ];

  const DEFAULT_TOPICS = [
    { topic: 'Emisje gazów cieplarnianych',  topic_category: 'environmental' },
    { topic: 'Zużycie energii',              topic_category: 'environmental' },
    { topic: 'Gospodarka wodna',             topic_category: 'environmental' },
    { topic: 'Bioróżnorodność',             topic_category: 'environmental' },
    { topic: 'Zdrowie i bezpieczeństwo pracowników', topic_category: 'social' },
    { topic: 'Warunki pracy kierowców',     topic_category: 'social' },
    { topic: 'Różnorodność i włączenie',    topic_category: 'social' },
    { topic: 'Etyka w łańcuchu dostaw',     topic_category: 'governance' },
    { topic: 'Zarządzanie ryzykiem klimatycznym', topic_category: 'governance' },
    { topic: 'Przejrzystość podatków',       topic_category: 'governance' },
  ];

  let _activeTab = 'scope';

  async function _api(method, path, body) {
    const sep = path.includes('?') ? '&' : '?';
    const url = `${API()}${path}${sep}company=${encodeURIComponent(Co())}`;
    const opts = { method, headers: { 'Content-Type': 'application/json', ...H() } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    return r.json().catch(() => ({}));
  }

  function _currYear() { return new Date().getFullYear(); }

  // ── Main render ───────────────────────────────────────────────────────────

  function renderEsgExtended() {
    const el = document.getElementById('page-esg-extended');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-leaf"></i> ESG Rozszerzony — CSRD</h2>
        <div style="display:flex;gap:8px;align-items:center">
          <select id="esg-ext-year" class="form-control" style="width:100px" onchange="window.EsgExtended._reloadTab()">
            ${[_currYear()+1,_currYear(),_currYear()-1,_currYear()-2].map(y => `<option value="${y}" ${y===_currYear()?'selected':''}>${y}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="tabs-bar" style="display:flex;gap:4px;margin-bottom:16px;border-bottom:2px solid var(--border,#e2e8f0)">
        <button id="esg-ext-tab-scope"       onclick="window.EsgExtended._switchTab('scope')"       style="padding:8px 16px;border:none;background:none;cursor:pointer;font-weight:600">Emisje Scope 1/2/3</button>
        <button id="esg-ext-tab-materiality" onclick="window.EsgExtended._switchTab('materiality')" style="padding:8px 16px;border:none;background:none;cursor:pointer;font-weight:600">Ocena Istotności</button>
        <button id="esg-ext-tab-gri"         onclick="window.EsgExtended._switchTab('gri')"         style="padding:8px 16px;border:none;background:none;cursor:pointer;font-weight:600">Raport GRI</button>
        <button id="esg-ext-tab-tcfd"        onclick="window.EsgExtended._switchTab('tcfd')"        style="padding:8px 16px;border:none;background:none;cursor:pointer;font-weight:600">TCFD</button>
      </div>
      <div id="esg-ext-content"></div>
      <div id="esg-ext-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.EsgExtended._closeModal()">
        <div class="modal-box" style="max-width:500px">
          <div class="modal-header">
            <h3 id="esg-ext-modal-title">Temat</h3>
            <button class="modal-close" onclick="window.EsgExtended._closeModal()">×</button>
          </div>
          <div class="modal-body" id="esg-ext-modal-body"></div>
        </div>
      </div>`;
    _switchTab(_activeTab);
  }

  function _switchTab(tab) {
    _activeTab = tab;
    ['scope', 'materiality', 'gri', 'tcfd'].forEach(t => {
      const btn = document.getElementById(`esg-ext-tab-${t}`);
      if (btn) btn.style.borderBottom = t === tab ? '2px solid #22c55e' : 'none';
    });
    const content = document.getElementById('esg-ext-content');
    if (!content) return;
    if (tab === 'scope')       _renderScopeTab(content);
    if (tab === 'materiality') _renderMaterialityTab(content);
    if (tab === 'gri')         _renderGriTab(content);
    if (tab === 'tcfd')        _renderTcfdTab(content);
  }

  function _reloadTab() { _switchTab(_activeTab); }

  function _year() { return +(document.getElementById('esg-ext-year')?.value || _currYear()); }

  // ── SCOPE TAB ─────────────────────────────────────────────────────────────

  function _renderScopeTab(container) {
    container.innerHTML = `
      <div id="esg-scope-kpi" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px"></div>
      <p style="color:var(--text-muted);font-size:.85em;margin-bottom:16px">
        <strong>Scope 1:</strong> bezpośrednie emisje (spalanie paliwa we własnej flocie) |
        <strong>Scope 2:</strong> pośrednie emisje (energia elektryczna do ładowania EV) |
        <strong>Scope 3:</strong> łańcuch wartości (dostawcy, pracownicy)
      </p>
      <div id="esg-scope-sections"></div>
      <div style="margin-top:16px;display:flex;gap:8px">
        <button class="btn btn-primary" onclick="window.EsgExtended._saveAllScope()"><i class="ti ti-device-floppy"></i> Zapisz wszystkie wartości</button>
      </div>`;
    _loadScope();
  }

  async function _loadScope() {
    const year = _year();
    const data = await _api('GET', `/api/esg-scope?year=${year}`);
    const rows = data.entries || [];
    const byKey = Object.fromEntries(rows.map(r => [`${r.scope}_${r.category}`, r]));

    let totalScope1 = 0, totalScope2 = 0, totalScope3 = 0;
    rows.forEach(r => {
      if (r.scope === 1) totalScope1 += r.value_tonnes_co2 ?? 0;
      if (r.scope === 2) totalScope2 += r.value_tonnes_co2 ?? 0;
      if (r.scope === 3) totalScope3 += r.value_tonnes_co2 ?? 0;
    });

    const kpi = document.getElementById('esg-scope-kpi');
    if (kpi) {
      kpi.innerHTML = [
        { lbl: 'Scope 1 (t CO₂)', val: totalScope1.toFixed(2), clr: '#ef4444', icon: 'ti-flame' },
        { lbl: 'Scope 2 (t CO₂e)',val: totalScope2.toFixed(2), clr: '#f59e0b', icon: 'ti-bolt' },
        { lbl: 'Scope 3 (t CO₂)', val: totalScope3.toFixed(2), clr: '#3b82f6', icon: 'ti-world' },
        { lbl: 'Łącznie (t CO₂e)',val: (totalScope1+totalScope2+totalScope3).toFixed(2), clr: '#64748b', icon: 'ti-cloud' },
      ].map(k => `
        <div style="background:var(--bg-card,#f8fafc);border:1px solid var(--border,#e2e8f0);border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:12px;min-width:160px">
          <i class="ti ${k.icon}" style="font-size:1.6em;color:${k.clr}"></i>
          <div><div style="font-size:1.2em;font-weight:700;color:${k.clr}">${k.val}</div><div style="font-size:.8em;color:var(--text-muted)">${k.lbl}</div></div>
        </div>`).join('');
    }

    const sections = document.getElementById('esg-scope-sections');
    if (!sections) return;

    const renderGroup = (scope, label, color, cats) => `
      <div style="background:var(--bg-card,#f8fafc);border:1px solid ${color}40;border-radius:10px;padding:16px;margin-bottom:16px">
        <h4 style="margin:0 0 12px;color:${color}"><i class="ti ti-circle-filled" style="font-size:.6em"></i> ${esc(label)}</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">
          ${cats.map(cat => {
            const existing = byKey[`${scope}_${cat.key}`];
            const val = existing?.value_tonnes_co2 ?? 0;
            return `<div class="form-row" style="margin:0">
              <label style="font-size:.85em">${esc(cat.label)}</label>
              <div style="display:flex;gap:6px;align-items:center">
                <input type="number" step="0.001" min="0" class="form-control" style="width:120px"
                  id="scope-${scope}-${cat.key}" value="${val}"
                  data-scope="${scope}" data-category="${cat.key}">
                <span style="color:var(--text-muted);font-size:.85em">t CO₂</span>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;

    sections.innerHTML =
      renderGroup(1, 'Scope 1 — emisje bezpośrednie (własna flota)', '#ef4444', SCOPE1_CATS) +
      renderGroup(2, 'Scope 2 — emisje pośrednie (energia elektryczna)', '#f59e0b', SCOPE2_CATS) +
      renderGroup(3, 'Scope 3 — łańcuch wartości', '#3b82f6', SCOPE3_CATS);
  }

  async function _saveAllScope() {
    const year  = _year();
    const inputs = document.querySelectorAll('#esg-scope-sections input[data-scope]');
    const saves  = [];
    inputs.forEach(inp => {
      saves.push(_api('POST', '/api/esg-scope', {
        year,
        scope:             +inp.dataset.scope,
        category:          inp.dataset.category,
        value_tonnes_co2:  +inp.value || 0,
      }));
    });
    await Promise.all(saves);
    _loadScope();
    const msg = document.createElement('div');
    msg.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#22c55e;color:#fff;padding:10px 18px;border-radius:8px;z-index:9999';
    msg.textContent = 'Zapisano emisje Scope 1/2/3';
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 2500);
  }

  // ── MATERIALITY TAB ───────────────────────────────────────────────────────

  function _renderMaterialityTab(container) {
    container.innerHTML = `
      <p style="color:var(--text-muted);margin-bottom:16px">
        Podwójna istotność CSRD: oceń każdy temat pod względem <strong>wpływu</strong> (impact) na środowisko/społeczeństwo
        oraz <strong>finansowego</strong> (financial materiality) znaczenia dla firmy. Skala 1–5.
      </p>
      <button class="btn btn-primary" style="margin-bottom:12px" onclick="window.EsgExtended._openTopicModal()"><i class="ti ti-plus"></i> Dodaj temat</button>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <h4 style="margin-bottom:10px">Tabela tematów</h4>
          <div class="table-wrap">
            <table class="data-table" id="esg-mat-table">
              <thead><tr><th>Temat</th><th>Kategoria</th><th>Wpływ</th><th>Finansowy</th><th>Akcje</th></tr></thead>
              <tbody id="esg-mat-tbody"><tr><td colspan="5" class="loading-row">Ładowanie...</td></tr></tbody>
            </table>
          </div>
        </div>
        <div>
          <h4 style="margin-bottom:10px">Macierz istotności</h4>
          <div id="esg-mat-matrix" style="position:relative;width:100%;aspect-ratio:1;background:var(--bg-card,#f8fafc);border:1px solid var(--border,#e2e8f0);border-radius:10px;overflow:hidden">
            <div style="position:absolute;bottom:4px;left:50%;transform:translateX(-50%);font-size:.75em;color:#64748b">Wpływ →</div>
            <div style="position:absolute;left:4px;top:50%;transform:translateY(-50%) rotate(-90deg);font-size:.75em;color:#64748b;white-space:nowrap">Finansowy →</div>
          </div>
        </div>
      </div>`;
    _loadMateriality();
  }

  async function _loadMateriality() {
    const data   = await _api('GET', '/api/esg-materiality');
    let topics   = data.topics || [];

    // Seed defaults if none yet (no server call — just populate UI)
    if (!topics.length) {
      topics = DEFAULT_TOPICS.map((t, i) => ({ ...t, id: `default-${i}`, impact_score: 3, financial_score: 3 }));
    }

    const catColor = { environmental: '#22c55e', social: '#3b82f6', governance: '#f59e0b' };
    const catLabel = { environmental: 'Środowisko', social: 'Społeczeństwo', governance: 'Ład' };

    const tbody = document.getElementById('esg-mat-tbody');
    if (tbody) {
      tbody.innerHTML = topics.map(t => `<tr>
        <td>${esc(t.topic || '—')}</td>
        <td><span style="padding:1px 7px;border-radius:10px;font-size:.8em;background:${catColor[t.topic_category]||'#e2e8f0'}20;color:${catColor[t.topic_category]||'#64748b'}">${esc(catLabel[t.topic_category] ?? t.topic_category ?? '—')}</span></td>
        <td style="text-align:center">${t.impact_score ?? 3}/5</td>
        <td style="text-align:center">${t.financial_score ?? 3}/5</td>
        <td>
          <button class="btn-icon" data-id="${esc(t.id)}" onclick="window.EsgExtended._openTopicModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
          <button class="btn-icon danger" data-id="${esc(t.id)}" onclick="window.EsgExtended._deleteTopic(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`).join('');
    }

    _renderMatrixChart(topics, catColor);
  }

  function _renderMatrixChart(topics, catColor) {
    const el = document.getElementById('esg-mat-matrix');
    if (!el) return;
    const w = el.offsetWidth || 300;
    const h = el.offsetHeight || 300;

    // Build SVG matrix
    const pad = 30;
    const inner_w = w - pad * 2;
    const inner_h = h - pad * 2;

    const dots = topics.map(t => {
      const x = pad + ((t.impact_score ?? 3) - 1) / 4 * inner_w;
      const y = (h - pad) - ((t.financial_score ?? 3) - 1) / 4 * inner_h;
      const clr = catColor[t.topic_category] || '#64748b';
      return `<circle cx="${x}" cy="${y}" r="8" fill="${clr}" fill-opacity="0.7" stroke="#fff" stroke-width="1.5">
        <title>${esc(t.topic)} (wpływ:${t.impact_score}, finanse:${t.financial_score})</title>
      </circle>`;
    }).join('');

    // Quadrant backgrounds
    const mx = pad + inner_w / 2;
    const my = pad + inner_h / 2;
    el.innerHTML = `<svg width="${w}" height="${h}" style="display:block">
      <rect x="${pad}" y="${pad}" width="${inner_w/2}" height="${inner_h/2}" fill="#fde68a" fill-opacity="0.15"/>
      <rect x="${mx}"  y="${pad}" width="${inner_w/2}" height="${inner_h/2}" fill="#ef4444" fill-opacity="0.12"/>
      <rect x="${pad}" y="${my}"  width="${inner_w/2}" height="${inner_h/2}" fill="#e2e8f0" fill-opacity="0.5"/>
      <rect x="${mx}"  y="${my}"  width="${inner_w/2}" height="${inner_h/2}" fill="#bbf7d0" fill-opacity="0.3"/>
      <line x1="${mx}" y1="${pad}" x2="${mx}" y2="${h-pad}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4"/>
      <line x1="${pad}" y1="${my}" x2="${w-pad}" y2="${my}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4"/>
      ${dots}
      <text x="${pad+4}" y="${h-pad-4}" font-size="9" fill="#94a3b8">1</text>
      <text x="${w-pad-8}" y="${h-pad-4}" font-size="9" fill="#94a3b8">5</text>
      <text x="${pad+4}" y="${pad+12}" font-size="9" fill="#94a3b8">5</text>
      <text x="${w/2-20}" y="${h-4}" font-size="10" fill="#64748b">Wpływ →</text>
    </svg>`;
  }

  async function _openTopicModal(id) {
    const body  = document.getElementById('esg-ext-modal-body');
    const title = document.getElementById('esg-ext-modal-title');
    const modal = document.getElementById('esg-ext-modal');
    let t = { impact_score: 3, financial_score: 3, topic_category: 'environmental' };
    if (id && !id.startsWith('default-')) {
      const d = await _api('GET', `/api/esg-materiality/${id}`);
      t = d.topic || t;
    }
    title.textContent = id ? 'Edytuj temat' : 'Nowy temat istotności';
    body.innerHTML = `
      <form id="esg-topic-form" data-id="${esc(id || '')}" onsubmit="window.EsgExtended._saveTopic(event,this.dataset.id)">
        <div class="form-row"><label>Temat *</label>
          <input name="topic" class="form-control" required value="${esc(t.topic || '')}">
        </div>
        <div class="form-row"><label>Kategoria</label>
          <select name="topic_category" class="form-control">
            <option value="environmental" ${t.topic_category==='environmental'?'selected':''}>Środowisko</option>
            <option value="social"        ${t.topic_category==='social'?'selected':''}>Społeczeństwo</option>
            <option value="governance"    ${t.topic_category==='governance'?'selected':''}>Ład korporacyjny</option>
          </select>
        </div>
        <div class="form-row"><label>Wpływ (1-5)</label>
          <input name="impact_score" type="range" min="1" max="5" step="1" value="${t.impact_score ?? 3}" class="form-control"
            oninput="document.getElementById('esg-impact-val').textContent=this.value">
          <span id="esg-impact-val" style="font-weight:700">${t.impact_score ?? 3}</span>/5
        </div>
        <div class="form-row"><label>Finansowy (1-5)</label>
          <input name="financial_score" type="range" min="1" max="5" step="1" value="${t.financial_score ?? 3}" class="form-control"
            oninput="document.getElementById('esg-fin-val').textContent=this.value">
          <span id="esg-fin-val" style="font-weight:700">${t.financial_score ?? 3}</span>/5
        </div>
        <div class="form-row"><label>Uwagi</label>
          <textarea name="notes" class="form-control" rows="2">${esc(t.notes || '')}</textarea>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="window.EsgExtended._closeModal()">Anuluj</button>
          <button type="submit" class="btn btn-primary">Zapisz</button>
        </div>
      </form>`;
    modal.style.display = 'flex';
  }

  async function _saveTopic(e, id) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    body.impact_score    = +body.impact_score;
    body.financial_score = +body.financial_score;
    const realId = id && !id.startsWith('default-') ? id : null;
    await _api(realId ? 'PUT' : 'POST', realId ? `/api/esg-materiality/${realId}` : '/api/esg-materiality', body);
    _closeModal(); _loadMateriality();
  }

  async function _deleteTopic(id) {
    if (id.startsWith('default-')) { alert('To jest domyślny temat — najpierw zapisz go przez edycję.'); return; }
    if (!confirm('Usunąć temat?')) return;
    await _api('DELETE', `/api/esg-materiality/${id}`);
    _loadMateriality();
  }

  // ── GRI TAB ───────────────────────────────────────────────────────────────

  function _renderGriTab(container) {
    const year = _year();
    container.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="btn btn-primary" onclick="window.EsgExtended._exportGriPdf()"><i class="ti ti-download"></i> Eksportuj PDF</button>
      </div>
      <div id="gri-sections" style="display:flex;flex-direction:column;gap:20px">
        ${_griSection('GRI 302 — Energia', [
          { lbl: 'Całkowite zużycie energii wewnątrz organizacji (GJ)', key: 'gri302_1' },
          { lbl: 'Całkowite zużycie energii na zewnątrz organizacji (GJ)', key: 'gri302_2' },
          { lbl: 'Intensywność energetyczna (GJ/km lub GJ/pojazd)', key: 'gri302_3' },
          { lbl: 'Ograniczenie zużycia energii (GJ)', key: 'gri302_4' },
        ])}
        ${_griSection('GRI 305 — Emisje', [
          { lbl: 'Emisje bezpośrednie GHG Scope 1 (t CO₂e)', key: 'gri305_1' },
          { lbl: 'Pośrednie emisje GHG Scope 2 (t CO₂e)', key: 'gri305_2' },
          { lbl: 'Inne pośrednie emisje Scope 3 (t CO₂e)', key: 'gri305_3' },
          { lbl: 'Intensywność emisji GHG', key: 'gri305_4' },
          { lbl: 'Ograniczenie emisji GHG (t CO₂e)', key: 'gri305_5' },
        ])}
        ${_griSection('GRI 401 — Zatrudnienie', [
          { lbl: 'Liczba nowych pracowników', key: 'gri401_1' },
          { lbl: 'Wskaźnik rotacji pracowników (%)', key: 'gri401_1b' },
          { lbl: 'Świadczenia pracownicze (opis)', key: 'gri401_2', textarea: true },
          { lbl: 'Minimalne wypowiedzenie przy zmianach operacyjnych (tygodnie)', key: 'gri401_3' },
        ])}
      </div>`;
    _loadGriData(year);
  }

  function _griSection(title, fields) {
    return `
      <div style="background:var(--bg-card,#f8fafc);border:1px solid var(--border,#e2e8f0);border-radius:10px;padding:16px">
        <h4 style="margin:0 0 12px;color:#22c55e">${esc(title)}</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px">
          ${fields.map(f => `<div class="form-row" style="margin:0">
            <label style="font-size:.85em">${esc(f.lbl)}</label>
            ${f.textarea
              ? `<textarea id="gri-${f.key}" class="form-control" rows="2" placeholder="Wprowadź opis..."></textarea>`
              : `<input type="number" step="any" id="gri-${f.key}" class="form-control" placeholder="0">`
            }
          </div>`).join('')}
        </div>
      </div>`;
  }

  function _loadGriData(year) {
    // Load from localStorage as simple persistence (no separate endpoint needed)
    const stored = JSON.parse(localStorage.getItem(`gri_${Co()}_${year}`) || '{}');
    Object.entries(stored).forEach(([k, v]) => {
      const el = document.getElementById(`gri-${k}`);
      if (el) el.value = v;
    });
    // Auto-save on change
    document.querySelectorAll('#gri-sections [id^="gri-"]').forEach(inp => {
      inp.addEventListener('input', () => {
        const all = {};
        document.querySelectorAll('#gri-sections [id^="gri-"]').forEach(i => {
          all[i.id.replace('gri-', '')] = i.value;
        });
        localStorage.setItem(`gri_${Co()}_${year}`, JSON.stringify(all));
      });
    });
  }

  function _exportGriPdf() {
    const year = _year();
    const stored = JSON.parse(localStorage.getItem(`gri_${Co()}_${year}`) || '{}');
    const v = k => esc(String(stored[k] || '—'));
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>Raport GRI ${year}</title>
      <style>body{font-family:sans-serif;padding:30px;max-width:800px;margin:0 auto}
      h2{color:#22c55e}h3{margin-top:24px;border-bottom:1px solid #e2e8f0;padding-bottom:6px}
      table{width:100%;border-collapse:collapse}td,th{border:1px solid #e2e8f0;padding:8px;text-align:left}
      th{background:#f1f5f9}
      </style></head><body>
      <h2>Raport GRI — ${year}</h2>
      <p>Organizacja: ${esc(Co())} | Data: ${new Date().toLocaleDateString('pl-PL')}</p>
      <h3>GRI 302 — Energia</h3>
      <table><tr><th>Wskaźnik</th><th>Wartość</th></tr>
        <tr><td>Zużycie energii wewnątrz (GJ)</td><td>${v('gri302_1')}</td></tr>
        <tr><td>Zużycie energii zewnątrz (GJ)</td><td>${v('gri302_2')}</td></tr>
        <tr><td>Intensywność energetyczna</td><td>${v('gri302_3')}</td></tr>
        <tr><td>Ograniczenie zużycia (GJ)</td><td>${v('gri302_4')}</td></tr>
      </table>
      <h3>GRI 305 — Emisje</h3>
      <table><tr><th>Wskaźnik</th><th>Wartość</th></tr>
        <tr><td>Scope 1 (t CO₂e)</td><td>${v('gri305_1')}</td></tr>
        <tr><td>Scope 2 (t CO₂e)</td><td>${v('gri305_2')}</td></tr>
        <tr><td>Scope 3 (t CO₂e)</td><td>${v('gri305_3')}</td></tr>
        <tr><td>Intensywność emisji</td><td>${v('gri305_4')}</td></tr>
        <tr><td>Ograniczenie emisji (t CO₂e)</td><td>${v('gri305_5')}</td></tr>
      </table>
      <h3>GRI 401 — Zatrudnienie</h3>
      <table><tr><th>Wskaźnik</th><th>Wartość</th></tr>
        <tr><td>Nowi pracownicy</td><td>${v('gri401_1')}</td></tr>
        <tr><td>Rotacja (%)</td><td>${v('gri401_1b')}</td></tr>
        <tr><td>Świadczenia pracownicze</td><td>${v('gri401_2')}</td></tr>
        <tr><td>Min. wypowiedzenie (tygodnie)</td><td>${v('gri401_3')}</td></tr>
      </table>
      <p style="margin-top:30px;font-size:.8em;color:#64748b">Wygenerowano automatycznie przez TaxOrder Pro</p>
    </body></html>`);
    w.print();
  }

  // ── TCFD TAB ──────────────────────────────────────────────────────────────

  function _renderTcfdTab(container) {
    const year = _year();
    const stored = JSON.parse(localStorage.getItem(`tcfd_${Co()}_${year}`) || '{}');
    const v = k => esc(stored[k] || '');

    const pillars = [
      {
        key: 'governance',
        icon: 'ti-building',
        color: '#3b82f6',
        title: 'Ład (Governance)',
        desc: 'Opis nadzoru zarządu i kierownictwa nad ryzykami i szansami związanymi z klimatem.',
        placeholder: 'Np. Zarząd co kwartał omawia ryzyka klimatyczne. Komitet ds. ESG...',
      },
      {
        key: 'strategy',
        icon: 'ti-map',
        color: '#22c55e',
        title: 'Strategia (Strategy)',
        desc: 'Ryzyka i szanse klimatyczne krótko-, średnio- i długoterminowe. Odporność strategii.',
        placeholder: 'Np. Identyfikujemy ryzyko fizyczne (powodzie) i przejściowe (ceny CO₂)...',
      },
      {
        key: 'risk_management',
        icon: 'ti-shield',
        color: '#f59e0b',
        title: 'Zarządzanie ryzykiem (Risk Management)',
        desc: 'Procesy identyfikacji, oceny i zarządzania ryzykami klimatycznymi.',
        placeholder: 'Np. Ryzyka klimatyczne włączono do ogólnego rejestru ryzyk...',
      },
      {
        key: 'metrics',
        icon: 'ti-chart-bar',
        color: '#8b5cf6',
        title: 'Wskaźniki i cele (Metrics & Targets)',
        desc: 'Mierniki i cele stosowane do oceny i zarządzania ryzykami klimatycznymi.',
        placeholder: 'Np. Cel: redukcja Scope 1 o 30% do 2030. Emisje: ... t CO₂e w bieżącym roku.',
      },
    ];

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <p style="color:var(--text-muted);font-size:.85em;margin:0">
          Ramy TCFD (Task Force on Climate-related Financial Disclosures) — 4 filary ujawnień klimatycznych.
        </p>
        <button class="btn btn-primary" onclick="window.EsgExtended._exportTcfdPdf()"><i class="ti ti-download"></i> Eksportuj PDF</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px">
        ${pillars.map(p => `
          <div style="background:var(--bg-card,#f8fafc);border:2px solid ${p.color}30;border-radius:10px;padding:16px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
              <i class="ti ${p.icon}" style="font-size:1.4em;color:${p.color}"></i>
              <strong style="color:${p.color}">${esc(p.title)}</strong>
            </div>
            <p style="font-size:.82em;color:var(--text-muted);margin-bottom:8px">${esc(p.desc)}</p>
            <textarea id="tcfd-${p.key}" class="form-control" rows="5"
              placeholder="${esc(p.placeholder)}"
              oninput="window.EsgExtended._saveTcfd()">${v(p.key)}</textarea>
          </div>`).join('')}
      </div>`;
  }

  function _saveTcfd() {
    const year = _year();
    const keys = ['governance', 'strategy', 'risk_management', 'metrics'];
    const data = {};
    keys.forEach(k => { data[k] = document.getElementById(`tcfd-${k}`)?.value || ''; });
    localStorage.setItem(`tcfd_${Co()}_${year}`, JSON.stringify(data));
  }

  function _exportTcfdPdf() {
    const year   = _year();
    const stored = JSON.parse(localStorage.getItem(`tcfd_${Co()}_${year}`) || '{}');
    const v = k => esc(stored[k] || '—');
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>TCFD ${year}</title>
      <style>body{font-family:sans-serif;padding:30px;max-width:800px;margin:0 auto}
      h2{color:#3b82f6}h3{margin-top:24px;color:#374151}
      .box{border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;white-space:pre-wrap}
      </style></head><body>
      <h2>Ujawnienia TCFD — ${year}</h2>
      <p>Organizacja: ${esc(Co())} | Data: ${new Date().toLocaleDateString('pl-PL')}</p>
      <h3>Ład (Governance)</h3><div class="box">${v('governance')}</div>
      <h3>Strategia (Strategy)</h3><div class="box">${v('strategy')}</div>
      <h3>Zarządzanie ryzykiem (Risk Management)</h3><div class="box">${v('risk_management')}</div>
      <h3>Wskaźniki i cele (Metrics & Targets)</h3><div class="box">${v('metrics')}</div>
      <p style="margin-top:30px;font-size:.8em;color:#64748b">Wygenerowano przez TaxOrder Pro</p>
    </body></html>`);
    w.print();
  }

  function _closeModal() {
    const m = document.getElementById('esg-ext-modal');
    if (m) m.style.display = 'none';
  }

  window.EsgExtended = {
    renderEsgExtended,
    _switchTab,
    _reloadTab,
    _saveAllScope,
    _openTopicModal,
    _saveTopic,
    _deleteTopic,
    _exportGriPdf,
    _saveTcfd,
    _exportTcfdPdf,
    _closeModal,
  };
})();
