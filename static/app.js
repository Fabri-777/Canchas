import { createDemoApi, storageKey, todayInLima } from './demo-api.js';
const api = createDemoApi();
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const money = value => `S/ ${Number(value).toLocaleString('es-PE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
const dateFormat = (date, options = {}) => new Intl.DateTimeFormat('es-PE', {timeZone:'America/Lima', ...options}).format(new Date(date));
const dayLabel = date => dateFormat(`${date}T12:00:00-05:00`, {weekday:'long', day:'numeric', month:'long'});
const timeLabel = date => dateFormat(date, {hour:'2-digit', minute:'2-digit', hour12:false});
const shortDate = date => dateFormat(date, {day:'numeric', month:'short'});
const shiftDate = (date, offset) => { const day = new Date(`${date}T12:00:00Z`); day.setUTCDate(day.getUTCDate() + offset); return day.toISOString().slice(0,10); };
const state = {user:null, courts:[], court:null, date:null, today:null, hour:null, sport:'all', demo:false, adminTab:'agenda', routeToken:0};
const icons = {
  pin:'<svg viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  arrow:'<svg viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
  clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  calendar:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/></svg>',
  check:'<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
  people:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 2 4v2"/></svg>',
  ball:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m12 7 5 4-2 6H9l-2-6 5-4Zm0-4v4m9 4h-4m0 9-2-3m-8 3 2-3m-6-6h4"/></svg>',
};
const icon = name => `<span class="icon" aria-hidden="true">${icons[name] || icons.ball}</span>`;


let toastTimer;
function toast(message) { $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,5500); }
function openModal(title, content) {
  $('#modal-content').innerHTML=`<div class="modal-heading"><h2 id="modal-title">${escape(title)}</h2><button type="button" class="icon-button" data-close aria-label="Cerrar ventana">×</button></div>${content}`;
  $('[data-close]').onclick=()=>$('#modal').close();
  if (!$('#modal').open) $('#modal').showModal();
}
function errorIn(form, error) { let node=$('[role="alert"]',form); if(!node){node=document.createElement('p');node.className='form-error';node.setAttribute('role','alert');form.append(node);} node.textContent=error.message; }
async function busy(button, task) { if(button.disabled)return;button.disabled=true;button.setAttribute('aria-busy','true');try{await task();}catch(error){toast(error.message);}finally{button.disabled=false;button.removeAttribute('aria-busy');} }
const badge = booking => `<span class="badge ${escape(booking.status)}">${escape(booking.status_label)}</span>`;
const empty = (title, text) => `<div class="empty-state">${icon('calendar')}<h3>${title}</h3><p>${text}</p></div>`;

function header() {
  const current=location.hash.slice(1)||'reservar';
  const links=[['reservar','Reservar cancha'],['reservas','Mis reservas'],['mensajes','Notificaciones']];
  if(state.user?.is_admin)links.push(['admin','Administración']);
  $('#navigation').innerHTML=links.map(([href,label])=>`<a href="#${href}" ${current===href?'aria-current="page"':''}>${label}</a>`).join('');
  $('#account').innerHTML=state.user?`<button class="profile-button" id="profile-button"><span class="avatar">${escape(state.user.name.slice(0,1))}</span><span>${escape(state.user.name.split(' ')[0])}</span></button><button class="text-button" id="logout">Salir</button>`:`<button class="button secondary compact" id="login-button">Ingresar ${icon('arrow')}</button>`;
  if(state.user){$('#profile-button').onclick=profileModal;$('#logout').onclick=event=>busy(event.currentTarget,async()=>{await api('auth/logout/',{method:'POST',body:{}});state.user=null;location.hash='reservar';await render();});}
  else $('#login-button').onclick=()=>authModal();
}

function authModal(register=false) {
  openModal(register?'Crea tu cuenta':'Qué bueno verte por aquí', `<p class="muted">${register?'Guarda tus reservas y encuentra tiempo para jugar.':'Ingresa para reservar y gestionar tus partidos.'}</p>
    <form id="auth-form" class="stack">
      ${register?'<label>Nombre completo<input name="name" autocomplete="name" required minlength="2" maxlength="100"></label><label>Celular<input name="phone" type="tel" autocomplete="tel-national" inputmode="numeric" pattern="9[0-9]{8}" maxlength="9" placeholder="987654321" required></label>':''}
      <label>Correo electrónico<input name="email" type="email" autocomplete="email" required maxlength="150" placeholder="tu@correo.com"></label>
      <label>Contraseña<input name="password" type="password" autocomplete="${register?'new-password':'current-password'}" required ${register?'minlength="8"':''}></label>
      ${register?'<p class="field-help">Usa al menos 8 caracteres. Evita contraseñas comunes o solo números.</p>':''}
      <button class="button primary" type="submit">${register?'Crear cuenta':'Ingresar'} ${icon('arrow')}</button>
      <p role="alert" class="form-error"></p>
    </form>
    <button class="text-button accent" id="switch-auth">${register?'Ya tengo una cuenta':'¿Primera vez? Crear una cuenta'}</button>
    ${state.demo?'<div class="demo-access"><span class="eyebrow">EXPLORA LA DEMOSTRACIÓN</span><div class="button-row"><button class="button secondary" data-demo="client">Soy cliente</button><button class="button secondary" data-demo="admin">Soy administrador</button></div></div>':''}`);
  $('#switch-auth').onclick=()=>authModal(!register);
  $('#auth-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget;await busy($('button[type=submit]',form),async()=>{try{const result=await api(`auth/${register?'register':'login'}/`,{method:'POST',body:Object.fromEntries(new FormData(form))});state.user=result.user;$('#modal').close();await render();toast(`¡Hola, ${state.user.name.split(' ')[0]}!`);}catch(error){errorIn(form,error);}});};
  $$('[data-demo]').forEach(button=>button.onclick=()=>busy(button,async()=>{const result=await api('auth/demo/',{method:'POST',body:{role:button.dataset.demo}});state.user=result.user;$('#modal').close();if(state.user.is_admin)location.hash='admin';await render();}));
}

function profileModal() {
  openModal('Mi perfil',`<form class="stack" id="profile-form"><label>Nombre completo<input name="name" value="${escape(state.user.name)}" required minlength="2" maxlength="100"></label><label>Celular peruano<input name="phone" value="${escape(state.user.phone)}" type="tel" pattern="9[0-9]{8}" maxlength="9" required></label><label>Correo electrónico<input value="${escape(state.user.email)}" disabled></label><button class="button primary" type="submit">Guardar cambios</button><p role="alert" class="form-error"></p></form>`);
  $('#profile-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget;await busy($('button',form),async()=>{try{state.user=(await api('profile/',{method:'POST',body:Object.fromEntries(new FormData(form))})).user;$('#modal').close();header();toast('Tu perfil está actualizado.');}catch(error){errorIn(form,error);}});};
}

async function render() {
  const today=todayInLima();
  if(state.today!==today){state.today=today;if(state.date<today){state.date=today;state.hour=null;}}
  const token=++state.routeToken;
  header();
  const route=location.hash.slice(1)||'reservar';
  if(route!=='reservar'&&!state.user){$('#main').innerHTML=empty('Tu próximo partido te espera','Ingresa a tu cuenta para ver esta sección.')+'<div class="center"><button class="button primary" id="route-login">Ingresar a mi cuenta</button></div>';$('#route-login').onclick=()=>authModal();return;}
  try {
    if(route==='reservar')await renderBooking(token);
    else if(route==='reservas')await renderReservations(token);
    else if(route==='mensajes')await renderMessages(token);
    else if(route==='admin'&&state.user.is_admin)await renderAdmin(token);
    else {location.hash='reservar';}
  } catch(error){if(token===state.routeToken){$('#main').innerHTML=empty('No pudimos cargar esta sección',escape(error.message))+'<div class="center"><button class="button secondary" id="retry">Volver a intentar</button></div>';$('#retry').onclick=render;}}
}

async function renderBooking(token) {
  state.courts=(await api('courts/')).courts;
  if(token!==state.routeToken)return;
  const filtered=state.courts.filter(court=>state.sport==='all'||court.sport===state.sport);
  if(!filtered.some(court=>court.id===state.court)){state.court=filtered[0]?.id;state.hour=null;}
  const court=filtered.find(court=>court.id===state.court);
  $('#main').innerHTML=`<div class="page-heading"><div><div class="eyebrow">MENOS VUELTAS, MÁS PARTIDO</div><h1>Hoy se juega<span class="accent">.</span></h1><p class="muted">Elige tu cancha, separa tu hora y convoca a tu equipo.</p></div><div class="location-chip">${icon('pin')} Lima, Perú</div></div>
    <section class="court-banner" aria-label="Cancha de fútbol referencial"><div class="banner-copy"><span class="overline">TU EQUIPO. TU CANCHA. TU MOMENTO.</span><h2>La próxima pichanga<br>empieza aquí.</h2><span class="banner-detail">${icon('clock')} Turnos de 60 minutos <span class="banner-separator">/</span> Precios en soles</span></div><span class="image-credit">Imagen referencial</span></section>
    <section class="booking-workspace"><div class="booking-main">
      <div class="section-heading"><h2><span class="step">01</span> Encuentra tu cancha</h2><span class="muted small-text">${filtered.length} opciones para jugar</span></div>
      <div class="sport-tabs" role="group" aria-label="Filtrar por deporte">${[['all','Todos'],['futbol','Fútbol'],['voley','Vóley'],['basket','Básquet']].map(([value,label])=>`<button data-sport="${value}" aria-pressed="${state.sport===value}">${value==='futbol'?icon('ball'):''}${label}</button>`).join('')}</div>
      <div class="court-options">${filtered.map(c=>`<button class="court-option ${c.id===state.court?'selected':''}" data-court="${c.id}" aria-pressed="${c.id===state.court}"><span class="court-option-icon">${icon(c.sport==='futbol'?'ball':'people')}</span><span class="court-option-info"><strong>${escape(c.name)}</strong><span>${escape(c.description)}</span><span class="court-district">${icon('pin')}${escape(c.district)}</span></span><span class="court-option-price"><strong>${money(c.price)}</strong><small>por hora</small><span class="selection-circle">${c.id===state.court?icon('check'):''}</span></span></button>`).join('')||empty('Pronto tendremos más opciones','Por ahora no hay canchas disponibles para este deporte.')}</div>
      ${court?`<div class="calendar-section"><div class="section-heading"><h2><span class="step">02</span> Elige cuándo jugar</h2><label class="date-picker">${icon('calendar')}<input type="date" id="date-picker" value="${state.date}" min="${state.today}" max="${shiftDate(state.today,60)}" aria-label="Seleccionar fecha"></label></div><div class="week-strip"><button class="week-arrow" id="previous-week" aria-label="Semana anterior" ${state.date<=state.today?'disabled':''}>‹</button>${Array.from({length:7},(_,index)=>{const date=shiftDate(state.date,index);return `<button class="day ${index===0?'selected':''}" data-date="${date}" ${date>shiftDate(state.today,60)?'disabled':''}><span>${dateFormat(date+'T12:00:00-05:00',{weekday:'short'})}</span><strong>${Number(date.slice(-2))}</strong>${date===state.today?'<small>Hoy</small>':'<small>&nbsp;</small>'}</button>`;}).join('')}<button class="week-arrow" id="next-week" aria-label="Semana siguiente" ${shiftDate(state.date,7)>shiftDate(state.today,60)?'disabled':''}>›</button></div><div class="slots-heading"><span id="selected-day">${dayLabel(state.date)}</span><span class="availability-legend"><span></span> Disponible</span></div><div class="slots-grid" id="slots" aria-label="Horarios disponibles" aria-live="polite">Consultando horarios…</div><p class="field-help">${icon('clock')} Horarios de Perú · Cada reserva dura una hora.</p></div>`:''}
    </div><aside class="booking-sidebar"><div class="summary-panel" id="booking-summary"></div><div class="booking-policies"><h3>Juega con tranquilidad</h3><p>${icon('check')} El precio que ves es el total.</p><p>${icon('check')} Cancela hasta 2 horas antes.</p><p>${icon('check')} Tu horario se guarda 15 minutos mientras pagas.</p></div></aside></section>`;
  $$('[data-sport]').forEach(button=>button.onclick=()=>{state.sport=button.dataset.sport;state.hour=null;render();});
  $$('[data-court]').forEach(button=>button.onclick=()=>{state.court=Number(button.dataset.court);state.hour=null;render();});
  if(court){
    $('#date-picker').onchange=event=>{if(event.target.checkValidity()){state.date=event.target.value;state.hour=null;render();}};
    $$('[data-date]').forEach(button=>button.onclick=()=>{state.date=button.dataset.date;state.hour=null;render();});
    $('#previous-week').onclick=()=>{state.date=shiftDate(state.date,-7)<state.today?state.today:shiftDate(state.date,-7);state.hour=null;render();};
    $('#next-week').onclick=()=>{state.date=shiftDate(state.date,7);state.hour=null;render();};
    renderSummary(court);
    const result=await api(`availability/?court=${court.id}&date=${state.date}`);
    if(token!==state.routeToken)return;
    if(!result.slots.some(slot=>slot.hour===state.hour&&slot.state==='available'))state.hour=null;
    $('#slots').innerHTML=result.slots.map(slot=>`<button class="time-slot ${state.hour===slot.hour?'selected':''}" data-hour="${slot.hour}" ${slot.state!=='available'?'disabled':''} aria-pressed="${state.hour===slot.hour}"><strong>${String(slot.hour).padStart(2,'0')}:00</strong><small>${{available:state.hour===slot.hour?'Elegido':'Disponible',past:'No disponible',booked:'Reservado',blocked:'Mantenimiento'}[slot.state]}</small></button>`).join('');
    $$('[data-hour]').forEach(button=>button.onclick=()=>{state.hour=Number(button.dataset.hour);$$('[data-hour]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));if(!b.disabled)$('small',b).textContent=b===button?'Elegido':'Disponible';});renderSummary(court);});
    renderSummary(court);
  }else $('#booking-summary').innerHTML='<h2>Tu próxima reserva</h2><p class="muted">Selecciona otro deporte para ver las canchas.</p>';
}

function renderSummary(court){
  $('#booking-summary').innerHTML=`<div class="summary-heading"><h2>Tu reserva</h2>${icon('calendar')}</div><div class="summary-venue"><span class="summary-sport">${escape(court.sport_label)}</span><h3>${escape(court.name)}</h3><p>${icon('pin')} ${escape(court.district)}</p></div><dl class="summary-details"><div><dt>Fecha</dt><dd>${shortDate(state.date+'T12:00:00-05:00')}</dd></div><div><dt>Horario</dt><dd>${state.hour===null?'Por elegir':`${String(state.hour).padStart(2,'0')}:00 – ${String(state.hour+1).padStart(2,'0')}:00`}</dd></div><div><dt>Duración</dt><dd>60 minutos</dd></div></dl><div class="total-row"><span>Total a pagar</span><strong>${money(court.price)}</strong></div><button class="button primary full" id="reserve-button" ${state.hour===null?'disabled':''}>Continuar con mi reserva ${icon('arrow')}</button><p class="summary-note">${state.hour===null?'Selecciona un horario disponible.':'Revisa tu reserva antes de pagar.'}</p><div class="accepted-payments"><span>Medios de pago</span><div><b class="visa">VISA</b><b class="mastercard">Mastercard</b><span>Transferencia</span></div></div>`;
  $('#reserve-button').onclick=()=>{if(!state.user){authModal();return;}checkoutModal(court);};
}

function checkoutModal(court){
  openModal('Ya casi estás en la cancha',`<div class="checkout-recap"><strong>${escape(court.name)}</strong><span>${dayLabel(state.date)} · ${String(state.hour).padStart(2,'0')}:00</span><b>${money(court.price)}</b></div><form id="checkout-form" class="stack"><fieldset><legend>Elige cómo pagar</legend><label class="payment-choice"><input name="method" type="radio" value="visa" checked><span class="visa">VISA</span><span>Tarjeta Visa</span></label><label class="payment-choice"><input name="method" type="radio" value="mastercard"><span class="mastercard">●●</span><span>Tarjeta Mastercard</span></label><label class="payment-choice"><input name="method" type="radio" value="transfer"><span>Transferencia con comprobante</span></label></fieldset><div class="notice">Demostración: no se realizará ningún cobro. Usaremos una tarjeta ficticia; no ingreses datos bancarios reales.</div><p class="field-help">Turno de 60 minutos. Tienes 15 minutos para pagar o adjuntar un comprobante. Cancela hasta 2 horas antes.</p><button class="button primary" type="submit">Separar horario · ${money(court.price)}</button><p role="alert" class="form-error"></p></form>`);
  $('#checkout-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget;await busy($('button[type=submit]',form),async()=>{try{const result=await api('bookings/',{method:'POST',body:{court_id:court.id,date:state.date,hour:state.hour,method:new FormData(form).get('method')}});paymentModal(result.booking);render();}catch(error){errorIn(form,error);render();}});};
}

function paymentModal(booking){
  const transfer=booking.payment.method==='transfer';
  openModal(transfer?'Adjunta tu comprobante':'Pago con tarjeta de prueba',`<div class="checkout-recap"><strong>${escape(booking.court.name)} <span class="muted">${booking.code}</span></strong><span>${shortDate(booking.start)} · ${timeLabel(booking.start)} a ${timeLabel(booking.end)}</span><b>${money(booking.total)}</b></div><p class="field-help">Completa el pago antes de las ${timeLabel(booking.expires_at)}. Puedes retomarlo desde Mis reservas.</p>${transfer?`<div class="notice">Transferencia de demostración. Adjunta una imagen ficticia del comprobante; no transfieras dinero real.</div><form id="receipt-form" class="stack"><label>Comprobante (JPG o PNG, hasta 5 MB)<input type="file" name="receipt" accept="image/jpeg,image/png" required></label><button class="button primary" type="submit">Enviar para revisión</button><p role="alert" class="form-error"></p></form>`:`<div class="demo-bank-card"><span>${booking.payment.method==='visa'?'VISA':'Mastercard'}</span><strong>•••• &nbsp; •••• &nbsp; •••• &nbsp; 4242</strong><small>TARJETA FICTICIA · SIN COBRO REAL</small></div><div class="notice">Simulación local. La aplicación no solicita ni almacena números de tarjeta o códigos de seguridad.</div><div class="stack"><button class="button primary" id="demo-pay">Simular pago aprobado · ${money(booking.total)}</button><button class="text-button" id="demo-decline">Probar un pago rechazado</button></div>`}`);
  if(transfer){$('#receipt-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget;await busy($('button',form),async()=>{try{await api(`bookings/${booking.id}/upload/`,{method:'POST',body:new FormData(form)});successModal('Comprobante enviado','El administrador revisará tu pago. Tu horario queda separado durante la revisión.',booking);render();}catch(error){errorIn(form,error);}});};}
  else{
    $('#demo-pay').onclick=event=>busy(event.currentTarget,async()=>{const result=await api(`bookings/${booking.id}/pay/`,{method:'POST',body:{result:'approved'}});successModal('¡Listo, tu cancha está reservada!','Pago de prueba aprobado. Ya puedes convocar a tu equipo.',result.booking);render();});
    $('#demo-decline').onclick=event=>busy(event.currentTarget,async()=>{await api(`bookings/${booking.id}/pay/`,{method:'POST',body:{result:'rejected'}});toast('Pago de prueba rechazado. Puedes reintentar antes del vencimiento.');render();});
  }
}

function successModal(title, text, booking){openModal(title,`<div class="success-content"><span class="success-check">${icon('check')}</span><p>${escape(text)}</p><strong>${booking.code} · ${money(booking.total)}</strong><p class="muted">${escape(booking.court.name)} · ${shortDate(booking.start)} · ${timeLabel(booking.start)}</p><button class="button primary" id="view-bookings">Ver mis reservas ${icon('arrow')}</button></div>`);$('#view-bookings').onclick=()=>{$('#modal').close();location.hash='reservas';render();};}

function bookingCard(booking,admin=false){return `<article class="reservation-card"><div class="reservation-icon">${icon('ball')}</div><div class="reservation-info"><div class="inline-row"><span class="eyebrow">${booking.code}</span>${badge(booking)}</div><h3>${escape(booking.court.name)}</h3><p>${icon('calendar')} ${shortDate(booking.start)} · ${timeLabel(booking.start)} – ${timeLabel(booking.end)}</p><p class="small-text muted">${admin?escape(booking.customer)+' · ':''}${escape(booking.payment.method_label)} · ${escape(booking.payment.status_label)}</p></div><div class="reservation-actions"><strong>${money(booking.total)}</strong><div class="button-row">${booking.status==='pending'&&!admin?`<button class="button primary compact" data-pay="${booking.id}">Completar pago</button>`:''}${booking.payment.has_receipt?`<button class="text-button" data-receipt="${booking.id}">Ver comprobante ↗</button>`:''}${booking.status==='review'&&admin?`<button class="button primary compact" data-action="approve" data-id="${booking.id}">Aprobar</button><button class="text-button danger" data-action="reject" data-id="${booking.id}">Rechazar</button>`:''}${['pending','review','confirmed'].includes(booking.status)?`<button class="text-button" data-action="cancel" data-id="${booking.id}">Cancelar</button>`:''}</div></div></article>`;}

function wireBookingActions(rows){
  $$('[data-receipt]').forEach(button=>button.onclick=()=>busy(button,async()=>{
    const result=await api(`receipts/${button.dataset.receipt}/`);
    openModal('Comprobante de demostración','<img class="receipt-preview" alt="Comprobante ficticio adjunto">');
    $('.receipt-preview').src=result.receipt;
  }));
  $$('[data-pay]').forEach(button=>button.onclick=()=>paymentModal(rows.find(b=>b.id===Number(button.dataset.pay))));
  $$('[data-action]').forEach(button=>button.onclick=()=>{
    const action=button.dataset.action;const booking=rows.find(b=>b.id===Number(button.dataset.id));
    if(action==='approve'){busy(button,async()=>{await api(`bookings/${booking.id}/approve/`,{method:'POST',body:{}});toast('Pago aprobado y reserva confirmada.');await render();});return;}
    openModal(action==='reject'?'Rechazar comprobante':'Cancelar reserva',`<p>Se liberará el horario de <strong>${escape(booking.court.name)}</strong> del ${shortDate(booking.start)} a las ${timeLabel(booking.start)}.</p>${booking.payment.status==='paid'?'<div class="notice">El reembolso también es simulado. No se moverá dinero real.</div>':''}<div class="button-row"><button class="button secondary" id="keep-booking">Conservar reserva</button><button class="button destructive" id="confirm-cancel">${action==='reject'?'Rechazar y liberar':'Sí, cancelar'}</button></div>`);
    $('#keep-booking').onclick=()=>$('#modal').close();$('#confirm-cancel').onclick=event=>busy(event.currentTarget,async()=>{await api(`bookings/${booking.id}/${action}/`,{method:'POST',body:{}});$('#modal').close();toast('La reserva fue cancelada y el horario se liberó.');await render();});
  });
}

async function renderReservations(token){const {bookings}=await api('bookings/');if(token!==state.routeToken)return;$('#main').innerHTML=`<div class="page-heading"><div><div class="eyebrow">TU AGENDA DE PARTIDOS</div><h1>Mis reservas<span class="accent">.</span></h1><p class="muted">Todo listo para volver a la cancha.</p></div><a class="button primary" href="#reservar">Nueva reserva ${icon('arrow')}</a></div><div class="reservation-list">${bookings.map(booking=>bookingCard(booking)).join('')||empty('Tu agenda empieza con un partido','Todavía no tienes reservas. Elige tu cancha y tu próximo horario.')}</div>`;wireBookingActions(bookings);}

async function renderMessages(token){const {notifications}=await api('notifications/');if(token!==state.routeToken)return;$('#main').innerHTML=`<div class="page-heading"><div><div class="eyebrow">NO TE PIERDAS EL PARTIDO</div><h1>Notificaciones<span class="accent">.</span></h1><p class="muted">Confirmaciones, cancelaciones y recordatorios.</p></div><button class="button secondary" id="refresh-messages">Actualizar</button></div><div class="notice">Bandeja de demostración: estos mensajes simulan WhatsApp y no se envían a teléfonos reales. Los recordatorios se programan 2 horas antes del partido.</div><div class="notification-list">${notifications.map(n=>`<article class="notification-card"><div class="message-logo">W</div><div><div class="inline-row"><strong>${n.channel}</strong><span class="badge ${n.status==='simulated'?'confirmed':'pending'}">${{simulated:'Envío simulado',scheduled:'Programado',cancelled:'Cancelado'}[n.status]}</span><span class="muted small-text">${shortDate(n.scheduled_at)} · ${timeLabel(n.scheduled_at)}</span></div>${state.user.is_admin?`<p class="small-text muted">Para: ${escape(n.customer)} · ${n.code}</p>`:''}<p>${escape(n.text)}</p></div></article>`).join('')||empty('Aún no hay mensajes','Aquí aparecerán los avisos cuando confirmes o canceles una reserva.')}</div>`;$('#refresh-messages').onclick=render;}

async function renderAdmin(token){
  const data=await api('admin/overview/');if(token!==state.routeToken)return;
  $('#main').innerHTML=`<div class="page-heading"><div><div class="eyebrow">PANEL DE ADMINISTRACIÓN</div><h1>Tu cancha, en orden<span class="accent">.</span></h1><p class="muted">Gestiona las reservas, la disponibilidad y los pagos.</p></div><span class="role-label">Administrador</span></div><div class="stats-grid"><div><span>Reservas confirmadas hoy</span><strong>${data.stats.today}</strong></div><div><span>Pagos por revisar</span><strong>${data.stats.review}</strong></div><div><span>Total pagado en la demo</span><strong>${money(data.stats.income)}</strong></div></div><div class="admin-tabs" role="group" aria-label="Secciones de administración">${[['agenda','Agenda y reservas'],['payments','Pagos'],['courts','Canchas y horarios'],['clients','Clientes']].map(([id,label])=>`<button data-admin-tab="${id}" aria-pressed="${state.adminTab===id}">${label}</button>`).join('')}</div><div id="admin-content"></div>`;
  $$('[data-admin-tab]').forEach(button=>button.onclick=()=>{state.adminTab=button.dataset.adminTab;render();});
  if(state.adminTab==='agenda'||state.adminTab==='payments'){
    const isPayment=state.adminTab==='payments';
    const rows=isPayment?data.bookings.filter(b=>b.status==='review'||b.payment.status==='paid'||b.payment.status==='refunded'):data.bookings;
    $('#admin-content').innerHTML=`<div class="section-heading"><h2>${isPayment?'Control de pagos':'Agenda de reservas'}</h2><label class="inline-label">Estado<select id="status-filter"><option value="all">Todos</option><option value="confirmed">Confirmadas</option><option value="pending">Pendientes</option><option value="review">En revisión</option><option value="cancelled">Canceladas</option><option value="expired">Vencidas</option></select></label></div><div id="admin-bookings"></div>`;
    const draw=()=>{const filtered=rows.filter(b=>$('#status-filter').value==='all'||b.status===$('#status-filter').value);$('#admin-bookings').innerHTML=filtered.map(b=>bookingCard(b,true)).join('')||empty('No hay reservas en esta vista','Las nuevas reservas y pagos aparecerán aquí.');wireBookingActions(rows);};$('#status-filter').onchange=draw;draw();
  }else if(state.adminTab==='clients'){
    $('#admin-content').innerHTML=`<div class="section-heading"><h2>Clientes registrados</h2><span class="muted">${data.users.length} clientes</span></div><div class="client-grid">${data.users.map(user=>`<article class="client-card"><span class="avatar">${escape(user.name[0])}</span><div><h3>${escape(user.name)}</h3><p>${escape(user.email)}</p><span class="muted">+51 ${escape(user.phone)}</span></div></article>`).join('')||empty('Sin clientes registrados','Las cuentas nuevas aparecerán aquí.')}</div>`;
  }else{
    $('#admin-content').innerHTML=`<div class="section-heading"><h2>Canchas del complejo</h2><button class="button primary compact" id="new-court">+ Agregar cancha</button></div><div class="admin-courts">${data.courts.map(c=>`<article class="manage-court"><div class="inline-row"><span class="badge ${c.active?'confirmed':'cancelled'}">${c.active?'Activa':'Inactiva'}</span><span class="muted">${escape(c.sport_label)}</span></div><h3>${escape(c.name)}</h3><p>${escape(c.district)}</p><div class="inline-row"><strong>${money(c.price)} / hora</strong><span>${String(c.opens_at).padStart(2,'0')}:00 – ${String(c.closes_at).padStart(2,'0')}:00</span></div><button class="button secondary full" data-edit-court="${c.id}">Editar cancha</button></article>`).join('')}</div><div class="section-heading block-heading"><h2>Bloqueos de horario</h2><button class="button secondary compact" id="new-block">+ Bloquear horario</button></div><p class="field-help">Los bloqueos son de una hora y no pueden superponerse con una reserva.</p><div>${data.blocks.map(block=>`<article class="block-row"><div><strong>${escape(block.court)}</strong><p>${shortDate(block.start)} · ${timeLabel(block.start)} · ${escape(block.reason)}</p></div><button class="text-button" data-remove-block="${block.id}">Liberar horario</button></article>`).join('')||'<p class="muted">No hay bloqueos próximos.</p>'}</div>`;
    $('#new-court').onclick=()=>courtModal();$$('[data-edit-court]').forEach(button=>button.onclick=()=>courtModal(data.courts.find(c=>c.id===Number(button.dataset.editCourt))));
    $('#new-block').onclick=()=>blockModal(data.courts.filter(c=>c.active));
    $$('[data-remove-block]').forEach(button=>button.onclick=()=>busy(button,async()=>{await api('admin/blocks/',{method:'DELETE',body:{id:Number(button.dataset.removeBlock)}});toast('Horario liberado.');await render();}));
  }
}

function courtModal(court={name:'',sport:'futbol',description:'',district:'Lima',price:80,capacity:10,opens_at:8,closes_at:23,active:true}){
  openModal(court.id?'Editar cancha':'Nueva cancha',`<form id="court-form" class="stack"><label>Nombre<input name="name" value="${escape(court.name)}" required maxlength="80"></label><label>Deporte<select name="sport">${[['futbol','Fútbol'],['voley','Vóley'],['basket','Básquet']].map(([value,label])=>`<option value="${value}" ${court.sport===value?'selected':''}>${label}</option>`).join('')}</select></label><label>Descripción<input name="description" value="${escape(court.description)}" required maxlength="180" placeholder="Grass sintético · Fútbol 5 · Iluminación LED"></label><label>Distrito y ciudad<input name="district" value="${escape(court.district)}" required maxlength="70"></label><div class="form-grid"><label>Precio por hora (S/)<input name="price" type="number" min="1" max="999999" step="0.01" value="${court.price}" required></label><label>Jugadores<input name="capacity" type="number" min="2" max="30" value="${court.capacity}" required></label><label>Hora de apertura<input name="opens_at" type="number" min="0" max="23" value="${court.opens_at}" required></label><label>Hora de cierre<input name="closes_at" type="number" min="1" max="24" value="${court.closes_at}" required></label></div><label class="checkbox-label"><input type="checkbox" name="active" ${court.active?'checked':''}>Disponible para nuevas reservas</label><p class="field-help">Los cambios de precio y horario aplican a nuevas reservas. Las existentes se conservan.</p><button class="button primary" type="submit">Guardar cancha</button><p class="form-error" role="alert"></p></form>`);
  $('#court-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget;await busy($('button',form),async()=>{try{const values=Object.fromEntries(new FormData(form));values.active=form.elements.active.checked;if(court.id)values.id=court.id;await api('admin/courts/',{method:'POST',body:values});$('#modal').close();toast('Cancha guardada.');await render();}catch(error){errorIn(form,error);}});};
}

function blockModal(courts){
  if(!courts.length){toast('Agrega o activa una cancha primero.');return;}
  openModal('Bloquear un horario',`<form id="block-form" class="stack"><label>Cancha<select name="court_id">${courts.map(c=>`<option value="${c.id}">${escape(c.name)}</option>`).join('')}</select></label><div class="form-grid"><label>Fecha<input name="date" type="date" value="${state.today}" min="${state.today}" max="${shiftDate(state.today,60)}" required></label><label>Hora de inicio<input name="hour" type="number" min="0" max="23" value="18" required></label></div><label>Motivo<input name="reason" placeholder="Mantenimiento del grass" minlength="3" maxlength="120" required></label><button class="button primary" type="submit">Bloquear 1 hora</button><p class="form-error" role="alert"></p></form>`);
  $('#block-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget;await busy($('button',form),async()=>{try{await api('admin/blocks/',{method:'POST',body:Object.fromEntries(new FormData(form))});$('#modal').close();toast('Horario bloqueado.');await render();}catch(error){errorIn(form,error);}});};
}

$('#reset-demo').onclick=()=>{
  openModal('Reiniciar demostración','<p>Se eliminarán las cuentas creadas, reservas, comprobantes y cambios de canchas de esta demo en este navegador. Volverán las cuentas y canchas de ejemplo.</p><div class="button-row"><button class="button secondary" id="keep-demo">Conservar datos</button><button class="button destructive" id="confirm-reset">Sí, reiniciar</button></div>');
  $('#keep-demo').onclick=()=>$('#modal').close();
  $('#confirm-reset').onclick=event=>busy(event.currentTarget,async()=>{await api('demo/reset/',{method:'POST'});location.reload();});
};
window.addEventListener('storage',event=>{if(event.key===storageKey&&!$('#modal').open)api('session/').then(session=>{state.user=session.user;render();}).catch(error=>toast(error.message));});
setInterval(()=>{if(!document.hidden&&!$('#modal').open)render();},60000);
window.addEventListener('hashchange',render);
try{const session=await api('session/');Object.assign(state,{user:session.user,demo:session.demo,today:session.today,date:session.today});await render();}
catch(error){$('#main').innerHTML=empty('No pudimos iniciar la aplicación',escape(error.message));}
