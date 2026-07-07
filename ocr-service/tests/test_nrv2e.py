"""
Testy jednostkowe nrv2e.py (ctypes UCL) i AztecDecoder.

Wektory testowe pochdzą z rzeczywistych skanów DR:
  - WPR0365T — MAN, Starosta Pruszkowski, DR seria BAS 3574703
  - WA0677L  — SCANIA, Starosta Warszawski Zachodni, DR seria BAV 5224071

Format potwierdzony eksperymentalnie (plik decode_payload.mjs):
  base64_decode(aztec_text) → buf
  buf[0:4]  = LE uint32 → oczekiwany rozmiar wyjścia
  buf[4:]   = dane NRV2E

Testy decompresji (test_decompress_*) wymagają libucl1 w systemie.
Na środowiskach bez libucl1 są automatycznie pomijane (skipif).
Testy format_* sprawdzają parsowanie struktury i nie wymagają libucl.
"""
from __future__ import annotations
import base64
import struct
import pytest

# ── Rzeczywiste payloady z skanów DR (base64 z kodu Aztec przez zxing-wasm) ──

# MAN, WPR 0365T, seria DR/BAS 3574703, Starosta Pruszkowski
PAYLOAD_WPR0365T_B64 = (
    "cgQAANtYAAJDAP8xAHwAQgBBAP9TADMANQA3AL00BjDuFnwy1xYyP7U2VPtCUgBPE30gAFDnGlXv"
    "WgBLKld2Eg6/SVJ1AGzeAC4+RHY271kATVpB3gFZIjP3qnwGbsYtADj2DjCLLtN7fALfVysgBwe/"
    "NlpUAHx8i04eD1rgDq0iRRfBQ3LeOA5E90JaFmuWMjLcTgIZ3fFxGDFpABf3bMkWJqF7ADH3Gco3"
    "eDL3EAAAMrQuEg6VVb9vHTjFKJGbbwAdlEVNOQxbUDoCKADf2SjKLAD7CAjuFGq7ADJ4MTI2MgI2"
    "ADQEIxQA2CcAuBwA/xIAJxUATRYAGzgAqBIApBMAIiIA/kACDgCCBQAqIQChAQCqIwAODgCsCQAu"
    "CgCyBgAkDgCoBQAiEACqBAAkDgCKCAAiDACaAwAkDgCaAgAiGACaAQA="
)
PAYLOAD_WPR0365T_EXPECTED_OUTPUT_SIZE = 1138
PAYLOAD_WPR0365T_COMPRESSED_SIZE = 322

# SCANIA, WA 0677L, seria DR/BAV 5224071, Starosta Warszawski Zachodni
PAYLOAD_WA0677L_B64 = (
    "YQQAANtYAAJDAP8xAHwAQgBBAPlWADUAMv40ADAAN/srMRbdMyK7ElMAVEL2UgBPE/sgAFcf2hpa"
    "8w5X/UsASQAg7RuiSH5ORABO7SJydfcAbAAuMrxQJlrvPgFzW4evMbY53gAvDjP3AnzuBQIt3gA4"
    "CjDtOl57ugHH0+2+Gk17Ylom31eqRQC+Q9989wJXk7ReNhtm"
)
PAYLOAD_WA0677L_EXPECTED_OUTPUT_SIZE = 1121
PAYLOAD_WA0677L_COMPRESSED_SIZE = 146


# ── Pomocnicze ────────────────────────────────────────────────────────────────

def _decode_b64(b64: str) -> bytes:
    padding = (4 - len(b64.replace("\n", "").replace(" ", "")) % 4) % 4
    return base64.b64decode(b64 + "=" * padding)


def _libucl_available() -> bool:
    from extractors import nrv2e
    return nrv2e.is_available()


requires_libucl = pytest.mark.skipif(
    not _libucl_available(),
    reason="libucl1 niedostępna (apt install libucl1)",
)


# ── Testy struktury formatu (nie wymagają libucl) ─────────────────────────────

