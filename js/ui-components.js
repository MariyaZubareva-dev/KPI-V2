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
 * Прогресс-бар с персонажем и числом баллов на цветной полосе.
 * См. режимы points100/points в опциях.
 */
export function createProgressBar(value, opts = {}) {
  const {
    size = 'department',
    widthMode = 'percent',
    widthPoints,
    iconMode = 'percent',
    iconValue
  } = opts;

  // Ширина бара в процентах
  const widthPercent = (widthMode === 'points100')
    ? clampPercent(Number(widthPoints ?? iconValue ?? 0))
    : clampPercent(value);

  // Баллы (для цвета, иконки и подписи)
  const points = Number(
    iconMode === 'points'
      ? (iconValue ?? widthPoints ?? 0)
      : (widthMode === 'points100' ? (widthPoints ?? iconValue ?? 0) : 0)
  ) || 0;

  const wrapper = document.createElement('div');
  wrapper.classList.add(`progress-${size}`, 'mb-3');

  // Бар
  const bar = document.createElement('div');
  bar.classList.add('progress');
  bar.style.position = 'relative';

  const inner = document.createElement('div');
  inner.classList.add('progress-bar');
  inner.style.width = `${widthPercent}%`;

  // Важно: НЕ ставим aria-valuenow/min/max — чтобы тема не рисовала второй лейбл через ::after
  inner.setAttribute('role', 'progressbar');
  inner.setAttribute('aria-label', `Прогресс: ${formatPoints(points)} балл(ов) из 100`);

  // Цвет по порогам
  const bg = colorByPoints(points);
  inner.style.backgroundColor = bg;

  // Подпись (одна)
  inner.style.display = 'flex';
  inner.style.justifyContent = 'flex-end';
  inner.style.alignItems = 'center';
  inner.style.paddingRight = '8px';
  inner.style.whiteSpace = 'nowrap';

  const valueLabel = document.createElement('span');
  valueLabel.className = 'kpi-bar-value';
  valueLabel.textContent = formatPoints(points);
  valueLabel.style.fontWeight = '700';
  valueLabel.style.fontSize = (size === 'user') ? '14px' : '16px';
  valueLabel.style.lineHeight = '1';
  valueLabel.style.color = pickTextColor(bg);
  inner.appendChild(valueLabel);

  bar.appendChild(inner);

  // Персонаж
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
function colorByPoints(points) {
  const p = Number(points) || 0;
  if (p >= 70) return '#36B37E';
  if (p >= 50) return '#9fc5e8';
  if (p >= 30) return '#ffd966';
  return '#FF0404';
}

// Контрастный цвет текста поверх фона
function pickTextColor(bg) {
  const b = String(bg).toLowerCase();
  if (b === '#36b37e' || b === '#ff0404') return '#fff';
  return '#000';
}

// Формат "12", "12,5", "0,25"
function formatPoints(p) {
  const n = Number(p) || 0;
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

function percentToPoints(p) { return clampPercent(p); }
function labelByScore(points0to100) {
  const s = Number(points0to100) || 0;
  if (s >= 70) return 'Изобилие';
  if (s >= 50) return 'Минимум, чтобы выжить';
  if (s >= 30) return 'Зима впроголодь';
  return 'Старт';
}

/** Картинка-персонаж по баллам (или %). */
function createCharacterImage({ mode, value }) {
  const v = Number(value) || 0;
  const metric = (mode === 'points') ? v : percentToPoints(v);

  let src = './images/krosh.png';
  if (metric >= 70)       src = './images/nyusha.png';
  else if (metric >= 50)  src = './images/karkarych-sovunya.png';
  else if (metric >= 30)  src = './images/kopatych.png';

  const img = document.createElement('img');
  img.width = 64;
  img.height = 64;
  img.alt = 'KPI Character';
  img.decoding = 'async';
  img.loading = 'lazy';
  img.src = src;
  img.title = labelByScore(metric);

  img.onerror = () => {
    const fallback = document.createElement('span');
    fallback.style.fontSize = '28px';
    fallback.textContent = metric >= 70 ? '👑' : metric >= 50 ? '🍵' : metric >= 30 ? '🥕' : '🐰';
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

/** ТОП-3 (только баллы) */
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
