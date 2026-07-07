"""
AztecDecoder — adapter izolujący dekodowanie payloadu kodu Aztec DR.

Zasada:
    Reszta systemu używa wyłącznie tej abstrakcji (AztecDecoder).
    Konkretna implementacja korzysta z libucl1 (GPL-2) przez ctypes;
    dzięki izolacji komponent można wymienić bez zmian w kodzie klienckim.

Hierarchia implementacji:
    AztecDecoder (ABC)
      ├─ LibUCLDecoder      — NRV2E przez ctypes libucl1 (seria BAS/BAV/BAY, post-2017)
      ├─ LegacyGzipDecoder  — GZIP/DEFLATE fallback (starsze DR, pre-2017)
      └─ AutoDetectDecoder  — autodetekuje format, deleguje do powyższych

Użycie:
    decoder = AztecDecoder.get()          # zwraca AutoDetectDecoder lub LegacyGzipDecoder
    fields  = decoder.decode(raw_bytes)   # słownik {nazwa: wartość}
"""
from __future__ import annotations

import base64
import logging
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger(__name__)

_GZIP_MAGIC = b"\x1f\x8b"

# Kolejność pól wg rozporządzenia MiR z 11 grudnia 2017 r.
# (Dz.U. poz. 2355, załącznik do wzoru DR serii BAS/BAV/BAY)
FIELD_ORDER: list[str] = [
    "seria_dowodu",        # 0
    "numer_dowodu",        # 1
    "organ_wydajacy",      # 2
    "numer_rejestracyjny", # 3
    "marka",               # 4
    "typ",                 # 5
    "wariant",             # 6
    "wersja",              # 7
    "model",               # 8
    "vin",                 # 9
    "data_pierwszej_rej",  # 10
    "data_rej_aktualnej",  # 11
    "kategoria",           # 12
    "wlasciciel_nazwa",    # 13  ← personal_data
    "wlasciciel_adres",    # 14  ← personal_data
    "posiadacz_nazwa",     # 15  ← personal_data
    "posiadacz_adres",     # 16  ← personal_data
    "f1_dmc",              # 17
    "f2_dmc_ladunek",      # 18
    "f3_dmc_zespol",       # 19
    "g_masa_wlasna",       # 20
    "o1_przyczepa_ham",    # 21
    "o2_przyczepa_nieham", # 22
    "p1_pojemnosc",        # 23
    "p2_moc_kw",           # 24
    "p3_paliwo",           # 25
    "liczba_osi",          # 26
    "s1_miejsca_siedz",    # 27
    "s2_miejsca_stojace",  # 28
    "nr_homologacji",      # 29
]

PERSONAL_FIELDS: frozenset[str] = frozenset({
    "wlasciciel_nazwa", "wlasciciel_adres",
    "posiadacz_nazwa",  "posiadacz_adres",
})


class AztecDecoder(ABC):
    """
    Interfejs dekodera payloadu kodu Aztec polskiego Dowodu Rejestracyjnego.

    Metoda decode() przyjmuje surowe bajty bezpośrednio z czytnika kodu
    (wynik zxingcpp result.bytes lub result.text zakodowany UTF-8) i zwraca
    słownik pól DR.
    """

    @abstractmethod
    def decode(self, raw: bytes) -> dict[str, str]:
        """
        Dekoduje payload Aztec do słownika pól.

        Parametr raw może być:
          - surowe bajty z kodu Aztec (binary Aztec → result.bytes)
          - UTF-8 encoded base64 string (text Aztec → result.text.encode())

        Zwraca: {nazwa_pola: wartość_tekstowa}  (puste pola pominięte)
        Rzuca: ValueError dla uszkodzonego payloadu.
               RuntimeError gdy biblioteka dekompresji niedostępna.
        """

    # ── Metody pomocnicze wspólne dla wszystkich implementacji ──────────────

    @staticmethod
    def _try_base64(raw: bytes) -> bytes:
        """
        Próbuje zdekodować raw jako base64.
        Akceptuje format NRV2E (4B rozmiaru + dane) i GZIP (magic 1F 8B).
        Jeśli base64 zawiedzie — zakłada że raw to już surowe bajty payloadu.
        """
        try:
            text = raw.decode("ascii").strip()
            padding = (4 - len(text) % 4) % 4
            decoded = base64.b64decode(text + "=" * padding)
            if len(decoded) >= 4:
                # Akceptuj: GZIP lub rozsądny rozmiar NRV2E
                if decoded[:2] == _GZIP_MAGIC:
                    return decoded
                import struct
                sz = struct.unpack_from("<I", decoded, 0)[0]
                if 100 < sz < 65536:
                    return decoded
        except Exception:
            pass
        return raw

    @staticmethod
    def _detect_format(payload: bytes) -> str:
        """
        Wykrywa format zdekodowanego payloadu.
        Zwraca: 'gzip' gdy magic 1F 8B, inaczej 'nrv2e' (domyślny format modern DR).
        """
        if len(payload) >= 2 and payload[:2] == _GZIP_MAGIC:
            return "gzip"
        return "nrv2e"

    @staticmethod
    def _map_fields(parts: list[str]) -> dict[str, str]:
        """Mapuje listę wartości na słownik wg FIELD_ORDER."""
        result: dict[str, str] = {}
        for i, val in enumerate(parts):
            val = val.strip()
            if not val:
                continue
            key = FIELD_ORDER[i] if i < len(FIELD_ORDER) else f"pole_{i}"
            result[key] = val
        return result

    # ── Factory ─────────────────────────────────────────────────────────────

    @staticmethod
    def get() -> "AztecDecoder":
        """
        Zwraca najlepszą dostępną implementację:
          - libucl1 dostępna → AutoDetectDecoder (NRV2E + GZIP fallback)
          - libucl1 niedostępna → LegacyGzipDecoder (tylko GZIP, dla starych DR)
        """
        from extractors import nrv2e
        if nrv2e.is_available():
            return AutoDetectDecoder()
        logger.warning(
            "libucl1 niedostępna — AztecDecoder ograniczony do trybu GZIP. "
            "Nowoczesne DR (BAS/BAV/BAY) wymagają: apt install libucl1"
        )
        return LegacyGzipDecoder()

    @staticmethod
    def try_get() -> Optional["AztecDecoder"]:
        """
        Jak get(), ale zwraca None zamiast rzucać wyjątek przy krytycznym błędzie.
        Uwaga: bez libucl1 zwraca LegacyGzipDecoder (GZIP-only), nie None.
        """
        try:
            return AztecDecoder.get()
        except RuntimeError:
            return None


