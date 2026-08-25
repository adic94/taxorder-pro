"""
Testy parsera GEOMETRYCZNEGO (extractors/paddle_fields.py) na spreparowanych
bounding boxach — nie wymaga ładowania modeli PaddleOCR (parse_fields_spatial
przyjmuje już wyekstrahowane Box-y, nie obraz).

Układ współrzędnych zgodny z realnym dokumentem sprawdzonym wizualnie 24-25.08
(WE6LR80): kolumna beżowa — etykieta NAD wartością; kolumny żółta/niebieska —
etykieta w osobnym boxie PO LEWEJ od wartości, ta sama linia.
"""
import pytest
from extractors.paddle_fields import Box, parse_fields_spatial


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
