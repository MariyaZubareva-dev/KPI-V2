// js/admin-panel.js
import {
  getProgress,
  recordKPI,
  logEvent,
  listProgress,
  deleteProgress,
} from './api.js';

/**
 * Создаёт Admin-панель: выбор сотрудника, отметка KPI (задним числом, многократно),
 * история отметок (с удалением)
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

  // Выбор сотрудника
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

  // Два столбца: слева отметка KPI, справа история
  const blocks = document.createElement('div');
  blocks.className = 'row g-4';

  // ЛЕВЫЙ столбец
  const colLeft = document.createElement('div');
  colLeft.className = 'col-12 col-lg-6';

  const kpiCard = document.createElement('div');
  kpiCard.className = 'card';
  kpiCard.innerHTML = `
    <div class="card-body">
      <h5 class="card-title">Отметка KPI</h5>

      <div class="row g-2 align-items-end mb-3">
        <div class="col-12 col-sm-6">
          <label for="mark-date" class="form-label mb-1">Дата отметки</label>
          <input type="date" id="mark-date" class="form-control" />
        </div>
        <div class="col-12 col-sm-6">
          <small class="text-secondary">
            По умолчанию — сегодня. Можно менять для «задним числом».
          </small>
        </div>
      </div>

      <div id="kpi-list"></div>
    </div>
  `;
  colLeft.appendChild(kpiCard);

  // ПРАВЫЙ столбец
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

  // refs
  const kpiList = kpiCard.querySelector('#kpi-list');
  const histList = histCard.querySelector('#history-list');
  const markDateInput = kpiCard.querySelector('#mark-date');

  // Установим сегодняшнюю дату
  markDateInput.value = todayISO();

  // Общий рефреш: KPI + История
  const refreshAll = async () => {
    const uid = select.value;
    await Promise.all([
      loadKpisForUser(uid, kpiList, () => markDateInput.value),
      renderHistoryFor(uid, histList),
    ]);
  };

  select.addEventListener('change', refreshAll);
  markDateInput.addEventListener('change', () => {
    // дата влияет только на будущие добавления, но перерисуем KPI на всякий
    loadKpisForUser(select.value, kpiList, () => markDateInput.value);
  });

  if (employees.length) {
    select.value = select.options[0].value;
    refreshAll();
  } else {
    kpiList.innerHTML = `<div class="text-secondary">Нет сотрудников с ролью employee.</div>`;
    histList.innerHTML = `<div class="text-secondary">Нет данных.</div>`;
  }

  return container;
}

/** Рендерит список KPI для пользователя с кнопкой «Добавить» и счётчиком за неделю */
async function loadKpisForUser(targetUserId, container, getSelectedDate) {
  container.innerHTML = spinner('Загружаем KPI…');

  try {
    // 1) KPI-список
    const res = await getProgress('user', targetUserId);
    const kpis = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    kpis.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));

    // 2) Счётчики за текущую неделю по каждому KPI
    const { start, end } = thisWeekBounds();
    const histResp = await listProgress({
      userID: targetUserId,
      from: start,
      to: end,
      limit: 500,
    });
    const weekRows = Array.isArray(histResp?.data) ? histResp.data : [];
    const counts = new Map(); // kpi_id -> count
    weekRows.forEach(r => {
      const id = String(r.kpi_id);
      counts.set(id, (counts.get(id) || 0) + 1);
    });

    container.innerHTML = '';
    if (!kpis.length) {
      container.innerHTML = `<div class="text-secondary">Для пользователя нет KPI.</div>`;
      return;
    }

    const list = document.createElement('div');
    list.className = 'd-flex flex-column gap-2';

    kpis.forEach(kpi => {
      const kpiId = String(kpi.KPI_ID);
      const weekCount = counts.get(kpiId) || 0;

      const row = document.createElement('div');
      row.className = 'd-flex align-items-center justify-content-between gap-3';

      const left = document.createElement('div');
      left.className = 'd-flex flex-column';

      const name = document.createElement('div');
      name.innerHTML = `<strong>${escapeHtml(kpi.name)}</strong> <span class="text-secondary">(${Number(kpi.weight)})</span>`;

      const sub = document.createElement('small');
      sub.className = 'text-secondary';
      sub.textContent = `Эта неделя: ${weekCount}`;

      left.append(name, sub);

      const right = document.createElement('div');
      const addBtn = document.createElement('button');
      addBtn.className = 'btn btn-primary btn-sm';
      addBtn.textContent = 'Добавить';
      addBtn.addEventListener('click', async () => {
        addBtn.disabled = true;

        // кто отмечает
        let actorEmail = '';
        try {
          const u = JSON.parse(localStorage.getItem('user') || '{}');
          actorEmail = u?.email || u?.Email || '';
        } catch {}

        // дата отметки
        const iso = normalizeISODate(getSelectedDate?.());
        try {
          await recordKPI({
            userID: String(targetUserId),
            kpiId: kpiId,
            actorEmail,
            date: iso, // задним числом/сегодня
          });

          try {
            await logEvent('kpi_recorded', {
              userID: String(targetUserId),
              kpiId,
              score: kpi.weight,
              actorEmail,
              date: iso,
            });
          } catch {}

          // обновим список KPI (счётчики) и историю
          await loadKpisForUser(targetUserId, container, getSelectedDate);
          const histEl = document.querySelector('#history-list');
          if (histEl) await renderHistoryFor(targetUserId, histEl);

          // и дёрнем обновление дашборда
          document.dispatchEvent(new CustomEvent('kpi:recorded', {
            detail: { userID: String(targetUserId), kpiId }
          }));
        } catch (err) {
          console.error('Ошибка записи KPI:', err);
          alert('Не удалось записать KPI. Подробности — в консоли.');
        } finally {
          addBtn.disabled = false;
        }
      });

      right.append(addBtn);
      row.append(left, right);
      list.appendChild(row);
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
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function normalizeISODate(v) {
  // ожидаем YYYY-MM-DD; если пусто/битое — сегодня
  if (typeof v !== 'string') return todayISO();
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? v : todayISO();
}
function thisWeekBounds() {
  const now = new Date();
  const day = now.getDay(); // 0..6, 0==Sun
  const monday = new Date(now);
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0,0,0,0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23,59,59,999);

  return {
    start: isoDate(monday),
    end: isoDate(sunday),
  };
}
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
