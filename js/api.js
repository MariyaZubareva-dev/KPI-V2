// js/api.js
import { API_BASE } from './config.js';

// ---------- helpers ----------
function qs(obj = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  // легкий no-cache
  sp.set('_ts', Date.now().toString());
  return sp.toString();
}

async function getJSON(url) {
  const res = await fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit' });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Bad JSON: ${text.slice(0,200)}`); }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} ${text.slice(0,200)}`);
  return data;
}

// ---------- API ----------

/**
 * Прогресс
 * @param {'department'|'users'|'users_lastweek'|'user'} scope
 * @param {string=} userID
 * @param {'this_week'|'prev_week'=} period  // используется для scope=users
 */
export async function getProgress(scope, userID, period) {
  const params = { scope, userID, period };
  const url = `${API_BASE}/getProgress?${qs(params)}`;
  const raw = await getJSON(url);

  if (raw?.success === false) throw new Error(raw?.message || 'getProgress returned error');

  // department -> объект; users/user -> массив
  if (scope === 'department') return raw?.data ?? raw;
  const data = raw?.data ?? raw;
  return Array.isArray(data) ? data : [];
}

/**
 * Запись KPI события
 * @param {object|string|number} input  { userID, kpiId, date?, actorEmail? } | userID
 * date: YYYY-MM-DD (опционально). score игнорируется на бэке — вес берётся из таблицы KPI.
 */
export async function recordKPI(input, kpiId, _score, date) {
  /** нормализуем вход */
  let userID, actorEmail, kpi;
  if (typeof input === 'object' && input !== null) {
    userID     = input.userID;
    kpi        = input.kpiId;
    date       = input.date;
    actorEmail = input.actorEmail;
  } else {
    userID = input;
    kpi    = kpiId;
  }

  if (!actorEmail) {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      actorEmail = u?.email || u?.Email || '';
    } catch { actorEmail = ''; }
  }

  const params = { userID, kpiId: kpi, date, actorEmail };
  const url = `${API_BASE}/recordKPI?${qs(params)}`;
  const raw = await getJSON(url);

  if (raw?.success === false) throw new Error(raw?.message || 'recordKPI returned error');
  return raw?.data ?? raw;
}

/**
 * Логирование событий
 * @param {string} event
 * @param {object} extra  { userID?, email?, user? , ... } — остальные поля уйдут в details как JSON
 */
export async function logEvent(event, extra = {}) {
  const email  = extra?.email || extra?.user?.email || '';
  const userID = extra?.userID || extra?.user?.id || '';
  const details = Object.keys(extra).length ? JSON.stringify(extra) : undefined;

  const params = { event, email, userID, details };
  const url = `${API_BASE}/log?${qs(params)}`;
  const raw = await getJSON(url);

  if (raw?.success === false) throw new Error(raw?.message || 'logEvent returned error');
  return raw?.data ?? raw;
}

/** Доп. обёртки — для удобства выборок */
export async function getUserKPIs(userID, period = 'this_week') {
  const url = `${API_BASE}/getProgress?${qs({ scope: 'user', userID, period })}`;
  const raw = await getJSON(url);
  if (raw?.success === false) throw new Error(raw?.message || 'getUserKPIs returned error');
  return raw?.data ?? raw;
}

export async function getUsersAggregate(period = 'this_week') {
  const scope = period === 'prev_week' ? 'users_lastweek' : 'users';
  const url = `${API_BASE}/getProgress?${qs({ scope })}`;
  const raw = await getJSON(url);
  if (raw?.success === false) throw new Error(raw?.message || 'getUsersAggregate returned error');
  const data = raw?.data ?? raw;
  return Array.isArray(data) ? data : [];
}

// алиасы на случай старых импортов
export { getProgress as apiGetProgress, recordKPI as apiRecordKPI, logEvent as apiLogEvent };
