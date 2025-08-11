
import { API_BASE } from './config.js';

// ---------- helpers ----------
async function parseResponse(res) {

  const raw = await res.text();
  const clean = raw.trim().replace(/^<pre[^>]*>/i, '').replace(/<\/pre>$/i, '');
  try {
    return JSON.parse(clean);
  } catch {
     return clean;
  }
}

async function request(action, { method = 'GET', data = null, query = {} } = {}) {
  const url = new URL(API_BASE);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, v);
    }
  }

  const init = {
    method,
    mode: 'cors',
    credentials: 'omit',
  };

  if (method === 'POST') {
    init.headers = { 'Content-Type': 'text/plain;charset=UTF-8' };
    if (data) init.body = JSON.stringify(data);
  }

  const res = await fetch(url.toString(), init);

  if (!res.ok) {
     throw new Error(`${action} failed: ${res.status} ${res.statusText} ${body?.slice(0, 200)}`);
  }

  return parseResponse(res);
}

// ---------- API ----------
/**
 * Прогресс (месячный/пользовательский и т.п.)
 * @param {('user'|'dept'|'all'|string)} scope
 * @param {string} userID
 */
export async function getProgress(scope, userID) {
  const params = { scope };
  if (userID) params.userID = userID;
  const data = await request('getProgress', { method: 'GET', params });
  if (data?.ok === false || data?.success === false) throw new Error(data.error || 'getProgress returned error');
  return data;
}

/**
 * Запись KPI события
 * payload: { userID, date, metric, value, comment, ... }
 */
export async function recordKPI(userID, kpiId, score, date) {
  if (typeof userID === 'object' && userID !== null) {
    ({ userID, kpiId, score, date } = userID);
  }
  const params = { userID, kpiId, score, date };
  const data = await request('recordKPI', { method: 'GET', params }); // соответствуем handleRecordKPI(e)
  if (data?.ok === false || data?.success === false) throw new Error(data.error || 'recordKPI returned error');
  return data;
}

/**
 * Логирование произвольных событий в Sheets
 * payload: { event, userID, meta?: {...} }
 */
export async function logEvent(event, extra = {}) {
  const params = {
    event,
    userID: extra.userID || (extra.user && extra.user.id) || '',
    email:  extra.email  || (extra.user && extra.user.email) || ''
  };
  if (Object.keys(extra).length) params.details = JSON.stringify(extra);

  const data = await request('log', { method: 'GET', params });
  if (data?.ok === false || data?.success === false) throw new Error(data.error || 'logEvent returned error');
  return data;
}

// ---------- aliases (на случай старых импортов) ----------
export { getProgress as apiGetProgress, recordKPI as apiRecordKPI, logEvent as apiLogEvent };
