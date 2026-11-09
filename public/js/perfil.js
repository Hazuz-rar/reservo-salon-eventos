const $ = id => document.getElementById(id);
const escapeHtml = value => { const el = document.createElement('span'); el.textContent = String(value ?? ''); return el.innerHTML; };
const formatDate = date => new Date(`${date}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
const token = localStorage.getItem('reservoToken');
const money = amount => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(amount);
if (!token) window.location.replace('login.html');

async function authFetch(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Error al consultar el servidor.');
  return data;
}

async function loadProfile() {
  if (!token) return;
  try {
    const [account, reservations] = await Promise.all([authFetch('/api/auth/me'), authFetch('/api/reservations/mine')]);
    $('profile-name').textContent = account.user.name;
    $('profile-email').textContent = account.user.email;
    $('profile-role').textContent = account.user.role === 'admin' ? 'Administrador' : 'Cliente';
    $('reservation-count').textContent = reservations.length;
    const list = $('profile-reservations');
    list.replaceChildren();
    if (!reservations.length) { list.innerHTML = '<p class="empty-state">Todavía no tienes solicitudes. <a href="calendario.html">Consulta el calendario</a>.</p>'; return; }
    for (const item of reservations) {
      const card = document.createElement('article');
      card.className = 'profile-reservation';
      card.innerHTML = `<div class="reservation-detail"><div class="reservation-detail__top"><strong>${escapeHtml(item.title)}</strong><span class="status-chip status-chip--${item.status}">${item.status === 'pendiente' ? 'En revisión' : escapeHtml(item.status)}</span></div><p>${escapeHtml(item.eventType || 'Evento')} · ${escapeHtml(item.guestCount ?? '—')} invitados</p><small>Contacto: ${escapeHtml(item.contactPhone || 'No registrado')}</small><p class="reservation-amount">Monto: <strong>${money(item.amountMXN)}</strong></p></div><div class="profile-reservation__date"><strong>${formatDate(item.date)}</strong><span>${escapeHtml(item.startTime)} – ${escapeHtml(item.endTime)}</span><div class="res-card__actions"></div></div>`;
      const actions = card.querySelector('.res-card__actions');
      if (item.status === 'pendiente') {
        const link = document.createElement('a');
        link.className = 'btn btn--secondary btn--small';
        link.href = `calendario.html?editar=${encodeURIComponent(item.id)}`;
        link.textContent = 'Editar'; actions.appendChild(link);
      }
      if (item.status !== 'cancelada') {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'btn btn--danger btn--small'; button.textContent = 'Cancelar';
        button.addEventListener('click', async () => {
          if (!confirm('¿Cancelar esta solicitud? Se conservará en tu historial.')) return;
          try { await authFetch(`/api/reservations/${encodeURIComponent(item.id)}/cancel`, { method: 'PATCH' }); await loadProfile(); }
          catch (error) { alert(error.message); }
        });
        actions.appendChild(button);
      }
      list.appendChild(card);
    }
  } catch (error) {
    $('profile-reservations').textContent = error.message;
    if (/sesión|autenticación/i.test(error.message)) window.location.replace('login.html');
  }
}
document.addEventListener('DOMContentLoaded', loadProfile);
