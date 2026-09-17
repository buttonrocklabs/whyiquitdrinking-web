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
