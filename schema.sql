-- Base D1 de l'app Roadmap XP (comptes Discord, persos, progression).
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                 -- identifiant interne aléatoire
  discord_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  avatar TEXT,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,         -- SHA-256 du jeton du cookie, jamais le jeton lui-même
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  server TEXT NOT NULL DEFAULT '',
  life INTEGER NOT NULL DEFAULT 5,     -- numéro de la vie en cours
  entry INTEGER NOT NULL DEFAULT 1,    -- niveau de départ de la vie : 1, 15 ou 20
  vip INTEGER NOT NULL DEFAULT 1,
  expansions TEXT NOT NULL DEFAULT '[]',  -- JSON : extensions possédées
  show_options INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS characters_user ON characters(user_id);

CREATE TABLE IF NOT EXISTS progress (
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('done', 'skipped')),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (character_id, step_id)
);
