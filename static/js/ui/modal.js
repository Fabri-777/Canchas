import { $, escape, rememberFocus } from '../utils/dom.js';

let restoreFocus;

export function openModal(title, content, trigger = document.activeElement) {
  const dialog = $('#modal');
  const panel = $('#modal-content');
  if (!dialog.open) restoreFocus = rememberFocus(trigger);
  panel.innerHTML = `
    <div class="modal-heading">
      <h2 id="modal-title" tabindex="-1">${escape(title)}</h2>
      <button type="button" class="icon-button" data-close aria-label="Cerrar ventana">×</button>
    </div>
    ${content}`;

  $('[data-close]', panel).onclick = closeModal;
  dialog.onclose = () => {
    if (dialog.open) return;
    if (!restoreFocus?.()) $('#main').focus();
    restoreFocus = undefined;
  };
  if (!dialog.open) dialog.showModal();

  const firstField = $('input:checked, input:not([type=hidden], [type=radio]):enabled, select:enabled, textarea:enabled', panel);
  (firstField ?? $('#modal-title', panel)).focus();
}

export function closeModal() {
  $('#modal').close();
}
