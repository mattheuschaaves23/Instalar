-- Expand only: no changes to existing subscriptions, customers or payments.
-- Roll back by disabling ASAAS_MANAGED_TRIAL_SANDBOX; keep the ledger for reconciliation.
CREATE TABLE asaas_managed_trials (
  account_id UUID NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  identity_digest CHAR(64) NOT NULL CHECK (identity_digest ~ '^[a-f0-9]{64}$'),
  customer_id VARCHAR(120) NOT NULL,
  state VARCHAR(20) NOT NULL DEFAULT 'eligible'
    CHECK (state IN ('eligible', 'pending', 'review', 'trial', 'paid', 'unpaid', 'cancelled', 'abandoned')),
  reference VARCHAR(80) UNIQUE,
  checkout_id VARCHAR(120),
  subscription_id VARCHAR(120),
  entitlement_id INTEGER UNIQUE REFERENCES subscriptions(id) ON DELETE SET NULL,
  plan VARCHAR(10) CHECK (plan IN ('monthly', 'yearly')),
  amount_cents INTEGER CHECK (amount_cents > 0),
  first_due_on DATE,
  pro_until DATE,
  trial_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  consented_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, identity_digest),
  UNIQUE (account_id, user_id),
  UNIQUE (account_id, customer_id),
  UNIQUE (account_id, checkout_id),
  UNIQUE (account_id, subscription_id)
);

CREATE TABLE asaas_managed_trial_events (
  account_id UUID NOT NULL,
  event_id VARCHAR(180) NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, event_id)
);
