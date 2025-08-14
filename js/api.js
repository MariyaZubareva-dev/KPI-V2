// js/auth.js
import { login as apiLogin, logout as apiLogout, logEvent, bootstrap } from './api.js';
import { renderDashboard } from './dashboard.js';

// Небольшая утилита нормализации пользователя
function normalizeUser(src, fallbackEmail = '') {
  const email = String(src?.email || src?.Email || fallbackEmail || '').toLowerCase();
  const role  = String(src?.role || '').toLowerCase();
  const name  = src?.name || src?.Name || email || 'Пользователь';
  return { email, role, name };
}

// UI-хэлперы
function $(sel) { return document.querySelector(sel); }
function show(el) { el && el.classList.remove('d-none'); }
function hide(el) { el && el.classList.add('d-none'); }
function setError(msg) {
  const box = $('#auth-error');
  if (box) { box.textContent = msg || ''; box.style.display = msg ? 'block' : 'none'; }
}

async function goToApp(user) {
  hide($('#auth-view'));
  show($('#app'));
  await renderDashboard(user);
}

// Автологин, если пользователь уже сохранён
try {
  const saved = localStorage.getItem('user');
  if (saved) {
    const user = JSON.parse(saved);
    await goToApp(user);
  } else {
    show($('#auth-view'));
    hide($('#app'));
  }
} catch {
  show($('#auth-view'));
  hide($('#app'));
}

// Инициализация формы логина
const form = $('#login-form');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setError('');
    const submitBtn = form.querySelector('button[type="submit"]');

    // Селекторы полей (адаптивные на случай разных id/name)
    const emailInput    = form.querySelector('#email, [name="email"]');
    const passwordInput = form.querySelector('#password, [name="password"]');

    const email = String(emailInput?.value || '').trim().toLowerCase();
    const password = String(passwordInput?.value || '').trim();

    if (!email || !password) {
      setError('Введите email и пароль.');
      return;
    }

    try {
      submitBtn && (submitBtn.disabled = true);
      submitBtn && (submitBtn.dataset.prev = submitBtn.textContent);
      submitBtn && (submitBtn.textContent = 'Входим…');

      const resp = await apiLogin(email, password);
      if (!resp || resp.success !== true) {
        // единый текст ошибки, чтобы не светить причину
        throw new Error('Неверный email или пароль.');
      }

      // Нормализуем пользователя: { email, role, name }
      const user = normalizeUser(resp, email);

      // Сохраняем в localStorage
      localStorage.setItem('user', JSON.stringify(user));
      try { await logEvent('login_success', { email: user.email }); } catch {}

      // (Опционально) быстрый прогрев первичных данных
      try { await bootstrap(); } catch {}

      await goToApp(user);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Ошибка входа, попробуйте ещё раз.');
      try { await logEvent('login_failed', { email }); } catch {}
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        if (submitBtn.dataset.prev) submitBtn.textContent = submitBtn.dataset.prev;
      }
    }
  });
}
// Единый батч для начальной загрузки
export async function bootstrap() {
  const data = await httpGet('/bootstrap');
  if (data?.success === false) throw new Error(data?.message || 'bootstrap returned error');
  return data.data ?? data; // { dept, users, usersPrevWeek }
}


// Глобальный logout (если у тебя есть кнопка вне dashboard.js — привяжи здесь)
const logoutBtn = $('#logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    const saved = localStorage.getItem('user');
    const email = saved ? (JSON.parse(saved)?.email || '') : '';
    try { await apiLogout(email); } catch {}
    localStorage.removeItem('user');
    location.reload();
  });
}
