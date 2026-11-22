-- APEX — Datenbankschema (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS sources (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  url           TEXT NOT NULL,
  homepage      TEXT,
  lang          TEXT NOT NULL DEFAULT 'en',
  kind          TEXT NOT NULL DEFAULT 'media',      -- official | media | aggregator
  default_section TEXT,
  motorsport    INTEGER NOT NULL DEFAULT 0,
  weight        REAL NOT NULL DEFAULT 1.0,
  enabled       INTEGER NOT NULL DEFAULT 1,
  last_fetch_at TEXT,
  last_ok_at    TEXT,
  last_status   TEXT,
  last_error    TEXT,
  fail_count    INTEGER NOT NULL DEFAULT 0,
  item_count    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  url_hash      TEXT NOT NULL UNIQUE,
  url           TEXT NOT NULL,
  source_id     TEXT NOT NULL,
  source_name   TEXT NOT NULL,
  lang          TEXT NOT NULL,
  title         TEXT NOT NULL,
  summary       TEXT,
  title_de      TEXT,
  summary_de    TEXT,
  translation   TEXT NOT NULL DEFAULT 'pending', -- original | machine | pending | failed
  section       TEXT NOT NULL,
  tags          TEXT NOT NULL DEFAULT '',         -- |porsche|gt3|wec|
  relevance     REAL NOT NULL DEFAULT 0,
  verification  TEXT NOT NULL DEFAULT 'media',    -- official | media | multi | unconfirmed | aggregator
  image_url     TEXT,
  image_credit  TEXT,
  image_source  TEXT,
  author        TEXT,
  published_at  TEXT NOT NULL,
  fetched_at    TEXT NOT NULL,
  cluster_id    INTEGER,
  ai_title      TEXT,
  ai_dek        TEXT,
  ai_body       TEXT,
  ai_at         TEXT,
  ai_sources    TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_published ON items(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_fetched ON items(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_section ON items(section, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_cluster ON items(cluster_id);
CREATE INDEX IF NOT EXISTS idx_items_translation ON items(translation);

CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
  title, title_de, summary, summary_de, tags, source_name,
  content='items', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
  INSERT INTO items_fts(rowid, title, title_de, summary, summary_de, tags, source_name)
  VALUES (new.id, new.title, new.title_de, new.summary, new.summary_de, new.tags, new.source_name);
END;
CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, title, title_de, summary, summary_de, tags, source_name)
  VALUES ('delete', old.id, old.title, old.title_de, old.summary, old.summary_de, old.tags, old.source_name);
END;
CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE OF title_de, summary_de, tags ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, title, title_de, summary, summary_de, tags, source_name)
  VALUES ('delete', old.id, old.title, old.title_de, old.summary, old.summary_de, old.tags, old.source_name);
  INSERT INTO items_fts(rowid, title, title_de, summary, summary_de, tags, source_name)
  VALUES (new.id, new.title, new.title_de, new.summary, new.summary_de, new.tags, new.source_name);
END;

CREATE TABLE IF NOT EXISTS editions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  edition_date  TEXT NOT NULL UNIQUE,   -- YYYY-MM-DD (Europe/Berlin)
  number        INTEGER NOT NULL,
  published_at  TEXT NOT NULL,
  trigger       TEXT NOT NULL,          -- cron | manual
  item_count    INTEGER NOT NULL,
  cover_title   TEXT,
  content       TEXT NOT NULL           -- unveränderlicher JSON-Snapshot
);

CREATE TABLE IF NOT EXISTS calendars (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL,          -- ics_url | upload
  url           TEXT,
  last_sync_at  TEXT,
  last_status   TEXT,
  event_count   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  calendar_id   INTEGER NOT NULL,
  uid           TEXT NOT NULL,
  title         TEXT NOT NULL,
  starts_at     TEXT NOT NULL,          -- ISO UTC
  ends_at       TEXT NOT NULL,
  all_day       INTEGER NOT NULL DEFAULT 0,
  location      TEXT,
  description   TEXT,
  url           TEXT,
  category      TEXT NOT NULL,          -- race | show | premiere | other
  series        TEXT,
  keywords      TEXT NOT NULL DEFAULT '',
  UNIQUE(calendar_id, uid)
);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(starts_at);

CREATE TABLE IF NOT EXISTS favorites (
  item_id   INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reads (
  item_id   INTEGER PRIMARY KEY,
  read_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  job         TEXT NOT NULL,            -- ingest | publish | translate | dispatch | calendar | editorial
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  ok          INTEGER,
  detail      TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs ON job_runs(job, started_at DESC);

CREATE TABLE IF NOT EXISTS usage_daily (
  day     TEXT NOT NULL,
  metric  TEXT NOT NULL,
  value   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(day, metric)
);

CREATE TABLE IF NOT EXISTS login_attempts (
  ip        TEXT NOT NULL,
  at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login ON login_attempts(ip, at);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
