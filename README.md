# Salón Aurora — Sistema de reservaciones

Adaptación del proyecto web original **Reservo**, conservando Node.js, Express,
SQLite, JavaScript, HTML y CSS. La aplicación permite que clientes soliciten un
horario para celebrar un evento y que el administrador revise las solicitudes.

## Funcionalidades incluidas

- Página inicial enfocada en celebraciones.
- Calendario público por mes con **solo los horarios ocupados o en revisión**.
  No se publica el nombre, correo, teléfono o contenido privado de los eventos.
- Registro, inicio de sesión y cierre de sesión.
- Formulario para reservar: nombre de evento, tipo, cantidad de invitados,
  teléfono de contacto, fecha, horario y comentarios.
- Solicitudes nuevas en estado **pendiente** (no se confirman automáticamente).
- Validación de fecha, campos y traslape de horarios, incluyendo solicitudes
  pendientes. El inicio de un evento puede coincidir con el fin de otro.
- Área **Mis eventos** para editar solicitudes pendientes, cancelar solicitudes
  y ver estados. Las cancelaciones quedan guardadas en el historial.
- Panel de administrador para ver datos de las solicitudes, confirmarlas o
  cancelarlas. La API comprueba el rol admin; no basta con abrir la página.
- Monto fijo **de demostración** por reservación ($12,000 MXN); se muestra al cliente y al administrador.
- Estado **Pago pendiente** en rojo en el panel administrador para reservas activas. No hay pasarela, registro de pagos ni método de pago.
- Migración automática de columnas nuevas en bases SQLite anteriores.
- Prueba de integración con `npm.cmd test`.

## Requisitos

- **Node.js 22 o posterior** (la versión actual de `better-sqlite3` lo requiere).
- npm (incluido con Node.js).
- No se requiere instalar SQLite por separado.

## Instalación desde el ZIP

1. Extrae el ZIP y abre la carpeta `reservo-salon-eventos` con VS Code.
2. Abre una terminal (PowerShell en Windows) dentro de esa carpeta.
3. Ejecuta:

   ```powershell
   npm.cmd install
   npm.cmd start
   ```

4. Abre <http://localhost:3000>.

La carpeta `data/` y `data/app.db` se generan al arrancar por primera vez.
Para detener el servidor, presiona `Ctrl+C`.

Opcionalmente, verifica el backend con:

```powershell
npm.cmd test
```

**No abras los archivos HTML con doble clic**: la API requiere que el servidor
esté activo en `localhost:3000`.

## Configurar la cuenta del administrador

1. Arranca el servidor y abre la web.
2. Registra una cuenta normal desde **Crear cuenta**.
3. En otra terminal, en la carpeta del proyecto, ejecuta:

   ```powershell
   npm run admin -- correo@ejemplo.com
   ```

4. Recarga la página después de iniciar sesión. El menú mostrará **Administrar eventos**.
5. Entra para revisar y confirmar solicitudes pendientes.

Este procedimiento deliberadamente **no crea una contraseña administrativa
universal**. Solo eleva una cuenta ya registrada. Protege esa cuenta.

## Conservar datos de tu versión anterior

El ZIP entregado **no incluye tu base de datos original** ni el archivo
`db.backup.json`, porque contienen cuentas, contraseñas cifradas, teléfonos
potenciales y sesiones de usuarios. Para conservar tus datos locales:

1. **Detén** cualquier servidor de la versión antigua antes de copiar archivos.
2. Haz copia de seguridad de la carpeta `data/` antigua; incluye `app.db` y,
   cuando existan, los archivos `app.db-wal` y `app.db-shm`.
3. Coloca esa carpeta `data/` dentro del nuevo proyecto **antes** de iniciarlo.
4. Arranca con `npm start`. Se crearán las nuevas columnas sin borrar las anteriores.

Las reservaciones de antiguos recursos como «Sala A» permanecen almacenadas,
pero **no se muestran** como solicitudes para el nuevo `Salón de eventos`.

## Flujo de reservación

1. Visitante selecciona una fecha en **Disponibilidad**.
2. Cliente inicia sesión, llena la información y consulta si un horario está ocupado.
3. Envía la solicitud. El estado inicial es **pendiente**.
4. Administrador entra en **Administrar eventos**, revisa y confirma o cancela.
5. Cliente consulta el resultado en **Mis eventos** (actualizando la página).

