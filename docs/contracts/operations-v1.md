# TaxOrder Operations Contract v1 (projekt fazy A)

Status: `Draft`  
Tryb fazy A: dokumentacja i odczyt; komendy mutujące nie są jeszcze wystawione przez Worker.

## 1. Envelope komendy

```json
{
  "command_id": "uuid",
  "command_type": "operation.plan",
  "operation_id": "uuid",
  "company_id": "uuid",
  "expected_version": 4,
  "idempotency_key": "client-generated-key",
  "occurred_at": "2026-08-31T10:00:00Z",
  "actor": { "user_id": "uuid", "role": "dispatcher" },
  "payload": {}
}
```

`company_id` jest ustalane i weryfikowane po stronie serwera na podstawie uwierzytelnionego użytkownika. Wartość klienta nigdy nie rozszerza dostępu.

## 2. Komendy pionu operacyjnego

| Komenda | Stan wejściowy | Stan wynikowy | Minimalny payload | Uprawnienie |
|---|---|---|---|---|
| `operation.create` | — | `draft` | `title`, `operation_type`, `stops[]` | `operations.create` |
| `operation.validate` | `draft`, `blocked` | `validated` lub `blocked` | `validation_profile` | `operations.validate` |
| `operation.plan` | `validated`, `blocked` | `planned` lub `blocked` | `window`, `assignments[]` | `operations.plan` |
| `operation.dispatch` | `planned` | `dispatched` | `driver_assignment_id` | `operations.dispatch` |
| `operation.accept` | `dispatched` | `accepted` | `accepted_at` | `operations.execute` |
| `operation.start` | `accepted` | `in_progress` | `position?`, `started_at` | `operations.execute` |
| `operation.complete` | `in_progress` | `completed` | `completed_at`, `proof_ids[]` | `operations.execute` |
| `operation.submit_settlement` | `completed` | `settlement_pending` | `cost_ids[]`, `revenue_draft?` | `operations.settle` |
| `operation.settle` | `settlement_pending` | `settled` | `approval_id?`, `erp_export_id?` | `operations.approve_settlement` |
| `operation.close` | `settled` | `closed` | `closing_note?` | `operations.close` |
| `operation.block` | stan aktywny | `blocked` | `reason_code`, `message`, `recoverable` | zależne od etapu |
| `operation.cancel` | poza `closed` | `cancelled` | `reason_code`, `message` | `operations.cancel` |

Każda komenda mutująca wymaga `idempotency_key` i `expected_version`. Konflikt wersji zwraca `409`, duplikat tej samej komendy zwraca pierwotny rezultat.

## 3. Envelope zdarzenia

```json
{
  "event_id": "uuid",
  "event_type": "operation.planned",
  "event_version": 1,
  "operation_id": "uuid",
  "company_id": "uuid",
  "sequence": 5,
  "occurred_at": "2026-08-31T10:00:01Z",
  "actor": { "type": "user", "id": "uuid" },
  "correlation_id": "command-uuid",
  "payload": {}
}
```

Zdarzenia: `operation.created`, `operation.validated`, `operation.validation_failed`, `operation.planned`, `operation.plan_conflict_detected`, `operation.dispatched`, `operation.accepted`, `operation.started`, `operation.proof_added`, `operation.completed`, `operation.settlement_submitted`, `operation.settled`, `operation.closed`, `operation.blocked`, `operation.cancelled`.

## 4. Projekcja read-only workbench

Docelowe `GET /api/operations/workbench`:

```json
{
  "generated_at": "ISO-8601",
  "capabilities": { "mode": "read_only", "commands": [] },
  "summary": { "reaction": 0, "today": 0, "in_progress": 0, "settlement": 0 },
  "operations": [{
    "id": "uuid",
    "version": 1,
    "title": "string",
    "state": "planned",
    "priority": "normal",
    "schedule": { "start": "ISO-8601", "end": "ISO-8601" },
    "route": { "origin": "string", "destination": "string", "stops": [] },
    "assignments": { "driver": null, "vehicle": null },
    "readiness": { "plan": "partial", "dispatch": "missing", "proof": "missing", "settlement": "missing" },
    "exceptions": []
  }]
}
```

W fazie A frontend buduje tę projekcję wyłącznie z `GET /api/transport-orders`. Pola, których nie ma w modelu, mają stan `missing`; nie są uzupełniane fikcyjnymi danymi.

