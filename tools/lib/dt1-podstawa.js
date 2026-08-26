/**
 * PODSTAWA WYMIARU PODATKU DT-1 — ktora masa idzie do silnika.
 *
 * DLACZEGO TO ISTNIEJE JAKO OSOBNY PLIK. Regula zyla w dwoch narzedziach naraz i
 * ROZJECHALA SIE: `dt1-wyliczenie.js` (sesja MT0268) wybieralo F.2, a arkusz DT-1
 * w `dr-excel.js` (sesja w chmurze) podawalo silnikowi F.1. Oba korzystaly z tego
 * samego produkcyjnego `TaxEngine`, wiec progi i stawki byly identyczne — roznila je
 * WYLACZNIE masa na wejsciu. Dla kazdego pojazdu, w ktorym F.1 != F.2, dawaly INNA
 * kategorie i INNA kwote, a oba wyniki wygladaly poprawnie.
 *
 * To ta sama rodzina, co dwie tablice wskaznikow CO2, dwie listy zrodel kreatora
 * raportow i dwie kopie promptu DR. Za kazdym razem objaw byl ten sam: ciche zle dane.
 *
 * MERYTORYCZNIE (ustalone 26.08 na WA1697F, Volvo FMX 8x4, pozycji za 4 296 zl):
 * F.1 i F.2 to DWIE ROZNE WIELKOSCI, nie dwa odczyty tej samej. F.1 to maksymalna masa
 * calkowita konstrukcyjna, F.2 — dopuszczalna masa calkowita pojazdu W KRAJU rejestracji.
 * Podstawa wymiaru podatku jest F.2; F.1 bywa wyzsza i uzyta zawyza kategorie.
 *
 * Dlatego F.2 wygrywa, ale TYLKO gdy nie jest wieksza od F.1 — F.2 wieksza od F.1 jest
 * sprzeczna z definicja obu pol i oznacza blad odczytu, a nie legalna wartosc.
 */
function podstawaDmc(f1, f2) {
  const a = Number.isFinite(Number(f1)) && Number(f1) > 0 ? Number(f1) : null;
  const b = Number.isFinite(Number(f2)) && Number(f2) > 0 ? Number(f2) : null;
  if (b != null && (a == null || b <= a)) return { masa: b, pole: 'F.2' };
  if (a != null) return { masa: a, pole: 'F.1' };
  return { masa: null, pole: null };
}

module.exports = { podstawaDmc };
