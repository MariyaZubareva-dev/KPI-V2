import { Dao } from './dao.js';
import { getWeekBounds, getLastFullWeekBounds, inRange, ymd, parseYMD, weeksInMonthOf } from './utils/date.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || '';
    const dao = Dao(env.DB);

    // CORS (пока открыто)
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), env);
    try {
      if (action === 'login')       return cors(await handleLogin(request, env, dao), env);
      if (action === 'getProgress') return cors(await routeGetProgress(request, env, dao), env);
      if (action === 'recordKPI')   return cors(await handleRecordKPI(request, env, dao), env);
      if (action === 'log')         return cors(await handleLogAction(request, env, dao), env);

      return cors(json({ success:false, message:'Invalid action' }), env);
    } catch (err) {
      console.error(err);
      return cors(json({ success:false, message: err.message }), env, 500);
    }
  }
}

/* ---------------- handlers ---------------- */

async function handleLogin(request, env, dao){
  const url = new URL(request.url);
  const email = url.searchParams.get('email') || '';
  const password = url.searchParams.get('password') || '';
  const COMMON_PASSWORD = env.COMMON_PASSWORD || '';

  const user = await dao.findUserByEmail(email);
  if (!user || password !== COMMON_PASSWORD) {
    return json({ success:false });
  }
  return json({ success:true, email: user.email, role: user.role, name: user.name });
}

async function routeGetProgress(request, env, dao){
  const url = new URL(request.url);
  const scope = (url.searchParams.get('scope') || 'department').toLowerCase();
  const userID = url.searchParams.get('userID');

  if (scope === 'department')     return handleGetDeptProgress(env, dao);
  if (scope === 'users')          return handleGetUsersProgress(env, dao, 'this_week');
  if (scope === 'users_lastweek') return handleGetUsersProgress(env, dao, 'prev_week');
  if (scope === 'user')           return handleGetUserKPIs(env, dao, userID);

  return json({ success:false, message:'Unknown scope' });
}

async function handleGetDeptProgress(env, dao){
  const now = new Date();
  const { start, end } = getWeekBounds(now);
  const progressWeek = await dao.listProgressBetween(ymd(start), ymd(end));
  const progressMonth = await dao.listProgressOfMonth(now.getFullYear(), now.getMonth());

  let weekSum = 0, monthSum = 0;
  for (const p of progressWeek) weekSum += Number(p.score || 0);
  for (const p of progressMonth) monthSum += Number(p.score || 0);

  const weightsSum = await dao.sumKpiWeights();
  const empCount = await dao.employeesCount();
  const maxWeek = weightsSum * (empCount || 1);

  const weeksInMonth = weeksInMonthOf(now);
  const maxMonth = maxWeek * weeksInMonth;

  const weekPercent = Math.min(100, Math.round((weekSum/(maxWeek||1))*100));
  const monthPercent = Math.min(100, Math.round((monthSum/(maxMonth||1))*100));

  return json({ success:true, data:{
    weekSum, monthSum, maxWeek, maxMonth, weeksInMonth, employeesCount: empCount,
    weekPercent, monthPercent
  }});
}

async function handleGetUsersProgress(env, dao, period /* 'this_week' | 'prev_week' */){
  const users = await dao.listUsers();
  const now = new Date();

  let bounds;
  if (period === 'prev_week') bounds = getLastFullWeekBounds(now);
  else bounds = getWeekBounds(now);
  const { start, end } = bounds;

  const month = now.getMonth();
  const year  = now.getFullYear();

  const rowsWeek  = await dao.listProgressBetween(ymd(start), ymd(end));
  const rowsMonth = await dao.listProgressOfMonth(year, month);

  const agg = {};
  for (const u of users) {
    agg[u.id] = { id: u.id, name: u.name, email: u.email, role: u.role, week: 0, month: 0 };
  }

  for (const r of rowsWeek) {
    if (!agg[r.user_id]) continue;
    agg[r.user_id].week += Number(r.score || 0);
  }
  for (const r of rowsMonth) {
    if (!agg[r.user_id]) continue;
    agg[r.user_id].month += Number(r.score || 0);
  }

  return json({ success:true, data: Object.values(agg) });
}

async function handleGetUserKPIs(env, dao, userID){
  if (!userID) return json({ success:false, message:'userID required' });

  // done-set за ТЕКУЩУЮ неделю
  const now = new Date();
  const { start, end } = getWeekBounds(now);
  const rowsWeek = await dao.listProgressBetween(ymd(start), ymd(end));
  const doneSet = new Set(rowsWeek.filter(r => String(r.user_id) === String(userID)).map(r => String(r.kpi_id)));

  const kpis = await dao.listKpis();
  const data = kpis.map(k => ({
    KPI_ID: String(k.KPI_ID),
    name: k.name,
    weight: Number(k.weight || 0),
    done: doneSet.has(String(k.KPI_ID))
  }));

  return json({ success:true, data });
}

async function handleRecordKPI(request, env, dao){
  const url = new URL(request.url);
  const userID     = url.searchParams.get('userID');
  const kpiId      = url.searchParams.get('kpiId');
  const date       = url.searchParams.get('date') || ymd(new Date());
  const actorEmail = (url.searchParams.get('actorEmail') || '').trim();

  if (!userID || !kpiId) return json({ success:false, message:'userID and kpiId required' });
  if (!actorEmail)       return json({ success:false, message:'forbidden: actorEmail required' });

  const actor = await Dao(env.DB).findUserByEmail(actorEmail);
  if (!actor || String(actor.role).toLowerCase() !== 'admin') {
    await dao.addLog({ userID, email:actorEmail, event:'kpi_record_forbidden', details: JSON.stringify({ kpiId, reason:'not_admin' }) });
    return json({ success:false, message:'forbidden: only admin can record KPI' });
  }

  // получаем вес KPI (игнорируем приходящий score)
  const allKpis = await dao.listKpis();
  const kpi = allKpis.find(k => String(k.KPI_ID) === String(kpiId));
  if (!kpi) return json({ success:false, message:'invalid kpiId' });

  await dao.insertProgress({ user_id: Number(userID), date, kpi_id: Number(kpiId), score: Number(kpi.weight || 0) });

  await dao.addLog({ userID, email:actorEmail, event:'kpi_recorded_backend', details: JSON.stringify({ kpiId, score:kpi.weight, date }) });

  return json({ success:true, data:{ userID, kpiId, score:kpi.weight, date }});
}

async function handleLogAction(request, env, dao){
  const url = new URL(request.url);
  const userID = url.searchParams.get('userID') || '';
  const email  = url.searchParams.get('email') || '';
  const event  = url.searchParams.get('event') || 'unknown';
  const details= url.searchParams.get('details') || '';
  await dao.addLog({ userID, email, event, details });
  return json({ success:true });
}

/* ---------------- helpers ---------------- */

function json(obj, status=200){
  return new Response(JSON.stringify(obj), { status, headers:{ 'content-type':'application/json; charset=utf-8' }});
}

function cors(res, env, status){
  const origin = env.CORS_ORIGIN || '*';
  const hdrs = new Headers(res.headers);
  hdrs.set('Access-Control-Allow-Origin', origin);
  hdrs.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  hdrs.set('Access-Control-Allow-Headers', 'content-type');
  return new Response(res.body, { status: status || res.status, headers: hdrs });
}
