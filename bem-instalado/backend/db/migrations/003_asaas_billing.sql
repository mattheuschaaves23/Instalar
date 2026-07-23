ALTER TABLE users ADD COLUMN IF NOT EXISTS asaas_customer_id VARCHAR(80);

CREATE UNIQUE INDEX IF NOT EXISTS users_asaas_customer_id_idx
  ON users (asaas_customer_id)
  WHERE asaas_customer_id IS NOT NULL;
