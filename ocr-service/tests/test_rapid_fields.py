"""
Testy parsera GEOMETRYCZNEGO (extractors/rapid_fields.py) na spreparowanych
bounding boxach — nie wymaga ładowania modeli RapidOCR (parse_fields_spatial
przyjmuje już wyekstrahowane Box-y, nie obraz).

Układ współrzędnych zgodny z realnym dokumentem sprawdzonym wizualnie 24-25.08
(WE6LR80): kolumna beżowa — etykieta NAD wartością; kolumny żółta/niebieska —
etykieta w osobnym boxie PO LEWEJ od wartości, ta sama linia.
"""
import pytest
from extractors.rapid_fields import Box, parse_fields_spatial


def _page():
    return 1000.0, 700.0  # w, h — proporcje zbliżone do renderu 150 DPI landscape


class TestDopasowanieGeometryczne:
    def test_etykieta_po_lewej_wartosc_po_prawej(self):
        """F.1 | 3210 kg — dokładnie układ z realnego dowodu (żółta kolumna)."""
        boxes = [
            Box("F.1", 400, 200, 430, 220, 0.9),
            Box("3210 kg", 445, 200, 520, 220, 0.9),
        ]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["f1_dmc"][0] == "3210"

    def test_etykieta_nad_wartoscia(self):
        """ROK PRODUKCJI (nad) / 2026 (pod) — układ z kolumny beżowej."""
        boxes = [
            Box("ROK PRODUKCJI", 50, 100, 200, 118, 0.9),
            Box("2026", 50, 122, 100, 140, 0.9),
        ]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["rok_prod"][0] == "2026"

    def test_nie_myli_pol_o_tym_samym_kodzie_w_roznych_miejscach(self):
        """Dwa wystąpienia 'G' na stronie (np. szum OCR) — wybiera to z sensowną wartością obok."""
        boxes = [
            Box("G", 10, 10, 20, 25, 0.9),          # szum, brak sąsiada w zasięgu
            Box("G", 400, 300, 415, 320, 0.9),
            Box("2229 kg", 425, 300, 490, 320, 0.9),
        ]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["g_masa_wlasna"][0] == "2229"

    def test_wartosc_poza_zakresem_odrzucona(self):
        """Rok (2026) błędnie przyklejony jako sąsiad F.1 nie przejdzie zakresu 400-60000... więc test na odwrót: wartość spoza zakresu dla P.2 (moc)."""
        boxes = [
            Box("P.2", 400, 250, 420, 268, 0.9),
            Box("99999", 430, 250, 480, 268, 0.9),  # poza zakresem mocy (1-1000)
        ]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["p2_moc_kw"][0] is None

    def test_zbyt_odlegla_wartosc_nie_jest_dopasowana(self):
        """Etykieta bez sąsiada w rozsądnym zasięgu — pole zostaje puste, nie zgaduje z drugiego końca strony."""
        boxes = [
            Box("L", 10, 10, 20, 25, 0.9),
            Box("2", 900, 690, 910, 700, 0.9),  # drugi róg strony
        ]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["liczba_osi"][0] is None


class TestSciezkaPolaczona:
    def test_kod_i_wartosc_w_jednym_boxie(self):
        boxes = [Box("F.1 3210", 400, 200, 470, 220, 0.9)]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["f1_dmc"][0] == "3210"

    def test_numer_rejestracyjny_w_jednym_boxie(self):
        boxes = [Box("A WZ946KA", 100, 50, 220, 70, 0.9)]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["numer_rejestracyjny"][0] == "WZ946KA"

    # D.1/D.2/D.3 — OCR zwraca je jako POJEDYNCZE boxy (etykieta + wartość razem),
    # potwierdzone podglądem surowych boxów na WE6LR80 25.08. Bez tych wzorców
    # pokrycie wynosiło `marka` 2%, `model` 4% na 54 dokumentach.
    def test_marka_d1_w_jednym_boxie(self):
        boxes = [Box("D.1 TOYOTA", 729, 536, 814, 560, 1.0)]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["marka"][0] == "TOYOTA"

    def test_typ_d2_w_jednym_boxie(self):
        boxes = [Box("D.2 AN1P(EU,N)", 696, 515, 813, 541, 0.98)]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["typ"][0] == "AN1P(EU,N)"

    def test_model_d3_w_jednym_boxie(self):
        boxes = [Box("D.3 TOYOTA HILUX", 700, 490, 850, 515, 0.95)]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["model"][0] == "TOYOTA HILUX"


