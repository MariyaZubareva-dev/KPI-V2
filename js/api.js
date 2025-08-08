import { API_BASE } from './config.js';

// Получить данные прогресса
export async function getProgress(scope, userID) {
  const url = new URL(API_BASE);
  url.searchParams.set('action', 'getProgress');
  url.searchParams.set('scope', scope);
  if (userID) url.searchParams.set('userID', userID);
  const res = await fetch(url);
  return res.json();
}

// Записать отметку KPI
export async function recordKPI(userID, kpiId, score, week) {
  const url = new URL(API_BASE);
  url.searchParams.set('action', 'recordKPI');
  url.searchParams.set('userID', userID);
  url.searchParams.set('kpiId', kpiId);
  url.searchParams.set('score', score);
  url.searchParams.set('week', week);
  const res = await fetch(url, { method: 'POST' });
  return res.json();
}

// (Опционально) Получить данные пользователя по email
export async function getUserByEmail(email) {
  const url = new URL(API_BASE);
  url.searchParams.set('action', 'getUser');
  url.searchParams.set('email', email);
  const res = await fetch(url);
  return res.json();
}
