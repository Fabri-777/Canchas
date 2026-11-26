import { api } from '../api/client.js';
import { navigate, render } from '../router.js';
import { state } from '../state.js';
import { busy } from '../ui/busy.js';
import { closeModal, openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { $, $$, escape } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

export function openAuth(register = false, trigger) {
  openModal(register ? 'Crea tu cuenta' : 'Qué bueno verte por aquí', `
    <p class="muted">${register ? 'Guarda tus reservas y encuentra tiempo para jugar.' : 'Ingresa para reservar y gestionar tus partidos.'}</p>
    <form id="auth-form" class="stack">
      ${register ? `
        <label>Nombre completo<input name="name" autocomplete="name" required minlength="2" maxlength="100"></label>
        <label>Celular<input name="phone" type="tel" autocomplete="tel-national" inputmode="numeric"
          pattern="9[0-9]{8}" maxlength="9" placeholder="987654321" required></label>` : ''}
      <label>Correo electrónico<input name="email" type="email" autocomplete="email" required maxlength="150" placeholder="tu@correo.com"></label>
      <label>Contraseña<input name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}"
        required ${register ? 'minlength="8"' : ''}></label>
      ${register ? '<p class="field-help">Usa al menos 8 caracteres. Evita contraseñas comunes o solo números.</p>' : ''}
      <button class="button primary" type="submit">${register ? 'Crear cuenta' : 'Ingresar'} ${icon('arrow')}</button>
      <p role="alert" class="form-error"></p>
    </form>
    <button class="text-button accent" id="switch-auth">${register ? 'Ya tengo una cuenta' : '¿Primera vez? Crear una cuenta'}</button>
    ${state.demo ? `
      <div class="demo-access">
        <span class="eyebrow">EXPLORA LA DEMOSTRACIÓN</span>
        <div class="button-row">
          <button class="button secondary" data-demo="client">Soy cliente</button>
          <button class="button secondary" data-demo="admin">Soy administrador</button>
        </div>
      </div>` : ''}`, trigger);

  const form = $('#auth-form');
  const submit = $('button[type=submit]', form);
  const switchAuth = $('#switch-auth');
  const demos = $$('[data-demo]');
  switchAuth.onclick = () => openAuth(!register);
  form.onsubmit = event => {
    event.preventDefault();
    return busy(submit, async () => {
      const result = await api(`auth/${register ? 'register' : 'login'}/`, {
        method: 'POST', body: Object.fromEntries(new FormData(form)),
      });
      state.user = result.user;
      closeModal();
      toast(`¡Hola, ${result.user.name.split(' ')[0]}!`);
      await render();
    }, { form, peers: [switchAuth, ...demos] });
  };

  for (const button of demos) {
    button.onclick = () => busy(button, async () => {
      const result = await api('auth/demo/', { method: 'POST', body: { role: button.dataset.demo } });
      state.user = result.user;
      closeModal();
      if (result.user.is_admin) navigate('admin');
      else await render();
    }, { form, peers: [submit, switchAuth, ...demos.filter(peer => peer !== button)] });
  }
}

export function openProfile(trigger) {
  const { name, email, phone } = state.user;
  openModal('Mi perfil', `
    <form class="stack" id="profile-form">
      <label>Nombre completo<input name="name" value="${escape(name)}" required minlength="2" maxlength="100"></label>
      <label>Celular peruano<input name="phone" value="${escape(phone)}" type="tel" pattern="9[0-9]{8}" maxlength="9" required></label>
      <label>Correo electrónico<input value="${escape(email)}" disabled></label>
      <button class="button primary" type="submit">Guardar cambios</button>
      <p role="alert" class="form-error"></p>
    </form>`, trigger);

  const form = $('#profile-form');
  form.onsubmit = event => {
    event.preventDefault();
    return busy($('button[type=submit]', form), async () => {
      const result = await api('profile/', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      state.user = result.user;
      closeModal();
      toast('Tu perfil está actualizado.');
      await render();
    }, { form });
  };
}
