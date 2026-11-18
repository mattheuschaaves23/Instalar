-- Additive only. Old deployments ignore this column; no existing data changes.
-- Rollback: deploy the old code and retain this column (preserves saved styles).
SET LOCAL lock_timeout = '5s';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_appearance JSONB NOT NULL DEFAULT '{}'::jsonb;
