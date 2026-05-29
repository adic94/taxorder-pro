# TaxOrder Pro

System deklaracji podatku od środków transportowych (DT-1 / DT-1/A) dla 6 firm floty.

## Firmy
- mToilet Sp. z o.o. (NIP: 5361938486)
- G-CON Sp. z o.o. (NIP: 5223036167)
- G-Rental Sp. z o.o. (NIP: 9522192210)
- KJR Supply Sp. z o.o. (NIP: 5223116423)
- NWK Invest Sp. z o.o. (NIP: 5361920285)
- Wolund Synergy Sp. z o.o. (NIP: 5253006751)

## Pliki
| Plik | Opis |
|------|------|
| `index.html` | Główna aplikacja (PDFy DT-1/DT-1A + Roboto wbudowane jako base64) |
| `app.js` | Logika: PDF fill, OCR, CEPiK, kalkulacje podatku |
| `style.css` | Style |
| `pdf-lib.min.js` | Biblioteka PDF (v1.17.1) |
| `fontkit.umd.min.js` | Fontkit dla polskich znaków |
| `DT1formularz.pdf` | Oryginalny formularz MF DT-1(5) |
| `DT1Azalacznik.pdf` | Oryginalny załącznik MF DT-1/A(5) |
| `Roboto.ttf` | Czcionka z polskimi znakami |

## Uruchomienie
Otwórz `index.html` w Chrome. Wszystkie pliki muszą być w tym samym folderze.

## Stawki 2026
Uchwała XXIX/1065/2025 Rady m.st. Warszawy z 20.11.2025 r.

## CEPiK API
- Token URL: `https://api-cpa.gov.pl/token`
- API URL: `https://api.cepik.gov.pl`
- CORS: wymagany proxy lub serwer

## Ostatnie zmiany
- Synchronizacja danych firmy z COMPANIES[currentCompanyId]
- Filtrowanie pojazdów po właścicielu (vehicle.wlasciciel)
- Poz. 7 DT-1: nazwa z co.name
- Poz. 6/18/19 DT-1: poprawna logika
- OCR: parsowanie MRZ z obrotu 180°, wszystkie 4 kąty
- CEPiK: kompletna mapa pól wg swagger api.cepik.gov.pl
