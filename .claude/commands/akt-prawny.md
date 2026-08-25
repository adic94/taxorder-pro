---
description: Pobiera i czyta polski akt prawny (Dz.U. / M.P.) — z pominięciem ISAP, który blokuje automaty
argument-hint: czego szukasz, np. "stawki opłat środowiskowych 2026" albo "DU 2024 1709"
allowed-tools: Bash(curl *), Bash(python *), Bash(node *), Bash(ls *), Bash(rm *), WebSearch, WebFetch, Read
---

Znajdź, pobierz i odczytaj akt prawny: **$ARGUMENTS**

## 1. Ustal identyfikator aktu

Jeśli nie podano wprost rocznika i pozycji — wyszukaj. Potrzebujesz trzech rzeczy:
**rodzaj** (`DU` = Dziennik Ustaw, `MP` = Monitor Polski), **rok**, **pozycja**.

## 2. ⛔ NIE POBIERAJ Z ISAP

`isap.sejm.gov.pl/isap.nsf/download.xsp/...` **przekierowuje sam na siebie
w nieskończoność** (302 → identyczny URL), niezależnie od User-Agenta i liczby
dozwolonych przekierowań. `curl` i `WebFetch` odbijają się od tego. To nie jest
kwestia doboru narzędzia — zmierzone 25.08.2026.

Działają bezpośrednie serwisy wydawcy, gdzie `NNNN` to pozycja dopełniona
zerami do **czterech** cyfr, a `01` na końcu to numer pliku:

```bash
# Dziennik Ustaw:  https://dziennikustaw.gov.pl/D{ROK}00{NNNN}01.pdf
curl -sL -m 120 "https://dziennikustaw.gov.pl/D2024000170901.pdf" -o akt.pdf

# Monitor Polski:  https://monitorpolski.gov.pl/M{ROK}00{NNNN}01.pdf
curl -sL -m 120 "https://monitorpolski.gov.pl/M2025000076901.pdf" -o akt.pdf
```

## 3. Potwierdź, że to właściwy akt — i że OBOWIĄZUJE

Nie zakładaj po samej nazwie pliku. API ELI podaje tytuł i status:

```bash
curl -sL "https://api.sejm.gov.pl/eli/acts/DU/2024/1709"   # albo .../MP/2025/769
```

Sprawdź `title`, `status` (szukasz „obowiązujący") i `announcementDate`.
**Akt uchylony albo zmieniony wygląda w PDF-ie dokładnie tak samo jak aktualny.**

## 4. Czytaj tekst, nie obrazki

```bash
python -c "
import pypdfium2 as pdfium, sys
sys.stdout.reconfigure(encoding='utf-8')
pdf = pdfium.PdfDocument('akt.pdf')
print('stron:', len(pdf))
for i in range(len(pdf)):
    t = pdf[i].get_textpage().get_text_range() or ''
    if 'SZUKANA_FRAZA' in t: print('strona', i+1)
"
```

Wymaga `pypdfium2` (`pip install pypdfium2`) — jest już w środowisku po pracach OCR.

**Zanim uznasz, że czegoś w akcie NIE MA — sprawdź wyszukiwaniem pełnotekstowym
po WSZYSTKICH stronach, nie tylko tam, gdzie się spodziewasz.** Tak ustalono, że
kod `V.9` (norma EURO) nie występuje w rozporządzeniu o dowodach ANI RAZU — a nasz
prompt OCR kazał modelowi go szukać.

## 5. Przy wyciąganiu TABEL — dwie pułapki, obie zmierzone

**Separator dziesiętny bywa niekonsekwentny.** W M.P. 2025 poz. 769 jedna komórka
ma `10.01` z KROPKĄ, reszta przecinki. Regex wymagający przecinka pominął ten wiersz
i przypisał mu wartości wiersza NASTĘPNEGO — ciche przesunięcie stawki finansowej
o jeden wiersz, przy pozornie sensownym wyniku. Akceptuj `[,.]`.

**Zawsze sprawdź kompletność numeracji.** Jeśli tabela ma kolumnę Lp — policz, czy
masz wszystkie pozycje bez luk. To jedyny tani sposób wykrycia takiego przesunięcia.

## 6. Zasada nadrzędna

Jeżeli po odczycie coś się **nie zgadza ze strukturą danych w kodzie** — zgłoś to
zamiast dopasowywać liczby do istniejącego kształtu. Tak wyszło, że
`ENV_FEE_RATE_SETS` miało klucz dwuwymiarowy przy tabeli trójwymiarowej: wpisanie
stawek „jak leci" zaniżyłoby należność wobec urzędu o ~40%, a wynik wyglądałby
wiarygodnie.

## 7. Posprzątaj

Akty prawne są publiczne, ale pliki PDF nie należą do repozytorium:
`rm -f akt.pdf`. Do kodu trafia **odczytana wartość wraz z `zrodlo`** (rodzaj, rok,
pozycja, adres), nie plik.
