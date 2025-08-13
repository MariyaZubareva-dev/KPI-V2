-- users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(lower(email));
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

-- kpis
CREATE INDEX IF NOT EXISTS idx_kpis_active ON kpis(active);

-- progress
CREATE INDEX IF NOT EXISTS idx_progress_user    ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_date    ON progress(date);
CREATE INDEX IF NOT EXISTS idx_progress_kpi     ON progress(kpi_id);
CREATE INDEX IF NOT EXISTS idx_progress_user_dt ON progress(user_id, date);

-- logs
CREATE INDEX IF NOT EXISTS idx_logs_ts          ON logs(ts);
CREATE INDEX IF NOT EXISTS idx_logs_event       ON logs(event);
CREATE INDEX IF NOT EXISTS idx_logs_actor_email ON logs(actor_email);
