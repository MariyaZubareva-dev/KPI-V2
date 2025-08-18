// js/admin-panel.js
import {
  getProgress,          // для получения списка KPI пользователя (scope=user)
  recordKPI,
  logEvent,
  listProgress,
  deleteProgress
} from './api.js';

function ymd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Создаёт Admin-панель: отметка KPI + история/удаление отметок
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

  // --- выбор пользователя ---
  const rowSel = document.createElement('div');
  rowSel.className = 'row g-3 align-items-end';

  const colUser = document.createElement('div'); colUser.className = 'col-12 col-md-4';
  const labelUser = document.createElement('label'); labelUser.className = 'form-label'; labelUser.textContent = 'Сотрудник';
  const select = document.createElement('select'); select.id = 'user-select'; select.className = 'form-select';
  employees.forEach(u => {
    const opt = document.createElement('option');
    opt.value = String(u.id);
    opt.textContent = u.name ?? u.email ?? String(u.id);
    select.appendChild(opt);
  });
  colUser.append(labelUser, select);

  // --- дата отметки (по умолчанию сегодня) ---
  const colDate = document.createElement('div'); colDate.className = 'col-12 col-md-3';
  const labelDate = document.createElement('label'); labelDate.className = 'form-label'; labelDate.textContent = 'Дата отметки';
  const dateInp = document.createElement('input'); dateInp.type = 'date'; dateInp.className = 'form-control'; dateInp.value = ymd();
  colDate.append(labelDate, dateInp);

  const colRefresh = document.createElement('div'); colRefresh.className = 'col-12 col-md-2';
  const btnReload = document.createElement('button'); btnReload.className = 'btn btn-outline-secondary w-100'; btnReload.textContent = 'Обновить';
  colRefresh.append(btnReload);

  rowSel.append(colUser, colDate, colRefresh);
  container.appendChild(rowSel);

  // KPI список
  const kpiWrap = document.createElement('div');
  kpiWrap.className = 'mt-4';
  container.appendChild(kpiWrap);

  // История последних отметок
  const histTitle = document.createElement('h4');
  histTitle.className = 'mt-5';
  histTitle.textContent = 'Последние отметки';
  container.appendChild(histTitle);

  const histWrap = document.createElement('div');
  container.appendChild(histWrap);

  // загрузчики
  async function renderKpisFor(userId) {
    kpiWrap.innerHTML = `
      <div class="d-flex align-items-center gap-2 my-2">
        <div class="spinner-border" role="status" aria-hidden="true"></div>
        <span>Загружаем KPI…</span>
      </div>
    `;

    try {
      const res = await getProgress('user', userId);
      const kpis = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      kpis.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));

      const list = document.createElement('div');
      list.className = 'list-group';

      if (!kpis.length) {
        kpiWrap.innerHTML = `<div class="text-secondary">Для пользователя нет KPI.</div>`;
        return;
      }

      kpis.forEach(kpi => {
        const item = document.createElement('div');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';

        const left = document.createElement('div');
        left.innerHTML = `<strong>${kpi.name}</strong> <span class="text-secondary">(${kpi.weight})</span> ` +
          (kpi.done ? `<span class="badge text-bg-success ms-2">выполнено на этой неделе</span>` : '');

        const right = document.createElement('div');
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-primary';
        btn.textContent = 'Отметить';
        btn.addEventListener('click', async () => {
          // кто отмечает
          let actorEmail = '';
          try { const u = JSON.parse(localStorage.getItem('user') || '{}'); actorEmail = u?.email || u?.Email || ''; } catch {}

          btn.disabled = true;
          try {
            await recordKPI({
              userID: String(userId),
              kpiId: String(kpi.KPI_ID),
              actorEmail,
              date: dateInp.value || ymd()
            });
            try { await logEvent('kpi_recorded', { userID: String(userId), kpiId: String(kpi.KPI_ID), score: kpi.weight, actorEmail, date: dateInp.value || ymd() }); } catch {}
            await renderKpisFor(userId);
            await renderHistoryFor(userId);
            document.dispatchEvent(new CustomEvent('kpi:recorded', { detail: { userID: String(userId), kpiId: String(kpi.KPI_ID) } }));
          } catch (e) {
            console.error('Ошибка записи KPI:', e);
            alert('Не удалось записать KPI (см. консоль).');
          } finally {
            btn.disabled = false;
          }
        });

        right.appendChild(btn);
        item.append(left, right);
        list.appendChild(item);
      });

      kpiWrap.innerHTML = '';
      kpiWrap.appendChild(list);
    } catch (err) {
      console.error('Ошибка загрузки KPI пользователя:', err);
      kpiWrap.innerHTML = `<div class="alert alert-danger">Не удалось загрузить список KPI.</div>`;
    }
  }

  async function renderHistoryFor(userId) {
    histWrap.innerHTML = `
      <div class="d-flex align-items-center gap-2 my-2">
        <div class="spinner-border" role="status" aria-hidden="true"></div>
        <span>Загружаем историю…</span>
      </div>
    `;
    try {
      const rows = await listProgress({ userID: String(userId), limit: 50 });
      const arr = Array.isArray(rows?.data) ? rows.data : (Array.isArray(rows) ? rows : []);
      if (!arr.length) {
        histWrap.innerHTML = `<div class="text-secondary">Пока нет отметок.</div>`;
        return;
      }

      const table = document.createElement('table');
      table.className = 'table table-sm align-middle';
      table.innerHTML = `
        <thead>
          <tr>
            <th style="width:110px">Дата</th>
            <th>Задача</th>
            <th style="width:90px">Баллы</th>
            <th style="width:90px"></th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector('tbody');

      arr.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${r.date}</td>
          <td>${r.kpi_name}</td>
          <td>${r.score}</td>
          <td class="text-end">
            <button class="btn btn-outline-danger btn-sm">Удалить</button>
          </td>
        `;
        const delBtn = tr.querySelector('button');
        delBtn.addEventListener('click', async () => {
          if (!confirm('Удалить отметку?')) return;
          let actorEmail = '';
          try { const u = JSON.parse(localStorage.getItem('user') || '{}'); actorEmail = u?.email || u?.Email || ''; } catch {}
          delBtn.disabled = true;
          try {
            await deleteProgress({ id: String(r.id), actorEmail });
            try { await logEvent('kpi_progress_deleted', { id: r.id, userID: r.user_id, actorEmail }); } catch {}
            await renderKpisFor(userId);
            await renderHistoryFor(userId);
            document.dispatchEvent(new CustomEvent('kpi:recorded'));
          } catch (e) {
            console.error('Ошибка удаления отметки:', e);
            alert('Не удалось удалить отметку.');
          } finally {
            delBtn.disabled = false;
          }
        });

        tbody.appendChild(tr);
      });

      histWrap.innerHTML = '';
      histWrap.appendChild(table);
    } catch (err) {
      console.error('Ошибка загрузки истории:', err);
      histWrap.innerHTML = `<div class="alert alert-danger">Не удалось загрузить историю.</div>`;
    }
  }

  // события
  const refreshAll = () => {
    const uid = select.value;
    if (!uid) {
      kpiWrap.innerHTML = `<div class="text-secondary">Нет сотрудников с ролью employee.</div>`;
      histWrap.innerHTML = '';
      return;
    }
    renderKpisFor(uid);
    renderHistoryFor(uid);
  };

  select.addEventListener('change', refreshAll);
  btnReload.addEventListener('click', refreshAll);

  // начальная загрузка
  if (employees.length) {
    select.value = String(employees[0].id);
    refreshAll();
  } else {
    kpiWrap.innerHTML = `<div class="text-secondary">Нет сотрудников с ролью employee.</div>`;
  }

  return container;
}
