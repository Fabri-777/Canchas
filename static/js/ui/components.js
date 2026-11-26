import { escape } from '../utils/dom.js';
import { money, shortDate, timeLabel } from '../utils/format.js';
import { icon } from '../utils/icons.js';

export function loading(message) {
  return `<div class="loading-state" role="status">
    <span class="spinner" aria-hidden="true"></span>${escape(message)}
  </div>`;
}

export function empty(title, message) {
  return `<div class="empty-state">
    ${icon('calendar')}<h3>${escape(title)}</h3><p>${escape(message)}</p>
  </div>`;
}

export function failure(title, message) {
  return `<div class="error-state">
    <div role="alert"><h2>${escape(title)}</h2><p>${escape(message)}</p></div>
    <button class="button secondary" data-retry>Volver a intentar</button>
  </div>`;
}

export function badge(booking) {
  return `<span class="badge ${escape(booking.status)}">${escape(booking.status_label)}</span>`;
}

export function bookingCard(booking, admin = false) {
  const id = escape(booking.id);
  return `
    <article class="reservation-card">
      <div class="reservation-icon">${icon('ball')}</div>
      <div class="reservation-info">
        <div class="inline-row"><span class="eyebrow">${escape(booking.code)}</span>${badge(booking)}</div>
        <h3>${escape(booking.court.name)}</h3>
        <p>${icon('calendar')} ${shortDate(booking.start)} · ${timeLabel(booking.start)} – ${timeLabel(booking.end)}</p>
        <p class="small-text muted">
          ${admin ? `${escape(booking.customer)} · ` : ''}
          ${escape(booking.payment.method_label)} · ${escape(booking.payment.status_label)}
        </p>
      </div>
      <div class="reservation-actions">
        <strong>${money(booking.total)}</strong>
        <div class="button-row">
          ${booking.status === 'pending' && !admin
            ? `<button class="button primary compact" data-pay="${id}">Completar pago</button>` : ''}
          ${booking.payment.has_receipt
            ? `<button class="text-button" data-receipt="${id}">Ver comprobante ↗</button>` : ''}
          ${booking.status === 'review' && admin
            ? `<button class="button primary compact" data-action="approve" data-id="${id}">Aprobar</button>
               <button class="text-button danger" data-action="reject" data-id="${id}">Rechazar</button>` : ''}
          ${['pending', 'review', 'confirmed'].includes(booking.status)
            ? `<button class="text-button" data-action="cancel" data-id="${id}">Cancelar</button>` : ''}
        </div>
      </div>
    </article>`;
}
