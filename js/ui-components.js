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
 * Прогресс-бар с иконкой-персонажем
 * percent — ширина бара
 * opts.iconMode: 'percent' | 'points' — по чему выбирать картинку
 * opts.valueForIcon: число, если iconMode = 'points' (например, monthSum)
 */
export function createProgressBar(percent, size = 'department', opts = {}) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  const { iconMode = 'percent', valueForIcon = null } = opts;

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

  const img = (iconMode === 'points' && typeof valueForIcon === 'number')
    ? createCharacterImageByPoints(valueForIcon)
    : createCharacterImageByPercent(p);

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

/** Картинка по проценту (для личных прогрессов и т.п.) */
function createCharacterImageByPercent(percent) {
  return buildImage(
    percent < 30 ? './images/krosh.png'
  : percent < 50 ? './images/kopatych.png'
  : percent < 70 ? './images/karkarych-sовunya.png'
                 : './images/nyusha.png',
    percent < 30 ? 'Старт (0–29%)'
  : percent < 50 ? '≥30% от цели'
  : percent < 70 ? '≥50% от цели'
                 : '≥70% от цели'
  );
}

/** Картинка по абсолютным баллам (для «Прогресс отдела (месяц)») */
function createCharacterImageByPoints(points) {
  const v = Number(points) || 0;
  return buildImage(
    v < 30 ? './images/krosh.png'
  : v < 50 ? './images/kopatych.png'
  : v < 70 ? './images/karkarych-sовunya.png'
           : './images/nyusha.png',
    v < 30 ? '0–29 баллов'
  : v < 50 ? '30–49 баллов'
  : v < 70 ? '50–69 баллов'
           : '70+ баллов'
  );
}

function buildImage(src, title) {
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
    if (/0–29|0-29|0–29%/.test(title))       fallback.textContent = '🐰';
    else if (/30–49|30-49/.test(title))      fallback.textContent = '🥕';
    else if (/50–69|50-69/.test(title))      fallback.textContent = '🍵';
    else                                     fallback.textContent = '👑';
    img.replaceWith(fallback);
  };
  return img;
}

/** Таблица сотрудников */
export function createUsersTable(users) {
  const safe = Array.isArray(users) ? users : [];
  if (safe.length === 0) {
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

/* ---------- BADGES (оставляем, если нужны) ---------- */
export const BADGE_THRESHOLDS = [
  { pct: 100, icon: '🏆', title: '100% цели' },
  { pct: 75,  icon: '🥇', title: '75%+ цели' },
  { pct: 50,  icon: '🥈', title: '50%+ цели' },
  { pct: 25,  icon: '🥉', title: '25%+ цели' },
];
export function badgeForPercent(pct) {
  for (const b of BADGE_THRESHOLDS) if (pct >= b.pct) return b;
  return null;
}
export function renderBadge(pct) {
  const b = badgeForPercent(pct);
  if (!b) return null;
  const span = document.createElement('span');
  span.className = 'badge-icon';
  span.textContent = b.icon;
  span.title = b.title;
  return span;
}

/** ТОП-3 лидеров: убрали проценты, оставили только баллы (бейджи — опционально) */
export function createLeaderboard(employees, mode = 'week', perUserMax = 1) {
  const safe = Array.isArray(employees) ? employees : [];
  const sorted = safe
    .slice()
    .sort((a, b) => {
      const av = mode === 'week' ? Number(a.week || 0) : Number(a.month || 0);
      const bv = mode === 'week' ? Number(b.week || 0) : Number(b.month || 0);
      return bv - av;
    })
    .filter(u => (mode === 'week' ? Number(u.week||0) : Number(u.month||0)) > 0)
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
    const points = mode === 'week' ? Number(u.week || 0) : Number(u.month || 0);
    const pct = perUserMax ? Math.round(points / perUserMax * 100) : 0; // для бейджа
    const badge = renderBadge(pct);

    const row = document.createElement('div');
    row.className = 'd-flex align-items-center gap-2 my-1';

    const name = document.createElement('div');
    name.className = 'fw-bold';
    name.textContent = `${i + 1}. ${u.name ?? '-'}`;

    const meta = document.createElement('div');
    meta.className = 'text-secondary';
    meta.textContent = `${points}`; // ← проценты убраны

    row.append(name, meta);
    if (badge) row.append(badge); // можно убрать, если не нужны
    container.appendChild(row);
  });

  return container;
}
