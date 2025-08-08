import { API_BASE, COMMON_PASSWORD } from './config.js';
import { renderDashboard } from './dashboard.js';

const PASSWORD = COMMON_PASSWORD; // используем один пароль из конфига

document.addEventListener('DOMContentLoaded', () => {
  const loginSection = document.getElementById('login-section');
  const user = JSON.parse(localStorage.getItem('user'));

  if (user) {
       loginSection.style.display = 'none';
       renderDashboard(user).catch(err => {
         console.error('Ошибка при рендере дашборда:', err);
         alert('Не удалось загрузить дашборд. Проверьте консоль.');
       });
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
          ID: data.email,       // или другой уникальный идентификатор
          Email: data.email,
          role: data.role,
          Name: data.name
        };
        localStorage.setItem('user', JSON.stringify(user));
        location.reload();
        
    } catch (e) {
      console.error('Ошибка авторизации:', e);
      alert('Ошибка при входе');
    }
  });
});
