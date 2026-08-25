"""
Testy parsera GEOMETRYCZNEGO (extractors/rapid_fields.py) na spreparowanych
bounding boxach — nie wymaga ładowania modeli RapidOCR (parse_fields_spatial
przyjmuje już wyekstrahowane Box-y, nie obraz).

Układ współrzędnych zgodny z realnym dokumentem sprawdzonym wizualnie 24-25.08
(WE6LR80): kolumna beżowa — etykieta NAD wartością; kolumny żółta/niebieska —
etykieta w osobnym boxie PO LEWEJ od wartości, ta sama linia.
"""
import pytest
from extractors.rapid_fields import Box, parse_fields_spatial, _clean_value, _PAT_KATEGORIA


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


class TestKategoriaIRokProdukcji:
    """
    Oba pola miały pokrycie 0/54 z dwóch RÓŻNYCH powodów — patrz komentarze
    w rapid_fields.py. Kategoria: etykieta „J" to pojedyncza litera i detektor
    nie wydziela jej jako osobnego boxu. Rok: OCR rozbija „ROK PRODUKCJI" na
    dwa boxy jeden pod drugim, a wartość leży PO PRAWEJ, nie pod spodem.
    """

    def test_kategoria_znaleziona_bez_etykiety(self):
        boxes = [Box("N1G", 776, 635, 816, 662, 1.0)]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["kategoria"][0] == "N1G"

    def test_kategoria_bez_sufiksu(self):
        boxes = [Box("M1", 776, 635, 806, 662, 1.0)]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["kategoria"][0] == "M1"

    def test_kategoria_motocyklowa(self):
        boxes = [Box("L3E", 776, 635, 816, 662, 1.0)]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["kategoria"][0] == "L3E"

    def test_tablica_rejestracyjna_nie_jest_kategoria(self):
        """Kontrola negatywna — wzorzec musi być na tyle wąski, żeby nie łapać tablic."""
        boxes = [Box("WE6LR80", 594, 575, 720, 609, 0.94)]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["kategoria"][0] is None

    def test_litera_sekcji_C_nie_jest_kategoria(self):
        """
        REGRESJA zmierzona na pełnym przebiegu 58 dokumentów: 43 z 48 „trafień"
        to była litera sekcji C (dane właściciela: C.1.1, C.2.1), nie kategoria.
        Formy jednoliterowe („C", „T", „R", „S", „L") są w katalogu poprawnymi
        kategoriami, ale jako wzorzec do szukania w OCR trafiają na każdej stronie.
        """
        boxes = [Box("C", 843, 462, 864, 485, 1.0)]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["kategoria"][0] is None

    def test_litera_sekcji_z_sufiksem_nie_jest_kategoria(self):
        """„CM" trafiało przez sufiks [A-Z]? doklejony do jednoliterowego „C"."""
        boxes = [Box("CM", 843, 462, 880, 485, 0.9)]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["kategoria"][0] is None

    def test_dziedzina_obowiazuje_takze_przy_wykrytej_etykiecie(self):
        """
        REGRESJA: gdy etykieta „J" ZOSTAJE wykryta, wartość szła ścieżką
        geometryczną, gdzie kategoria była zwykłym tekstem — bez sprawdzenia
        dziedziny. Przeciekało „01" (O1 odczytane jako zero-jeden).
        """
        boxes = [
            Box("J", 900, 570, 920, 600, 1.0),
            Box("01", 940, 575, 975, 600, 0.8),
        ]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["kategoria"][0] is None

    def test_poprawna_kategoria_przy_wykrytej_etykiecie_przechodzi(self):
        """Kontrola pozytywna — zawężenie nie może odciąć prawdziwych wartości."""
        boxes = [
            Box("J", 900, 570, 920, 600, 1.0),
            Box("N1G", 940, 575, 990, 600, 1.0),
        ]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["kategoria"][0] == "N1G"

    def test_rok_produkcji_wartosc_po_prawej(self):
        """Układ z WE6LR80: etykieta w dwóch boxach, wartość obok „PRODUKCJI"."""
        boxes = [
            Box("ROK", 168, 496, 197, 514, 1.0),
            Box("PRODUKCJI", 168, 510, 232, 527, 0.96),
            Box("2026", 308, 503, 358, 529, 1.0),
        ]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["rok_prod"][0] == "2026"

    def test_rok_poza_zakresem_odrzucony(self):
        boxes = [
            Box("PRODUKCJI", 168, 510, 232, 527, 0.96),
            Box("981", 308, 503, 358, 529, 1.0),
        ]
        w, h = _page()
        result = parse_fields_spatial(boxes, w, h)
        assert result["rok_prod"][0] is None


