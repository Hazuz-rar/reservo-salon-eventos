const $ = id => document.getElementById(id);
const escapeHtml = input => { const el = document.createElement('span'); el.textContent = String(input ?? ''); return el.innerHTML; };
const token = localStorage.getItem('reservoToken');
const money = amount => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(amount);
if (!token) location.replace('login.html');
async function adminRequest(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Error del servidor.');
  return data;
}
async function loadAdmin() {
  if (!token) return;
  $('admin-error').hidden = true;
  try {
    const month = $('admin-month').value;
    const status = $('admin-status').value;
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    if (status) params.set('status', status);
    const items = await adminRequest(`/api/admin/reservations?${params}`);
    $('admin-stats').innerHTML = `<span><strong>${items.length}</strong> solicitudes</span><span><strong>${items.filter(r => r.status === 'pendiente').length}</strong> pendientes</span><span><strong>${items.filter(r => r.status === 'confirmada').length}</strong> confirmadas</span>`;
    const list = $('admin-list'); list.replaceChildren();
    if (!items.length) { list.innerHTML = '<p class="empty-state">No hay solicitudes con esos filtros.</p>'; return; }
    for (const item of items) {
      const card = document.createElement('article'); card.className = 'admin-card';
      const date = new Date(`${item.date}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
      card.innerHTML = `<div class="admin-card__main"><div class="reservation-detail__top"><h2>${escapeHtml(item.title)}</h2><span class="status-chip status-chip--${item.status}">${item.status === 'pendiente' ? 'En revisión' : escapeHtml(item.status)}</span></div><p><strong>${escapeHtml(item.eventType || 'Evento')}</strong> · ${escapeHtml(item.guestCount ?? '—')} invitados</p><p>${escapeHtml(date)} · ${escapeHtml(item.startTime)} – ${escapeHtml(item.endTime)}</p><p>Cliente: ${escapeHtml(item.customerName || 'Sin nombre')} · ${escapeHtml(item.customerEmail || 'Sin correo')}</p><p>Teléfono: ${escapeHtml(item.contactPhone || 'No registrado')}</p><div class="admin-card__billing"><p class="reservation-amount"><strong>Monto: ${money(item.amountMXN)}</strong></p>${item.status === 'cancelada' ? '<p class="payment-status payment-status--cancelled">Reservación cancelada</p>' : (item.paymentStatus === 'pendiente' ? '<p class="payment-status payment-status--pending">Pago pendiente</p>' : `<p class="payment-status">Estado de pago: ${escapeHtml(item.paymentStatus)}</p>`)}</div>${item.notes ? `<p>Notas: ${escapeHtml(item.notes)}</p>` : ''}</div><div class="admin-card__actions"></div>`;
      const actions = card.querySelector('.admin-card__actions');
      if (item.status === 'pendiente') {
        actions.appendChild(actionButton('Confirmar', 'confirmada', item.id, false));
        actions.appendChild(actionButton('Cancelar', 'cancelada', item.id, true));
      } else if (item.status === 'confirmada') {
        actions.appendChild(actionButton('Cancelar evento', 'cancelada', item.id, true));
      }
      list.appendChild(card);
    }
  } catch (error) { $('admin-error').textContent = error.message; $('admin-error').hidden = false; $('admin-list').replaceChildren(); }
}
function actionButton(label, status, id, dangerous) {
  const button = document.createElement('button'); button.type = 'button';
  button.className = `btn ${dangerous ? 'btn--danger' : 'btn--primary'}`; button.textContent = label;
  button.addEventListener('click', async () => {
    if (!confirm(`¿${label} esta solicitud?`)) return;
    button.disabled = true;
    try { await adminRequest(`/api/admin/reservations/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); await loadAdmin(); }
    catch (error) { alert(error.message); button.disabled = false; }
  });
  return button;
}
$('admin-month').value = ''; // Mostrar todos los eventos, incluidos los próximos meses.
$('admin-month').addEventListener('change', loadAdmin);
$('admin-status').addEventListener('change', loadAdmin);
$('admin-refresh').addEventListener('click', loadAdmin);
loadAdmin();
