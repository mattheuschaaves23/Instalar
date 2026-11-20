ALTER TABLE budgets
  ADD COLUMN source_service_request_id INTEGER REFERENCES service_requests(id) ON DELETE SET NULL,
  ALTER COLUMN client_id DROP NOT NULL,
  ADD CONSTRAINT budgets_client_required_unless_draft
    CHECK (client_id IS NOT NULL OR status IS NOT DISTINCT FROM 'draft');

CREATE UNIQUE INDEX budgets_source_service_request_idx
  ON budgets (source_service_request_id)
  WHERE source_service_request_id IS NOT NULL;
