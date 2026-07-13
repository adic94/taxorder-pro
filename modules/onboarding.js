(function () {
  'use strict';
  let _step = 1;
  const STEPS = [
    { icon: 'ti-car', title: 'Dodaj pierwszy pojazd', desc: 'Zacznij od dodania pojazdów do floty.', page: 'pojazdy', btn: 'Przejdź do pojazdów' },
    { icon: 'ti-user', title: 'Dodaj kierowcę', desc: 'Dodaj kierowców i ich dokumenty.', page: 'driver-profiles', btn: 'Przejdź do kierowców' },
    { icon: 'ti-shield-check', title: 'Ustaw politykę flotową', desc: 'Skonfiguruj limity kosztów i wymagania zatwierdzania.', page: 'fleet-policies', btn: 'Ustaw politykę' },
    { icon: 'ti-rocket', title: 'Gotowe!', desc: 'TaxOrder Pro jest gotowy do pracy. Możesz w każdej chwili wrócić do tego kreatora z menu Pomoc.', page: null, btn: 'Zacznij korzystać' },
  ];

  function checkAndShow() {
    if (localStorage.getItem('onboarding_done')) return;
    if (!document.getElementById('onboarding-modal')) _inject();
    _step = 1; _render(); show();
  }

  function _inject() {
    const div = document.createElement('div');
    div.innerHTML = `<div id="onboarding-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:none;align-items:center;justify-content:center">
  <div style="background:var(--bg-card);border-radius:16px;padding:32px;max-width:460px;width:90%;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.3)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
      <span style="font-size:13px;color:var(--text-muted)">Krok <span id="ob-step-num">1</span> / ${STEPS.length}</span>
      <button onclick="window.OnboardingModule.hide()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:20px">✕</button>
    </div>
    <div style="text-align:center;margin-bottom:24px">
      <i id="ob-icon" style="font-size:48px;color:var(--blue,#3b82f6)"></i>
      <h2 id="ob-title" style="font-size:20px;margin:12px 0 8px"></h2>
      <p id="ob-desc" style="color:var(--text-muted);font-size:14px"></p>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:20px">
      ${STEPS.map((_,i) => `<div class="ob-dot" data-i="${i}" style="flex:1;height:4px;border-radius:2px;background:var(--border);transition:background .3s"></div>`).join('')}
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button id="ob-skip" class="btn-secondary" onclick="window.OnboardingModule.hide()">Pomiń kreatora</button>
      <button id="ob-action" class="btn-primary" onclick="window.OnboardingModule._action()"></button>
    </div>
  </div>
</div>`;
    document.body.appendChild(div.firstChild);
  }

  function _render() {
    const modal = document.getElementById('onboarding-modal');
    if (!modal) return;
    const s = STEPS[_step - 1];
    document.getElementById('ob-step-num').textContent = _step;
    const iconEl = document.getElementById('ob-icon');
    if (iconEl) iconEl.className = 'ti ' + s.icon;
    document.getElementById('ob-title').textContent  = s.title;
    document.getElementById('ob-desc').textContent   = s.desc;
    document.getElementById('ob-action').textContent = s.btn;
    document.getElementById('ob-skip').style.display = _step === STEPS.length ? 'none' : '';
    modal.querySelectorAll('.ob-dot').forEach((dot, i) => {
      dot.style.background = i < _step ? 'var(--blue,#3b82f6)' : 'var(--border)';
    });
  }

  function _action() {
    const s = STEPS[_step - 1];
    if (s.page && typeof window.showPage === 'function') { window.showPage(s.page); }
    if (_step < STEPS.length) { _step++; _render(); }
    else { hide(); }
  }

  function show() {
    const m = document.getElementById('onboarding-modal');
    if (m) m.style.display = 'flex';
  }

  function hide() {
    const m = document.getElementById('onboarding-modal');
    if (m) m.style.display = 'none';
    localStorage.setItem('onboarding_done', '1');
  }

  function goTo(step) { _step = Math.max(1, Math.min(step, STEPS.length)); _render(); }

  window.OnboardingModule = { checkAndShow, show, hide, goTo, _action };
})();
