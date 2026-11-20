-- Forward only: old readers can ignore this private, nullable payload.
SET LOCAL lock_timeout = '3s';
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS direct_quote_details JSONB;