class TestPayloadFormat:
    def test_wpr0365t_base64_decode(self):
        buf = _decode_b64(PAYLOAD_WPR0365T_B64)
        assert len(buf) == PAYLOAD_WPR0365T_COMPRESSED_SIZE + 4

    def test_wpr0365t_header(self):
        buf = _decode_b64(PAYLOAD_WPR0365T_B64)
        size = struct.unpack_from("<I", buf, 0)[0]
        assert size == PAYLOAD_WPR0365T_EXPECTED_OUTPUT_SIZE

    def test_wpr0365t_compressed_first_byte(self):
        """Strumień NRV2E WPR0365T zaczyna się od 0xDB."""
        buf = _decode_b64(PAYLOAD_WPR0365T_B64)
        assert buf[4] == 0xDB

    def test_wa0677l_base64_decode(self):
        buf = _decode_b64(PAYLOAD_WA0677L_B64)
        assert len(buf) == PAYLOAD_WA0677L_COMPRESSED_SIZE + 4

    def test_wa0677l_header(self):
        buf = _decode_b64(PAYLOAD_WA0677L_B64)
        size = struct.unpack_from("<I", buf, 0)[0]
        assert size == PAYLOAD_WA0677L_EXPECTED_OUTPUT_SIZE

    def test_wa0677l_compressed_first_byte(self):
        """Strumień NRV2E WA0677L zaczyna się od 0xDB."""
        buf = _decode_b64(PAYLOAD_WA0677L_B64)
        assert buf[4] == 0xDB

    def test_oba_dokumenty_rozny_rozmiar_skompresowany(self):
        """MAN 322B vs SCANIA 146B — różne payloady."""
        buf_man = _decode_b64(PAYLOAD_WPR0365T_B64)
        buf_sca = _decode_b64(PAYLOAD_WA0677L_B64)
        assert len(buf_man) != len(buf_sca)

    def test_wspolny_prefiks_nrv2e(self):
        """Oba strumienie NRV2E zaczynają się od identycznych 14 bajtów.
        To wzorzec dr-decode: każdy payload DR zaczyna nagłówkiem seryjnym."""
        buf_man = _decode_b64(PAYLOAD_WPR0365T_B64)
        buf_sca = _decode_b64(PAYLOAD_WA0677L_B64)
        # Bajty 4..17 (pierwszych 14B NRV2E) powinny być takie same
        assert buf_man[4:18] == buf_sca[4:18]

    def test_za_krotki_payload(self):
        from extractors.nrv2e import decode_dr_payload
        with pytest.raises(ValueError, match="zbyt krótki"):
            decode_dr_payload(b'\x01\x02\x03')

    def test_nieprawdopodobny_rozmiar(self):
        from extractors.nrv2e import decode_dr_payload
        # Rozmiar 0 → błąd
        with pytest.raises(ValueError):
            decode_dr_payload(struct.pack("<I", 0) + b'\xdb' * 10)

    def test_nieprawdopodobny_rozmiar_za_duzy(self):
        from extractors.nrv2e import decode_dr_payload
        # Rozmiar > 65536 → błąd
        with pytest.raises(ValueError):
            decode_dr_payload(struct.pack("<I", 100_000) + b'\xdb' * 10)


# ── Testy dekompresji (wymagają libucl1) ──────────────────────────────────────

