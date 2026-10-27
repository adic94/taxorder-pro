# Aztec — ustalenia (przeniesione z CLAUDE.md bez zmian treści)

### Aztec — ustalenia z 12.08.2026 (NIE odtwarzaj tego śledztwa od zera)

**Teza „brakuje nam warstwy obraz → bajty Aztec" jest NIEPRAWDZIWA.** Warstwa istnieje
i działa po stronie przeglądarki: `loadZXing()` + `tryAztecFromCanvas()` (`app.js:5868`
i `5880`), używane przez `modules/dr-import.js:_tryAztecBlob`, które próbuje czterech
obrotów. Architektura jest świadoma: detekcja w przeglądarce, NRV2E i parsowanie pól
w Workerze (`handleAztec`, `/api/aztec`, przyjmuje `bytesBase64`).

**Realne znalezisko: `modules/aztec-detector.js` jest martwy w aplikacji.** Kaskada
9 strategii, do 42 prób, budżet 6 s, obsługa dowolnych kątów obrotu. Jest ładowany
w `index.html:4318`, ale wołają go **wyłącznie** `tools/dr-helper.html`
i `tools/aztec-bench.html` — narzędzia deweloperskie. Import dowodu jedzie słabszą
ścieżką. Ktoś zbudował nawet benchmark porównujący obie, ale migracja nie nastąpiła.

**Dlaczego nie wolno go podpiąć „po prostu":**
- `tryAztecFromCanvas` ustawia `CHARACTER_SET: ISO-8859-1` i odzyskuje bajty przez
  `text.charCodeAt(i) & 0xFF` — ISO-8859-1 to mapowanie 1:1 bajt↔znak, więc to działa.
- `aztec-detector.js` woła `.getText()` **bez** tej wskazówki (linie 157 i 176).
- Ładunek DR jest binarny (NRV2E), więc różnica dotyczy wierności bajtów ≥ 0x80.

**Hipoteza „wystarczy dopiąć charset" ZOSTAŁA OBALONA.** Round-trip na `@zxing/library@0.20.0`
(zainstalowanej lokalnie — `registry.npmjs.org` jest w wyjątkach proxy, więc da się to
powtórzyć bez sieci do CDN): `AztecEncoder.encode()` na ładunku z bajtami `0x80`–`0xFF`,
potem `AztecCodeReader.decode()` — wywala się na `URI malformed` **zarówno z wskazówką
ISO-8859-1, jak i bez niej**. Detekcja przechodzi, przewraca się dopiero warstwa tekstowa.
Czyli biblioteka ignoruje `CHARACTER_SET` na ścieżce Aztec, a poprawka jest głębsza niż
jedna wskazówka.

**ZNALEZIONE 12.08 PO NAPISANIU NARZĘDZIA — WADA JEST W ŚCIEŻCE PRODUKCYJNEJ, nie tylko
w detektorze.** `node tools/aztec-compare.js --selftest` generuje kod Aztec o ZNANYM ładunku
i porównuje odczytane bajty z oryginałem. Wynik na obu ścieżkach identyczny i **błędny**:

    oczekiwano: 64 00 00 00 80 81 8d 90 9f ff 41 42
    odczytano : 64 00 00 00 ac 81 8d 90 78 ff 41 42
                            ^^                ^^
    poz.4: 0x80 → 0xAC     poz.8: 0x9F → 0x78

To podpis **CP1252**: `0x80` to tam znak euro (U+20AC), a `charCodeAt(i) & 0xFF` z U+20AC
daje `0xAC`. Przeglądarka nie stosuje czystego ISO-8859-1 **mimo wymuszonej wskazówki
CHARACTER_SET**. Dotyczy to `tryAztecFromCanvas()` w `app.js`, czyli ścieżki, którą
JEDZIE PRODUKCYJNY IMPORT DOWODU — nie tylko nieużywanego detektora.

Ładunek NRV2E to dowolne bajty, więc zakres `0x80`–`0x9F` w prawdziwych dowodach
wystąpi. **HIPOTEZA DO SPRAWDZENIA:** część dowodów kwalifikowanych dotąd jako
„nieczytelne" (patrz `tools/dr-analyze-unreadable.js`, `dr-coverage-report.json`)
mogła w rzeczywistości zostać poprawnie wykryta i dopiero zniekształcona na warstwie
tekstowej. Nie potwierdzone na realnym dokumencie.

**NAPRAWIONE — przyczyna okazała się inna, niż zakładał ten akapit.** `getRawBytes()`
jest nieosiągalne: `Decoder.decode()` woła `getEncodedData()` PRZED złożeniem wyniku
i to ono rzuca `URIError`. Sedno leży głębiej: w trybie binarnym dekoder odczytuje
**dokładną wartość bajtu** (`readCode(bits, index, 8)`), po czym przepuszcza ją przez
`StringUtils.castAsNonUtf8Char` → `TextDecoder`. A **standard WHATWG mapuje etykietę
„ISO-8859-1" na windows-1252** — stąd `0x80` → U+20AC → `0xAC` i `0x9F` → U+0178 → `0x78`.
Wskazówka `CHARACTER_SET` nie ma z tym nic wspólnego, bo mapowanie robi warstwa tekstowa.

