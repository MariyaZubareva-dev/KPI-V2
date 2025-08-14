// js/ui-components.js

/** Лоадер */
export function createLoader(text = 'Загружаем данные…') {
  const box = document.createElement('div');
  box.className = 'd-flex align-items-center gap-2 my-3';
  box.innerHTML = `
    <div class="spinner-border" role="status" aria-hidden="true"></div>
    <span>${text}</span>
  `;
  return box;
}

/**
 * Прогресс-бар с персонажем.
 * @param {number} percent    - ширина бара в процентах (0..100)
 * @param {{
 *   size?: 'department'|'user',
 *   iconMode?: 'percent'|'points', // по чему выбирать иконку
 *   iconValue?: number             // значение для выбора иконки (если points — это СЫРЫЕ баллы)
 * }} opts
 */
export function createProgressBar(percent, opts = {}) {
  const p = clampPercent(percent);
  const { size = 'department', iconMode = 'percent', iconValue } = opts;

  const wrapper = document.createElement('div');
  wrapper.classList.add(`progress-${size}`, 'mb-3');

  // bar
  const bar = document.createElement('div');
  bar.classList.add('progress');

  const inner = document.createElement('div');
  inner.classList.add('progress-bar', barClassByPercent(p));
  inner.setAttribute('role', 'progressbar');
  inner.style.width = `${p}%`;
  inner.setAttribute('aria-valuenow', String(p));
  inner.setAttribute('aria-valuemin', '0');
  inner.setAttribute('aria-valuemax', '100');
  bar.appendChild(inner);

  // character
  const charRow = document.createElement('div');
  charRow.classList.add('kpi-char-row');

  const track = document.createElement('div');
  track.classList.add('kpi-char-track');
  track.style.width = `${p}%`;
  track.style.textAlign = 'right';

  const img = createCharacterImage({
    mode: iconMode,
    value: iconMode === 'points' ? Number(iconValue || 0) : p
  });
  track.appendChild(img);
  charRow.appendChild(track);

  wrapper.append(bar, charRow);
  return wrapper;
}

function clampPercent(v) {
  const n = Number(v) || 0;
  return Math.max(0, Math.min(100, n));
}

function barClassByPercent(p) {
  if (p < 30) return 'bar-critical'; // красный
  if (p < 50) return 'bar-30';       // 30–49
  if (p < 70) return 'bar-50';       // 50–69
  return 'bar-70';                   // ≥70
}

/** Выбор иконки */
function createCharacterImage({ mode, value }) {
  // value: если mode='percent' — проценты; если 'points' — сырые баллы
  let src = './images/krosh.png';
  let title = 'Старт (0–29)';

  if (mode === 'points') {
    // Пороги по баллам: 0–29 / 30–49 / 50–69 / ≥70
    if (value >= 70) { src = './images/nyusha.png';            title = 'Изобилие (≥70)'; }
    else if (value >= 50) { src = './images/karkarych-sovunya.png'; title = 'Минимум, чтобы выжить (50–69)'; }
    else if (value >= 30) { src = './images/kopatych.png';     title = 'Зима впроголодь (30–49)'; }
    else { src = './images/krosh.png';                         title = 'Старт (0–29)'; }
  } else {
    // Пороги по проценту
    if (value >= 70) { src = './images/nyusha.png';            title = 'Изобилие (≥70%)'; }
    else if (value >= 50) { src = './images/karkarych-sovunya.png'; title = 'Минимум, чтобы выжить (50–69%)'; }
    else if (value >= 30) { src = './images/kopatych.png';     title = 'Зима впроголодь (30–49%)'; }
    else { src = './images/krosh.png';                         title = 'Старт (0–29%)'; }
  }

  const img = document.createElement('img');
  img.width = 64;
  img.height = 64;
  img.alt = 'KPI Character';
  img.decoding = 'async';
  img.loading = 'lazy';
  img.src = src;
  img.title = title;

  img.onerror = () => {
    const fallback = document.createElement('span');
    fallback.style.fontSize = '28px';
    fallback.textContent = value >= (mode === 'points' ? 70 : 70) ? '👑'
      : value >= (mode === 'points' ? 50 : 50) ? '🍵'
      : value >= (mode === 'points' ? 30 : 30) ? '🥕'
      : '🐰';
    img.replaceWith(fallback);
  };

  return img;
}

/** Таблица сотрудников */
export function createUsersTable(users) {
  const safe = Array.isArray(users) ? users : [];
  if (!safe.length) {
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
  safe.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.name ?? '-'}</td>
      <td>${u.week ?? 0}</td>
      <td>${u.month ?? 0}</td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  return table;
}

/** ТОП-3 лидеров без процентов */
export function createLeaderboard(users, period = 'week') {
  const safe = Array.isArray(users) ? users : [];
  const sorted = safe
    .slice()
    .sort((a, b) => (b?.[period] ?? 0) - (a?.[period] ?? 0))
    .filter(u => (u?.[period] ?? 0) > 0)
    .slice(0, 3);

  const container = document.createElement('div');
  container.classList.add('leaderboard', 'mb-4');

  if (!sorted.length) {
    const empty = document.createElement('div');
    empty.className = 'text-secondary';
    empty.textContent = 'Нет данных за период.';
    container.appendChild(empty);
    return container;
  }

  sorted.forEach((u, i) => {
    const item = document.createElement('div');
    item.innerHTML = `<strong>${i + 1}. ${u.name ?? '-'}</strong>  <span class="text-secondary">${u?.[period] ?? 0}</span>`;
    container.appendChild(item);
  });

  return container;
}
