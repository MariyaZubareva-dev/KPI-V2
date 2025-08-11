// js/admin-panel.js
import { recordKPI, getProgress, logEvent } from './api.js';

/**
 * Создаёт Admin-панель для отметок KPI
 * @param {Array<{id: string|number, name: string, Email?: string, email?: string}>} usersData
 * @returns {HTMLElement}
 */
export function createAdminPanel(usersData) {
  const container = document.createElement('section');
  container.id = 'admin-panel';
  container.classList.add('mt-5');

  const title = document.createElement('h3');
  title.textContent = 'Admin-панель: отметка KPI';
  container.appendChild(title);

  // селектор пользователя
  const select = document.createElement('select');
  select.id = 'user-select';
  select.className = 'form-select mb-3';
  (usersData || []).forEach(u => {
    const option = document.createElement('option');
    option.value = u.id || u.ID || u.Email;
    option.textContent = u.name || u.Name || u.Email;
    select.append(option);
  });
  container.appendChild(select);

  // сюда рендерим список KPI
  const kpiList = document.createElement('div');
  kpiList.id = 'kpi-list';
  container.appendChild(kpiList);

  // реакция на смену пользователя
  select.addEventListener('change', () => {
    loadKpisForUser(select.value, kpiList);
  });

  // первичная загрузка
  if (select.options.length) {
    select.value = select.options[0].value;
    loadKpisForUser(select.value, kpiList);
  }

  return container;
}

/**
 * Загружает и рендерит список KPI для выбранного пользователя
 * @param {string|number} userID
 * @param {HTMLElement} container
 */
async function loadKpisForUser(userID, container) {
  container.innerHTML = 'Загрузка KPI…';

  try {
    const raw = await getProgress('user', userID);
    // API гарантирует массив KPI или обёртку {data:[]}
    const kpis = Array.isArray(raw) ? raw : (raw?.data ?? []);

    container.innerHTML = '';

    // кто ставит отметку (для бэкенд-авторизации)
    const current = JSON.parse(localStorage.getItem('user') || '{}');
    const actorEmail = current.email || current.Email || '';

    // сортировка по весу (убывание)
    kpis
      .slice()
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
      .forEach(kpi => {
        const label = document.createElement('label');
        label.className = 'd-block mb-2';
        label.innerHTML = `
          <input type="checkbox"
                 ${kpi.done ? 'checked disabled' : ''}
                 aria-label="Отметить KPI"
          >
          ${kpi.name} <span class="text-tertiary">(${kpi.weight})</span>
        `;

        const checkbox = label.querySelector('input');
        checkbox.addEventListener('change', async () => {
          checkbox.disabled = true;
          try {
            await recordKPI({
              userID,
              kpiId: kpi.KPI_ID,
              score: kpi.weight,
              actorEmail // ← ОБЯЗАТЕЛЬНО передаём
            });

            await logEvent('kpi_recorded', {
              userID,
              kpiId: kpi.KPI_ID,
              score: kpi.weight,
              actorEmail
            });

            // перерисовываем список KPI
            await loadKpisForUser(userID, container);
          } catch (err) {
            console.error('Ошибка записи KPI:', err);
            alert('Не удалось записать KPI. Подробности — в консоли.');
            checkbox.checked = false;
            checkbox.disabled = false;
          }
        });

        container.appendChild(label);
      });

    if (!kpis.length) {
      const empty = document.createElement('div');
      empty.className = 'text-secondary';
      empty.textContent = 'Для пользователя нет KPI.';
      container.appendChild(empty);
    }
  } catch (err) {
    console.error('Ошибка загрузки KPI пользователя:', err);
    container.innerHTML = '<div class="text-danger">Не удалось загрузить KPI.</div>';
  }
}
