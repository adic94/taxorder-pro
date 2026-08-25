---
description: Diagnoza parsera DR — dlaczego pole się nie wyciąga (brak odczytu vs brak dopasowania)
argument-hint: nazwa pola albo ścieżka do dokumentu, np. "zawieszenie" albo "C:\...\dowod.pdf"
allowed-tools: Bash(node *), Bash(python *), Bash(cd *), Read, Grep, Edit
---

Zdiagnozuj ekstrakcję pól z dowodu rejestracyjnego: **$ARGUMENTS**

## Zasada nadrzędna: NAJPIERW ZMIERZ, POTEM ZMIENIAJ

Sesja 25.08 dała +105% pól (6,1 → 12,5 na dokument) i **żadna z pięciu poprawek
nie wyszła ze zgadywania** — wszystkie z pomiaru. Nie strój regexów, dopóki nie
wiesz, czy problem jest w odczycie, czy w dopasowaniu.

## 1. Pokrycie pól — gdzie właściwie jest problem

```bash
node -e "
const fs=require('fs');
const d=JSON.parse(fs.readFileSync('<checkpoint.json>','utf8'));
const l={}; let n=0;
for(const v of Object.values(d)){n++;Object.keys(v).filter(k=>!k.startsWith('_')).forEach(k=>l[k]=(l[k]||0)+1);}
console.log('dokumentow:',n);
Object.entries(l).sort((a,b)=>b[1]-a[1]).forEach(([k,c])=>console.log(' ',k.padEnd(18),c+'/'+n,Math.round(c/n*100)+'%'));
"
```

Pole z pokryciem **0–5% przy innych po 50%** to nie „słaby model" — to prawie zawsze
błąd w parserze albo w promptcie. Tak wyszły: `marka` 2%, `kategoria` 0%, `rokProd` 0%.

## 2. Surowe boxy — pytanie, którego wynik parsera nie rozstrzyga

**Puste pole ma DWIE zupełnie różne przyczyny i wyglądają identycznie:**
- (a) OCR nie odczytał tekstu z tej rubryki,
- (b) odczytał, ale parser geometryczny nie dopasował go do etykiety.

```bash
node tools/dr-ocr-boxes.js "<sciezka-do-pdf>" [--szukaj TEKST]
```

Wypisuje każdy box z pozycją i pewnością. Jeśli wartość JEST na liście, a pole
puste — to (b), czyli nasz kod. Jeśli jej nie ma — to (a), czyli materiał.

⚠ Wynik zawiera VIN i dane właściciela. **Nie zapisuj do repozytorium.**

## 3. Strojenie lokalne — 10 s zamiast 14 min

Nie wdrażaj na Cloud Run przy każdej zmianie regexa:

```bash
cd ocr-service && python stroj_lokalnie.py "<plik.pdf>" [--boxy] [--json]
python stroj_lokalnie.py --katalog "<folder>" --limit 20
```

Uruchamia **ten sam parser** (import z `extractors/`, nie kopia). Render lokalny
i produkcyjny to różne rasteryzatory, więc porównuj **względnie** („czy moja zmiana
pomogła"), a liczby do raportu bierz z przebiegu wsadowego.

## 4. Cztery wzorce awarii, wszystkie już tu wystąpiły

| Objaw | Prawdziwa przyczyna | Jak sprawdzić |
|---|---|---|
| Pole puste, mimo że tekst jest czytelny | Odwrócony układ strony — etykieta ląduje po ZŁEJ stronie wartości | Porównaj pozycje `x` etykiety i wartości w boxach |
| Pole ma wartość, ale **złą** | Dopasowanie do sąsiedniej rubryki | Sprawdź jednostkę: `18,82 kN` to nacisk osi, nie DMC |
| Pole 2–4% przy innych 50% | Etykieta i wartość w JEDNYM boxie (`"D.1 TOYOTA"`) | Poszukaj wzorca w boxach — potrzebny `COMBINED_PATTERNS` |
| Wartość odrzucana mimo poprawności | Sklejanie cyfr z części dziesiętnej (`"2755,00 cm³"` → 275500) | Sprawdź, czy wypada poza `NUMERIC_RANGES` |

## 5. Gdy etykieta jest nieczytalna — dziedzina zamknięta

Etykiety jednoliterowe (`J`) i wielowyrazowe (`ROK PRODUKCJI`) bywają dla OCR
nieczytelne albo rozbite na kilka boxów. Jeśli pole ma **skończony zbiór wartości**,
szukaj WARTOŚCI wprost, nie przez etykietę — tak naprawiono `kategoria`
i `przeznaczenie`.

⚠ **Wzorzec musi być wąski.** Dziedzina kategorii zawiera formy jednoliterowe
(`C`, `T`, `R`, `S`) — poprawne w katalogu, katastrofalne jako wzorzec wyszukiwania:
litera `C` oznacza sekcję danych właściciela i trafia się na KAŻDEJ stronie.
Zmierzone: 43 z 48 „trafień" to była właśnie ona.

## 6. Każdą poprawkę zamknij asercją — i sprawdź ją NEGATYWNIE

Dopisz test do `ocr-service/tests/test_rapid_fields.py` na spreparowanych boxach
(nie wymaga modeli). **Test uznaj za wiarygodny dopiero, gdy PADNIE na kodzie
sprzed poprawki** — inaczej nie wiadomo, czy cokolwiek mierzy.

## 7. Zmiana w katalogu pól

`modules/dr-fields.js` jest źródłem prawdy. Dziedzina kategorii istnieje też
w `ocr-service/extractors/rapid_fields.py` (kopia konieczna — inny język, inny
obraz Dockera), pilnowana przez `tests/unit/dr-domains-sync-test.js`.
**Dopisując kategorię — dopisz ją w katalogu JS**, bramka wymusi resztę.
