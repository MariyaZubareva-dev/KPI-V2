// js/api.js
import { API_BASE } from './config.js';

// ---------- helpers ----------
function buildUrl(path, params = {}) {
  const url = new URL(path, API_BASE);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  }
  // кэш-бастинг для GET
  url.searchParams.set('_ts', Date.now().toString());
  return url.toString();
}

async function parseJsonSafe(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function request(path, { method = 'GET', params = {}, body = null } = {}) {
  const url = buildUrl(path, params);
  const init = { method, mode: 'cors', credentials: 'omit' };

  if (method === 'POST') {
    init.headers = { 'Content-Type': 'application/json;charset=UTF-8' };
    if (body != null) init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  console.log('[API]', method, url);
  const res = await fetch(url, init);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${method} ${path} failed: ${res.status} ${res.statusText} ${txt.slice(0, 200)}`);
  }
  return parseJsonSafe(res);
}

// ---------- API ----------

/**
 * Логин через воркер
 * @returns {Promise<{success:boolean, email?:string, role?:string, name?:string}>}
 */
export async function login(email, password) {
  return request('/login', { method: 'GET', params: { email, password } });
}

/**
 * Прогресс (department | users | users_lastweek | user)
 */
export async function getProgress(scope, userID) {
  const params = { scope };
  if (userID) params.userID = userID;
  // воркер возвращает { success:true, data: ... }
  return request('/getProgress', { method: 'GET', params });
}

/**
 * Запись KPI события.
 * Можно вызывать как recordKPI({ userID, kpiId, date?, actorEmail? })
 */
export async function recordKPI(arg1, kpiId, _score, date) {
  let userID, actorEmail;
  if (typeof arg1 === 'object' && arg1 !== null) {
    ({ userID, kpiId, date, actorEmail } = arg1);
  } else {
    userID = arg1;
  }

  // если actorEmail не передали — забираем из localStorage
  if (!actorEmail) {
    try {
      const u = JSON.parse(localStorage.getItem('user')) || {};
      actorEmail = u?.email || u?.Email || '';
    } catch { actorEmail = ''; }
  }

  const params = { userID, kpiId, actorEmail };
  if (date) params.date = date;

  return request('/recordKPI', { method: 'GET', params });
}

/**
 * Логирование произвольных событий
 */
export async function logEvent(event, extra = {}) {
  const params = {
    event,
    userID: extra?.userID || extra?.user?.id || '',
    email:  extra?.email  || extra?.user?.email || ''
  };
  if (extra && Object.keys(extra).length) {
    try { params.details = JSON.stringify(extra); }
    catch { /* noop */ }
  }
  return request('/log', { method: 'GET', params });
}

// === Доп. обёртки для удобства фронта ===
export async function getUserKPIs(userID) {
  const params = { scope: 'user', userID };
  return request('/getProgress', { method: 'GET', params });
}

export async function getUsersAggregate(period = 'this_week') {
  // worker поддерживает scope=users и scope=users_lastweek
  const params = (period === 'prev_week')
    ? { scope: 'users_lastweek' }
    : { scope: 'users' };
  const raw = await request('/getProgress', { method: 'GET', params });
  const data = raw?.data ?? raw;
  return Array.isArray(data) ? data : [];
}

// алиасы для совместимости со старым кодом
export { getProgress as apiGetProgress, recordKPI as apiRecordKPI, logEvent as apiLogEvent };
