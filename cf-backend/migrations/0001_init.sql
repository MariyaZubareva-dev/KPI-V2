-- таблицы (без BEGIN/COMMIT)
CREATE TABLE IF NOT EXISTS users (
  id      INTEGER PRIMARY KEY,
  name    TEXT    NOT NULL,
  email   TEXT    NOT NULL UNIQUE,
  role    TEXT    NOT NULL,
  active  INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);

CREATE TABLE IF NOT EXISTS kpis (
  id       INTEGER PRIMARY KEY,
  name     TEXT    NOT NULL,
  weight   REAL    NOT NULL,
  category TEXT,
  active   INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);

CREATE TABLE IF NOT EXISTS progress (
  id        INTEGER PRIMARY KEY,
  user_id   INTEGER NOT NULL REFERENCES users(id),
  date      TEXT    NOT NULL,  -- 'YYYY-MM-DD'
  kpi_id    INTEGER NOT NULL REFERENCES kpis(id),
  completed INTEGER NOT NULL DEFAULT 1 CHECK (completed IN (0,1)),
  score     REAL    NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS logs (
  id          INTEGER PRIMARY KEY,
  ts          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  event       TEXT NOT NULL,
  actor_email TEXT,
  user_id     INTEGER,
  kpi_id      INTEGER,
  score       REAL,
  details     TEXT
);