Naprawa jest odwróceniem tej tablicy: `_aztecTextToBytes()` w `app.js` mapuje 27 punktów
kodowych, w których windows-1252 różni się od ISO-8859-1, z powrotem na bajty.
Zweryfikowane `node tools/aztec-compare.js --selftest` — wynik zawiera na stałe linię
„bez naprawy", pokazującą oba zniekształcenia, więc regresja od razu rzuci się w oczy.

**Cała ścieżka DEKODOWANIA zweryfikowana end-to-end — bez zdjęcia (12.08).** `--selftest`
nie sprawdza już samych bajtów: buduje ładunek w **prawdziwym formacie DR** (nowy, 55 pól),
koduje go jako Aztec, renderuje do obrazu i przepuszcza przez pełną produkcyjną ścieżkę
obraz → Aztec → bajty → NRV2E → UTF-16LE → pola. Wynik: **17/17 pól zgodnych** na obu
ścieżkach, `format=new`. Kontrola negatywna (stara konwersja `charCodeAt & 0xFF`) na tym
samym ładunku **nie przechodzi** — a gdyby przeszła, test krzyczy „nie mierzy tego, co
deklaruje", zamiast po cichu zaświecić na zielono.

Dwie rzeczy, które to umożliwiły:
- `_decodeAztecPayload()` **wydzielone z `handleAztec`** (`worker/index.js`) — narzędzie
  wyciąga tę funkcję z pliku Workera i uruchamia **dokładnie kod produkcyjny**, zamiast
  trzymać kopię. Kopia rozjechałaby się i ukryła właśnie ten błąd, który ma wykrywać
  (precedens: dwie tablice CO2, dwie listy źródeł kreatora raportów). Kotwice ekstrakcji
  są jawne — ich brak przerywa działanie, nie powoduje cichego fallbacku.
- Kompresora NRV2E nie mamy i nie jest potrzebny: dekompresor obsługuje wariant
  **„same literały"** (bit 1 = kolejny bajt to literał) tą samą ścieżką co strumień
  z odwołaniami wstecz. Round-trip przez produkcyjny `_nrv2eDecompress()` to potwierdza.

**Efekt uboczny — pytanie o detektor częściowo rozstrzygnięte:** po naprawie konwersji
ścieżka B (`aztec-detector.js`) zwraca bajty **identyczne** ze ścieżką A. Wcześniej nie
było to wiadome; `tools/aztec-bench.html` tego nie mierzył, bo nigdy nie konwertował
wyniku z powrotem na bajty.

**Czego nadal brakuje — i tylko tego:** jednego prawdziwego **zdjęcia**. Pozostała
niewiadoma zawęziła się z „czy dekodowanie działa" do „czy **detekcja** działa na
sfotografowanym dokumencie" — perspektywa, ostrość, oświetlenie, artefakty JPEG.
Selftest używa czystego renderu, więc o tym nie mówi nic. Zdjęcie trzymaj POZA
repozytorium (dowód zawiera VIN i dane właściciela); narzędzie nic nie zapisuje,
a VIN, nr rej. i serię dowodu **maskuje na wyjściu**, żeby log dało się wkleić
do zgłoszenia bez wycieku.

    node tools/aztec-compare.js ~/Documents/taxorder-backupy/dowod.jpg

**Zbiór odniesienia do porównywania modeli OCR — bez ręcznego etykietowania.** Pytanie
„który model OCR jest lepszy dla NASZYCH dowodów" nie ma odpowiedzi w cudzych benchmarkach:
nasze dokumenty to formularz o stałym układzie, a wąskim gardłem nie jest rozpoznawanie
znaków, tylko trafienie we właściwe pole (F.1 z żółtej tabeli, nie F.2; litera K to
homologacja, nie VIN). Aztec daje pola ze **100% pewnością**, więc każdy dokument
z odczytanym kodem jest darmową próbką odniesienia:

    node tools/aztec-compare.js --katalog "<folder z dowodami>" \
      --zapisz-prawde ~/Documents/taxorder-backupy/aztec-prawda.json

Deduplikuje po VIN, zostawiając dowód z najpóźniejszą datą wydania (leasingowy kontra
własny po wykupie). **Zapis do drzewa repozytorium jest ODMAWIANY, nie ostrzegany** —
plik zawiera niezamaskowane VIN-y i dane właścicieli, a `.gitignore` nie działa wstecz.
Pilnuje tego bramka `tests/unit/aztec-prawda-guard-test.js`.

**Inter Cars nie jest tu odpowiedzią.** Ich `/pl/api/aztec/file/decode` kończy się na
VIN-ie i przekazaniu go do dostawców `[GA09, MRS7, BTR5, BTR6]` — służy identyfikacji
auta pod katalog części. DT-1 potrzebuje DMC, liczby osi i zawieszenia, czyli pełnego
ładunku dowodu, którego IC nie oddaje. Do tego stopka e-Cat niesie zastrzeżenie TecDoc
zakazujące kopiowania ich bazy.


