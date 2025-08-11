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
  select.classList.add('form-select', 'mb-3');
  usersData.forEach(u => {
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

  if (usersData.length) {
    select.value = select.options[0].value;
    loadKpisForUser(select.value, kpiList);
  }

  return container;
}

async function loadKpisForUser(userID, container) {
  container.innerHTML = 'Загрузка KPI…';

  const res = await getProgress('user', userID);
  const kpis = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);

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
      try {
        checkbox.disabled = true;
        await recordKPI({ userID, kpiId: kpi.KPI_ID, score: kpi.weight });
        await loadKpisForUser(userID, container);
        await logEvent('kpi_recorded', {
          userID,
          kpiId: kpi.KPI_ID,
          score: kpi.weight
        });
        // Обновим общий дашборд простым способом
        window.location.reload();
      } catch (e) {
        console.error('Ошибка записи KPI:', e);
        checkbox.disabled = false;
        alert('Не удалось записать KPI');
      }
    });
    container.appendChild(label);
  });
}
