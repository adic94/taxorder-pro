-- TaxOrder Pro — migration_v54: wersjonowana oś operacji (faza B)
-- Uruchomienie ręczne po backupie:
-- wrangler d1 execute taxorder-pro --remote --file=worker/migration_v54_operations_axis.sql
--
-- transport_orders pozostaje korzeniem biznesowym. operation_records jest nakładką
-- procesu; backfill nie zmienia ani nie usuwa istniejących zleceń.

CREATE TABLE operation_records (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  operation_type TEXT NOT NULL DEFAULT 'transport',
  current_state TEXT NOT NULL DEFAULT 'draft'
    CHECK(current_state IN ('draft','validated','planned','dispatched','accepted','in_progress','completed','settlement_pending','settled','closed','blocked','rejected','cancelled')),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  last_event_sequence INTEGER NOT NULL DEFAULT 0 CHECK(last_event_sequence >= 0),
  blocked_from_state TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(company_id, order_id),
  FOREIGN KEY(order_id) REFERENCES transport_orders(id)
);

CREATE TABLE operation_stops (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  sequence_no INTEGER NOT NULL CHECK(sequence_no >= 1),
  stop_type TEXT NOT NULL CHECK(stop_type IN ('pickup','delivery','waypoint','service','other')),
  name TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL,
  window_start TEXT,
  window_end TEXT,
  actual_arrival TEXT,
  actual_departure TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(operation_id, sequence_no),
  FOREIGN KEY(operation_id) REFERENCES operation_records(id) ON DELETE CASCADE
);

CREATE TABLE operation_tasks (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  stop_id TEXT,
  task_type TEXT NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 1 CHECK(required IN (0,1)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','skipped','failed')),
  completed_at TEXT,
  completed_by TEXT,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(operation_id) REFERENCES operation_records(id) ON DELETE CASCADE,
  FOREIGN KEY(stop_id) REFERENCES operation_stops(id) ON DELETE SET NULL
);

CREATE TABLE operation_requirements (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  requirement_type TEXT NOT NULL,
  requirement_key TEXT NOT NULL,
  expected_value TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','satisfied','failed','waived')),
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(operation_id, requirement_type, requirement_key),
  FOREIGN KEY(operation_id) REFERENCES operation_records(id) ON DELETE CASCADE
);

CREATE TABLE operation_assignments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK(resource_type IN ('driver','vehicle','trailer','team')),
  resource_id TEXT,
  resource_label TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','dispatched','accepted','active','completed','cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(ends_at > starts_at),
  FOREIGN KEY(operation_id) REFERENCES operation_records(id) ON DELETE CASCADE
);

CREATE TABLE operation_proofs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  stop_id TEXT,
  proof_type TEXT NOT NULL CHECK(proof_type IN ('signature','photo','document','location','form','cmr','other')),
  source_type TEXT,
  source_id TEXT,
  r2_key TEXT,
  captured_at TEXT,
  captured_by TEXT,
  latitude REAL,
  longitude REAL,
  metadata TEXT,
  verified_at TEXT,
  verified_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(operation_id) REFERENCES operation_records(id) ON DELETE CASCADE,
  FOREIGN KEY(stop_id) REFERENCES operation_stops(id) ON DELETE SET NULL
);

CREATE TABLE operation_commands (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  command_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  expected_version INTEGER NOT NULL,
  target_state TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  actor_role TEXT,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(company_id, idempotency_key),
  FOREIGN KEY(operation_id) REFERENCES operation_records(id) ON DELETE CASCADE
);

CREATE TABLE operation_events (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  from_state TEXT,
  to_state TEXT,
  actor_id TEXT,
  actor_role TEXT,
  correlation_id TEXT NOT NULL,
  payload TEXT,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(operation_id, sequence_no),
  UNIQUE(company_id, correlation_id),
  FOREIGN KEY(operation_id) REFERENCES operation_records(id) ON DELETE CASCADE
);

CREATE TRIGGER operation_command_version_guard
BEFORE INSERT ON operation_commands
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM operation_records r
      WHERE r.id=NEW.operation_id AND r.company_id=NEW.company_id
    ) THEN RAISE(ABORT, 'operation_not_found')
    WHEN (SELECT version FROM operation_records WHERE id=NEW.operation_id) != NEW.expected_version
      THEN RAISE(ABORT, 'operation_version_conflict')
  END;
END;

