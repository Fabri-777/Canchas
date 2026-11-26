import { api } from '../api/client.js';
import { render } from '../router.js';
import { state } from '../state.js';
import { empty, failure, loading } from '../ui/components.js';
import { $, $$, escape } from '../utils/dom.js';
import { dateFormat, dayLabel, hourLabel, money, shiftDate, shortDate } from '../utils/format.js';
import { icon } from '../utils/icons.js';
import { openAuth } from './auth.js';
import { openCheckout } from './checkout.js';

const sports = [['all', 'Todos'], ['futbol', 'Fútbol'], ['voley', 'Vóley'], ['basket', 'Básquet']];
const slotLabels = { available: 'Disponible', past: 'No disponible', booked: 'Reservado', blocked: 'Mantenimiento' };

function courtOption(court) {
  const selected = court.id === state.court;
  return `<button class="court-option ${selected ? 'selected' : ''}" data-court="${escape(court.id)}" aria-pressed="${selected}">
    <span class="court-option-icon">${icon(court.sport === 'futbol' ? 'ball' : 'people')}</span>
    <span class="court-option-info">
      <strong>${escape(court.name)}</strong><span>${escape(court.description)}</span>
      <span class="court-district">${icon('pin')}${escape(court.district)}</span>
    </span>
    <span class="court-option-price">
      <strong>${money(court.price)}</strong><small>por hora</small>
      <span class="selection-circle">${selected ? icon('check') : ''}</span>
    </span>
  </button>`;
}

function calendar() {
  const latest = shiftDate(state.today, 60);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(state.date, index);
    return `<button class="day ${index === 0 ? 'selected' : ''}" data-date="${date}"
      aria-label="${dayLabel(date)}" aria-pressed="${index === 0}" ${date > latest ? 'disabled' : ''}>
      <span>${dateFormat(`${date}T12:00:00-05:00`, { weekday: 'short' })}</span>
      <strong>${Number(date.slice(-2))}</strong>
      <small>${date === state.today ? 'Hoy' : '&nbsp;'}</small>
    </button>`;
  }).join('');

  return `<div class="calendar-section">
    <div class="section-heading">
      <h2><span class="step">02</span> Elige cuándo jugar</h2>
      <label class="date-picker">${icon('calendar')}
        <input type="date" id="date-picker" value="${state.date}" min="${state.today}" max="${latest}"
          aria-label="Seleccionar fecha" required>
      </label>
    </div>
    <div class="week-strip">
      <button class="week-arrow" id="previous-week" aria-label="Semana anterior" ${state.date <= state.today ? 'disabled' : ''}>‹</button>
      <button class="week-arrow" id="next-week" aria-label="Semana siguiente" ${shiftDate(state.date, 7) > latest ? 'disabled' : ''}>›</button>
      ${days}
    </div>
    <div class="slots-heading">
      <span id="selected-day">${dayLabel(state.date)}</span>
      <span class="availability-legend"><span></span> Disponible</span>
    </div>
    <div id="slots" aria-label="Horarios disponibles" aria-live="polite">${loading('Consultando horarios…')}</div>
    <p class="field-help">${icon('clock')} Horarios de Perú · Cada reserva dura una hora.</p>
  </div>`;
}

