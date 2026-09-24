(function () {
  'use strict';

  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H = () => window._cfHdrs?.() || {};
  const Co = () => window._cfCo?.() || '';
  const e = value => typeof esc === 'function'
    ? esc(value)
    : String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmtDT = value => value ? String(value).replace('T', ' ').slice(0, 16) : '—';

  const STATE = {
    draft: { label: 'Szkic', tone: '' },
    validated: { label: 'Zweryfikowane', tone: 'ok' },
    planned: { label: 'Zaplanowane', tone: 'warn' },
    dispatched: { label: 'Wysłane', tone: 'warn' },
    accepted: { label: 'Przyjęte', tone: 'ok' },
    in_progress: { label: 'W realizacji', tone: 'ok' },
    completed: { label: 'Zakończone', tone: '' },
    settlement_pending: { label: 'Do rozliczenia', tone: 'warn' },
    settled: { label: 'Rozliczone', tone: 'ok' },
    closed: { label: 'Zamknięte', tone: 'ok' },
    blocked: { label: 'Zablokowane', tone: 'danger' },
    cancelled: { label: 'Anulowane', tone: 'danger' },
  };

  let orders = [];
  let loadError = '';
  let activeLane = 'all';
  let sourceMode = 'legacy';
  let activeView = 'queue';
  let resources = { drivers: [], vehicles: [] };

  function project(order) {
    const missingAssignment = (!order.driver_id && !order.driver_name) || (!order.vehicle_id && !order.nr_rej);
    const exceptions = [];
    if (!order.origin || !order.destination) exceptions.push('Niepełna trasa');
    if (missingAssignment && order.status === 'planned') exceptions.push('Brak pełnego przydziału');
    if (!order.scheduled_start) exceptions.push('Brak terminu');
    return {
      ...order,
      operationState: order.status || 'planned',
      exceptions,
      readiness: {
        plan: order.scheduled_start && order.origin && order.destination ? 'ready' : 'partial',
        dispatch: missingAssignment ? 'missing' : 'partial',
        proof: 'missing',
        settlement: order.status === 'completed' ? 'partial' : 'missing',
      },
    };
  }

  function laneFor(order) {
    const today = new Date().toISOString().slice(0, 10);
    if (order.exceptions.length) return 'reaction';
    if (order.operationState === 'in_progress') return 'execution';
    if (['completed','settlement_pending'].includes(order.operationState)) return 'settlement';
    if (String(order.scheduled_start || '').slice(0, 10) === today) return 'today';
    return 'planning';
  }

  async function render() {
    const el = document.getElementById('page-operations-workbench');
    if (!el) return;
    el.innerHTML = '<div class="empty" style="padding:48px"><i class="ti ti-loader-2"></i> Ładowanie centrum operacyjnego…</div>';
    loadError = '';
    try {
      const params = new URLSearchParams({ company: Co() });
      const operationsResponse = await fetch(`${API()}/api/operations?${params}`, { headers: H() });
      if (operationsResponse.ok) {
        const payload = await operationsResponse.json();
        sourceMode = payload.capabilities?.mode || 'read_write';
        orders = (payload.operations || []).map(operation => ({
          id: operation.id, title: operation.title, priority: operation.priority,
          operationState: operation.state, scheduled_start: operation.schedule?.start,
          scheduled_end: operation.schedule?.end, origin: operation.route?.origin,
          destination: operation.route?.destination,
          driver_name: operation.assignments?.driver?.resource_label,
          nr_rej: operation.assignments?.vehicle?.resource_label,
          readiness: operation.readiness,
          exceptions: (operation.exceptions || []).map(item => item.message || item.code || String(item)),
          version: operation.version,
          stops: operation.route?.stops || [], assignments: operation.assignments?.all || [],
          tasks: operation.tasks || [], proofs: operation.proofs || [], pod: operation.pod || {complete:false,items:[]},
          settlement: operation.settlement || null, raw: operation,
        }));
      } else if ([404, 500].includes(operationsResponse.status)) {
        const legacyResponse = await fetch(`${API()}/api/transport-orders?${params}`, { headers: H() });
        if (!legacyResponse.ok) throw new Error(`HTTP ${legacyResponse.status}`);
        const legacyPayload = await legacyResponse.json();
        sourceMode = 'legacy';
        orders = (Array.isArray(legacyPayload) ? legacyPayload : legacyPayload.orders || []).map(project);
      } else {
        throw new Error(`HTTP ${operationsResponse.status}`);
      }
    } catch (error) {
      orders = [];
      loadError = error?.message || 'Nie udało się pobrać danych';
    }
    draw();
  }

  function laneCount(lane) {
    return orders.filter(order => laneFor(order) === lane).length;
  }

  function readiness(label, value) {
    const text = { ready: 'gotowe', partial: 'częściowe', missing: 'brak' }[value] || value;
    const color = value === 'ready' ? '#16a34a' : value === 'partial' ? '#d97706' : 'var(--text3)';
    return `<span title="${e(label)}" style="font-size:10px;color:${color};white-space:nowrap"><i class="ti ti-${value === 'ready' ? 'circle-check' : value === 'partial' ? 'progress' : 'circle-dashed'}"></i> ${e(label)}: ${e(text)}</span>`;
  }

  function draw() {
    const el = document.getElementById('page-operations-workbench');
    if (!el) return;
    const lanes = [
      ['all', 'Wszystkie', orders.length],
      ['reaction', 'Do reakcji', laneCount('reaction')],
      ['today', 'Dzisiaj', laneCount('today')],
      ['planning', 'Planowanie', laneCount('planning')],
      ['execution', 'Realizacja', laneCount('execution')],
      ['settlement', 'Rozliczenie', laneCount('settlement')],
    ];
    const visible = activeLane === 'all' ? orders : orders.filter(order => laneFor(order) === activeLane);
    el.innerHTML = `
<div class="page-header">
  <div><h2 style="margin-bottom:4px"><i class="ti ti-layout-dashboard"></i> Centrum operacyjne</h2>
  <div style="font-size:12px;color:var(--text3)">Oś operacji · planowanie, realizacja, POD i rozliczenie</div></div>
  <div style="display:flex;gap:8px"><span class="pill ${sourceMode === 'legacy' ? 'warn' : 'ok'}"><i class="ti ti-${sourceMode === 'legacy' ? 'database-off' : 'database-check'}"></i> ${sourceMode === 'legacy' ? 'Tryb zgodności' : 'Operations v1'}</span><button class="btn-secondary" onclick="window.OperationsWorkbench.render()"><i class="ti ti-refresh"></i> Odśwież</button></div>
</div>
${sourceMode === 'legacy' ? `<div style="padding:10px 12px;margin-bottom:14px;border:1px solid #f59e0b55;background:#f59e0b12;border-radius:8px;font-size:12px"><strong>Tryb zgodności:</strong> migracja v54 nie jest dostępna na tym środowisku. Widok korzysta z transport_orders i nie udostępnia komend.</div>` : ''}
${loadError ? `<div style="padding:12px;margin-bottom:12px;background:#dc262615;color:#dc2626;border-radius:8px">Błąd odczytu: ${e(loadError)}</div>` : ''}
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
${lanes.map(([key, label, count]) => `<button class="${activeLane === key ? 'btn-primary' : 'btn-secondary'}" data-lane="${e(key)}" onclick="window.OperationsWorkbench.setLane(this.dataset.lane)">${e(label)} <strong>${count}</strong></button>`).join('')}
<span style="flex:1"></span>
${[['queue','Lista','list'],['gantt','Gantt','chart-gantt'],['map','Mapa','map-2']].map(([key,label,icon]) => `<button class="${activeView === key ? 'btn-primary' : 'btn-secondary'}" data-view="${key}" onclick="window.OperationsWorkbench.setView(this.dataset.view)"><i class="ti ti-${icon}"></i> ${label}</button>`).join('')}
</div>
${activeView === 'queue' ? `
<div class="table-wrap"><table class="data-table">
<thead><tr><th>Operacja</th><th>Trasa i termin</th><th>Przydział</th><th>Gotowość pionu</th><th>Stan</th><th>Wyjątki</th><th></th></tr></thead>
<tbody>${visible.length ? visible.map(order => {
      const state = STATE[order.operationState] || { label: order.operationState, tone: '' };
      return `<tr>
  <td><strong>${e(order.title || 'Bez tytułu')}</strong><div style="font-size:10px;color:var(--text3);font-family:monospace">${e(order.id)}</div></td>
  <td>${e(order.origin || '—')} → ${e(order.destination || '—')}<div style="font-size:11px;color:var(--text3)">${fmtDT(order.scheduled_start)} – ${fmtDT(order.scheduled_end)}</div></td>
  <td>${e(order.driver_name || 'Brak kierowcy')}<div style="font-size:11px;color:var(--text3)">${e(order.nr_rej || 'Brak pojazdu')}</div></td>
  <td><div style="display:grid;gap:2px">${readiness('plan', order.readiness.plan)}${readiness('dispatch', order.readiness.dispatch)}${readiness('POD', order.readiness.proof)}${readiness('rozliczenie', order.readiness.settlement)}</div></td>
  <td><span class="pill ${e(state.tone)}">${e(state.label)}</span></td>
  <td>${order.exceptions.length ? order.exceptions.map(item => `<div style="font-size:11px;color:#dc2626"><i class="ti ti-alert-triangle"></i> ${e(item)}</div>`).join('') : '<span style="color:#16a34a;font-size:11px"><i class="ti ti-check"></i> Brak wykrytych</span>'}</td>
  <td><button class="btn-icon" data-id="${e(order.id)}" onclick="window.OperationsWorkbench.openDetails(this.dataset.id)" title="Otwórz centrum operacji"><i class="ti ti-chevron-right"></i></button></td>
</tr>`;
    }).join('') : '<tr><td colspan="7" class="empty">Brak operacji w wybranej kolejce</td></tr>'}</tbody>
</table></div>` : activeView === 'gantt' ? renderGantt(visible) : renderMap(visible)}`;
  }

  function setLane(lane) {
    activeLane = lane || 'all';
    draw();
  }

  function setView(view) {
    activeView = ['queue','gantt','map'].includes(view) ? view : 'queue';
    draw();
  }

  function renderGantt(list) {
    const valid = list.filter(item => item.scheduled_start);
    if (!valid.length) return '<div class="empty" style="padding:40px">Brak operacji z terminem do pokazania na Gantcie</div>';
    const min = Math.min(...valid.map(item => new Date(item.scheduled_start).getTime()));
    const max = Math.max(...valid.map(item => new Date(item.scheduled_end || item.scheduled_start).getTime()), min + 86400000);
    const span = Math.max(max - min, 3600000);
    return `<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden">
      <div style="display:grid;grid-template-columns:220px 1fr;background:var(--bg2);font-size:11px;font-weight:600"><div style="padding:9px">Operacja / zasób</div><div style="padding:9px;display:flex;justify-content:space-between"><span>${fmtDT(new Date(min).toISOString())}</span><span>${fmtDT(new Date(max).toISOString())}</span></div></div>
      ${valid.map(item => {
        const start = new Date(item.scheduled_start).getTime(); const end = new Date(item.scheduled_end || item.scheduled_start).getTime();
        const left = Math.max(0, (start-min)/span*100); const width = Math.max(2, (Math.max(end-start,1800000))/span*100);
        return `<div style="display:grid;grid-template-columns:220px 1fr;border-top:1px solid var(--border);min-height:48px;cursor:pointer" data-id="${e(item.id)}" onclick="window.OperationsWorkbench.openDetails(this.dataset.id)"><div style="padding:7px 9px"><strong>${e(item.title)}</strong><div style="font-size:10px;color:var(--text3)">${e(item.driver_name||'—')} · ${e(item.nr_rej||'—')}</div></div><div style="position:relative;background:repeating-linear-gradient(90deg,transparent,transparent 9.8%,var(--border) 10%)"><div style="position:absolute;left:${left}%;width:${Math.min(width,100-left)}%;top:10px;height:27px;border-radius:6px;background:var(--primary);color:#fff;padding:5px 7px;font-size:10px;overflow:hidden;white-space:nowrap">${e(STATE[item.operationState]?.label || item.operationState)}</div></div></div>`;
      }).join('')}</div>`;
  }

  function renderMap(list) {
    const stops = list.flatMap(item => (item.stops || []).filter(stop => stop.latitude != null && stop.longitude != null).map(stop => ({ ...stop, operation: item })));
    if (!stops.length) return `<div style="min-height:360px;border:1px dashed var(--border);border-radius:10px;display:flex;align-items:center;justify-content:center;text-align:center;color:var(--text3)"><div><i class="ti ti-map-off" style="font-size:40px"></i><p>Brak współrzędnych przystanków.</p><small>Operacje pozostają dostępne w widoku listy i Gantta.</small></div></div>`;
    setTimeout(() => initOperationsMap(stops), 0);
    return '<div id="operations-map" style="height:520px;border:1px solid var(--border);border-radius:10px"></div>';
  }

  function initOperationsMap(stops) {
    const el = document.getElementById('operations-map');
    if (!el || !window.L) { if (el) el.innerHTML = '<div class="empty" style="padding:40px">Biblioteka mapy jest niedostępna</div>'; return; }
    const map = L.map(el).setView([52, 19], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 18 }).addTo(map);
    const markers = stops.map(stop => L.marker([stop.latitude, stop.longitude]).bindPopup(`<strong>${e(stop.operation.title)}</strong><br>${e(stop.name || stop.address || stop.stop_type)}`).addTo(map));
    if (markers.length) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.15));
  }

  const NEXT_ACTIONS = {
    draft: [['operation.validate','Waliduj']], validated: [['operation.plan','Zaplanuj']], planned: [['operation.plan','Zmień plan'],['operation.dispatch','Wyślij do kierowcy']],
    dispatched: [['operation.accept','Akceptuj'],['operation.reject','Odrzuć']], accepted: [['operation.start','Rozpocznij']],
    in_progress: [['operation.complete','Zakończ']], completed: [['operation.submit_settlement','Przekaż do rozliczenia']],
    settlement_pending: [['operation.settle','Rozlicz']], settled: [['operation.close','Zamknij']],
  };

  async function openDetails(id) {
    const order = orders.find(item => item.id === id);
    if (!order) return;
    let events = [];
    if (sourceMode !== 'legacy') {
      try { const response = await fetch(`${API()}/api/operations/${encodeURIComponent(id)}/events?company=${encodeURIComponent(Co())}`, { headers: H() }); if (response.ok) events = (await response.json()).events || []; } catch {}
    }
    document.getElementById('operations-detail-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'operations-detail-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9300;display:flex;justify-content:flex-end';
    const actions = sourceMode === 'legacy' ? [] : (NEXT_ACTIONS[order.operationState] || []);
    overlay.innerHTML = `<aside style="width:min(680px,96vw);height:100%;background:var(--bg);overflow:auto;padding:22px;box-shadow:-8px 0 30px rgba(0,0,0,.18)">
      <div style="display:flex;align-items:start;gap:10px"><div><h2 style="margin:0 0 4px">${e(order.title)}</h2><div style="font-size:11px;color:var(--text3)">${e(order.id)} · wersja ${e(order.version || '—')}</div></div><button class="btn-icon" style="margin-left:auto" onclick="document.getElementById('operations-detail-overlay').remove()"><i class="ti ti-x"></i></button></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:18px 0">${actions.map(([command,label]) => command === 'operation.plan' ? `<button class="btn-primary" data-id="${e(id)}" onclick="window.OperationsWorkbench.openPlan(this.dataset.id)"><i class="ti ti-calendar-cog"></i> ${e(label)}</button>` : `<button class="btn-secondary" data-id="${e(id)}" data-command="${e(command)}" onclick="window.OperationsWorkbench.runCommand(this.dataset.id,this.dataset.command)">${e(label)}</button>`).join('')}<button class="btn-secondary" data-id="${e(id)}" onclick="window.OperationsWorkbench.runCommand(this.dataset.id,'operation.block')"><i class="ti ti-alert-triangle"></i> Zablokuj</button></div>
      <h3>Przystanki</h3><div style="display:grid;gap:8px">${(order.stops || []).map(stop => `<div style="border:1px solid var(--border);border-radius:8px;padding:10px;display:flex;gap:10px;align-items:center"><span class="pill">${e(stop.sequence_no)}</span><div style="flex:1"><strong>${e(stop.name || stop.address || stop.stop_type)}</strong><div style="font-size:11px;color:var(--text3)">${fmtDT(stop.window_start)} – ${fmtDT(stop.window_end)}</div></div><select data-operation="${e(id)}" data-stop="${e(stop.id)}" onchange="window.OperationsWorkbench.updateStop(this.dataset.operation,this.dataset.stop,this.value)" ${sourceMode === 'legacy' ? 'disabled' : ''}>${['planned','arrived','in_progress','completed','skipped','failed'].map(status => `<option value="${status}" ${stop.status===status?'selected':''}>${status}</option>`).join('')}</select></div>`).join('') || '<div class="empty">Brak przystanków</div>'}</div>
      <h3 style="margin-top:20px">POD i kompletność</h3><div style="border:1px solid var(--border);border-radius:8px;padding:10px">${(order.pod?.items||[]).map(item => `<div style="display:flex;justify-content:space-between;font-size:12px;margin:4px 0"><span>${e(item.proof_type)} ${item.overdue?'<span class="pill danger">po SLA</span>':''}</span><strong style="color:${item.complete?'#16a34a':'#dc2626'}">${e(item.count)}/${e(item.required)}</strong></div>`).join('') || '<div style="font-size:12px;color:var(--text3)">Brak skonfigurowanych wymagań</div>'}<div style="display:flex;gap:8px;margin-top:9px"><button class="btn-secondary" data-id="${e(id)}" onclick="window.OperationsWorkbench.openProofLink(this.dataset.id)"><i class="ti ti-link"></i> Połącz istniejący dowód</button>${order.operationState==='completed'?`<button class="btn-primary" data-id="${e(id)}" onclick="window.OperationsWorkbench.openSettlement(this.dataset.id)"><i class="ti ti-calculator"></i> Przygotuj rozliczenie</button>`:''}</div></div>
      ${order.settlement?`<div style="margin-top:12px;padding:10px;background:var(--bg2);border-radius:8px;font-size:12px"><strong>Rozliczenie v${e(order.settlement.settlement_version)}</strong><div>Plan: ${e(Number(order.settlement.planned_cost_pln||0).toFixed(2))} zł · wykonanie: ${e(Number(order.settlement.actual_cost_pln||0).toFixed(2))} zł · marża: ${e(Number(order.settlement.margin_pln||0).toFixed(2))} zł</div></div>`:''}
      <h3 style="margin-top:20px">Oś czasu</h3><div style="border-left:2px solid var(--border);margin-left:8px;padding-left:16px">${events.length ? events.slice().reverse().map(event => `<div style="position:relative;margin-bottom:14px"><span style="position:absolute;width:10px;height:10px;border-radius:50%;background:var(--primary);left:-22px;top:4px"></span><strong style="font-size:12px">${e(event.event_type)}</strong><div style="font-size:11px;color:var(--text3)">${e(event.from_state || '—')} → ${e(event.to_state || '—')} · ${fmtDT(event.occurred_at)}</div></div>`).join('') : '<div class="empty">Historia będzie dostępna po migracji v54</div>'}</div>
    </aside>`;
    overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  async function loadResources() {
    if (resources.drivers.length || sourceMode === 'legacy') return;
    const response = await fetch(`${API()}/api/operations/resources?company=${encodeURIComponent(Co())}`, { headers: H() });
    if (!response.ok) throw new Error(await apiError(response));
    resources = await response.json();
  }

  async function openPlan(id) {
    const order = orders.find(item => item.id === id); if (!order) return;
    try { await loadResources(); } catch (error) { notify(`Nie można pobrać zasobów: ${error.message}`); return; }
    document.getElementById('operations-plan-overlay')?.remove();
    const modal = document.createElement('div'); modal.id = 'operations-plan-overlay';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9400;display:flex;align-items:center;justify-content:center';
    const assignedDriver = order.assignments?.find(item => item.resource_type === 'driver');
    const assignedVehicle = order.assignments?.find(item => item.resource_type === 'vehicle');
    modal.innerHTML = `<div style="background:var(--bg);border-radius:12px;padding:22px;width:min(620px,96vw)"><h3>Plan i przydział · wersja ${e(order.version)}</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><label>Kierowca<select id="op-plan-driver" style="width:100%"><option value="">— wybierz —</option>${resources.drivers.map(item => `<option value="${e(item.id)}" ${String(assignedDriver?.resource_id)===String(item.id)?'selected':''}>${e(item.label)}</option>`).join('')}</select></label><label>Pojazd<select id="op-plan-vehicle" style="width:100%"><option value="">— wybierz —</option>${resources.vehicles.map(item => `<option value="${e(item.id)}" ${String(assignedVehicle?.resource_id)===String(item.id)?'selected':''}>${e(item.label)} ${e([item.make,item.model].filter(Boolean).join(' '))}</option>`).join('')}</select></label><label>Start<input id="op-plan-start" type="datetime-local" value="${e(String(order.scheduled_start||'').slice(0,16))}" style="width:100%"></label><label>Koniec<input id="op-plan-end" type="datetime-local" value="${e(String(order.scheduled_end||'').slice(0,16))}" style="width:100%"></label></div>
      <div id="op-plan-result" style="margin-top:12px"></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px"><button class="btn-secondary" onclick="document.getElementById('operations-plan-overlay').remove()">Anuluj</button><button class="btn-secondary" data-id="${e(id)}" onclick="window.OperationsWorkbench.previewPlan(this.dataset.id)"><i class="ti ti-shield-check"></i> Sprawdź plan</button><button id="op-plan-commit" class="btn-primary" data-id="${e(id)}" onclick="window.OperationsWorkbench.commitPlan(this.dataset.id)" disabled>Zapisz wersję planu</button></div></div>`;
    document.body.appendChild(modal);
  }

  function planPayload(id) {
    const order = orders.find(item => item.id === id); const start = document.getElementById('op-plan-start')?.value; const end = document.getElementById('op-plan-end')?.value;
    const driverEl = document.getElementById('op-plan-driver'); const vehicleEl = document.getElementById('op-plan-vehicle');
    const assignments = [];
    if (driverEl?.value) assignments.push({ resource_type:'driver', resource_id:driverEl.value, resource_label:driverEl.selectedOptions[0]?.textContent, starts_at:start, ends_at:end });
    if (vehicleEl?.value) assignments.push({ resource_type:'vehicle', resource_id:vehicleEl.value, resource_label:vehicleEl.selectedOptions[0]?.textContent, starts_at:start, ends_at:end });
    return { expected_version: order?.version, assignments };
  }

  async function previewPlan(id) {
    const result = document.getElementById('op-plan-result'); const commit = document.getElementById('op-plan-commit');
    try { const response = await fetch(`${API()}/api/operations/${encodeURIComponent(id)}/plan-preview?company=${encodeURIComponent(Co())}`, { method:'POST', headers:{...H(),'Content-Type':'application/json'}, body:JSON.stringify(planPayload(id)) }); const data = await response.json();
      if (!response.ok || !data.committable) { if (commit) commit.disabled = true; if (result) result.innerHTML = `<div style="padding:10px;background:#dc262615;color:#dc2626;border-radius:8px"><strong>Plan ma konflikty:</strong>${(data.conflicts||[]).map(item => `<div>${e(item.resource_label||item.resource_type)}: ${e(item.title)} (${fmtDT(item.starts_at)}–${fmtDT(item.ends_at)})</div>`).join('') || `<div>${e(data.error||'Nie można zapisać planu')}</div>`}</div>`; return; }
      if (commit) commit.disabled = false; if (result) result.innerHTML = '<div style="padding:10px;background:#16a34a15;color:#16a34a;border-radius:8px"><i class="ti ti-check"></i> Brak konfliktów. Plan można zapisać.</div>';
    } catch (error) { if (commit) commit.disabled = true; if (result) result.textContent = error.message; }
  }

  async function commitPlan(id) { const payload = planPayload(id); await runCommand(id,'operation.plan',{ assignments:payload.assignments }); document.getElementById('operations-plan-overlay')?.remove(); }

  async function runCommand(id, commandType, payload = {}) {
    const order = orders.find(item => item.id === id); if (!order || sourceMode === 'legacy') return;
    if (commandType === 'operation.block') payload = { reason_code:'manual_block', message:'Zablokowano przez dyspozytora', recoverable:true };
    try { const response = await fetch(`${API()}/api/operations/${encodeURIComponent(id)}/commands?company=${encodeURIComponent(Co())}`, { method:'POST', headers:{...H(),'Content-Type':'application/json'}, body:JSON.stringify({ command_type:commandType, expected_version:order.version, idempotency_key:`ui:${id}:${commandType}:${Date.now()}`, payload }) });
      if (!response.ok) throw new Error(await apiError(response)); notify('Operacja została zaktualizowana'); document.getElementById('operations-detail-overlay')?.remove(); await render();
    } catch (error) { notify(error.message, true); }
  }

  async function updateStop(operationId, stopId, status) {
    if (sourceMode === 'legacy') return;
    const order = orders.find(item => item.id === operationId); if (!order) return;
    try { const response = await fetch(`${API()}/api/operations/${encodeURIComponent(operationId)}/stops/${encodeURIComponent(stopId)}?company=${encodeURIComponent(Co())}`, { method:'PUT',headers:{...H(),'Content-Type':'application/json'},body:JSON.stringify({status,expected_version:order.version,idempotency_key:`ui:${operationId}:stop:${stopId}:${Date.now()}`}) }); if (!response.ok) throw new Error(await apiError(response)); notify('Status przystanku zapisany'); await render(); await openDetails(operationId); }
    catch (error) { notify(error.message, true); }
  }

  function openProofLink(id) {
    const order=orders.find(item=>item.id===id); if(!order||sourceMode==='legacy') return;
    const sourceType=prompt('Typ źródła: smart_form, document lub protocol','document'); if(!sourceType) return;
    const sourceId=prompt('Identyfikator istniejącego formularza, dokumentu lub protokołu'); if(!sourceId) return;
    const proofType=prompt('Typ dowodu: signature, photo, document, location, form, cmr','document'); if(!proofType) return;
    linkProof(id,{source_type:sourceType,source_id:sourceId,proof_type:proofType,expected_version:order.version,idempotency_key:`ui:${id}:proof:${Date.now()}`});
  }

  async function linkProof(id,payload) { try { const response=await fetch(`${API()}/api/operations/${encodeURIComponent(id)}/proofs/link?company=${encodeURIComponent(Co())}`,{method:'POST',headers:{...H(),'Content-Type':'application/json'},body:JSON.stringify(payload)}); if(!response.ok) throw new Error(await apiError(response)); notify('Dowód POD został połączony'); document.getElementById('operations-detail-overlay')?.remove(); await render(); await openDetails(id); } catch(error){notify(error.message,true);} }

  function openSettlement(id) { const order=orders.find(item=>item.id===id); if(!order) return; const actual=prompt('Rzeczywisty dystans (km)',String(order.raw?.schedule?.actual_distance_km||order.raw?.distance_km||'')); if(actual===null)return; const revenue=prompt('Przychód netto PLN','0'); if(revenue===null)return; const client=prompt('Nazwa klienta',''); prepareSettlement(id,{actual_distance_km:Number(actual||0),revenue_net_pln:Number(revenue||0),client_name:client||null,expected_version:order.version}); }
  async function prepareSettlement(id,payload){try{const response=await fetch(`${API()}/api/operations/${encodeURIComponent(id)}/settlement/prepare?company=${encodeURIComponent(Co())}`,{method:'POST',headers:{...H(),'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!response.ok)throw new Error(await apiError(response));notify('Rozliczenie zostało przygotowane');document.getElementById('operations-detail-overlay')?.remove();await render();await openDetails(id);}catch(error){notify(error.message,true);}}

  async function apiError(response) { try { const data = await response.json(); return data.error || `HTTP ${response.status}`; } catch { return `HTTP ${response.status}`; } }
  function notify(message, danger = false) { if (typeof window.toast === 'function') window.toast(`${danger?'❌':'✓'} ${message}`); else if (typeof toast === 'function') toast(`${danger?'❌':'✓'} ${message}`); else console[danger?'error':'log'](message); }

  window.OperationsWorkbench = { render, setLane, setView, openDetails, openPlan, previewPlan, commitPlan, runCommand, updateStop, openProofLink, linkProof, openSettlement, prepareSettlement };
})();
