// ==================== VEHICLE DETAIL MODAL ====================
// Karta pojazdu z pełnymi danymi DR, leasingiem, archiwizacją, kartami flotowymi

window.TaxOrderVehicleDetail = {

  open(vehId) {
    const v = vehs.find(x => x.id === vehId);
    if (!v) return;
    this._render(v);
    document.getElementById('vd-modal').style.display = 'flex';
  },

  close() {
    document.getElementById('vd-modal').style.display = 'none';
  },

  async save(vehId) {
    const v = vehs.find(x => x.id === vehId);
    if (!v) return;
    const g = id => document.getElementById('vd-' + id)?.value?.trim() || null;
    const gb = id => document.getElementById('vd-' + id)?.checked || false;

    // Zbierz dane z formularza
    Object.assign(v, {
      dataRejestracji:  g('dataRej'),
      wariant:          g('wariant'),
      dmcMax:           g('dmcMax') ? parseInt(g('dmcMax')) : null,
      masaWlasna:       g('masaWlasna') ? parseInt(g('masaWlasna')) : null,
      pojSilnika:       g('pojSilnika') ? parseInt(g('pojSilnika')) : null,
      mocKW:            g('mocKW') ? parseFloat(g('mocKW')) : null,
      paliwo:           g('paliwo'),
      miejscaSied:      g('miejscaSied') ? parseInt(g('miejscaSied')) : null,
      homologacja:      g('homologacja'),
      docDataWydania:   g('docDataWydania'),
      docWaznyDo:       g('docWaznyDo'),
      // Własność
      ownership_type:   g('ownershipType'),
      leasingCompany:   g('leasingCompany'),
      leasingContractNo:g('leasingContractNo'),
      leasingStart:     g('leasingStart'),
      leasingEnd:       g('leasingEnd'),
      leasingRate:      g('leasingRate') ? parseFloat(g('leasingRate')) : null,
      leasingBuyout:    g('leasingBuyout') ? parseFloat(g('leasingBuyout')) : null,
      leasingKmLimit:   g('leasingKmLimit') ? parseInt(g('leasingKmLimit')) : null,
      rentalCompany:    g('rentalCompany'),
      rentalStart:      g('rentalStart'),
      rentalEnd:        g('rentalEnd'),
      purchaseDate:     g('purchaseDate'),
      purchasePrice:    g('purchasePrice') ? parseFloat(g('purchasePrice')) : null,
      purchaseInvoice:  g('purchaseInvoice'),
      // Sprzedaż
      saleDate:         g('saleDate'),
      saleInvoice:      g('saleInvoice'),
      saleBuyer:        g('saleBuyer'),
      salePrice:        g('salePrice') ? parseFloat(g('salePrice')) : null,
      uwagi:            g('uwagi'),
      insurancePolicyNo: g('insurancePolicyNo'),
      drivetype:        g('driveType'),
      bodyType:         g('bodyType'),
    });

    // Archiwizacja
    const shouldArchive = gb('archiveVeh');
    if (shouldArchive && v.is_active !== false) {
      v.is_active = false;
      v.archivedAt = new Date().toISOString();
      v.archivedReason = g('archivedReason') || 'sprzedaż';
    } else if (!shouldArchive) {
      v.is_active = true;
      v.archivedAt = null;
    }

    // Zapisz do Supabase
    if (window.TaxOrderFleetCloud?.saveVehicle) {
      const r = await window.TaxOrderFleetCloud.saveVehicle(v);
      if (r.ok) {
        toast('✓ Dane pojazdu ' + v.nrRej + ' zapisane');
        this.close();
        if (typeof renderVeh === 'function') renderVeh();
      } else {
        toast('⚠ Błąd zapisu — sprawdź konsolę');
      }
    }
  },

  _render(v) {
    const own = v.ownership_type || 'own';
    const isLeasing = own === 'leasing';
    const isRental  = own === 'rental';
    const isArchived = v.is_active === false;

    const field = (id, label, val, type='text', hint='') => `
      <div class="vdf">
        <label class="vdl">${label}${hint ? `<span class="vdh">${hint}</span>` : ''}</label>
        <input id="vd-${id}" type="${type}" class="fi" value="${val ?? ''}" autocomplete="off">
      </div>`;

    const sel = (id, label, options, val) => `
      <div class="vdf">
        <label class="vdl">${label}</label>
        <select id="vd-${id}" class="fi">
          ${options.map(([v2,l]) => `<option value="${v2}" ${v2===val?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>`;

    document.getElementById('vd-modal-body').innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:16px;border-bottom:0.5px solid var(--border)">
        <div style="width:48px;height:48px;border-radius:var(--radius-lg);background:var(--blue-light);display:flex;align-items:center;justify-content:center">
          <i class="ti ti-truck" style="font-size:24px;color:var(--blue)"></i>
        </div>
        <div>
          <div style="font-size:18px;font-weight:700;font-family:var(--mono)">${v.nrRej}</div>
          <div style="font-size:13px;color:var(--text2)">${v.marka} ${v.model} · ${v.rok || '—'} · ${v.vin || '—'}</div>
        </div>
        ${isArchived ? '<span class="pill pill-red" style="margin-left:auto">ARCHIWUM</span>' : ''}
        <div style="display:flex;gap:8px;${isArchived?'':'margin-left:auto'}">
          ${v.cepikSyncStatus === 'ok' ? '<span class="pill pill-green" style="font-size:10px">CEPiK ✓</span>' :
            v.cepikSyncStatus === 'never' ? '' :
            '<span class="pill pill-amber" style="font-size:10px">CEPiK sync</span>'}
        </div>
      </div>

      <!-- TABS -->
      <div id="vd-tabs" style="display:flex;gap:2px;margin-bottom:20px;background:var(--bg3);border-radius:var(--radius);padding:3px">
        ${['dr','ownership','purchase','archive','notes'].map((t,i) => `
          <button onclick="TaxOrderVehicleDetail._tab('${t}')" id="vd-tab-${t}"
            class="${i===0?'vd-tab-active':''}"
            style="flex:1;padding:6px 4px;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:11px;font-weight:500;
            background:${i===0?'var(--bg)':'transparent'};color:${i===0?'var(--text)':'var(--text2)'}">
            ${{dr:'📋 Dowód rej.',ownership:'🏢 Własność',purchase:'💰 Zakup/Sprzedaż',archive:'📦 Archiwum',notes:'📝 Uwagi'}[t]}
          </button>`).join('')}
      </div>

      <!-- TAB: DOWÓD REJESTRACYJNY -->
      <div id="vd-tab-dr-content" class="vd-tab-content">
        <div class="vdfg">
          ${field('dataRej','B — Data 1. rejestracji', v.dataRejestracji,'date')}
          ${field('docDataWydania','I — Data wydania dowodu', v.docDataWydania,'date')}
          ${field('docWaznyDo','H — Ważny do', v.docWaznyDo,'date')}
          ${field('homologacja','K — Nr homologacji', v.homologacja)}
          ${field('wariant','D.2 — Typ/wariant', v.wariant)}
          ${field('dmcMax','F.1 — DMC max (kg)', v.dmcMax,'number','kg')}
          ${field('masaWlasna','G — Masa własna (kg)', v.masaWlasna,'number','kg')}
          ${field('pojSilnika','P.1 — Pojemność (cm³)', v.pojSilnika,'number','cm³')}
          ${field('mocKW','P.2 — Moc (kW)', v.mocKW,'number','kW')}
          ${field('paliwo','P.3 — Paliwo', v.paliwo)}
          ${field('miejscaSied','S.1 — Miejsca siedz.', v.miejscaSied,'number')}
          ${field('driveType','Rodzaj napędu', v.drivetype)}
          ${field('bodyType','Nadwozie', v.bodyType)}
          ${field('insurancePolicyNo','Nr polisy OC/AC', v.insurancePolicyNo)}
        </div>
        <button class="btn btn-blue" style="width:100%;justify-content:center;margin-top:16px" 
          onclick="TaxOrderVehicleDetail._syncCepik(${v.id})">
          <i class="ti ti-refresh"></i>Synchronizuj z CEPiK
        </button>
      </div>

      <!-- TAB: WŁASNOŚĆ -->
      <div id="vd-tab-ownership-content" class="vd-tab-content" style="display:none">
        <div class="vdfg">
          ${sel('ownershipType','Status własności',[
            ['own','Własność własna'],['leasing','Leasing'],['rental','Wynajem'],
            ['leaseback','Leasing zwrotny'],['service_loan','Pojazd zastępczy']
          ], own)}
        </div>
        <div id="vd-leasing-section" style="${isLeasing?'':'display:none'}">
          <div style="font-size:12px;font-weight:600;color:var(--blue);margin:16px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
            <i class="ti ti-building-bank"></i> Dane leasingowe
          </div>
          <div class="vdfg">
            ${field('leasingCompany','Nazwa leasingodawcy', v.leasingCompany)}
            ${field('leasingContractNo','Nr umowy', v.leasingContractNo)}
            ${field('leasingStart','Data rozpoczęcia', v.leasingStart,'date')}
            ${field('leasingEnd','Data zakończenia', v.leasingEnd,'date')}
            ${field('leasingRate','Rata miesięczna (zł netto)', v.leasingRate,'number')}
            ${field('leasingBuyout','Cena wykupu (zł)', v.leasingBuyout,'number')}
            ${field('leasingKmLimit','Limit km w umowie', v.leasingKmLimit,'number')}
          </div>
        </div>
        <div id="vd-rental-section" style="${isRental?'':'display:none'}">
          <div style="font-size:12px;font-weight:600;color:var(--amber);margin:16px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
            <i class="ti ti-key"></i> Dane najmu
          </div>
          <div class="vdfg">
            ${field('rentalCompany','Nazwa wynajmującego', v.rentalCompany)}
            ${field('rentalStart','Wynajem od', v.rentalStart,'date')}
            ${field('rentalEnd','Wynajem do', v.rentalEnd,'date')}
          </div>
        </div>
      </div>

      <!-- TAB: ZAKUP / SPRZEDAŻ -->
      <div id="vd-tab-purchase-content" class="vd-tab-content" style="display:none">
        <div style="font-size:12px;font-weight:600;color:var(--green);margin-bottom:10px"><i class="ti ti-shopping-cart"></i> Nabycie pojazdu</div>
        <div class="vdfg">
          ${field('purchaseDate','Data zakupu', v.purchaseDate,'date')}
          ${field('purchasePrice','Cena zakupu netto (zł)', v.purchasePrice,'number')}
          ${field('purchaseInvoice','Nr faktury zakupu', v.purchaseInvoice)}
        </div>
        <div style="font-size:12px;font-weight:600;color:var(--red);margin:20px 0 10px"><i class="ti ti-cash"></i> Sprzedaż pojazdu</div>
        <div class="vdfg">
          ${field('saleDate','Data sprzedaży', v.saleDate,'date')}
          ${field('saleInvoice','Nr faktury sprzedaży', v.saleInvoice)}
          ${field('saleBuyer','Nabywca', v.saleBuyer)}
          ${field('salePrice','Cena sprzedaży netto (zł)', v.salePrice,'number')}
        </div>
        <div class="ibox" style="margin-top:14px">
          <i class="ti ti-scan"></i>
          <span>Masz skan faktury? <button class="btn btn-gray" style="font-size:11px;padding:4px 10px" onclick="TaxOrderVehicleDetail._scanInvoice(${v.id})"><i class="ti ti-camera"></i>Skanuj fakturę OCR</button></span>
        </div>
      </div>

      <!-- TAB: ARCHIWUM -->
      <div id="vd-tab-archive-content" class="vd-tab-content" style="display:none">
        <div class="vdfg">
          <div class="vdf" style="grid-column:1/-1">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;padding:12px;background:var(--bg2);border-radius:var(--radius);border:1px solid var(--border)">
              <input type="checkbox" id="vd-archiveVeh" ${isArchived ? 'checked' : ''} onchange="TaxOrderVehicleDetail._onArchiveToggle(this)">
              <span>Oznacz pojazd jako nieaktywny (archiwum)</span>
            </label>
            ${isArchived ? `<div style="font-size:12px;color:var(--text2);margin-top:6px">Zarchiwizowano: ${v.archivedAt ? new Date(v.archivedAt).toLocaleDateString('pl-PL') : '—'}</div>` : ''}
          </div>
          <div class="vdf" style="grid-column:1/-1">
            <label class="vdl">Powód archiwizacji</label>
            <select id="vd-archivedReason" class="fi">
              <option value="sprzedaż" ${v.archivedReason==='sprzedaż'?'selected':''}>Sprzedaż pojazdu</option>
              <option value="złomowanie" ${v.archivedReason==='złomowanie'?'selected':''}>Złomowanie</option>
              <option value="kradzież" ${v.archivedReason==='kradzież'?'selected':''}>Kradzież</option>
              <option value="zwrot_leasingu" ${v.archivedReason==='zwrot_leasingu'?'selected':''}>Zwrot do leasingodawcy</option>
              <option value="inne" ${v.archivedReason==='inne'?'selected':''}>Inne</option>
            </select>
          </div>
        </div>
        ${isArchived ? `<div class="wbox" style="margin-top:14px"><i class="ti ti-archive"></i>Ten pojazd jest nieaktywny — nie pojawia się w deklaracjach DT-1.</div>` : ''}
      </div>

      <!-- TAB: UWAGI -->
      <div id="vd-tab-notes-content" class="vd-tab-content" style="display:none">
        <div style="display:flex;flex-direction:column;gap:12px">
          <div>
            <label class="vdl">Uwagi do pojazdu</label>
            <textarea id="vd-uwagi" class="fi" style="height:120px;resize:vertical">${v.uwagi || ''}</textarea>
          </div>
        </div>
      </div>

      <!-- PRZYPISANE KARTY FLOTOWE -->
      <div style="margin-top:20px;padding-top:16px;border-top:0.5px solid var(--border)">
        <div style="font-size:13px;font-weight:600;margin-bottom:10px;display:flex;align-items:center;gap:8px">
          <i class="ti ti-credit-card" style="color:var(--blue)"></i>Karty flotowe
          <button class="btn btn-gray" style="font-size:11px;margin-left:auto" onclick="TaxOrderVehicleDetail._addCard(${v.id})">
            <i class="ti ti-plus"></i>Dodaj
          </button>
        </div>
        <div id="vd-cards-list">${this._renderCards(v)}</div>
      </div>
    `;

    // Obsługa zmiany typu własności
    document.getElementById('vd-ownershipType')?.addEventListener('change', function() {
      document.getElementById('vd-leasing-section').style.display = this.value==='leasing' ? '' : 'none';
      document.getElementById('vd-rental-section').style.display  = this.value==='rental'  ? '' : 'none';
    });

    document.getElementById('vd-save-btn').onclick = () => this.save(v.id);
  },

  _renderCards(v) {
    const cards = (window.flotCards || []).filter(c => c.nrRej === v.nrRej);
    if (!cards.length) return '<div style="font-size:12px;color:var(--text3)">Brak przypisanych kart</div>';
    return cards.map(c => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg2);border-radius:var(--radius);margin-bottom:6px;font-size:12px">
        <i class="ti ti-credit-card" style="color:var(--blue)"></i>
        <span style="font-family:var(--mono)">${c.nr}</span>
        <span class="pill pill-gray" style="font-size:10px">${c.typ}</span>
        <span style="color:var(--text2)">${c.dostawca || ''}</span>
        <span class="pill ${c.status==='AKTYWNA'?'pill-green':'pill-red'}" style="font-size:10px;margin-left:auto">${c.status}</span>
      </div>`).join('');
  },

  _tab(name) {
    document.querySelectorAll('.vd-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('[id^="vd-tab-"]').forEach(btn => {
      if (btn.id === 'vd-tabs') return;
      btn.style.background = 'transparent';
      btn.style.color = 'var(--text2)';
      btn.classList.remove('vd-tab-active');
    });
    document.getElementById('vd-tab-' + name + '-content').style.display = '';
    const btn = document.getElementById('vd-tab-' + name);
    if (btn) { btn.style.background = 'var(--bg)'; btn.style.color = 'var(--text)'; }
  },

  _onArchiveToggle(cb) {
    const reason = document.getElementById('vd-archivedReason');
    if (reason) reason.closest('.vdf').style.opacity = cb.checked ? '1' : '0.4';
  },

  async _syncCepik(vehId) {
    const v = vehs.find(x => x.id === vehId);
    if (!v) return;
    toast('⏳ Synchronizuję z CEPiK: ' + v.nrRej);
    if (window.TaxOrderFleetCloud?.syncFromCepik) {
      const r = await window.TaxOrderFleetCloud.syncFromCepik(v);
      if (r.ok) {
        toast('✅ CEPiK: zaktualizowano ' + r.fields + ' pól dla ' + v.nrRej);
        await window.TaxOrderFleetCloud.loadVehicles(window.currentCompanyId);
        this.close();
        if (typeof renderVeh === 'function') renderVeh();
      } else {
        toast('⚠ CEPiK: ' + (r.message || r.reason || 'błąd'));
      }
    }
  },

  _addCard(vehId) {
    const v = vehs.find(x => x.id === vehId);
    if (v && typeof openKartaModal === 'function') {
      this.close();
      openKartaModal();
      setTimeout(() => {
        const f = document.getElementById('km-nrrej');
        if (f) f.value = v.nrRej;
      }, 100);
    }
  },

  _scanInvoice(vehId) {
    this.close();
    if (typeof showPage === 'function') showPage('faktury');
    toast('ℹ Wgraj skan faktury — dane zostaną przypisane do pojazdu');
  }
};
