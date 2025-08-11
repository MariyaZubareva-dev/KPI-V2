import { API_BASE } from './config.js';
import { renderDashboard } from './dashboard.js';

document.addEventListener('DOMContentLoaded', () => {
  const loginSection = document.getElementById('login-section');
  const user = JSON.parse(localStorage.getItem('user'));

  if (user) {
    if (loginSection) loginSection.style.display = 'none';
    renderDashboard(user).catch(err => {
      console.error('Ошибка при рендере дашборда:', err);
      alert('Не удалось загрузить дашборд. Проверьте консоль.');
    });
    return;
  }

  if (loginSection) {
    loginSection.style.display = 'block';
    const btn = document.getElementById('login-button');
    btn?.addEventListener('click', async () => {
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
        location.reload();
      } catch (e) {
        console.error('Ошибка авторизации:', e);
        alert('Ошибка при входе');
      }
    });
  }
});
