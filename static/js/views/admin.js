import { api } from '../api/client.js';
import { render } from '../router.js';
import { state } from '../state.js';
import { busy } from '../ui/busy.js';
import { bookingCard, empty } from '../ui/components.js';
import { closeModal, openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { $, $$, escape } from '../utils/dom.js';
import { hourLabel, money, shiftDate, shortDate, timeLabel } from '../utils/format.js';
import { wireBookingActions } from './reservations.js';

const tabs = [
  ['agenda', 'Agenda y reservas'], ['payments', 'Pagos'], ['courts', 'Canchas y horarios'], ['clients', 'Clientes'],
];
const sports = [['futbol', 'Fútbol'], ['voley', 'Vóley'], ['basket', 'Básquet']];
const statuses = [
  ['all', 'Todos'], ['confirmed', 'Confirmadas'], ['pending', 'Pendientes'], ['review', 'En revisión'],
  ['cancelled', 'Canceladas'], ['expired', 'Vencidas'],
];

export async function renderAdmin(token) {
  const data = await api('admin/overview/');
  if (token !== state.routeToken) return;

  $('#main').innerHTML = `
    <div class="page-heading">
      <div>
        <div class="eyebrow">PANEL DE ADMINISTRACIÓN</div>
        <h1>Tu cancha, en orden<span class="accent">.</span></h1>
        <p class="muted">Gestiona las reservas, la disponibilidad y los pagos.</p>
      </div>
      <span class="role-label">Administrador</span>
    </div>
    <div class="stats-grid">
      <div><span>Reservas confirmadas hoy</span><strong>${escape(data.stats.today)}</strong></div>
      <div><span>Pagos por revisar</span><strong>${escape(data.stats.review)}</strong></div>
      <div><span>Total pagado en la demo</span><strong>${money(data.stats.income)}</strong></div>
    </div>
    <div class="admin-tabs" role="group" aria-label="Secciones de administración">
      ${tabs.map(([id, label]) => `<button data-admin-tab="${id}" aria-pressed="${state.adminTab === id}">${label}</button>`).join('')}
    </div>
    <div id="admin-content"></div>`;

  for (const button of $$('[data-admin-tab]')) {
    button.onclick = () => {
      state.adminTab = button.dataset.adminTab;
      return render();
    };
  }

  if (state.adminTab === 'courts') showCourts(data.courts, data.blocks);
  else if (state.adminTab === 'clients') showClients(data.users);
  else showBookings(data.bookings, state.adminTab === 'payments');
}

function showBookings(bookings, isPayment) {
  const rows = isPayment
    ? bookings.filter(booking => booking.status === 'review' || ['paid', 'refunded'].includes(booking.payment.status))
    : bookings;

  $('#admin-content').innerHTML = `
    <div class="section-heading">
      <h2>${isPayment ? 'Control de pagos' : 'Agenda de reservas'}</h2>
      <label class="inline-label">Estado<select id="status-filter">
        ${statuses.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
      </select></label>
    </div>
    <div id="admin-bookings"></div>`;

  const status = $('#status-filter');
  function draw() {
    const filtered = rows.filter(booking => status.value === 'all' || booking.status === status.value);
    $('#admin-bookings').innerHTML = filtered.map(booking => bookingCard(booking, true)).join('')
      || empty('No hay reservas en esta vista', 'Las nuevas reservas y pagos aparecerán aquí.');
    wireBookingActions(filtered);
  }
  status.onchange = draw;
  draw();
}

function showClients(users) {
  $('#admin-content').innerHTML = `
    <div class="section-heading">
      <h2>Clientes registrados</h2><span class="muted">${users.length} clientes</span>
    </div>
    <div class="client-grid">
      ${users.map(user => `<article class="client-card">
        <span class="avatar" aria-hidden="true">${escape(user.name[0])}</span>
        <div><h3>${escape(user.name)}</h3><p>${escape(user.email)}</p><span class="muted">+51 ${escape(user.phone)}</span></div>
      </article>`).join('') || empty('Sin clientes registrados', 'Las cuentas nuevas aparecerán aquí.')}
    </div>`;
}

function showCourts(courts, blocks) {
  $('#admin-content').innerHTML = `
    <div class="section-heading">
      <h2>Canchas del complejo</h2><button class="button primary compact" id="new-court">+ Agregar cancha</button>
    </div>
    <div class="admin-courts">
      ${courts.map(court => `<article class="manage-court">
        <div class="inline-row">
          <span class="badge ${court.active ? 'confirmed' : 'cancelled'}">${court.active ? 'Activa' : 'Inactiva'}</span>
          <span class="muted">${escape(court.sport_label)}</span>
        </div>
        <h3>${escape(court.name)}</h3><p>${escape(court.district)}</p>
        <div class="inline-row">
          <strong>${money(court.price)} / hora</strong>
          <span>${escape(hourLabel(court.opens_at))} – ${escape(hourLabel(court.closes_at))}</span>
        </div>
        <button class="button secondary full" data-edit-court="${escape(court.id)}">Editar cancha</button>
      </article>`).join('') || empty('Sin canchas registradas', 'Agrega una cancha para publicar sus horarios.')}
    </div>
    <div class="section-heading block-heading">
      <h2>Bloqueos de horario</h2><button class="button secondary compact" id="new-block">+ Bloquear horario</button>
    </div>
    <p class="field-help">Los bloqueos son de una hora y no pueden superponerse con una reserva.</p>
    <div>
      ${blocks.map(block => `<article class="block-row">
        <div>
          <strong>${escape(block.court)}</strong>
          <p>${shortDate(block.start)} · ${timeLabel(block.start)} · ${escape(block.reason)}</p>
        </div>
        <button class="text-button" data-remove-block="${escape(block.id)}">Liberar horario</button>
      </article>`).join('') || '<p class="muted">No hay bloqueos próximos.</p>'}
    </div>`;

  $('#new-court').onclick = event => openCourt(event.currentTarget);
  for (const button of $$('[data-edit-court]')) {
    button.onclick = () => openCourt(button, courts.find(court => court.id === Number(button.dataset.editCourt)));
  }
  $('#new-block').onclick = event => openBlock(courts.filter(court => court.active), event.currentTarget);
  for (const button of $$('[data-remove-block]')) {
    button.onclick = () => busy(button, async () => {
      await api('admin/blocks/', { method: 'DELETE', body: { id: Number(button.dataset.removeBlock) } });
      toast('Horario liberado.');
      await render();
    });
  }
}

function openCourt(trigger, court = {
  name: '', sport: 'futbol', description: '', district: 'Lima', price: 80,
  capacity: 10, opens_at: 8, closes_at: 23, active: true,
}) {
  openModal(court.id ? 'Editar cancha' : 'Nueva cancha', `
    <form id="court-form" class="stack">
      <label>Nombre<input name="name" value="${escape(court.name)}" required maxlength="80"></label>
      <label>Deporte<select name="sport">
        ${sports.map(([value, label]) => `<option value="${value}" ${court.sport === value ? 'selected' : ''}>${label}</option>`).join('')}
      </select></label>
      <label>Descripción<input name="description" value="${escape(court.description)}" required maxlength="180"
        placeholder="Grass sintético · Fútbol 5 · Iluminación LED"></label>
      <label>Distrito y ciudad<input name="district" value="${escape(court.district)}" required maxlength="70"></label>
      <div class="form-grid">
        <label>Precio por hora (S/)<input name="price" type="number" min="1" max="999999" step="0.01" value="${escape(court.price)}" required></label>
        <label>Jugadores<input name="capacity" type="number" min="2" max="30" value="${escape(court.capacity)}" required></label>
        <label>Hora de apertura<input name="opens_at" type="number" min="0" max="23" value="${escape(court.opens_at)}" required></label>
        <label>Hora de cierre<input name="closes_at" type="number" min="1" max="24" value="${escape(court.closes_at)}" required></label>
      </div>
      <label class="checkbox-label"><input type="checkbox" name="active" ${court.active ? 'checked' : ''}>Disponible para nuevas reservas</label>
      <p class="field-help">Los cambios de precio y horario aplican a nuevas reservas. Las existentes se conservan.</p>
      <button class="button primary" type="submit">Guardar cancha</button><p class="form-error" role="alert"></p>
    </form>`, trigger);

  const form = $('#court-form');
  form.onsubmit = event => {
    event.preventDefault();
    return busy($('button[type=submit]', form), async () => {
      const body = Object.fromEntries(new FormData(form));
      body.active = form.elements.active.checked;
      if (court.id) body.id = court.id;
      await api('admin/courts/', { method: 'POST', body });
      if (form.isConnected) closeModal();
      toast('Cancha guardada.');
      await render();
    }, { form });
  };
}

function openBlock(courts, trigger) {
  if (!courts.length) {
    toast('Agrega o activa una cancha primero.');
    return;
  }

  openModal('Bloquear un horario', `
    <form id="block-form" class="stack">
      <label>Cancha<select name="court_id">
        ${courts.map(court => `<option value="${escape(court.id)}">${escape(court.name)}</option>`).join('')}
      </select></label>
      <div class="form-grid">
        <label>Fecha<input name="date" type="date" value="${state.today}" min="${state.today}" max="${shiftDate(state.today, 60)}" required></label>
        <label>Hora de inicio<input name="hour" type="number" min="0" max="23" value="18" required></label>
      </div>
      <label>Motivo<input name="reason" placeholder="Mantenimiento del grass" minlength="3" maxlength="120" required></label>
      <button class="button primary" type="submit">Bloquear 1 hora</button><p class="form-error" role="alert"></p>
    </form>`, trigger);

  const form = $('#block-form');
  form.onsubmit = event => {
    event.preventDefault();
    return busy($('button[type=submit]', form), async () => {
      await api('admin/blocks/', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      if (form.isConnected) closeModal();
      toast('Horario bloqueado.');
      await render();
    }, { form });
  };
}
