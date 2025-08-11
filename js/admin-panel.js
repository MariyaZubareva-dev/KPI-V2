// js/admin-panel.js
import { recordKPI, getProgress, logEvent } from './api.js';

/**
 * Админ-панель: сама грузит сотрудников и KPI
 */
export function createAdminPanel() {
  const container = document.createElement('section');
  container.id = 'admin-panel';
  container.className = 'mt-5';

  const title = document.createElement('h3');
  title.textContent = 'Admin-панель: отметка KPI';
  container.append(title);

  // Селектор сотрудника
  const selectWrap = document.createElement('div');
  selectWrap.className = 'mb-3';
  const select = document.createElement('select');
  select.id = 'user-select';
  select.className = 'form-select';
  selectWrap.append(select);
  container.append(selectWrap);

  // Контейнер KPI
  const kpiList = document.createElement('div');
  kpiList.id = 'kpi-list';
  container.append(kpiList);

  // Смена сотрудника -> перезагрузить KPI
  select.addEventListener('change', () => {
    select.setAttribute('data-selected', select.value);
    loadKpisForUser(select.value, kpiList);
  });

  // Первичная загрузка сотрудников
  loadEmployees(select, kpiList);

  return container;
}

/** Подтягивает сотрудников и заполняет селект */
async function loadEmployees(select, kpiList) {
  select.innerHTML = '';
  kpiList.textContent = 'Загрузка сотрудников…';

  try {
    const users = await getProgress('users'); // api.js уже нормализует в массив
    const employees = (Array.isArray(users) ? users : [])
      .filter(u => String(u.role || '').toLowerCase() === 'employee' && (u.active === undefined || u.active));

    // Сортировка по имени
    employees.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru', { sensitivity: 'base' }));

    if (!employees.length) {
      kpiList.innerHTML = '<div class="text-secondary">Нет сотрудников с ролью employee.</div>';
      return;
    }

    // Заполняем селект
    for (const u of employees) {
      const opt = document.createElement('option');
      opt.value = String(u.id ?? u.ID ?? u.Email ?? u.email ?? '');
      opt.textContent = u.name ?? u.Name ?? u.email ?? u.Email ?? '(без имени)';
      select.append(opt);
    }

    // Выбираем предыдущего/первого
    const prev = select.getAttribute('data-selected');
    if (prev && [...select.options].some(o => o.value === prev)) {
      select.value = prev;
    } else {
      select.value = select.options[0].value;
    }

    // Загружаем KPI выбранного сотрудника
    await loadKpisForUser(select.value, kpiList);
  } catch (err) {
    console.error('Ошибка загрузки сотрудников:', err);
    kpiList.innerHTML = '<div class="text-danger">Не удалось загрузить список сотрудников.</div>';
  }
}

/** Загружает и рендерит KPI выбранного сотрудника */
async function loadKpisForUser(userID, container) {
  container.innerHTML = 'Загрузка KPI…';
  try {
    const raw = await getProgress('user', userID);
    const kpis = Array.isArray(raw) ? raw : (raw?.data ?? []);

    const current = JSON.parse(localStorage.getItem('user') || '{}');
    const actorEmail = current.email || current.Email || '';

    container.innerHTML = '';

    kpis
      .slice()
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)) // по убыванию веса
      .forEach(kpi => {
        const row = document.createElement('label');
        row.className = 'd-block mb-2';
        row.innerHTML = `
          <input type="checkbox" ${kpi.done ? 'checked disabled' : ''}>
          ${kpi.name} <span class="text-tertiary">(${kpi.weight})</span>
        `;
        const input = row.querySelector('input');

        input.addEventListener('change', async () => {
          input.disabled = true;
          try {
            await recordKPI({ userID, kpiId: kpi.KPI_ID, score: kpi.weight, actorEmail });
            await logEvent('kpi_recorded', { userID, kpiId: kpi.KPI_ID, score: kpi.weight, actorEmail });

            // Сообщаем дашборду, чтобы он обновил прогрессы и таблицы
            window.dispatchEvent(new CustomEvent('kpi-updated', {
              detail: { userID, kpiId: kpi.KPI_ID, score: kpi.weight }
            }));

            // Обновляем список KPI для этого юзера
            await loadKpisForUser(userID, container);
          } catch (err) {
            console.error('Ошибка записи KPI:', err);
            alert('Не удалось записать KPI. Детали — в консоли.');
            input.checked = false;
            input.disabled = false;
          }
        });

        container.append(row);
      });

    if (!kpis.length) {
      const empty = document.createElement('div');
      empty.className = 'text-secondary';
      empty.textContent = 'Нет KPI для этого пользователя.';
      container.append(empty);
    }
  } catch (err) {
    console.error('Ошибка загрузки KPI:', err);
    container.innerHTML = '<div class="text-danger">Не удалось загрузить KPI.</div>';
  }
}
