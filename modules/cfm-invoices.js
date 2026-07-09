/**
 * TaxOrder Pro — Faktury CFM (zbiorcze per klient+okres, generowane z kontraktów)
 * UWAGA: eksport XML KSeF to struktura POGLĄDOWA wg schematu FA — NIE walidowana
 * względem oficjalnego XSD KSeF. Wymaga weryfikacji przed produkcyjnym użyciem.
 */
window.TaxOrderCfmInvoices = (function () {

  let list = [];

  function _cfApi() { return window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev'; }
  function _token() { return localStorage.getItem('cf_token'); }
  function _headers(extra) {
    const t = _token();
    return { ...(t ? { 'Authorization': 'Bearer ' + t } : {}), ...(extra || {}) };
  }
  function _company() { return window.currentCompanyId || 'mtoilet'; }

  function _clientName(inv) {
    if (inv.client_type === 'COMPANY') return window.COMPANIES?.[inv.client_ref]?.shortName || inv.client_name_cache || inv.client_ref;
    return inv.client_name_cache || '—';
  }
  function _clientFull(inv) {
    if (inv.client_type === 'COMPANY') return window.COMPANIES?.[inv.client_ref] || null;
    return (window.TaxOrderCfmClients?.getAll() || []).find(x => x.id === inv.client_ref) || null;
  }

  async function load() {
    try {
      const resp = await fetch(`${_cfApi()}/api/cfm-invoices?company=${encodeURIComponent(_company())}`, { headers: _headers() });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      list = await resp.json();
    } catch (e) {
      console.warn('[CfmInvoices] load error:', e.message);
      list = [];
    }
    render();
  }

  function render() {
    const tbody = document.getElementById('cfmf-tbody');
    if (!tbody) return;
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text3)"><i class="ti ti-file-invoice" style="font-size:32px;display:block;margin-bottom:8px"></i>Brak wystawionych faktur CFM</td></tr>`;
      return;
    }
    const pillCls = { WYSTAWIONA: 'pill-blue', OPLACONA: 'pill-green', ANULOWANA: 'pill-gray' };
    const pillLbl = { WYSTAWIONA: 'Wystawiona', OPLACONA: 'Opłacona', ANULOWANA: 'Anulowana' };
    tbody.innerHTML = list.map(inv => `<tr>
      <td><strong style="font-family:var(--mono)">${esc(inv.nr_faktury)}</strong></td>
      <td style="font-size:12px">${esc(_clientName(inv))}</td>
      <td style="font-size:12px">${esc(inv.okres)}</td>
      <td style="font-family:var(--mono)">${Number(inv.suma_brutto || 0).toLocaleString('pl-PL')} zł</td>
      <td><span class="pill ${pillCls[inv.status] || 'pill-gray'}">${pillLbl[inv.status] || esc(inv.status)}</span></td>
      <td style="font-size:11px">${esc(inv.termin_platnosci || '—')}</td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="tbtn" onclick="TaxOrderCfmInvoices.downloadPdf('${inv.id}')" title="PDF"><i class="ti ti-file-type-pdf"></i></button>
          <button class="tbtn" onclick="TaxOrderCfmInvoices.downloadXml('${inv.id}')" title="Eksport XML (KSeF)"><i class="ti ti-code"></i></button>
          ${inv.status === 'WYSTAWIONA' ? `<button class="tbtn" onclick="TaxOrderCfmInvoices.markPaid('${inv.id}')" title="Oznacz jako opłaconą"><i class="ti ti-check"></i></button>` : ''}
          <button class="tbtn" onclick="TaxOrderCfmInvoices.remove('${inv.id}')" style="color:var(--red)"><i class="ti ti-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
  }

  function openGenerateModal() {
    const companySel = document.getElementById('cfmg-client-company');
    const extSel = document.getElementById('cfmg-client-external');
    if (companySel) companySel.innerHTML = Object.values(window.COMPANIES || {}).filter(co => co.id !== _company()).map(co => `<option value="${esc(co.id)}">${esc(co.shortName)}</option>`).join('');
    if (extSel) extSel.innerHTML = (window.TaxOrderCfmClients?.getAll() || []).map(cl => `<option value="${esc(cl.id)}">${esc(cl.nazwa)}</option>`).join('');
    document.getElementById('cfmg-client-type').value = 'COMPANY';
    _toggleGenClientType();
    document.getElementById('cfmg-okres').value = new Date().toISOString().slice(0, 7);
    document.getElementById('cfm-generate-modal').classList.remove('hidden');
  }
  function closeGenerateModal() { document.getElementById('cfm-generate-modal').classList.add('hidden'); }
  function _toggleGenClientType() {
    const type = document.getElementById('cfmg-client-type').value;
    document.getElementById('cfmg-client-company-wrap').style.display = type === 'COMPANY' ? 'block' : 'none';
    document.getElementById('cfmg-client-external-wrap').style.display = type === 'EXTERNAL' ? 'block' : 'none';
  }

  async function generate() {
    const clientType = document.getElementById('cfmg-client-type').value;
    const clientRef = clientType === 'COMPANY'
      ? document.getElementById('cfmg-client-company').value
      : document.getElementById('cfmg-client-external').value;
    const okres = document.getElementById('cfmg-okres').value;
    if (!clientRef || !okres) { toast('⚠ Wybierz klienta i okres'); return; }
    const clientName = clientType === 'COMPANY'
      ? window.COMPANIES?.[clientRef]?.shortName
      : (window.TaxOrderCfmClients?.getAll() || []).find(x => x.id === clientRef)?.nazwa;
    try {
      const resp = await fetch(`${_cfApi()}/api/cfm-invoices/generate`, {
        method: 'POST', headers: _headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ company_id: _company(), client_type: clientType, client_ref: clientRef, client_name_cache: clientName, okres })
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error || 'HTTP ' + resp.status);
      }
      const data = await resp.json();
      toast(t('cfminv.toast.generated').replace('{0}', data.nr_faktury).replace('{1}', Number(data.suma_brutto).toLocaleString('pl-PL')));
      closeGenerateModal();
      await load();
    } catch (e) {
      toast(t('cfminv.toast.gen.err').replace('{0}', e.message));
    }
  }

  async function markPaid(id) {
    try {
      const resp = await fetch(`${_cfApi()}/api/cfm-invoices/${id}`, { method: 'PUT', headers: _headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ status: 'OPLACONA' }) });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      toast('✓ Faktura oznaczona jako opłacona');
      await load();
    } catch (e) {
      toast('⚠ Błąd: ' + e.message);
    }
  }

  async function remove(id) {
    if (!confirm('Usunąć fakturę?')) return;
    try {
      const resp = await fetch(`${_cfApi()}/api/cfm-invoices/${id}`, { method: 'DELETE', headers: _headers() });
      if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.error || 'HTTP ' + resp.status); }
      toast('✓ Faktura usunięta');
      await load();
    } catch (e) {
      toast('⚠ Błąd usuwania: ' + e.message);
    }
  }

  // Pasek polskich znaków diakrytycznych — fallback gdy czcionka Roboto nie jest dostępna
  // (StandardFonts.Helvetica w pdf-lib rzuca wyjątkiem przy próbie narysowania ą/ę/ł/ń/ó/ś/ź/ż)
  function _plAscii(s) {
    if (!s) return s;
    const map = { 'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z',
      'Ą':'A','Ć':'C','Ę':'E','Ł':'L','Ń':'N','Ó':'O','Ś':'S','Ź':'Z','Ż':'Z' };
    return String(s).replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, ch => map[ch] || ch);
  }

  // ── Generowanie PDF (wzorzec pdf-lib jak modules/dt1-generator.js, embed Roboto) ──
  async function downloadPdf(id) {
    const inv = list.find(x => x.id === id);
    if (!inv) return;
    if (typeof PDFLib === 'undefined') { toast('⚠ Biblioteka PDF nie jest załadowana'); return; }
    // Czcionka Roboto ładuje się asynchronicznie przy starcie strony (loadAssets() w index.html) —
    // jeśli jeszcze nie skończyła, doczekaj się jej zamiast od razu spadać na Helvetica
    if (!window._ROBOTO_BYTES && typeof loadAssets === 'function') {
      try { await loadAssets(); } catch {}
    }
    const seller = window.COMPANIES?.[_company()];
    const buyer = _clientFull(inv);
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const pdfDoc = await PDFDocument.create();
    let font, fontBold, hasPolish;
    try {
      if (!window._ROBOTO_BYTES) throw new Error('brak czcionki Roboto');
      font = await pdfDoc.embedFont(window._ROBOTO_BYTES);
      fontBold = font;
      hasPolish = true;
    } catch {
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      hasPolish = false;
    }
    const W = 595.28, H = 841.89, M = 40;
    const page = pdfDoc.addPage([W, H]);
    let y = H - M;
    const txt = (s, x, yy, size = 10, bold = false) => {
      const val = hasPolish ? String(s ?? '') : _plAscii(String(s ?? ''));
      try { page.drawText(val, { x, y: yy, size, font: bold ? fontBold : font, color: rgb(0, 0, 0) }); }
      catch { try { page.drawText(_plAscii(val), { x, y: yy, size, font: bold ? fontBold : font, color: rgb(0, 0, 0) }); } catch {} }
    };

    txt(`FAKTURA ${inv.nr_faktury}`, M, y, 16, true); y -= 26;
    txt(`Okres rozliczeniowy: ${inv.okres}`, M, y, 10); y -= 14;
    txt(`Data wystawienia: ${inv.data_wystawienia || '—'}    Termin płatności: ${inv.termin_platnosci || '—'}`, M, y, 10); y -= 28;

    txt('Sprzedawca:', M, y, 9, true);
    txt('Nabywca:', M + 280, y, 9, true); y -= 14;
    txt(seller?.name || _company(), M, y, 9);
    txt(buyer?.nazwa || buyer?.name || inv.client_name_cache || '—', M + 280, y, 9); y -= 12;
    if (seller) { txt(`${seller.ulica || ''} ${seller.dom || ''}`, M, y, 9); }
    if (buyer) { txt(`${buyer.ulica || ''}`, M + 280, y, 9); }
    y -= 12;
    if (seller) { txt(`${seller.kod || ''} ${seller.miasto || ''}`, M, y, 9); }
    if (buyer) { txt(`${buyer.kod || ''} ${buyer.miasto || ''}`, M + 280, y, 9); }
    y -= 12;
    if (seller) { txt(`NIP: ${seller.nip || ''}`, M, y, 9); }
    if (buyer) { txt(`NIP: ${buyer.nip || ''}`, M + 280, y, 9); }
    y -= 26;

    // Tabela pozycji
    const colX = [M, M + 220, M + 280, M + 340, M + 410, M + 480];
    const headers = ['Opis', 'Nr rej.', 'Netto', 'VAT %', 'Wartość VAT', 'Brutto'];
    page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 16, color: rgb(0.92, 0.92, 0.92) });
    headers.forEach((h, i) => txt(h, colX[i] + 2, y, 8, true));
    y -= 20;
    (inv.pozycje || []).forEach(p => {
      if (y < 100) { return; } // proste ograniczenie do 1 strony w v1
      txt((p.opis || '').slice(0, 38), colX[0], y, 8);
      txt(p.nrRej || '', colX[1], y, 8);
      txt(Number(p.wartosc_netto || 0).toFixed(2), colX[2], y, 8);
      txt(String(p.vat_proc ?? 23), colX[3], y, 8);
      txt(Number((p.wartosc_brutto || 0) - (p.wartosc_netto || 0)).toFixed(2), colX[4], y, 8);
      txt(Number(p.wartosc_brutto || 0).toFixed(2), colX[5], y, 8);
      y -= 14;
    });
    y -= 10;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: rgb(0, 0, 0) }); y -= 16;
    txt(`Razem netto: ${Number(inv.suma_netto || 0).toFixed(2)} zł`, M + 300, y, 9, true); y -= 14;
    txt(`Razem VAT: ${Number(inv.suma_vat || 0).toFixed(2)} zł`, M + 300, y, 9, true); y -= 14;
    txt(`Razem brutto: ${Number(inv.suma_brutto || 0).toFixed(2)} zł`, M + 300, y, 11, true);

    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Faktura_${inv.nr_faktury.replace(/\//g, '-')}.pdf`;
    a.click();
  }

  // ── Eksport XML — struktura POGLĄDOWA wg schematu FA, NIEWALIDOWANA względem XSD KSeF ──
  function downloadXml(id) {
    const inv = list.find(x => x.id === id);
    if (!inv) return;
    const seller = window.COMPANIES?.[_company()];
    const buyer = _clientFull(inv);
    const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const wiersze = (inv.pozycje || []).map((p, i) => `
    <FaWiersz>
      <NrWierszaFa>${i + 1}</NrWierszaFa>
      <P_7>${esc(p.opis)}${p.nrRej ? ' (' + esc(p.nrRej) + ')' : ''}</P_7>
      <P_8A>szt</P_8A>
      <P_8B>${p.ilosc ?? 1}</P_8B>
      <P_9A>${(p.cena_netto ?? 0).toFixed(2)}</P_9A>
      <P_11>${(p.wartosc_netto ?? 0).toFixed(2)}</P_11>
      <P_12>${p.vat_proc ?? 23}</P_12>
    </FaWiersz>`).join('');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- UWAGA: struktura poglądowa wg schematu FA — NIEWALIDOWANA względem oficjalnego XSD KSeF.
     Wymaga weryfikacji przed produkcyjnym wysłaniem do systemu KSeF. -->
<Faktura xmlns="http://crd.gov.pl/wzor/2023/06/29/12648/">
  <Naglowek>
    <KodFormularza>FA</KodFormularza>
    <DataWytworzeniaFa>${new Date().toISOString()}</DataWytworzeniaFa>
  </Naglowek>
  <Podmiot1>
    <DaneIdentyfikacyjne>
      <NIP>${esc(seller?.nip)}</NIP>
      <Nazwa>${esc(seller?.name)}</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>PL</KodKraju>
      <AdresL1>${esc(seller?.ulica)} ${esc(seller?.dom)}</AdresL1>
      <AdresL2>${esc(seller?.kod)} ${esc(seller?.miasto)}</AdresL2>
    </Adres>
  </Podmiot1>
  <Podmiot2>
    <DaneIdentyfikacyjne>
      <NIP>${esc(buyer?.nip)}</NIP>
      <Nazwa>${esc(buyer?.nazwa || buyer?.name)}</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>PL</KodKraju>
      <AdresL1>${esc(buyer?.ulica)}</AdresL1>
      <AdresL2>${esc(buyer?.kod)} ${esc(buyer?.miasto)}</AdresL2>
    </Adres>
  </Podmiot2>
  <Fa>
    <KodWaluty>PLN</KodWaluty>
    <P_1>${esc(inv.data_wystawienia)}</P_1>
    <P_2>${esc(inv.nr_faktury)}</P_2>
    <P_13_1>${(inv.suma_netto ?? 0).toFixed(2)}</P_13_1>
    <P_14_1>${(inv.suma_vat ?? 0).toFixed(2)}</P_14_1>
    <P_15>${(inv.suma_brutto ?? 0).toFixed(2)}</P_15>
    <FaWiersze>${wiersze}
    </FaWiersze>
  </Fa>
</Faktura>`;
    const blob = new Blob([xml], { type: 'application/xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Faktura_${inv.nr_faktury.replace(/\//g, '-')}_KSeF.xml`;
    a.click();
    toast('⚠ XML to struktura poglądowa — niewalidowana względem oficjalnego XSD KSeF');
  }

  // Eksport CSV wszystkich faktur do importu w systemie FK (np. enova365 — rozwiązanie pośrednie
  // do czasu potwierdzenia dostępu do modułu WebAPI; import ręczny przez "Mechanizm wymiany danych")
  function exportToFK() {
    if (!list.length) { toast('⚠ Brak faktur do eksportu'); return; }
    const headers = ['Nr faktury', 'Okres', 'Data wystawienia', 'Termin płatności', 'Kontrahent', 'NIP', 'Wartość netto', 'Wartość VAT', 'Wartość brutto', 'Status'];
    const rows = list.map(inv => {
      const buyer = _clientFull(inv);
      return [
        inv.nr_faktury, inv.okres, inv.data_wystawienia || '', inv.termin_platnosci || '',
        _clientName(inv), buyer?.nip || '',
        (inv.suma_netto ?? 0).toFixed(2), (inv.suma_vat ?? 0).toFixed(2), (inv.suma_brutto ?? 0).toFixed(2),
        inv.status,
      ];
    });
    const csv = '﻿' + [headers, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `faktury_cfm_eksport_FK_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast(t('cfminv.toast.export.ok').replace('{0}', rows.length));
  }

  return { load, render, openGenerateModal, closeGenerateModal, generate, markPaid, remove, downloadPdf, downloadXml, exportToFK, _toggleGenClientType };
})();
