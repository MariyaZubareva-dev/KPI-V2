// js/admin-panel.js
import { recordKPI, getProgress, logEvent } from './api.js';

export function createAdminPanel(usersData) {
  const container = document.createElement('section');
  container.id = 'admin-panel';
  container.classList.add('mt-5');

  const title = document.createElement('h3');
  title.textContent = 'Admin-панель: отметка KPI';
  container.appendChild(title);

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

  const kpiList = document.createElement('div');
  kpiList.id = 'kpi-list';
  container.appendChild(kpiList);

  select.addEventListener('change', () => {
    loadKpisForUser(select.value, kpiList);
  });

  if (select.options.length) {
    select.value = select.options[0].value;
    loadKpisForUser(select.value, kpiList);
  }

  return container;
}

async function loadKpisForUser(userID, container) {
  container.innerHTML = 'Загрузка KPI…';

  try {
    const raw = await getProgress('user', userID);
    const kpis = Array.isArray(raw) ? raw : (raw?.data ?? []);

    container.innerHTML = '';

    const current = JSON.parse(localStorage.getItem('user') || '{}');
    const actorEmail = current.email || current.Email || '';

    kpis
      .slice()
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
      .forEach(kpi => {
        const label = document.createElement('label');
        label.className = 'd-block mb-2';
        label.innerHTML = `
          <input type="checkbox" ${kpi.done ? 'checked disabled' : ''}>
          ${kpi.name} <span class="text-tertiary">(${kpi.weight})</span>
        `;
        const checkbox = label.querySelector('input');

        checkbox.addEventListener('change', async () => {
          checkbox.disabled = true;
          try {
            await recordKPI({ userID, kpiId: kpi.KPI_ID, score: kpi.weight, actorEmail });

            await logEvent('kpi_recorded', { userID, kpiId: kpi.KPI_ID, score: kpi.weight, actorEmail });

            // Сообщаем дашборду, что данные изменились
            window.dispatchEvent(new CustomEvent('kpi-updated', {
              detail: { userID, kpiId: kpi.KPI_ID, score: kpi.weight }
            }));

            // Перерисовываем список KPI пользователя
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
