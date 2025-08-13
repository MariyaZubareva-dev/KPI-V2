// src/worker.js
// Cloudflare Worker + D1 backend совместимый с текущим фронтом (GET + простые query-параметры)
// Поддерживает: action=login|getProgress|recordKPI|log (+ scopes)

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const action = (url.searchParams.get('action') || '').toLowerCase();

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      switch (action) {
        case 'ping':
          return json({ ok: true, pong: true });

        case 'login':
          return await handleLogin(url, env);

        case 'getprogress':
          return await routeGetProgress(url, env);

        case 'recordkpi':
          return await handleRecordKPI(url, env);

        case 'log':
          return await handleLogAction(url, env);

        default:
          return json({ success: false, message: 'Invalid action' }, 400);
      }
    } catch (err) {
      console.error(err);
      return json({ success: false, message: err?.message || 'Internal error' }, 500);
    }
  }
};

/* =================== ROUTERS =================== */

async function routeGetProgress(url, env) {
  const scope = (url.searchParams.get('scope') || 'department').toLowerCase();

  if (scope === 'department')     return await handleGetDeptProgress(env);
  if (scope === 'users')          return await handleGetUsersProgress(env, 'this_week');
  if (scope === 'users_lastweek') return await handleGetUsersProgress(env, 'prev_week');
  if (scope === 'user')           return await handleGetUserKPIs(url, env);

  return json({ success: false, message: 'Unknown scope' }, 400);
}

/* =================== ACTIONS =================== */

// login(email, password)
async function handleLogin(url, env) {
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  const password = url.searchParams.get('password') || '';
  const COMMON_PASSWORD = 'kpi2025';

  if (!email || !password) {
    return json({ success: false, message: 'missing email/password' }, 400);
  }

  const user = await env.DB.prepare(
    `SELECT id, name, email, role, active FROM users WHERE lower(email)=? LIMIT 1`
  ).bind(email).first();

  if (!user || !user.active || password !== COMMON_PASSWORD) {
    return json({ success: false });
  }

  return json({
    success: true,
    email: user.email,
    role:  user.role,
    name:  user.name
  });
}

