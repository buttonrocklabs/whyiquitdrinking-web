-- whyiquitdrinking D1 schema. Every statement must stay safely re-runnable
-- against a database where it's already applied (BRL D1 migration rule).

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  story_text TEXT NOT NULL,
  photo_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  consent_given INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewer TEXT,
  reject_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_stories_status_submitted
  ON stories (status, submitted_at DESC);

-- Before-and-after photo pair (WIQD-11). One row per photo; kind is 'before'
-- or 'after', taken_on is YYYY-MM. withdrawn_at is set when the photo comes
-- down (moderator reject, or the contributor withdrawing from their link).
CREATE TABLE IF NOT EXISTS story_photos (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('before', 'after')),
  r2_key TEXT NOT NULL,
  taken_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  withdrawn_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_story_photos_story
  ON story_photos (story_id);

-- Consent record, one row per story (WIQD-11). uses is a JSON array of the
-- use keys ticked ('site', 'pins', 'sm_board'); consent_text is the exact
-- wording shown for the ticked boxes, written server-side from
-- shared/consent.ts. manage_token_hash is the SHA-256 hex of the private
-- manage token; the token itself is never stored. email is null unless the
-- story came with a photo pair.
CREATE TABLE IF NOT EXISTS story_consents (
  story_id TEXT PRIMARY KEY,
  email TEXT,
  adult_confirmed INTEGER NOT NULL DEFAULT 0,
  uses TEXT NOT NULL,
  consent_text TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  consented_at TEXT NOT NULL,
  manage_token_hash TEXT NOT NULL,
  withdrawn_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_story_consents_token
  ON story_consents (manage_token_hash);

-- Fixed-window rate limit counters (LAB-629), see functions/_ratelimit.ts. key is
-- bucket:sha256(ip or normalised email):window start in ms; no raw IP or address is
-- stored. expires_at (ISO UTC) is two windows after the window start, and expired rows
-- are swept on each hit.
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires
  ON rate_limits (expires_at);
