INSERT INTO users (name, phone_number, role)
VALUES
  ('Factory Owner', '+919999999999', 'OWNER'),
  ('Shift Manager', '+919888888888', 'MANAGER'),
  ('Store Operator', '+919777777777', 'OPERATOR')
ON CONFLICT (phone_number) DO NOTHING;

INSERT INTO materials (name, normalized_name, aliases, canonical_unit, reorder_level)
VALUES
  ('Cement', 'cement', ARRAY['cem', 'cement bags'], 'bags', 50),
  ('Steel Rod 12mm', 'steel rod 12mm', ARRAY['12mm rod', 'saria 12mm', 'steel 12'], 'kg', 500),
  ('Packaging Film', 'packaging film', ARRAY['packing film', 'film roll'], 'rolls', 20),
  ('Industrial Oil', 'industrial oil', ARRAY['machine oil', 'lubricant'], 'l', 100)
ON CONFLICT (normalized_name) DO NOTHING;

INSERT INTO suppliers (name, phone_number, email, default_lead_time_days)
VALUES
  ('Rapid Industrial Supply', '+919666666666', 'orders@rapid.example', 2),
  ('Metro Materials', '+919555555555', 'sales@metro.example', 5)
ON CONFLICT (name) DO NOTHING;

INSERT INTO supplier_materials (
  supplier_id, material_id, lead_time_days, unit_price, currency, minimum_order_quantity, is_preferred
)
SELECT s.id, m.id,
  CASE WHEN s.name = 'Rapid Industrial Supply' THEN 2 ELSE 5 END,
  CASE
    WHEN m.normalized_name = 'cement' THEN 410
    WHEN m.normalized_name = 'steel rod 12mm' THEN 68
    WHEN m.normalized_name = 'packaging film' THEN 1200
    ELSE 220
  END,
  'INR',
  10,
  s.name = 'Rapid Industrial Supply'
FROM suppliers s
CROSS JOIN materials m
ON CONFLICT (supplier_id, material_id) DO NOTHING;
