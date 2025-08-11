// js/api.js
import { API_BASE } from './config.js';

// ---------- helpers ----------
async function parseResponse(res) {
  // Apps Script иногда оборачивает JSON в <pre>...</pre>
  const raw = await res.text();
  const clean = raw.trim()
    .replace(/^<pre[^>]*>/i, '')
    .replace(/<\/pre>$/i, '');
  try {
    return JSON.parse(clean);
  } catch {
    // вернём строку как есть (напр., "ok")
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
    credentials: 'include', // если используете cookie-сессию у Apps Script
  };

  if (method === 'POST') {
    init.headers = { 'Content-Type': 'application/json' };
    if (data) init.body = JSON.stringify(data);
  }

  const res = await fetch(url.toString(), init);

  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch {}
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
export async function recordKPI(payload) {
  return request('recordKPI', { method: 'POST', data: payload });
}

/**
 * Логирование произвольных событий в Sheets
 * payload: { event, userID, meta?: {...} }
 */
export async function logEvent(payload) {
  const enriched = { ...payload, ts: new Date().toISOString() };
  try {
    return await request('logEvent', { method: 'POST', data: enriched });
  } catch (e) {
    // чтобы UI не падал из-за логов
    console.warn('logEvent failed:', e);
    return { ok: false, error: e.message };
  }
}

// ---------- aliases (на случай старых импортов) ----------
export { getProgress as apiGetProgress };
export { recordKPI as apiRecordKPI };
export { logEvent as apiLogEvent };
