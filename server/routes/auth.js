const express = require('express');
const crypto = require('crypto');
const db = require('../database');
const { getAuthenticatedUser } = require('../auth-middleware');

const router = express.Router();


// =========================================
// REGISTRO
// POST /api/auth/register
// =========================================

router.post('/register', (req, res) => {

  const {
    name,
    email,
    password
  } = req.body;


  // Validar campos
  if (
    typeof name !== 'string' || !name.trim() || name.length > 120 ||
    typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254 ||
    typeof password !== 'string' || !password
  ) {

    return res.status(400).json({
      message:
        'Nombre, correo y contraseña son obligatorios.'
    });
  }


  if (password.length < 8 || password.length > 128) {

    return res.status(400).json({
      message:
        'La contraseña debe tener entre 8 y 128 caracteres.'
    });
  }


  const normalizedEmail =
    email
      .trim()
      .toLowerCase();


  // Buscar correo existente
  const existingUser =
    db.prepare(`
      SELECT id
      FROM users
      WHERE email = ?
    `).get(
      normalizedEmail
    );


  if (existingUser) {

    return res.status(409).json({
      message:
        'Ya existe una cuenta con ese correo electrónico.'
    });
  }


  // Crear salt
  const salt =
    crypto
      .randomBytes(16)
      .toString('hex');


  // Crear hash
  const passwordHash =
    crypto
      .scryptSync(
        password,
        salt,
        64
      )
      .toString('hex');


  const user = {

    id:
      crypto.randomUUID(),

    name:
      name.trim(),

    email:
      normalizedEmail,

    passwordHash,

    salt,

    role:
      'usuario',

    createdAt:
      new Date().toISOString()

  };


  try {

    db.prepare(`
      INSERT INTO users (
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
    `).run(user);


    res.status(201).json({

      message:
        'Cuenta creada correctamente.',

      user: {
        id:
          user.id,

        name:
          user.name,

        email:
          user.email,

        role:
          user.role
      }

    });


  } catch (error) {

    console.error(
      'Error al registrar usuario:',
      error
    );


    res.status(500).json({
      message:
        'No fue posible crear la cuenta.'
    });
  }

});


// =========================================
// LOGIN
// POST /api/auth/login
// =========================================

router.post('/login', (req, res) => {

  const {
    email,
    password
  } = req.body;


  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {

    return res.status(400).json({
      message:
        'Correo y contraseña son obligatorios.'
    });
  }


  const normalizedEmail =
    email
      .trim()
      .toLowerCase();


  const user =
    db.prepare(`
      SELECT *
      FROM users
      WHERE email = ?
    `).get(
      normalizedEmail
    );


  if (!user) {

    return res.status(401).json({
      message:
        'Correo o contraseña incorrectos.'
    });
  }


  // Calcular hash de la contraseña ingresada
  const passwordHash =
    crypto
      .scryptSync(
        password,
        user.salt,
        64
      )
      .toString('hex');


  // Comparar hashes
  if (!crypto.timingSafeEqual(Buffer.from(passwordHash, 'hex'), Buffer.from(user.passwordHash, 'hex'))) {

    return res.status(401).json({
      message:
        'Correo o contraseña incorrectos.'
    });
  }


  // Crear token de sesión
  const token =
    crypto
      .randomBytes(32)
      .toString('hex');


  const createdAt =
    new Date().toISOString();


  try {

    // Eliminar sesiones anteriores
    // del mismo usuario
    db.prepare(`
      DELETE FROM sessions
      WHERE userId = ?
    `).run(
      user.id
    );


    // Crear nueva sesión
    db.prepare(`
      INSERT INTO sessions (
        token,
        userId,
        createdAt
      )
      VALUES (?, ?, ?)
    `).run(
      token,
      user.id,
      createdAt
    );


    res.json({

      message:
        'Inicio de sesión correcto.',

      token,

      user: {
        id:
          user.id,

        name:
          user.name,

        email:
          user.email,

        role:
          user.role
      }

    });


  } catch (error) {

    console.error(
      'Error al iniciar sesión:',
      error
    );


    res.status(500).json({
      message:
        'No fue posible iniciar sesión.'
    });
  }

});


// =========================================
// USUARIO ACTUAL
// GET /api/auth/me
// =========================================

router.get('/me', (req, res) => {

  const user = getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ message: 'La sesión no está activa o ha vencido.' });

  res.json({
    user
  });

});


// =========================================
// CERRAR SESIÓN
// POST /api/auth/logout
// =========================================

router.post('/logout', (req, res) => {

  const authorization =
    req.headers.authorization;


  if (
    !authorization ||
    !authorization.startsWith(
      'Bearer '
    )
  ) {

    return res.status(401).json({
      message:
        'No hay una sesión activa.'
    });
  }


  const token =
    authorization.split(' ')[1];


  const result =
    db.prepare(`
      DELETE FROM sessions
      WHERE token = ?
    `).run(
      token
    );


  if (
    result.changes === 0
  ) {

    return res.status(401).json({
      message:
        'La sesión no es válida.'
    });
  }


  res.json({
    message:
      'Sesión cerrada correctamente.'
  });

});


module.exports = router;