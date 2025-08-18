// js/api.js
import { API_BASE } from './config.js';

// Нормализуем ответ к JSON (на всякий случай убираем <pre>)
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

// Логин
export async function login(email, password) {
  return httpGet('/login', { email, password });
}

// Логаут (серверной сессии нет — просто логируем событие)
export async function logout(email) {
  return httpGet('/log', { event: 'logout', email: email || '' });
}

// Прогресс (универсальный геттер)
export async function getProgress(scope, userID) {
  const params = { scope };
  if (userID) params.userID = userID;
  return httpGet('/getprogress', params); // backend в нижнем регистре
}

// KPI конкретного пользователя за текущую неделю
export async function getUserKPIs(userID, period = 'this_week') {
  return httpGet('/getprogress', { scope: 'user', userID, period });
}

// Агрегация по пользователям (this_week | prev_week)
export async function getUsersAggregate(period = 'this_week') {
  const scope = period === 'prev_week' ? 'users_lastweek' : 'users';
  return httpGet('/getprogress', { scope });
}

// Записать KPI (только админ). score вычисляется на бэке из веса KPI.
export async function recordKPI({ userID, kpiId, score, date, actorEmail }) {
  return httpGet('/recordkpi', { userID, kpiId, score, date, actorEmail });
}

// Логирование произвольного события
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

// Список отметок (история)
export async function listProgress({ userID, from, to, limit = 50 }) {
  return httpGet('/progress_list', { userID, from, to, limit });
}

// Удаление отметки (по rowid)
export async function deleteProgress({ id, actorEmail }) {
  return httpGet('/progress_delete', { id, actorEmail });
}
