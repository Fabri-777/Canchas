// Demo estática: los permisos organizan la interfaz, no son seguridad de servidor.
export const storageKey = `cancha-demo-v1:${new URL('../', import.meta.url).pathname}`;
const HOUR = 3600000;
const ACTIVE = ['pending', 'review', 'confirmed'];
const SPORTS = {futbol: 'Fútbol', voley: 'Vóley', basket: 'Básquet'};
const STATUS = {pending: 'Pendiente de pago', review: 'En revisión', confirmed: 'Confirmada', cancelled: 'Cancelada', expired: 'Vencida'};
const PAYMENTS = {pending: 'Pendiente', review: 'En revisión', paid: 'Pagado', rejected: 'Rechazado', refunded: 'Reembolso simulado'};
export const todayInLima = (now = Date.now()) => new Date(now - 5 * HOUR).toISOString().slice(0, 10);
const iso = time => new Date(time).toISOString();
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const publicUser = user => user ? {id:user.id, name:user.name, email:user.email, phone:user.phone, is_admin:user.is_admin} : null;

function seed() {
  return {version:1, nextUser:3, nextBooking:1, nextCourt:4, nextBlock:1, users:[
    {id:1, name:'Diego Ramírez', email:'cliente@cancha.local', phone:'999000111', is_admin:false},
    {id:2, name:'Valeria Torres', email:'admin@cancha.local', phone:'999000111', is_admin:true}
  ], courts:[
    {id:1, name:'La Tribuna', sport:'futbol', description:'Grass sintético · Fútbol 5 · Iluminación LED', district:'Santiago de Surco, Lima', price:80, capacity:10},
    {id:2, name:'El Mirador', sport:'futbol', description:'Grass sintético · Fútbol 7 · Iluminación LED', district:'San Borja, Lima', price:120, capacity:14},
    {id:3, name:'La Central', sport:'voley', description:'Losa deportiva · Vóley 6 · Iluminación LED', district:'Santiago de Surco, Lima', price:50, capacity:12}
  ].map(c => ({...c, opens_at:8, closes_at:23, active:true})), bookings:[], blocks:[], notifications:[]};
}

async function passwordHash(password, salt) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2', salt:new TextEncoder().encode(salt), iterations:100000, hash:'SHA-256'}, material, 256);
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2,'0')).join('');
}

async function imageReceipt(file) {
  requireThat(file && file.size > 0 && file.size <= 5 * 1024 * 1024, 'Adjunta una imagen de hasta 5 MB.');
  requireThat(['image/jpeg','image/png'].includes(file.type), 'Solo se aceptan imágenes JPG o PNG.');
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('El archivo no es una imagen JPG o PNG válida.'); }
  try {
    requireThat(bitmap.width * bitmap.height <= 40000000, 'La imagen es demasiado grande. Reduce su resolución.');
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff'; context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const result = canvas.toDataURL('image/jpeg',0.7);
    requireThat(result.length <= 900000, 'Reduce el tamaño de la imagen para guardarla en esta demo.');
    return result;
  } finally { bitmap.close(); }
}

