"""
Testy parsera euro-pól OCR na spreparowanym tekście z szumem.
Nie wymaga Tesseracta — testujemy wyłącznie funkcję parse_fields().
"""
import pytest
from extractors.ocr_fallback import parse_fields


def _empty_data() -> dict:
    """Pusty słownik imitujący output pytesseract.image_to_data."""
    return {"text": [], "conf": [], "left": [], "top": [], "width": [], "height": [],
            "block_num": [], "par_num": [], "line_num": [], "word_num": []}


class TestParserEuroPol:
    def test_numer_rejestracyjny_z_prefiksem_A(self):
        text = "A WZ946KA B 15.03.2019"
        result = parse_fields(text, _empty_data())
        nr, conf = result["numer_rejestracyjny"]
        assert nr == "WZ946KA"

    def test_vin_17_znakow(self):
        text = "E VF1RFD00061234567 D.1 RENAULT"
        result = parse_fields(text, _empty_data())
        vin, _ = result["vin"]
        assert vin == "VF1RFD00061234567"

    def test_vin_z_niedozwolona_litera_nie_pasuje(self):
        # VIN z literą I — nie powinien pasować
        text = "E VF1RFD0I061234567"
        result = parse_fields(text, _empty_data())
        vin, _ = result["vin"]
        assert vin is None

    def test_marka_po_d1(self):
        text = "D.1 VOLKSWAGEN D.2 GOLF"
        result = parse_fields(text, _empty_data())
        marka, _ = result["marka"]
        assert marka is not None
        assert "VOLKSWAGEN" in marka.upper()

    def test_data_rejestracji_po_B(self):
        text = "B 15.03.2019 D.1 FORD"
        result = parse_fields(text, _empty_data())
        data, conf = result["data_pierwszej_rej"]
        assert data == "15.03.2019"

    def test_f1_dmc(self):
        text = "F.1 3500 kg F.2 4200 kg G 2100 kg"
        result = parse_fields(text, _empty_data())
        f1, _ = result["f1_dmc"]
        assert f1 == "3500"

    def test_g_masa_wlasna(self):
        text = "G 2100 kg"
        result = parse_fields(text, _empty_data())
        g, _ = result["g_masa_wlasna"]
        assert g == "2100"

    def test_p1_pojemnosc(self):
        text = "P.1 1998 P.2 103 P.3 D"
        result = parse_fields(text, _empty_data())
        poj, _ = result["p1_pojemnosc"]
        assert poj == "1998"

    def test_p2_moc(self):
        text = "P.2 103 kW"
        result = parse_fields(text, _empty_data())
        moc, _ = result["p2_moc_kw"]
        assert moc == "103"

    def test_p3_paliwo_diesel(self):
        text = "P.3 D"
        result = parse_fields(text, _empty_data())
        pal, _ = result["p3_paliwo"]
        assert pal == "ON"

    def test_p3_paliwo_benzyna(self):
        text = "P.3 B"
        result = parse_fields(text, _empty_data())
        pal, _ = result["p3_paliwo"]
        assert pal == "PB"

    def test_s1_miejsca(self):
        text = "S.1 5 S.2 0"
        result = parse_fields(text, _empty_data())
        ms, _ = result["s1_miejsca_siedz"]
        assert ms == "5"

    def test_brak_pol_zwraca_none(self):
        text = "Lorem ipsum dolor sit amet"
        result = parse_fields(text, _empty_data())
        vin, conf = result["vin"]
        assert vin is None
        assert conf == 0.0

    def test_tekst_z_szumem_ocr(self):
        """Parser radzi sobie z szumem OCR (spacje, znaki specjalne)."""
        # Tesseract często wstawia spacje w kodach pól
        text = "D . 1 TOYOTA D . 2 COROLLA E 1HGBH41JXMN109186"
        result = parse_fields(text, _empty_data())
        vin, _ = result["vin"]
        assert vin == "1HGBH41JXMN109186"

    def test_f1_poza_zakresem_ignorowany(self):
        text = "F.1 50 kg"  # za mała wartość
        result = parse_fields(text, _empty_data())
        f1, _ = result["f1_dmc"]
        assert f1 is None

    def test_wszystkie_klucze_obecne(self):
        """Słownik wynikowy zawsze zwraca oczekiwany zbiór kluczy."""
        result = parse_fields("", _empty_data())
        expected_keys = {
            "numer_rejestracyjny", "data_pierwszej_rej", "marka", "typ", "model",
            "vin", "f1_dmc", "f2_dmc_ladunek", "f3_dmc_zespol", "g_masa_wlasna",
            "o1_przyczepa_ham", "o2_przyczepa_nieham", "p1_pojemnosc",
            "p2_moc_kw", "p3_paliwo", "s1_miejsca_siedz", "s2_miejsca_stojace",
        }
        for key in expected_keys:
            assert key in result, f"Brak klucza: {key}"
