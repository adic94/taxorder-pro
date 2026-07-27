---
description: Skan bezpieczeństwa — sekrety w kodzie, otwarte endpointy, IDOR
allowed-tools: Bash(grep *), Bash(rg *), Bash(git log*), Bash(node *), Read, Glob, Grep
---

Skan bezpieczeństwa TaxOrder. Kolejność od najgroźniejszego.

## 1. Sekrety w kodzie serwowanym publicznie

`app.js`, `index.html`, `modules/**`, `config/**` trafiają na Cloudflare Pages
i są dostępne bez logowania. Szukaj: kluczy API, sekretów OAuth, tokenów,
haseł, connection stringów — także jako **wartości domyślne** w wyrażeniach
`localStorage.getItem(x) || 'wartosc'`. Tak wyciekły klucze CEPiK.

Sprawdź też, czy coś takiego nie siedzi w historii gita.

## 2. Endpointy bez uwierzytelnienia

Przejrzyj router w `worker/index.js`. Każda trasa `/api/*` poza logowaniem,
healthcheckiem i publicznymi musi mieć `if (!user) return err(..., 401)`.

Historycznie otwarte były trzy endpointy `/api/cepik/*` — Worker działał
jako publiczne proxy do rejestru państwowego.

## 3. IDOR

Operacje `PATCH`/`DELETE`/`PUT` po `id` bez `company_id` w `WHERE`.
Wzorzec poprawny: `WHERE id=? AND company_id=?` plus sprawdzenie
`r.meta.changes === 0` — `404`.

`users.company_id` jest **nullable** od schema_v22 — poprawka nie może
zwracać 403 przy pustej wartości. Konwencja w pliku: `user.company_id || 'mtoilet'`.

## 4. Egzekwowanie licencji

Sprawdź, czy `enforceModuleAccess` pokrywa nowe endpointy. Endpoint płatnego
modułu bez wpisu w `MODULE_ROUTES` jest dostępny dla każdego pakietu.

## 5. XSS

`npm run xss-audit`. Zwróć uwagę na `innerHTML` z danymi z API bez `esc()`.

## Raport

Uporządkuj po realnym ryzyku, nie po liczbie trafień. Dla każdego: co jest
eksploatowalne **teraz**, a co jest długiem. Nie naprawiaj bez zgody.
