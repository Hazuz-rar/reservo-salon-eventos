const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { RESERVATION_AMOUNT_MXN } = require('./pricing');


// =========================================
// Ruta de la base de datos
// =========================================

const databasePath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'data', 'app.db');
const dataDirectory = path.dirname(databasePath);


// Crear la carpeta data si no existe
if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(
    dataDirectory,
    {
      recursive: true
    }
  );
}





// =========================================
// Conexión
// =========================================

const db = new Database(databasePath);


// Activar llaves foráneas
db.pragma('foreign_keys = ON');


// Mejor funcionamiento para SQLite
db.pragma('journal_mode = WAL');


// =========================================
// Crear tablas
// =========================================

db.exec(`

  CREATE TABLE IF NOT EXISTS users (

    id TEXT PRIMARY KEY,

    name TEXT NOT NULL,

    email TEXT NOT NULL UNIQUE,

    passwordHash TEXT NOT NULL,

    salt TEXT NOT NULL,

    role TEXT NOT NULL DEFAULT 'usuario',

    createdAt TEXT NOT NULL

  );


  CREATE TABLE IF NOT EXISTS reservations (

    id TEXT PRIMARY KEY,

    title TEXT NOT NULL,

    resource TEXT NOT NULL,

    date TEXT NOT NULL,

    startTime TEXT NOT NULL,

    endTime TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'confirmada',

    notes TEXT DEFAULT '',

    userId TEXT,

    createdAt TEXT,

    updatedAt TEXT,

    amountMXN INTEGER NOT NULL DEFAULT 12000,
    paymentStatus TEXT NOT NULL DEFAULT 'pendiente',

    FOREIGN KEY (userId)
      REFERENCES users(id)
      ON DELETE SET NULL

  );


  CREATE TABLE IF NOT EXISTS sessions (

    token TEXT PRIMARY KEY,

    userId TEXT NOT NULL,

    createdAt TEXT NOT NULL,

    FOREIGN KEY (userId)
      REFERENCES users(id)
      ON DELETE CASCADE

  );

`);


// Migración segura de bases existentes (sin eliminar datos).
const existingColumns = new Set(db.prepare('PRAGMA table_info(reservations)').all().map(c => c.name));
for (const [column, sqlType] of Object.entries({
  eventType: 'TEXT', guestCount: 'INTEGER', contactPhone: 'TEXT',
  amountMXN: `INTEGER NOT NULL DEFAULT ${RESERVATION_AMOUNT_MXN}`,
  paymentStatus: "TEXT NOT NULL DEFAULT 'pendiente'"
})) {
  if (!existingColumns.has(column)) db.exec(`ALTER TABLE reservations ADD COLUMN ${column} ${sqlType}`);
}

// =========================================
// Índices
// =========================================

db.exec(`

  CREATE INDEX IF NOT EXISTS
    idx_reservations_date
  ON reservations(date);


  CREATE INDEX IF NOT EXISTS
    idx_reservations_resource
  ON reservations(resource);


  CREATE INDEX IF NOT EXISTS
    idx_reservations_user
  ON reservations(userId);


  CREATE INDEX IF NOT EXISTS
    idx_sessions_user
  ON sessions(userId);

`);


// =========================================
// Exportar conexión
// =========================================

module.exports = db;