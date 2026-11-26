import { api } from '../api/client.js';
import { navigate, render } from '../router.js';
import { state } from '../state.js';
import { busy, errorIn } from '../ui/busy.js';
import { closeModal, openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { $, escape } from '../utils/dom.js';
import { dayLabel, hourLabel, money, shortDate, timeLabel } from '../utils/format.js';
import { icon } from '../utils/icons.js';

const RECEIPT_LIMIT = 5 * 1024 * 1024;
const receiptTypes = ['image/jpeg', 'image/png'];

export function openCheckout(court, trigger) {
  const { date, hour } = state;
  openModal('Ya casi estás en la cancha', `
    <div class="checkout-recap">
      <strong>${escape(court.name)}</strong><span>${dayLabel(date)} · ${hourLabel(hour)}</span><b>${money(court.price)}</b>
    </div>
    <form id="checkout-form" class="stack">
      <fieldset>
        <legend>Elige cómo pagar</legend>
        <label class="payment-choice"><input name="method" type="radio" value="visa" checked><span class="visa">VISA</span><span>Tarjeta Visa</span></label>
        <label class="payment-choice"><input name="method" type="radio" value="mastercard"><span class="mastercard">●●</span><span>Tarjeta Mastercard</span></label>
        <label class="payment-choice"><input name="method" type="radio" value="transfer"><span>Transferencia con comprobante</span></label>
      </fieldset>
      <div class="notice">Demostración: no se realizará ningún cobro. Usaremos una tarjeta ficticia; no ingreses datos bancarios reales.</div>
      <p class="field-help">Turno de 60 minutos. Tienes 15 minutos para pagar o adjuntar un comprobante. Cancela hasta 2 horas antes.</p>
      <button class="button primary" type="submit">Separar horario · ${money(court.price)}</button>
      <p role="alert" class="form-error"></p>
    </form>`, trigger);

  const form = $('#checkout-form');
  form.onsubmit = event => {
    event.preventDefault();
    return busy($('button[type=submit]', form), async () => {
      const method = new FormData(form).get('method');
      try {
        const { booking } = await api('bookings/', { method: 'POST', body: { court_id: court.id, date, hour, method } });
        if (form.isConnected && $('#modal').open) openPayment(booking);
        else toast('Horario separado. Puedes continuar el pago desde Mis reservas.');
      } finally {
        render();
      }
    }, { form });
  };
}

export function openPayment(booking, trigger) {
  const transfer = booking.payment.method === 'transfer';
  openModal(transfer ? 'Adjunta tu comprobante' : 'Pago con tarjeta de prueba', `
    <div class="checkout-recap">
      <strong>${escape(booking.court.name)} <span class="muted">${escape(booking.code)}</span></strong>
      <span>${shortDate(booking.start)} · ${timeLabel(booking.start)} a ${timeLabel(booking.end)}</span>
      <b>${money(booking.total)}</b>
    </div>
    <p class="field-help">Completa el pago antes de las ${timeLabel(booking.expires_at)}. Puedes retomarlo desde Mis reservas.</p>
    ${transfer ? `
      <div class="notice">Transferencia de demostración. Adjunta una imagen ficticia del comprobante; no transfieras dinero real.</div>
      <form id="receipt-form" class="stack">
        <label>Comprobante (JPG o PNG, hasta 5 MB)<input type="file" name="receipt" accept="image/jpeg,image/png" required></label>
        <button class="button primary" type="submit">Enviar para revisión</button>
        <p role="alert" class="form-error"></p>
      </form>` : `
      <div class="demo-bank-card">
        <span>${booking.payment.method === 'visa' ? 'VISA' : 'Mastercard'}</span>
        <strong>•••• &nbsp; •••• &nbsp; •••• &nbsp; 4242</strong>
        <small>TARJETA FICTICIA · SIN COBRO REAL</small>
      </div>
      <div class="notice">Simulación de pago. La aplicación no solicita ni almacena números de tarjeta o códigos de seguridad.</div>
      <div class="stack" id="card-payment">
        <button class="button primary" id="demo-pay">Simular pago aprobado · ${money(booking.total)}</button>
        <button class="text-button" id="demo-decline">Probar un pago rechazado</button>
        <p role="alert" class="form-error"></p>
      </div>`}`, trigger);

  if (transfer) wireReceipt(booking);
  else wireCardPayment(booking);
}

function wireReceipt(booking) {
  const form = $('#receipt-form');
  form.onsubmit = event => {
    event.preventDefault();
    return busy($('button[type=submit]', form), async () => {
      const body = new FormData(form);
      const file = body.get('receipt');
      if (!file?.size || file.size > RECEIPT_LIMIT) throw new Error('Adjunta una imagen de hasta 5 MB.');
      if (!receiptTypes.includes(file.type)) throw new Error('Solo se aceptan imágenes JPG o PNG.');

      await api(`bookings/${booking.id}/upload/`, { method: 'POST', body });
      showPaymentSuccess(form, 'Comprobante enviado',
        'El administrador revisará tu pago. Tu horario queda separado durante la revisión.', booking);
      render();
    }, { form });
  };
}

function wireCardPayment(booking) {
  const form = $('#card-payment');
  const pay = $('#demo-pay');
  const decline = $('#demo-decline');
  const path = `bookings/${booking.id}/pay/`;
  pay.onclick = () => busy(pay, async () => {
    const result = await api(path, { method: 'POST', body: { result: 'approved' } });
    showPaymentSuccess(form, '¡Listo, tu cancha está reservada!',
      'Pago de prueba aprobado. Ya puedes convocar a tu equipo.', result.booking);
    render();
  }, { form, peers: [decline] });
  decline.onclick = () => busy(decline, async () => {
    await api(path, { method: 'POST', body: { result: 'rejected' } });
    const message = 'Pago de prueba rechazado. Puedes reintentar antes del vencimiento.';
    if (form.isConnected && $('#modal').open) errorIn(form, { message });
    else toast(message);
    render();
  }, { form, peers: [pay] });
}

function showPaymentSuccess(form, title, message, booking) {
  if (!form.isConnected || !$('#modal').open) {
    toast(title);
    return;
  }

  openModal(title, `<div class="success-content">
    <span class="success-check">${icon('check')}</span><p>${escape(message)}</p>
    <strong>${escape(booking.code)} · ${money(booking.total)}</strong>
    <p class="muted">${escape(booking.court.name)} · ${shortDate(booking.start)} · ${timeLabel(booking.start)}</p>
    <button class="button primary" id="view-bookings">Ver mis reservas ${icon('arrow')}</button>
  </div>`);
  $('#view-bookings').onclick = () => {
    closeModal();
    navigate('reservas');
  };
}
