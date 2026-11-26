CREATE TABLE IF NOT EXISTS installer_products (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL CHECK (LENGTH(BTRIM(name)) > 0),
  price NUMERIC(10, 2) NOT NULL CHECK (price > 0),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS installer_products_active_by_owner
  ON installer_products (user_id, id) WHERE archived_at IS NULL;

SET LOCAL lock_timeout = '4s';
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS product_items JSONB,
  ADD COLUMN IF NOT EXISTS manual_price NUMERIC(10, 2);
