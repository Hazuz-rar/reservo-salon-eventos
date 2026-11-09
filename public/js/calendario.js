(() => {
  const $ = id => document.getElementById(id);
  const dateISO = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const monthKey = date => dateISO(date).slice(0, 7);
  const formatDate = iso => new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const escapeHtml = value => { const el = document.createElement('span'); el.textContent = value || ''; return el.innerHTML; };
  let viewDate = new Date();
  let selectedDate = dateISO();
  let monthReservations = [];
  let editingId = null;
  const modal = $('reservation-modal');
  const form = $('reservation-form');
  const dateInput = $('reservation-date');
  async function loadPricing() {
    try {
      const pricing = await getJSON('/api/reservations/pricing');
      const amount = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(pricing.amountMXN);
      $('reservation-price').textContent = `Costo de reservación: ${amount} MXN. Pago pendiente de confirmación.`;
    } catch (_error) {
      $('reservation-price').textContent = 'No se pudo consultar el monto. Inténtalo de nuevo antes de solicitar.';
    }
  }
  dateInput.min = dateISO();

  function authHeaders() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('reservoToken') || ''}` };
  }

  async function getJSON(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No se pudo completar la operación.');
    return data;
  }

  async function loadMonth() {
    $('calendar-error').hidden = true;
    try {
      monthReservations = await getJSON(`/api/reservations?month=${monthKey(viewDate)}`);
      renderCalendar();
      renderAgenda();
    } catch (error) {
      $('calendar-error').textContent = error.message;
      $('calendar-error').hidden = false;
    }
  }

  function renderCalendar() {
    $('month-label').textContent = viewDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    const grid = $('calendar-grid');
    grid.replaceChildren();
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    for (let i = 0; i < 42; i++) {
      const current = new Date(year, month, 1 - offset + i);
      const iso = dateISO(current);
      const slots = monthReservations.filter(item => item.date === iso);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'day-cell';
      if (current.getMonth() !== month) button.classList.add('is-outside');
      if (iso === dateISO()) button.classList.add('is-today');
      if (iso === selectedDate) button.classList.add('is-selected');
      button.setAttribute('aria-label', `${formatDate(iso)}: ${slots.length} horario(s) solicitado(s)`);
      const number = document.createElement('span'); number.className = 'day-cell__num'; number.textContent = current.getDate();
      const dots = document.createElement('span'); dots.className = 'day-cell__dots';
      for (const status of new Set(slots.map(item => item.status))) {
        const dot = document.createElement('span'); dot.className = `dot dot--${status}`; dots.appendChild(dot);
      }
      button.append(number, dots);
      button.addEventListener('click', () => {
        selectedDate = iso;
        if (current.getMonth() !== month) { viewDate = new Date(current.getFullYear(), current.getMonth(), 1); loadMonth(); }
        else { renderCalendar(); renderAgenda(); }
      });
      grid.appendChild(button);
    }
  }

  function renderAgenda() {
    $('agenda-date').textContent = formatDate(selectedDate);
    const list = $('agenda-list');
    list.replaceChildren();
    const slots = monthReservations.filter(item => item.date === selectedDate);
    $('agenda-counter').textContent = slots.length
      ? `${slots.length} horario(s) con solicitud o reserva`
      : 'No hay horarios ocupados registrados';
    if (!slots.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No hay solicitudes en esta fecha. Consulta el horario que te interesa.';
      list.appendChild(empty);
    }
    for (const item of slots) {
      const card = document.createElement('div');
      card.className = 'res-card';
      card.dataset.status = item.status;
      card.innerHTML = `<div class="res-card__time">${escapeHtml(item.startTime)} – ${escapeHtml(item.endTime)}</div><div class="res-card__title">${item.status === 'pendiente' ? 'Horario en revisión' : 'Horario reservado'}</div><div class="res-card__resource">${item.status === 'pendiente' ? 'Existe una solicitud pendiente' : 'Reserva confirmada'}</div>`;
      list.appendChild(card);
    }
    $('selected-date-btn').disabled = selectedDate < dateISO();
  }

  function openNewReservation() {
    if (!localStorage.getItem('reservoToken')) { location.href = 'login.html?next=calendario.html'; return; }
    editingId = null;
    form.reset();
    dateInput.min = dateISO();
    dateInput.value = selectedDate >= dateISO() ? selectedDate : dateISO();
    $('reservation-modal-title').textContent = 'Solicitar fecha para tu evento';
    $('reservation-submit-btn').textContent = 'Enviar solicitud';
    $('availability-message').textContent = '';
    loadPricing();
    modal.showModal();
  }

  function closeModal() { modal.close(); editingId = null; form.reset(); }

  function values() {
    return {
      title: $('reservation-title').value.trim(),
      eventType: $('reservation-event-type').value,
      guestCount: Number($('reservation-guests').value),
      contactPhone: $('reservation-phone').value.trim(),
      date: dateInput.value,
      startTime: $('reservation-start').value,
      endTime: $('reservation-end').value,
      notes: $('reservation-notes').value.trim()
    };
  }

  async function checkAvailability() {
    const { date, startTime, endTime } = values();
    const message = $('availability-message');
    if (!date || !startTime || !endTime || startTime >= endTime) {
      message.textContent = 'Selecciona una fecha y un horario válido para consultar disponibilidad.';
      return;
    }
    try {
      const result = await getJSON(`/api/reservations/availability?date=${encodeURIComponent(date)}`);
      const conflicts = result.slots.filter(slot => startTime < slot.endTime && endTime > slot.startTime);
      const ownEditing = Boolean(editingId);
      // En edición, el servidor excluye la propia reserva. La vista pública puede mostrarla.
      message.textContent = conflicts.length
        ? (ownEditing ? 'Hay horarios ocupados. El servidor comprobará si alguno pertenece a otra solicitud.' : 'Este horario ya está ocupado o en revisión. Elige otro.')
        : 'Este horario no presenta conflictos registrados. La disponibilidad se verificará al enviar.';
      message.className = `availability-message ${conflicts.length ? 'availability-message--busy' : 'availability-message--free'}`;
    } catch (error) { message.textContent = error.message; }
  }

  async function openEditFromProfile() {
    const id = new URLSearchParams(location.search).get('editar');
    if (!id) return;
    const token = localStorage.getItem('reservoToken');
    if (!token) return;
    try {
      const mine = await getJSON('/api/reservations/mine', { headers: authHeaders() });
      const reservation = mine.find(item => item.id === id && item.status === 'pendiente');
      if (!reservation) throw new Error('La solicitud no existe o ya no se puede editar.');
      editingId = id;
      for (const [field, value] of Object.entries({
        'reservation-title': reservation.title,
        'reservation-event-type': reservation.eventType || 'Otro',
        'reservation-guests': reservation.guestCount || 1,
        'reservation-phone': reservation.contactPhone || '',
        'reservation-date': reservation.date,
        'reservation-start': reservation.startTime,
        'reservation-end': reservation.endTime,
        'reservation-notes': reservation.notes || ''
      })) $(field).value = value;
      $('reservation-modal-title').textContent = 'Editar solicitud pendiente';
      $('reservation-submit-btn').textContent = 'Guardar cambios';
      $('availability-message').textContent = '';
      selectedDate = reservation.date;
      const [y, m] = reservation.date.split('-').map(Number);
      viewDate = new Date(y, m - 1, 1);
      await loadMonth();
      loadPricing();
      modal.showModal();
    } catch (error) { alert(error.message); }
    finally { history.replaceState({}, '', 'calendario.html'); }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const payload = values();
    if (payload.startTime >= payload.endTime) { alert('La hora de término debe ser posterior a la de inicio.'); return; }
    const button = $('reservation-submit-btn');
    button.disabled = true;
    try {
      const editing = Boolean(editingId);
      const data = await getJSON(editing ? `/api/reservations/${encodeURIComponent(editingId)}` : '/api/reservations', {
        method: editing ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(payload)
      });
      alert(data.message);
      selectedDate = payload.date;
      const [y, m] = payload.date.split('-').map(Number);
      viewDate = new Date(y, m - 1, 1);
      closeModal();
      await loadMonth();
    } catch (error) { alert(error.message); }
    finally { button.disabled = false; }
  });

  $('new-reservation-btn').addEventListener('click', openNewReservation);
  $('selected-date-btn').addEventListener('click', openNewReservation);
  $('close-reservation-modal').addEventListener('click', closeModal);
  $('cancel-reservation').addEventListener('click', closeModal);
  $('check-availability-btn').addEventListener('click', checkAvailability);
  $('prev-month').addEventListener('click', () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1); loadMonth(); });
  $('next-month').addEventListener('click', () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1); loadMonth(); });
  $('today-btn').addEventListener('click', () => { selectedDate = dateISO(); viewDate = new Date(); loadMonth(); });
  modal.addEventListener('close', () => { editingId = null; });
  loadMonth();
  openEditFromProfile();
})();
