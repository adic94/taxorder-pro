/**
 * TaxOrder Pro — AI Chat
 * Komunikacja z /api/ai/chat (Cloudflare Worker → Groq API)
 * Historia persystowana w localStorage, kontekst bieżącego pojazdu, szybkie pytania
 */
(function () {
  const API = (window.CF_API_URL || '').replace(/\/$/, '');
  const HIST_KEY = 'taxorder-ai-history';
  let _history = [];

  function _saveHistory() {
    try { localStorage.setItem(HIST_KEY, JSON.stringify(_history.slice(-20))); } catch {}
  }

  function _loadHistory() {
    try { _history = JSON.parse(localStorage.getItem(HIST_KEY)) || []; } catch { _history = []; }
  }

  function _vehicleContext() {
    // Pobiera aktywny pojazd z VehicleDetail jeśli otwarty
    const activeId = window.TaxOrderVehicleDetail?._currentVehId;
    if (!activeId) return null;
    const v = (window.vehs||[]).find(x => x.id === activeId);
    if (!v) return null;
    const tax = typeof calcTax === 'function' ? calcTax(v) : {};
    return `Bieżący pojazd: ${v.nrRej} | ${v.marka} ${v.model} ${v.rok||''} | DMC: ${v.dmc??v.dmcMax??'?'} kg | Typ: ${v.typ||'?'} | Kat.DT-1: ${tax.cat||'brak'} | Podatek: ${tax.amount?`${Math.round(tax.amount)} zł`:'—'} | Kierowca: ${v.kierowca||'—'}`;
  }

  function _renderQuickQuestions() {
    const el = document.getElementById('ai-quick-questions');
    if (!el) return;
    const activeId = window.TaxOrderVehicleDetail?._currentVehId;
    const v = activeId ? (window.vehs||[]).find(x => x.id === activeId) : null;
    const vehs = window.vehs || [];
    const questions = v ? [
      `Ile wynosi podatek DT-1 za ${v.nrRej} (${v.marka} ${v.model}, DMC ${v.dmc??v.dmcMax??'?'} kg)?`,
      `Do której kategorii DT-1 należy ${v.nrRej}?`,
      `Kiedy należy odnowić OC dla ${v.nrRej}?`,
      `Jaki jest szacunkowy TCO dla ${v.nrRej} w bieżącym roku?`,
    ] : [
      `Ile mamy pojazdów z kategorią D9?`,
      `Jaki jest łączny podatek DT-1 mojej floty na ${new Date().getFullYear()}?`,
      `Które pojazdy płacą wyższy podatek §1?`,
      `Ile zapłacimy I ratę DT-1 w lutym?`,
      `Jakie są stawki podatku dla pojazdów powyżej 12 ton?`,
    ];
    el.innerHTML = questions.map(q =>
      `<button class="ai-example" onclick="aiAsk(this)" style="text-align:left;font-size:11px">${esc(q)}</button>`
    ).join('');
  }

  function _token() { return localStorage.getItem('cf_token'); }

  function _fleetSummary() {
    if (!document.getElementById('ai-fleet-ctx')?.checked) return null;
    const vehs = window.vehs || [];
    if (!vehs.length) return null;

    const company = typeof getCurrentCompany === 'function' ? getCurrentCompany() : {};
    const byBrand = {}, byCat = {};
    let totalTax = 0;

    vehs.forEach(v => {
      byBrand[v.marka] = (byBrand[v.marka] || 0) + 1;
      const tax = typeof calcTax === 'function' ? calcTax(v) : {};
      if (tax.cat) byCat[tax.cat] = (byCat[tax.cat] || 0) + 1;
      if (tax.amount) totalTax += tax.amount;
    });

    const topBrands = Object.entries(byBrand).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([b, n]) => `${b}: ${n}`).join(', ');
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `${c}: ${n}`).join(', ');

    // Alerty ubezpieczeniowe
    const now = new Date(); now.setHours(0,0,0,0); const DAYS30 = 30 * 86400000;
    const expiring = vehs.filter(v => {
      const check = d => d && (new Date(d) - now) < DAYS30;
      return check(v.ocEnd) || check(v.acEnd) || check(v.nextInspection);
    }).length;

    // Koszty paliwa bieżący miesiąc
    const thisMonth = (d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)(new Date());
    let fuelCostM = 0, fuelLitersM = 0, fuelVehsM = 0;
    vehs.forEach(v => {
      const mh = (v.fuelHistory||[]).filter(h=>(h.date||'').startsWith(thisMonth));
      if (mh.length) { fuelCostM += mh.reduce((s,h)=>s+(h.totalGross||0),0); fuelLitersM += mh.reduce((s,h)=>s+(h.liters||0),0); fuelVehsM++; }
    });

    return `Firma: ${company.name || 'nieznana'} | Pojazdów: ${vehs.length} | Marki: ${topBrands} | Kategorie DT-1: ${cats || 'brak'} | Podatek: ${Math.round(totalTax).toLocaleString('pl-PL')} zł | Alerty terminów: ${expiring} pojazdów${fuelCostM>0?` | Koszty paliwa (mies.): ${Math.round(fuelCostM)} zł / ${fuelLitersM.toFixed(0)} l (${fuelVehsM} pojazdów)`:''}`;
  }

  function _md(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background:var(--bg3);padding:1px 5px;border-radius:3px;font-family:var(--mono);font-size:.85em">$1</code>')
      .replace(/^### (.+)$/gm, '<div style="font-weight:700;margin:8px 0 2px;font-size:13px">$1</div>')
      .replace(/^## (.+)$/gm, '<div style="font-weight:700;margin:10px 0 4px;font-size:14px">$1</div>')
      .replace(/^- (.+)$/gm, '<div style="padding-left:14px;line-height:1.6">• $1</div>')
      .replace(/^(\d+)\. (.+)$/gm, '<div style="padding-left:14px;line-height:1.6">$1. $2</div>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n(?!<)/g, '<br>');
  }

  function _addMsg(role, text) {
    const container = document.getElementById('ai-messages');
    if (!container) return;

    const wrap = document.createElement('div');
    wrap.className = `ai-msg ai-msg-${role === 'user' ? 'user' : 'bot'}`;

    const avatar = document.createElement('div');
    avatar.className = 'ai-avatar';
    avatar.innerHTML = role === 'user'
      ? '<i class="ti ti-user"></i>'
      : '<i class="ti ti-robot"></i>';

    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble';

    if (role === 'user') {
      bubble.textContent = text;
      wrap.appendChild(bubble);
      wrap.appendChild(avatar);
    } else {
      bubble.innerHTML = _md(text);
      wrap.appendChild(avatar);
      wrap.appendChild(bubble);
    }

    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;
    return bubble;
  }

  function _setLoading(on) {
    const btn = document.getElementById('ai-send-btn');
    const input = document.getElementById('ai-input');
    if (btn) {
      btn.disabled = on;
      btn.innerHTML = on
        ? '<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i> Myślę...'
        : '<i class="ti ti-send"></i> Wyślij';
    }
    if (input) input.disabled = on;
  }

  window.aiSend = async function () {
    const input = document.getElementById('ai-input');
    const message = input?.value?.trim();
    if (!message) return;

    input.value = '';
    _addMsg('user', message);
    _setLoading(true);

    const vehCtx = _vehicleContext();
    const fleetCtx = _fleetSummary();
    const combinedCtx = [vehCtx, fleetCtx].filter(Boolean).join(' || ') || null;

    try {
      const resp = await fetch(`${API  }/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${  _token()}`,
        },
        body: JSON.stringify({
          message,
          fleetSummary: combinedCtx,
          history: _history,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Błąd serwera');

      const answer = data.answer;
      _addMsg('assistant', answer);
      _history.push({ role: 'user', content: message });
      _history.push({ role: 'assistant', content: answer });
      if (_history.length > 20) _history = _history.slice(-20);
      _saveHistory();

    } catch (e) {
      _addMsg('assistant', `⚠ Błąd: ${  e.message}`);
    } finally {
      _setLoading(false);
      document.getElementById('ai-input')?.focus();
    }
  };

  // Wyślij z gotowego przycisku szybkiego pytania
  window.aiAsk = function (btn) {
    const input = document.getElementById('ai-input');
    if (input) { input.value = btn.textContent.trim(); window.aiSend(); }
  };

  window.aiExample = function (btn) {
    const input = document.getElementById('ai-input');
    if (input) { input.value = btn.textContent.trim(); input.focus(); }
  };

  window.aiClear = function () {
    _history = [];
    _saveHistory();
    const container = document.getElementById('ai-messages');
    if (!container) return;
    container.innerHTML = '';
    _addMsg('assistant', 'Rozmowa wyczyszczona. Jak mogę pomóc?');
  };

  // Załaduj historię i odtwórz wiadomości
  function _restoreHistory() {
    _loadHistory();
    if (!_history.length) return;
    const container = document.getElementById('ai-messages');
    if (!container) return;
    // Wstaw historię za powitaniem
    _history.forEach(m => { if (m.role && m.content) _addMsg(m.role === 'user' ? 'user' : 'assistant', m.content); });
  }

  // Enter wysyła, Shift+Enter = nowa linia
  const _input = document.getElementById('ai-input');
  if (_input) {
    _input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        window.aiSend();
      }
    });
  }

  // Odśwież szybkie pytania przy otwarciu strony
  document.addEventListener('taxorder-page-change', e => {
    if (e.detail?.page === 'ai') _renderQuickQuestions();
  });

  // Init
  _restoreHistory();
  _renderQuickQuestions();

  console.log(`[AI Chat] Moduł załadowany, historia: ${  _history.length  } wiadomości`);
})();
