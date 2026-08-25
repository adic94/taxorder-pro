"""
Strojenie parsera DR LOKALNIE — bez deployu na Cloud Run.

DLACZEGO TO ISTNIEJE. Sesja 25.08 pokazała, że wąskim gardłem nie jest ani model,
ani kod, tylko PĘTLA SPRZĘŻENIA: każda zmiana regexa w `rapid_fields.py` wymagała
`gcloud run deploy` (~4 min) plus przebiegu wsadowego (~10 min), zanim dało się
zobaczyć skutek. Przy siedmiu poprawkach tego dnia to godziny czekania na
odpowiedź, którą lokalnie dostaje się w sekundy.

    python stroj_lokalnie.py <plik.pdf|jpg|png> [--boxy] [--json]
    python stroj_lokalnie.py --katalog <folder> [--limit 20]

`--boxy`     wypisuje surowe boxy OCR (jak tools/dr-ocr-boxes.js, ale bez sieci)
`--json`     sam wynik jako JSON — do porównań między wersjami parsera
`--katalog`  przebieg po wielu dokumentach + zbiorcze pokrycie pól

Wymaga `pip install rapidocr onnxruntime pypdfium2` (te same wersje co
requirements.txt). Modele pobierają się same przy pierwszym uruchomieniu
(~8 MB, potem są na dysku). Zmierzone: ~10 s na dokument wobec ~14 min pętli
deploy + przebieg wsadowy.

⚠ CO TO NARZĘDZIE MIERZY, A CZEGO NIE. Render lokalny (`pypdfium2`) i produkcyjny
(`pdf.js` w `tools/dr-ocr-batch-cloudrun.js`) to DWA RÓŻNE rasteryzatory przy tym
samym DPI — dają nieco inne boxy, więc bezwzględne pokrycie potrafi się różnić
o pojedyncze pola (zmierzone na WE6LR80: lokalnie 16 pól, przez Cloud Run 13).
Używaj tego do porównań WZGLĘDNYCH — „czy moja zmiana regexa poprawiła wynik na
tym samym pliku" — a liczby do raportu bierz z przebiegu wsadowego. Sam parser
(`parse_fields_spatial`) jest identyczny w obu ścieżkach, bo to ten sam plik.

⚠ Wynik zawiera pełny tekst dokumentu (VIN, dane właściciela). Nie zapisuj
do repozytorium — patrz reguła o danych produkcyjnych w CLAUDE.md.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from extractors.preprocessing import load_images_from_bytes  # noqa: E402
from extractors.rapid_fields import run_rapid_ocr, parse_fields_spatial  # noqa: E402


DPI_JAK_WSAD = 150  # tools/dr-ocr-batch-cloudrun.js renderuje 150 DPI — trzymamy się tego


def _wczytaj(sciezka: Path):
    """
    PDF → obraz. Produkcja robi to przez `pdf2image` (poppler), którego na
    Windowsie zwykle nie ma; `pypdfium2` przychodzi razem z RapidOCR i renderuje
    to samo bez zależności systemowej.

    ⚠ RENDER MUSI ODPOWIADAĆ PRODUKCYJNEMU, inaczej narzędzie mierzy własny render,
    nie zachowanie parsera — dokładnie ta pułapka, która w tym projekcie już raz
    kosztowała diagnozę (patrz PDF_AZTEC vs PDF_OCR w CLAUDE.md). Stąd 150 DPI:
    tyle daje `dr-ocr-batch-cloudrun.js`, którym liczone są wszystkie pomiary pokrycia.
    """
    dane = sciezka.read_bytes()
    if sciezka.suffix.lower() != ".pdf":
        return load_images_from_bytes(dane)

    try:
        return load_images_from_bytes(dane)
    except Exception:
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(dane)
        strona = pdf[0]
        obraz = strona.render(scale=DPI_JAK_WSAD / 72).to_pil()
        return [obraz.convert("RGB")]


def przetworz(sciezka: Path):
    obrazy = _wczytaj(sciezka)
    if not obrazy:
        return None, [], (0, 0)
    boxes, w, h = run_rapid_ocr(obrazy[0])
    wynik = parse_fields_spatial(boxes, float(w), float(h))
    return wynik, boxes, (w, h)


def wypisz_jeden(sciezka: Path, pokaz_boxy: bool, jako_json: bool):
    wynik, boxes, (w, h) = przetworz(sciezka)
    if wynik is None:
        print(f"BŁĄD: nie udało się wczytać {sciezka}")
        return {}

    niepuste = {k: v for k, (v, _c) in wynik.items() if v}

    if jako_json:
        print(json.dumps(niepuste, ensure_ascii=False, indent=2))
        return niepuste

    print(f"\n  {sciezka.name} — {w}x{h}, {len(boxes)} boxów\n")

    if pokaz_boxy:
        # Kolejność czytania: wiersz (zaokrąglony y), potem kolumna (x)
        for b in sorted(boxes, key=lambda b: (round(b.y0 / 20), b.x0)):
            print(f"    [{b.x0:5.0f},{b.y0:5.0f} {b.x1:5.0f},{b.y1:5.0f}] {b.score:.2f}  {b.text!r}")
        print()

    print(f"  WYNIK — {len(niepuste)} pól:")
    for k in sorted(niepuste):
        print(f"    {k:22} = {niepuste[k]!r}")
    puste = [k for k, (v, _c) in wynik.items() if not v]
    if puste:
        print(f"\n  puste ({len(puste)}): {', '.join(sorted(puste))}")
    return niepuste


def przebieg_katalog(folder: Path, limit: int):
    pliki = [p for p in sorted(folder.rglob("*"))
             if p.suffix.lower() in (".pdf", ".jpg", ".jpeg", ".png")][:limit]
    print(f"\n  Przebieg po {len(pliki)} dokumentach z {folder}\n")

    pokrycie: dict[str, int] = {}
    lacznie = 0
    for i, p in enumerate(pliki, 1):
        try:
            wynik, _boxes, _wh = przetworz(p)
            niepuste = {k: v for k, (v, _c) in (wynik or {}).items() if v}
        except Exception as e:
            print(f"  [{i}/{len(pliki)}] ✗ {p.name} — {e}")
            continue
        lacznie += len(niepuste)
        for k in niepuste:
            pokrycie[k] = pokrycie.get(k, 0) + 1
        print(f"  [{i}/{len(pliki)}] {len(niepuste):2} pól  {p.name}")

    n = len(pliki) or 1
    print(f"\n  Razem: {lacznie} pól, średnio {lacznie / n:.1f} na dokument\n")
    print("  POKRYCIE PÓL:")
    for k, c in sorted(pokrycie.items(), key=lambda kv: -kv[1]):
        print(f"    {k:22} {c:3}/{len(pliki)}  {c / n * 100:3.0f}%")


def main():
    argv = sys.argv[1:]
    if not argv:
        print(__doc__)
        sys.exit(2)

    if "--katalog" in argv:
        folder = Path(argv[argv.index("--katalog") + 1])
        limit = int(argv[argv.index("--limit") + 1]) if "--limit" in argv else 20
        if not folder.is_dir():
            print(f"BŁĄD: {folder} nie jest katalogiem")
            sys.exit(2)
        przebieg_katalog(folder, limit)
        return

    sciezka = Path(argv[0])
    if not sciezka.is_file():
        print(f"BŁĄD: {sciezka} nie istnieje")
        sys.exit(2)
    wypisz_jeden(sciezka, "--boxy" in argv, "--json" in argv)


if __name__ == "__main__":
    main()
