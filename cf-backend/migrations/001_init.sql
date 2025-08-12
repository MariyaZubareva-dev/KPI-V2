-- users: активность, роль, логин по email (как у вас в таблице)
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  role          TEXT NOT NULL CHECK (role IN ('admin','employee','observer')),
  active        INTEGER NOT NULL DEFAULT 1 -- 1 = true, 0 = false
);

-- KPIs: справочник KPI с весами
CREATE TABLE IF NOT EXISTS kpis (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  weight        REAL  NOT NULL DEFAULT 0,
  category      TEXT
);

-- progress: факт выполнений (аналог листа Progress)
CREATE TABLE IF NOT EXISTS progress (
  user_id       INTEGER NOT NULL,
  date          TEXT    NOT NULL,   -- 'YYYY-MM-DD'
  kpi_id        INTEGER NOT NULL,
  completed     INTEGER NOT NULL DEFAULT 1,
  score         REAL    NOT NULL DEFAULT 0,
  CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(id),
  CONSTRAINT fk_kpi  FOREIGN KEY(kpi_id)  REFERENCES kpis(id)
);

-- history: опционально — расширенная история
CREATE TABLE IF NOT EXISTS history (
  user_id       INTEGER NOT NULL,
  ts            TEXT    NOT NULL,   -- ISO ts
  kpi_id        INTEGER NOT NULL,
  completed     INTEGER NOT NULL DEFAULT 1,
  score         REAL    NOT NULL DEFAULT 0
);

-- logs: то, что вы писали в лист Logs
CREATE TABLE IF NOT EXISTS logs (
  ts            TEXT    NOT NULL,
  user_id       TEXT,
  email         TEXT,
  event         TEXT,
  details       TEXT
);

-- индексы
CREATE INDEX IF NOT EXISTS idx_progress_date ON progress(date);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_kpi  ON progress(kpi_id);