class TestOrientacjaIKorupcjaDanych:
    """
    Regresja dla najgroźniejszego znaleziska 25.08: na NIEOBRÓCONEJ stronie parser
    zwracał `f1_dmc=1882` — odczyt z sąsiedniej rubryki „18,82 kN" (nacisk osi),
    zamiast prawdziwej DMC 3210 kg. Wartość mieściła się w dopuszczalnym zakresie
    i wyglądała wiarygodnie, więc trafiłaby do deklaracji DT-1 bez sygnału błędu.

    Prostowanie strony robi `run_rapid_ocr` (reguła kształtu: dowód jest poziomy),
    ale te testy pilnują SAMEGO PARSERA — żeby przy odwróconym layoucie nie
    wymyślał wartości z sąsiedztwa po złej stronie.
    """

    def test_wartosc_po_lewej_nie_jest_dopasowana_do_etykiety(self):
        """Etykieta szuka wartości PO PRAWEJ; leżąca po lewej nie może zostać przyjęta."""
        boxes = [
            Box("3210 kg", 1180, 614, 1264, 647, 1.0),   # prawdziwa DMC, ale PO LEWEJ
            Box("F.1", 1276, 628, 1303, 654, 0.99),
        ]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["f1_dmc"][0] is None

    def test_nie_bierze_sasiedniej_rubryki_z_prawej_gdy_layout_odwrocony(self):
        """
        Dokładny układ z WE6LR80 bez prostowania: F.1 ma po prawej „18,82 kN"
        (nacisk osi), a prawdziwą DMC po lewej. Parser NIE MOŻE zwrócić 1882.
        """
        boxes = [
            Box("3210 kg", 1180, 614, 1264, 647, 1.0),
            Box("F.1", 1276, 628, 1303, 654, 0.99),
            Box("18,82 kN", 1375, 620, 1466, 647, 0.94),
        ]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["f1_dmc"][0] != "1882", "przyjęto nacisk osi jako DMC — korupcja danych"

    def test_poprawny_layout_daje_poprawna_dmc(self):
        """Kontrola pozytywna: po wyprostowaniu (wartość PO PRAWEJ) DMC ma się wyciągnąć."""
        boxes = [
            Box("F.1", 450, 584, 478, 609, 0.99),
            Box("3210 kg", 488, 588, 574, 623, 1.0),
        ]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["f1_dmc"][0] == "3210"

    def test_masa_z_jednostka_kn_odrzucona(self):
        """Sam zakres tego nie łapie (1882 mieści się w 400-60000) — jednostka tak."""
        boxes = [
            Box("G", 450, 584, 470, 609, 0.99),
            Box("18,82 kN", 488, 588, 574, 623, 0.94),
        ]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["g_masa_wlasna"][0] is None


