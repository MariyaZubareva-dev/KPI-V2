import { API_BASE } from './config.js';

/**
 * Получить данные прогресса
 * @param {string} scope — 'department', 'users' или 'user'
 * @param {string} [userID] — обязательен, если scope === 'user'
 */
export async function getProgress(scope, userID) {
  const url = new URL(API_BASE);
  url.searchParams.set('action', 'getProgress');
  url.searchParams.set('scope', scope);
  if (userID) {
    url.searchParams.set('userID', userID);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`getProgress failed: ${res.status}`);
  return res.json();
}

/**
 * Записать отметку KPI
 * @param {string} userID
 * @param {string} kpiId
 * @param {number} score
 * @param {string} week — формат 'YYYY-WW'
 */
export async function recordKPI(userID, kpiId, score, week) {
  const url = new URL(API_BASE);
  url.searchParams.set('action', 'recordKPI');
  url.searchParams.set('userID', userID);
  url.searchParams.set('kpiId', kpiId);
  url.searchParams.set('score', String(score));
  url.searchParams.set('week', week);
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) throw new Error(`recordKPI failed: ${res.status}`);
  return res.json();
}

/**
 * Получить данные пользователя по email
 * @param {string} email
 */
export async function getUserByEmail(email) {
  const url = new URL(API_BASE);
  url.searchParams.set('action', 'getUser');
  url.searchParams.set('email', email);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`getUserByEmail failed: ${res.status}`);
  return res.json();
}
