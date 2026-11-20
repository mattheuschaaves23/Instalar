-- Forward only: retain the column when reverting application code.
-- The direct_pending status keeps new private orders off listings from older deployments.
SET LOCAL lock_timeout = '3s';

ALTER TABLE service_requests
  ADD COLUMN direct_installer_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- Legacy rows predate direct_pending and have no direct installer.
-- This protects new writes even while an older application version is serving traffic.
ALTER TABLE service_requests
  ADD CONSTRAINT service_requests_direct_visibility_check CHECK (
    CASE WHEN direct_installer_id IS NULL THEN status <> 'direct_pending'
      ELSE status <> 'open' AND (selected_installer_id IS NULL OR selected_installer_id = direct_installer_id)
    END
  ) NOT VALID;

CREATE INDEX service_requests_direct_installer_idx
  ON service_requests (direct_installer_id) WHERE direct_installer_id IS NOT NULL;
