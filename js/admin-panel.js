// js/admin-panel.js
import {
  // progress & KPI
  getProgress,            // оставлен для совместимости, но не обязателен
  getUserKPIs,            // ← используем для списка KPI с учётом даты и repeat_policy
  recordKPI,
  listProgress,
  deleteProgress,
  // KPI CRUD
  kpiList,
  kpiCreate,
  kpiUpdate,
  kpiDelete,
  // SETTINGS
  settingsGet,
  settingsSet,
  // USERS CRUD
  usersList,
  userCreate,
  userUpdate,
  userDelete,
  // LOGGING
  logEvent,
} from './api.js';

/**
 * Admin-панель:
 * - Отметка KPI с выбором даты (в т.ч. «задним числом»)
 * - История отметок с удалением
 * - CRUD по KPI
 * - Настройки: глобальная цель (month_goal) и политика повторов (repeat_policy)
 * - CRUD по пользователям + привязка к админам (manager_id)
 *
 * @param {Array<{id:number,name:string,email:string,role:string}>} usersData
 * @returns {HTMLElement}
 */
export function createAdminPanel(usersData = []) {
  const employees = Array.isArray(usersData)
    ? usersData.filter(u => String(u.role || '').toLowerCase() === 'employee')
    : [];

  /* ---------- Корневой контейнер ---------- */
  const container = document.createElement('section');
  container.id = 'admin-panel';
  container.className = 'mt-5';

  const title = document.createElement('h3');
  title.textContent = 'Admin-панель';
  container.appendChild(title);

  /* ---------- Панель управления (Сотрудник + Дата) ---------- */
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

  const userSel   = controlsCard.querySelector('#ap-user');
  const dateInp   = controlsCard.querySelector('#ap-date');
  const refreshBtn= controlsCard.querySelector('#ap-refresh');

  // первичное заполнение селекта сотрудника
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

  // выбрать первого сотрудника
  if (employees.length) userSel.value = String(employees[0].id);

  /* ---------- Две колонки: KPI (слева) + История (справа) ---------- */
  const twoCol = document.createElement('div');
  twoCol.className = 'row';

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

  /* ---------- KPI CRUD ---------- */
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

  /* ---------- Настройки (цель + политика повторов) ---------- */
  const settingsCard = document.createElement('div');
  settingsCard.className = 'card mt-4';
  settingsCard.innerHTML = `
    <div class="card-body">
      <h5 class="card-title mb-3">Настройки</h5>
      <div class="row g-3 align-items-end">
        <div class="col-12 col-md-4">
          <label class="form-label mb-1">Глобальная цель за месяц (баллы)</label>
          <div class="input-group">
            <input type="number" min="1" class="form-control" id="settings-goal" placeholder="100" />
            <button class="btn btn-primary" id="settings-save-goal">Сохранить</button>
          </div>
        </div>
        <div class="col-12 col-md-5">
          <label class="form-label mb-1">Повторы задач</label>
          <div class="input-group">
            <select class="form-select" id="settings-repeat-policy">
              <option value="unlimited">Без ограничений</option>
              <option value="per_day">Не чаще 1 раза в день</option>
              <option value="per_week">Не чаще 1 раза в неделю</option>
            </select>
            <button class="btn btn-outline-primary" id="settings-save-policy">Применить</button>
          </div>
          <div class="form-text">Определяет, как часто можно отмечать один и тот же KPI для сотрудника.</div>
        </div>
      </div>
    </div>
  `;
  container.appendChild(settingsCard);

  /* ---------- USERS: CRUD + привязка к админам ---------- */
  const usersCrudCard = document.createElement('div');
  usersCrudCard.className = 'card mt-4';
  usersCrudCard.innerHTML = `
    <div class="card-body">
      <h5 class="card-title mb-3">Пользователи</h5>

      <div class="border rounded p-3 mb-3">
        <div class="row g-2 align-items-end">
          <div class="col-12 col-md-4">
            <label class="form-label mb-1">Имя</label>
            <input type="text" class="form-control" id="usr-new-name" placeholder="Иван Иванов" />
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label mb-1">Email</label>
            <input type="email" class="form-control" id="usr-new-email" placeholder="user@example.com" />
          </div>
          <div class="col-6 col-md-2">
            <label class="form-label mb-1">Роль</label>
            <select class="form-select" id="usr-new-role">
              <option value="employee">employee</option>
              <option value="admin">admin</option>
              <option value="observer">observer</option>
            </select>
          </div>
          <div class="col-6 col-md-2 d-grid">
            <button class="btn btn-success" id="usr-new-add">Создать</button>
          </div>
        </div>
      </div>

      <div id="users-crud-list"></div>
    </div>
  `;
  container.appendChild(usersCrudCard);

  /* ---------- Refs ---------- */
  // KPI отметка/история
  const kpiListBox   = colLeft.querySelector('#ap-kpi-list');
  const histBox      = colRight.querySelector('#ap-history');
  const histFromInp  = colRight.querySelector('#ap-hist-from');
  const histToInp    = colRight.querySelector('#ap-hist-to');
  const histApplyBtn = colRight.querySelector('#ap-hist-apply');
  const histClearBtn = colRight.querySelector('#ap-hist-clear');

  // KPI CRUD
  const kpiCrudList  = kpiCrudCard.querySelector('#kpi-crud-list');
  const kpiNewName   = kpiCrudCard.querySelector('#kpi-new-name');
  const kpiNewWeight = kpiCrudCard.querySelector('#kpi-new-weight');
  const kpiAddBtn    = kpiCrudCard.querySelector('#kpi-new-add'); // ← едиственное объявление

  // SETTINGS
  const inpGoal      = settingsCard.querySelector('#settings-goal');
  const btnSaveGoal  = settingsCard.querySelector('#settings-save-goal');
  const selPolicy    = settingsCard.querySelector('#settings-repeat-policy');
  const btnSavePolicy= settingsCard.querySelector('#settings-save-policy');

  // USERS CRUD
  const usersCrudList= usersCrudCard.querySelector('#users-crud-list');
  const usrNewName   = usersCrudCard.querySelector('#usr-new-name');
  const usrNewEmail  = usersCrudCard.querySelector('#usr-new-email');
  const usrNewRole   = usersCrudCard.querySelector('#usr-new-role');
  const usrNewAddBtn = usersCrudCard.querySelector('#usr-new-add');

  /* ---------- Helpers ---------- */
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

  /* ---------- KPI: список для отметки ---------- */
  async function renderKpiListFor(userId) {
    kpiListBox.innerHTML = `
      <div class="d-flex align-items-center gap-2 my-2">
        <div class="spinner-border" role="status" aria-hidden="true"></div>
        <span>Загружаем KPI…</span>
      </div>
    `;
    try {
      const selectedDate = dateInp.value || fmtDateInputValue(new Date());

      // используем эндпоинт с политикой повторов
      const res = await getUserKPIs(String(userId), { date: selectedDate });
      const kpis = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      kpis.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));

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
        sub.textContent = `Баллы: ${kpi.weight}${kpi.done ? ' • уже отмечено по политике' : ''}`;
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
              date: dateInp.value || selectedDate, // задним числом — ок
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

            // Обновить KPI-список и историю
            await Promise.all([
              renderKpiListFor(userId),
              renderHistoryFor(userId),
            ]);

            // Уведомить дашборд
            document.dispatchEvent(new CustomEvent('kpi:recorded', {
              detail: { userID: String(userId), kpiId: String(kpi.KPI_ID) }
            }));
          } catch (e) {
            console.error(e);
            if (String(e?.message||'').includes('409')) {
              alert('Согласно текущей политике повторов задача уже отмечена в этот период.');
            } else {
              alert('Не удалось записать KPI. Подробности — в консоли.');
            }
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

  /* ---------- История отметок ---------- */
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
              renderKpiListFor(userId), // если удалили отметку текущего периода
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

  /* ---------- KPI CRUD: список и редактирование ---------- */
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

  /* ---------- SETTINGS: загрузка и сохранение ---------- */
  async function loadSettings() {
    try {
      const rGoal = await settingsGet('month_goal');
      const vGoal = rGoal?.data?.value ?? rGoal?.value ?? '100';
      inpGoal.value = String(vGoal);

      const rPol = await settingsGet('repeat_policy');
      const vPol = String(rPol?.data?.value ?? rPol?.value ?? 'unlimited').toLowerCase();
      selPolicy.value = ['unlimited','per_day','per_week'].includes(vPol) ? vPol : 'unlimited';
    } catch (e) {
      console.error('settingsGet failed', e);
    }
  }

  btnSaveGoal.addEventListener('click', async () => {
    const actorEmail = getActorEmail();
    if (!actorEmail) { alert('Нет email администратора.'); return; }
    const v = Math.max(1, Number(inpGoal.value || 0));
    try {
      await settingsSet('month_goal', String(v), actorEmail);
      await logEvent('settings_set_goal', { value: v, actorEmail });
      alert('Цель сохранена.');
      document.dispatchEvent(new CustomEvent('kpi:changed'));
    } catch (e) {
      console.error(e);
      alert('Не удалось сохранить цель.');
    }
  });

  btnSavePolicy.addEventListener('click', async () => {
    const actorEmail = getActorEmail();
    if (!actorEmail) { alert('Нет email администратора.'); return; }
    const v = String(selPolicy.value || 'unlimited');
    try {
      await settingsSet('repeat_policy', v, actorEmail);
      await logEvent('settings_set_policy', { value: v, actorEmail });
      alert('Политика повторов сохранена.');
      // перерисуем список KPI, т.к. флаги "уже отмечено" зависят от policy
      await renderKpiListFor(userSel.value);
    } catch (e) {
      console.error(e);
      alert('Не удалось сохранить политику повторов.');
    }
  });

  /* ---------- USERS: список/редактирование ---------- */
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

      const admins = rows.filter(r => String(r.role||'').toLowerCase() === 'admin' && Number(r.active||0) === 1);

      const table = document.createElement('table');
      table.className = 'table table-sm align-middle';
      table.innerHTML = `
        <thead>
          <tr>
            <th style="width:240px;">Имя</th>
            <th style="width:260px;">Email</th>
            <th style="width:140px;">Роль</th>
            <th style="width:200px;">Менеджер (админ)</th>
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
        const inName = document.createElement('input');
        inName.type = 'text';
        inName.className = 'form-control';
        inName.value = u.name || '';
        tdName.appendChild(inName);

        // Email
        const tdEmail = document.createElement('td');
        const inEmail = document.createElement('input');
        inEmail.type = 'email';
        inEmail.className = 'form-control';
        inEmail.value = u.email || '';
        tdEmail.appendChild(inEmail);

        // Роль
        const tdRole = document.createElement('td');
        const selRole = document.createElement('select');
        selRole.className = 'form-select';
        ['employee','admin','observer'].forEach(r => {
          const opt = document.createElement('option');
          opt.value = r; opt.textContent = r;
          if (String(u.role||'').toLowerCase() === r) opt.selected = true;
          selRole.appendChild(opt);
        });
        tdRole.appendChild(selRole);

        // Менеджер (админ)
        const tdMgr = document.createElement('td');
        const selMgr = document.createElement('select');
        selMgr.className = 'form-select';
        const optNone = document.createElement('option');
        optNone.value = ''; optNone.textContent = '—';
        selMgr.appendChild(optNone);
        admins.forEach(a => {
          const opt = document.createElement('option');
          opt.value = String(a.id);
          opt.textContent = a.name || a.email || `admin #${a.id}`;
          if (u.manager_id && Number(u.manager_id) === Number(a.id)) opt.selected = true;
          selMgr.appendChild(opt);
        });
        tdMgr.appendChild(selMgr);

        // Активен
        const tdAct = document.createElement('td');
        const chkAct = document.createElement('input');
        chkAct.type = 'checkbox';
        chkAct.className = 'form-check-input';
        chkAct.checked = !!Number(u.active||0);
        tdAct.appendChild(chkAct);

        // Кнопки
        const tdBtns = document.createElement('td');
        tdBtns.className = 'd-flex gap-2';
        const btnSave = document.createElement('button');
        btnSave.className = 'btn btn-primary btn-sm';
        btnSave.textContent = 'Сохранить';
        const btnToggle = document.createElement('button');
        btnToggle.className = chkAct.checked ? 'btn btn-outline-danger btn-sm' : 'btn btn-outline-success btn-sm';
        btnToggle.textContent = chkAct.checked ? 'Деактивировать' : 'Активировать';
        tdBtns.append(btnSave, btnToggle);

        tr.append(tdName, tdEmail, tdRole, tdMgr, tdAct, tdBtns);
        tbody.appendChild(tr);

        // Сохранение
        btnSave.addEventListener('click', async () => {
          const actorEmail = getActorEmail();
          if (!actorEmail) { alert('Нет email администратора (перелогиньтесь).'); return; }
          btnSave.disabled = btnToggle.disabled = true;
          try {
            await userUpdate({
              id: u.id,
              name: String(inName.value||'').trim(),
              email: String(inEmail.value||'').trim().toLowerCase(),
              role: String(selRole.value||'').toLowerCase(),
              active: chkAct.checked ? 1 : 0,
              manager_id: selMgr.value ? Number(selMgr.value) : '',
              actorEmail
            });
            try { await logEvent('user_updated_ui', { id: u.id, actorEmail }); } catch{}
            await renderUsersCrudList(container);
            await refreshEmployeeSelect();
            document.dispatchEvent(new CustomEvent('users:changed'));
          } catch (e) {
            console.error(e);
            alert('Не удалось сохранить пользователя.');
          } finally {
            btnSave.disabled = btnToggle.disabled = false;
          }
        });

        // Актив/деактив
        btnToggle.addEventListener('click', async () => {
          const actorEmail = getActorEmail();
          if (!actorEmail) { alert('Нет email администратора (перелогиньтесь).'); return; }
          btnSave.disabled = btnToggle.disabled = true;
          try {
            if (chkAct.checked) {
              await userDelete({ id: u.id, actorEmail }); // деактивируем
            } else {
              await userUpdate({ id: u.id, active: 1, actorEmail }); // активируем
            }
            try { await logEvent('user_toggled_ui', { id: u.id, newActive: chkAct.checked ? 0 : 1, actorEmail }); } catch{}
            await renderUsersCrudList(container);
            await refreshEmployeeSelect();
            document.dispatchEvent(new CustomEvent('users:changed'));
          } catch (e) {
            console.error(e);
            alert('Не удалось изменить активность.');
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

  // Создание нового пользователя
  usrNewAddBtn.addEventListener('click', async () => {
    const name = String(usrNewName.value||'').trim();
    const email = String(usrNewEmail.value||'').trim().toLowerCase();
    const role  = String(usrNewRole.value||'employee').toLowerCase();
    if (!name || !email) { alert('Введите имя и email.'); return; }
    const actorEmail = getActorEmail();
    if (!actorEmail) { alert('Нет email администратора (перелогиньтесь).'); return; }

    usrNewAddBtn.disabled = true;
    try {
      await userCreate({ name, email, role, actorEmail });
      try { await logEvent('user_created_ui', { name, email, role, actorEmail }); } catch{}
      usrNewName.value = ''; usrNewEmail.value = ''; usrNewRole.value = 'employee';
      await renderUsersCrudList(usersCrudList);
      await refreshEmployeeSelect();
      document.dispatchEvent(new CustomEvent('users:changed'));
    } catch (e) {
      console.error(e);
      alert('Не удалось создать пользователя.');
    } finally {
      usrNewAddBtn.disabled = false;
    }
  });

  // Обновить селект сотрудников (для отметки KPI)
  async function refreshEmployeeSelect() {
    try {
      const all = await usersList({ includeInactive: true });
      const employeesOnly = all.filter(u => String(u.role||'').toLowerCase() === 'employee' && Number(u.active||0) === 1);
      const prev = String(userSel.value || '');
      userSel.innerHTML = '';
      if (!employeesOnly.length) {
        const opt = document.createElement('option');
        opt.value = ''; opt.textContent = 'Нет активных сотрудников';
        userSel.appendChild(opt);
      } else {
        employeesOnly.forEach(u => {
          const opt = document.createElement('option');
          opt.value = String(u.id);
          opt.textContent = u.name || u.email || `ID ${u.id}`;
          userSel.appendChild(opt);
        });
        if (prev && employeesOnly.some(u => String(u.id) === prev)) {
          userSel.value = prev;
        }
      }
    } catch (e) {
      console.error('refreshEmployeeSelect failed', e);
    }
  }

  /* ---------- События и первичная отрисовка ---------- */
  async function refreshAll() {
    const userId = userSel.value;
    await Promise.all([
      renderKpiListFor(userId),
      renderHistoryFor(userId),
      renderKpiCrudList(kpiCrudList),
      renderUsersCrudList(usersCrudList),
      loadSettings(),
    ]);
  }

  userSel.addEventListener('change', refreshAll);
  refreshBtn.addEventListener('click', refreshAll);
  dateInp.addEventListener('change', () => renderKpiListFor(userSel.value));

  histApplyBtn.addEventListener('click', () => renderHistoryFor(userSel.value));
  histClearBtn.addEventListener('click', () => {
    histFromInp.value = '';
    histToInp.value = '';
    renderHistoryFor(userSel.value);
  });

  // KPI: создание новой
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
      await renderKpiListFor(userSel.value); // новая задача появится в списке отметок
      document.dispatchEvent(new CustomEvent('kpi:changed'));
    } catch (e) {
      console.error(e);
      alert('Не удалось создать KPI (нужны права admin).');
    } finally {
      kpiAddBtn.disabled = false;
    }
  });

  // первичное наполнение селекта (если usersData пуст) и общий рендер
  refreshEmployeeSelect().finally(() => refreshAll());

  return container;
}
