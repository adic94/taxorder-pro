/**
 * TaxOrder Pro — AI Chat
 * Komunikacja z /api/ai/chat (Cloudflare Worker → Claude API)
 */
(function () {
  const API = (window.CF_API_URL || '').replace(/\/$/, '');
  let _history = [];

  function _token() { return localStorage.getItem('cf_token'); }

  function _fleetSummary() {
    if (!document.getElementById('ai-fleet-ctx')?.checked) return null;
    const vehs = window.vehs || [];
    if (!vehs.length) return null;

    const company = typeof getCurrentCompany === 'function' ? getCurrentCompany() : {};
    const total = vehs.length;
    const byBrand = {};
    const byCat = {};
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

    return `Firma: ${company.name || 'nieznana'} | Pojazdów: ${total} | Marki: ${topBrands} | Kategorie DT-1: ${cats || 'brak zaznaczonych'} | Łączny podatek: ${Math.round(totalTax).toLocaleString('pl-PL')} zł`;
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
    bubble.textContent = text;

    if (role === 'user') {
      wrap.appendChild(bubble);
      wrap.appendChild(avatar);
    } else {
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
    if (btn) { btn.disabled = on; btn.innerHTML = on ? '<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i>...' : '<i class="ti ti-send"></i>Wyślij'; }
    if (input) input.disabled = on;
  }

  window.aiSend = async function () {
    const input = document.getElementById('ai-input');
    const message = input?.value?.trim();
    if (!message) return;

    input.value = '';
    _addMsg('user', message);
    _setLoading(true);

    try {
      const resp = await fetch(API + '/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + _token(),
        },
        body: JSON.stringify({
          message,
          fleetSummary: _fleetSummary(),
          history: _history,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Błąd serwera');

      const answer = data.answer;
      _addMsg('assistant', answer);
      _history.push({ role: 'user', content: message });
      _history.push({ role: 'assistant', content: answer });
      if (_history.length > 12) _history = _history.slice(-12);

    } catch (e) {
      _addMsg('assistant', '⚠ Błąd: ' + e.message);
    } finally {
      _setLoading(false);
      document.getElementById('ai-input')?.focus();
    }
  };

  window.aiExample = function (btn) {
    const input = document.getElementById('ai-input');
    if (input) { input.value = btn.textContent; input.focus(); }
  };

  window.aiClear = function () {
    _history = [];
    const container = document.getElementById('ai-messages');
    if (!container) return;
    container.innerHTML = '';
    _addMsg('assistant', 'Rozmowa wyczyszczona. Jak mogę pomóc?');
  };

  console.log('[AI Chat] Moduł załadowany');
})();
