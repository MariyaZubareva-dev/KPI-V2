// js/api.js
import { API_BASE } from './config.js';

// Приводим ответ к JSON и убираем возможный <pre>
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
    credentials: 'omit',
  });
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status} ${res.statusText}`);
  }
  return toJSON(res);
}

/* ---------- public API ---------- */

// Логин (воркер возвращает поля верхнего уровня)
export async function login(email, password) {
  const data = await httpGet('/login', { email, password });
  return data; // { success, email, role, name } или { success:false }
}

// Выход: на бэкенде роута нет — чистим только локальное состояние
export async function logout() {
  return { success: true };
}

// Универсальный геттер прогресса
export async function getProgress(scope, userID) {
  const params = { scope };
  if (userID) params.userID = userID;
  const data = await httpGet('/getprogress', params);
  if (data?.success === false) throw new Error(data?.message || 'getProgress returned error');
  return data.data ?? data;
}

// KPI одного пользователя за текущую неделю
export async function getUserKPIs(userID, period = 'this_week') {
  const data = await httpGet('/getprogress', { scope: 'user', userID, period });
  if (data?.success === false) throw new Error(data?.message || 'getUserKPIs returned error');
  return data.data ?? data;
}

// Агрегация по пользователям (this_week | prev_week)
export async function getUsersAggregate(period = 'this_week') {
  const scope = period === 'prev_week' ? 'users_lastweek' : 'users';
  const data = await httpGet('/getprogress', { scope });
  if (data?.success === false) throw new Error(data?.message || 'getUsersAggregate returned error');
  const arr = data.data ?? data;
  return Array.isArray(arr) ? arr : [];
}

// Записать KPI (только админ)
export async function recordKPI({ userID, kpiId, score, date, actorEmail }) {
  const data = await httpGet('/recordkpi', { userID, kpiId, score, date, actorEmail });
  if (data?.success === false) throw new Error(data?.message || 'recordKPI returned error');
  return data.data ?? data;
}

// Логирование события в D1 logs
export async function logEvent(event, extra = {}) {
  const params = {
    event,
    userID:  extra?.userID || extra?.user?.id || '',
    email:   extra?.email  || extra?.user?.email || '',
    details: extra && Object.keys(extra).length ? JSON.stringify(extra) : ''
  };
  const data = await httpGet('/log', params);
  if (data?.success === false) throw new Error(data?.message || 'logEvent returned error');
  return data.data ?? data;
}

// Единый батч начальной загрузки
export async function bootstrap() {
  const data = await httpGet('/bootstrap');
  if (data?.success === false) throw new Error(data?.message || 'bootstrap returned error');
  return data.data ?? data; // { dept, users, usersPrevWeek }
}
