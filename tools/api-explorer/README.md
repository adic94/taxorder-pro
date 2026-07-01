# API Explorer — narzędzie do odkrywania API zewnętrznych portali

Otwiera prawdziwą przeglądarkę Chrome. **Ty logujesz się ręcznie** — hasło nigdy nie
przechodzi przez ten skrypt ani przez asystenta AI. W tle skrypt podsłuchuje wszystkie
wywołania API, które wykonuje strona, i po zakończeniu zapisuje raport (JSON + HTML).

## Jak uruchomić

Wszystko jest już zainstalowane. Otwórz terminal w tym folderze i uruchom:

```
node explore.js tekom
```

albo dla ORLEN:

```
node explore.js orlen
```

(jeśli `node` nie jest rozpoznawane, użyj pełnej ścieżki:
`"C:\Users\acichocki\Desktop\Narzędzia\node-v24.16.0-win-x64\node.exe" explore.js tekom`)

## Co się stanie

1. Otworzy się okno Chrome.
2. **Zaloguj się normalnie** swoimi danymi.
3. Kliknij po wszystkich sekcjach, które Cię interesują: lista pojazdów, mapa GPS,
   historia tras, raporty, eksporty, ustawienia, karty paliwowe, transakcje itd.
   Im więcej miejsc odwiedzisz, tym pełniejszy będzie raport.
4. Gdy skończysz — **wróć do okna terminala i naciśnij Enter**.
5. Skrypt zapisze raport do folderu `reports/` (ten folder jest w `.gitignore` —
   nigdy nie trafi do repozytorium, bo może zawierać tokeny sesji).

## Co dalej

Otwórz wygenerowany plik `.html` w przeglądarce, żeby samemu przejrzeć co zostało
znalezione, **albo po prostu wyślij oba pliki (.json i .html) do asystenta AI** —
przeanalizuje strukturę API i zaprojektuje prawdziwą integrację z TaxOrder Pro.

## Bezpieczeństwo

- Hasła nigdy nie są przechwytywane ani zapisywane.
- Raport MOŻE zawierać tokeny sesji (cookies, nagłówki Authorization) i dane z
  Waszego konta (np. listę pojazdów) — traktuj plik raportu jak dane wrażliwe,
  nie wysyłaj go nigdzie poza tę rozmowę z asystentem.
- Po zakończeniu pracy z raportem możesz go bezpiecznie usunąć z `reports/`.