class TestWartosciDziesietne:
    """
    Dowód zapisuje pojemność i moc z częścią dziesiętną („2755,00 cm³").
    Sklejanie wszystkich cyfr dawało 275500 / 15000 — poza zakresem, więc pole
    wypadało jako puste. Zmierzone pokrycie przed naprawą: pojSilnika 2%, mocKW 4%.
    """

    def test_pojemnosc_z_czescia_dziesietna(self):
        boxes = [
            Box("P.1", 450, 584, 480, 609, 0.99),
            Box("2755,00 cm³", 490, 588, 620, 623, 0.92),
        ]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["p1_pojemnosc"][0] == "2755"

    def test_moc_z_czescia_dziesietna(self):
        boxes = [
            Box("P.2", 450, 584, 480, 609, 0.99),
            Box("150,00 kW", 490, 588, 600, 623, 0.99),
        ]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["p2_moc_kw"][0] == "150"

    def test_masa_z_czescia_dziesietna_odrzucona(self):
        """Masy na dowodzie są całkowite — ułamek znaczy, że czytamy nie tę rubrykę."""
        boxes = [
            Box("F.1", 450, 584, 478, 609, 0.99),
            Box("18,82", 488, 588, 574, 623, 0.94),
        ]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["f1_dmc"][0] is None


class TestPrzeznaczenieDziedzinaZamknieta:
    """
    `przeznaczenie` decyduje o ZWOLNIENIU z DT-1 (pojazd specjalny), a jego
    etykieta („RODZAJ POJAZDU") bywa dla OCR nieczytelna — zmierzone na WE6LR80:
    odczytana jako „ACIZVOd IVZCON" przy pewności 0.69, podczas gdy sama WARTOŚĆ
    miała 0.93. Dlatego pole szuka wartości po zamkniętej dziedzinie rodzajów,
    nie przez dopasowanie do etykiety.
    """

    def test_rodzaj_znaleziony_bez_etykiety(self):
        boxes = [Box("SAMOCHÓD CIEŽAROWY", 181, 344, 378, 377, 0.93)]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["przeznaczenie"][0] == "SAMOCHÓD CIEŽAROWY"

    def test_specjalny_znaleziony(self):
        """Najważniejszy przypadek — od tego zależy zwolnienie podatkowe."""
        boxes = [Box("SAMOCHÓD SPECJALNY", 181, 344, 378, 377, 0.95)]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert "SPECJALNY" in result["przeznaczenie"][0].upper()

    def test_asenizacyjny_znaleziony(self):
        boxes = [Box("ASENIZACYJNY", 181, 344, 300, 377, 0.9)]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["przeznaczenie"][0] == "ASENIZACYJNY"

    def test_smiec_nie_przechodzi(self):
        """Kontrola negatywna: fragment MRZ przechodził w poprzedniej wersji."""
        boxes = [Box("DRP0L1465108BAP0520303147043461<<<<<<0", 100, 300, 500, 330, 0.7)]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["przeznaczenie"][0] is None

    def test_etykieta_innego_pola_nie_przechodzi(self):
        """„DOPUSZCZALNA" (etykieta ładowności) przechodziła w poprzedniej wersji."""
        boxes = [Box("DOPUSZCZALNA", 100, 300, 250, 330, 0.9)]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["przeznaczenie"][0] is None


class TestWolnyTekst:
    def test_norma_euro_znaleziona_w_tekscie(self):
        boxes = [Box("ADNOTACJE: EURO 6 silnik diesla", 50, 500, 400, 520, 0.9)]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["norma_euro"][0] == "EURO 6"

    def test_zawieszenie_pneumatyczne_znalezione(self):
        boxes = [Box("zawieszenie pneumatyczne osi tylnej", 50, 520, 400, 540, 0.9)]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert "pneumatyczne" in result["zawieszenie"][0]

    def test_brak_wzmianki_daje_puste_pole(self):
        boxes = [Box("nic tu nie ma", 50, 520, 400, 540, 0.9)]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["norma_euro"][0] is None
        assert result["zawieszenie"][0] is None


class TestWszystkieKluczeObecne:
    def test_puste_boxy_daja_wszystkie_klucze_z_none(self):
        w, h = _page()
        result = parse_fields_spatial([], w, h)
        for key in ("numer_rejestracyjny", "vin", "f1_dmc", "liczba_osi",
                    "zawieszenie", "norma_euro", "rok_prod", "przeznaczenie"):
            assert key in result
            assert result[key][0] is None
