// js/dashboard.js
import { getProgress as apiGetProgress, logEvent, bootstrap as apiBootstrap } from './api.js';
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
  const userName  = user?.Name || user?.name || user?.Email || user?.email || 'Пользователь';
  const role      = String(user?.role || '').toLowerCase();
  const userEmail = (user?.email || user?.Email || '').toLowerCase();
  const app       = document.getElementById('app');

  app.innerHTML = '';

  // Заголовок + logout
  const title = document.createElement('h2');
  title.textContent = `Добро пожаловать, ${userName}!`;

  const toolbar = document.createElement('div');
  toolbar.className = 'd-flex justify-content-between align-items-center mb-3';
  toolbar.appendChild(title);

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn btn-outline-primary btn-sm';
  logoutBtn.textContent = 'Выйти';
  logoutBtn.addEventListener('click', async () => {
    try { await logEvent('logout', { email: user?.email || user?.Email }); } catch {}
    localStorage.removeItem('user');
    location.reload();
  });
  toolbar.appendChild(logoutBtn);
  app.appendChild(toolbar);

  // Контейнеры секций
  const employeeSection = document.createElement('section'); employeeSection.id = 'employee-section';
  const deptSection     = document.createElement('section'); deptSection.id    = 'dept-section';
  const leaderWeekSec   = document.createElement('section'); leaderWeekSec.id  = 'leader-week';
  const leaderMonthSec  = document.createElement('section'); leaderMonthSec.id = 'leader-month';
  const tableSection    = document.createElement('section'); tableSection.id   = 'users-table';

  if (role === 'employee') {
    app.append(employeeSection, leaderWeekSec, leaderMonthSec, tableSection);
  } else {
    app.append(deptSection, leaderWeekSec, leaderMonthSec, tableSection);
  }

  const loader = createLoader('Загружаем данные…');
  app.append(loader);

  let lastEmployees = [];

  // helpers
  function getLastFullWeekBounds() {
    const now = new Date();
    const day = now.getDay(); // 0..6
    const mondayThisWeek = new Date(now);
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    mondayThisWeek.setDate(now.getDate() + diffToMonday);

    const end = new Date(mondayThisWeek);
    end.setDate(mondayThisWeek.getDate() - 1);
    end.setHours(23, 59, 59, 999);

    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    return { start, end };
  }
  function fmtDDMM(d) { return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }); }
  function buildLeaderWeekHeader() {
    const wrap = document.createElement('div');
    const h4 = document.createElement('h4'); h4.textContent = 'ТОП-3 за неделю';
    const sub = document.createElement('div'); sub.className = 'text-tertiary caption mt-1';
    const { start, end } = getLastFullWeekBounds();
    sub.textContent = `за прошлую неделю (Пн ${fmtDDMM(start)} — Вс ${fmtDDMM(end)})`;
    wrap.append(h4, sub);
    return wrap;
  }

  function renderEmployeePanel({ deptData, usersArr }) {
    if (role !== 'employee') return;

    const me = Array.isArray(usersArr)
      ? usersArr.find(u => (u.email || '').toLowerCase() === userEmail)
      : null;

    employeeSection.innerHTML = '';

    const head = document.createElement('h3');
    head.textContent = `Здравствуйте, ${userName}`;
    employeeSection.append(head);

    if (!me) {
      const warn = document.createElement('div');
      warn.className = 'text-secondary';
      warn.textContent = 'Не удалось найти ваши данные в списке пользователей.';
      employeeSection.append(warn);
      return;
    }

    const personalWeekPoints  = Number(me.week || 0);
    const personalMonthPoints = Number(me.month || 0);

    const employeesCount  = Number(deptData?.employeesCount || 1);
    const maxWeekDept     = Number(deptData?.maxWeek || 0);
    const perUserMaxWeek  = (maxWeekDept / (employeesCount || 1)) || 1;
    const weeksInMonth    = Number(deptData?.weeksInMonth || 4);
    const perUserMaxMonth = perUserMaxWeek * weeksInMonth || 1;

    const personalWeekPercent  = Math.min(100, Math.round((personalWeekPoints  / perUserMaxWeek)  * 100));
    const personalMonthPercent = Math.min(100, Math.round((personalMonthPoints / perUserMaxMonth) * 100));
    const deptMonthPercent     = Math.min(100, Math.round(Number(deptData?.monthPercent || 0)));

    // 1) Прогресс отдела — месяц
    const deptBlock = document.createElement('div');
    const h4d = document.createElement('h4');
    h4d.textContent = 'Прогресс отдела — месяц (текущий)';
    deptBlock.append(
      h4d,
      createProgressBar(deptMonthPercent, {
        size: 'department',
        iconMode: 'points',
        iconValue: Number(deptData?.monthSum || 0)
      })
    );
    employeeSection.append(deptBlock);

    // 2) Личные прогрессы
    const grid = document.createElement('div');
    grid.className = 'row g-4';

    const colWeek = document.createElement('div'); colWeek.className = 'col-12 col-md-6';
    const h4w = document.createElement('h4'); h4w.textContent = 'Ваш прогресс — неделя (текущая)';
    colWeek.append(
      h4w,
      createProgressBar(personalWeekPercent, {
        size: 'user',
        iconMode: 'points',
        iconValue: Number(personalWeekPoints || 0)
      })
    );

    const colMonth = document.createElement('div'); colMonth.className = 'col-12 col-md-6';
    const h4m = document.createElement('h4'); h4m.textContent = 'Ваш прогресс — месяц (текущий)';
    colMonth.append(
      h4m,
      createProgressBar(personalMonthPercent, {
        size: 'user',
        iconMode: 'points',
        iconValue: Number(personalMontsPoints || 0)
      })
    );

    grid.append(colWeek, colMonth);
    employeeSection.append(grid);
  }

  async function refreshDashboardData() {
    // один батч-вызов
    const { dept, users, usersPrevWeek } = await apiBootstrap();

    const deptData  = dept || {};
    const usersArr  = Array.isArray(users) ? users : [];
    const usersPrev = Array.isArray(usersPrevWeek) ? usersPrevWeek : [];

    const employees = usersArr.filter(u => String(u.role || '').toLowerCase() === 'employee');
    const employeesPrevW = usersPrev.filter(u => String(u.role || '').toLowerCase() === 'employee');

    lastEmployees = employees;

    if (role === 'employee') {
      renderEmployeePanel({ deptData, usersArr });
      deptBlock.append(
        h4d,
        createProgressBar(
          deptMonthPercent,
          'department',
          { iconMode: 'points', valueForIcon: Number(deptData?.monthSum ?? 0) }
        )
       );
    }

    // Персональные максимумы для бейджей
    const perUserMaxWeek  = ((Number(deptData?.maxWeek || 0) / Number(deptData?.employeesCount || 1)) || 1);
    const perUserMaxMonth = perUserMaxWeek * Number(deptData?.weeksInMonth || 4) || 1;

    if (role !== 'employee') {
      deptSection.innerHTML = '';
      const deptTitle = document.createElement('h3');
      deptTitle.textContent = 'Прогресс отдела (месяц)';
      deptSection.append(
        deptTitle,
        createProgressBar(Number(deptData?.monthPercent ?? 0), {
          size: 'department',
          iconMode: 'points',
          iconValue: Number(deptData?.monthSum || 0)
        })
      );
    }

    leaderWeekSec.innerHTML = '';
    leaderWeekSec.append(
      buildLeaderWeekHeader(),
      createLeaderboard(employeesPrevW, 'week', perUserMaxWeek)
    );

    leaderMonthSec.innerHTML = '';
    const h4Month = document.createElement('h4');
    h4Month.textContent = 'ТОП-3 за месяц';
    leaderMonthSec.append(
      h4Month,
      createLeaderboard(employees, 'month', perUserMaxMonth)
    );

    tableSection.innerHTML = '';
    const tableTitle = document.createElement('h4');
    tableTitle.textContent = 'Сотрудники и баллы';
    tableSection.append(tableTitle, createUsersTable(employees));
  }

  try {
    await refreshDashboardData();
    try { await logEvent('dashboard_view', { email: user?.email || user?.Email }); } catch {}
  } finally {
    try { loader.remove(); } catch {}
  }

  // После записи KPI из админки — обновляем
  document.addEventListener('kpi:recorded', async () => {
    await refreshDashboardData();
  });

  if (role === 'admin') {
    const adminModule = await import('./admin-panel.js');
    app.append(adminModule.createAdminPanel(lastEmployees));
  }
}
// без авто-инициализации — вызывается из auth.js
