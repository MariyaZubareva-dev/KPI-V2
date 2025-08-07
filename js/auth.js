import { API_BASE } from './config.js';

const PASSWORD = 'kpi2025'; // общий пароль

document.addEventListener('DOMContentLoaded', () => {
  const loginSection = document.getElementById('login-section');
  const user = JSON.parse(localStorage.getItem('user'));

  if (user) {
    loginSection.style.display = 'none';
    // В зависимости от роли покажем нужную часть
    // Например:
    // import('./dashboard.js').then((module) => module.renderDashboard(user));
    return;
  }

  loginSection.style.display = 'block';

  document.getElementById('login-button').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (password !== PASSWORD) {
      alert('Неверный пароль');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}?action=getUser&email=${encodeURIComponent(email)}`);
      const data = await res.json();

      if (!data || !data.ID) {
        alert('Пользователь не найден');
        return;
      }

      localStorage.setItem('user', JSON.stringify(data));
      location.reload();
    } catch (e) {
      console.error('Ошибка авторизации:', e);
      alert('Ошибка при входе');
    }
  });
});
