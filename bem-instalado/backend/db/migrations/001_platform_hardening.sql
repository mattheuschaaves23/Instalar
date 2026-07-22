ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);
ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_radius_km INTEGER NOT NULL DEFAULT 80;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP;

UPDATE service_requests
SET expires_at = COALESCE(created_at, NOW()) + INTERVAL '30 days'
WHERE expires_at IS NULL;

ALTER TABLE service_requests ALTER COLUMN expires_at SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days');
ALTER TABLE service_requests ALTER COLUMN expires_at SET NOT NULL;

ALTER TABLE installer_reviews
  ADD COLUMN IF NOT EXISTS service_request_id INTEGER REFERENCES service_requests(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'installer_reviews_service_request_id_fkey'
  ) THEN
    ALTER TABLE installer_reviews
      ADD CONSTRAINT installer_reviews_service_request_id_fkey
      FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE SET NULL;
  END IF;
END $$;

DROP INDEX IF EXISTS installer_reviews_unique_user_idx;
DROP INDEX IF EXISTS installer_reviews_unique_fingerprint_idx;

CREATE UNIQUE INDEX IF NOT EXISTS installer_reviews_unique_service_request_idx
  ON installer_reviews (service_request_id)
  WHERE service_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS service_requests_expiry_idx
  ON service_requests (status, expires_at, created_at DESC);

CREATE INDEX IF NOT EXISTS users_active_lookup_idx
  ON users (account_type, deleted_at, state, city);
