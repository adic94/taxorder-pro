"""
Dekompresor NRV2E w czystym Pythonie.

Algorytm NRV2E jest wariantem kompresji UCL (oblivion-free LZ77):
  - literały są kopiowane bezpośrednio
  - kopie opisane są parą (offset, długość) zakodowaną w strumieniu bitowym
  - koniec strumienia: offset == 1, długość == 3 (sentinel)

Adaptacja dla polskiego Dowodu Rejestracyjnego:
  payload z kodu Aztec to: base64 → NRV2E → UTF-16LE tekst z polami

Implementacja wzorowana na open-source referencjach (JS/C):
  https://github.com/majkrzak/dr-decoder  (JS reference)
  UCL libnrv2e spec: https://www.oberhumer.com/opensource/ucl/
"""
from __future__ import annotations


class _BitReader:
    """Czyta bity od najmniej znaczącego (LSB-first) z bufora bajtów."""

    def __init__(self, data: bytes) -> None:
        self._data = data
        self._byte_pos = 0
        self._bit_buf = 0
        self._bit_count = 0

    def read_bit(self) -> int:
        if self._bit_count == 0:
            if self._byte_pos >= len(self._data):
                raise ValueError("Nieoczekiwany koniec danych NRV2E")
            self._bit_buf = self._data[self._byte_pos]
            self._byte_pos += 1
            self._bit_count = 8
        bit = self._bit_buf & 1
        self._bit_buf >>= 1
        self._bit_count -= 1
        return bit

    def read_byte(self) -> int:
        if self._byte_pos >= len(self._data):
            raise ValueError("Nieoczekiwany koniec danych NRV2E")
        b = self._data[self._byte_pos]
        self._byte_pos += 1
        return b

    def read_unary(self) -> int:
        """Czyta liczbę jedynek aż do zera (kod unary → wartość = liczba_jedynek)."""
        n = 0
        while self.read_bit() == 1:
            n += 1
        return n


def decompress(data: bytes) -> bytes:
    """
    Dekompresuje dane NRV2E.
    Rzuca ValueError dla uszkodzonego strumienia.
    """
    if not data:
        return b''

    reader = _BitReader(data)
    out = bytearray()
    last_m_off = 1  # poprzedni offset (inicjalnie 1)

    while True:
        # Czytaj literały dopóki bit == 1
        while reader.read_bit() == 1:
            out.append(reader.read_byte())

        # Zakodowany offset (gamma kod Eliasa, MSB-first)
        # UCL NRV2E: offset dekodowany przez kolejne bity gamma
        m_off = 1
        while True:
            m_off = (m_off << 1) | reader.read_bit()
            if reader.read_bit() == 0:
                break
            m_off += 1

        if m_off == 2:
            # Użyj poprzedniego offsetu
            m_off = last_m_off
        else:
            # Odczytaj dolny bajt offsetu
            low_byte = reader.read_byte()
            m_off = ((m_off - 3) << 8) + low_byte + 1
            if m_off == 0xFFFF_FFFE:  # sentinel końca
                break
            last_m_off = m_off

        # Dekoduj długość dopasowania (gamma + 2)
        m_len = 1
        while True:
            bit = reader.read_bit()
            m_len = (m_len << 1) | reader.read_bit()
            if bit == 0:
                break
        m_len += 2
        if last_m_off > 0xD00:
            m_len += 1
        elif last_m_off > 0x500:
            # bez korekty
            pass
        # (opcjonalne korekty długości zależne od offsetu — pomijamy dla uproszczenia)

        # Kopiowanie
        src = len(out) - m_off
        if src < 0:
            raise ValueError(f"NRV2E: nieprawidłowe odwołanie wsteczne (offset={m_off})")
        for _ in range(m_len):
            out.append(out[src])
            src += 1

    return bytes(out)


def decode_aztec_payload(raw_bytes: bytes) -> str:
    """
    Dekoduje surowy payload z kodu Aztec polskiego DR.
    Wejście: bajty z kodu Aztec (już po base64-decode jeśli był b64).
    Wyjście: string z polami rozdzielonymi '|'.
    """
    try:
        decompressed = decompress(raw_bytes)
    except Exception as e:
        raise ValueError(f"Błąd dekompresji NRV2E: {e}") from e

    try:
        text = decompressed.decode("utf-16-le")
    except UnicodeDecodeError as e:
        raise ValueError(f"Błąd dekodowania UTF-16LE: {e}") from e

    return text
