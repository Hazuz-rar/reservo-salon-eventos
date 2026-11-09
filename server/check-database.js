const db = require('./database');

console.log('\nUSUARIOS');
console.table(
  db.prepare(`
    SELECT
      id,
      name,
      email,
      role
    FROM users
  `).all()
);


console.log('\nRESERVACIONES');
console.table(
  db.prepare(`
    SELECT
      id,
      title,
      resource,
      date,
      startTime,
      endTime,
      userId
    FROM reservations
  `).all()
);


console.log('\nSESIONES');

console.table(
  db.prepare(`
    SELECT
      userId,
      createdAt
    FROM sessions
  `).all()
);


db.close();