class TestPaliwoNapedyAlternatywne:
    """
    Rubryka P.3 to „rodzaj paliwa LUB ŹRÓDŁA MOCY" — nie tylko trzy paliwa płynne.
    Do 25.08 parser żądał, żeby wartość ZACZYNAŁA SIĘ od D/B/G/P, więc „CNG",
    „LNG", „EE" i „H2" wypadały po cichu, a „LPG" rozpisane słownie też nie trafiało
    (mapowanie miało klucz „G", ale regex patrzył na pierwszą literę).

    To kosztuje pieniądze: uchwała Rady m.st. Warszawy XXIX/1065/2025 § 3 daje
    pojazdom wodorowym, hybrydowym, elektrycznym, CNG i LNG stawki niższe o ~40%
    (ciężarowy 5,5–9 t: 672 zł zamiast 1128 zł). Zgubiony rodzaj paliwa = stawka
    podstawowa.
    """

    @pytest.mark.parametrize("wejscie,oczekiwane", [
        ("D", "ON"), ("B", "PB"), ("G", "LPG"), ("P", "PB"),      # kody jednoliterowe
        ("ON", "ON"), ("PB", "PB"), ("Diesel", "ON"), ("benzyna", "PB"),
        ("LPG", "LPG"), ("gaz płynny", "LPG"),
        ("CNG", "CNG"), ("sprężony gaz ziemny", "CNG"),
        ("LNG", "LNG"),
        ("EE", "ELEKTRYCZNY"), ("elektryczny", "ELEKTRYCZNY"),
        ("H2", "WODOR"), ("wodór", "WODOR"),
        ("hybryda", "HYBRYDA"),
    ])
    def test_rozpoznaje_rodzaj_paliwa(self, wejscie, oczekiwane):
        boxes = [Box("P.3", 450, 584, 480, 609, 0.99), Box(wejscie, 490, 588, 620, 623, 0.95)]
        w, h = _page()
        assert parse_fields_spatial(boxes, w, h)["p3_paliwo"][0] == oczekiwane

    def test_lng_nie_wpada_w_regule_dla_l(self):
        """Kolejność dopasowania: dłuższe oznaczenia przed jednoliterowymi."""
        boxes = [Box("P.3", 450, 584, 480, 609, 0.99), Box("LNG", 490, 588, 560, 623, 0.95)]
        w, h = _page()
        assert parse_fields_spatial(boxes, w, h)["p3_paliwo"][0] == "LNG"

    def test_pusta_rubryka_zostaje_pusta(self):
        boxes = [Box("P.3", 450, 584, 480, 609, 0.99), Box("---", 490, 588, 540, 623, 0.9)]
        w, h = _page()
        assert parse_fields_spatial(boxes, w, h)["p3_paliwo"][0] is None


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


