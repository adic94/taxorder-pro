# Macierz stanów i uprawnień Operations v1

| Rola | Odczyt | Utworzenie/walidacja | Planowanie/dispatch | Realizacja | Rozliczenie | Zamknięcie/anulowanie |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | wszystkie firmowe | tak | tak | awaryjnie | tak + akceptacja | tak |
| `fleet_manager` | wszystkie firmowe | tak | tak | podgląd/korekta | przygotowanie | tak |
| `dispatcher` | przydzielone oddziały | tak | tak | podgląd/korekta | przygotowanie | wnioskowanie |
| `driver` | tylko przydzielone | nie | nie | accept/start/proof/complete | podgląd własnego | nie |
| `finance` | wszystkie firmowe | nie | podgląd | podgląd | przygotowanie/eksport | po rozliczeniu |
| `approver` | zakres polityki | nie | decyzje wymagające akceptacji | podgląd | akceptacja w limicie | nie |
| `auditor` | wszystkie firmowe read-only | nie | nie | nie | nie | nie |

## Zasady obowiązkowe

1. Tenant i oddział są filtrowane serwerowo; parametr `company` nie jest źródłem autoryzacji.
2. Uprawnienie do komendy jest sprawdzane niezależnie od widoczności przycisku.
3. Kierowca działa tylko na aktywnym, przypisanym mu przydziale.
4. Korekta zakończonej operacji tworzy zdarzenie kompensujące; nie nadpisuje historii.
5. Akceptacja własnego rozliczenia jest zabroniona, gdy wymaga jej polityka firmy.
6. Eksport ERP wymaga statusu `settled` i zapisuje identyfikator korelacji.

## Do czasu fazy B

Operations Workbench ma capability `read_only`. Nie udostępnia komend mutujących, nawet użytkownikowi `admin`.

