// js/admin-panel.js
import { getProgress, recordKPI, logEvent } from './api.js';

/**
 * Создаёт Admin-панель для отметки KPI
 * @param {Array<{id:string|number, name:string, email:string, role:string}>} usersData
 */
export function createAdminPanel(usersData = []) {
  const employees = Array.isArray(usersData)
    ? usersData.filter(u => String(u.role || '').toLowerCase() === 'employee')
    : [];

  const container = document.createElement('section');
  container.id = 'admin-panel';
  container.className = 'mt-5';

  const title = document.createElement('h3');
  title.textContent = 'Admin-панель: отметка KPI';
  container.appendChild(title);

  const selectWrap = document.createElement('div');
  selectWrap.className = 'mb-3';
  const select = document.createElement('select');
  select.id = 'user-select';
  select.className = 'form-select';
  employees.forEach(u => {
    const opt = document.createElement('option');
    opt.value = String(u.id ?? u.ID ?? u.Email ?? u.email);
    opt.textContent = u.name ?? u.Name ?? u.Email ?? u.email ?? String(u.id);
    select.appendChild(opt);
  });
  selectWrap.appendChild(select);
  container.appendChild(selectWrap);

  const kpiList = document.createElement('div');
  kpiList.id = 'kpi-list';
  container.appendChild(kpiList);

  select.addEventListener('change', () => {
    loadKpisForUser(select.value, kpiList);
  });

  if (employees.length) {
    select.value = select.options[0].value;
    loadKpisForUser(select.value, kpiList);
  } else {
    kpiList.innerHTML = `<div class="text-secondary">Нет сотрудников с ролью employee.</div>`;
  }

  return container;
}

/** Рендерит список KPI для пользователя */
async function loadKpisForUser(targetUserId, container) {
  container.innerHTML = `
    <div class="d-flex align-items-center gap-2 my-2">
      <div class="spinner-border" role="status" aria-hidden="true"></div>
      <span>Загружаем KPI…</span>
    </div>
  `;

  try {
    const res = await getProgress('user', targetUserId);
    const kpis = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);

    kpis.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));

    container.innerHTML = '';
    if (!kpis.length) {
      container.innerHTML = `<div class="text-secondary">Для пользователя нет KPI.</div>`;
      return;
    }

    const list = document.createElement('div');
    kpis.forEach(kpi => {
      const row = document.createElement('label');
      row.className = 'd-flex align-items-center justify-content-between mb-2 gap-3';

      const left = document.createElement('div');
      left.className = 'd-flex align-items-center gap-2';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.kpiId = String(kpi.KPI_ID);
      input.dataset.weight = String(kpi.weight ?? 0);
      input.disabled = !!kpi.done;
      input.checked = !!kpi.done;

      const name = document.createElement('span');
      name.textContent = `${kpi.name} (${kpi.weight})`;

      left.append(input, name);

      const right = document.createElement('div');
      if (kpi.done) {
        const badge = document.createElement('span');
        badge.className = 'badge text-bg-success';
        badge.textContent = 'выполнено';
        right.appendChild(badge);
      }

      row.append(left, right);
      list.appendChild(row);

      input.addEventListener('change', async () => {
        if (!input.checked) return;
        input.disabled = true;

        // кто отмечает
        let actorEmail = '';
        try {
          const u = JSON.parse(localStorage.getItem('user') || '{}');
          actorEmail = u?.email || u?.Email || '';
        } catch {}

        try {
          await recordKPI({
            userID: String(targetUserId),
            kpiId: String(kpi.KPI_ID),
            actorEmail
          });

          try {
            await logEvent('kpi_recorded', {
              userID: String(targetUserId),
              kpiId: String(kpi.KPI_ID),
              score: kpi.weight,
              actorEmail
            });
          } catch {}

          await loadKpisForUser(targetUserId, container);

          // уведомим дашборд
          document.dispatchEvent(new CustomEvent('kpi:recorded', {
            detail: { userID: String(targetUserId), kpiId: String(kpi.KPI_ID) }
          }));
        } catch (err) {
          console.error('Ошибка записи KPI:', err);
          alert('Не удалось записать KPI. Подробности — в консоли.');
          input.checked = false;
          input.disabled = false;
        }
      });
    });

    container.appendChild(list);
  } catch (err) {
    console.error('Ошибка загрузки KPI пользователя:', err);
    container.innerHTML = `<div class="alert alert-danger">Не удалось загрузить список KPI.</div>`;
  }
}
