-- Forward-only. Leave these nullable columns in place on an application rollback
-- so uploaded campaigns can be recovered without deleting their media.
SET LOCAL lock_timeout = '3s';
ALTER TABLE dashboard_ads
  ADD COLUMN IF NOT EXISTS media_bytes BYTEA,
  ADD COLUMN IF NOT EXISTS media_content_type VARCHAR(32);
