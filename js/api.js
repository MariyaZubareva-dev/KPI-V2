// js/api.js
import { API_BASE } from './config.js';

// Приводим ответ к JSON и убираем <pre>
async function toJSON(res) {
  const txt = await res.text();
  const clean = txt.trim()
    .replace(/^<pre[^>]*>/i, '')
    .replace(/<\/pre>$/i, '');
  if (!clean) return {};
  try {
    return JSON.parse(clean);
  } catch {
    return { success: false, message: 'Bad JSON', raw: clean };
  }
}

function buildUrl(path, params = {}) {
  const url = new URL(path, API_BASE);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  });
  return url.toString();
}

async function httpGet(path, params) {
  const res = await fetch(buildUrl(path, params), {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit'
  });
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status} ${res.statusText}`);
  }
  return toJSON(res);
}

/* ---------- public API ---------- */

// Логин
export async function login(email, password) {
  return httpGet('/login', { email, password });
}

// Выход
export async function logout() {
  return httpGet('/logout');
}

// Прогресс (универсальный геттер)
export async function getProgress(scope, userID) {
  const params = { scope };
  if (userID) params.userID = userID;
  return httpGet('/getProgress', params);
}

// KPI одного пользователя
export async function getUserKPIs(userID, period = 'this_week') {
  return httpGet('/getProgress', { scope: 'user', userID, period });
}

// Агрегация по пользователям
export async function getUsersAggregate(period = 'this_week') {
  const scope = period === 'prev_week' ? 'users_lastweek' : 'users';
  return httpGet('/getProgress', { scope });
}

// Записать KPI (только админ)
export async function recordKPI({ userID, kpiId, score, date, actorEmail }) {
  return httpGet('/recordKPI', { userID, kpiId, score, date, actorEmail });
}

// Логирование события
export async function logEvent(event, extra = {}) {
  const params = {
    event,
    userID: extra?.userID || extra?.user?.id || '',
    email:  extra?.email  || extra?.user?.email || '',
    details: extra && Object.keys(extra).length
      ? JSON.stringify(extra)
      : ''
  };
  return httpGet('/logEvent', params);
}
