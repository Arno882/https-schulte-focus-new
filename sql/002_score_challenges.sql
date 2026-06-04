CREATE TABLE IF NOT EXISTS score_challenges (
  id TEXT PRIMARY KEY,
  player_name TEXT NOT NULL,
  mode TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  board_seed INTEGER NOT NULL,

  started_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,

  completed_at TEXT,
  complete_time REAL,
  errors INTEGER,

  ip_address TEXT,
  user_agent TEXT,
  submit_ip_address TEXT,
  submit_user_agent TEXT,

  click_history TEXT
);

CREATE INDEX IF NOT EXISTS idx_score_challenges_player
ON score_challenges (player_name, mode, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_score_challenges_expires
ON score_challenges (expires_at);