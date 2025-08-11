
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
  return request('getProgress', { method: 'GET', query: { scope, userID } });
}

/**
 * Запись KPI события
 * payload: { userID, date, metric, value, comment, ... }
 */
export async function recordKPI({ userID, kpiId, score, date } = {}) {
  const data = await request('recordKPI', {
    method: 'POST',
    body: { userID, kpiId, score, date }
  });
  if (data?.ok === false) throw new Error(data.error || 'recordKPI returned error');
  return data;
}

/**
 * Логирование произвольных событий в Sheets
 * payload: { event, userID, meta?: {...} }
 */
export async function logEvent(event, { userID, email, details } = {}) {
  const data = await request('logEvent', {
    method: 'POST',
    body: {
      userID: userID ?? (JSON.parse(localStorage.getItem('user') || '{}').id || ''),
      email:  email  ?? (JSON.parse(localStorage.getItem('user') || '{}').email || ''),
      event,
      details: typeof details === 'object' ? JSON.stringify(details) : (details ?? '')
    }
  });
  if (data?.ok === false) throw new Error(data.error || 'logEvent returned error');
  return data;
}

// ---------- aliases (на случай старых импортов) ----------
export { getProgress as apiGetProgress, recordKPI as apiRecordKPI, logEvent as apiLogEvent };