// getProgress: department
async function handleGetDeptProgress(env) {
  // Границы недели/месяца
  const now = new Date();
  const { start: weekStart, end: weekEnd } = getWeekBounds(now);
  const [year, month] = [now.getFullYear(), now.getMonth() + 1]; // month 1..12
  const yyyy = String(year);
  const mm = String(month).padStart(2, '0');

  // Фактические суммы
  const weekSumRow  = await env.DB.prepare(
    `SELECT COALESCE(SUM(score),0) AS s FROM progress WHERE date BETWEEN ? AND ?`
  ).bind(fmtDate(weekStart), fmtDate(weekEnd)).first();

  const monthSumRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(score),0) AS s FROM progress
     WHERE strftime('%Y', date)=? AND strftime('%m', date)=?`
  ).bind(yyyy, mm).first();

  const weekSum  = Number(weekSumRow?.s || 0);
  const monthSum = Number(monthSumRow?.s || 0);

  // Максимумы
  const weightsRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(weight),0) AS w FROM kpis WHERE active=1`
  ).first();
  const weightsSum = Number(weightsRow?.w || 0);

  const empRow = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM users WHERE active=1 AND lower(role)='employee'`
  ).first();
  const employeesCount = Number(empRow?.c || 0) || 1;

  const maxWeek = weightsSum * employeesCount;

  const weeksInMonth = countIsoWeeksInMonth(now);
  const maxMonth = maxWeek * weeksInMonth;

  const weekPercent  = Math.min(100, Math.round((weekSum  / (maxWeek  || 1)) * 100));
  const monthPercent = Math.min(100, Math.round((monthSum / (maxMonth || 1)) * 100));

  return json({
    success: true,
    data: {
      weekSum, monthSum,
      maxWeek, maxMonth,
      weeksInMonth, employeesCount,
      weekPercent, monthPercent
    }
  });
}

// getProgress: users (this_week | prev_week)
async function handleGetUsersProgress(env, period = 'this_week') {
  const now = new Date();
  const { start, end } = period === 'prev_week' ? getLastFullWeekBounds(now) : getWeekBounds(now);
  const [year, month] = [now.getFullYear(), now.getMonth() + 1];
  const yyyy = String(year);
  const mm = String(month).padStart(2, '0');

  // Все пользователи
  const users = await env.DB.prepare(
    `SELECT id, name, email, role, active FROM users`
  ).all();
  const list = users?.results || [];

  // Агрегаты за неделю
  const weekAgg = await env.DB.prepare(
    `SELECT user_id, COALESCE(SUM(score),0) AS s
     FROM progress
     WHERE date BETWEEN ? AND ?
     GROUP BY user_id`
  ).bind(fmtDate(start), fmtDate(end)).all();
  const weekMap = Object.create(null);
  for (const r of (weekAgg?.results || [])) weekMap[r.user_id] = Number(r.s || 0);

  // Агрегаты за месяц (текущий)
  const monthAgg = await env.DB.prepare(
    `SELECT user_id, COALESCE(SUM(score),0) AS s
     FROM progress
     WHERE strftime('%Y', date)=? AND strftime('%m', date)=?
     GROUP BY user_id`
  ).bind(yyyy, mm).all();
  const monthMap = Object.create(null);
  for (const r of (monthAgg?.results || [])) monthMap[r.user_id] = Number(r.s || 0);

  const data = list.map(u => ({
    id: u.id, name: u.name, email: u.email, role: u.role,
    week:  weekMap[u.id]  || 0,
    month: monthMap[u.id] || 0
  }));

  return json({ success: true, data });
}

// getProgress: user (список KPI с признаком done за текущую неделю)
async function handleGetUserKPIs(url, env) {
  const userID = url.searchParams.get('userID');
  if (!userID) return json({ success:false, message:'userID required' }, 400);

  const { start, end } = getWeekBounds(new Date());

  const kpis = await env.DB.prepare(
    `SELECT id AS KPI_ID, name, weight
     FROM kpis
     WHERE active=1
     ORDER BY weight DESC, id ASC`
  ).all();

  const doneRows = await env.DB.prepare(
    `SELECT DISTINCT kpi_id FROM progress
     WHERE user_id=? AND date BETWEEN ? AND ?`
  ).bind(userID, fmtDate(start), fmtDate(end)).all();

  const doneSet = new Set((doneRows?.results || []).map(r => String(r.kpi_id)));

  const data = (kpis?.results || []).map(k => ({
    KPI_ID: String(k.KPI_ID),
    name: k.name,
    weight: Number(k.weight || 0),
    done: doneSet.has(String(k.KPI_ID))
  }));

  return json({ success: true, data });
}

// recordKPI (только админ; вес берём из таблицы KPI)
async function handleRecordKPI(url, env) {
  const userID     = url.searchParams.get('userID');
  const kpiId      = url.searchParams.get('kpiId');
  const actorEmail = (url.searchParams.get('actorEmail') || '').trim().toLowerCase();
  const dateStr    = url.searchParams.get('date') || fmtDate(new Date());

  if (!userID || !kpiId)       return json({ success:false, message:'userID and kpiId required' }, 400);
  if (!actorEmail)             return json({ success:false, message:'forbidden: actorEmail required' }, 403);

  const admin = await env.DB.prepare(
    `SELECT role FROM users WHERE active=1 AND lower(email)=? LIMIT 1`
  ).bind(actorEmail).first();

  if (!admin || String(admin.role).toLowerCase() !== 'admin') {
    await safeLog(env, { userID, email: actorEmail, event: 'kpi_record_forbidden', details: { kpiId, reason:'not_admin' }});
    return json({ success:false, message:'forbidden: only admin can record KPI' }, 403);
  }

  const kpi = await env.DB.prepare(
    `SELECT weight FROM kpis WHERE active=1 AND id=? LIMIT 1`
  ).bind(kpiId).first();

  if (!kpi) return json({ success:false, message:'invalid kpiId' }, 400);

  const score = Number(kpi.weight || 0);

  await env.DB.prepare(
    `INSERT INTO progress (user_id, date, kpi_id, completed, score)
     VALUES (?, ?, ?, 1, ?)`
  ).bind(userID, dateStr, kpiId, score).run();

  await safeLog(env, { userID, email: actorEmail, event: 'kpi_recorded_backend', details: { kpiId, score, date: dateStr }});

  return json({ success:true, data:{ userID, kpiId, score, date: dateStr } });
}

// log (в лог-таблицу)
async function handleLogAction(url, env) {
  const ts = new Date().toISOString();
  const userID = url.searchParams.get('userID') || '';
  const email  = url.searchParams.get('email')  || '';
  const event  = url.searchParams.get('event')  || 'unknown';
  const details= url.searchParams.get('details')|| '';

  await env.DB.prepare(
    `INSERT INTO logs (ts, user_id, email, event, details) VALUES (?, ?, ?, ?, ?)`
  ).bind(ts, userID, email, event, details).run();

  return json({ success:true });
}

/* =================== HELPERS =================== */

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders()
    }
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type'
  };
}

function fmtDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

function startOfDay(d){ const nd=new Date(d); nd.setHours(0,0,0,0); return nd; }
function endOfDay(d){ const nd=new Date(d); nd.setHours(23,59,59,999); return nd; }

function getWeekBounds(date){
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d); monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return { start: startOfDay(monday), end: endOfDay(sunday) };
}

function getLastFullWeekBounds(refDate) {
  const thisWeek = getWeekBounds(refDate || new Date());
  const end = new Date(thisWeek.start); end.setDate(end.getDate() - 1); end.setHours(23,59,59,999);
  const start = new Date(end); start.setDate(start.getDate() - 6); start.setHours(0,0,0,0);
  return { start, end };
}

// Кол-во уникальных ISO-недель, пересекающих текущий месяц
function countIsoWeeksInMonth(date) {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0..11
  const first = new Date(y, m, 1);
  const last  = new Date(y, m + 1, 0);
  const set = new Set();
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    const monday = isoWeekStart(d);
    set.add(fmtDate(monday));
  }
  return set.size;
}

// Понедельник текущей ISO-недели
function isoWeekStart(d) {
  const date = new Date(d);
  const day = date.getDay() || 7; // 1..7 (Mon..Sun)
  if (day !== 1) date.setHours(-24 * (day - 1)); // отмотать до понедельника
  date.setHours(0,0,0,0);
  return date;
}

// Безопасный лог (не роняет запрос)
async function safeLog(env, { userID, email, event, details }) {
  try {
    await env.DB.prepare(
      `INSERT INTO logs (ts, user_id, email, event, details) VALUES (?, ?, ?, ?, ?)`
    ).bind(new Date().toISOString(), String(userID||''), String(email||''), String(event||'unknown'), JSON.stringify(details||{})).run();
  } catch (_) {}
}
