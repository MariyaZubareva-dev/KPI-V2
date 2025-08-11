import { getProgress as apiGetProgress, logEvent } from './api.js';
import { createProgressBar, createUsersTable, createLeaderboard, createLoader } from './ui-components.js';

/**
 * Рендер дашборда по роли
 * @param {{ID?: string, Email?: string, role: string, Name?: string, name?: string, email?: string}} user
 */
// utils наверху файла (или внутри renderDashboard перед использованием)
function formatDM(d){
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  return `${dd}.${mm}`;
}
function getLastFullWeekRange(){
  const now = new Date();
  const day = now.getDay(); // 0=Sun..6=Sat
  const daysSinceMon = (day + 6) % 7; // Mon=0
  const thisMon = new Date(now); thisMon.setDate(now.getDate() - daysSinceMon); thisMon.setHours(0,0,0,0);
  const lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7);
  const lastSun = new Date(thisMon); lastSun.setDate(thisMon.getDate() - 1); lastSun.setHours(23,59,59,999);
  return { start: lastMon, end: lastSun };
}
export async function renderDashboard(user) {
  const userName = user?.Name || user?.name || user?.Email || user?.email || 'Пользователь';
  const role     = String(user?.role || '').toLowerCase();
  const app      = document.getElementById('app');

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

  const loader = createLoader('Загружаем данные…');
  app.append(loader);

  try {
    console.log('renderDashboard, user:', user);
    console.log('renderDashboard, role:', role);

    // Благодаря нормализации в api.js:
    const deptData = await apiGetProgress('department'); // объект
    const usersArr = await apiGetProgress('users', { period: 'prev_week' });      // массив

    loader.remove();

    console.log('RAW deptRes:', deptData);
    console.log('RAW usersRes:', usersArr);
    console.log('usersArr.length:', Array.isArray(usersArr) ? usersArr.length : 'not array');

    const employees = Array.isArray(usersArr)
      ? usersArr.filter(u => String(u?.role ?? '').trim().toLowerCase() === 'employee')
      : [];

    console.log('employees.length:', employees.length);

    // 1) Прогресс отдела (месяц)
    const deptSection = document.createElement('section');
    deptSection.id = 'dept-section';
    const deptTitle = document.createElement('h3');
    deptTitle.textContent = 'Прогресс отдела (месяц)';
    deptSection.append(deptTitle);
    const monthPercent = Number(deptData?.monthPercent ?? 0);
    deptSection.append(createProgressBar(monthPercent, 'department'));
    app.append(deptSection);

    // 2) Лидерборды
    const leaderWeek = document.createElement('section');
    leaderWeek.id = 'leader-week';
    const h4Week = document.createElement('h4');
    h4Week.textContent = 'ТОП-3 за неделю';
    const cap = document.createElement('div');
    cap.className = 'kpi-caption';
    const { start, end } = getLastFullWeekRange();
    cap.textContent = `за прошлую неделю (Пн ${formatDM(start)} — Вс ${formatDM(end)})`;
    leaderWeek.append(h4Week, createLeaderboard(employees, 'week'));
    app.append(leaderWeek);

    const leaderMonth = document.createElement('section');
    leaderMonth.id = 'leader-month';
    const h4Month = document.createElement('h4');
    h4Month.textContent = 'ТОП-3 за месяц';
    leaderMonth.append(h4Month, createLeaderboard(employees, 'month'));
    app.append(leaderMonth);

    // 3) Таблица пользователей
    const tableSection = document.createElement('section');
    tableSection.id = 'users-table';
    const tableTitle = document.createElement('h4');
    tableTitle.textContent = 'Сотрудники и баллы';
    tableSection.append(tableTitle, createUsersTable(employees));
    app.append(tableSection);

    // 4) Admin-панель
    if (role === 'admin') {
      if (employees.length) {
        console.log('Отрисовываем Admin-панель');
        const adminModule = await import('./admin-panel.js');
        app.append(adminModule.createAdminPanel(employees));
      } else {
        console.warn('Admin-панель не показана: список сотрудников пуст или не получен.');
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

// ВАЖНО: без auto-инициализации. Вызов делаем из auth.js после логина.
