"""
AztecDecoder — adapter izolujący dekodowanie payloadu kodu Aztec DR.

Zasada:
    Reszta systemu używa wyłącznie tej abstrakcji (AztecDecoder).
    Konkretna implementacja (LibUCLDecoder) korzysta z libucl1 (GPL-2)
    przez ctypes — dzięki izolacji komponent można wymienić bez zmian
    w kodzie klienckim.

Hierarchia:
    AztecDecoder (ABC)
      └─ LibUCLDecoder   — produkcja (libucl1 przez ctypes)

Użycie:
    decoder = AztecDecoder.get()          # zwraca najlepszą dostępną impl.
    fields  = decoder.decode(raw_bytes)   # słownik {nazwa: wartość}
"""
from __future__ import annotations

import base64
import logging
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger(__name__)

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
        Próbuje zdekodować raw jako base64 (DR przechowuje payload b64 w Aztec).
        Jeśli base64 zawiedzie — zakłada że raw to już surowe bajty payloadu.
        """
        try:
            text = raw.decode("ascii").strip()
            # Dodaj padding jeśli potrzebny
            padding = (4 - len(text) % 4) % 4
            decoded = base64.b64decode(text + "=" * padding)
            # Sanity-check: pierwszy LE uint32 musi być rozsądnym rozmiarem
            if len(decoded) >= 4:
                import struct
                sz = struct.unpack_from("<I", decoded, 0)[0]
                if 100 < sz < 65536:
                    return decoded
        except Exception:
            pass
        return raw

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
        """Zwraca najlepszą dostępną implementację."""
        from extractors import nrv2e
        if nrv2e.is_available():
            return LibUCLDecoder()
        logger.warning(
            "libucl1 niedostępna — AztecDecoder.get() nie może zwrócić implementacji. "
            "Zainstaluj: apt install libucl1"
        )
        raise RuntimeError(
            "Brak implementacji AztecDecoder: libucl1 niezainstalowana. "
            "Sprawdź Dockerfile (powinien zawierać libucl1)."
        )

    @staticmethod
    def try_get() -> Optional["AztecDecoder"]:
        """Zwraca None zamiast rzucać wyjątek gdy brak implementacji."""
        try:
            return AztecDecoder.get()
        except RuntimeError:
            return None


class LibUCLDecoder(AztecDecoder):
    """
    Implementacja przez ctypes + libucl (GPL-2, Markus Oberhumer).
    Patrz: extractors/nrv2e.py i ocr-service/NOTICE.md.
    """

    def decode(self, raw: bytes) -> dict[str, str]:
        from extractors import nrv2e

        payload = self._try_base64(raw)
        text = nrv2e.decode_dr_payload(payload)
        parts = text.split("|")
        return self._map_fields(parts)
