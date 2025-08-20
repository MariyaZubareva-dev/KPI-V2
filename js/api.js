import { API_BASE } from './config.js';

async function toJSON(res) {
  const txt = await res.text();
  const clean = txt.trim().replace(/^<pre[^>]*>/i, '').replace(/<\/pre>$/i, '');
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
  const res = await fetch(buildUrl(path, params), { method: 'GET', mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${res.statusText}`);
  return toJSON(res);
}

/* ---------- auth / log ---------- */
export async function login(email, password) { return httpGet('/login', { email, password }); }
export async function logout(email) { return httpGet('/log', { event: 'logout', email: email || '' }); }

/* ---------- progress / kpi ---------- */
export async function getProgress(scope, userID) {
  const params = { scope }; if (userID) params.userID = userID;
  return httpGet('/getprogress', params);
}
export async function getUserKPIs(userID, period = 'this_week') {
  return httpGet('/getprogress', { scope: 'user', userID, period });
}
export async function getUsersAggregate(period = 'this_week') {
  const scope = period === 'prev_week' ? 'users_lastweek' : 'users';
  return httpGet('/getprogress', { scope });
}
export async function recordKPI({ userID, kpiId, score, date, actorEmail }) {
  return httpGet('/recordkpi', { userID, kpiId, score, date, actorEmail });
}
export async function logEvent(event, extra = {}) {
  const params = {
    event,
    userID:  extra?.userID || extra?.user?.id || '',
    email:   extra?.email  || extra?.user?.email || '',
    details: extra && Object.keys(extra).length ? JSON.stringify(extra) : ''
  };
  return httpGet('/log', params);
}
export async function bootstrap() {
  const data = await httpGet('/bootstrap');
  if (data?.success === false) throw new Error(data?.message || 'bootstrap returned error');
  return data.data ?? data;
}
export async function listProgress({ userID, from, to, limit = 50 }) {
  return httpGet('/progress_list', { userID, from, to, limit });
}
export async function deleteProgress({ id, actorEmail }) {
  return httpGet('/progress_delete', { id, actorEmail });
}
export async function leaderboard({ from, to, includeAll = false } = {}) {
  const resp = await httpGet('/leaderboard', { from, to, include_all: includeAll ? 1 : 0 });
  return Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
}

/* ---------- KPI CRUD ---------- */
export async function kpiList({ includeInactive = false } = {}) {
  const resp = await httpGet('/kpi_list', { include_inactive: includeInactive ? 1 : 0 });
  return Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
}
export async function kpiCreate({ name, weight, actorEmail }) {
  return httpGet('/kpi_create', { name, weight, actorEmail });
}
export async function kpiUpdate({ id, name, weight, active = true, actorEmail }) {
  return httpGet('/kpi_update', { id, name, weight, active: active ? 1 : 0, actorEmail });
}
export async function kpiDelete({ id, actorEmail }) {
  return httpGet('/kpi_delete', { id, actorEmail });
}

/* ---------- SETTINGS ---------- */
export async function settingsGet(key) {
  const r = await httpGet('/settings_get', { key });
  return r?.data ?? r;
}
export async function settingsSet(key, value, actorEmail) {
  return httpGet('/settings_set', { key, value, actorEmail });
}

/* ---------- USERS CRUD ---------- */
export async function usersList({ includeInactive = true } = {}) {
  const r = await httpGet('/users_list', { include_inactive: includeInactive ? 1 : 0 });
  return Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []);
}
export async function userCreate({ name, email, role = 'employee', manager_id, actorEmail }) {
  return httpGet('/user_create', { name, email, role, manager_id, actorEmail });
}
export async function userUpdate({ id, name, email, role, active, manager_id, actorEmail }) {
  return httpGet('/user_update', { id, name, email, role, active: active ? 1 : 0, manager_id, actorEmail });
}
export async function userDelete({ id, actorEmail }) {
  return httpGet('/user_delete', { id, actorEmail });
}
