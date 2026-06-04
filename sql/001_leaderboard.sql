CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_name TEXT NOT NULL,
  mode TEXT NOT NULL,
  best_time REAL NOT NULL,
  errors INTEGER NOT NULL DEFAULT 0,
  achieved_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(player_name, mode)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_mode_time
ON leaderboard_entries (mode, best_time ASC, updated_at ASC);