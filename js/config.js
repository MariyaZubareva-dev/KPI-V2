// Базовый URL вашего Apps Script веб-приложения
export const API_BASE = 'https://script.google.com/macros/s/AKfycbwcfhnRiY3ZilJlbBLyMyKejw0-5rgUiFwnw_QT74RS94G_zhQ8sBavYfCNkzJrE1_7/exec';

// Эндпоинты для разных действий
export const ENDPOINTS = {
  LOGIN:    `${API_BASE}?action=login`,
  PROGRESS: `${API_BASE}?action=getProgress`,
  RECORD:   `${API_BASE}?action=recordKPI`,
};

// Общий пароль для всех пользователей
export const COMMON_PASSWORD = 'kpi2025';

// Максимальное число баллов в неделю (для расчёта процента департамента)
export const MAX_WEEKLY_POINTS = 15.25 * 6; // 6 сотрудников
