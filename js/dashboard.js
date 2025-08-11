// js/dashboard.js
import {
  getProgress as apiGetProgress,
  getUsersAggregate,
  getUserKPIs,
  logEvent
} from './api.js';

import {
  createProgressBar,
  createUsersTable,
  createLeaderboard,
  createLoader,
  createKPIList
} from './ui-components.js';

/** Форматируем диапазон дат подписи "за прошлую неделю" */
function formatRange(start, end) {
  const pad = n => String(n).padStart(2, '0');
  const s = `${pad(start.getDate())}.${pad(start.getMonth() + 1)}`;
  const e = `${pad(end.getDate())}.${pad(end.getMonth() + 1)}`;
  return `за прошлую неделю (Пн ${s} — Вс ${e})`;
}

/** Границы последней полной недели Пн–Вс относительно сегодня */
function getLastFullWeekBounds() {
  const now = new Date();
  const day = now.getDay(); // 0..6, 0 — воскресенье
  // найдем понедельник текущей недели
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const mondayThis = new Date(now);
  mondayThis.setDate(now.getDate() + diffToMonday);
  mondayThis.setHours(0,0,0,0);

  // прошлый понедельник/воскресенье
  const start = new Date(mondayThis);
  start.setDate(start.getDate() - 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23,59,59,999);
  return { start, end };
}

/** Находим запись пользователя по email в агрегате users */
function findUserRecordByEmail(users, email) {
  if (!Array.isArray(users)) return null;
  const norm = (e) => String(e || '').trim().toLowerCase();
  return users.find(u => norm(u.email) === norm(email));
}

/** Рендер панели сотрудника */
async function renderEmployeePanel(app, user, usersCurrent) {
  const me = findUserRecordByEmail(usersCurrent, user.email || user.Email);
  if (!me) {
    const warn = document.createElement('div');
    warn.className = 'alert alert-warning';
    warn.textContent = 'Не нашли вашу запись в списке сотрудников. Попросите администратора сверить Email в листе Users.';
    app.append(warn);
    return;
  }

  // Заголовок панели сотрудника
  const h3 = document.createElement('h3');
  h3.textContent = `Здравствуйте, ${user.name || user.Name || 'сотрудник'}`;
  h3.className = 'mb-3';
  app.append(h3);

  // Личные прогресс-бары: неделя (текущая) и месяц (текущий)
  const stats = document.createElement('section');
  stats.className = 'mb-4';

  const h4 = document.createElement('h4');
  h4.textContent = 'Ваш прогресс';
  h4.className = 'mb-2';
  stats.append(h4);

  const row = document.createElement('div');
  row.className = 'row g-3';

  // Неделя (текущая)
  const colWeek = document.createElement('div');
  colWeek.className = 'col-12 col-md-6';
  const weekBox = document.createElement('div');
  const weekTitle = document.createElement('div');
  weekTitle.className = 'mb-1 text-secondary';
  weekTitle.textContent = 'Неделя (текущая)';
  weekBox.append(weekTitle, createProgressBar(me.week ? Math.min(me.week / 1 * 100, 100) : 0, 'user'));
  colWeek.append(weekBox);

  // Месяц (текущий)
  const colMonth = document.createElement('div');
  colMonth.className = 'col-12 col-md-6';
  const monthBox = document.createElement('div');
  const monthTitle = document.createElement('div');
  monthTitle.className = 'mb-1 text-secondary';
  monthTitle.textContent = 'Месяц (текущий)';
  monthBox.append(monthTitle, createProgressBar(me.month ? Math.min(me.month / 1 * 100, 100) : 0, 'user'));
  colMonth.append(monthBox);

  row.append(colWeek, colMonth);
  stats.append(row);
  app.append(stats);

  // Список KPI с переключателем периода
  const kpiSection = document.createElement('section');
  const kpiHeader = document.createElement('div');
  kpiHeader.className = 'd-flex align-items-center justify-content-between mb-2';

  const kpiTitle = document.createElement('h4');
  kpiTitle.textContent = 'Ваши KPI';
  kpiTitle.className = 'mb-0';

  const toggles = document.createElement('div');
  toggles.className = 'btn-group btn-group-sm';
  const btnThis = document.createElement('button');
  btnThis.className = 'btn btn-primary';
  btnThis.textContent = 'Текущая неделя';
  btnThis.dataset.period = 'this_week';

  const btnPrev = document.createElement('button');
  btnPrev.className = 'btn btn-outline-primary';
  btnPrev.textContent = 'Прошлая неделя';
  btnPrev.dataset.period = 'prev_week';

  toggles.append(btnThis, btnPrev);
  kpiHeader.append(kpiTitle, toggles);

  const kpiListWrap = document.createElement('div');
  kpiListWrap.className = 'mt-2';

  kpiSection.append(kpiHeader, kpiListWrap);
  app.append(kpiSection);

  // загрузка KPI и отрисовка
  async function loadAndRender(period = 'this_week') {
    kpiListWrap.innerHTML = '';
    const loader = createLoader('Загружаем KPI…');
    kpiListWrap.append(loader);
    try {
      const kpis = await getUserKPIs(me.id, period);
      loader.remove();
      kpiListWrap.append(createKPIList(kpis));
    } catch (e) {
      loader.remove();
      const err = document.createElement('div');
      err.className = 'alert alert-danger';
      err.textContent = 'Не удалось загрузить KPI. Подробности в консоли.';
      kpiListWrap.append(err);
      console.error(e);
    }
  }

  // initial
  await loadAndRender('this_week');

  // переключение периодов
  function setActive(period) {
    if (period === 'this_week') {
      btnThis.className = 'btn btn-primary';
      btnPrev.className = 'btn btn-outline-primary';
    } else {
      btnThis.className = 'btn btn-outline-primary';
      btnPrev.className = 'btn btn-primary';
    }
  }
  btnThis.addEventListener('click', async () => { setActive('this_week'); await loadAndRender('this_week'); });
  btnPrev.addEventListener('click', async () => { setActive('prev_week'); await loadAndRender('prev_week'); });
}

