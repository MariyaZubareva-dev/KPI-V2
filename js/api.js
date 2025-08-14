// js/api.js
import { API_BASE } from './config.js';

// Нормализация текстового ответа в JSON (с учётом возможных <pre>)
async function toJSON(res) {
  const txt = await res.text();
  const clean = txt.trim()
    .replace(/^<pre[^>]*>/i, '')
    .replace(/<\/pre>$/i, '');
  if (!clean) return {};
  try { return JSON.parse(clean); }
  catch { return { success: false, message: 'Bad JSON', raw: clean }; }
}

function buildUrl(path, params = {}) {
  const url = new URL(path, API_BASE);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });
  return url.toString();
}

async function httpGet(path, params) {
  const res = await fetch(buildUrl(path, params), {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${res.statusText}`);
  return toJSON(res);
}

/* ---------- public API ---------- */

// Логин: { success, email, role, name } | { success:false }
export async function login(email, password) {
  return httpGet('/login', { email, password });
}

// Выход: пишем событие и завершаем локально
export async function logout(email) {
  try { await logEvent('logout', { email }); } catch {}
  return { success: true };
}

// Универсальный геттер прогресса
export async function getProgress(scope, userID) {
  const params = { scope };
  if (userID) params.userID = userID;
  return httpGet('/getprogress', params);
}

// KPI одного пользователя
export async function getUserKPIs(userID, period = 'this_week') {
  return httpGet('/getprogress', { scope: 'user', userID, period });
}

// Агрегация по пользователям
export async function getUsersAggregate(period = 'this_week') {
  const scope = period === 'prev_week' ? 'users_lastweek' : 'users';
  return httpGet('/getprogress', { scope });
}

// Записать KPI (только админ)
export async function recordKPI({ userID, kpiId, score, date, actorEmail }) {
  // score бэкенд рассчитывает сам по весу KPI, передавать не обязательно
  return httpGet('/recordkpi', { userID, kpiId, date, actorEmail });
}

// Логирование события
export async function logEvent(event, extra = {}) {
  const params = {
    event,
    userID:  extra?.userID || extra?.user?.id || '',
    email:   extra?.email  || extra?.user?.email || '',
    details: extra && Object.keys(extra).length ? JSON.stringify(extra) : ''
  };
  return httpGet('/log', params);
}

// Единый батч для начальной загрузки
export async function bootstrap() {
  const data = await httpGet('/bootstrap');
  if (data?.success === false) throw new Error(data?.message || 'bootstrap returned error');
  return data.data ?? data; // { dept, users, usersPrevWeek }
}