class TestDecompressLibUCL:
    @requires_libucl
    def test_wpr0365t_dekompresia_rozmiar(self):
        from extractors.nrv2e import decode_dr_payload
        buf = _decode_b64(PAYLOAD_WPR0365T_B64)
        text = decode_dr_payload(buf)
        # UTF-16LE: 1138 B / 2 = 569 znaków
        assert len(text) == PAYLOAD_WPR0365T_EXPECTED_OUTPUT_SIZE // 2

    @requires_libucl
    def test_wpr0365t_pola_pipe(self):
        from extractors.nrv2e import decode_dr_payload
        buf = _decode_b64(PAYLOAD_WPR0365T_B64)
        text = decode_dr_payload(buf)
        parts = text.split("|")
        assert len(parts) >= 10, f"Zbyt mało pól: {len(parts)}"

    @requires_libucl
    def test_wpr0365t_numer_rej(self):
        """Nr rejestracyjny musi zawierać WPR0365T (lub WPR 0365T)."""
        from extractors.nrv2e import decode_dr_payload
        buf = _decode_b64(PAYLOAD_WPR0365T_B64)
        text = decode_dr_payload(buf)
        assert "WPR" in text and "0365T" in text.replace(" ", "")

    @requires_libucl
    def test_wpr0365t_marka_man(self):
        from extractors.nrv2e import decode_dr_payload
        buf = _decode_b64(PAYLOAD_WPR0365T_B64)
        text = decode_dr_payload(buf)
        assert "MAN" in text.upper()

    @requires_libucl
    def test_wpr0365t_vin(self):
        from extractors.nrv2e import decode_dr_payload
        buf = _decode_b64(PAYLOAD_WPR0365T_B64)
        text = decode_dr_payload(buf)
        assert "MMA15VUZ3N9017358" in text

    @requires_libucl
    def test_wa0677l_numer_rej(self):
        from extractors.nrv2e import decode_dr_payload
        buf = _decode_b64(PAYLOAD_WA0677L_B64)
        text = decode_dr_payload(buf)
        assert "WA" in text and "0677L" in text.replace(" ", "")

    @requires_libucl
    def test_wa0677l_marka_scania(self):
        from extractors.nrv2e import decode_dr_payload
        buf = _decode_b64(PAYLOAD_WA0677L_B64)
        text = decode_dr_payload(buf)
        assert "SCANIA" in text.upper()

    @requires_libucl
    def test_wa0677l_vin(self):
        from extractors.nrv2e import decode_dr_payload
        buf = _decode_b64(PAYLOAD_WA0677L_B64)
        text = decode_dr_payload(buf)
        assert "YS2R6X20005482489" in text

    @requires_libucl
    def test_aztec_decoder_libucl_wpr0365t(self):
        """AztecDecoder.decode() przez adapter — pełna integracja."""
        from extractors.aztec_decoder import AztecDecoder
        decoder = AztecDecoder.get()
        raw = _decode_b64(PAYLOAD_WPR0365T_B64)
        fields = decoder.decode(raw)
        # Pole 3 = numer_rejestracyjny
        assert "numer_rejestracyjny" in fields
        assert "WPR" in fields["numer_rejestracyjny"]
        # Pole 9 = vin
        assert fields.get("vin") == "MMA15VUZ3N9017358"

    @requires_libucl
    def test_aztec_decoder_libucl_wa0677l(self):
        from extractors.aztec_decoder import AztecDecoder
        decoder = AztecDecoder.get()
        raw = _decode_b64(PAYLOAD_WA0677L_B64)
        fields = decoder.decode(raw)
        assert fields.get("vin") == "YS2R6X20005482489"
        assert "marka" in fields
        assert "SCANIA" in fields["marka"].upper()


# ── Testy AztecDecoder (bez libucl — format + adapter) ───────────────────────

class TestAztecDecoderInterface:
    def test_try_base64_rozpoznaje_base64(self):
        from extractors.aztec_decoder import AztecDecoder
        buf = _decode_b64(PAYLOAD_WPR0365T_B64)
        result = AztecDecoder._try_base64(
            PAYLOAD_WPR0365T_B64.replace("\n", "").encode()
        )
        assert result == buf

    def test_try_base64_passthrough_binarnych(self):
        """Dane binarne (nie b64) są zwracane bez zmian."""
        from extractors.aztec_decoder import AztecDecoder
        binary = bytes(range(256))
        result = AztecDecoder._try_base64(binary)
        assert result == binary

    def test_map_fields_poprawne_mapowanie(self):
        from extractors.aztec_decoder import AztecDecoder, FIELD_ORDER
        parts = ["BAS", "3574703", "PRUSZKÓW", "WPR0365T", "MAN"] + [""] * 25
        fields = AztecDecoder._map_fields(parts)
        assert fields["seria_dowodu"] == "BAS"
        assert fields["numer_rejestracyjny"] == "WPR0365T"
        assert fields["marka"] == "MAN"

    def test_map_fields_pomija_puste(self):
        from extractors.aztec_decoder import AztecDecoder
        parts = ["BAS", "", "ORGAN", "", "MAN"]
        fields = AztecDecoder._map_fields(parts)
        assert "numer_dowodu" not in fields   # puste — pominięte
        assert fields["marka"] == "MAN"

    def test_try_get_zwraca_none_gdy_brak(self, monkeypatch):
        from extractors import aztec_decoder, nrv2e
        monkeypatch.setattr(nrv2e, "is_available", lambda: False)
        monkeypatch.setattr(nrv2e, "_lib_loaded", False)
        result = aztec_decoder.AztecDecoder.try_get()
        assert result is None
