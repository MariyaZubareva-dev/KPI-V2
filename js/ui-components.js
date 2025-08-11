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
  if (!Array.isArray(users) || users.length === 0) {
    const info = document.createElement('div');
    info.className = 'text-secondary my-2';
    info.textContent = 'Нет сотрудников с ролью employee или нет данных.';
    return info;
  }

  const table = document.createElement('table');
  table.classList.add('table', 'table-striped');

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Имя</th>
      <th>Баллы (неделя)</th>
      <th>Баллы (месяц)</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  users.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.name ?? '-'}</td>
      <td>${(u.week ?? 0)}</td>
      <td>${(u.month ?? 0)}</td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  return table;
}

// ТОП-3
export function createLeaderboard(users, period = 'week') {
  const safe = Array.isArray(users) ? users : [];
  const sorted = safe
    .slice()
    .sort((a, b) => (b[period] ?? 0) - (a[period] ?? 0))
    .filter(u => (u[period] ?? 0) > 0)
    .slice(0, 3);

  const container = document.createElement('div');
  container.classList.add('leaderboard', 'mb-4');

  if (sorted.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-secondary';
    empty.textContent = 'Нет данных за период.';
    container.appendChild(empty);
    return container;
  }

  sorted.forEach(u => {
    const item = document.createElement('div');
    item.textContent = `${u.name ?? '-'}: ${u[period] ?? 0}`;
    container.appendChild(item);
  });

  return container;
}
