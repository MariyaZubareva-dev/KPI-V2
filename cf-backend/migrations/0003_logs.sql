-- создаём таблицу logs (если её ещё нет)
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
