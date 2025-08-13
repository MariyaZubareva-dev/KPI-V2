// js/auth.js
import { login } from './api.js';
import { renderDashboard } from './dashboard.js';

document.addEventListener('DOMContentLoaded', () => {
  const loginSection = document.getElementById('login-section');
  const stored = safeGetUser();

  // если уже залогинен — показываем дашборд
  if (stored) {
    if (loginSection) loginSection.style.display = 'none';
    renderDashboard(stored).catch(err => {
      console.error('Ошибка при рендере дашборда:', err);
      alert('Не удалось загрузить дашборд. Проверьте консоль.');
    });
    return;
  }

  // иначе — форма логина
  if (!loginSection) return;

  loginSection.style.display = 'block';
  const btn = document.getElementById('login-button');

  btn?.addEventListener('click', async () => {
    const email = (document.getElementById('email')?.value || '').trim();
    const password = (document.getElementById('password')?.value || '');

    if (!email || !password) {
      alert('Введите email и пароль');
      return;
    }

    try {
      const resp = await login(email, password);
      if (!resp?.success) {
        alert('Неверные email или пароль');
        return;
      }

      const user = {
        id:    resp.email,     // в проекте id=email — сохраняем совместимость
        email: resp.email,
        role:  resp.role,
        name:  resp.name
      };
      localStorage.setItem('user', JSON.stringify(user));
      location.reload();
    } catch (e) {
      console.error('Ошибка авторизации:', e);
      alert('Ошибка при входе. Проверьте консоль.');
    }
  });
});

function safeGetUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}') || null; }
  catch { return null; }
}
