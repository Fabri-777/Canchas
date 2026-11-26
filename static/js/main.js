import { api, apiEvents } from './api/client.js';
import { configureRouter, render } from './router.js';
import { state } from './state.js';
import { failure, loading } from './ui/components.js';
import { closeModal } from './ui/modal.js';
import { $ } from './utils/dom.js';
import { renderAdmin } from './views/admin.js';
import { openAuth } from './views/auth.js';
import { renderBooking } from './views/booking.js';
import { renderHeader } from './views/header.js';
import { renderMessages } from './views/messages.js';
import { renderReservations } from './views/reservations.js';

configureRouter({
  header: renderHeader,
  auth: openAuth,
  routes: {
    reservar: renderBooking,
    reservas: renderReservations,
    mensajes: renderMessages,
    admin: renderAdmin,
  },
});

const main = $('#main');
let initialized = false;

function updateConnection() {
  $('#offline-banner').hidden = navigator.onLine !== false;
}

function reconnect() {
  updateConnection();
  if (main.getAttribute('aria-busy') === 'true' || $('#modal').open) return;
  if (!initialized) initialize();
  else if ($('[data-retry]', main)) render();
}

async function initialize() {
  main.setAttribute('aria-busy', 'true');
  main.innerHTML = loading('Preparando las canchas…');
  try {
    const session = await api('session/').catch(error => {
      if (error.status === 401) return { user: null };
      throw error;
    });
    state.user = session.user;
    state.demo = session.demo ?? true;
    if (/^\d{4}-\d{2}-\d{2}$/.test(session.today)) state.date = session.today;
    initialized = true;
    await render();
  } catch (error) {
    main.setAttribute('aria-busy', 'false');
    main.innerHTML = failure('No pudimos iniciar la aplicación', error.message);
    $('[data-retry]', main).onclick = initialize;
  }
}

updateConnection();
window.addEventListener('online', reconnect);
window.addEventListener('offline', updateConnection);
window.addEventListener('hashchange', () => { if (initialized) render(); });
apiEvents.addEventListener('unauthorized', () => {
  const hadSession = !!state.user;
  state.user = null;
  if (initialized && hadSession) {
    closeModal();
    render();
  }
});

$('.skip-link').onclick = event => {
  event.preventDefault();
  main.focus();
};

setInterval(() => {
  const active = document.activeElement;
  if (initialized && !document.hidden && !$('#modal').open
    && main.getAttribute('aria-busy') !== 'true' && (active === main || !main.contains(active))) {
    render({ background: true });
  }
}, 60_000);

initialize();