class LibUCLDecoder(AztecDecoder):
    """
    Implementacja przez ctypes + libucl (GPL-2, Markus Oberhumer).
    Obsługuje format NRV2E (seria BAS/BAV/BAY, post-2017).
    Patrz: extractors/nrv2e.py i ocr-service/NOTICE.md.
    """

    def decode(self, raw: bytes) -> dict[str, str]:
        from extractors import nrv2e
        payload = self._try_base64(raw)
        text = nrv2e.decode_dr_payload(payload)
        return self._map_fields(text.split("|"))


class LegacyGzipDecoder(AztecDecoder):
    """
    Fallback dla starszych DR (przed serią BAS/BAV/BAY, ewentualnie pre-2017).
    Próbuje dekompresji GZIP/DEFLATE/zlib, następnie parsowania jako:
      1. Opcjonalnie NRBF (gdy zainstalowana biblioteka 'nrbf' z PyPI)
      2. UTF-8 lub UTF-16LE tekst z separatorem '|'
    """

    def decode(self, raw: bytes) -> dict[str, str]:
        from extractors import nrv2e as nrv2e_mod
        payload = self._try_base64(raw)
        decompressed = nrv2e_mod.try_gzip_decompress(payload)
        if decompressed is None:
            raise ValueError(
                "Payload nie jest GZIP/DEFLATE — brak dekompresorów dla tego formatu. "
                "(Brak libucl1: modern DR wymagają apt install libucl1)"
            )
        logger.debug("GZIP fallback: zdekompresowano %d B → %d B", len(payload), len(decompressed))

        # Próba 1: opcjonalne NRBF (starszy format .NET serialization)
        nrbf_parts = self._try_nrbf(decompressed)
        if nrbf_parts is not None:
            logger.debug("GZIP+NRBF: odczytano %d pól", len(nrbf_parts))
            return self._map_fields(nrbf_parts)

        # Próba 2: pipe-separated UTF-8 / UTF-16LE / latin-1
        for encoding in ("utf-8", "utf-16-le", "latin-1"):
            try:
                text = decompressed.decode(encoding)
                parts = text.split("|")
                if len(parts) >= 5 and any(p.strip() for p in parts):
                    logger.debug("GZIP+%s: odczytano %d pól", encoding, len(parts))
                    return self._map_fields(parts)
            except (UnicodeDecodeError, ValueError):
                continue

        raise ValueError(
            "Nie udało się zdekodować zdekompresowanych danych GZIP jako "
            "pól DR (próbowano NRBF, UTF-8, UTF-16LE, latin-1)"
        )

    @staticmethod
    def _try_nrbf(data: bytes) -> Optional[list[str]]:
        """
        Próbuje sparsować NRBF — używa opcjonalnej biblioteki 'nrbf' z PyPI.
        Zwraca listę pól lub None gdy brak biblioteki lub błąd parsowania.
        """
        try:
            import io
            import nrbf  # opcjonalne: pip install nrbf
            stream = nrbf.read_stream(io.BytesIO(data))
            root = getattr(stream, "root", None)
            if root is None:
                return None
            items: list[str] = []
            if hasattr(root, "array_objects"):
                items = [str(getattr(obj, "value", obj)) for obj in root.array_objects]
            elif hasattr(root, "member_values"):
                items = [str(v) for v in root.member_values.values()]
            return items if len(items) >= 5 else None
        except Exception:
            return None


class AutoDetectDecoder(AztecDecoder):
    """
    Autodetekuje format payloadu i deleguje do właściwej implementacji:
      - GZIP magic (1F 8B) → LegacyGzipDecoder
      - Inny → LibUCLDecoder (NRV2E), z GZIP fallback przy niepowodzeniu

    Wymagana libucl1 (apt install libucl1).
    """

    def __init__(self) -> None:
        self._nrv2e = LibUCLDecoder()
        self._gzip = LegacyGzipDecoder()

    def decode(self, raw: bytes) -> dict[str, str]:
        payload = self._try_base64(raw)

        if self._detect_format(payload) == "gzip":
            logger.debug("AutoDetect: wykryto GZIP — delegowanie do LegacyGzipDecoder")
            return self._gzip.decode(raw)

        # Domyślna ścieżka NRV2E (modern DR)
        try:
            return self._nrv2e.decode(raw)
        except (ValueError, RuntimeError) as nrv2e_err:
            # Defensywny fallback — próba GZIP gdy NRV2E zawiedzie nieoczekiwanie
            logger.debug("NRV2E nie powiodło się (%s), próbuję GZIP fallback", nrv2e_err)
            try:
                return self._gzip.decode(raw)
            except (ValueError, RuntimeError):
                raise nrv2e_err  # podnieś oryginalny błąd NRV2E
