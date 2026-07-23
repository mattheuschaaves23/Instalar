ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider VARCHAR(50);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider_subscription_id VARCHAR(120);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_method VARCHAR(30);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_subscription_id_idx
  ON subscriptions (provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;
