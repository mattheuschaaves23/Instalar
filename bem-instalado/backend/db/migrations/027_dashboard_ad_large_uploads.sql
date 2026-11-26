-- Additive and forward-only; keep these tables on rollback to retain ad files.
SET LOCAL lock_timeout = '3s';

CREATE TABLE IF NOT EXISTS dashboard_ad_uploads (
  id UUID PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  ad_id INTEGER UNIQUE REFERENCES dashboard_ads(id) ON DELETE CASCADE,
  filename VARCHAR(180) NOT NULL,
  content_type VARCHAR(32) NOT NULL,
  byte_length INTEGER NOT NULL CHECK (byte_length BETWEEN 1 AND 52428800),
  next_part INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour'
);

CREATE TABLE IF NOT EXISTS dashboard_ad_upload_parts (
  upload_id UUID NOT NULL REFERENCES dashboard_ad_uploads(id) ON DELETE CASCADE,
  part_index INTEGER NOT NULL CHECK (part_index BETWEEN 0 AND 16),
  bytes BYTEA NOT NULL CHECK (octet_length(bytes) BETWEEN 1 AND 3145728),
  PRIMARY KEY (upload_id, part_index)
);
