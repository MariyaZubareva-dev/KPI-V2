// js/api.js
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

  // приклеиваем любые параметры запроса
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  });

  // cache-busting и лог
  url.searchParams.set('_ts', Date.now().toString());
  console.log('[API]', action, method, url.toString());

  const init = { method, mode: 'cors', credentials: 'omit' };

  if (method === 'POST') {
    // text/plain чтобы избежать preflight; при желании можно form-url-encoded
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
 * @param {'department'|'users'|'user'} scope
 * @param {object|string=} opts - либо объект опций (напр. { period:'prev_week', userID:'2' }),
 *                                либо строка userID (для обратной совместимости).
 */
export async function getProgress(scope, opts = undefined) {
  const params = { scope };

  if (typeof opts === 'string' || typeof opts === 'number') {
    // b/c: getProgress('user', '2')
    params.userID = String(opts);
  } else if (opts && typeof opts === 'object') {
    const { userID, period, ...rest } = opts;
    if (userID) params.userID = userID;
    if (period) params.period = period;
    // позволяем прокидывать и другие параметры без сюрпризов
    Object.assign(params, rest);
  }

  const raw = await request('getProgress', { method: 'GET', params });
  if (raw?.ok === false || raw?.success === false) {
    throw new Error(raw?.error || raw?.message || 'getProgress returned error');
  }

  const data = raw?.data ?? raw;

  // Небольшая нормализация, чтобы фронт не падал
  if (scope === 'department') return data || {};
  return Array.isArray(data) ? data : [];
}

/**
 * Запись KPI события
 * Аргументы: (userID, kpiId, score, date?) или объект { userID, kpiId, score, date }
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
 * logEvent('dashboard_view', { email, userID, ... })
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

// алиасы для старых импортов
export { getProgress as apiGetProgress, recordKPI as apiRecordKPI, logEvent as apiLogEvent };
