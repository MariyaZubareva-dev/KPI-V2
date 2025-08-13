// js/auth.js
import { login } from './api.js';
import { renderDashboard } from './dashboard.js';

document.addEventListener('DOMContentLoaded', () => {
  const loginSection = document.getElementById('login-section');
  const stored = getStoredUser(); // ← корректная проверка наличия пользователя

  if (stored) {
    if (loginSection) loginSection.style.display = 'none';
    renderDashboard(stored).catch(err => {
      console.error('Ошибка при рендере дашборда:', err);
      alert('Не удалось загрузить дашборд. Проверьте консоль.');
    });
    return;
  }

  // нет пользователя — показываем форму
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

      const user = { id: resp.email, email: resp.email, role: resp.role, name: resp.name };
      localStorage.setItem('user', JSON.stringify(user));
      location.reload();
    } catch (e) {
      console.error('Ошибка авторизации:', e);
      alert('Ошибка при входе. Проверьте консоль.');
    }
  });
});

function getStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;                     // ← ключа нет — возвращаем null
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    // минимальная валидация, чтобы не рендерить «Пользователь»
    if (!obj.email || !obj.role) return null;
    return obj;
  } catch {
    return null;
  }
}