Los horarios ocupados se evalúan por fecha y horas de inicio/fin en un **único
salón**. Se admiten varios eventos el mismo día únicamente si sus horarios no
se traslapan. Las solicitudes pendientes bloquean ese intervalo; las canceladas
liberan el horario.

## Rutas API

| Método | Ruta | Acceso | Función |
|---|---|---|---|
| POST | `/api/auth/register` | Público | Crear cuenta |
| POST | `/api/auth/login` | Público | Iniciar sesión |
| GET | `/api/auth/me` | Usuario | Datos de sesión |
| POST | `/api/auth/logout` | Usuario | Cerrar sesión |
| GET | `/api/reservations?month=YYYY-MM` | Público | Horarios del mes sin datos personales |
| GET | `/api/reservations/availability?date=YYYY-MM-DD` | Público | Horarios ocupados del día |
| GET | `/api/reservations/mine` | Usuario | Sus solicitudes y datos propios |
| POST | `/api/reservations` | Usuario | Solicitar fecha |
| PUT | `/api/reservations/:id` | Propietario | Editar una solicitud pendiente |
| PATCH | `/api/reservations/:id/cancel` | Propietario | Cancelar una solicitud |
| GET | `/api/admin/reservations` | Admin | Revisar todas las solicitudes del salón |
| PATCH | `/api/admin/reservations/:id/status` | Admin | Confirmar o cancelar |

Las API protegidas aceptan `Authorization: Bearer <token>`. Las sesiones se
consideran vencidas después de 7 días.

## Configuración y límites actuales

La aplicación es una **primera adaptación funcional**, no un producto de pagos listo
para operar comercialmente. No se ha definido ningún precio, anticipo, capacidad
máxima, horario de apertura, ventana de anticipación, montaje/limpieza ni políticas
especiales de cancelación. **No se cobran pagos ni se envían correos o WhatsApp**.

Actualmente se solicita que el evento **inicie y termine el mismo día**. Si tus
fiestas continúan después de medianoche, habrá que agregar intervalos que
abarquen dos fechas y controles de disponibilidad para ambos días.

La zona horaria de referencia del backend es `America/Monterrey`; puede cambiarse
mediante la variable `APP_TIME_ZONE`. Para probar en otra base se admite `DB_PATH`.
No publiques esta demo en internet sin revisar autenticación, protección de sesiones,
seguridad de despliegue, copias de seguridad, política de privacidad y demás requisitos
operativos.

## Estructura

```
reservo-salon-eventos/
├── server/
│   ├── index.js
│   ├── database.js
│   ├── auth-middleware.js
│   ├── reservation-utils.js
│   ├── set-admin.js
│   └── routes/
│       ├── auth.js
│       ├── reservations.js
│       └── admin.js
├── public/
│   ├── inicio.html
│   ├── instructivo.html
│   ├── calendario.html
│   ├── login.html
│   ├── registro.html
│   ├── perfil.html
│   ├── administracion.html
│   ├── css/styles.css
│   └── js/
├── tests/reservations.test.js
├── data/              # Base de datos generada al iniciar
├── package.json
├── package-lock.json
└── README.md
```


## Precio y estado de pago (versión de demostración)

- El monto de **$12,000 MXN por evento** es un ejemplo: no es un presupuesto definitivo, ni depende de horas/invitados.
- Para cambiar el importe para **reservas nuevas**, edita `RESERVATION_AMOUNT_MXN` en `server/pricing.js` y reinicia el servidor. Las reservas ya guardadas mantienen el monto con el que se registraron.
- Al iniciar con una base de datos anterior, se agregan las columnas `amountMXN` y `paymentStatus` automáticamente. Para registros anteriores el valor inicial es $12,000 y `pendiente`.
- El panel del administrador muestra **Pago pendiente** en rojo para solicitudes pendientes o confirmadas. Las canceladas no muestran que deban pagarse.
- No se implementó pasarela de pago, formulario de tarjetas, modificación del estado de pago ni cobro alguno.
- El nombre comercial de demostración es **Salón Aurora**. El identificador interno del recurso se conserva como `Salón de eventos` para no ocultar reservas existentes.
- El código conserva las claves de sesión `reservoToken` y `reservoUser` para evitar cerrar automáticamente las sesiones del proyecto original.
