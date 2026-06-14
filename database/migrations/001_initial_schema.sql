CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('OWNER', 'MANAGER', 'OPERATOR');
CREATE TYPE stock_update_type AS ENUM ('SNAPSHOT', 'CONSUMPTION', 'ADJUSTMENT');
CREATE TYPE stock_status AS ENUM ('GREEN', 'YELLOW', 'RED', 'BLACK');
CREATE TYPE alert_delivery_status AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  phone_number text NOT NULL UNIQUE CHECK (phone_number ~ '^\+[1-9][0-9]{7,14}$'),
  role user_role NOT NULL DEFAULT 'OPERATOR',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  normalized_name text NOT NULL UNIQUE,
  aliases text[] NOT NULL DEFAULT '{}',
  canonical_unit text NOT NULL CHECK (canonical_unit IN ('kg', 'g', 'l', 'ml', 'pcs', 'm', 'boxes', 'bags', 'rolls')),
  reorder_level numeric(14,3) CHECK (reorder_level IS NULL OR reorder_level >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(trim(name)) BETWEEN 1 AND 160),
  CHECK (normalized_name = lower(trim(normalized_name)))
);

CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  phone_number text CHECK (phone_number IS NULL OR phone_number ~ '^\+[1-9][0-9]{7,14}$'),
  email text,
  default_lead_time_days integer NOT NULL DEFAULT 7 CHECK (default_lead_time_days >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE supplier_materials (
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  material_id uuid NOT NULL REFERENCES materials(id),
  lead_time_days integer NOT NULL CHECK (lead_time_days >= 0),
  unit_price numeric(14,2) CHECK (unit_price IS NULL OR unit_price >= 0),
  currency char(3) NOT NULL DEFAULT 'INR',
  minimum_order_quantity numeric(14,3) CHECK (minimum_order_quantity IS NULL OR minimum_order_quantity > 0),
  is_preferred boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (supplier_id, material_id)
);

CREATE TABLE inbound_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  sender_phone text NOT NULL,
  message_body text NOT NULL,
  detected_intent text,
  processing_status text NOT NULL DEFAULT 'RECEIVED'
    CHECK (processing_status IN ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED')),
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE stock_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES materials(id),
  user_id uuid REFERENCES users(id),
  inbound_event_id uuid REFERENCES inbound_events(id),
  update_type stock_update_type NOT NULL,
  quantity numeric(14,3) NOT NULL CHECK (quantity >= 0),
  unit text NOT NULL,
  balance_before numeric(14,3) NOT NULL CHECK (balance_before >= 0),
  balance_after numeric(14,3) NOT NULL CHECK (balance_after >= 0),
  effective_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('WHATSAPP', 'API', 'SCHEDULER')),
  source_line_index integer NOT NULL DEFAULT 0 CHECK (source_line_index >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (update_type = 'CONSUMPTION' AND quantity > 0)
    OR (update_type <> 'CONSUMPTION' AND quantity >= 0)
  )
);

CREATE TABLE alerts_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES materials(id),
  stock_update_id uuid NOT NULL REFERENCES stock_updates(id),
  recipient_user_id uuid NOT NULL REFERENCES users(id),
  status stock_status NOT NULL CHECK (status IN ('RED', 'BLACK')),
  delivery_status alert_delivery_status NOT NULL DEFAULT 'PENDING',
  supplier_id uuid REFERENCES suppliers(id),
  message text NOT NULL,
  provider_message_sid text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (stock_update_id, recipient_user_id, status)
);

CREATE TABLE audit_events (
  id bigserial PRIMARY KEY,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  actor_user_id uuid REFERENCES users(id),
  request_id text NOT NULL,
  source text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE generated_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_user_id uuid REFERENCES users(id),
  token_hash char(64) NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  content bytea NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE INDEX idx_users_phone_active ON users (phone_number) WHERE is_active;
CREATE INDEX idx_materials_aliases ON materials USING gin (aliases);
CREATE INDEX idx_stock_updates_material_created ON stock_updates (material_id, created_at DESC);
CREATE UNIQUE INDEX idx_stock_updates_inbound_line
  ON stock_updates (inbound_event_id, source_line_index)
  WHERE inbound_event_id IS NOT NULL;
CREATE INDEX idx_stock_updates_type_effective ON stock_updates (update_type, effective_at DESC);
CREATE INDEX idx_alerts_pending ON alerts_sent (delivery_status, created_at) WHERE delivery_status IN ('PENDING', 'PROCESSING', 'FAILED');
CREATE INDEX idx_generated_reports_expiry ON generated_reports (expires_at);
CREATE INDEX idx_inbound_events_sender_received ON inbound_events (sender_phone, received_at DESC);
CREATE INDEX idx_audit_entity ON audit_events (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_supplier_material_fastest ON supplier_materials (material_id, lead_time_days, unit_price);

CREATE OR REPLACE FUNCTION prevent_immutable_changes()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is immutable; append a correcting record instead', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_updates_immutable
BEFORE UPDATE OR DELETE ON stock_updates
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_changes();

CREATE TRIGGER audit_events_immutable
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_changes();

CREATE TRIGGER alerts_no_delete
BEFORE DELETE ON alerts_sent
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_changes();

CREATE OR REPLACE VIEW current_inventory AS
SELECT DISTINCT ON (m.id)
  m.id AS material_id,
  m.name AS material_name,
  m.canonical_unit AS unit,
  COALESCE(su.balance_after, 0)::numeric(14,3) AS current_stock,
  su.effective_at AS last_updated_at,
  su.id AS last_stock_update_id
FROM materials m
LEFT JOIN stock_updates su ON su.material_id = m.id
WHERE m.is_active
ORDER BY m.id, su.created_at DESC NULLS LAST;

COMMENT ON TABLE stock_updates IS 'Append-only inventory ledger. Corrections are new ADJUSTMENT records.';
COMMENT ON TABLE audit_events IS 'Append-only operational audit trail for writes and message actions.';
