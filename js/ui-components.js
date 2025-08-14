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
 * @param {number} value - если widthMode='percent' это проценты (0..100), иначе игнорируется
 * @param {{
 *   size?: 'department'|'user',
 *   widthMode?: 'percent'|'points100', // чем задаём ширину бара
 *   widthPoints?: number,              // баллы 0..100 для ширины, если points100
 *   iconMode?: 'percent'|'points',     // чем выбираем иконку
 *   iconValue?: number                 // значение для иконки (проценты или баллы)
 * }} opts
 */
export function createProgressBar(value, opts = {}) {
  const {
    size = 'department',
    widthMode = 'percent',
    widthPoints,
    iconMode = 'percent',
    iconValue
  } = opts;

  // вычисляем ширину
  const widthPercent = widthMode === 'points100'
    ? clampPercent(Number(widthPoints ?? iconValue ?? 0)) // 0..100 баллов == 0..100%
    : clampPercent(value);

  const wrapper = document.createElement('div');
  wrapper.classList.add(`progress-${size}`, 'mb-3');

  // bar
  const bar = document.createElement('div');
  bar.classList.add('progress');

  const inner = document.createElement('div');
  inner.classList.add('progress-bar');
  inner.setAttribute('role', 'progressbar');
  inner.style.width = `${widthPercent}%`;
  inner.setAttribute('aria-valuenow', String(widthPercent));
  inner.setAttribute('aria-valuemin', '0');
  inner.setAttribute('aria-valuemax', '100');

  // цвет по порогам (по баллам, если widthMode='points100', иначе по процентам)
  const color = (widthMode === 'points100')
    ? colorByPoints(Number(widthPoints ?? iconValue ?? 0))
    : colorByPercent(widthPercent);
  inner.style.backgroundColor = color;

  bar.appendChild(inner);

  // character
  const charRow = document.createElement('div');
  charRow.classList.add('kpi-char-row');

  const track = document.createElement('div');
  track.classList.add('kpi-char-track');
  track.style.width = `${widthPercent}%`;
  track.style.textAlign = 'right';

  const img = createCharacterImage({
    mode: iconMode,
    value: Number(iconValue ?? (iconMode === 'percent' ? widthPercent : 0))
  });
  track.appendChild(img);
  charRow.appendChild(track);

  wrapper.append(bar, charRow);
  return wrapper;
}

/* ---------- helpers ---------- */

function clampPercent(v) {
  const n = Number(v) || 0;
  return Math.max(0, Math.min(100, n));
}

// Цвета по ТЗ:
// ≥70 — #36B37E, 50–69 — #9fc5e8, 30–49 — #ffd966, 0–29 — #FF0404
function colorByPoints(points) {
  const p = Number(points) || 0;
  if (p >= 70) return '#36B37E';
  if (p >= 50) return '#9fc5e8';
  if (p >= 30) return '#ffd966';
  return '#FF0404';
}
function colorByPercent(percent) {
  const p = Number(percent) || 0;
  if (p >= 70) return '#36B37E';
  if (p >= 50) return '#9fc5e8';
  if (p >= 30) return '#ffd966';
  return '#FF0404';
}

/** Выбор иконки по баллам (или процентам, если нужно) */
function createCharacterImage({ mode, value }) {
  let src = './images/krosh.png';
  let title = 'Старт (0–29)';

  const v = Number(value) || 0;
  const isPoints = mode === 'points';

  if ((isPoints && v >= 70) || (!isPoints && v >= 70)) {
    src = './images/nyusha.png'; title = isPoints ? 'Изобилие (≥70)' : 'Изобилие (≥70%)';
  } else if ((isPoints && v >= 50) || (!isPoints && v >= 50)) {
    src = './images/karkarych-sovunya.png'; title = isPoints ? 'Минимум, чтобы выжить (50–69)' : 'Минимум, чтобы выжить (50–69%)';
  } else if ((isPoints && v >= 30) || (!isPoints && v >= 30)) {
    src = './images/kopatych.png'; title = isPoints ? 'Зима впроголодь (30–49)' : 'Зима впроголодь (30–49%)';
  } else {
    src = './images/krosh.png'; title = isPoints ? 'Старт (0–29)' : 'Старт (0–29%)';
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
    fallback.textContent = v >= 70 ? '👑' : v >= 50 ? '🍵' : v >= 30 ? '🥕' : '🐰';
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

/** ТОП-3 лидеров (без процентов) */
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
    item.innerHTML = `<strong>${i + 1}. ${u.name ?? '-'}</strong> <span class="text-secondary">${u?.[period] ?? 0}</span>`;
    container.appendChild(item);
  });

  return container;
}
