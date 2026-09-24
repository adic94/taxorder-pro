# ADR-010: Jedna platforma importu i eksportu

Status: Proposed

## Kontekst

Repo zawiera wiele dobrych importerów, lecz każdy ma własny UX, mapowanie i raport. Brakuje profili wielokrotnego użycia i bezpiecznego dry-run.

## Decyzja

Zbudować jeden kreator na wspólnym pipeline: `detect → parse → map → transform → validate → deduplicate → preview → approve → apply → report`. Parsery domenowe stają się pluginami.

## Formaty

CSV, TXT/fixed-width, XLS, XLSX, XLSM, XML, JSON, PDF/OCR i ZIP. XLSM nigdy nie wykonuje VBA. XML blokuje DTD/XXE. ZIP ma ochronę Zip Slip/bomb. CSV eksport chroni przed Formula Injection.

## Rollback

Możliwy tylko dla zmian jednoznacznie przypisanych do runu i niezmienionych później. W pozostałych przypadkach generowana jest operacja kompensująca do zatwierdzenia.

## Kryterium akceptacji

Ten sam profil działa ręcznie i cyklicznie, dry-run pokazuje identyczny plan zmian jak wykonanie, a odrzucone wiersze mają kod błędu i wskazanie pola.