CREATE TRIGGER operation_command_apply
AFTER INSERT ON operation_commands
BEGIN
  INSERT INTO operation_events
    (id,company_id,operation_id,sequence_no,event_type,from_state,to_state,actor_id,actor_role,correlation_id,payload)
  SELECT lower(hex(randomblob(16))), r.company_id, r.id, r.last_event_sequence + 1,
         NEW.event_type, r.current_state, NEW.target_state, NEW.actor_id, NEW.actor_role, NEW.id, NEW.payload
  FROM operation_records r WHERE r.id=NEW.operation_id AND r.company_id=NEW.company_id;

  UPDATE operation_records
  SET blocked_from_state=CASE WHEN NEW.target_state='blocked' THEN current_state ELSE blocked_from_state END,
      current_state=NEW.target_state,
      version=version+1,
      last_event_sequence=last_event_sequence+1,
      updated_at=datetime('now')
  WHERE id=NEW.operation_id AND company_id=NEW.company_id;

  UPDATE transport_orders
  SET status=CASE NEW.target_state
        WHEN 'in_progress' THEN 'in_progress'
        WHEN 'completed' THEN 'completed'
        WHEN 'settlement_pending' THEN 'completed'
        WHEN 'settled' THEN 'completed'
        WHEN 'closed' THEN 'completed'
        WHEN 'cancelled' THEN 'cancelled'
        ELSE 'planned' END,
      actual_start=CASE WHEN NEW.target_state='in_progress' AND actual_start IS NULL THEN datetime('now') ELSE actual_start END,
      actual_end=CASE WHEN NEW.target_state='completed' AND actual_end IS NULL THEN datetime('now') ELSE actual_end END,
      updated_at=datetime('now')
  WHERE id=(SELECT order_id FROM operation_records WHERE id=NEW.operation_id) AND company_id=NEW.company_id;
END;

-- Adapter/backfill istniejących zleceń. ID osi jest deterministyczne i czytelne.
INSERT INTO operation_records (id,company_id,order_id,current_state,version,last_event_sequence,created_at,updated_at)
SELECT 'op_' || id, company_id, id,
       CASE status
         WHEN 'in_progress' THEN 'in_progress'
         WHEN 'completed' THEN 'completed'
         WHEN 'cancelled' THEN 'cancelled'
         ELSE 'planned' END,
       1, 1, COALESCE(created_at,datetime('now')), COALESCE(updated_at,datetime('now'))
FROM transport_orders;

INSERT INTO operation_events
  (id,company_id,operation_id,sequence_no,event_type,from_state,to_state,actor_role,correlation_id,payload,occurred_at)
SELECT lower(hex(randomblob(16))), company_id, id, 1, 'operation.imported', NULL, current_state,
       'migration', 'migration_v54:' || order_id, '{"source":"transport_orders"}', created_at
FROM operation_records;

INSERT INTO operation_stops (id,company_id,operation_id,sequence_no,stop_type,name,window_start,window_end)
SELECT lower(hex(randomblob(16))), r.company_id, r.id, 1, 'pickup', o.origin, o.scheduled_start, o.scheduled_start
FROM operation_records r JOIN transport_orders o ON o.id=r.order_id AND o.company_id=r.company_id
WHERE o.origin IS NOT NULL;

INSERT INTO operation_stops (id,company_id,operation_id,sequence_no,stop_type,name,window_start,window_end)
SELECT lower(hex(randomblob(16))), r.company_id, r.id, 2, 'delivery', o.destination, o.scheduled_end, o.scheduled_end
FROM operation_records r JOIN transport_orders o ON o.id=r.order_id AND o.company_id=r.company_id
WHERE o.destination IS NOT NULL;

INSERT INTO operation_assignments (id,company_id,operation_id,resource_type,resource_id,resource_label,starts_at,ends_at)
SELECT lower(hex(randomblob(16))), r.company_id, r.id, 'driver', o.driver_id, o.driver_name, o.scheduled_start,
       COALESCE(o.scheduled_end,datetime(o.scheduled_start,'+1 hour'))
FROM operation_records r JOIN transport_orders o ON o.id=r.order_id AND o.company_id=r.company_id
WHERE o.scheduled_start IS NOT NULL AND (o.driver_id IS NOT NULL OR o.driver_name IS NOT NULL);

INSERT INTO operation_assignments (id,company_id,operation_id,resource_type,resource_id,resource_label,starts_at,ends_at)
SELECT lower(hex(randomblob(16))), r.company_id, r.id, 'vehicle', o.vehicle_id, o.nr_rej, o.scheduled_start,
       COALESCE(o.scheduled_end,datetime(o.scheduled_start,'+1 hour'))
FROM operation_records r JOIN transport_orders o ON o.id=r.order_id AND o.company_id=r.company_id
WHERE o.scheduled_start IS NOT NULL AND (o.vehicle_id IS NOT NULL OR o.nr_rej IS NOT NULL);

