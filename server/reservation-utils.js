const VENUE = 'Salón de eventos';
const TIME_ZONE = process.env.APP_TIME_ZONE || 'America/Monterrey';

function todayLocal() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function validDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
}

function validTime(time) {
  return typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

function validateReservation(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Envía los datos de la reservación.';
  const { title, eventType, guestCount, contactPhone, date, startTime, endTime, notes } = body;
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 120) return 'Escribe el nombre del evento (máximo 120 caracteres).';
  if (typeof eventType !== 'string' || !eventType.trim() || eventType.trim().length > 80) return 'Selecciona el tipo de evento.';
  if (!Number.isInteger(guestCount) || guestCount <= 0 || guestCount > 100000) return 'Indica un número válido de invitados.';
  if (typeof contactPhone !== 'string' || !/^[+\d()\s.-]{7,24}$/.test(contactPhone.trim()) || contactPhone.replace(/\D/g, '').length < 7) return 'Indica un teléfono de contacto válido.';
  if (!validDate(date)) return 'La fecha del evento no es válida.';
  if (date < todayLocal()) return 'No puedes solicitar una fecha anterior a hoy.';
  if (!validTime(startTime) || !validTime(endTime) || startTime >= endTime) return 'El horario debe tener un inicio anterior al fin, dentro del mismo día.';
  if (notes != null && (typeof notes !== 'string' || notes.length > 2000)) return 'Las notas deben tener máximo 2000 caracteres.';
  return null;
}

function overlappingReservation(db, { date, startTime, endTime, excludeId = '' }) {
  return db.prepare(`
    SELECT id, startTime, endTime, status FROM reservations
    WHERE resource = ? AND date = ? AND id != ?
      AND status IN ('pendiente', 'confirmada')
      AND ? < endTime AND ? > startTime LIMIT 1
  `).get(VENUE, date, excludeId, startTime, endTime);
}

module.exports = { VENUE, todayLocal, validDate, validateReservation, overlappingReservation };
