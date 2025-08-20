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
  settingsGet,
  settingsSet,
  usersList,
  userCreate,
  userUpdate,
  userDelete,
} from './api.js';

/**
 * Admin-панель (отметка KPI, история, CRUD задач, настройки, пользователи)
 * + привязка сотрудников к админам и админов к отделам
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

  /* ---------- панель выбора сотрудника и даты ---------- */
  const controlsCard = document.createElement('div');
  controlsCard.className = 'card mb-4';
  controlsCard.innerHTML = `
    <div class="card-body">
      <div class="row g-3 align-items-end toolbar-sm">
        <div class="col-12 col-md-5">
          <label class="form-label mb-1">Сотрудник</label>
          <select class="form-select form-select-sm" id="ap-user"></select>
        </div>
        <div class="col-8 col-md-3">
          <label class="form-label mb-1">Дата отметки</label>
          <input type="date" class="form-control form-control-sm" id="ap-date" />
        </div>
        <div class="col-4 col-md-2 d-grid">
          <button class="btn btn-outline-secondary btn-sm" id="ap-refresh">Обновить</button>
        </div>
      </div>
    </div>
  `;
  container.appendChild(controlsCard);

  const userSel  = controlsCard.querySelector('#ap-user');
  const dateInp  = controlsCard.querySelector('#ap-date');
  const refreshBtn = controlsCard.querySelector('#ap-refresh');

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
  dateInp.valueAsDate = new Date();
  if (employees.length) userSel.value = String(employees[0].id);

  /* ---------- две колонки: KPI и История ---------- */
  const twoCol = document.createElement('div');
  twoCol.className = 'row';

  const colLeft = document.createElement('div');
  colLeft.className = 'col-12 col-lg-7';
  colLeft.innerHTML = `
    <div class="card">
      <div class="card-body">
        <h5 class="card-title mb-3">Отметить KPI</h5>
        <div id="ap-kpi-list"></div>
      </div>
    </div>
  `;

  const colRight = document.createElement('div');
  colRight.className = 'col-12 col-lg-5';
  colRight.innerHTML = `
    <div class="card">
      <div class="card-body">
        <h5 class="card-title mb-3">История отметок</h5>
        <div class="row g-2 mb-2 toolbar-sm">
          <div class="col-6">
            <input type="date" class="form-control form-control-sm" id="ap-hist-from" placeholder="с (необязательно)"/>
          </div>
          <div class="col-6">
            <input type="date" class="form-control form-control-sm" id="ap-hist-to" placeholder="по (необязательно)"/>
          </div>
          <div class="col-12 d-flex gap-2">
            <button class="btn btn-outline-secondary btn-sm" id="ap-hist-apply">Применить фильтр</button>
            <button class="btn btn-outline-secondary btn-sm" id="ap-hist-clear">Сбросить</button>
          </div>
        </div>
        <div id="ap-history" class="narrow-wrap"></div>
      </div>
    </div>
  `;
  twoCol.append(colLeft, colRight);
  container.appendChild(twoCol);

  /* ---------- CRUD задач (KPI) ---------- */
  const kpiCrudCard = document.createElement('div');
  kpiCrudCard.className = 'card mt-4';
  kpiCrudCard.innerHTML = `
    <div class="card-body">
      <h5 class="card-title mb-3">Задачи (KPI)</h5>

      <div class="border rounded p-3 mb-3">
        <div class="row g-2 align-items-end toolbar-sm">
          <div class="col-12 col-md-6">
            <label class="form-label mb-1">Название новой задачи</label>
            <input type="text" class="form-control form-control-sm" id="kpi-new-name" placeholder="Например: Отправить недельный отчёт" />
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label mb-1">Баллы</label>
            <input type="number" step="0.01" min="0.01" class="form-control form-control-sm" id="kpi-new-weight" placeholder="0.25" />
          </div>
          <div class="col-6 col-md-3 d-grid">
            <button class="btn btn-success btn-sm" id="kpi-new-add">Создать</button>
          </div>
        </div>
      </div>

      <div id="kpi-crud-list"></div>
    </div>
  `;
  container.appendChild(kpiCrudCard);

  /* ---------- Настройки (цель + политики) ---------- */
  const settingsCard = document.createElement('div');
  settingsCard.className = 'card mt-4';
  settingsCard.innerHTML = `
    <div class="card-body">
      <h5 class="card-title mb-3">Настройки</h5>
      <div class="row g-3 align-items-end toolbar-sm">
        <div class="col-6 col-md-3">
          <label class="form-label mb-1">Цель месяца</label>
          <input type="number" min="1" step="1" class="form-control form-control-sm" id="st-goal" placeholder="100" />
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label mb-1">Политика повторов</label>
          <select class="form-select form-select-sm" id="st-policy">
            <option value="none">Без ограничений</option>
            <option value="per_day">Не более 1 в день</option>
            <option value="per_week">Не более 1 в неделю</option>
          </select>
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label mb-1">Область политики</label>
          <select class="form-select form-select-sm" id="st-scope">
            <option value="per_kpi">Для каждого KPI</option>
            <option value="global">Глобально (на любые KPI)</option>
          </select>
        </div>
        <div class="col-6 col-md-3 d-grid">
          <button class="btn btn-primary btn-sm" id="st-save">Сохранить</button>
        </div>
      </div>
      <div id="st-hint" class="mt-2 text-secondary small d-none"></div>
    </div>
  `;
  container.appendChild(settingsCard);

  /* ---------- Пользователи (добавление + привязки) ---------- */
  const usersCard = document.createElement('div');
  usersCard.className = 'card mt-4';
  usersCard.innerHTML = `
    <div class="card-body">
      <h5 class="card-title mb-3">Пользователи</h5>

      <div class="border rounded p-3 mb-3">
        <div class="row g-2 align-items-end toolbar-sm">
          <div class="col-12 col-md-4">
            <label class="form-label mb-1">Имя</label>
            <input type="text" class="form-control form-control-sm" id="u-new-name" placeholder="Иван Иванов" />
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label mb-1">Email</label>
            <input type="email" class="form-control form-control-sm" id="u-new-email" placeholder="user@example.com" />
          </div>
          <div class="col-6 col-md-2">
            <label class="form-label mb-1">Роль</label>
            <select class="form-select form-select-sm" id="u-new-role">
              <option value="employee">employee</option>
              <option value="admin">admin</option>
              <option value="observer">observer</option>
            </select>
          </div>
          <div class="col-6 col-md-2 d-grid">
            <button class="btn btn-success btn-sm" id="u-new-add">Добавить</button>
          </div>
        </div>
      </div>

      <div id="users-crud-list"></div>
    </div>
  `;
  container.appendChild(usersCard);

  /* ---------- refs ---------- */
  const kpiListBox   = colLeft.querySelector('#ap-kpi-list');
  const histBox      = colRight.querySelector('#ap-history');
  const histFromInp  = colRight.querySelector('#ap-hist-from');
  const histToInp    = colRight.querySelector('#ap-hist-to');
  const histApplyBtn = colRight.querySelector('#ap-hist-apply');
  const histClearBtn = colRight.querySelector('#ap-hist-clear');

  const kpiCrudList  = kpiCrudCard.querySelector('#kpi-crud-list');
  const kpiNewName   = kpiCrudCard.querySelector('#kpi-new-name');
  const kpiNewWeight = kpiCrudCard.querySelector('#kpi-new-weight');
  const kpiAddBtn    = kpiCrudCard.querySelector('#kpi-new-add');

  const stGoal   = settingsCard.querySelector('#st-goal');
  const stPolicy = settingsCard.querySelector('#st-policy');
  const stScope  = settingsCard.querySelector('#st-scope');
  const stSave   = settingsCard.querySelector('#st-save');

  const uNewName = usersCard.querySelector('#u-new-name');
  const uNewEmail= usersCard.querySelector('#u-new-email');
  const uNewRole = usersCard.querySelector('#u-new-role');
  const uNewAdd  = usersCard.querySelector('#u-new-add');
  const usersCrudListBox = usersCard.querySelector('#users-crud-list');

  /* ---------- helpers ---------- */
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

  /* ---------- KPI список (таблица) ---------- */
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

      const table = document.createElement('table');
      table.className = 'table table-hover table-compact align-middle';
      table.innerHTML = `
        <thead>
          <tr>
            <th>Задача</th>
            <th style="width:110px;">Баллы</th>
            <th style="width:140px;">Дата</th>
            <th style="width:220px;">Статус</th>
            <th style="width:1%; white-space:nowrap;">Действие</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector('tbody');

      kpis.forEach(kpi => {
        const tr = document.createElement('tr');

        const tdName = document.createElement('td');
        tdName.innerHTML = `<strong>${kpi.name}</strong>`;

        const tdWeight = document.createElement('td');
        tdWeight.textContent = String(kpi.weight ?? 0);

        const tdDate = document.createElement('td');
        tdDate.textContent = selectedDate;

        const tdStatus = document.createElement('td');
        tdStatus.innerHTML = kpi.done
          ? `<span class="status-done small">уже отмечено на этой неделе</span>`
          : `<span class="text-tertiary small">ещё не отмечено</span>`;

        const tdAction = document.createElement('td');
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
              date: dateInp.value || selectedDate,
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

            await Promise.all([ renderKpiListFor(userId), renderHistoryFor(userId) ]);
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

        tdAction.appendChild(btn);
        tr.append(tdName, tdWeight, tdDate, tdStatus, tdAction);
        tbody.appendChild(tr);
      });

      kpiListBox.appendChild(table);
    } catch (e) {
      console.error('Ошибка загрузки KPI пользователя:', e);
      kpiListBox.innerHTML = `<div class="alert alert-danger">Не удалось загрузить список KPI.</div>`;
    }
  }

  /* ---------- История ---------- */
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
      table.className = 'table table-striped table-compact table-xs align-middle';
      table.innerHTML = `
        <thead>
          <tr>
            <th style="width:110px;">Дата</th>
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
              renderKpiListFor(userId),
            ]);
            document.dispatchEvent(new CustomEvent('kpi:recorded'));
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

  /* ---------- CRUD KPI таблица ---------- */
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
      table.className = 'table table-sm align-middle table-compact';
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
        nameInput.className = 'form-control form-control-sm';
        nameInput.value = r.name || '';
        nameTd.appendChild(nameInput);

        const wTd = document.createElement('td');
        const wInput = document.createElement('input');
        wInput.type = 'number';
        wInput.step = '0.01';
        wInput.min = '0.01';
        wInput.className = 'form-control form-control-sm';
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

  /* ---------- Пользователи: список + привязки (employee→admin, admin→department) ---------- */

  async function fetchAdminDepartmentsMap(admins) {
    const map = {};
    for (const a of admins) {
      try {
        const r = await settingsGet(`dept_${a.id}`);
        map[a.id] = (r?.value ?? r ?? '').trim();
      } catch { map[a.id] = ''; }
    }
    return map;
  }

  function renderMgrDeptCell(u, admins, deptMap) {
    const cell = document.createElement('td');

    if (String(u.role || '').toLowerCase() === 'employee') {
      // селект менеджера (админа)
      const sel = document.createElement('select');
      sel.className = 'form-select form-select-sm';
      const optNone = document.createElement('option');
      optNone.value = '';
      optNone.textContent = '— не назначен —';
      sel.appendChild(optNone);

      admins.forEach(a => {
        const opt = document.createElement('option');
        opt.value = String(a.id);
        opt.textContent = a.name || a.email || `admin #${a.id}`;
        if (String(u.manager_id ?? '') === String(a.id)) opt.selected = true;
        sel.appendChild(opt);
      });

      sel.dataset.kind = 'manager';
      cell.appendChild(sel);
      return { cell, control: sel };
    }

    if (String(u.role || '').toLowerCase() === 'admin') {
      // поле "отдел" для админа
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'form-control form-control-sm';
      inp.placeholder = 'Название отдела';
      inp.value = deptMap[u.id] || '';
      inp.dataset.kind = 'department';
      cell.appendChild(inp);
      return { cell, control: inp };
    }

    // observer — пустая ячейка
    cell.innerHTML = `<span class="text-tertiary small">—</span>`;
    return { cell, control: null };
  }

  async function renderUsersCrudList(container) {
    container.innerHTML = `
      <div class="d-flex align-items-center gap-2 my-2">
        <div class="spinner-border" role="status" aria-hidden="true"></div>
        <span>Загружаем пользователей…</span>
      </div>
    `;
    try {
      const rows = await usersList({ includeInactive: true });
      container.innerHTML = '';

      if (!rows.length) {
        container.innerHTML = `<div class="text-secondary">Пользователей нет.</div>`;
        return;
      }

      const admins = rows.filter(u => String(u.role || '').toLowerCase() === 'admin' && u.active);
      const deptMap = await fetchAdminDepartmentsMap(admins);

      const table = document.createElement('table');
      table.className = 'table table-sm align-middle table-compact';
      table.innerHTML = `
        <thead>
          <tr>
            <th>Имя</th>
            <th style="width:240px;">Email</th>
            <th style="width:180px;">Роль</th>
            <th style="width:220px;">Админ / Отдел</th>
            <th style="width:100px;">Активен</th>
            <th style="width:1%; white-space:nowrap;"></th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector('tbody');

      rows.forEach(u => {
        const tr = document.createElement('tr');

        // Имя
        const tdName = document.createElement('td');
        const inpName = document.createElement('input');
        inpName.type = 'text';
        inpName.className = 'form-control form-control-sm';
        inpName.value = u.name || '';
        tdName.appendChild(inpName);

        // Email
        const tdEmail = document.createElement('td');
        const inpEmail = document.createElement('input');
        inpEmail.type = 'email';
        inpEmail.className = 'form-control form-control-sm';
        inpEmail.value = u.email || '';
        tdEmail.appendChild(inpEmail);

        // Роль
        const tdRole = document.createElement('td');
        const selRole = document.createElement('select');
        selRole.className = 'form-select form-select-sm';
        ['employee','admin','observer'].forEach(r => {
          const opt = document.createElement('option');
          opt.value = r; opt.textContent = r;
          if (String(u.role||'').toLowerCase() === r) opt.selected = true;
          selRole.appendChild(opt);
        });
        tdRole.appendChild(selRole);

        // Админ / Отдел (динамическая ячейка)
        const { cell: tdMgrDept, control: mgrDeptControlInitial } = renderMgrDeptCell(u, admins, deptMap);

        // Активен
        const tdActive = document.createElement('td');
        const sw = document.createElement('input');
        sw.type = 'checkbox';
        sw.className = 'form-check-input';
        sw.checked = !!u.active;
        tdActive.appendChild(sw);

        // Действия
        const tdActions = document.createElement('td');
        tdActions.className = 'd-flex gap-2';
        const btnSave = document.createElement('button');
        btnSave.className = 'btn btn-primary btn-sm';
        btnSave.textContent = 'Сохранить';

        const btnToggle = document.createElement('button');
        btnToggle.className = 'btn btn-outline-danger btn-sm';
        btnToggle.textContent = u.active ? 'Деактивировать' : 'Активировать';

        tdActions.append(btnSave, btnToggle);

        tr.append(tdName, tdEmail, tdRole, tdMgrDept, tdActive, tdActions);
        tbody.appendChild(tr);

        // при смене роли — перестраиваем ячейку привязки
        selRole.addEventListener('change', () => {
          const newRole = selRole.value;
          const fresh = renderMgrDeptCell({ ...u, role: newRole }, admins, deptMap);
          tdMgrDept.replaceChildren(...fresh.cell.childNodes);
          tdMgrDept.dataset.kind = fresh.cell.dataset?.kind || '';
        });

        btnSave.addEventListener('click', async () => {
          const actorEmail = getActorEmail();
          if (!actorEmail) { alert('Нет email администратора (перелогиньтесь).'); return; }

          const name = String(inpName.value || '').trim();
          const email = String(inpEmail.value || '').trim().toLowerCase();
          const role  = String(selRole.value || 'employee');
          const active = !!sw.checked;

          if (!name || !email.includes('@')) {
            alert('Заполните корректно имя и email.');
            return;
          }

          // определим контроль в ячейке «Админ / Отдел»
          const ctrl = tdMgrDept.querySelector('select, input');
          const ctrlKind = ctrl?.dataset?.kind || tdMgrDept.dataset.kind || '';

          const calls = [];

          // user_update с базовыми полями
          const baseUpdate = { id: u.id, name, email, role, active, actorEmail };

          if (ctrlKind === 'manager' && role === 'employee') {
            baseUpdate.manager_id = ctrl.value || '';
          } else if (role !== 'employee') {
            baseUpdate.manager_id = ''; // очистим связь при смене роли
          }
          calls.push(userUpdate(baseUpdate));

          // для админа — сохранить отдел через settings_set
          if (ctrlKind === 'department' && role === 'admin') {
            const dept = String(ctrl.value || '').trim();
            calls.push(settingsSet(`dept_${u.id}`, dept || '', actorEmail));
          }

          btnSave.disabled = btnToggle.disabled = true;
          try {
            await Promise.all(calls);
            try { await logEvent('user_updated_ui', { id: u.id, name, email, role, active, actorEmail }); } catch {}
            await renderUsersCrudList(container);
          } catch (e) {
            console.error(e);
            alert('Не удалось сохранить пользователя.');
          } finally {
            btnSave.disabled = btnToggle.disabled = false;
          }
        });

        btnToggle.addEventListener('click', async () => {
          const actorEmail = getActorEmail();
          if (!actorEmail) { alert('Нет email администратора (перелогиньтесь).'); return; }
          btnSave.disabled = btnToggle.disabled = true;
          try {
            if (u.active) {
              if (!confirm('Деактивировать пользователя?')) { btnSave.disabled = btnToggle.disabled = false; return; }
              await userDelete({ id: u.id, actorEmail });
            } else {
              await userUpdate({ id: u.id, active: true, actorEmail });
            }
            await renderUsersCrudList(container);
          } catch (e) {
            console.error(e);
            alert('Не удалось изменить активность пользователя.');
          } finally {
            btnSave.disabled = btnToggle.disabled = false;
          }
        });
      });

      container.appendChild(table);
    } catch (e) {
      console.error(e);
      container.innerHTML = `<div class="alert alert-danger">Ошибка загрузки пользователей.</div>`;
    }
  }

  /* ---------- Настройки: загрузка/сохранение ---------- */
  async function loadSettings() {
    try {
      const goalResp = await settingsGet('month_goal');
      const policyResp = await settingsGet('repeat_policy');
      const scopeResp  = await settingsGet('repeat_scope');

      const goalVal = Number(goalResp?.value ?? goalResp ?? 100);
      stGoal.value = String(goalVal || 100);

      const policyVal = String(policyResp?.value ?? policyResp ?? 'none');
      stPolicy.value = policyVal;

      const scopeVal = String(scopeResp?.value ?? scopeResp ?? 'per_kpi');
      stScope.value = scopeVal;
    } catch (e) {
      console.error('settingsGet failed', e);
    }
  }

  stSave.addEventListener('click', async () => {
    const actorEmail = getActorEmail();
    if (!actorEmail) { alert('Нет email администратора (перелогиньтесь).'); return; }

    const goal = Math.max(1, Number(stGoal.value || 0));
    const policy = String(stPolicy.value || 'none');
    const scope  = String(stScope.value || 'per_kpi');

    try {
      await Promise.all([
        settingsSet('month_goal', String(goal), actorEmail),
        settingsSet('repeat_policy', policy, actorEmail),
        settingsSet('repeat_scope', scope, actorEmail),
      ]);
      alert('Настройки сохранены');
      document.dispatchEvent(new CustomEvent('kpi:changed'));
    } catch (e) {
      console.error(e);
      alert('Не удалось сохранить настройки.');
    }
  });

  /* ---------- Добавление пользователя ---------- */
  uNewAdd.addEventListener('click', async () => {
    const name  = String(uNewName.value || '').trim();
    const email = String(uNewEmail.value || '').trim().toLowerCase();
    const role  = String(uNewRole.value || 'employee');
    if (!name || !email.includes('@')) {
      alert('Укажите корректные имя и email.');
      return;
    }
    const actorEmail = getActorEmail();
    if (!actorEmail) { alert('Нет email администратора (перелогиньтесь).'); return; }

    uNewAdd.disabled = true;
    try {
      await userCreate({ name, email, role, actorEmail });
      try { await logEvent('user_created_ui', { name, email, role, actorEmail }); } catch {}
      uNewName.value = '';
      uNewEmail.value = '';
      uNewRole.value = 'employee';
      await renderUsersCrudList(usersCrudListBox);
    } catch (e) {
      console.error(e);
      alert('Не удалось создать пользователя.');
    } finally {
      uNewAdd.disabled = false;
    }
  });

  /* ---------- события и первичная отрисовка ---------- */
  async function refreshAll() {
    const userId = userSel.value;
    await Promise.all([
      renderKpiListFor(userId),
      renderHistoryFor(userId),
      renderKpiCrudList(kpiCrudList),
      loadSettings(),
      renderUsersCrudList(usersCrudListBox),
    ]);
  }

  userSel.addEventListener('change', refreshAll);
  refreshBtn.addEventListener('click', refreshAll);
  dateInp.addEventListener('change', () => { renderKpiListFor(userSel.value); });

  const histApply = () => renderHistoryFor(userSel.value);
  histApplyBtn.addEventListener('click', histApply);
  histClearBtn.addEventListener('click', () => {
    histFromInp.value = ''; histToInp.value = ''; histApply();
  });

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
      await renderKpiListFor(userSel.value);
      document.dispatchEvent(new CustomEvent('kpi:changed'));
    } catch (e) {
      console.error(e);
      alert('Не удалось создать KPI (нужны права admin).');
    } finally {
      kpiAddBtn.disabled = false;
    }
  });

  refreshAll();
  return container;
}
