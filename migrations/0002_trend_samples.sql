CREATE TABLE IF NOT EXISTS trend_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  model_id TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'failed', 'unavailable', 'missing')),
  ttft_ms REAL,
  tokens_per_sec REAL,
  latency_ms REAL,
  created_at TEXT NOT NULL,
  UNIQUE (provider_id, model_id, checked_at)
);

CREATE INDEX IF NOT EXISTS idx_trend_samples_checked_at
  ON trend_samples (checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_trend_samples_model_checked_at
  ON trend_samples (provider_id, model_id, checked_at DESC);
