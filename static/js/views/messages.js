import { api } from '../api/client.js';
import { render } from '../router.js';
import { state } from '../state.js';
import { empty } from '../ui/components.js';
import { $, escape } from '../utils/dom.js';
import { shortDate, timeLabel } from '../utils/format.js';

const statuses = { simulated: 'Envío simulado', scheduled: 'Programado', cancelled: 'Cancelado' };

export async function renderMessages(token) {
  const { notifications } = await api('notifications/');
  if (token !== state.routeToken) return;

  $('#main').innerHTML = `
    <div class="page-heading">
      <div>
        <div class="eyebrow">NO TE PIERDAS EL PARTIDO</div>
        <h1>Notificaciones<span class="accent">.</span></h1>
        <p class="muted">Confirmaciones, cancelaciones y recordatorios.</p>
      </div>
      <button class="button secondary" id="refresh-messages">Actualizar</button>
    </div>
    <div class="notice">Bandeja de demostración: estos mensajes simulan WhatsApp y no se envían a teléfonos reales. Los recordatorios se programan 2 horas antes del partido.</div>
    <div class="notification-list">
      ${notifications.map(notificationCard).join('')
        || empty('Aún no hay mensajes', 'Aquí aparecerán los avisos cuando confirmes o canceles una reserva.')}
    </div>`;
  $('#refresh-messages').onclick = () => render();
}

function notificationCard(notification) {
  return `<article class="notification-card">
    <div class="message-logo" aria-hidden="true">W</div>
    <div>
      <div class="inline-row">
        <strong>${escape(notification.channel)}</strong>
        <span class="badge ${notification.status === 'simulated' ? 'confirmed' : 'pending'}">${escape(statuses[notification.status])}</span>
        <span class="muted small-text">${shortDate(notification.scheduled_at)} · ${timeLabel(notification.scheduled_at)}</span>
      </div>
      ${state.user.is_admin
        ? `<p class="small-text muted">Para: ${escape(notification.customer)} · ${escape(notification.code)}</p>` : ''}
      <p>${escape(notification.text)}</p>
    </div>
  </article>`;
}
