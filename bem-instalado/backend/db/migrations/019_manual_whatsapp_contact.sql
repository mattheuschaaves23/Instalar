ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS whatsapp_contact_consent_at TIMESTAMP;
