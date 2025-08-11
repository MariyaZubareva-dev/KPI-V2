import { getProgress } from './api.js';
import { createProgressBar, createUsersTable, createLeaderboard } from './ui-components.js';

/**
 * Загружает и рендерит дашборд в зависимости от роли
 * @param {{ID: string, Email: string, role: string, Name: string}} user
 */
export async function renderDashboard(user) {
  const userName = user.Name || user.name || user.Email || 'Пользователь';
  const role     = user.role;
  const userID   = user.ID || user.Email;
  console.log('renderDashboard, user:', user);
  console.log('renderDashboard, role:', role);
  const app = document.getElementById('app');
  app.innerHTML = ''; // очистить предыдущий контент

  // Заголовок
  const title = document.createElement('h2');
  title.textContent = `Добро пожаловать, ${userName}!`;
  app.append(title);

  // 1. Получаем данные департамента и пользователей параллельно
  const [deptRes, usersRes] = await Promise.all([
    getProgress('department'),
    getProgress('users')
  ]);

  const deptData = deptRes.data || deptRes;
  const usersData = usersRes.data || usersRes;
  // Показываем в UI только сотрудников с ролью employee
  const employees = (usersData || []).filter(
    u => String(u.role || '').toLowerCase() === 'employee'
  );

  // 2. Рендер общего прогресса
  const deptSection = document.createElement('section');
  deptSection.id = 'dept-section';
  const deptTitle = document.createElement('h3');
  deptTitle.textContent = 'Прогресс отдела (неделя)';
  deptSection.append(deptTitle);
  deptSection.append(createProgressBar(deptData.weekPercent, 'department'));
  app.append(deptSection);

  // 3. Лидерборды
  const leaderWeek = document.createElement('section');
  leaderWeek.id = 'leader-week';
  const h4Week = document.createElement('h4');
  h4Week.textContent = 'ТОП-3 за неделю';
  leaderWeek.append(h4Week);
  leaderWeek.append(createLeaderboard(employees, 'week'));
  app.append(leaderWeek);
  
  const leaderMonth = document.createElement('section');
  leaderMonth.id = 'leader-month';
  const h4Month = document.createElement('h4');
  h4Month.textContent = 'ТОП-3 за месяц';
  leaderMonth.append(h4Month);
  leaderMonth.append(createLeaderboard(employees, 'month'));
  app.append(leaderMonth);

  // 4. Таблица пользователей
  const tableSection = document.createElement('section');
  tableSection.id = 'users-table';
  const tableTitle = document.createElement('h4');
  tableTitle.textContent = 'Сотрудники и баллы';
  tableSection.append(tableTitle);
  tableSection.append(createUsersTable(usersData));
  app.append(tableSection);

  // 5. Admin-панель только для админа
  if (role === 'admin') {
    console.log('Отрисовываем Admin-панель');
    const adminModule = await import('./admin-panel.js');
    app.append(adminModule.createAdminPanel(employees));
  }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (user) {
    renderDashboard(user).catch(err => console.error(err));
  }
});
