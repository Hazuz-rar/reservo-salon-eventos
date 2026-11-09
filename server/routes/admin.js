const express = require('express');
const db = require('../database');
const { requireUser, requireAdmin } = require('../auth-middleware');
const { VENUE, overlappingReservation } = require('../reservation-utils');
const router = express.Router();
router.use(requireUser, requireAdmin);

router.get('/reservations', (req, res) => {
  const { month, status } = req.query;
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return res.status(400).json({ message: 'Mes no válido.' });
  if (status && !['pendiente', 'confirmada', 'cancelada'].includes(status)) return res.status(400).json({ message: 'Estado no válido.' });
  let sql = `SELECT reservations.*, users.name AS customerName, users.email AS customerEmail
    FROM reservations LEFT JOIN users ON users.id = reservations.userId WHERE reservations.resource = ?`;
  const params = [VENUE];
  if (month) { sql += ' AND reservations.date LIKE ?'; params.push(`${month}-%`); }
  if (status) { sql += ' AND reservations.status = ?'; params.push(status); }
  sql += ` ORDER BY CASE reservations.status WHEN 'pendiente' THEN 0 ELSE 1 END, reservations.date ASC, reservations.startTime ASC`;
  res.json(db.prepare(sql).all(...params));
});

const setStatus = db.transaction((id, status) => {
  const item = db.prepare('SELECT * FROM reservations WHERE id = ? AND resource = ?').get(id, VENUE);
  if (!item) return { missing: true };
  if (item.status === 'cancelada') return { conflict: 'No se pueden reabrir solicitudes canceladas.' };
  if (item.status === status) return { conflict: 'La solicitud ya tiene ese estado.' };
  if (item.status !== 'pendiente' && status === 'confirmada') return { conflict: 'Solo se pueden confirmar solicitudes pendientes.' };
  if (status === 'confirmada' && overlappingReservation(db, { ...item, excludeId: item.id })) {
    return { conflict: 'El horario ya está ocupado.' };
  }
  db.prepare('UPDATE reservations SET status = ?, updatedAt = ? WHERE id = ?')
    .run(status, new Date().toISOString(), id);
  return { reservation: db.prepare('SELECT * FROM reservations WHERE id = ?').get(id) };
});

router.patch('/reservations/:id/status', (req, res) => {
  const status = req.body?.status;
  if (!['confirmada', 'cancelada'].includes(status)) return res.status(400).json({ message: 'El estado debe ser confirmada o cancelada.' });
  try {
    const result = setStatus.immediate(req.params.id, status);
    if (result.missing) return res.status(404).json({ message: 'Solicitud no encontrada.' });
    if (result.conflict) return res.status(409).json({ message: result.conflict });
    return res.json({ message: status === 'confirmada' ? 'Evento confirmado.' : 'Solicitud cancelada.', reservation: result.reservation });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No fue posible cambiar el estado.' });
  }
});
module.exports = router;
