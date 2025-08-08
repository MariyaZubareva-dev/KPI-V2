// js/admin-panel.js

import { recordKPI, getProgress } from './api.js';

/**
 * Создаёт Admin-панель для отметок KPI
 * @param {Array<{id: string, name: string}>} usersData
 * @returns {HTMLElement}
 */
export function createAdminPanel(usersData) {
  const container = document.createElement('section');
  container.id = 'admin-panel';
  container.classList.add('mt-5');

  // Заголовок
  const title = document.createElement('h3');
  title.textContent = 'Admin-панель: отметка KPI';
  container.appendChild(title);

  // Селектор пользователей
  const select = document.createElement('select');
  select.id = 'user-select';
  select.classList.add('form-select', 'mb-3');
  usersData.forEach(u => {
    const option = document.createElement('option');
    option.value = u.id || u.ID || u.Email;
    option.textContent = u.name || u.Name || u.Email;
    select.append(option);
  });
  container.appendChild(select);

  // Контейнер для списка KPI
  const kpiList = document.createElement('div');
  kpiList.id = 'kpi-list';
  container.appendChild(kpiList);

  // Обработчик смены пользователя
  select.addEventListener('change', () => {
    loadKpisForUser(select.value, kpiList);
  });

  // Инициално загрузим для первого пользователя
  if (usersData.length) {
    select.value = select.options[0].value;
    loadKpisForUser(select.value, kpiList);
  }

  return container;
}

/**
 * Загружает и рендерит список KPI для пользователя
 * @param {string} userID
 * @param {HTMLElement} container
 */
async function loadKpisForUser(userID, container) {
  container.innerHTML = 'Загрузка KPI…';

  // Получаем прогресс по конкретному пользователю
  const res = await getProgress('user', userID);
  // Ожидаем res.data — массив объектов { KPI_ID, name, weight, done }
  const kpis = res.data; // если сервер возвращает иначе, адаптируйте

  // Рендерим чек-боксы
  container.innerHTML = '';
  kpis.forEach(kpi => {
    const label = document.createElement('label');
    label.classList.add('d-block', 'mb-2');
    label.innerHTML = `
      <input type="checkbox"
             data-kpi-id="${kpi.KPI_ID}"
             data-weight="${kpi.weight}"
             ${kpi.done ? 'checked disabled' : ''}>
      ${kpi.name} (${kpi.weight})
    `;
    const checkbox = label.querySelector('input');
    checkbox.addEventListener('change', async () => {
      checkbox.disabled = true;
      await recordKPI(userID, kpi.KPI_ID, kpi.weight, kpi.week);
      // После записи обновляем и список, и дашборд
      await loadKpisForUser(userID, container);
      window.location.reload(); // простой способ обновить дашборд
    });
    container.appendChild(label);
  });
}
