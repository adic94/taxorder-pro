"""Walidacja pól Dowodu Rejestracyjnego: VIN, nr rej., daty, zakresy."""
from __future__ import annotations
import re
from datetime import datetime


# Znaki zakazane w VIN: I, O, Q
_VIN_RE = re.compile(r'^[A-HJ-NPR-Z0-9]{17}$')

# Polskie formaty: 2–3 litery wyróżnika + 4–5 znaków
_NRREJ_RE = re.compile(r'^[A-Z]{2,3}[A-Z0-9]{4,5}$')


def validate_vin(vin: str) -> tuple[bool, str]:
    """Zwraca (ok, komunikat_błędu_lub_pusty)."""
    if not vin:
        return False, "VIN pusty"
    v = vin.upper().strip()
    if len(v) != 17:
        return False, f"VIN ma {len(v)} znaków (wymagane 17)"
    if not _VIN_RE.match(v):
        bad = [c for c in v if c in 'IOQ']
        if bad:
            return False, f"VIN zawiera niedozwolone znaki: {', '.join(set(bad))}"
        return False, "VIN zawiera niedozwolone znaki"
    return True, ""


def validate_nrrej(nr: str) -> tuple[bool, str]:
    if not nr:
        return False, "Numer rejestracyjny pusty"
    n = nr.upper().replace(" ", "").replace("-", "")
    if not _NRREJ_RE.match(n):
        return False, f"Nieprawidłowy format nr rejestracyjnego: {nr}"
    return True, ""


def validate_date(date_str: str) -> tuple[bool, str]:
    """Akceptuje DD.MM.YYYY. Data nie może być z przyszłości ani przed 1950."""
    if not date_str:
        return False, "Data pusta"
    for fmt in ("%d.%m.%Y", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(date_str, fmt)
            if dt.year < 1950:
                return False, f"Data zbyt stara: {date_str}"
            if dt > datetime.now():
                return False, f"Data z przyszłości: {date_str}"
            return True, ""
        except ValueError:
            continue
    return False, f"Nieparsowalna data: {date_str}"


def validate_mass(value: int | str, field: str = "masa") -> tuple[bool, str]:
    try:
        v = int(value)
    except (ValueError, TypeError):
        return False, f"{field}: nieprawidłowa wartość"
    if not (100 <= v <= 60000):
        return False, f"{field}: {v} kg poza zakresem 100–60000"
    return True, ""


def validate_capacity(value: int | str) -> tuple[bool, str]:
    try:
        v = int(value)
    except (ValueError, TypeError):
        return False, "pojemność: nieprawidłowa wartość"
    if not (50 <= v <= 20000):
        return False, f"pojemność: {v} cm³ poza zakresem 50–20000"
    return True, ""


def validate_power(value: int | str) -> tuple[bool, str]:
    try:
        v = int(value)
    except (ValueError, TypeError):
        return False, "moc: nieprawidłowa wartość"
    if not (1 <= v <= 1000):
        return False, f"moc: {v} kW poza zakresem 1–1000"
    return True, ""


def validate_seats(value: int | str) -> tuple[bool, str]:
    try:
        v = int(value)
    except (ValueError, TypeError):
        return False, "miejsca: nieprawidłowa wartość"
    if not (1 <= v <= 90):
        return False, f"miejsca: {v} poza zakresem 1–90"
    return True, ""


def check_mass_consistency(f1: int | None, g: int | None) -> str | None:
    """Zwraca ostrzeżenie jeśli F.1 < G (DMC < masa własna)."""
    if f1 is not None and g is not None:
        if f1 < g:
            return f"F.1={f1} kg < G={g} kg — DMC mniejszy niż masa własna"
    return None
