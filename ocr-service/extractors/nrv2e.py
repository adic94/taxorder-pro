"""
Wrapper ctypes dla UCL NRV2E — Markus Oberhumer (GPL-2).
Wymaga: libucl1 zainstalowanego w systemie (apt install libucl1).

Format payloadu Aztec polskiego DR (potwierdzony eksperymentalnie):
    base64_decode(aztec_text) → buf
    buf[0:4]  = little-endian uint32 → oczekiwany rozmiar wyjścia
    buf[4:]   = dane skompresowane NRV2E
    decompress(buf[4:], oczekiwany_rozmiar) → bajty UTF-16LE
    tekst.decode('utf-16-le').split('|') → lista pól

Nie modyfikuj tej funkcji bezpośrednio — reszta systemu komunikuje się
przez interfejs AztecDecoder (extractors/aztec_decoder.py).
"""
from __future__ import annotations

import ctypes
import ctypes.util
import logging
import struct
from typing import Optional

logger = logging.getLogger(__name__)

UCL_E_OK = 0

# Nazwy do przeszukania (ldconfig może wyeksportować różnie)
_LIB_NAMES = ["libucl.so.1", "libucl.so", "ucl"]


def _load_ucl() -> Optional[ctypes.CDLL]:
    """Ładuje libucl. Zwraca None jeśli biblioteka niedostępna."""
    # Najpierw find_library (używa ldconfig/ld.so)
    found = ctypes.util.find_library("ucl")
    candidates = ([found] if found else []) + _LIB_NAMES

    for name in candidates:
        if not name:
            continue
        try:
            lib = ctypes.cdll.LoadLibrary(name)
            _configure(lib)
            logger.info("libucl załadowana: %s", name)
            return lib
        except OSError:
            continue

    logger.warning("libucl niedostępna — dekodowanie Aztec DR niemożliwe")
    return None


def _configure(lib: ctypes.CDLL) -> None:
    """Ustawia argtypes/restype dla funkcji dekompresji."""
    fn = lib.ucl_nrv2e_decompress_safe_8
    fn.argtypes = [
        ctypes.c_char_p,                   # src
        ctypes.c_uint32,                   # src_len
        ctypes.c_char_p,                   # dst (bufor wyjściowy)
        ctypes.POINTER(ctypes.c_uint32),   # dst_len: wejście = max, wyjście = rzeczywisty
        ctypes.c_void_p,                   # wrkmem (NULL — niepotrzebne przy dekompresji)
    ]
    fn.restype = ctypes.c_int


# Singleton — libucl ładowana raz przy pierwszym użyciu
_lib: Optional[ctypes.CDLL] = None
_lib_loaded = False


def _get_lib() -> Optional[ctypes.CDLL]:
    global _lib, _lib_loaded
    if not _lib_loaded:
        _lib = _load_ucl()
        _lib_loaded = True
    return _lib


def is_available() -> bool:
    """Zwraca True gdy libucl1 jest zainstalowana i możliwa do załadowania."""
    return _get_lib() is not None


def decompress(compressed: bytes, expected_size: int) -> bytes:
    """
    Dekompresuje dane NRV2E przez libucl.

    Parametry:
        compressed    — skompresowane bajty (bez 4-bajtowego nagłówka rozmiaru)
        expected_size — oczekiwany rozmiar wyjścia (z nagłówka LE uint32)

    Zwraca: bajty zdekomresowane (UTF-16LE dla DR).
    Rzuca: RuntimeError gdy libucl niedostępna.
           ValueError gdy UCL zwróci błąd.
    """
    lib = _get_lib()
    if lib is None:
        raise RuntimeError(
            "libucl1 niedostępna — zainstaluj: apt install libucl1  "
            "(Dockerfile już zawiera libucl1)"
        )

    dst_buf = ctypes.create_string_buffer(expected_size)
    dst_len = ctypes.c_uint32(expected_size)

    ret = lib.ucl_nrv2e_decompress_safe_8(
        compressed,
        ctypes.c_uint32(len(compressed)),
        dst_buf,
        ctypes.byref(dst_len),
        None,
    )

    if ret != UCL_E_OK:
        raise ValueError(
            f"ucl_nrv2e_decompress_safe_8 zwróciła kod błędu {ret} "
            f"(wejście {len(compressed)} B, oczekiwano {expected_size} B wyjścia)"
        )

    actual = dst_len.value
    return bytes(dst_buf[:actual])


def decode_dr_payload(raw: bytes) -> str:
    """
    Dekoduje surowe bajty payloadu Aztec DR (po base64-decode).

    Format wejściowy (seria BAS/BAV/BAY, post-2017):
        raw[0:4]  — LE uint32: rozmiar wyjścia po dekompresji
        raw[4:]   — dane NRV2E

    Zwraca: string pól rozdzielonych '|' (UTF-16LE).
    Rzuca: ValueError gdy format nieprawidłowy lub libucl niedostępna.
    """
    if len(raw) < 4:
        raise ValueError(f"Payload zbyt krótki: {len(raw)} B (minimum 4)")

    expected_size = struct.unpack_from("<I", raw, 0)[0]
    compressed = raw[4:]

    if expected_size == 0 or expected_size > 65536:
        raise ValueError(
            f"Nieprawdopodobny rozmiar wyjścia: {expected_size} B "
            "(oczekiwano 100–65536 B dla DR)"
        )

    decompressed = decompress(compressed, expected_size)

    try:
        text = decompressed.decode("utf-16-le")
    except UnicodeDecodeError as e:
        raise ValueError(f"Błąd dekodowania UTF-16LE: {e}") from e

    return text


# ── Fallback dla starszych DR (GZIP) ──────────────────────────────────────────

_GZIP_MAGIC = b"\x1f\x8b"
_ZLIB_MAGIC = b"\x78"  # zlib: 0x78 0x9C (default), 0x78 0xDA (best), 0x78 0x01 (no compress)


def is_gzip(data: bytes) -> bool:
    return len(data) >= 2 and data[:2] == _GZIP_MAGIC


def is_zlib(data: bytes) -> bool:
    return len(data) >= 2 and data[:1] == _ZLIB_MAGIC and data[1] in (0x9C, 0xDA, 0x01, 0x5E)


def try_gzip_decompress(data: bytes) -> Optional[bytes]:
    """
    Próbuje zdekompresować dane GZIP lub zlib (z nagłówkiem i CRC).
    Zwraca zdekompresowane bajty lub None jeśli dekompresja niemożliwa.
    Obsługuje starsze DR (przed serią BAS/BAV/BAY, ewentualnie pre-2017).

    UWAGA: raw DEFLATE (bez nagłówka) celowo NIE jest próbowane — mode -MAX_WBITS
    akceptuje dowolne dane binarne i produkuje śmieciowe wyjście dla strumieni NRV2E.
    Tylko GZIP (magic 1F 8B) i zlib (magic 78 xx) mają walidację CRC i są bezpieczne.
    """
    import zlib
    # Próba 1: GZIP lub zlib — autodetekt nagłówka (wbits=15+32 = obsługa obu)
    try:
        return zlib.decompress(data, zlib.MAX_WBITS | 32)
    except zlib.error:
        pass
    # Próba 2: czysty zlib (wbits=15)
    try:
        return zlib.decompress(data, zlib.MAX_WBITS)
    except zlib.error:
        pass
    return None
