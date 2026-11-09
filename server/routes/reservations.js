const express = require('express');
const crypto = require('crypto');
const db = require('../database');
const { requireUser } = require('../auth-middleware');
const { VENUE, validDate, validateReservation, overlappingReservation } = require('../reservation-utils');
const router = express.Router();
const { RESERVATION_AMOUNT_MXN } = require('../pricing');

// Precio de muestra, separado del estado de confirmación. No procesa pagos.
router.get('/pricing', (_req, res) => {
  res.json({ amountMXN: RESERVATION_AMOUNT_MXN, currency: 'MXN', example: true });
});

// Los visitantes consultan ocupación, nunca datos de contacto ni nombres privados.
router.get('/availability', (req, res) => {
  if (!validDate(req.query.date)) return res.status(400).json({ message: 'Fecha no válida.' });
  const slots = db.prepare(`
    SELECT date, startTime, endTime, status FROM reservations
    WHERE resource = ? AND date = ? AND status IN ('pendiente', 'confirmada')
    ORDER BY startTime
  `).all(VENUE, req.query.date);
  res.json({ date: req.query.date, slots });
});

router.get('/mine', requireUser, (req, res) => {
  const reservations = db.prepare(`
    SELECT * FROM reservations WHERE userId = ? AND resource = ?
    ORDER BY date DESC, startTime ASC
  `).all(req.user.id, VENUE);
  res.json(reservations);
});

router.get('/', (req, res) => {
  const month = req.query.month;
  if (month && (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))) {
    return res.status(400).json({ message: 'Mes no válido. Usa YYYY-MM.' });
  }
  let query = `SELECT date, startTime, endTime, status FROM reservations
    WHERE resource = ? AND status IN ('pendiente', 'confirmada')`;
  const values = [VENUE];
  if (month) { query += ' AND date LIKE ?'; values.push(`${month}-%`); }
  query += ' ORDER BY date ASC, startTime ASC';
  res.json(db.prepare(query).all(...values));
});

const createTransaction = db.transaction((reservation) => {
  const overlap = overlappingReservation(db, reservation);
  if (overlap) return { overlap };
  db.prepare(`INSERT INTO reservations
    (id, title, resource, date, startTime, endTime, status, notes, userId,
      createdAt, updatedAt, eventType, guestCount, contactPhone, amountMXN, paymentStatus)
    VALUES (@id, @title, @resource, @date, @startTime, @endTime, @status, @notes, @userId,
      @createdAt, @updatedAt, @eventType, @guestCount, @contactPhone, @amountMXN, @paymentStatus)`).run(reservation);
  return { reservation };
});

router.post('/', requireUser, (req, res) => {
  const message = validateReservation(req.body);
  if (message) return res.status(400).json({ message });
  const { title, eventType, guestCount, contactPhone, date, startTime, endTime, notes } = req.body;
  const reservation = {
    id: crypto.randomUUID(), title: title.trim(), resource: VENUE, date, startTime, endTime,
    status: 'pendiente', notes: (notes || '').trim(), userId: req.user.id,
    createdAt: new Date().toISOString(), updatedAt: null,
    eventType: eventType.trim(), guestCount, contactPhone: contactPhone.trim(),
    amountMXN: RESERVATION_AMOUNT_MXN, paymentStatus: 'pendiente'
  };
  try {
    const outcome = createTransaction.immediate(reservation);
    if (outcome.overlap) return res.status(409).json({ message: 'El salón ya tiene una solicitud o reserva en ese horario. Elige otro horario o fecha.' });
    return res.status(201).json({ message: 'Solicitud enviada. Está pendiente de revisión por el salón.', reservation });
  } catch (error) {
    console.error('Error al registrar solicitud:', error);
    return res.status(500).json({ message: 'No fue posible registrar la solicitud.' });
  }
});

const updateTransaction = db.transaction((id, body) => {
  const overlap = overlappingReservation(db, { ...body, excludeId: id });
  if (overlap) return { overlap };
  const result = db.prepare(`UPDATE reservations SET title = ?, eventType = ?, guestCount = ?,
    contactPhone = ?, date = ?, startTime = ?, endTime = ?, notes = ?, updatedAt = ?
    WHERE id = ? AND status = 'pendiente'`).run(
    body.title.trim(), body.eventType.trim(), body.guestCount, body.contactPhone.trim(),
    body.date, body.startTime, body.endTime, (body.notes || '').trim(), new Date().toISOString(), id
  );
  return { changes: result.changes };
});

router.put('/:id', requireUser, (req, res) => {
  const existing = db.prepare('SELECT * FROM reservations WHERE id = ? AND resource = ?').get(req.params.id, VENUE);
  if (!existing) return res.status(404).json({ message: 'Solicitud no encontrada.' });
  if (existing.userId !== req.user.id) return res.status(403).json({ message: 'No puedes modificar esta solicitud.' });
  if (existing.status !== 'pendiente') return res.status(409).json({ message: 'Solo puedes editar solicitudes pendientes.' });
  const message = validateReservation(req.body);
  if (message) return res.status(400).json({ message });
  try {
    const outcome = updateTransaction.immediate(existing.id, req.body);
    if (outcome.overlap) return res.status(409).json({ message: 'Ya existe una reserva o solicitud en ese horario.' });
    if (!outcome.changes) return res.status(409).json({ message: 'La solicitud cambió de estado. Actualiza la página.' });
    return res.json({ message: 'Solicitud actualizada.', reservation: db.prepare('SELECT * FROM reservations WHERE id = ?').get(existing.id) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No fue posible actualizar la solicitud.' });
  }
});

function cancelReservation(req, res) {
  const existing = db.prepare('SELECT * FROM reservations WHERE id = ? AND resource = ?').get(req.params.id, VENUE);
  if (!existing) return res.status(404).json({ message: 'Solicitud no encontrada.' });
  if (existing.userId !== req.user.id) return res.status(403).json({ message: 'No puedes cancelar esta solicitud.' });
  if (existing.status === 'cancelada') return res.status(409).json({ message: 'La solicitud ya está cancelada.' });
  db.prepare(`UPDATE reservations SET status = 'cancelada', updatedAt = ? WHERE id = ?`).run(new Date().toISOString(), existing.id);
  return res.json({ message: 'Solicitud cancelada. Se conservó en el historial.' });
}

router.patch('/:id/cancel', requireUser, cancelReservation);
// Compatibilidad con la interfaz anterior, sin eliminar el historial.
router.delete('/:id', requireUser, cancelReservation);

module.exports = router;
