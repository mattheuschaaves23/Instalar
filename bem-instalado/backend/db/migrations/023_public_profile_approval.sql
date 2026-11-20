-- Preserve legacy visibility: a raw public_profile flag once defaulted to true.
-- Old certified public profiles stay visible; other profiles require explicit approval.
-- Forward only: application rollback can leave this nullable column in place.
SET LOCAL lock_timeout = '3s';

ALTER TABLE users ADD COLUMN IF NOT EXISTS public_profile_approved_at TIMESTAMPTZ;
