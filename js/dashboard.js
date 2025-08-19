// js/dashboard.js
import { logEvent, bootstrap as apiBootstrap, leaderboard as apiLeaderboard } from './api.js';
import {
  createProgressBar,
  createUsersTable,
  createLeaderboard,
  createLoader
} from './ui-components.js';

/**
 * Рендер дашборда
 * @param {{ID?: string, Email?: string, role: string, Name?: string, name?: string, email?: string}} user
 */
export async function renderDashboard(user) {
  const userName  = user?.Name || user?.name || user?.Email || user?.email || 'Пользователь';
  const role      = String(user?.role || '').toLowerCase();
  const userEmail = (user?.email || user?.Email || '').toLowerCase();
  const app       = document.getElementById('app');

  app.innerHTML = '';

  // Верхняя панель — единое приветствие + logout
  const title = document.createElement('h2');
  title.textContent = `Добро пожаловать, ${userName}!`;

  const toolbar = document.createElement('div');
  toolbar.className = 'd-flex justify-content-between align-items-center mb-3';
  toolbar.appendChild(title);

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn btn-outline-primary btn-sm';
  logoutBtn.textContent = 'Выйти';
  logoutBtn.addEventListener('click', async () => {
    try { await logEvent('logout', { email: user?.email || user?.Email }); } catch {}
    localStorage.removeItem('user');
    location.reload();
  });
  toolbar.appendChild(logoutBtn);
  app.appendChild(toolbar);

  // Контейнеры секций
  const employeeSection = document.createElement('section'); employeeSection.id = 'employee-section';
  const deptSection     = document.createElement('section'); deptSection.id    = 'dept-section';
  const leaderWeekSec   = document.createElement('section'); leaderWeekSec.id  = 'leader-week';
  const leaderMonthSec  = document.createElement('section'); leaderMonthSec.id = 'leader-month';
  const tableSection    = document.createElement('section'); tableSection.id   = 'users-table';

  if (role === 'employee') {
    app.append(employeeSection, leaderWeekSec, leaderMonthSec, tableSection);
  } else {
    app.append(deptSection, leaderWeekSec, leaderMonthSec, tableSection);
  }

  const loader = createLoader('Загружаем данные…');
  app.append(loader);

  let lastEmployees = [];

  // helpers
  function getLastFullWeekBounds() {
    const now = new Date();
    const day = now.getDay(); // 0..6
    const mondayThisWeek = new Date(now);
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    mondayThisWeek.setDate(now.getDate() + diffToMonday);

    const end = new Date(mondayThisWeek);
    end.setDate(mondayThisWeek.getDate() - 1);
    end.setHours(23, 59, 59, 999);

    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    return { start, end };
  }
  function fmtDDMM(d) { return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }); }
  function buildLeaderWeekHeader() {
    const wrap = document.createElement('div');
    const h4 = document.createElement('h4'); h4.textContent = 'ТОП-3 за неделю';
    const sub = document.createElement('div'); sub.className = 'text-tertiary caption mt-1';
    const { start, end } = getLastFullWeekBounds();
    sub.textContent = `за прошлую неделю (Пн ${fmtDDMM(start)} — Вс ${fmtDDMM(end)})`;
    wrap.append(h4, sub);
    return wrap;
  }

  function renderEmployeePanel({ deptData, usersArr }) {
    if (role !== 'employee') return;

    const me = Array.isArray(usersArr)
      ? usersArr.find(u => (u.email || '').toLowerCase() === userEmail)
      : null;

    employeeSection.innerHTML = '';

    if (!me) {
      const warn = document.createElement('div');
      warn.className = 'text-secondary';
      warn.textContent = 'Не удалось найти ваши данные в списке пользователей.';
      employeeSection.append(warn);
      return;
    }

    const personalWeekPoints  = Number(me.week || 0);
    const personalMonthPoints = Number(me.month || 0);

    const employeesCount  = Number(deptData?.employeesCount || 1);
    const maxWeekDept     = Number(deptData?.maxWeek || 0);
    const perUserMaxWeek  = (maxWeekDept / (employeesCount || 1)) || 1;
    const weeksInMonth    = Number(deptData?.weeksInMonth || 4);
    const perUserMaxMonth = perUserMaxWeek * weeksInMonth || 1;

    const deptMonthPoints = Number(deptData?.monthSum || 0); // выводим числом

    // 1) Прогресс отдела — месяц (считаем ширину по шкале 0..100, цвет и иконка — по баллам)
    {
      deptSection.innerHTML = '';
      const h = document.createElement('h3'); h.textContent = 'Прогресс отдела (месяц)';
      const bar = createProgressBar(0, {
        size: 'department',
        widthMode: 'points100',
        widthPoints: Math.min(Math.max(deptMonthPoints, 0), 100),
        iconMode: 'points',
        iconValue: deptMonthPoints
      });
      deptSection.append(h, bar);
    }

    // 2) Личные прогрессы — неделя/месяц (ширина по 0..100 баллов, иконка — тоже по баллам)
    const grid = document.createElement('div');
    grid.className = 'row g-4';

    const colWeek = document.createElement('div'); colWeek.className = 'col-12 col-md-6';
    const h4w = document.createElement('h4'); h4w.textContent = `Ваш прогресс — неделя (текущая)`;
    const barW = createProgressBar(0, {
      size: 'user',
      widthMode: 'points100',
      widthPoints: Math.min(Math.max(personalWeekPoints, 0), 100),
      iconMode: 'points',
      iconValue: personalWeekPoints
    });
    colWeek.append(h4w, barW);

    const colMonth = document.createElement('div'); colMonth.className = 'col-12 col-md-6';
    const h4m = document.createElement('h4'); h4m.textContent = `Ваш прогресс — месяц (текущий)`;
    const barM = createProgressBar(0, {
      size: 'user',
      widthMode: 'points100',
      widthPoints: Math.min(Math.max(personalMonthPoints, 0), 100),
      iconMode: 'points',
      iconValue: personalMonthPoints
    });
    colMonth.append(h4m, barM);

    grid.append(colWeek, colMonth);
    employeeSection.append(grid);
  }

  async function refreshDashboardData() {
    // Один батч
    const { dept, users, usersPrevWeek } = await apiBootstrap();

    const deptData  = dept || {};
    const usersArr  = Array.isArray(users) ? users : [];
    const usersPrev = Array.isArray(usersPrevWeek) ? usersPrevWeek : [];

    const employees = usersArr.filter(u => String(u.role || '').toLowerCase() === 'employee');
    const employeesPrevW = usersPrev.filter(u => String(u.role || '').toLowerCase() === 'employee');

    lastEmployees = employees;

    if (role === 'employee') {
      renderEmployeePanel({ deptData, usersArr });
    } else {
      // Для не-employee — общий прогресс отдела (месяц)
      const deptMonthPoints = Number(deptData?.monthSum || 0);
      deptSection.innerHTML = '';
      const deptTitle = document.createElement('h3');
      deptTitle.textContent = 'Прогресс отдела (месяц)';
      const bar = createProgressBar(0, {
        size: 'department',
        widthMode: 'points100',
        widthPoints: Math.min(Math.max(deptMonthPoints, 0), 100),
        iconMode: 'points',
        iconValue: deptMonthPoints
      });
      deptSection.append(deptTitle, bar);
    }

    // ТОП-3 за прошлую неделю и текущий месяц
    leaderWeekSec.innerHTML = '';
    leaderWeekSec.append(buildLeaderWeekHeader(), createLeaderboard(employeesPrevW, 'week'));

    leaderMonthSec.innerHTML = '';
    const h4Month = document.createElement('h4');
    h4Month.textContent = 'ТОП-3 за месяц';
    leaderMonthSec.append(h4Month, createLeaderboard(employees, 'month'));

    // Таблица сотрудников
    tableSection.innerHTML = '';
    const tableTitle = document.createElement('h4');
    tableTitle.textContent = 'Сотрудники и баллы';
    tableSection.append(tableTitle, createUsersTable(employees));

    // Для админа — секция детального рейтинга (если не создана ранее)
    if (role === 'admin' && !document.getElementById('rating-section')) {
      renderRatingSection(app);
    }
  }

  try {
    await refreshDashboardData();
    try { await logEvent('dashboard_view', { email: user?.email || user?.Email }); } catch {}
  } finally {
    try { loader.remove(); } catch {}
  }

  // Слушаем событие из админ-панели
  document.addEventListener('kpi:recorded', async () => {
    await refreshDashboardData();
  });

  // Подключаем админ-панель (отметки) в конце
  if (role === 'admin') {
    const adminModule = await import('./admin-panel.js');
    app.append(adminModule.createAdminPanel(lastEmployees));
  }

  /* ===== локальные функции секции рейтинга (для админа) ===== */

  function renderRatingSection(root) {
    const ratingSection = document.createElement('section');
    ratingSection.id = 'rating-section';
    root.append(ratingSection);

    const card = document.createElement('div');
    card.className = 'card mt-4';
    card.innerHTML = `
      <div class="card-body">
        <h4 class="card-title mb-3">Детальная таблица рейтинга</h4>
        <div class="row g-2 align-items-end mb-3">
          <div class="col-6 col-md-3">
            <label class="form-label mb-1">С</label>
            <input type="date" class="form-control" id="rt-from" />
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label mb-1">По</label>
            <input type="date" class="form-control" id="rt-to" />
          </div>
          <div class="col-12 col-md-6 d-flex gap-2">
            <button class="btn btn-outline-secondary" id="rt-this-week">Эта неделя</button>
            <button class="btn btn-outline-secondary" id="rt-prev-week">Прошлая неделя</button>
            <button class="btn btn-outline-secondary" id="rt-this-month">Этот месяц</button>
            <button class="btn btn-outline-secondary" id="rt-last-month">Прошлый месяц</button>
            <button class="btn btn-primary ms-auto" id="rt-apply">Показать</button>
          </div>
        </div>
        <div class="mb-2 d-flex">
          <button class="btn btn-outline-primary btn-sm ms-auto" id="rt-export">Экспорт CSV</button>
        </div>
        <div id="rt-table"></div>
      </div>
    `;
    ratingSection.appendChild(card);

    const fromInp = card.querySelector('#rt-from');
    const toInp   = card.querySelector('#rt-to');
    const tbl     = card.querySelector('#rt-table');

    function setDateRange(from, to) {
      fromInp.value = from;
      toInp.value   = to;
    }
    function fmt(d) {
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,'0');
      const dd= String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${dd}`;
    }
    function weekBounds(date) {
      const d = new Date(date);
      const day = d.getDay(); // 0..6
      const diffToMon = day === 0 ? -6 : 1 - day;
      const mon = new Date(d); mon.setDate(d.getDate() + diffToMon); mon.setHours(0,0,0,0);
      const sun = new Date(mon); sun.setDate(mon.getDate()+6); sun.setHours(23,59,59,999);
      return { from: fmt(mon), to: fmt(sun) };
    }
    function thisMonth() {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end   = new Date(now.getFullYear(), now.getMonth()+1, 0);
      return { from: fmt(start), to: fmt(end) };
    }
    function lastMonth() {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth()-1, 1);
      const end   = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: fmt(start), to: fmt(end) };
    }

    // дефолт — прошлая полная неделя
    const defW = weekBounds(new Date());
    const prevWeekStart = new Date(defW.from); prevWeekStart.setDate(prevWeekStart.getDate()-7);
    const prevWeek = weekBounds(prevWeekStart);
    setDateRange(prevWeek.from, prevWeek.to);

    card.querySelector('#rt-this-week').addEventListener('click', () => {
      const w = weekBounds(new Date());
      setDateRange(w.from, w.to);
    });
    card.querySelector('#rt-prev-week').addEventListener('click', () => {
      setDateRange(prevWeek.from, prevWeek.to);
    });
    card.querySelector('#rt-this-month').addEventListener('click', () => {
      const m = thisMonth();
      setDateRange(m.from, m.to);
    });
    card.querySelector('#rt-last-month').addEventListener('click', () => {
      const m = lastMonth();
      setDateRange(m.from, m.to);
    });

    async function renderTable() {
      tbl.innerHTML = `
        <div class="d-flex align-items-center gap-2 my-2">
          <div class="spinner-border" role="status" aria-hidden="true"></div>
          <span>Считаем рейтинг…</span>
        </div>
      `;
      try {
        const res = await apiLeaderboard({ from: fromInp.value, to: toInp.value });
        const rows = res?.data?.rows || res?.rows || [];

        if (!rows.length) {
          tbl.innerHTML = `<div class="text-secondary">Нет данных за период.</div>`;
          return;
        }

        const table = document.createElement('table');
        table.className = 'table table-striped table-sm align-middle';
        table.innerHTML = `
          <thead>
            <tr>
              <th style="width:60px;">#</th>
              <th>Сотрудник</th>
              <th style="width:200px;">Email</th>
              <th style="width:120px;">Баллы</th>
            </tr>
          </thead>
          <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');

        rows.forEach((r, idx) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${r.name ?? '-'}</td>
            <td class="text-secondary small">${r.email ?? ''}</td>
            <td><strong>${Number(r.total ?? 0)}</strong></td>
          `;
          tbody.appendChild(tr);
        });

        tbl.innerHTML = '';
        tbl.appendChild(table);

        // экспорт CSV
        card.querySelector('#rt-export').onclick = () => {
          const header = ['#', 'Name', 'Email', 'Score'];
          const csv = [
            header.join(','),
            ...rows.map((r, i) => [i+1, quoteCsv(r.name||''), quoteCsv(r.email||''), Number(r.total||0)].join(','))
          ].join('\n');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `leaderboard_${fromInp.value}_${toInp.value}.csv`;
          a.click();
          URL.revokeObjectURL(a.href);
        };
        function quoteCsv(s){ const t=String(s).replaceAll('"','""'); return `"${t}"`; }
      } catch (e) {
        console.error(e);
        tbl.innerHTML = `<div class="alert alert-danger">Не удалось получить рейтинг.</div>`;
      }
    }

    card.querySelector('#rt-apply').addEventListener('click', renderTable);
    renderTable();
  }
}
// без авто-инициализации — вызывается из auth.js
