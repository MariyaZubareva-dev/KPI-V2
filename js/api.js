// js/api.js
import { API_BASE } from './config.js';

/**
 * Универсальный запрос к Apps Script.
 * Делает "простые" CORS-запросы: без credentials и без custom headers.
 */
async function request(action, { method = 'GET', params = {}, body = null } = {}) {
  const url = new URL(API_BASE);
  url.searchParams.set('action', action);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const opts = {
    method,
    mode: 'cors',
    redirect: 'follow',
    credentials: 'omit',          // ВАЖНО: не include!
    headers: {}                   // без кастомных заголовков
  };

  if (method === 'POST') {
    // Отправляем как form-url-encoded, чтобы избежать preflight
    const form = new URLSearchParams();
    if (body && typeof body === 'object') {
      for (const [k, v] of Object.entries(body)) {
        form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
      }
    }
    opts.body = form; // браузер сам выставит нужный Content-Type
  }

  const res = await fetch(url.toString(), opts);

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${txt.slice(0, 200)}`);
  }

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();

  // На всякий случай: если пришёл text/plain
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return { ok: true, data: txt }; }
}

// === Публичные функции API ===

export async function getProgress(scope, userID) {
  const params = { scope };
  if (userID) params.userID = userID;
  const data = await request('getProgress', { method: 'GET', params });
  if (data?.ok === false) throw new Error(data.error || 'getProgress returned error');
  return data;
}

export async function recordKPI(payload) {
  const data = await request('recordKPI', { method: 'POST', body: payload });
  if (data?.ok === false) throw new Error(data.error || 'recordKPI returned error');
  return data;
}

export async function logEvent(event, extra = {}) {
  const data = await request('logEvent', {
    method: 'POST',
    body: { event, extra, ts: new Date().toISOString() }
  });
  if (data?.ok === false) throw new Error(data.error || 'logEvent returned error');
  return data;
}
