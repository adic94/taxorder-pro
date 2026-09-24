# ADR-013: Dokument i dowód wykonania

Status: Proposed

## Kontekst

Documents, Smart Forms, protokoły, zdjęcia i podpisy są dojrzałe, ale nie tworzą wspólnej definicji POD ani kompletności zlecenia.

## Decyzja

Plik pozostaje w R2, metadane w `documents`. `operation_proof` wskazuje istniejący dokument, submission, protokół lub podpis i opisuje wymaganie, typ, autora, czas, lokalizację, checksum, stan weryfikacji i retencję.

## Reguły

- nie kopiować pliku dla każdego powiązania;
- podpis ma kontekst i hash podpisywanej treści;
- OCR jest propozycją danych z confidence, nie dowodem samym w sobie;
- kompletność wynika z typu operacji;
- malware/quarantine blokuje użycie dokumentu.

## Kryterium akceptacji

Z osi zlecenia można ustalić, jaki dowód był wymagany, co dostarczono, kto i kiedy to zweryfikował oraz czy plik pozostał integralny.
