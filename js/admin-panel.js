// js/admin-panel.js
import { recordKPI, getProgress, logEvent } from './api.js';

const currentUser = (() => {
  try { return JSON.parse(localStorage.getItem('user')) || null; } catch { return null; }
})();

/**
 * Создаёт Admin-панель для отметок KPI
 * @param {Array<{id: string|number, name: string, email?: string}>} usersData
 * @returns {HTMLElement}
 */
export function createAdminPanel(usersData = []) {
  const container = document.createElement('section');
  container.id = 'admin-panel';
  container.classList.add('mt-5');

  const title = document.createElement('h3');
  title.textContent = 'Admin-панель: отметка KPI';
  container.appendChild(title);

  // селектор сотрудников
  const select = document.createElement('select');
  select.id = 'user-select';
  select.className = 'form-select mb-3';
  (usersData || []).forEach(u => {
    const option = document.createElement('option');
    option.value = String(u.id || u.ID || u.Email);
    option.textContent = u.name || u.Name || u.Email;
    select.append(option);
  });
  container.appendChild(select);

  // место под KPI
  const kpiList = document.createElement('div');
  kpiList.id = 'kpi-list';
  container.appendChild(kpiList);

  // обработчики
  select.addEventListener('change', () => {
    loadKpisForUser(select.value, kpiList);
  });

  // первичная загрузка
  if (usersData.length) {
    select.value = select.options[0].value;
    loadKpisForUser(select.value, kpiList);
  }

  return container;
}

/**
 * Запрашивает KPI выбранного пользователя и рендерит список
 * @param {string} userID
 * @param {HTMLElement} container
 */
async function loadKpisForUser(userID, container) {
  container.innerHTML = 'Загружаем KPI…';

  // Берём KPI за текущую неделю для отметок (как и прежде)
  const res = await getProgress('user', userID);
  const kpis = res?.data ?? res; // [{ KPI_ID, name, weight, done }]

  container.innerHTML = '';
  (kpis || []).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)).forEach(kpi => {
    const wrap = document.createElement('label');
    wrap.className = 'd-flex align-items-center gap-2 mb-2';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.kpiId = String(kpi.KPI_ID);
    cb.dataset.weight = String(kpi.weight ?? 0);
    cb.disabled = !!kpi.done;
    cb.checked = !!kpi.done;

    const text = document.createElement('span');
    text.textContent = `${kpi.name} (${kpi.weight})`;

    wrap.append(cb, text);
    container.appendChild(wrap);

    cb.addEventListener('change', async () => {
      // мягкий блок — сразу блокируем, чтобы избежать дабл-кликов
      cb.disabled = true;

      try {
        // 1) пишем KPI
        await recordKPI({
          userID,
          kpiId: kpi.KPI_ID,
          score: kpi.weight,
          date: undefined // сегодня
        });

        // 2) логируем событие (с указанием, кто отметил)
        try {
          await logEvent('kpi_recorded', {
            userID,
            kpiId: kpi.KPI_ID,
            score: kpi.weight,
            actorEmail: currentUser?.email || currentUser?.Email || ''
          });
        } catch {}

        // 3) локально перерисовываем список KPI (актуализируем "done")
        await loadKpisForUser(userID, container);

        // 4) триггерим событие для дашборда — он сам обновит метрики/таблицы
        window.dispatchEvent(new CustomEvent('kpi:recorded', {
          detail: { userID, kpiId: kpi.KPI_ID, score: kpi.weight }
        }));
      } catch (err) {
        console.error('Ошибка записи KPI:', err);
        cb.disabled = false;
        cb.checked = false;
        alert('Не удалось записать KPI. Подробности — в консоли.');
      }
    });
  });
}
