import { state } from './state.js';
import { $, rememberFocus } from './utils/dom.js';
import { todayInLima } from './utils/format.js';
import { empty, failure, loading } from './ui/components.js';

const DEFAULT_ROUTE = 'reservar';
let registry;
let previousRoute;

export function configureRouter(views) {
  registry = views;
}

export function navigate(route) {
  if (location.hash === `#${route}`) return render();
  location.hash = route;
}

export async function render({ background = false } = {}) {
  const today = todayInLima();
  state.today = today;
  if (state.date < today) {
    state.date = today;
    state.hour = null;
  }

  const requested = location.hash.slice(1) || DEFAULT_ROUTE;
  const valid = Object.hasOwn(registry.routes, requested)
    && !(requested === 'admin' && state.user && !state.user.is_admin);
  const route = valid ? requested : DEFAULT_ROUTE;
  if (!valid) history.replaceState(history.state, '', `#${route}`);

  const token = ++state.routeToken;
  const main = $('#main');
  const firstRender = previousRoute === undefined;
  const changedRoute = !firstRender && route !== previousRoute;
  const hadFocus = main.contains(document.activeElement);
  const restoreFocus = hadFocus && rememberFocus(document.activeElement);
  previousRoute = route;
  registry.header(route);

  main.setAttribute('aria-busy', 'true');
  try {
    if (route !== DEFAULT_ROUTE && !state.user) {
      main.innerHTML = empty('Tu próximo partido te espera', 'Ingresa a tu cuenta para ver esta sección.')
        + '<div class="center"><button class="button primary" id="route-login">Ingresar a mi cuenta</button></div>';
      $('#route-login', main).onclick = event => registry.auth(false, event.currentTarget);
      return;
    }

    // Only a new section starts from a placeholder. Re-rendering the same section keeps the
    // current content on screen until the fresh data replaces it, so the page never flashes.
    if (!background && (firstRender || changedRoute)) main.innerHTML = loading('Cargando esta sección…');
    await registry.routes[route](token);
  } catch (error) {
    if (token === state.routeToken) {
      main.innerHTML = failure('No pudimos cargar esta sección', error.message);
      $('[data-retry]', main).onclick = () => render();
    }
  } finally {
    if (token === state.routeToken) {
      main.setAttribute('aria-busy', 'false');
      const focusAvailable = document.activeElement === document.body || main.contains(document.activeElement);
      if (!$('#modal').open && !background && (changedRoute || (hadFocus && focusAvailable))) {
        if (changedRoute || !restoreFocus?.()) {
          ($('[data-retry]', main) ?? main).focus();
        }
      }
    }
  }
}
