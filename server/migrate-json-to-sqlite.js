const fs = require('fs');
const path = require('path');
const db = require('./database');


// =========================================
// Archivos
// =========================================

const jsonPath = path.join(
  __dirname,
  '..',
  'data',
  'db.json'
);

const backupPath = path.join(
  __dirname,
  '..',
  'data',
  'db.backup.json'
);


// =========================================
// Comprobar db.json
// =========================================

if (!fs.existsSync(jsonPath)) {

  console.error(
    'No se encontró data/db.json.'
  );

  process.exit(1);
}


// =========================================
// Crear respaldo
// =========================================

fs.copyFileSync(
  jsonPath,
  backupPath
);

console.log(
  '✓ Respaldo creado: data/db.backup.json'
);


// =========================================
// Leer JSON
// =========================================

const jsonData =
  JSON.parse(
    fs.readFileSync(
      jsonPath,
      'utf8'
    )
  );


const users =
  Array.isArray(jsonData.users)
    ? jsonData.users
    : [];


const reservations =
  Array.isArray(jsonData.reservations)
    ? jsonData.reservations
    : [];


const sessions =
  Array.isArray(jsonData.sessions)
    ? jsonData.sessions
    : [];


// =========================================
// Consultas SQL
// =========================================

const insertUser = db.prepare(`

  INSERT OR IGNORE INTO users (

    id,
    name,
    email,
    passwordHash,
    salt,
    role,
    createdAt

  )

  VALUES (

    @id,
    @name,
    @email,
    @passwordHash,
    @salt,
    @role,
    @createdAt

  )

`);


const insertReservation = db.prepare(`

  INSERT OR IGNORE INTO reservations (

    id,
    title,
    resource,
    date,
    startTime,
    endTime,
    status,
    notes,
    userId,
    createdAt,
    updatedAt

  )

  VALUES (

    @id,
    @title,
    @resource,
    @date,
    @startTime,
    @endTime,
    @status,
    @notes,
    @userId,
    @createdAt,
    @updatedAt

  )

`);


const insertSession = db.prepare(`

  INSERT OR IGNORE INTO sessions (

    token,
    userId,
    createdAt

  )

  VALUES (

    @token,
    @userId,
    @createdAt

  )

`);


// =========================================
// Migración
// =========================================

const migrate = db.transaction(() => {

  // -------------------------
  // Usuarios
  // -------------------------

  for (const user of users) {

    insertUser.run({

      id:
        user.id,

      name:
        user.name,

      email:
        user.email,

      passwordHash:
        user.passwordHash,

      salt:
        user.salt,

      role:
        user.role || 'usuario',

      createdAt:
        user.createdAt ||
        new Date().toISOString()

    });
  }


  // Obtener IDs válidos
  const validUsers =
    new Set(
      db
        .prepare(
          'SELECT id FROM users'
        )
        .all()
        .map(
          user => user.id
        )
    );


  // -------------------------
  // Reservaciones
  // -------------------------

  for (
    const reservation
    of reservations
  ) {

    let userId =
      reservation.userId || null;


    // Las reservaciones antiguas
    // pueden no tener usuario
    if (
      userId &&
      !validUsers.has(userId)
    ) {

      userId = null;
    }


    insertReservation.run({

      id:
        reservation.id,

      title:
        reservation.title,

      resource:
        reservation.resource,

      date:
        reservation.date,

      startTime:
        reservation.startTime,

      endTime:
        reservation.endTime,

      status:
        reservation.status ||
        'confirmada',

      notes:
        reservation.notes || '',

      userId,

      createdAt:
        reservation.createdAt || null,

      updatedAt:
        reservation.updatedAt || null

    });
  }


  // -------------------------
  // Sesiones
  // -------------------------

  for (
    const session
    of sessions
  ) {

    // Solo migrar sesiones de
    // usuarios que existen
    if (
      validUsers.has(
        session.userId
      )
    ) {

      insertSession.run({

        token:
          session.token,

        userId:
          session.userId,

        createdAt:
          session.createdAt ||
          new Date().toISOString()

      });
    }
  }

});


// Ejecutar migración
migrate();


// =========================================
// Mostrar resultados
// =========================================

const userCount =
  db.prepare(
    'SELECT COUNT(*) AS total FROM users'
  ).get().total;


const reservationCount =
  db.prepare(
    'SELECT COUNT(*) AS total FROM reservations'
  ).get().total;


const sessionCount =
  db.prepare(
    'SELECT COUNT(*) AS total FROM sessions'
  ).get().total;


console.log('');
console.log('Migración terminada correctamente.');
console.log('');
console.log(`Usuarios:      ${userCount}`);
console.log(`Reservaciones: ${reservationCount}`);
console.log(`Sesiones:      ${sessionCount}`);
console.log('');


// Cerrar conexión
db.close();