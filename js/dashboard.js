import { getProgress as apiGetProgress, logEvent } from './api.js';
import { createProgressBar, createUsersTable, createLeaderboard, createLoader } from './ui-components.js';

/** Даты прошлой полной недели (Пн–Вс) */
function getLastFullWeekBounds(refDate) {
  const now = refDate ? new Date(refDate) : new Date();
  const day = now.getDay(); // 0=Sun ... 1=Mon
  // найти понедельник ТЕКУЩЕЙ недели
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const mondayThis = new Date(now);
  mondayThis.setDate(now.getDate() + diffToMonday);
  mondayThis.setHours(0,0,0,0);

  // предыдущий понедельник и воскресенье
  const start = new Date(mondayThis);
  start.setDate(start.getDate() - 7);
  start.setHours(0,0,0,0);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23,59,59,999);

  return { start, end };
}

function formatDateDM(d){
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  return `${dd}.${mm}`;
}

/**
 * Рендер дашборда по роли
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
  logoutBtn.className = 'btn btn-outline-primary btn-sm';
  logoutBtn.textContent = 'Выйти';
  logoutBtn.addEventListener('click', async () => {
    try { await logEvent('logout', { email: user?.email || user?.Email }); } catch {}
    localStorage.removeItem('user');
    location.reload();
  });
  toolbar.appendChild(logoutBtn);
  app.append(toolbar);

  // лоадер
  const loader = createLoader('Загружаем данные…');
  app.append(loader);

  try {
    console.log('renderDashboard, user:', user);
    console.log('renderDashboard, role:', role);

    // Получаем: отдел, сотрудники (текущие week/month), сотрудники за прошлую неделю
    const [deptRes, usersCurrRes, usersPrevWeekRes] = await Promise.all([
      apiGetProgress('department'),
      apiGetProgress('users'),
      apiGetProgress('users_lastweek'),
    ]);

    loader.remove();

    const deptData = deptRes?.data ?? deptRes;
    const usersCurr = Array.isArray(usersCurrRes?.data) ? usersCurrRes.data
                    : Array.isArray(usersCurrRes) ? usersCurrRes : [];
    const usersPrevWeek = Array.isArray(usersPrevWeekRes?.data) ? usersPrevWeekRes.data
                         : Array.isArray(usersPrevWeekRes) ? usersPrevWeekRes : [];

    // Фильтруем только сотрудников
    const employeesCurr = usersCurr.filter(u => String(u.role || '').toLowerCase() === 'employee');
    const employeesPrev = usersPrevWeek.filter(u => String(u.role || '').toLowerCase() === 'employee');

    // === 1) Прогресс отдела (месяц)
    const deptSection = document.createElement('section');
    deptSection.id = 'dept-section';
    const deptTitle = document.createElement('h3');
    deptTitle.textContent = 'Прогресс отдела (месяц)';
    deptSection.append(deptTitle);
    const monthPercent = Number(deptData?.monthPercent ?? 0);
    deptSection.append(createProgressBar(monthPercent, 'department'));
    app.append(deptSection);

    // === 2) ТОП-3 за прошлую неделю (с подписью периода)
    const leaderWeek = document.createElement('section');
    leaderWeek.id = 'leader-week';
    const h4Week = document.createElement('h4');
    h4Week.textContent = 'ТОП-3 за неделю';
    leaderWeek.append(h4Week);

    const { start, end } = getLastFullWeekBounds(new Date());
    const caption = document.createElement('div');
    caption.className = 'caption';
    caption.textContent = `за прошлую неделю (Пн ${formatDateDM(start)} — Вс ${formatDateDM(end)})`;
    leaderWeek.append(caption);

    leaderWeek.append(createLeaderboard(employeesPrev, 'week'));
    app.append(leaderWeek);

    // === 3) ТОП-3 за месяц (текущий месяц по ТЗ)
    const leaderMonth = document.createElement('section');
    leaderMonth.id = 'leader-month';
    const h4Month = document.createElement('h4');
    h4Month.textContent = 'ТОП-3 за месяц';
    leaderMonth.append(h4Month);
    leaderMonth.append(createLeaderboard(employeesCurr, 'month'));
    app.append(leaderMonth);

    // === 4) Таблица сотрудников (текущие данные)
    const tableSection = document.createElement('section');
    tableSection.id = 'users-table';
    const tableTitle = document.createElement('h4');
    tableTitle.textContent = 'Сотрудники и баллы';
    tableSection.append(tableTitle, createUsersTable(employeesCurr));
    app.append(tableSection);

    // === 5) Admin-панель (если есть сотрудники)
    if (role === 'admin') {
      if (employeesCurr.length) {
        console.log('Отрисовываем Admin-панель');
        const adminModule = await import('./admin-panel.js');
        app.append(adminModule.createAdminPanel(employeesCurr));
      } else {
        console.warn('Admin-панель не показана: нет сотрудников.');
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
