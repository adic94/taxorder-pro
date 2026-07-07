"""Testy jednostkowe walidatorów pól Dowodu Rejestracyjnego."""
import pytest
from extractors.validators import (
    validate_vin, validate_nrrej, validate_date,
    validate_mass, validate_capacity, validate_power, validate_seats,
    check_mass_consistency,
)


class TestVin:
    def test_poprawny_vin(self):
        ok, msg = validate_vin("1HGCM82633A004352")
        assert ok
        assert msg == ""

    def test_za_krotki(self):
        ok, msg = validate_vin("1HGCM82633A00435")
        assert not ok
        assert "16" in msg or "znaków" in msg

    def test_za_dlugi(self):
        ok, msg = validate_vin("1HGCM82633A0043521")
        assert not ok

    def test_litera_i(self):
        ok, msg = validate_vin("1HGCM82633I004352")
        assert not ok
        assert "I" in msg

    def test_litera_o(self):
        ok, msg = validate_vin("1HGCM82633O004352")
        assert not ok
        assert "O" in msg

    def test_litera_q(self):
        ok, msg = validate_vin("QHGCM82633A004352")
        assert not ok

    def test_pusty(self):
        ok, msg = validate_vin("")
        assert not ok

    def test_male_litery_normalizowane(self):
        # validate_vin wewnętrznie robi upper()
        ok, msg = validate_vin("1hgcm82633a004352")
        assert ok

    def test_polskie_znaki_niedozwolone(self):
        ok, msg = validate_vin("1HGCM82633A00435Ó")
        assert not ok


class TestNrRej:
    def test_poprawny_2_literowy(self):
        ok, _ = validate_nrrej("WZ946KA")
        assert ok

    def test_poprawny_3_literowy(self):
        ok, _ = validate_nrrej("WAW12345")
        assert ok

    def test_za_krotki(self):
        ok, _ = validate_nrrej("W123")
        assert not ok

    def test_za_dlugi(self):
        ok, _ = validate_nrrej("WAAAAAA12345678")
        assert not ok

    def test_pusty(self):
        ok, _ = validate_nrrej("")
        assert not ok

    def test_ze_spacjami(self):
        # spacje są usuwane wewnętrznie
        ok, _ = validate_nrrej("WZ 946KA")
        assert ok

    def test_z_myslnikiem(self):
        ok, _ = validate_nrrej("WZ-946KA")
        assert ok


class TestDate:
    def test_poprawna_data(self):
        ok, _ = validate_date("15.06.2020")
        assert ok

    def test_iso_format(self):
        ok, _ = validate_date("2020-06-15")
        assert ok

    def test_przyszlosc(self):
        ok, msg = validate_date("01.01.2099")
        assert not ok
        assert "przyszłości" in msg

    def test_przed_1950(self):
        ok, msg = validate_date("01.01.1949")
        assert not ok
        assert "stara" in msg

    def test_nieparsowalna(self):
        ok, _ = validate_date("nie-data")
        assert not ok

    def test_pusta(self):
        ok, _ = validate_date("")
        assert not ok


class TestMasy:
    def test_poprawna_masa(self):
        ok, _ = validate_mass(3500)
        assert ok

    def test_za_mala(self):
        ok, _ = validate_mass(50)
        assert not ok

    def test_za_duza(self):
        ok, _ = validate_mass(70000)
        assert not ok

    def test_string(self):
        ok, _ = validate_mass("3500")
        assert ok


class TestPojemnosc:
    def test_poprawna(self):
        ok, _ = validate_capacity(1998)
        assert ok

    def test_za_mala(self):
        ok, _ = validate_capacity(10)
        assert not ok


class TestMoc:
    def test_poprawna(self):
        ok, _ = validate_power(85)
        assert ok

    def test_zero(self):
        ok, _ = validate_power(0)
        assert not ok

    def test_za_duza(self):
        ok, _ = validate_power(2000)
        assert not ok


class TestMiejsca:
    def test_poprawne(self):
        ok, _ = validate_seats(5)
        assert ok

    def test_zero(self):
        ok, _ = validate_seats(0)
        assert not ok

    def test_za_duzo(self):
        ok, _ = validate_seats(100)
        assert not ok


class TestSpojnosc:
    def test_ok(self):
        warn = check_mass_consistency(3500, 2100)
        assert warn is None

    def test_naruszenie(self):
        warn = check_mass_consistency(1800, 2100)
        assert warn is not None
        assert "F.1" in warn

    def test_brak_wartosci(self):
        assert check_mass_consistency(None, 2100) is None
        assert check_mass_consistency(3500, None) is None
