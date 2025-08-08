import { getProgress } from './api.js';
import { createProgressBar, createUsersTable, createLeaderboard } from './ui-components.js';

/**
 * Загружает и рендерит дашборд в зависимости от роли
 * @param {{ID: string, Email: string, role: string, Name: string}} user
 */
export async function renderDashboard(user) {
  const { role, ID: userID, Name: userName } = user;
  const app = document.getElementById('app');
  app.innerHTML = ''; // очистить предыдущий контент

  // Заголовок
  const title = document.createElement('h2');
  title.textContent = `Добро пожаловать, ${userName}!`;
  app.append(title);

  // 1. Получаем данные департамента и пользователей параллельно
  const [deptData, usersData] = await Promise.all([
    getProgress('department'),
    getProgress('users')
  ]);

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
  leaderWeek.append(document.createElement('h4')).textContent = 'ТОП-3 за неделю';
  leaderWeek.append(createLeaderboard(usersData, 'week'));
  app.append(leaderWeek);

  const leaderMonth = document.createElement('section');
  leaderMonth.id = 'leader-month';
  leaderMonth.append(document.createElement('h4')).textContent = 'ТОП-3 за месяц';
  leaderMonth.append(createLeaderboard(usersData, 'month'));
  app.append(leaderMonth);

  // 4. Таблица пользователей
  const tableSection = document.createElement('section');
  tableSection.id = 'users-table';
  tableSection.append(document.createElement('h4')).textContent = 'Сотрудники и баллы';
  tableSection.append(createUsersTable(usersData));
  app.append(tableSection);

  // 5. Admin-панель только для админа
  if (role === 'admin') {
    const adminModule = await import('./admin-panel.js');
    app.append(adminModule.createAdminPanel(usersData));
  }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (user) {
    renderDashboard(user).catch(err => console.error(err));
  }
});