export function createDemoApi({storage=globalThis.localStorage, session=globalThis.sessionStorage, now=()=>Date.now(), key=storageKey, locks=globalThis.navigator?.locks, receiptEncoder=imageReceipt} = {}) {
  const sessionKey = key + ':session';
  let queue = Promise.resolve();
  function load() {
    let raw;
    try { raw = storage.getItem(key); } catch { throw new Error('Activa el almacenamiento del navegador para usar la demo.'); }
    if (!raw) return seed();
    try {
      const data = JSON.parse(raw);
      if (data.version !== 1 || !['users','courts','bookings','blocks','notifications'].every(field=>Array.isArray(data[field]))) throw new Error();
      return data;
    } catch { throw new Error('No se pudieron leer los datos guardados. Usa «Reiniciar demo» para empezar otra vez.'); }
  }
  function save(db) {
    try { storage.setItem(key, JSON.stringify(db)); }
    catch { throw new Error('No hay espacio para guardar el cambio. Usa una imagen más pequeña o reinicia la demo.'); }
  }
  function startTime(date, hour) {
    const start = Date.parse(`${date}T${String(hour).padStart(2,'0')}:00:00-05:00`);
    requireThat(/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isInteger(Number(hour)) && Number(hour)>=0 && Number(hour)<=23 && Number.isFinite(start) && todayInLima(start)===date, 'Selecciona una fecha y un horario válidos.');
    return start;
  }
  function getCourt(db, id) {
    const court = db.courts.find(c => c.id === Number(id));
    requireThat(court, 'La cancha ya no está disponible.'); return court;
  }
  function occupied(db, courtId, start) {
    return db.bookings.some(b=>b.court_id===courtId && b.start===start && ACTIVE.includes(b.status)) || db.blocks.some(b=>b.court_id===courtId && b.start===start);
  }
  function checkStart(court, start) {
    const hour = new Date(start-5*HOUR).getUTCHours();
    requireThat(start>now() && start<=now()+60*24*HOUR, 'Puedes reservar horarios futuros dentro de los próximos 60 días.');
    requireThat(court.active && hour>=court.opens_at && hour<court.closes_at, 'La cancha no está disponible en ese horario.');
  }
  const courtData = court => ({...court,sport_label:SPORTS[court.sport]});
  const bookingData = (db,b) => ({...b, start:iso(b.start), end:iso(b.start+HOUR), expires_at:iso(b.expires_at), court:courtData(getCourt(db,b.court_id)), customer:db.users.find(u=>u.id===b.user_id)?.name||'Cliente', status_label:STATUS[b.status], payment:{method:b.payment.method, status:b.payment.status, method_label:{visa:'Visa',mastercard:'Mastercard',transfer:'Transferencia'}[b.payment.method], status_label:PAYMENTS[b.payment.status], has_receipt:!!b.payment.receipt}});
  function notify(db,b,kind,text,when=now()) {
    if (!db.notifications.some(n=>n.booking_id===b.id && n.kind===kind)) db.notifications.push({booking_id:b.id,kind,text,channel:'WhatsApp',scheduled_at:when,status:when>now()?'scheduled':'simulated'});
  }
  function processDue(db) {
    db.bookings.forEach(b=>{if(b.status==='pending' && b.expires_at<=now()) b.status='expired';});
    db.notifications.forEach(n=>{if(n.status==='scheduled' && n.scheduled_at<=now()) n.status=db.bookings.find(b=>b.id===n.booking_id)?.status==='confirmed'?'simulated':'cancelled';});
  }
  function confirm(db,b) {
    b.status='confirmed'; b.payment.status='paid';
    const date = new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',dateStyle:'short',timeStyle:'short'}).format(b.start);
    notify(db,b,'confirmation',`¡Tu reserva ${b.code} está confirmada! ${getCourt(db,b.court_id).name}, ${date}. Total: S/ ${b.total.toFixed(2)}.`);
    if(b.start-2*HOUR>now()) notify(db,b,'reminder',`¡Hoy toca jugar! Te esperamos en ${getCourt(db,b.court_id).name}. Reserva ${b.code}, ${date}.`,b.start-2*HOUR);
  }
  function cancel(db,b,admin) {
    requireThat(ACTIVE.includes(b.status),'Esta reserva ya no se puede cancelar.');
    requireThat(admin || b.status==='pending' || b.start>now()+2*HOUR,'Las reservas confirmadas o en revisión se cancelan con al menos 2 horas de anticipación. Contacta al administrador.');
    b.status='cancelled'; b.payment.status=b.payment.status==='paid'?'refunded':'rejected';
    db.notifications.filter(n=>n.booking_id===b.id && n.status==='scheduled').forEach(n=>n.status='cancelled');
    notify(db,b,'cancellation',`La reserva ${b.code} fue cancelada. El horario vuelve a estar disponible.`);
  }
  async function run(path,options) {
    if(path==='demo/reset/' && options.method==='POST') {
      storage.removeItem(key); session.removeItem(sessionKey); return {ok:true};
    }
    const db=load(); processDue(db);
    const url = new URL(path,'https://demo.invalid/');
    const route=url.pathname.replace(/^\//,'');
    const method=options.method||'GET', data=options.body||{};
    let user=db.users.find(u=>u.id===Number(session.getItem(sessionKey)));
    const loginRequired=()=>requireThat(user,'Ingresa a tu cuenta para continuar.');
    const adminRequired=()=>{loginRequired();requireThat(user.is_admin,'Esta sección es exclusiva para administradores.');};
    let result;
    if(route==='session/') result={user:publicUser(user),demo:true,today:todayInLima(now())};
    else if(route==='auth/logout/') {session.removeItem(sessionKey);result={user:null};}
    else if(route.startsWith('auth/')) {
      requireThat(method==='POST','Acción no disponible.');
      if(route==='auth/demo/') user=db.users.find(u=>u.id===(data.role==='admin'?2:1));
      else {
        const email=String(data.email||'').trim().toLowerCase(), password=String(data.password||'');
        if(route==='auth/register/') {
          const name=String(data.name||'').trim(), phone=String(data.phone||'').trim();
          requireThat(name.length>=2 && name.length<=100 && /^9\d{8}$/.test(phone),'Ingresa tu nombre y un celular peruano de 9 dígitos que empiece con 9.');
          requireThat(email.length<=150 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Ingresa un correo válido.');
          requireThat(password.length>=8 && !/^\d+$/.test(password) && !['password','12345678','contraseña'].includes(password.toLowerCase()),'Usa una contraseña de prueba de al menos 8 caracteres, que no sea común ni solo números.');
          requireThat(!db.users.some(u=>u.email===email),'Ya existe una cuenta con este correo.');
          const salt=crypto.randomUUID();
          user={id:db.nextUser++,name,email,phone,is_admin:false,salt,passwordHash:await passwordHash(password,salt)};
          db.users.push(user);
        } else {
          requireThat(route==='auth/login/','Acción no disponible.');
          user=db.users.find(u=>u.email===email);
          requireThat(user?.passwordHash && await passwordHash(password,user.salt)===user.passwordHash,'El correo o la contraseña no son correctos. Para las cuentas de ejemplo usa los botones de demostración.');
        }
      }
      save(db); session.setItem(sessionKey,String(user.id)); result={user:publicUser(user)};
    }
    else if(route==='courts/') result={courts:db.courts.filter(c=>c.active).map(courtData)};
    else if(route==='availability/') {
      const court=getCourt(db,url.searchParams.get('court')), date=url.searchParams.get('date');
      const slots=[];
      for(let hour=court.opens_at;hour<court.closes_at;hour++) {
        const at=startTime(date,hour);
        const state=!court.active || at<=now() || at>now()+60*24*HOUR?'past':db.blocks.some(b=>b.court_id===court.id && b.start===at)?'blocked':occupied(db,court.id,at)?'booked':'available';
        slots.push({hour,state});
      }
      result={slots};
    }
    else if(route==='profile/') {
      loginRequired();
      const name=String(data.name||'').trim(),phone=String(data.phone||'').trim();
      requireThat(name.length>=2 && name.length<=100 && /^9\d{8}$/.test(phone),'Revisa tu nombre y celular peruano de 9 dígitos.');
      Object.assign(user,{name,phone}); result={user:publicUser(user)};
    }
    else if(route==='bookings/') {
      loginRequired();
      if(method==='POST') {
        const court=getCourt(db,data.court_id),start=startTime(data.date,data.hour); checkStart(court,start);
        requireThat(['visa','mastercard','transfer'].includes(data.method),'Selecciona un medio de pago válido.');
        requireThat(!occupied(db,court.id,start),'Este horario ya tiene una reserva o un bloqueo. Selecciona otro.');
        const id=db.nextBooking++;
        const b={id,code:`CN-${String(id).padStart(5,'0')}`,user_id:user.id,court_id:court.id,start,total:Number(court.price),status:'pending',expires_at:Math.min(start,now()+15*60000),payment:{method:data.method,status:'pending'}};
        db.bookings.push(b);result={booking:bookingData(db,b)};
      } else result={bookings:db.bookings.filter(b=>b.user_id===user.id).sort((a,b)=>b.start-a.start).map(b=>bookingData(db,b))};
    }
    else if(/^bookings\/\d+\/[a-z]+\/$/.test(route)) {
      loginRequired(); requireThat(method==='POST','Acción no disponible.');
      const [,id,action]=route.split('/'),b=db.bookings.find(b=>b.id===Number(id));
      requireThat(b && (b.user_id===user.id || user.is_admin),'No tienes acceso a esta reserva.');
      if(action==='cancel') cancel(db,b,user.is_admin);
      else if(action==='approve' || action==='reject') {
        adminRequired(); requireThat(b.status==='review' && b.payment.receipt,'La reserva no tiene un comprobante pendiente de revisión.');
        if(action==='approve'){requireThat(b.start>now(),'El horario de esta reserva ya pasó. Cancélala para liberar el registro.');confirm(db,b);}else cancel(db,b,true);
      } else {
        requireThat(b.user_id===user.id,'Solo el cliente de esta reserva puede completar el pago.');
        requireThat(b.status==='pending','La reserva ya no está pendiente de pago.');
        if(action==='pay') {
          requireThat(b.payment.method!=='transfer','Adjunta un comprobante para pagar por transferencia.');
          requireThat(['approved','rejected'].includes(data.result),'Resultado de pago inválido.');
          if(data.result==='approved')confirm(db,b);else b.payment.status='rejected';
        } else if(action==='upload') {
          requireThat(b.payment.method==='transfer','Esta reserva no se paga por transferencia.');
          b.payment.receipt=await receiptEncoder(data.get('receipt'));
          requireThat(b.expires_at>now(),'La reserva venció mientras se procesaba la imagen.');
          b.status='review';b.payment.status='review';
        } else throw new Error('Acción no disponible.');
      }
      result={booking:bookingData(db,b)};
    }
    else if(/^receipts\/\d+\/$/.test(route)) {
      loginRequired();const b=db.bookings.find(b=>b.id===Number(route.split('/')[1]));
      requireThat(b && (user.is_admin || b.user_id===user.id) && b.payment.receipt,'No tienes acceso a este comprobante.');
      result={receipt:b.payment.receipt};
    }
    else if(route==='notifications/') {
      loginRequired();result={notifications:db.notifications.filter(n=>user.is_admin || db.bookings.find(b=>b.id===n.booking_id)?.user_id===user.id).sort((a,b)=>b.scheduled_at-a.scheduled_at).map(n=>{const b=db.bookings.find(b=>b.id===n.booking_id);return {...n,scheduled_at:iso(n.scheduled_at),code:b.code,customer:db.users.find(u=>u.id===b.user_id)?.name};})};
    }
    else if(route==='admin/overview/') {
      adminRequired();result={bookings:[...db.bookings].sort((a,b)=>b.start-a.start).map(b=>bookingData(db,b)),courts:db.courts.map(courtData),users:db.users.filter(u=>!u.is_admin).map(publicUser),stats:{today:db.bookings.filter(b=>b.status==='confirmed' && todayInLima(b.start)===todayInLima(now())).length,review:db.bookings.filter(b=>b.status==='review').length,income:db.bookings.filter(b=>b.payment.status==='paid').reduce((sum,b)=>sum+b.total,0)},blocks:db.blocks.filter(b=>b.start>now()).map(b=>({...b,start:iso(b.start),court:getCourt(db,b.court_id).name}))};
    }
    else if(route==='admin/courts/') {
      adminRequired();
      const c={name:String(data.name||'').trim(),sport:data.sport,description:String(data.description||'').trim(),district:String(data.district||'').trim(),price:Number(data.price),capacity:Number(data.capacity),opens_at:Number(data.opens_at),closes_at:Number(data.closes_at),active:data.active===true};
      requireThat(c.name.length>0 && c.name.length<=80 && c.description.length>0 && c.description.length<=180 && c.district.length>0 && c.district.length<=70 && SPORTS[c.sport] && Number.isFinite(c.price) && c.price>0 && c.price<=999999 && Number.isInteger(c.capacity) && c.capacity>=2 && c.capacity<=30 && Number.isInteger(c.opens_at) && Number.isInteger(c.closes_at) && c.opens_at>=0 && c.opens_at<c.closes_at && c.closes_at<=24,'Revisa los datos: precio positivo, capacidad entre 2 y 30, apertura anterior al cierre (0–24).');
      c.price=Math.round(c.price*100)/100;
      if(data.id){const existing=getCourt(db,data.id);Object.assign(existing,c);result={court:courtData(existing)};}
      else {c.id=db.nextCourt++;db.courts.push(c);result={court:courtData(c)};}
    }
    else if(route==='admin/blocks/') {
      adminRequired();
      if(method==='DELETE') {
        requireThat(db.blocks.some(b=>b.id===Number(data.id)),'Este bloqueo ya no existe.');db.blocks=db.blocks.filter(b=>b.id!==Number(data.id));
      } else {
        const court=getCourt(db,data.court_id),start=startTime(data.date,data.hour),reason=String(data.reason||'').trim();
        checkStart(court,start);requireThat(reason.length>=3 && reason.length<=120,'Escribe un motivo de entre 3 y 120 caracteres.');
        requireThat(!occupied(db,court.id,start),'Este horario ya tiene una reserva o un bloqueo.');
        db.blocks.push({id:db.nextBlock++,court_id:court.id,start,reason});
      }
      result={ok:true};
    }
    else throw new Error('Esta función no está disponible en la demostración.');
    save(db); return result;
  }
  return (path,options={}) => {
    // Serializar operaciones y pestañas evita sobrescribir reservas del mismo navegador.
    const execute=()=>locks?locks.request(key,()=>run(path,options)):run(path,options);
    const result=queue.then(execute); queue=result.catch(()=>{}); return result;
  };
}
