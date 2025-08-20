// js/admin-panel.js
import {
  getProgress,
  recordKPI,
  logEvent,
  listProgress,
  deleteProgress,
  kpiList,
  kpiCreate,
  kpiUpdate,
  kpiDelete,
  // ← добавили API настроек
  settingsGet,
  settingsSet
} from './api.js';

/**
 * Admin-панель (отметка KPI, история, CRUD задач, настройки)
 * @param {Array<{id:number, name:string, email:string, role:string}>} usersData
 */
export function createAdminPanel(usersData = []) {
  const employees = Array.isArray(usersData)
    ? usersData.filter(u => String(u.role || '').toLowerCase() === 'employee')
    : [];

  // корневой контейнер
  const container = document.createElement('section');
  container.id = 'admin-panel';
  container.className = 'mt-5';

  // заголовок
  const title = document.createElement('h3');
  title.textContent = 'Admin-панель';
  container.appendChild(title);

  // === Панель управления (выбор пользователя и даты) ===
  const controlsCard = document.createElement('div');
  controlsCard.className = 'card mb-4';
  controlsCard.innerHTML = `
    <div class="card-body">
      <div class="row g-3 align-items-end">
        <div class="col-12 col-md-5">
          <label class="form-label mb-1">Сотрудник</label>
          <select class="form-select" id="ap-user"></select>
        </div>
        <div class="col-8 col-md-3">
          <label class="form-label mb-1">Дата отметки</label>
          <input type="date" class="form-control" id="ap-date" />
        </div>
        <div class="col-4 col-md-2 d-grid">
          <button class="btn btn-outline-secondary" id="ap-refresh">Обновить</button>
        </div>
      </div>
    </div>
  `;
  container.appendChild(controlsCard);

  const userSel  = controlsCard.querySelector('#ap-user');
  const dateInp  = controlsCard.querySelector('#ap-date');
  const refreshBtn = controlsCard.querySelector('#ap-refresh');

  // заполнение списка сотрудников
  userSel.innerHTML = '';
  if (employees.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Нет сотрудников с ролью employee';
    userSel.appendChild(opt);
  } else {
    employees.forEach(u => {
      const opt = document.createElement('option');
      opt.value = String(u.id);
      opt.textContent = u.name ?? u.email ?? (`ID ${u.id}`);
      userSel.appendChild(opt);
    });
  }

  // дефолтная дата — сегодня
  dateInp.valueAsDate = new Date();

  // выберем первого сотрудника по умолчанию
  if (employees.length) userSel.value = String(employees[0].id);

  // === Основной двухколоночный блок: слева KPI, справа История ===
  const twoCol = document.createElement('div');
  twoCol.className = 'row';

  // Левая колонка — список KPI / отметка
  const colLeft = document.createElement('div');
  colLeft.className = 'col-12 col-lg-6';
  colLeft.innerHTML = `
    <div class="card">
      <div class="card-body">
        <h5 class="card-title mb-3">Отметить KPI</h5>
        <div id="ap-kpi-list"></div>
      </div>
    </div>
  `;

  // Правая колонка — история
  const colRight = document.createElement('div');
  colRight.className = 'col-12 col-lg-6';
  colRight.innerHTML = `
    <div class="card">
      <div class="card-body">
        <h5 class="card-title mb-3">История отметок</h5>
        <div class="row g-2 mb-2">
          <div class="col-6">
            <input type="date" class="form-control" id="ap-hist-from" placeholder="с (необязательно)"/>
          </div>
          <div class="col-6">
            <input type="date" class="form-control" id="ap-hist-to" placeholder="по (необязательно)"/>
          </div>
          <div class="col-12 d-flex gap-2">
            <button class="btn btn-outline-secondary btn-sm" id="ap-hist-apply">Применить фильтр</button>
            <button class="btn btn-outline-secondary btn-sm" id="ap-hist-clear">Сбросить</button>
          </div>
        </div>
        <div id="ap-history"></div>
      </div>
    </div>
  `;

  twoCol.append(colLeft, colRight);
  container.appendChild(twoCol);

  // === CRUD задач (KPI) ===
  const kpiCrudCard = document.createElement('div');
  kpiCrudCard.className = 'card mt-4';
  kpiCrudCard.innerHTML = `
    <div class="card-body">
      <h5 class="card-title mb-3">Задачи (KPI)</h5>

      <div class="border rounded p-3 mb-3">
        <div class="row g-2 align-items-end">
          <div class="col-12 col-md-6">
            <label class="form-label mb-1">Название новой задачи</label>
            <input type="text" class="form-control" id="kpi-new-name" placeholder="Например: Отправить недельный отчёт" />
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label mb-1">Баллы</label>
            <input type="number" step="0.01" min="0.01" class="form-control" id="kpi-new-weight" placeholder="0.25" />
          </div>
          <div class="col-6 col-md-3 d-grid">
            <button class="btn btn-success" id="kpi-new-add">Создать</button>
          </div>
        </div>
      </div>

      <div id="kpi-crud-list"></div>
    </div>
  `;
  container.appendChild(kpiCrudCard);

  // === НАСТРОЙКИ (глобальная цель) ===
  const settingsCard = document.createElement('div');
  settingsCard.className = 'card mt-4';
  settingsCard.innerHTML = `
    <div class="card-body">
      <h5 class="card-title mb-3">Настройки</h5>
      <div class="row g-2 align-items-end">
        <div class="col-8 col-md-4">
          <label class="form-label mb-1">Глобальная цель на месяц (баллы)</label>
          <input type="number" step="1" min="1" class="form-control" id="set-month-goal" placeholder="100" />
        </div>
        <div class="col-4 col-md-2 d-grid">
          <button class="btn btn-primary" id="set-month-goal-save">Сохранить</button>
        </div>
        <div class="col-12 col-md-6 text-secondary small">
          Цель используется для верхнего прогресс-бара отдела: % = текущие баллы / цель × 100%.
        </div>
      </div>
    </div>
  `;
  container.appendChild(settingsCard);

  // refs
  const kpiListBox   = colLeft.querySelector('#ap-kpi-list');
  const histBox      = colRight.querySelector('#ap-history');
  const histFromInp  = colRight.querySelector('#ap-hist-from');
  const histToInp    = colRight.querySelector('#ap-hist-to');
  const histApplyBtn = colRight.querySelector('#ap-hist-apply');
  const histClearBtn = colRight.querySelector('#ap-hist-clear');

  const kpiCrudList  = kpiCrudCard.querySelector('#kpi-crud-list');
  const kpiNewName   = kpiCrudCard.querySelector('#kpi-new-name');
  const kpiNewWeight = kpiCrudCard.querySelector('#kpi-new-weight');
  const kpiAddBtn    = kpiCrudCard.querySelector('#kpi-new-add'); // ← одно объявление

  const goalInput = settingsCard.querySelector('#set-month-goal');
  const goalSave  = settingsCard.querySelector('#set-month-goal-save');

  // === Вспомогательные ===
  function getActorEmail() {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      return (u?.email || u?.Email || '').toLowerCase();
    } catch { return ''; }
  }
  function fmtDateInputValue(d) {
    if (!(d instanceof Date)) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // === Рендер списка KPI для отметки ===
  async function renderKpiListFor(userId) {
    kpiListBox.innerHTML = `
      <div class="d-flex align-items-center gap-2 my-2">
        <div class="spinner-border" role="status" aria-hidden="true"></div>
        <span>Загружаем KPI…</span>
      </div>
    `;
    try {
      const res = await getProgress('user', String(userId));
      const kpis = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      kpis.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));

      const selectedDate = dateInp.value || fmtDateInputValue(new Date());
      kpiListBox.innerHTML = '';

      if (!kpis.length) {
        kpiListBox.innerHTML = `<div class="text-secondary">Для пользователя нет KPI.</div>`;
        return;
      }

      const list = document.createElement('div');
      list.className = 'list-group';

      kpis.forEach(kpi => {
        const row = document.createElement('div');
        row.className = 'list-group-item d-flex align-items-center justify-content-between';

        const left = document.createElement('div');
        left.className = 'd-flex flex-column';
        const nm = document.createElement('div');
        nm.innerHTML = `<strong>${kpi.name}</strong>`;
        const sub = document.createElement('div');
        sub.className = 'text-secondary small';
        sub.textContent = `Баллы: ${kpi.weight} ${kpi.done ? ' • уже отмечено на этой неделе' : ''}`;
        left.append(nm, sub);

        const right = document.createElement('div');
        right.className = 'd-flex align-items-center gap-2';

        const dateHint = document.createElement('span');
        dateHint.className = 'text-secondary small d-none d-md-inline';
        dateHint.textContent = `дата: ${selectedDate}`;

        const btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-sm';
        btn.textContent = 'Отметить';

        btn.addEventListener('click', async () => {
          const actorEmail = getActorEmail();
          if (!actorEmail) { alert('Нет email администратора (перелогиньтесь).'); return; }
          btn.disabled = true;
          try {
            await recordKPI({
              userID: String(userId),
              kpiId: String(kpi.KPI_ID),
              actorEmail,
              date: dateInp.value || selectedDate, // «задним числом»
            });

            try {
              await logEvent('kpi_recorded_ui', {
                userID: String(userId),
                kpiId: String(kpi.KPI_ID),
                score: kpi.weight,
                actorEmail,
                date: dateInp.value || selectedDate,
              });
            } catch {}

            // обновляем KPI-список (флаг done может поменяться) и историю
            await Promise.all([
              renderKpiListFor(userId),
              renderHistoryFor(userId),
            ]);

            // уведомим дашборд
            document.dispatchEvent(new CustomEvent('kpi:recorded', {
              detail: { userID: String(userId), kpiId: String(kpi.KPI_ID) }
            }));
          } catch (e) {
            console.error(e);
            alert('Не удалось записать KPI. Подробности — в консоли.');
          } finally {
            btn.disabled = false;
          }
        });

        right.append(dateHint, btn);
        row.append(left, right);
        list.appendChild(row);
      });

      kpiListBox.appendChild(list);
    } catch (e) {
      console.error('Ошибка загрузки KPI пользователя:', e);
      kpiListBox.innerHTML = `<div class="alert alert-danger">Не удалось загрузить список KPI.</div>`;
    }
  }

  // === История отметок ===
  async function renderHistoryFor(userId) {
    histBox.innerHTML = `
      <div class="d-flex align-items-center gap-2 my-2">
        <div class="spinner-border" role="status" aria-hidden="true"></div>
        <span>Загружаем историю…</span>
      </div>
    `;
    try {
      const params = {
        userID: String(userId),
        from: histFromInp.value || undefined,
        to:   histToInp.value   || undefined,
        limit: 50,
      };
      const resp = await listProgress(params);
      const rows = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);

      histBox.innerHTML = '';
      if (!rows.length) {
        histBox.innerHTML = `<div class="text-secondary">Пока нет записей.</div>`;
        return;
      }

      const table = document.createElement('table');
      table.className = 'table table-sm table-striped align-middle';
      table.innerHTML = `
        <thead>
          <tr>
            <th style="width:115px;">Дата</th>
            <th>Задача</th>
            <th style="width:90px;">Баллы</th>
            <th style="width:1%; white-space:nowrap;"></th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector('tbody');

      rows.forEach(r => {
        const tr = document.createElement('tr');

        const tdDate = document.createElement('td');
        tdDate.textContent = r.date;

        const tdName = document.createElement('td');
        tdName.textContent = r.kpi_name || `KPI #${r.kpi_id}`;

        const tdScore = document.createElement('td');
        tdScore.textContent = r.score ?? '';

        const tdBtn = document.createElement('td');
        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-outline-danger btn-sm';
        delBtn.textContent = 'Удалить';
        tdBtn.appendChild(delBtn);

        delBtn.addEventListener('click', async () => {
          if (!confirm('Удалить отметку? Действие необратимо.')) return;
          const actorEmail = getActorEmail();
          if (!actorEmail) { alert('Нет email администратора (перелогиньтесь).'); return; }
          delBtn.disabled = true;
          try {
            await deleteProgress({ id: r.id, actorEmail });
            try { await logEvent('progress_deleted_ui', { id: r.id, actorEmail }); } catch {}
            await Promise.all([
              renderHistoryFor(userId),
              renderKpiListFor(userId), // на случай, если удалили отметку текущей недели
            ]);
            document.dispatchEvent(new CustomEvent('kpi:recorded')); // чтобы дашборд пересчитался
          } catch (e) {
            console.error(e);
            alert('Не удалось удалить запись.');
          } finally {
            delBtn.disabled = false;
          }
        });

        tr.append(tdDate, tdName, tdScore, tdBtn);
        tbody.appendChild(tr);
      });

      histBox.appendChild(table);
    } catch (e) {
      console.error('Ошибка загрузки истории:', e);
      histBox.innerHTML = `<div class="alert alert-danger">Не удалось загрузить историю.</div>`;
    }
  }

  // === CRUD: список KPI с редактированием ===
  async function renderKpiCrudList(container) {
    container.innerHTML = `
      <div class="d-flex align-items-center gap-2 my-2">
        <div class="spinner-border" role="status" aria-hidden="true"></div>
        <span>Загружаем задачи…</span>
      </div>
    `;
    try {
      const rows = await kpiList({ includeInactive: true });
      container.innerHTML = '';

      if (!rows.length) {
        container.innerHTML = `<div class="text-secondary">Список задач пуст.</div>`;
        return;
      }

      const table = document.createElement('table');
      table.className = 'table table-sm align-middle';
      table.innerHTML = `
        <thead>
          <tr>
            <th>Название</th>
            <th style="width:120px;">Баллы</th>
            <th style="width:120px;">Активна</th>
            <th style="width:1%; white-space:nowrap;"></th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector('tbody');

      rows.forEach(r => {
        const tr = document.createElement('tr');

        const nameTd = document.createElement('td');
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'form-control';
        nameInput.value = r.name || '';
        nameTd.appendChild(nameInput);

        const wTd = document.createElement('td');
        const wInput = document.createElement('input');
        wInput.type = 'number';
        wInput.step = '0.01';
        wInput.min = '0.01';
        wInput.className = 'form-control';
        wInput.value = String(r.weight ?? 0);
        wTd.appendChild(wInput);

        const actTd = document.createElement('td');
        const actSwitch = document.createElement('input');
        actSwitch.type = 'checkbox';
        actSwitch.className = 'form-check-input';
        actSwitch.checked = !!r.active;
        actTd.appendChild(actSwitch);

        const btnTd = document.createElement('td');
        btnTd.className = 'd-flex gap-2';
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-primary btn-sm';
        saveBtn.textContent = 'Сохранить';
        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-outline-danger btn-sm';
        delBtn.textContent = 'Деактивировать';

        btnTd.append(saveBtn, delBtn);

        tr.append(nameTd, wTd, actTd, btnTd);
        tbody.appendChild(tr);

        saveBtn.addEventListener('click', async () => {
          const name = String(nameInput.value || '').trim();
          const weightNum = Number(wInput.value);
          const active = !!actSwitch.checked;
          if (!name || !Number.isFinite(weightNum) || weightNum <= 0) {
            alert('Проверьте название и баллы (> 0).');
            return;
          }
          const actorEmail = getActorEmail();
          if (!actorEmail) { alert('Нет email администратора (перелогиньтесь).'); return; }

          saveBtn.disabled = delBtn.disabled = true;
          try {
            await kpiUpdate({ id: r.id, name, weight: weightNum, active, actorEmail });
            try { await logEvent('kpi_updated_ui', { id: r.id, name, weightNum, active, actorEmail }); } catch {}
            await renderKpiCrudList(container);
            document.dispatchEvent(new CustomEvent('kpi:changed'));
          } catch (e) {
            console.error(e);
            alert('Не удалось сохранить KPI (нужны права admin).');
          } finally {
            saveBtn.disabled = delBtn.disabled = false;
          }
        });

        delBtn.addEventListener('click', async () => {
          if (!confirm('Сделать KPI неактивным? История останется, но задача пропадёт из активных.')) return;
          const actorEmail = getActorEmail();
          if (!actorEmail) { alert('Нет email администратора (перелогиньтесь).'); return; }

          saveBtn.disabled = delBtn.disabled = true;
          try {
            await kpiDelete({ id: r.id, actorEmail });
            try { await logEvent('kpi_deleted_ui', { id: r.id, actorEmail }); } catch {}
            await renderKpiCrudList(container);
            document.dispatchEvent(new CustomEvent('kpi:changed'));
          } catch (e) {
            console.error(e);
            alert('Не удалось деактивировать KPI (нужны права admin).');
          } finally {
            saveBtn.disabled = delBtn.disabled = false;
          }
        });
      });

      container.appendChild(table);
    } catch (e) {
      console.error(e);
      container.innerHTML = `<div class="alert alert-danger">Ошибка загрузки списка KPI.</div>`;
    }
  }

  // === Настройки: загрузка и сохранение цели ===
  async function loadSettings() {
    try {
      const r = await settingsGet('month_goal');
      const v = Number(r?.value ?? r ?? 100);
      goalInput.value = String(v > 0 ? Math.round(v) : 100);
    } catch (e) {
      console.error('settingsGet failed', e);
      goalInput.value = '100';
    }
  }

  goalSave.addEventListener('click', async () => {
    const actorEmail = getActorEmail();
    if (!actorEmail) { alert('Нет email администратора (перелогиньтесь).'); return; }
    let v = Number(goalInput.value);
    if (!Number.isFinite(v) || v <= 0) { alert('Укажите цель > 0'); return; }
    v = Math.round(v);
    goalSave.disabled = true;
    try {
      await settingsSet('month_goal', String(v), actorEmail);
      try { await logEvent('settings_updated_ui', { key: 'month_goal', value: v, actorEmail }); } catch {}
      // уведомим дашборд — он перезагрузит агрегаты
      document.dispatchEvent(new CustomEvent('settings:changed', { detail: { key: 'month_goal', value: v }}));
    } catch (e) {
      console.error(e);
      alert('Не удалось сохранить цель.');
    } finally {
      goalSave.disabled = false;
    }
  });

  // === События и первичная отрисовка ===
  async function refreshAll() {
    const userId = userSel.value;
    await Promise.all([
      renderKpiListFor(userId),
      renderHistoryFor(userId),
      renderKpiCrudList(kpiCrudList),
      loadSettings()
    ]);
  }

  userSel.addEventListener('change', refreshAll);
  refreshBtn.addEventListener('click', refreshAll);
  dateInp.addEventListener('change', () => {
    renderKpiListFor(userSel.value);
  });

  histApplyBtn.addEventListener('click', () => renderHistoryFor(userSel.value));
  histClearBtn.addEventListener('click', () => {
    histFromInp.value = '';
    histToInp.value = '';
    renderHistoryFor(userSel.value);
  });

  // обработчик создания KPI (без повторного const!)
  kpiAddBtn.addEventListener('click', async () => {
    const name = String(kpiNewName.value || '').trim();
    const weight = Number(kpiNewWeight.value);
    if (!name || !Number.isFinite(weight) || weight <= 0) {
      alert('Заполните корректно название и баллы (> 0).');
      return;
    }
    const actorEmail = getActorEmail();
    if (!actorEmail) { alert('Нет email администратора (перелогиньтесь).'); return; }

    kpiAddBtn.disabled = true;
    try {
      await kpiCreate({ name, weight, actorEmail });
      try { await logEvent('kpi_created_ui', { name, weight, actorEmail }); } catch {}
      kpiNewName.value = '';
      kpiNewWeight.value = '';
      await renderKpiCrudList(kpiCrudList);
      // обновим список KPI для отметки, чтобы новая задача сразу появилась
      await renderKpiListFor(userSel.value);
      document.dispatchEvent(new CustomEvent('kpi:changed'));
    } catch (e) {
      console.error(e);
      alert('Не удалось создать KPI (нужны права admin).');
    } finally {
      kpiAddBtn.disabled = false;
    }
  });

  // первичный рендер
  refreshAll();

  return container;
}