-- Adapter dla zleceń tworzonych już po migracji.
CREATE TRIGGER transport_order_operation_create
AFTER INSERT ON transport_orders
BEGIN
  INSERT INTO operation_records(id,company_id,order_id,current_state,version,last_event_sequence,created_at,updated_at)
  VALUES('op_' || NEW.id,NEW.company_id,NEW.id,
    CASE NEW.status WHEN 'in_progress' THEN 'in_progress' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' ELSE 'planned' END,
    1,1,COALESCE(NEW.created_at,datetime('now')),COALESCE(NEW.updated_at,datetime('now')));
  INSERT INTO operation_events(id,company_id,operation_id,sequence_no,event_type,from_state,to_state,actor_role,correlation_id,payload)
  VALUES(lower(hex(randomblob(16))),NEW.company_id,'op_' || NEW.id,1,'operation.created',NULL,
    CASE NEW.status WHEN 'in_progress' THEN 'in_progress' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' ELSE 'planned' END,
    'legacy_adapter','transport_order_create:' || NEW.id,'{"source":"transport_orders"}');
  INSERT INTO operation_stops(id,company_id,operation_id,sequence_no,stop_type,name,window_start,window_end)
    SELECT lower(hex(randomblob(16))),NEW.company_id,'op_' || NEW.id,1,'pickup',NEW.origin,NEW.scheduled_start,NEW.scheduled_start WHERE NEW.origin IS NOT NULL;
  INSERT INTO operation_stops(id,company_id,operation_id,sequence_no,stop_type,name,window_start,window_end)
    SELECT lower(hex(randomblob(16))),NEW.company_id,'op_' || NEW.id,2,'delivery',NEW.destination,NEW.scheduled_end,NEW.scheduled_end WHERE NEW.destination IS NOT NULL;
  INSERT INTO operation_assignments(id,company_id,operation_id,resource_type,resource_id,resource_label,starts_at,ends_at)
    SELECT lower(hex(randomblob(16))),NEW.company_id,'op_' || NEW.id,'driver',NEW.driver_id,NEW.driver_name,NEW.scheduled_start,COALESCE(NEW.scheduled_end,datetime(NEW.scheduled_start,'+1 hour'))
    WHERE NEW.scheduled_start IS NOT NULL AND (NEW.driver_id IS NOT NULL OR NEW.driver_name IS NOT NULL);
  INSERT INTO operation_assignments(id,company_id,operation_id,resource_type,resource_id,resource_label,starts_at,ends_at)
    SELECT lower(hex(randomblob(16))),NEW.company_id,'op_' || NEW.id,'vehicle',NEW.vehicle_id,NEW.nr_rej,NEW.scheduled_start,COALESCE(NEW.scheduled_end,datetime(NEW.scheduled_start,'+1 hour'))
    WHERE NEW.scheduled_start IS NOT NULL AND (NEW.vehicle_id IS NOT NULL OR NEW.nr_rej IS NOT NULL);
END;

-- Adapter statusów starego UI. Nie uruchamia się dla zapisu z operation_command_apply,
-- bo oś ma wtedy już stan docelowy.
CREATE TRIGGER transport_order_operation_status_sync
AFTER UPDATE OF status ON transport_orders
WHEN OLD.status<>NEW.status AND EXISTS (
  SELECT 1 FROM operation_records r WHERE r.order_id=NEW.id AND r.company_id=NEW.company_id
    AND r.current_state<>CASE NEW.status WHEN 'in_progress' THEN 'in_progress' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' ELSE 'planned' END
)
BEGIN
  INSERT INTO operation_events(id,company_id,operation_id,sequence_no,event_type,from_state,to_state,actor_role,correlation_id,payload)
  SELECT lower(hex(randomblob(16))),r.company_id,r.id,r.last_event_sequence+1,'operation.legacy_status_changed',r.current_state,
    CASE NEW.status WHEN 'in_progress' THEN 'in_progress' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' ELSE 'planned' END,
    'legacy_adapter','legacy_status:' || NEW.id || ':' || (r.last_event_sequence+1),json_object('legacy_status',NEW.status)
  FROM operation_records r WHERE r.order_id=NEW.id AND r.company_id=NEW.company_id;
  UPDATE operation_records SET
    current_state=CASE NEW.status WHEN 'in_progress' THEN 'in_progress' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' ELSE 'planned' END,
    version=version+1,last_event_sequence=last_event_sequence+1,updated_at=datetime('now')
  WHERE order_id=NEW.id AND company_id=NEW.company_id;
END;

CREATE INDEX idx_operation_records_company_state ON operation_records(company_id,current_state,updated_at DESC);
CREATE INDEX idx_operation_stops_operation ON operation_stops(company_id,operation_id,sequence_no);
CREATE INDEX idx_operation_tasks_operation ON operation_tasks(company_id,operation_id,status);
CREATE INDEX idx_operation_requirements_operation ON operation_requirements(company_id,operation_id,status);
CREATE INDEX idx_operation_assignments_resource ON operation_assignments(company_id,resource_type,resource_id,starts_at,ends_at);
CREATE INDEX idx_operation_assignments_operation ON operation_assignments(company_id,operation_id);
CREATE INDEX idx_operation_proofs_operation ON operation_proofs(company_id,operation_id,created_at);
CREATE INDEX idx_operation_events_operation ON operation_events(company_id,operation_id,sequence_no);
