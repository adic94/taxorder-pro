# Mapowanie danych: localStorage › Supabase

## Cel

Ten dokument opisuje migracjê obecnych danych lokalnych TaxOrder Pro do bazy Supabase/PostgreSQL.

## Aktualne klucze localStorage

| Klucz localStorage | Znaczenie | Docelowa tabela Supabase |
|---|---|---|
| dt1_users | u¿ytkownicy aplikacji | profiles, company_users |
| dt1_current_company | aktualnie wybrana firma | companies |
| dt1_company_states | stany danych firm | company_states |
| dt1_karty | karty/flota/dane pomocnicze | fleet_cards |
| dt1_cepik_key | klucz integracji CEPiK | integrations |
| dt1_cepik_secret | sekret integracji CEPiK | integrations |
| dt1_cepik_token | token CEPiK | integrations |
| dt1_cepik_token_exp | wa¿noœæ tokenu CEPiK | integrations |
| dt1_cepik_proxy | proxy CEPiK | integrations |
| dt1_cepik_settings | ustawienia CEPiK | integrations |
| dt1_cepik_cache | cache danych CEPiK | integrations |
| dt1_cepik_last_check | ostatnie sprawdzenie CEPiK | integrations |

## Zasady migracji

1. Dane u¿ytkowników nie bêd¹ migrowane z has³ami.
2. Has³a z localStorage oparte o btoa() nale¿y porzuciæ.
3. Logowanie zostanie przeniesione do Supabase Auth.
4. Firmy zostan¹ zapisane w tabeli companies.
5. Pojazdy zostan¹ zapisane w tabeli vehicles.
6. Stany firm zostan¹ zapisane jako JSONB w company_states.
7. Integracje CEPiK zostan¹ zapisane w integrations.
8. Dokumenty i deklaracje DT-1 bêd¹ przenoszone etapowo.

## Priorytet migracji

1. companies
2. vehicles
3. profiles
4. company_users
5. transport_tax_declarations
6. documents
7. integrations
8. company_states
9. fleet_cards
