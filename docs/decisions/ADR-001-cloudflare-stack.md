---
id: ADR-001
title: Cloudflare Pages + Worker + D1 jako główny stack
date: 2024-01-01
status: zaakceptowane
---

## Kontekst

Potrzebowaliśmy taniego, łatwego w utrzymaniu stosu dla aplikacji SPA z backendem i bazą danych, bez konieczności zarządzania serwerami.

## Decyzja

Używamy:
- **Cloudflare Pages** — hosting SPA (HTML/CSS/JS, brak bundlera)
- **Cloudflare Worker** — backend API (`worker/index.js`)
- **D1 SQLite** — relacyjna baza danych przy Worker
- **R2** — przechowywanie plików (zdjęcia szkód, dokumenty)
- **KV** — cache (sesje, tokeny VAPID)

## Konsekwencje

- Brak Node.js na serwerze — Worker to środowisko `workerd` (podzbiór Web API)
- SQL to SQLite (nie PostgreSQL) — brak niektórych funkcji (np. `RETURNING` działa, `JSON_TABLE` nie)
- Deploy jedną komendą: `wrangler deploy`
- Koszt: darmowy plan dla małego ruchu, pay-as-you-go powyżej
