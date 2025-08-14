// js/auth.js
import { login as apiLogin, logEvent, bootstrap } from './api.js';
import { renderDashboard } from './dashboard.js';

// утилиты
function getSavedUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}
function saveUser(u) { localStorage.setItem('user', JSON.stringify(u)); }
function normalizeUser(src, fallbackEmail = '') {
  const email = String(src?.email || src?.Email || fallbackEmail || '').toLowerCase();
  const role  = String(src?.role || '').toLowerCase();
  const name  = src?.name || src?.Name || email || 'Пользователь';
  return { email, role, name };
}

document.addEventListener('DOMContentLoaded', () => {
  const loginSection  = document.getElementById('login-section');
  const emailInput    = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginBtn      = document.getElementById('login-button');

  // если пользователь уже есть — сразу в приложение
  const saved = getSavedUser();
  if (saved && saved.email) {
    if (loginSection) loginSection.style.display = 'none';
    renderDashboard(saved).catch(err => {
      console.error('Ошибка при рендере дашборда:', err);
      alert('Не удалось загрузить дашборд. Проверьте консоль.');
    });
    return;
  }

  // показываем форму логина
  if (loginSection) loginSection.style.display = 'block';

  async function doLogin() {
    const email = String(emailInput?.value || '').trim().toLowerCase();
    const password = String(passwordInput?.value || '').trim();
    if (!email || !password) {
      alert('Введите email и пароль');
      return;
    }

    try {
      loginBtn && (loginBtn.disabled = true);

      const resp = await apiLogin(email, password);
      if (!resp || resp.success !== true) throw new Error('Неверный email или пароль');

      const user = normalizeUser(resp, email);
      saveUser(user);

      try { await logEvent('login_success', { email: user.email }); } catch {}
      try { await bootstrap(); } catch {}

      if (loginSection) loginSection.style.display = 'none';
      await renderDashboard(user);
    } catch (e) {
      console.error('Ошибка авторизации:', e);
      alert(e?.message || 'Ошибка при входе');
      try { await logEvent('login_failed', { email }); } catch {}
    } finally {
      loginBtn && (loginBtn.disabled = false);
    }
  }

  // обработчики
  loginBtn?.addEventListener('click', doLogin);
  passwordInput?.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') doLogin(); });
  emailInput?.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') doLogin(); });
});
