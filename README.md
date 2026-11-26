# Cancha · Reservas de canchas deportivas

Proyecto universitario de gestión y reserva de canchas deportivas en Lima.
Stack: **FastAPI (Python) + HTML/CSS/JavaScript + MySQL**.

## Arquitectura

```text
navegador ──fetch/JSON──▶ FastAPI (routers) ──▶ service ──▶ repository ──▶ DAO ──▶ MySQL
     ▲                                                                              │
     └──────────────── JSON ◀── presenters ◀────────────────────────────────────────┘
```

| Capa | Carpeta | Responsabilidad |
|------|---------|-----------------|
| Presentación | `index.html`, `static/` | Interfaz. JavaScript llama a la API con `fetch` y actualiza la lista sin recargar la página. |
| API | `backend/api/` | Rutas HTTP, cookies de sesión, validación de tipos (Pydantic), errores en JSON `{"detail": "..."}`. |
| Servicios | `backend/services/` | Reglas de negocio: horarios, pagos, cancelaciones, permisos. No conocen HTTP ni SQL. |
| Repositorios | `backend/repositories/` | Entregan entidades de dominio (`Booking`, `Court`...) y combinan DAOs (una reserva y su pago se guardan juntos). |
| DAO | `backend/dao/` | Único lugar con SQL. Un DAO por tabla (`BookingDAO`, `CourtDAO`...). |
| Base de datos | `backend/db/` | Tablas (`tables.py`), motor y *Unit of Work*: una transacción por caso de uso. |
| Dominio | `backend/domain/`, `backend/core/` | Entidades, errores de dominio, reloj de Lima y seguridad. |

`backend/main.py` es la raíz de composición: crea el motor, arma los servicios y registra las rutas.

## Puesta en marcha

### 1. MySQL (una sola vez, en MySQL Workbench)

1. Abre Workbench y entra a tu conexión local como `root`.
2. **File → Open SQL Script** → elige `database/setup_mysql.sql`.
3. Ejecuta todo el script con el ícono del rayo ⚡.

Esto crea la base `canchas` y el usuario `canchas_app` con contraseña `canchas123`. La app ya trae esos datos por defecto, así que **no necesitas `.env`**. Las tablas y los datos de ejemplo se crean solos al primer arranque.

Si quieres otros valores, crea un `.env` opcional en la raíz:

```ini
DATABASE_URL=mysql+pymysql://canchas_app:canchas123@127.0.0.1:3306/canchas?charset=utf8mb4
DEMO_MODE=true
```

### 2. Python

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 3. Ejecutar

```powershell
uvicorn backend.main:app --reload
```

- Aplicación: http://127.0.0.1:8000
- Documentación interactiva de la API: http://127.0.0.1:8000/docs
- Estado del servicio y la base de datos: http://127.0.0.1:8000/api/health

### 4. Pruebas

```powershell
python -m pytest test.py -v
```

Los tests usan SQLite en memoria con las mismas tablas y DAOs, y un reloj controlado. No necesitan MySQL y no tocan tus datos.

## Cuentas de demostración

El modo demo viene **activado** por defecto, para presentar en clase (`DEMO_MODE=false` lo apaga). En **Ingresar** aparecen los botones **Soy cliente** (Diego Ramírez) y **Soy administrador** (Valeria Torres). También puedes registrar cuentas nuevas con contraseña.

## Tolerancia a fallos

- Si MySQL está caído, la app arranca igual: la API responde `503` con un mensaje claro y se recupera sola cuando vuelve la base de datos.
- Cada caso de uso corre en una transacción: si algo falla a mitad de camino, no queda nada a medias.
- Dos personas no pueden reservar el mismo horario: la reserva bloquea la fila de la cancha (`SELECT ... FOR UPDATE`) mientras verifica y guarda.
- Las reservas sin pagar vencen a los 15 minutos y liberan el horario.
- El frontend usa tiempo límite, reintentos en lecturas, avisa cuando no hay conexión y muestra estados de carga, vacío y error con botón para reintentar.

## Seguridad

- Contraseñas con PBKDF2-SHA256 y sal. Las sesiones viajan en una cookie `HttpOnly`, y en la base de datos solo se guarda el hash del token.
- Los comprobantes se validan por su contenido real (firma JPG/PNG), no por la extensión, con un máximo de 5 MB.
- Los pagos son **simulados**: no se piden ni se guardan datos de tarjetas. Usa solo datos e imágenes ficticios.
