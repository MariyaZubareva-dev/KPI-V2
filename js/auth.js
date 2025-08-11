import { API_BASE } from './config.js';
import { renderDashboard } from './dashboard.js';
import { logEvent } from './api.js';   // ← импорт

document.addEventListener('DOMContentLoaded', () => {
  const loginSection = document.getElementById('login-section');
  const user = JSON.parse(localStorage.getItem('user'));

  if (user) {
    // Если логин-блок есть в DOM — скроем; если нет — просто продолжим
    if (loginSection) loginSection.style.display = 'none';

    renderDashboard(user).catch(err => {
      console.error('Ошибка при рендере дашборда:', err);
      alert('Не удалось загрузить дашборд. Проверьте консоль.');
    });
    return;
  }

  // Логин-форма должна быть видна только если её элемент реально присутствует
  if (loginSection) {
    loginSection.style.display = 'block';

    const btn = document.getElementById('login-button');
    if (btn) {
      btn.addEventListener('click', async () => {
        const email = (document.getElementById('email')?.value || '').trim();
        const password = (document.getElementById('password')?.value || '');

        try {
          const url = new URL(API_BASE);
          url.searchParams.set('action', 'login');
          url.searchParams.set('email', email);
          url.searchParams.set('password', password);
          const res = await fetch(url);
          const data = await res.json();

          if (!data.success) {
            alert('Неверные email или пароль');
            return;
          }

          const user = {
            id:    data.email,
            email: data.email,
            role:  data.role,
            name:  data.name
          };
          localStorage.setItem('user', JSON.stringify(user));
          location.reload(); // после входа просто перезагружаем
        } catch (e) {
          console.error('Ошибка авторизации:', e);
          alert('Ошибка при входе');
        }
      });
    }
  } else {
    console.warn('login-section не найден в DOM');
  }
});
