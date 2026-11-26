import { api } from '../api/client.js';
import { render } from '../router.js';
import { state } from '../state.js';
import { busy } from '../ui/busy.js';
import { bookingCard, empty } from '../ui/components.js';
import { closeModal, openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { $, $$, escape } from '../utils/dom.js';
import { shortDate, timeLabel } from '../utils/format.js';
import { icon } from '../utils/icons.js';
import { openPayment } from './checkout.js';

export async function renderReservations(token) {
  const { bookings } = await api('bookings/');
  if (token !== state.routeToken) return;
  $('#main').innerHTML = `
    <div class="page-heading">
      <div>
        <div class="eyebrow">TU AGENDA DE PARTIDOS</div>
        <h1>Mis reservas<span class="accent">.</span></h1>
        <p class="muted">Todo listo para volver a la cancha.</p>
      </div>
      <a class="button primary" href="#reservar">Nueva reserva ${icon('arrow')}</a>
    </div>
    <div class="reservation-list">
      ${bookings.map(booking => bookingCard(booking)).join('')
        || empty('Tu agenda empieza con un partido', 'Todavía no tienes reservas. Elige tu cancha y tu próximo horario.')}
    </div>`;
  wireBookingActions(bookings);
}

export function wireBookingActions(bookings) {
  const findBooking = id => bookings.find(booking => booking.id === Number(id));
  for (const button of $$('[data-receipt]', $('#main'))) {
    button.onclick = () => busy(button, async () => {
      const { receipt } = await api(`receipts/${button.dataset.receipt}/`);
      if (button.isConnected && !$('#modal').open) {
        openModal('Comprobante de demostración', '<img class="receipt-preview" alt="Comprobante ficticio adjunto">', button);
        $('.receipt-preview').src = receipt;
      }
    });
  }
  for (const button of $$('[data-pay]', $('#main'))) {
    button.onclick = () => openPayment(findBooking(button.dataset.pay), button);
  }
  for (const button of $$('[data-action]', $('#main'))) {
    button.onclick = () => {
      const booking = findBooking(button.dataset.id);
      const action = button.dataset.action;
      if (action === 'approve') {
        return busy(button, async () => {
          await api(`bookings/${booking.id}/approve/`, { method: 'POST', body: {} });
          toast('Pago aprobado y reserva confirmada.');
          await render();
        });
      }
      confirmBookingAction(booking, action, button);
    };
  }
}

function confirmBookingAction(booking, action, trigger) {
  openModal(action === 'reject' ? 'Rechazar comprobante' : 'Cancelar reserva', `
    <div id="booking-confirmation">
      <p>Se liberará el horario de <strong>${escape(booking.court.name)}</strong> del ${shortDate(booking.start)} a las ${timeLabel(booking.start)}.</p>
      ${booking.payment.status === 'paid'
        ? '<div class="notice">El reembolso también es simulado. No se moverá dinero real.</div>' : ''}
      <div class="button-row">
        <button class="button secondary" id="keep-booking">Conservar reserva</button>
        <button class="button destructive" id="confirm-cancel">${action === 'reject' ? 'Rechazar y liberar' : 'Sí, cancelar'}</button>
      </div>
      <p role="alert" class="form-error"></p>
    </div>`, trigger);

  $('#keep-booking').onclick = closeModal;
  const button = $('#confirm-cancel');
  const form = $('#booking-confirmation');
  button.onclick = () => busy(button, async () => {
    await api(`bookings/${booking.id}/${action}/`, { method: 'POST', body: {} });
    if (form.isConnected) closeModal();
    toast('La reserva fue cancelada y el horario se liberó.');
    await render();
  }, { form });
}
