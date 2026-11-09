const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'reservo-'));
const dbFile = path.join(folder, 'test.db');
// Comprobar que se migra una base SQLite de la versión anterior.
const previous = new Database(dbFile);
previous.exec(`CREATE TABLE reservations (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, resource TEXT NOT NULL, date TEXT NOT NULL,
  startTime TEXT NOT NULL, endTime TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'confirmada',
  notes TEXT DEFAULT '', userId TEXT, createdAt TEXT, updatedAt TEXT
);`);
previous.prepare('INSERT INTO reservations (id,title,resource,date,startTime,endTime) VALUES (?,?,?,?,?,?)')
  .run('antiguo', 'Evento anterior', 'Sala A', '2026-01-15', '09:00', '10:00');
previous.close();
process.env.DB_PATH = dbFile;
const app = require('../server/index');
const db = require('../server/database');
const { todayLocal } = require('../server/reservation-utils');
const date = (() => {
  const [y, m, d] = todayLocal().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 12)).toISOString().slice(0, 10);
})();

let server;
let url;
async function req(endpoint, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${url}${endpoint}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { code: response.status, data: await response.json() };
}

test.before(async () => {
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  db.close();
  fs.rmSync(folder, { recursive: true, force: true });
});

test('registro, disponibilidad privada, conflicto, aprobación y cancelación', async () => {
  assert.ok(db.prepare('PRAGMA table_info(reservations)').all().some(col => col.name === 'guestCount'));
  assert.equal(db.prepare('SELECT title FROM reservations WHERE id = ?').get('antiguo').title, 'Evento anterior');
  const password = 'claveSegura123';
  assert.equal((await req('/api/auth/register', { method: 'POST', body: { name: 'Ana', email: 'ana@test.example', password } })).code, 201);
  const login = await req('/api/auth/login', { method: 'POST', body: { email: 'ana@test.example', password } });
  assert.equal(login.code, 200);
  const token = login.data.token;
  const event = { title: 'XV años de Ana', eventType: 'XV años', guestCount: 80, contactPhone: '81 1234 5678', date, startTime: '17:00', endTime: '23:00', notes: 'Mesas redondas' };
  assert.equal((await req('/api/reservations', { method: 'POST', body: event })).code, 401);
  assert.equal((await req('/api/reservations', { method: 'POST', token, body: { ...event, date: '2023-02-31' } })).code, 400);
  const made = await req('/api/reservations', { method: 'POST', token, body: event });
  assert.equal(made.code, 201);
  assert.equal(made.data.reservation.status, 'pendiente');
  assert.equal(made.data.reservation.resource, 'Salón de eventos');
  const id = made.data.reservation.id;
  const publicList = await req(`/api/reservations?month=${date.slice(0, 7)}`);
  assert.equal(publicList.code, 200);
  assert.equal(publicList.data.length, 1);
  assert.deepEqual(Object.keys(publicList.data[0]).sort(), ['date', 'endTime', 'startTime', 'status']);
  const availability = await req(`/api/reservations/availability?date=${date}`);
  assert.equal(availability.data.slots.length, 1);
  assert.equal((await req('/api/reservations', { method: 'POST', token, body: { ...event, title: 'Boda', startTime: '18:00', endTime: '21:00' } })).code, 409);
  assert.equal((await req('/api/reservations', { method: 'POST', token, body: { ...event, title: 'Boda', startTime: '23:00', endTime: '23:30' } })).code, 201);
  assert.equal((await req('/api/admin/reservations', { token })).code, 403);
  assert.equal((await req('/api/auth/register', { method: 'POST', body: { name: 'Mario', email: 'mario@test.example', password } })).code, 201);
  const loginOther = await req('/api/auth/login', { method: 'POST', body: { email: 'mario@test.example', password } });
  const tokenOther = loginOther.data.token;
  assert.equal((await req(`/api/reservations/${id}/cancel`, { method: 'PATCH', token: tokenOther })).code, 403);
  db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run('mario@test.example');
  const adminList = await req('/api/admin/reservations', { token: tokenOther });
  assert.equal(adminList.code, 200);
  assert.equal(adminList.data.length, 2);
  assert.equal(adminList.data[0].customerEmail, 'ana@test.example');
  assert.equal((await req(`/api/admin/reservations/${id}/status`, { method: 'PATCH', token: tokenOther, body: { status: 'confirmada' } })).code, 200);
  assert.equal((await req(`/api/reservations/${id}`, { method: 'PUT', token, body: event })).code, 409);
  const cancelled = await req(`/api/reservations/${id}/cancel`, { method: 'PATCH', token });
  assert.equal(cancelled.code, 200);
  assert.equal(db.prepare('SELECT status FROM reservations WHERE id = ?').get(id).status, 'cancelada');
  assert.equal((await req(`/api/reservations/availability?date=${date}`)).data.slots.length, 1);
});
