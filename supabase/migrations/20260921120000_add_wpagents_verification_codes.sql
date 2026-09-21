-- One-time codes used to prove e-mail ownership before student-performance
-- hands out a student's results (otherwise anyone could type a classmate's
-- e-mail and read their grades). RLS is enabled with NO policies, so only
-- the service-role key (used by the edge function) can touch this table —
-- anon/authenticated clients get zero access, by design.
--
-- Mirrors wpagents_verification_codes from the sibling posologia-clinical-hub
-- (simulador), prova.facil and PBL Flow repos' student-performance functions
-- — same shape, same reasoning, kept identical across all platforms on
-- purpose. Each platform has its own copy of this table and its own
-- WPAGENTS_API_KEY secret value — a code issued here is never valid on a
-- sibling platform's copy.
CREATE TABLE wpagents_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wpagents_verification_codes_email_lower
  ON wpagents_verification_codes (lower(email), created_at DESC);

ALTER TABLE wpagents_verification_codes ENABLE ROW LEVEL SECURITY;
