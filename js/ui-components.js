// Простая крутилка
export function createLoader(text = 'Загружаем данные…') {
  const box = document.createElement('div');
  box.className = 'd-flex align-items-center gap-2 my-3';
  box.innerHTML = `
    <div class="spinner-border" role="status" aria-hidden="true"></div>
    <span>${text}</span>
  `;
  return box;
}

// Прогресс-бар + персонаж
export function createProgressBar(percent, size = 'department') {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));

  const wrapper = document.createElement('div');
  wrapper.classList.add(`progress-${size}`, 'mb-3');

  const bar = document.createElement('div');
  bar.classList.add('progress');

  const barInner = document.createElement('div');
  barInner.classList.add('progress-bar', barClassByPercent(p));
  barInner.setAttribute('role', 'progressbar');
  barInner.style.width = `${p}%`;
  barInner.setAttribute('aria-valuenow', String(p));
  barInner.setAttribute('aria-valuemin', '0');
  barInner.setAttribute('aria-valuemax', '100');
  bar.appendChild(barInner);

  const charRow = document.createElement('div');
  charRow.classList.add('kpi-char-row');

  const track = document.createElement('div');
  track.classList.add('kpi-char-track');
  track.style.width = `${p}%`;
  track.style.textAlign = 'right';

  const img = createCharacterImage(p);
  track.appendChild(img);
  charRow.appendChild(track);

  wrapper.append(bar, charRow);
  return wrapper;
}

function barClassByPercent(p) {
  if (p < 30) return 'bar-critical';
  if (p < 50) return 'bar-30';
  if (p < 70) return 'bar-50';
  return 'bar-70';
}

function createCharacterImage(percent) {
  const img = document.createElement('img');
  img.width = 64;
  img.height = 64;
  img.alt = 'KPI Character';
  img.decoding = 'async';
  img.loading = 'lazy';

  if (percent < 30) {
    img.src = './images/krosh.png';
    img.title = 'Старт (0–29)';
  } else if (percent < 50) {
    img.src = './images/kopatych.png';
    img.title = 'Зима впроголодь (≥30)';
  } else if (percent < 70) {
    img.src = './images/karkarych-sovunya.png';
    img.title = 'Минимум, чтобы выжить (≥50)';
  } else {
    img.src = './images/nyusha.png';
    img.title = 'Изобилие (≥70)';
  }

  img.onerror = () => {
    const fallback = document.createElement('span');
    fallback.style.fontSize = '28px';
    if (percent < 30)      fallback.textContent = '🐰';
    else if (percent < 50) fallback.textContent = '🥕';
    else if (percent < 70) fallback.textContent = '🍵';
    else                   fallback.textContent = '👑';
    img.replaceWith(fallback);
  };

  return img;
}

// Таблица сотрудников
export function createUsersTable(users) {
  const arr = Array.isArray(users) ? users.slice() : [];
  if (arr.length === 0) {
    const info = document.createElement('div');
    info.className = 'text-secondary my-2';
    info.textContent = 'Нет сотрудников с ролью employee или нет данных.';
    return info;
  }

  // сортируем по месяцу (desc)
  arr.sort((a, b) => (b.month ?? 0) - (a.month ?? 0));

  const table = document.createElement('table');
  table.classList.add('table', 'table-striped', 'align-middle');

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th style="width:40%">Имя</th>
      <th style="width:20%">Баллы (неделя)</th>
      <th style="width:20%">Баллы (месяц)</th>
      <th style="width:20%">Роль</th>
    </tr>
  `;
  table.appendChild(thead);

  const fmt = (v) => {
    const n = Number(v || 0);
    if (!n) return '—';
    const s = n.toFixed(2);
    return s.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  };

  const tbody = document.createElement('tbody');
  arr.forEach((u, idx) => {
    const tr = document.createElement('tr');
    if (idx < 3) tr.classList.add('table-top'); // подчёркиваем ТОП-3
    tr.innerHTML = `
      <td>${u.name ?? '-'}</td>
      <td>${fmt(u.week)}</td>
      <td>${fmt(u.month)}</td>
      <td class="text-tertiary">${u.role ?? '-'}</td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  return table;
}

// Рендер списка KPI с бейджами (сортировка по weight уже делает сервер)
export function createKPIList(kpis = []) {
  const wrap = document.createElement('div');
  if (!Array.isArray(kpis) || kpis.length === 0) {
    wrap.className = 'text-secondary';
    wrap.textContent = 'Нет KPI для выбранного периода.';
    return wrap;
  }

  const list = document.createElement('div');
  list.className = 'list-group';

  kpis.forEach(k => {
    const item = document.createElement('div');
    item.className = 'list-group-item d-flex justify-content-between align-items-start';

    const left = document.createElement('div');
    left.innerHTML = `
      <div class="fw-medium">${k.name}</div>
      <div class="text-tertiary small">Вес: ${k.weight}</div>
    `;

    const badge = document.createElement('span');
    badge.className = `badge ${k.done ? 'bg-success' : 'bg-secondary'} rounded-pill`;
    badge.textContent = k.done ? 'Выполнено' : 'Не выполнено';

    item.append(left, badge);
    list.append(item);
  });

  wrap.append(list);
  return wrap;
}