export async function renderBooking(token) {
  const { courts } = await api('courts/');
  if (token !== state.routeToken) return;

  const filtered = courts.filter(court => state.sport === 'all' || court.sport === state.sport);
  if (!filtered.some(court => court.id === state.court)) {
    state.court = filtered[0]?.id ?? null;
    state.hour = null;
  }
  const court = filtered.find(item => item.id === state.court);
  $('#main').innerHTML = `
    <div class="page-heading">
      <div>
        <div class="eyebrow">MENOS VUELTAS, MÁS PARTIDO</div>
        <h1>Hoy se juega<span class="accent">.</span></h1>
        <p class="muted">Elige tu cancha, separa tu hora y convoca a tu equipo.</p>
      </div>
      <div class="location-chip">${icon('pin')} Lima, Perú</div>
    </div>
    <section class="court-banner" aria-label="Cancha de fútbol referencial">
      <div class="banner-copy">
        <span class="overline">TU EQUIPO. TU CANCHA. TU MOMENTO.</span>
        <h2>La próxima pichanga<br>empieza aquí.</h2>
        <span class="banner-detail">${icon('clock')} Turnos de 60 minutos <span class="banner-separator">/</span> Precios en soles</span>
      </div>
      <span class="image-credit">Imagen referencial</span>
    </section>
    <section class="booking-workspace">
      <div class="booking-main">
        <div class="section-heading">
          <h2><span class="step">01</span> Encuentra tu cancha</h2>
          <span class="muted small-text">${filtered.length} opciones para jugar</span>
        </div>
        <div class="sport-tabs" role="group" aria-label="Filtrar por deporte">
          ${sports.map(([value, label]) => `<button data-sport="${value}" aria-pressed="${state.sport === value}">
            ${value === 'futbol' ? icon('ball') : ''}${label}</button>`).join('')}
        </div>
        <div class="court-options">
          ${filtered.map(courtOption).join('') || empty('Pronto tendremos más opciones', 'Por ahora no hay canchas disponibles para este deporte.')}
        </div>
        ${court ? calendar() : ''}
      </div>
      <aside class="booking-sidebar">
        <div class="summary-panel" id="booking-summary"></div>
        <div class="booking-policies">
          <h3>Juega con tranquilidad</h3>
          <p>${icon('check')} El precio que ves es el total.</p>
          <p>${icon('check')} Cancela hasta 2 horas antes.</p>
          <p>${icon('check')} Tu horario se guarda 15 minutos mientras pagas.</p>
        </div>
      </aside>
    </section>`;

  for (const button of $$('[data-sport]')) {
    button.onclick = () => updateSelection({ sport: button.dataset.sport });
  }
  for (const button of $$('[data-court]')) {
    button.onclick = () => selectCourt(filtered.find(item => item.id === Number(button.dataset.court)));
  }
  if (!court) {
    $('#booking-summary').innerHTML = '<h2>Tu próxima reserva</h2><p class="muted">Selecciona otro deporte para ver las canchas.</p>';
    return;
  }

  wireCalendar(court);
  renderSummary(court, false);
  await renderSlots(court, token);
}

function updateSelection(selection) {
  Object.assign(state, selection, { hour: null });
  return render();
}

// Choosing a court or a date only touches the parts that depend on it (cards, calendar,
// slots and summary), so the rest of the page stays still instead of being rebuilt.
function selectCourt(court) {
  if (!court || court.id === state.court) return;
  state.court = court.id;
  state.hour = null;
  for (const button of $$('[data-court]')) {
    const selected = Number(button.dataset.court) === court.id;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    $('.selection-circle', button).innerHTML = selected ? icon('check') : '';
  }
  wireCalendar(court);
  renderSummary(court, false);
  renderSlots(court, state.routeToken);
}

function selectDate(court, date) {
  const section = $('.calendar-section');
  const active = document.activeElement;
  const focusTarget = section.contains(active) && active.id ? `#${active.id}` : '.day.selected';
  const hadFocus = section.contains(active);
  const previousSlots = $('#slots').innerHTML;
  state.date = date;
  state.hour = null;
  section.outerHTML = calendar();
  // Keep the previous slots visible until the new day's availability arrives.
  $('#slots').innerHTML = previousSlots;
  wireCalendar(court);
  if (hadFocus) {
    const target = $(focusTarget);
    (target && !target.disabled ? target : $('.day.selected'))?.focus();
  }
  renderSummary(court, false);
  renderSlots(court, state.routeToken);
}

