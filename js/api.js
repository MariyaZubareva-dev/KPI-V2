import { API_BASE } from './config.js';

// ---------- helpers ----------
async function parseResponse(res) {
  const raw = await res.text();
  const clean = raw.trim().replace(/^<pre[^>]*>/i, '').replace(/<\/pre>$/i, '');
  try { return JSON.parse(clean); } catch { return clean; }
}

async function request(action, { method = 'GET', params = {}, body = null } = {}) {
  const url = new URL(API_BASE);
  url.searchParams.set('action', action);

  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  });

  url.searchParams.set('_ts', Date.now().toString());
  console.log('[API]', action, method, url.toString());

  const init = { method, mode: 'cors', credentials: 'omit' };

  if (method === 'POST') {
    init.headers = { 'Content-Type': 'text/plain;charset=UTF-8' };
    if (body) init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const res = await fetch(url.toString(), init);

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${action} failed: ${res.status} ${res.statusText} ${txt.slice(0, 200)}`);
  }

  return parseResponse(res);
}

// ---------- API ----------

/**
 * Прогресс
 * @param {'department'|'users'|'users_lastweek'|'user'} scope
 * @param {string=} userID
 */
export async function getProgress(scope, userID) {
  const params = { scope };
  if (userID) params.userID = userID;

  const raw = await request('getProgress', { method: 'GET', params });
  if (raw?.ok === false || raw?.success === false) {
    throw new Error(raw?.error || raw?.message || 'getProgress returned error');
  }

  if (scope === 'department') return raw?.data ?? raw;
  return Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
}

/**
 * Запись KPI события
 */
export async function recordKPI(userID, kpiId, score, date) {
  if (typeof userID === 'object' && userID !== null) ({ userID, kpiId, score, date } = userID);
  const params = { userID, kpiId, score, date };
  const raw = await request('recordKPI', { method: 'GET', params });
  if (raw?.ok === false || raw?.success === false) {
    throw new Error(raw?.error || raw?.message || 'recordKPI returned error');
  }
  return raw?.data ?? raw;
}

/**
 * Логирование событий в Sheets
 */
export async function logEvent(event, extra = {}) {
  const params = {
    event,
    userID: extra?.userID || extra?.user?.id || '',
    email:  extra?.email  || extra?.user?.email || ''
  };
  if (extra && Object.keys(extra).length) params.details = JSON.stringify(extra);

  const raw = await request('log', { method: 'GET', params });
  if (raw?.ok === false || raw?.success === false) {
    throw new Error(raw?.error || raw?.message || 'logEvent returned error');
  }
  return raw?.data ?? raw;
}

// алиасы
export { getProgress as apiGetProgress, recordKPI as apiRecordKPI, logEvent as apiLogEvent };

// === Доп. обёртки для удобства фронта ===
export async function getUserKPIs(userID, period = 'this_week') {
  const params = { scope: 'user', userID, period };
  const raw = await request('getProgress', { method: 'GET', params });
  if (raw?.ok === false || raw?.success === false) {
    throw new Error(raw?.error || raw?.message || 'getUserKPIs returned error');
  }
  return raw?.data ?? raw;
}

export async function getUsersAggregate(period = 'this_week') {
  // Бэкенд поддерживает и параметр period для scope=users, и отдельный scope=users_lastweek
  const params = (period === 'prev_week') ? { scope: 'users_lastweek' } : { scope: 'users' };
  const raw = await request('getProgress', { method: 'GET', params });
  if (raw?.ok === false || raw?.success === false) {
    throw new Error(raw?.error || raw?.message || 'getUsersAggregate returned error');
  }
  const data = raw?.data ?? raw;
  return Array.isArray(data) ? data : [];
}
