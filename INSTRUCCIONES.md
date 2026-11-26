# Cómo ejecutar Cancha

Necesitas tener instalado **Python 3.11 o superior** (marca "Add Python to PATH" al instalarlo) y **MySQL Server** con **MySQL Workbench**.

## 1. Crear la base de datos (una sola vez)

1. Abre **MySQL Workbench** y entra a tu conexión local (*Local instance*) como `root`.
2. Ve a **File → Open SQL Script** y elige `database/setup_mysql.sql`.
3. Ejecuta todo el script con el ícono del **rayo ⚡**.

El script crea la base `canchas` y el usuario `canchas_app` (contraseña `canchas123`).
No hace falta crear tablas: la aplicación las crea sola al primer arranque, junto con canchas y usuarios de ejemplo.

## 2. Ejecutar la aplicación

**Opción fácil:** haz doble clic en `iniciar.bat`.
La primera vez tarda un poco porque instala las dependencias. Luego se abre el navegador en http://127.0.0.1:8000.

**Opción manual** (PowerShell, dentro de la carpeta del proyecto):

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

## 3. Usar la aplicación

- En **Ingresar** aparecen los botones **Soy cliente** y **Soy administrador** (modo demo), o puedes registrar una cuenta nueva.
- Estado del servidor y de la base de datos: http://127.0.0.1:8000/api/health
- Documentación de la API: http://127.0.0.1:8000/docs

## 4. Ejecutar las pruebas

```powershell
python -m pytest test.py -v
```

Las pruebas usan una base temporal en memoria: no necesitan MySQL y no tocan tus datos.

## Problemas comunes

| Síntoma | Solución |
| --- | --- |
| `/api/health` dice que la base no responde | Verifica que el servicio de MySQL esté encendido y que ejecutaste `setup_mysql.sql`. |
| `Access denied for user 'canchas_app'` | Vuelve a ejecutar `setup_mysql.sql` en Workbench. |
| `python` no se reconoce | Reinstala Python marcando "Add Python to PATH". |
| PowerShell no deja activar `.venv` | Ejecuta `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` o usa `iniciar.bat`. |
| Un cambio en el código no se ve en la página | Recarga con **Ctrl + F5**. |
