// js/admin-panel.js
import {
  getProgress,
  recordKPI,
  logEvent,
  listProgress,
  deleteProgress,
} from './api.js';

/**
 * Создаёт Admin-панель: выбор сотрудника, отметка KPI, история отметок (с удалением)
 * @param {Array<{id:number, name:string, email:string, role:string}>} usersData
 */
export function createAdminPanel(usersData = []) {
  const employees = Array.isArray(usersData)
    ? usersData.filter(u => String(u.role || '').toLowerCase() === 'employee')
    : [];

  const container = document.createElement('section');
  container.id = 'admin-panel';
  container.className = 'mt-5';

  const title = document.createElement('h3');
  title.textContent = 'Admin-панель';
  container.appendChild(title);

  // Выбор пользователя
  const selectWrap = document.createElement('div');
  selectWrap.className = 'mb-3';

  const selectLbl = document.createElement('label');
  selectLbl.className = 'form-label';
  selectLbl.textContent = 'Сотрудник';

  const select = document.createElement('select');
  select.id = 'user-select';
  select.className = 'form-select';

  employees.forEach(u => {
    const opt = document.createElement('option');
    opt.value = String(u.id ?? u.ID ?? u.Email ?? u.email);
    opt.textContent = u.name ?? u.Name ?? u.Email ?? u.email ?? String(u.id);
    select.appendChild(opt);
  });

  selectWrap.append(selectLbl, select);
  container.appendChild(selectWrap);

  // KPI-list + История — два блока
  const blocks = document.createElement('div');
  blocks.className = 'row g-4';

  const colLeft = document.createElement('div');
  colLeft.className = 'col-12 col-lg-6';
  const kpiCard = document.createElement('div');
  kpiCard.className = 'card';
  kpiCard.innerHTML = `
    <div class="card-body">
      <h5 class="card-title">Отметка KPI</h5>
      <div id="kpi-list"></div>
    </div>
  `;
  colLeft.appendChild(kpiCard);

  const colRight = document.createElement('div');
  colRight.className = 'col-12 col-lg-6';
  const histCard = document.createElement('div');
  histCard.className = 'card';
  histCard.innerHTML = `
    <div class="card-body">
      <div class="d-flex justify-content-between align-items-center">
        <h5 class="card-title mb-0">История отметок</h5>
        <small class="text-secondary">последние 50</small>
      </div>
      <div id="history-list" class="mt-3"></div>
    </div>
  `;
  colRight.appendChild(histCard);

  blocks.append(colLeft, colRight);
  container.appendChild(blocks);

  // поведение
  const kpiList = kpiCard.querySelector('#kpi-list');
  const histList = histCard.querySelector('#history-list');

  const refreshAll = async () => {
    const uid = select.value;
    await Promise.all([
      loadKpisForUser(uid, kpiList),
      renderHistoryFor(uid, histList),
    ]);
  };

  select.addEventListener('change', refreshAll);

  if (employees.length) {
    select.value = select.options[0].value;
    refreshAll();
  } else {
    kpiList.innerHTML = `<div class="text-secondary">Нет сотрудников с ролью employee.</div>`;
    histList.innerHTML = `<div class="text-secondary">Нет данных.</div>`;
  }

  return container;
}

/** Рендерит список KPI для пользователя (с чекбоксами отметки) */
async function loadKpisForUser(targetUserId, container) {
  container.innerHTML = spinner('Загружаем KPI…');

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
    list.className = 'd-flex flex-column gap-2';

    kpis.forEach(kpi => {
      const row = document.createElement('label');
      row.className = 'd-flex align-items-center justify-content-between gap-3';

      const left = document.createElement('div');
      left.className = 'd-flex align-items-center gap-2';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.kpiId = String(kpi.KPI_ID);
      input.dataset.weight = String(kpi.weight ?? 0);
      input.disabled = !!kpi.done; // пока действуют ограничения «раз в неделю»
      input.checked = !!kpi.done;

      const name = document.createElement('span');
      name.textContent = `${kpi.name} (${kpi.weight})`;

      left.append(input, name);

      const right = document.createElement('div');
      if (kpi.done) {
        const badge = document.createElement('span');
        badge.className = 'badge text-bg-success';
        badge.textContent = 'выполнено (эта неделя)';
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

          // обновим KPI-лист и историю, дернём дашборд
          await loadKpisForUser(targetUserId, container);
          await renderHistoryFor(targetUserId, document.querySelector('#history-list'));

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

/** История отметок с удалением */
async function renderHistoryFor(userID, container) {
  container.innerHTML = spinner('Загружаем историю…');
  try {
    const resp = await listProgress({ userID, limit: 50 });
    const rows = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);

    container.innerHTML = '';
    if (!rows.length) {
      container.innerHTML = `<div class="text-secondary">История пустая.</div>`;
      return;
    }

    const table = document.createElement('table');
    table.className = 'table table-sm align-middle';
    table.innerHTML = `
      <thead>
        <tr>
          <th style="width: 110px;">Дата</th>
          <th>Задача</th>
          <th style="width: 90px;">Баллы</th>
          <th style="width: 1%; white-space: nowrap;"></th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    rows.forEach(r => {
      const tr = document.createElement('tr');
      const d = r.date; // 'YYYY-MM-DD'
      tr.innerHTML = `
        <td>${formatRuDate(d)}</td>
        <td>${escapeHtml(r.kpi_name)}</td>
        <td>${Number(r.score ?? 0)}</td>
        <td>
          <button class="btn btn-sm btn-outline-danger">Удалить</button>
        </td>
      `;
      const btn = tr.querySelector('button');
      btn.addEventListener('click', async () => {
        if (!confirm('Удалить отметку?')) return;

        let actorEmail = '';
        try {
          const u = JSON.parse(localStorage.getItem('user') || '{}');
          actorEmail = u?.email || u?.Email || '';
        } catch {}

        try {
          await deleteProgress({ id: r.id, actorEmail });

          try { await logEvent('progress_deleted_ui', { id: r.id, userID, actorEmail }); } catch {}

          // Обновляем историю и уведомляем дашборд
          await renderHistoryFor(userID, container);
          document.dispatchEvent(new CustomEvent('kpi:recorded'));
        } catch (e) {
          console.error('Ошибка удаления отметки:', e);
          alert('Не удалось удалить отметку (нужны права admin).');
        }
      });

      tbody.appendChild(tr);
    });

    container.appendChild(table);
  } catch (err) {
    console.error('Ошибка загрузки истории:', err);
    container.innerHTML = `<div class="alert alert-danger">Не удалось загрузить историю.</div>`;
  }
}

/* ---------- утилиты ---------- */
function spinner(text) {
  return `
    <div class="d-flex align-items-center gap-2 my-2">
      <div class="spinner-border" role="status" aria-hidden="true"></div>
      <span>${text}</span>
    </div>
  `;
}
function formatRuDate(iso) {
  if (!iso) return '-';
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
