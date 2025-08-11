// js/ui-components.js

/**
 * Создаёт прогресс-бар с изображением при достижении порогов
 * @param {number} percent — процент заполнения (0–100)
 * @param {string} [size] — 'department' или 'user' (для CSS-классов)
 * @returns {HTMLElement}
 */
export function createProgressBar(percent, size = 'department') {
  const wrapper = document.createElement('div');
  // делаем горизонтальное выравнивание «бар + иконка»
  wrapper.classList.add(`progress-${size}`, 'mb-3', 'd-flex', 'align-items-center', 'gap-3');

  const bar = document.createElement('div');
  bar.classList.add('progress');
  // чтобы бар занимал ширину и не «сжимался»
  bar.style.flex = '1 1 auto';
  bar.style.minWidth = '280px';

  bar.innerHTML = `
    <div class="progress-bar" role="progressbar"
         style="width: ${percent}%"
         aria-valuenow="${percent}"
         aria-valuemin="0"
         aria-valuemax="100">
    </div>
  `;

  wrapper.append(bar, createCharacterImage(percent));
  return wrapper;
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
