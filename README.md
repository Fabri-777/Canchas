# Cancha · Demo para GitHub Pages

Proyecto universitario de gestión y reserva de canchas deportivas en Lima. Esta adaptación funciona con HTML, CSS y JavaScript: no necesita Python, Django, instalaciones ni un servidor de aplicación.

## Publicar y obtener el enlace

1. Crea un repositorio público en GitHub, por ejemplo `gestion-canchas`. También puedes usar uno existente.
2. Descomprime el ZIP si descargaste la entrega comprimida.
3. En tu repositorio, selecciona **Add file → Upload files** (o **uploading an existing file** si está vacío).
4. Sube **el contenido** de esta carpeta: `index.html`, la carpeta `static` completa, `README.md` y `.nojekyll` si tu explorador lo muestra. No subas el ZIP. No subas la carpeta contenedora como un nivel adicional: `index.html` debe quedar en la raíz del repositorio.
5. Pulsa **Commit changes**.
6. Entra a **Settings → Pages**. En **Build and deployment → Source**, selecciona **Deploy from a branch**.
7. Selecciona la rama **main**, la carpeta **/(root)** y pulsa **Save**. Si tu rama tiene otro nombre, selecciona la que contiene el archivo `index.html`.
8. Espera a que termine la publicación. En esa misma sección aparecerá el enlace **Visit site**, normalmente con el formato `https://TU-USUARIO.github.io/gestion-canchas/`.

No necesitas activar GitHub Actions manualmente ni configurar comandos de compilación. Si ya habías subido la versión Django, usa el `index.html` y la carpeta `static` de esta entrega; Pages debe apuntar a la raíz. La página estática no utiliza los archivos Python ni la base de datos original. Nunca subas `.local-secret`, `.env`, entornos `.venv`, bases de datos ni comprobantes personales.

Guía oficial: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Cómo mostrarla en clase

1. Abre tu enlace y pulsa **Ingresar → Soy cliente**. Entras como **Diego Ramírez** (`cliente@cancha.local`), sin contraseña.
2. Elige una cancha, una fecha futura y un horario. Reserva y simula un pago con tarjeta o adjunta una imagen ficticia para transferencia.
3. Pulsa **Salir**, luego **Ingresar → Soy administrador**. Entras como **Valeria Torres** (`admin@cancha.local`), sin contraseña.
4. En el mismo navegador, revisa la reserva, abre el comprobante y aprueba el pago. También puedes editar canchas y tarifas, bloquear horarios y ver clientes.
5. Vuelve a **Soy cliente** para consultar la confirmación en **Mis reservas** y **Notificaciones**.
6. **Reiniciar demo** elimina los cambios de esta demo en este navegador, tras una confirmación, y recupera las cuentas y canchas de ejemplo.

También puedes registrar una cuenta de prueba con un correo, nombre, celular peruano y contraseña ficticios. Esa cuenta existe únicamente en el navegador donde la creaste.

## Funciones conservadas

- Diseño original adaptable a computadoras y celulares, con la imagen de cancha original.
- Registro, ingreso, salida y edición de perfil; accesos rápidos por rol.
- Filtros por deporte, horarios de Perú y tarifas en soles.
- Reservas de una hora, hasta 60 días de anticipación y prevención de horarios repetidos en el mismo almacenamiento del navegador.
- Reserva pendiente durante un máximo de 15 minutos, sin superar el inicio del turno.
- Pagos Visa/Mastercard simulados y comprobantes JPG/PNG de hasta 5 MB, reducidos para almacenamiento local.
- Revisión administrativa, cancelación y reembolso simulado. El cliente cancela reservas confirmadas o en revisión con más de dos horas de anticipación; el administrador puede cancelarlas sin esa restricción.
- Administración de canchas, tarifas, horarios, disponibilidad, bloqueos y clientes.
- Confirmaciones, cancelaciones y recordatorios en una bandeja simulada.

## Cómo se guardan los datos

Los datos se guardan en `localStorage`, separados por ruta del sitio. Recargar o cerrar el navegador conserva las reservas, siempre que no borres sus datos. La sesión usa `sessionStorage`: una nueva pestaña puede iniciar una sesión diferente y consultar los mismos datos si pertenece al mismo navegador y sitio. La aplicación serializa cambios entre pestañas mediante Web Locks cuando está disponible.

**Cada navegador o dispositivo tiene su propia demostración.** Tu profesor puede abrir el enlace con tu computadora apagada, pero verá su propia copia de los datos de ejemplo. Las reservas de tu computadora no se transfieren a su navegador. El modo incógnito pierde los datos al cerrar la sesión privada.

No hay base de datos compartida, cobros, WhatsApp real ni envío de correos. Los permisos son una simulación de la interfaz, no una barrera de seguridad para datos reales. El acceso de administrador está disponible para quien use la demo. Usa exclusivamente datos e imágenes ficticios. Las contraseñas de prueba se guardan como hashes con sal mediante Web Crypto; esto no convierte la aplicación estática en un sistema de autenticación de producción.

Los vencimientos y recordatorios se procesan al usar la página y cada minuto mientras permanece visible, sin un formulario abierto. Al volver a abrirla se actualizan los eventos pendientes. No se ejecuta ningún proceso con la página cerrada.

El navegador limita el espacio local. Si se llena, la aplicación muestra un error en vez de afirmar que guardó el cambio. Puedes usar una imagen más pequeña o reiniciar la demo.

## Archivos

```text
index.html
.nojekyll
README.md
static/
  app.js
  demo-api.js
  styles.css
  favicon.svg
  images/
    cancha-nocturna.png
```

`app.js` contiene la interfaz adaptada y `demo-api.js` reemplaza las funciones de Django por operaciones locales. Todos los recursos propios usan rutas relativas para funcionar tanto en la raíz como bajo `/nombre-del-repositorio/`. Las fuentes de Google son opcionales: la interfaz conserva fuentes de respaldo.

## Vista previa local opcional

GitHub Pages ejecuta la demo directamente al abrir el enlace. Para revisarla antes de publicar, sirve esta carpeta con un servidor estático como Live Server de VS Code, o con `python -m http.server 8000` desde esta carpeta si ya tienes Python instalado. Abre `http://localhost:8000`. No abras `index.html` con doble clic: utiliza módulos JavaScript y almacenamiento que requieren HTTP/HTTPS.

La carpeta original del proyecto Django se conserva aparte. Esta entrega empieza con los datos de ejemplo, no copia usuarios, reservas ni secretos de la base de datos original.
