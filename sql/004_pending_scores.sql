CREATE TABLE IF NOT EXISTS pending_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_name TEXT NOT NULL,
  mode TEXT NOT NULL,
  best_time REAL NOT NULL,
  errors INTEGER NOT NULL DEFAULT 0,
  risk_score INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  click_history TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  review_status TEXT DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_pending_scores_status
ON pending_scores (review_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pending_scores_player
ON pending_scores (player_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pending_scores_mode_time
ON pending_scores (mode, best_time ASC);