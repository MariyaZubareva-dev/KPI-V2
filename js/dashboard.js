// js/dashboard.js
import { getProgress as apiGetProgress, logEvent } from './api.js';
import { createProgressBar, createUsersTable, createLeaderboard, createLoader } from './ui-components.js';

/**
 * Вычисляем подпись прошлой недели: "за прошлую неделю (Пн DD.MM — Вс DD.MM)"
 */
function getLastWeekLabel() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun..6=Sat
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const mondayThis = new Date(now);
  mondayThis.setDate(now.getDate() + diffToMonday);
  const mondayPrev = new Date(mondayThis);
  mondayPrev.setDate(mondayThis.getDate() - 7);
  const sundayPrev = new Date(mondayPrev);
  sundayPrev.setDate(mondayPrev.getDate() + 6);

  const fmt = (d) =>
    `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;

  return `за прошлую неделю (Пн ${fmt(mondayPrev)} — Вс ${fmt(sundayPrev)})`;
}

/**
 * Перерисовывает основные блоки дашборда (без полной перезагрузки страницы)
 * - Прогресс отдела (месяц)
 * - ТОП-3 за прошлую неделю
 * - Таблица сотрудников (текущая неделя/месяц)
 */
async function refreshDashboardSections() {
  const deptSection   = document.getElementById('dept-section');
  const leaderWeekSec = document.getElementById('leader-week');
  const usersTableSec = document.getElementById('users-table');

  if (deptSection)   deptSection.innerHTML   = '';
  if (leaderWeekSec) leaderWeekSec.innerHTML = '';
  if (usersTableSec) usersTableSec.innerHTML = '';

  // Лоадеры на время запросов
  const loaders = {
    dept: createLoader('Обновляем прогресс отдела…'),
    week: createLoader('Обновляем ТОП-3…'),
    table: createLoader('Обновляем таблицу…'),
  };
  if (deptSection)   deptSection.append(loaders.dept);
  if (leaderWeekSec) leaderWeekSec.append(loaders.week);
  if (usersTableSec) usersTableSec.append(loaders.table);

  // Три запроса параллельно
  const [deptRes, usersNowRes, usersPrevWeekRes] = await Promise.all([
    apiGetProgress('department'),
    apiGetProgress('users'),
    apiGetProgress('users_lastweek'),
  ]);

  // Снимаем лоадеры
  loaders.dept.remove();
  loaders.week.remove();
  loaders.table.remove();

  const deptData = deptRes?.data ?? deptRes; // объект
  const usersNow = (usersNowRes?.data ?? usersNowRes) || []; // массив текущих
  const usersPw  = (usersPrevWeekRes?.data ?? usersPrevWeekRes) || []; // массив прошлой недели

  // Фильтруем сотрудников (employee)
  const employeesNow = Array.isArray(usersNow)
    ? usersNow.filter(u => String(u.role || '').toLowerCase() === 'employee')
    : [];
  const employeesPw = Array.isArray(usersPw)
    ? usersPw.filter(u => String(u.role || '').toLowerCase() === 'employee')
    : [];

  // === Прогресс отдела (месяц)
  if (deptSection) {
    const h3 = document.createElement('h3');
    h3.textContent = 'Прогресс отдела (месяц)';
    const bar = createProgressBar(Number(deptData?.monthPercent ?? 0), 'department');
    deptSection.append(h3, bar);
  }

  // === ТОП-3 за прошлую неделю + подпись
  if (leaderWeekSec) {
    const h4 = document.createElement('h4');
    h4.textContent = 'ТОП-3 за неделю';
    const small = document.createElement('div');
    small.className = 'text-tertiary mb-2';
    small.textContent = getLastWeekLabel();
    leaderWeekSec.append(h4, small, createLeaderboard(employeesPw, 'week'));
  }

  // === Таблица сотрудников (текущая неделя/месяц)
  if (usersTableSec) {
    const h4 = document.createElement('h4');
    h4.textContent = 'Сотрудники и баллы';
    usersTableSec.append(h4, createUsersTable(employeesNow));
  }
}

/**
 * Рендер дашборда по роли
 * @param {{ID?: string, Email?: string, role: string, Name?: string, name?: string, email?: string}} user
 */
export async function renderDashboard(user) {
  const userName = user?.Name || user?.name || user?.Email || user?.email || 'Пользователь';
  const role     = String(user?.role || '').toLowerCase();
  const app      = document.getElementById('app');

  // очистка
  app.innerHTML = '';

  // Заголовок + logout
  const title = document.createElement('h2');
  title.textContent = `Добро пожаловать, ${userName}!`;

  const toolbar = document.createElement('div');
  toolbar.className = 'd-flex justify-content-between align-items-center mb-3';
  toolbar.appendChild(title);

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn btn-outline-secondary btn-sm';
  logoutBtn.textContent = 'Выйти';
  logoutBtn.addEventListener('click', async () => {
    try { await logEvent('logout', { email: user?.email || user?.Email }); } catch {}
    localStorage.removeItem('user');
    location.reload();
  });
  toolbar.appendChild(logoutBtn);

  app.append(toolbar);

  // Разделы-контейнеры (пустые, наполним при refresh)
  const deptSection   = document.createElement('section'); deptSection.id = 'dept-section';
  const leaderWeekSec = document.createElement('section'); leaderWeekSec.id = 'leader-week';
  const usersTableSec = document.createElement('section'); usersTableSec.id = 'users-table';

  app.append(deptSection, leaderWeekSec, usersTableSec);

  // Первая загрузка данных
  const firstLoader = createLoader('Загружаем данные…');
  app.append(firstLoader);
  try {
    await refreshDashboardSections();
    try { await logEvent('dashboard_view', { email: user?.email || user?.Email }); } catch {}
  } finally {
    firstLoader.remove();
  }

  // Только для админа — подключаем панель и слушаем событие о записи KPI
  if (role === 'admin') {
    const adminModule = await import('./admin-panel.js');
    app.append(adminModule.createAdminPanel([])); // сам модуль подхватит список из dashboard при инициализации

    // Подписка: как только KPI записан — обновляем секции
    window.addEventListener('kpi-updated', async () => {
      await refreshDashboardSections();
    }, { passive: true });
  }
}
