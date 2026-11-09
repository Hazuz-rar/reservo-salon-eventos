document.addEventListener('DOMContentLoaded', updateSessionMenu);

async function updateSessionMenu() {
  const token = localStorage.getItem('reservoToken');
  if (!token) { showLoggedOutMenu(); return; }
  try {
    const response = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error('Sesión vencida.');
    const { user } = await response.json();
    localStorage.setItem('reservoUser', JSON.stringify(user));
    const login = document.getElementById('loginLink');
    const register = document.getElementById('registerLink');
    const section = document.getElementById('userSection');
    const name = document.getElementById('userName');
    if (login) login.hidden = true;
    if (register) register.hidden = true;
    if (section) { section.hidden = false; section.style.display = 'flex'; }
    if (name) name.textContent = `Hola, ${user.name}`;
    const oldAdmin = document.getElementById('adminNavLink');
    if (oldAdmin) oldAdmin.remove();
    if (user.role === 'admin' && section) {
      const link = document.createElement('a');
      link.href = 'administracion.html'; link.id = 'adminNavLink'; link.className = 'sidebar__link';
      link.textContent = 'Administrar eventos';
      section.insertBefore(link, section.querySelector('.sidebar__logout'));
      if (location.pathname.endsWith('administracion.html')) link.classList.add('is-active');
    }
  } catch (error) {
    localStorage.removeItem('reservoToken');
    localStorage.removeItem('reservoUser');
    showLoggedOutMenu();
  }
}

function showLoggedOutMenu() {
  const login = document.getElementById('loginLink');
  const register = document.getElementById('registerLink');
  const section = document.getElementById('userSection');
  if (login) { login.hidden = false; login.style.display = ''; }
  if (register) { register.hidden = false; register.style.display = ''; }
  if (section) { section.hidden = true; section.style.display = 'none'; }
}

async function logout() {
  const token = localStorage.getItem('reservoToken');
  try {
    if (token) await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch (error) { console.error('Error al cerrar sesión:', error); }
  finally {
    localStorage.removeItem('reservoToken');
    localStorage.removeItem('reservoUser');
    location.href = 'inicio.html';
  }
}
