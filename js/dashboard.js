// js/dashboard.js
import { getProgress as apiGetProgress, logEvent } from './api.js';
import {
  createProgressBar,
  createUsersTable,
  createLeaderboard,
  createLoader
} from './ui-components.js';

/**
 * Рендер дашборда
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
  toolbar.append(title);

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn btn-outline-primary btn-sm';
  logoutBtn.textContent = 'Выйти';
  logoutBtn.addEventListener('click', async () => {
    try { await logEvent('logout', { email: user?.email || user?.Email }); } catch {}
    localStorage.removeItem('user');
    location.reload();
  });
  toolbar.append(logoutBtn);

  app.append(toolbar);

  // Контейнеры разделов (чтобы было куда «подменять» контент при рефреше)
  const deptSection   = document.createElement('section'); deptSection.id   = 'dept-section';
  const leaderWeekSec = document.createElement('section'); leaderWeekSec.id = 'leader-week';
  const leaderMonthSec= document.createElement('section'); leaderMonthSec.id= 'leader-month';
  const tableSection  = document.createElement('section'); tableSection.id  = 'users-table';

  app.append(deptSection, leaderWeekSec, leaderMonthSec, tableSection);

  // Лоадер на время первичной загрузки
  const loader = createLoader('Загружаем данные…');
  app.append(loader);

  // --- вспомогательные функции ---

  function getLastFullWeekBounds() {
    // Последнее полное Пн–Вс до текущего понедельника
    const now = new Date();
    const day = now.getDay(); // 0..6 (0 — вс)
    const mondayThisWeek = new Date(now);
    // смещение до понедельника текущей недели
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    mondayThisWeek.setDate(now.getDate() + diffToMonday);
    // конец прошлой недели — воскресенье перед этим понедельником
    const end = new Date(mondayThisWeek);
    end.setDate(mondayThisWeek.getDate() - 1);
    end.setHours(23, 59, 59, 999);
    // начало — понедельник за 6 дней до конца
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  function fmtDDMM(d) {
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  }

  function buildLeaderWeekHeader() {
    const wrap = document.createElement('div');
    const h4 = document.createElement('h4');
    h4.textContent = 'ТОП-3 за неделю';
    const sub = document.createElement('div');
    sub.className = 'text-tertiary caption mt-1';
    const { start, end } = getLastFullWeekBounds();
    sub.textContent = `за прошлую неделю (Пн ${fmtDDMM(start)} — Вс ${fmtDDMM(end)})`;
    wrap.append(h4, sub);
    return wrap;
  }

  async function refreshDashboardData() {
    try {
      const [deptRes, usersRes, usersPrevRes] = await Promise.all([
        apiGetProgress('department'),
        apiGetProgress('users'),
        apiGetProgress('users_lastweek')
      ]);

      const deptData   = deptRes?.data ?? deptRes;
      const usersArr   = (usersRes?.data ?? usersRes) || [];
      const usersPrev  = (usersPrevRes?.data ?? usersPrevRes) || [];

      const employees      = Array.isArray(usersArr)
        ? usersArr.filter(u => String(u.role || '').toLowerCase() === 'employee')
        : [];
      const employeesPrevW = Array.isArray(usersPrev)
        ? usersPrev.filter(u => String(u.role || '').toLowerCase() === 'employee')
        : [];

      // 1) Прогресс отдела (месяц)
      deptSection.innerHTML = '';
      const deptTitle = document.createElement('h3');
      deptTitle.textContent = 'Прогресс отдела (месяц)';
      deptSection.append(deptTitle, createProgressBar(Number(deptData?.monthPercent ?? 0), 'department'));

      // 2) Лидерборды
      leaderWeekSec.innerHTML = '';
      leaderWeekSec.append(buildLeaderWeekHeader(), createLeaderboard(employeesPrevW, 'week'));

      leaderMonthSec.innerHTML = '';
      const h4Month = document.createElement('h4');
      h4Month.textContent = 'ТОП-3 за месяц';
      leaderMonthSec.append(h4Month, createLeaderboard(employees, 'month'));

      // 3) Таблица сотрудников
      tableSection.innerHTML = '';
      const tableTitle = document.createElement('h4');
      tableTitle.textContent = 'Сотрудники и баллы';
      tableSection.append(tableTitle, createUsersTable(employees));
    } catch (e) {
      console.error('refreshDashboardData error', e);
    }
  }

  // первичная загрузка
  try {
    await refreshDashboardData();
    try { await logEvent('dashboard_view', { email: user?.email || user?.Email }); } catch {}
  } finally {
    loader.remove();
  }

  // Реакция на отметку KPI из админ-панели — обновляем данные дашборда «на лету»
  window.addEventListener('kpi-updated', async () => {
    await refreshDashboardData();
  });

  // Если админ — подключаем админ-панель
  if (role === 'admin') {
    const adminModule = await import('./admin-panel.js');
    app.append(adminModule.createAdminPanel()); // панель сама подтянет сотрудников
  }
}
