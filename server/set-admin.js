const db = require('./database');
const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Uso: npm run admin -- correo@ejemplo.com');
  process.exitCode = 1;
} else {
  const result = db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(email);
  if (result.changes) console.log(`Administrador habilitado para ${email}.`);
  else { console.error('No existe ese correo. Registra primero la cuenta en la web.'); process.exitCode = 1; }
}
db.close();
