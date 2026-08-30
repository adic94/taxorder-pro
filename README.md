# TaxOrder Pro

System deklaracji podatku od środków transportowych (DT-1 / DT-1/A) dla 6 firm floty.



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

## Uruchomienie lokalne

Nie otwieraj `index.html` przez `file://`. Aplikacja korzysta z zasobów HTTP i CSP.

```powershell
npm.cmd ci
npm.cmd run serve
```

Następnie otwórz `http://localhost:3000`.

Pełne środowisko Worker + lokalne D1 uruchom poleceniem:

```powershell
.\dev.ps1
```

Wymaga ono skonfigurowanego Wranglera i udostępnia frontend na `http://localhost:3000`
oraz Worker na `http://localhost:8787`.

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
