// js/dashboard.js
import { getProgress as apiGetProgress, logEvent } from './api.js';
import { createProgressBar, createUsersTable, createLeaderboard, createLoader } from './ui-components.js';

/* =========================
   Helpers: last full week
   ========================= */
function formatDM(date) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}`;
}
function getLastFullWeekRange(ref = new Date()) {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();                // 0=Sun..6=Sat
  const daysSinceMon = (day + 6) % 7;    // Mon=0
  const thisMon = new Date(d); thisMon.setDate(d.getDate() - daysSinceMon);
  const lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7);
  const lastSun = new Date(thisMon); lastSun.setDate(thisMon.getDate() - 1); lastSun.setHours(23,59,59,999);
  return { start: lastMon, end: lastSun };
}

/**
 * Рендер дашборда по роли
 * @param {{ID?: string, Email?: string, role: string, Name?: string, name?: string, email?: string}} user
 */
export async function renderDashboard(user) {
  const userName = user?.Name || user?.name || user?.Email || user?.email || 'Пользователь';
  const role     = String(user?.role || '').toLowerCase();
  const app      = document.getElementById('app');

  // Очистка контейнера
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

  app.append(toolbar);

  // Лоадер
  const loader = createLoader('Загружаем данные…');
  app.append(loader);

  try {
    console.log('renderDashboard, user:', user);
    console.log('renderDashboard, role:', role);

    // --- Грузим данные. Пытаемся получить users_lastweek (если бэкенд поддерживает)
    const [deptRes, usersRes, lastWeekResOrErr] = await Promise.all([
      apiGetProgress('department'),
      apiGetProgress('users'),
      apiGetProgress('users_lastweek').catch(err => {
        console.warn('[dashboard] users_lastweek не поддержан или ошибка:', err?.message || err);
        return null;
      })
    ]);

    // Убираем лоадер
    loader.remove();

    console.log('RAW deptRes:', deptRes);
    console.log('RAW usersRes:', usersRes);
    if (lastWeekResOrErr) console.log('RAW users_lastweek:', lastWeekResOrErr);

    // Распаковка
    const deptData = deptRes?.data ?? deptRes;             // объект: { monthPercent, ... }
    const usersRaw = usersRes?.data ?? usersRes;           // массив всех пользователей (текущие week/month)
    const lastWeekRaw = lastWeekResOrErr
      ? (lastWeekResOrErr?.data ?? lastWeekResOrErr)       // массив пользователей за прошлую неделю
      : null;

    // Списки сотрудников
    const allUsers = Array.isArray(usersRaw) ? usersRaw : [];
    const employeesAll = allUsers.filter(u => String(u.role || '').toLowerCase() === 'employee');

    const lastWeekUsers = Array.isArray(lastWeekRaw) ? lastWeekRaw : [];
    const employeesLastWeek = lastWeekUsers.filter(u => String(u.role || '').toLowerCase() === 'employee');

    console.log('usersArr.length:', allUsers.length);
    console.log('employees (all) .length:', employeesAll.length);
    if (lastWeekRaw) {
      console.log('employees (last week) .length:', employeesLastWeek.length);
    }

    /* === 1) Прогресс отдела (месяц) === */
    const deptSection = document.createElement('section');
    deptSection.id = 'dept-section';

    const deptTitle = document.createElement('h3');
    deptTitle.textContent = 'Прогресс отдела (месяц)';
    deptSection.append(deptTitle);

    const monthPercent = Number(deptData?.monthPercent ?? 0);
    deptSection.append(createProgressBar(monthPercent, 'department'));
    app.append(deptSection);

    /* === 2) Лидерборды === */
    // 2.1 ТОП-3 за прошлую неделю (если есть данные; иначе — используем текущую нед.)
    const leaderWeek = document.createElement('section');
    leaderWeek.id = 'leader-week';

    const h4Week = document.createElement('h4');
    h4Week.textContent = 'ТОП-3 за неделю';

    const cap = document.createElement('div');
    cap.className = 'kpi-caption';
    const { start, end } = getLastFullWeekRange();
    cap.textContent = `за прошлую неделю (Пн ${formatDM(start)} — Вс ${formatDM(end)})`;

    // Источник данных для ТОП-3 «неделя»: предпочитаем прошлую неделю, если бэкенд вернул массив
    const dataForWeekTop = employeesLastWeek.length ? employeesLastWeek : employeesAll;

    leaderWeek.append(h4Week, cap, createLeaderboard(dataForWeekTop, 'week'));
    app.append(leaderWeek);
    console.log('CAPTION ADDED:', cap.textContent);

    // 2.2 ТОП-3 за месяц (используем весь массив сотрудников)
    const leaderMonth = document.createElement('section');
    leaderMonth.id = 'leader-month';

    const h4Month = document.createElement('h4');
    h4Month.textContent = 'ТОП-3 за месяц';

    leaderMonth.append(h4Month, createLeaderboard(employeesAll, 'month'));
    app.append(leaderMonth);

    /* === 3) Таблица пользователей === */
    const tableSection = document.createElement('section');
    tableSection.id = 'users-table';

    const tableTitle = document.createElement('h4');
    tableTitle.textContent = 'Сотрудники и баллы';

    tableSection.append(tableTitle, createUsersTable(employeesAll));
    app.append(tableSection);

    /* === 4) Admin-панель — только для admin === */
    if (role === 'admin') {
      if (employeesAll.length) {
        console.log('Отрисовываем Admin-панель');
        const adminModule = await import('./admin-panel.js');
        app.append(adminModule.createAdminPanel(employeesAll));
      } else {
        console.warn('Admin-панель не показана: список сотрудников пуст или не получен.');
      }
    }

    // Лог события просмотра
    try { await logEvent('dashboard_view', { email: user?.email || user?.Email }); } catch {}

  } catch (err) {
    // Снимем лоадер, если ещё висит
    try { loader.remove(); } catch {}
    console.error('Ошибка при рендере дашборда:', err);
    const alert = document.createElement('div');
    alert.className = 'alert alert-danger';
    alert.textContent = 'Не удалось загрузить дашборд. Подробности в консоли.';
    app.append(alert);
    throw err;
  }
}

// ВАЖНО: без auto-DOMContentLoaded. renderDashboard вызывается из auth.js