/** Рендер панели наблюдателя */
function renderObserverPanel(app, deptData, employeesPrevWeek, employeesCurrent) {
  // 1) Прогресс отдела (месяц)
  const deptSection = document.createElement('section');
  const h3 = document.createElement('h3');
  h3.textContent = 'Прогресс отдела (месяц)';
  h3.className = 'mb-3';
  deptSection.append(h3, createProgressBar(Number(deptData?.monthPercent ?? 0), 'department'));
  app.append(deptSection);

  // 2) ТОП-3 за прошлую неделю
  const topSection = document.createElement('section');
  topSection.id = 'leader-week';
  const h4 = document.createElement('h4');
  h4.textContent = 'ТОП-3';
  const cap = document.createElement('div');
  cap.className = 'text-tertiary small mb-2';
  const { start, end } = getLastFullWeekBounds();
  cap.textContent = formatRange(start, end);
  topSection.append(h4, cap, createLeaderboard(employeesPrevWeek, 'week'));
  app.append(topSection);

  // 3) Таблица сотрудников и баллы (read-only)
  const tableSection = document.createElement('section');
  const tTitle = document.createElement('h4');
  tTitle.textContent = 'Сотрудники и баллы';
  tTitle.className = 'mb-2';
  tableSection.append(tTitle, createUsersTable(employeesCurrent));
  app.append(tableSection);
}

/**
 * Главный рендер дашборда
 * @param {{ID?: string, Email?: string, role: string, Name?: string, name?: string, email?: string}} user
 */
export async function renderDashboard(user) {
  const role = String(user?.role || '').toLowerCase();
  const app  = document.getElementById('app');
  app.innerHTML = '';

  // Заголовок + logout
  const title = document.createElement('h2');
  title.textContent = `Добро пожаловать, ${user?.Name || user?.name || user?.Email || user?.email || 'Пользователь'}!`;

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
  app.append(toolbar);

  const loader = createLoader('Загружаем данные…');
  app.append(loader);

  try {
    console.log('renderDashboard, role:', role);

    // Данные, нужные всем
    const [deptRes, usersCurrent, usersPrevWeek] = await Promise.all([
      apiGetProgress('department'),
      getUsersAggregate('this_week'),
      getUsersAggregate('prev_week'),
    ]);

    loader.remove();

    const deptData = deptRes?.data ?? deptRes;
    const employeesCurrent = (Array.isArray(usersCurrent) ? usersCurrent : []).filter(u => String(u.role || '').toLowerCase() === 'employee');
    const employeesPrev = (Array.isArray(usersPrevWeek) ? usersPrevWeek : []).filter(u => String(u.role || '').toLowerCase() === 'employee');

    // Ветка по ролям
    if (role === 'employee') {
      await renderEmployeePanel(app, user, usersCurrent);
    } else if (role === 'observer') {
      renderObserverPanel(app, deptData, employeesPrev, employeesCurrent);
    } else if (role === 'admin') {
      // Админ: общий обзор (как раньше) + Admin-панель
      // 1) Прогресс отдела (месяц)
      const deptSection = document.createElement('section');
      const h3Dept = document.createElement('h3');
      h3Dept.textContent = 'Прогресс отдела (месяц)';
      h3Dept.className = 'mb-3';
      deptSection.append(h3Dept, createProgressBar(Number(deptData?.monthPercent ?? 0), 'department'));
      app.append(deptSection);

      // 2) ТОП-3 за прошлую неделю
      const leaderWeek = document.createElement('section');
      const h4Week = document.createElement('h4');
      h4Week.textContent = 'ТОП-3';
      const cap = document.createElement('div');
      cap.className = 'text-tertiary small mb-2';
      const { start, end } = getLastFullWeekBounds();
      cap.textContent = formatRange(start, end);
      leaderWeek.append(h4Week, cap, createLeaderboard(employeesPrev, 'week'));
      app.append(leaderWeek);

      // 3) Таблица сотрудников
      const tableSection = document.createElement('section');
      const tableTitle = document.createElement('h4');
      tableTitle.textContent = 'Сотрудники и баллы';
      tableTitle.className = 'mb-2';
      tableSection.append(tableTitle, createUsersTable(employeesCurrent));
      app.append(tableSection);

      // 4) Admin-панель
      if (employeesCurrent.length) {
        const adminModule = await import('./admin-panel.js');
        app.append(adminModule.createAdminPanel(employeesCurrent));
      }
    }

    try { await logEvent('dashboard_view', { email: user?.email || user?.Email }); } catch {}
  } catch (err) {
    loader.remove();
    console.error('Ошибка при рендере дашборда:', err);
    const alert = document.createElement('div');
    alert.className = 'alert alert-danger';
    alert.textContent = 'Не удалось загрузить дашборд. Подробности в консоли.';
    app.append(alert);
    throw err;
  }
}
