import { $ } from '../utils/dom.js';
import { toast } from './toast.js';

export function errorIn(form, error) {
  $('[role="alert"]', form).textContent = error?.message ?? '';
}

export async function busy(button, task, { form, peers = [] } = {}) {
  if (button.disabled) return;
  const controls = [button, ...peers.filter(peer => !peer.disabled)];
  controls.forEach(control => { control.disabled = true; });
  button.setAttribute('aria-busy', 'true');
  if (form) errorIn(form);

  try {
    return await task();
  } catch (error) {
    if (form) errorIn(form, error);
    else toast(error.message);
  } finally {
    controls.forEach(control => { control.disabled = false; });
    button.removeAttribute('aria-busy');
  }
}
