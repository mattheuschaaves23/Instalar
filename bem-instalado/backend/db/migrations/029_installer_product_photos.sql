SET LOCAL lock_timeout = '4s';
ALTER TABLE installer_products ADD COLUMN IF NOT EXISTS photo_jpeg BYTEA;
