const db = require('./database');

function getAuthenticatedUser(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const user = db.prepare(`
    SELECT users.id, users.name, users.email, users.role
    FROM sessions JOIN users ON users.id = sessions.userId
    WHERE sessions.token = ? AND sessions.createdAt >= ?
  `).get(token, new Date(Date.now() - 7 * 86400000).toISOString());
  return user || null;
}

function requireUser(req, res, next) {
  const user = getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ message: 'Debes iniciar sesión para continuar.' });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Esta función es exclusiva del administrador.' });
  next();
}

module.exports = { getAuthenticatedUser, requireUser, requireAdmin };
