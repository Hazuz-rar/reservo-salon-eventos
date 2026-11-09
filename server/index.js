const path = require('path');
const express = require('express');

require('./database');

const reservationRoutes = require('./routes/reservations');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/reservations', reservationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Servir el frontend estático
app.use(express.static(path.join(__dirname, '..', 'public')));

// Cualquier ruta no-API regresa la página de inicio (útil para navegación directa)
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'inicio.html'));
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
}
module.exports = app;
