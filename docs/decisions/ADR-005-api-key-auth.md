---
id: ADR-005
title: Klucze API do uwierzytelniania maszyna-maszyna (format tord_live_*)
date: 2024-11-01
status: zaakceptowane
---

## Kontekst

Integracje zewnętrzne (Tekom, ORLEN, enova365, własne skrypty) potrzebowały sposobu na dostęp do API bez przechodzenia przez interaktywne logowanie użytkownika. Tokeny sesyjne nie nadają się do automatyzacji (30-dniowy TTL, brak skopowania per-firma).

## Decyzja

Klucze API z prefiksem `tord_live_` + 43 znaki base64url (256 bit entropii):

- W DB przechowywany tylko `SHA-256(token)` — nigdy plaintext
- Klucz zwracany **dokładnie raz** przy tworzeniu, potem niedostępny
- Skopowany do jednej firmy (`company_id`) — nie można używać klucza firmy A do firmy B
- Dwa zakresy: `read` (eksport) i `read_write` (eksport + import)
- Worker rozróżnia klucze API od tokenów sesji po prefiksie `tord_` w nagłówku `Authorization`

## Konsekwencje

- Tabela `api_keys` w D1 (schema_v6.sql)
- Handler `handleApiKeys` — tylko dla roli `admin`
- Endpoint `GET /api/export` + `POST /api/import` działają z kluczami API
- UI w zakładce "Klucze API" (`modules/api-keys.js`)
