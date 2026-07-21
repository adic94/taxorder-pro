// ─── TERYT Autocomplete — GUS gmina search ───────────────────────────────────
// Provides TerytAutocomplete.attach(inputEl, options) and TerytAutocomplete.init(el, vid)
// Calls Worker /api/teryt/search?q=xxx (proxied to BDL API, cached in KV)

window.TerytAutocomplete = (function () {
  const API = () => window.CF_WORKER_URL || '';
  function _tok() { return localStorage.getItem('cf_token') || ''; }

  // Polish-aware normalization for accent-insensitive search
  function _norm(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  // ── Dropdown builder ──────────────────────────────────────────────────────
  function _buildDropdown(inputEl, results, onPick) {
    _removeDropdown();
    if (!results.length) return;

    const rect = inputEl.getBoundingClientRect();
    const dd = document.createElement('div');
    dd.id = '_tac_dd';
    Object.assign(dd.style, {
      position: 'fixed',
      zIndex: '99999',
      top: (rect.bottom + 3) + 'px',
      left: rect.left + 'px',
      width: Math.max(200, rect.width) + 'px',
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      boxShadow: '0 6px 20px rgba(0,0,0,.18)',
      maxHeight: '230px',
      overflowY: 'auto',
      fontSize: '13px',
    });

    const q = _norm(inputEl.value.trim());
    results.forEach((name, i) => {
      const item = document.createElement('div');
      item.className = 'tac-item';
      item.dataset.idx = i;
      Object.assign(item.style, {
        padding: '7px 12px',
        cursor: 'pointer',
        borderBottom: '1px solid var(--border)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        color: 'var(--text)',
      });

      // Podświetl dopasowany fragment
      const nameLow = _norm(name);
      const pos = nameLow.indexOf(q);
      if (pos >= 0 && q.length > 0) {
        item.innerHTML =
          esc(name.slice(0, pos)) +
          '<b style="color:var(--blue)">' + esc(name.slice(pos, pos + q.length)) + '</b>' +
          esc(name.slice(pos + q.length));
      } else {
        item.textContent = name;
      }

      item.addEventListener('mousedown', e => {
        e.preventDefault();
        inputEl.value = name;
        onPick(name);
        _removeDropdown();
      });
      item.addEventListener('mouseover', () => _highlight(dd, i));
      dd.appendChild(item);
    });

    document.body.appendChild(dd);

    // Flip up if outside viewport
    const ddR = dd.getBoundingClientRect();
    if (ddR.bottom > window.innerHeight - 8) {
      dd.style.top = (rect.top - ddR.height - 3) + 'px';
    }
  }

  function _removeDropdown() {
    document.getElementById('_tac_dd')?.remove();
  }

  function _highlight(dd, idx) {
    dd.querySelectorAll('.tac-item').forEach((el, i) => {
      const active = i === idx;
      el.style.background = active ? 'var(--bg3)' : '';
      el.dataset.active = active ? '1' : '';
    });
  }

  function _activeIdx(dd) {
    const items = [...dd.querySelectorAll('.tac-item')];
    return items.findIndex(el => el.dataset.active === '1');
  }

  // ── Core attach ───────────────────────────────────────────────────────────
  function attach(inputEl, options = {}) {
    if (inputEl._terytAttached) return;
    inputEl._terytAttached = true;

    const { onSelect, onChange } = options;
    let timer = null;

    function pick(name) {
      onSelect?.({ name });
      onChange?.(name);
    }

    async function doSearch(q) {
      if (q.length < 2) { _removeDropdown(); return; }
      try {
        const r = await fetch(
          `${API()}/api/teryt/search?q=${encodeURIComponent(q)}`,
          { headers: { Authorization: 'Bearer ' + _tok() }, signal: AbortSignal.timeout(3000) }
        );
        if (!r.ok) return;
        const data = await r.json();
        const results = data.results || [];
        _buildDropdown(inputEl, results, pick);
      } catch {}
    }

    inputEl.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => doSearch(inputEl.value.trim()), 280);
    });

    inputEl.addEventListener('blur', () => setTimeout(_removeDropdown, 160));

    inputEl.addEventListener('keydown', e => {
      const dd = document.getElementById('_tac_dd');
      if (!dd) return;
      const items = [...dd.querySelectorAll('.tac-item')];
      const cur = _activeIdx(dd);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        _highlight(dd, Math.min(cur + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        _highlight(dd, Math.max(cur - 1, 0));
      } else if (e.key === 'Enter' && cur >= 0) {
        e.preventDefault();
        items[cur]?.dispatchEvent(new MouseEvent('mousedown'));
      } else if (e.key === 'Escape') {
        _removeDropdown();
      }
    });

    return { destroy: _removeDropdown };
  }

  // ── Lazy init for fleet table cells (called from onfocus in inline HTML) ──
  // vid = vehicle id (numeric, safe to interpolate)
  function init(inputEl, vid) {
    attach(inputEl, {
      onSelect: ({ name }) => {
        inputEl.value = name;
        if (typeof setV === 'function') setV(vid, 'gmina', name);
        if (typeof renderFormularze === 'function') renderFormularze();
      },
    });
  }

  return { attach, init };
})();