class TestKodyRubrykNieSaWartosciami:
    """Kod rubryki („D.3", „E", „L") to ETYKIETA obok pola, nigdy jego treść.

    ZNALEZIONE NA PRAWDZIWYM DOKUMENCIE (AH91412, ponowny OCR 25.08): parser
    zwrócił marka="D.3", model="E", nr_homolog="L". Wygląda to jak dane —
    krótkie napisy, żaden zakres liczbowy tego nie odrzuci — a jest spisem
    etykiet formularza. Trafia tam, gdzie detektor dopasuje etykietę do siebie
    samej albo do sąsiedniej etykiety zamiast do wartości pod nią.
    """

    def test_kod_rubryki_odrzucony_w_polach_tekstowych(self):
        for key, raw in (
            ("marka", "D.3"), ("model", "E"), ("nr_homolog", "L"),
            ("typ", "F.1"), ("kategoria", "J"), ("przeznaczenie", "P.1"),
            ("vin", "K"), ("marka", "A"), ("model", "O.2"),
        ):
            assert _clean_value(key, raw) is None, f"{key}={raw!r} przeszło jako wartość"

    def test_paliwo_jednoliterowe_NIE_jest_odrzucane(self):
        """⚠️ Najważniejszy test tej klasy — bramka kodów rubryk musi mieć wyjątek.

        Na dowodzie P.3 to dosłownie jedna litera: „D" (olej napędowy), „B"
        (benzyna), „G" (gaz). Bramka bez wyjątku skasowałaby POPRAWNY odczyt
        paliwa — pola, które wybiera stawkę § 3 uchwały Rady m.st. Warszawy
        i wskaźnik emisji CO2. Awaria byłaby cicha: puste pole, nie błąd.
        """
        assert _clean_value("p3_paliwo", "D") == "ON"
        assert _clean_value("p3_paliwo", "B") == "PB"
        assert _clean_value("p3_paliwo", "G") == "LPG"

    def test_prawdziwe_wartosci_przechodza(self):
        for key, raw, oczek in (
            ("marka", "MERCEDES-BENZ", "MERCEDES-BENZ"),
            ("model", "SPRINTER", "SPRINTER"),
            ("kategoria", "N2", "N2"),
            ("kategoria", "N1G", "N1G"),
            ("nr_homolog", "e32*2007/46*0465*03", "e32*2007/46*0465*03"),
            ("typ", "906BA50/Z", "906BA50/Z"),
            ("vin", "WMA29VUZ7R9018317", "WMA29VUZ7R9018317"),
        ):
            assert _clean_value(key, raw) == oczek, f"{key}={raw!r} zostało skasowane"

    def test_strefa_mrz_nie_jest_numerem_homologacji(self):
        """MRZ (dół dokumentu) wygląda urzędowo, bo NIM JEST — ale to nie rubryka K.

        ZNALEZIONE NA WA6441C (ponowny OCR 25.08): nr_homolog dostał wartość
        „DRP0L1465038BAP2257369382123092<<<<<". Znak „<" to wypełniacz strefy
        maszynowo czytelnej i nie występuje w żadnym polu dowodu.
        """
        assert _clean_value("nr_homolog", "DRP0L1465038BAP2257369382123092<<<<<") is None
        assert _clean_value("vin", "D<<DRP0L1465038BAP22573693<<<<<<") is None
        # a prawdziwa homologacja przechodzi nietknięta
        assert _clean_value("nr_homolog", "e32*2007/46*0465*03") == "e32*2007/46*0465*03"


class TestKategoriaSufiksLiterowy:
    """Sufiks literowy (N1G = terenowy) tylko przy rodzinach M/N/O.

    ZNALEZIONE NA AH91412 (ponowny OCR 26.08): BMW X5 dostało kategorię „C4C".
    C4 to ciągnik GĄSIENICOWY — poprzedni wzorzec dopuszczał wielką literę po
    każdej rodzinie. Rodziny T/C/R/S zapisują warianty MAŁĄ literą (T1a, T1b),
    więc wielki sufiks przy nich zawsze znaczy zły odczyt.
    """

    def test_realne_kategorie_tej_floty_przechodza(self):
        for v in ("M1", "M2", "M3", "N1", "N2", "N3", "N1G", "O1", "O4", "L7E", "T3", "C4"):
            assert _PAT_KATEGORIA.fullmatch(v), f"{v} powinno być poprawną kategorią"

    def test_wielki_sufiks_przy_ciagniku_odrzucony(self):
        for v in ("C4C", "T3X", "R2A", "S1B"):
            assert not _PAT_KATEGORIA.fullmatch(v), f"{v} nie jest poprawną kategorią"
