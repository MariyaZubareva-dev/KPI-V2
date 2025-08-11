// js/ui-components.js

/**
 * Создаёт прогресс-бар с изображением при достижении порогов
 * @param {number} percent — процент заполнения (0–100)
 * @param {string} [size] — 'department' или 'user' (для CSS-классов)
 * @returns {HTMLElement}
 */
export function createProgressBar(percent, size = 'department') {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));

  const wrapper = document.createElement('div');
  // горизонтально: бар сверху, персонаж снизу
  wrapper.classList.add(`progress-${size}`, 'mb-3');

  // сам прогресс-бар
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

  // Ряд с персонажем ПОД баром, выравниваем по концу закрашенной части:
  // делаем "дорожку" шириной = процент, и выравниваем контент вправо
  const charRow = document.createElement('div');
  charRow.classList.add('kpi-char-row'); // для отступов

  const track = document.createElement('div');
  track.classList.add('kpi-char-track');
  track.style.width = `${p}%`;     // <- позиционирует по концу прогресса
  track.style.textAlign = 'right'; // <- иконка прижимается к правому краю дорожки

  const img = createCharacterImage(p);
  track.appendChild(img);
  charRow.appendChild(track);

  wrapper.append(bar, charRow);
  return wrapper;
}

function barClassByPercent(p) {
  if (p < 30) return 'bar-critical'; // красный
  if (p < 50) return 'bar-30';       // 30–49
  if (p < 70) return 'bar-50';       // 50–69
  return 'bar-70';                   // ≥70
}


function createCharacterImage(percent) {
  const img = document.createElement('img');
  img.width = 64;
  img.height = 64;
  img.alt = 'KPI Character';
  img.decoding = 'async';
  img.loading = 'lazy';

  if (percent < 30) {
    img.src = './images/krosh.png';                   // 0–29
    img.title = 'Старт (0–29)';
  } else if (percent < 50) {
    img.src = './images/kopatych.png';                // 30–49
    img.title = 'Зима впроголодь (≥30)';
  } else if (percent < 70) {
    img.src = './images/karkarych-sovunya.png';       // 50–69
    img.title = 'Минимум, чтобы выжить (≥50)';
  } else {
    img.src = './images/nyusha.png';                  // ≥70
    img.title = 'Изобилие (≥70)';
  }

  // Аккуратный фолбэк: если файла нет — показываем эмодзи, но место и клик сохраняются
  img.onerror = () => {
    const fallback = document.createElement('span');
    fallback.style.fontSize = '28px';
    if (percent < 30)      fallback.textContent = '🐰'; // Крош
    else if (percent < 50) fallback.textContent = '🥕';
    else if (percent < 70) fallback.textContent = '🍵';
    else                   fallback.textContent = '👑';
    img.replaceWith(fallback);
  };

  return img;
}


/**
 * Создаёт HTML-таблицу сотрудников и их баллов
 * @param {Array<{name: string, week: number, month: number}>} users
 * @returns {HTMLElement}
 */
export function createUsersTable(users) {
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
      <td>${u.name}</td>
      <td>${u.week}</td>
      <td>${u.month}</td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  return table;
}

/**
 * Создаёт блок ТОП-3 лидеров для заданного периода
 * @param {Array<{name: string, week: number, month: number}>} users
 * @param {'week'|'month'} period
 * @returns {HTMLElement}
 */
export function createLeaderboard(users, period = 'week') {
  // Сортируем по нужному периоду и берём 3 первых
  const sorted = [...users]
    .sort((a, b) => b[period] - a[period])
    .slice(0, 3);

  const container = document.createElement('div');
  container.classList.add('leaderboard', 'mb-4');

  sorted.forEach(u => {
    const item = document.createElement('div');
    item.textContent = `${u.name}: ${u[period]}`;
    container.appendChild(item);
  });

  return container;
}
