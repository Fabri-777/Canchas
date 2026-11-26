import { api } from '../api/client.js';
import { navigate } from '../router.js';
import { state } from '../state.js';
import { busy } from '../ui/busy.js';
import { $, $$, escape } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { openAuth, openProfile } from './auth.js';

let accountMarkup;

export function renderHeader(route) {
  const navigation = $('#navigation');
  const admin = !!state.user?.is_admin;
  if (navigation.dataset.admin !== String(admin)) {
    const links = [['reservar', 'Reservar cancha'], ['reservas', 'Mis reservas'], ['mensajes', 'Notificaciones']];
    if (admin) links.push(['admin', 'Administración']);
    navigation.innerHTML = links.map(([href, label]) => `<a href="#${href}">${label}</a>`).join('');
    navigation.dataset.admin = String(admin);
  }
  for (const link of $$('a', navigation)) {
    if (link.hash !== `#${route}`) {
      link.removeAttribute('aria-current');
    } else if (!link.hasAttribute('aria-current')) {
      link.setAttribute('aria-current', 'page');
      const navBounds = navigation.getBoundingClientRect();
      const linkBounds = link.getBoundingClientRect();
      if (linkBounds.right > navBounds.right) navigation.scrollLeft += linkBounds.right - navBounds.right;
      else if (linkBounds.left < navBounds.left) navigation.scrollLeft -= navBounds.left - linkBounds.left;
    }
  }

  const name = state.user?.name ?? '';
  const firstName = escape(name.split(' ')[0]);
  const markup = state.user
    ? `<button class="profile-button" id="profile-button" aria-label="Perfil de ${firstName}">
         <span class="avatar" aria-hidden="true">${escape(name.slice(0, 1))}</span>
         <span>${firstName}</span>
       </button><button class="text-button" id="logout">Salir</button>`
    : `<button class="button secondary compact" id="login-button">Ingresar ${icon('arrow')}</button>`;
  if (markup === accountMarkup) return;
  accountMarkup = markup;
  $('#account').innerHTML = markup;

  if (state.user) {
    $('#profile-button').onclick = event => openProfile(event.currentTarget);
    $('#logout').onclick = event => busy(event.currentTarget, async () => {
      await api('auth/logout/', { method: 'POST', body: {} });
      state.user = null;
      navigate('reservar');
    });
  } else {
    $('#login-button').onclick = event => openAuth(false, event.currentTarget);
  }
}
