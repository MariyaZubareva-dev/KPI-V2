// Простые DAO-функции поверх D1
export const Dao = (DB) => ({
  // users
  async listUsers() {
    const { results } = await DB.prepare(
      `SELECT id, name, email, role, active FROM users`
    ).all();
    return results ?? [];
  },

  async findUserByEmail(email){
    const { results } = await DB.prepare(
      `SELECT id, name, email, role, active FROM users WHERE lower(email)=lower(?)`
    ).bind(email).all();
    return (results ?? [])[0] || null;
  },

  async employeesCount(){
    const { results } = await DB.prepare(
      `SELECT COUNT(*) AS c FROM users WHERE lower(role)='employee' AND active=1`
    ).all();
    return Number((results?.[0]?.c) ?? 0);
  },

  // kpis
  async sumKpiWeights(){
    const { results } = await DB.prepare(`SELECT SUM(weight) AS s FROM kpis`).all();
    return Number((results?.[0]?.s) ?? 0);
  },

  async listKpis(){
    const { results } = await DB.prepare(
      `SELECT id AS KPI_ID, name, weight FROM kpis ORDER BY weight DESC, id ASC`
    ).all();
    return results ?? [];
  },

  // progress
  async insertProgress({ user_id, date, kpi_id, score }){
    await DB.prepare(
      `INSERT INTO progress(user_id,date,kpi_id,completed,score) VALUES (?,?,?,?,?)`
    ).bind(user_id, date, kpi_id, 1, score).run();

    await DB.prepare(
      `INSERT INTO history(user_id,ts,kpi_id,completed,score) VALUES (?,?,?,?,?)`
    ).bind(user_id, new Date().toISOString(), kpi_id, 1, score).run();
  },

  async listProgressBetween(startYmd, endYmd){
    const { results } = await DB.prepare(
      `SELECT user_id, date, kpi_id, score FROM progress
       WHERE date BETWEEN ? AND ?`
    ).bind(startYmd, endYmd).all();
    return results ?? [];
  },

  async listProgressOfMonth(year, month /* 0-based */){
    const first = `${year}-${String(month+1).padStart(2,'0')}-01`;
    const lastDate = new Date(year, month+1, 0);
    const last = `${year}-${String(month+1).padStart(2,'0')}-${String(lastDate.getDate()).padStart(2,'0')}`;
    const { results } = await DB.prepare(
      `SELECT user_id, date, kpi_id, score FROM progress
       WHERE date BETWEEN ? AND ?`
    ).bind(first, last).all();
    return results ?? [];
  },

  // logs
  async addLog({ userID, email, event, details }){
    await DB.prepare(
      `INSERT INTO logs(ts,user_id,email,event,details) VALUES (?,?,?,?,?)`
    ).bind(new Date().toISOString(), userID ?? '', email ?? '', event ?? 'unknown', details ?? '').run();
  }
});
