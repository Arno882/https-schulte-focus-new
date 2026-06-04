CREATE TABLE IF NOT EXISTS security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_name TEXT,
  challenge_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  event_type TEXT,
  reason TEXT NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0,
  question TEXT,
  player_answer TEXT,
  correct_answer TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_security_events_player
ON security_events (player_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_ip
ON security_events (ip_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_reason
ON security_events (reason, created_at DESC);