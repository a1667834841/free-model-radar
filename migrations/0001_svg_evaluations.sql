CREATE TABLE IF NOT EXISTS svg_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt_version INTEGER NOT NULL,
  provider_id TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  model_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'queued', 'running', 'retryable', 'success', 'invalid_svg', 'unsupported', 'auth_blocked')),
  sanitized_svg TEXT,
  raw_response TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  http_status INTEGER,
  error_code TEXT,
  error_message TEXT,
  duration_ms INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  next_attempt_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (prompt_version, provider_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_svg_evaluations_schedule
  ON svg_evaluations (prompt_version, status, next_attempt_at, attempt_count);

CREATE INDEX IF NOT EXISTS idx_svg_evaluations_gallery
  ON svg_evaluations (prompt_version, status, completed_at DESC);
