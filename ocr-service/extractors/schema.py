"""Modele Pydantic żądania i odpowiedzi endpointu ekstrakcji DR."""
from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel


class FieldValue(BaseModel):
    value: Optional[Any] = None
    confidence: float = 0.0
    needs_review: bool = False
    personal_data: bool = False
    source: str = ""  # "aztec" | "ocr" | "vision" | ""


class OwnerFields(BaseModel):
    present: bool = False
    personal_data: bool = True
    fields: dict[str, FieldValue] = {}


class ExtractionResponse(BaseModel):
    status: str = "ok"
    source: str = "none"          # aztec | ocr | vision | none
    pages_processed: int = 1
    fields: dict[str, FieldValue] = {}
    owner: OwnerFields = OwnerFields()
    warnings: list[str] = []
    processing_ms: int = 0