function wireCalendar(court) {
  $('#date-picker').onchange = event => {
    if (event.target.reportValidity()) selectDate(court, event.target.value);
  };
  for (const button of $$('[data-date]')) {
    button.onclick = () => selectDate(court, button.dataset.date);
  }
  $('#previous-week').onclick = () => {
    const previous = shiftDate(state.date, -7);
    selectDate(court, previous < state.today ? state.today : previous);
  };
  $('#next-week').onclick = () => selectDate(court, shiftDate(state.date, 7));
}

let slotRequest = 0;

async function renderSlots(court, token) {
  const request = ++slotRequest;
  // A newer court/date choice or a route change makes this response stale.
  const current = () => token === state.routeToken && request === slotRequest;
  const query = new URLSearchParams({ court: court.id, date: state.date });
  const container = $('#slots');
  container.setAttribute('aria-busy', 'true');
  let slots;
  try {
    ({ slots } = await api(`availability/?${query}`));
  } catch (error) {
    if (current()) {
      container.removeAttribute('aria-busy');
      container.innerHTML = failure('No pudimos cargar los horarios', error.message);
      $('[data-retry]', container).onclick = () => renderSlots(court, state.routeToken);
    }
    return;
  }
  if (!current()) return;
  container.removeAttribute('aria-busy');

  if (!slots.some(slot => slot.hour === state.hour && slot.state === 'available')) state.hour = null;
  const options = slots.map(slot => {
    const selected = state.hour === slot.hour;
    return `<button class="time-slot ${selected ? 'selected' : ''}" data-hour="${escape(slot.hour)}"
      ${slot.state !== 'available' ? 'disabled' : ''} aria-pressed="${selected}">
      <strong>${escape(hourLabel(slot.hour))}</strong>
      <small>${selected ? 'Elegido' : escape(slotLabels[slot.state] ?? 'No disponible')}</small>
    </button>`;
  }).join('');
  container.innerHTML = options
    ? `<div class="slots-grid">${options}</div>`
    : empty('No hay horarios', 'Elige otra fecha para consultar la disponibilidad.');

  const buttons = $$('[data-hour]', container);
  for (const button of buttons) {
    button.onclick = () => {
      state.hour = Number(button.dataset.hour);
      for (const option of buttons) {
        const selected = option === button;
        option.classList.toggle('selected', selected);
        option.setAttribute('aria-pressed', String(selected));
        if (!option.disabled) $('small', option).textContent = selected ? 'Elegido' : 'Disponible';
      }
      renderSummary(court);
    };
  }
  renderSummary(court);
}

function renderSummary(court, ready = true) {
  const selected = ready && state.hour !== null;
  $('#booking-summary').innerHTML = `
    <div class="summary-heading"><h2>Tu reserva</h2>${icon('calendar')}</div>
    <div class="summary-venue">
      <span class="summary-sport">${escape(court.sport_label)}</span>
      <h3>${escape(court.name)}</h3><p>${icon('pin')} ${escape(court.district)}</p>
    </div>
    <dl class="summary-details">
      <div><dt>Fecha</dt><dd>${shortDate(`${state.date}T12:00:00-05:00`)}</dd></div>
      <div><dt>Horario</dt><dd>${selected ? `${hourLabel(state.hour)} – ${hourLabel(state.hour + 1)}` : 'Por elegir'}</dd></div>
      <div><dt>Duración</dt><dd>60 minutos</dd></div>
    </dl>
    <div class="total-row"><span>Total a pagar</span><strong>${money(court.price)}</strong></div>
    <button class="button primary full" id="reserve-button" ${selected ? '' : 'disabled'}>
      Continuar con mi reserva ${icon('arrow')}
    </button>
    <p class="summary-note">${selected ? 'Revisa tu reserva antes de pagar.' : 'Selecciona un horario disponible.'}</p>
    <div class="accepted-payments">
      <span>Medios de pago</span><div><b class="visa">VISA</b><b class="mastercard">Mastercard</b><span>Transferencia</span></div>
    </div>`;
  $('#reserve-button').onclick = event => {
    if (state.user) openCheckout(court, event.currentTarget);
    else openAuth(false, event.currentTarget);
  };
}
