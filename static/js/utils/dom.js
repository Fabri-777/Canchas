export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escape = value => String(value ?? '').replace(/[&<>"']/g, character => entities[character]);

// Route updates can replace a trigger or the focused button with equivalent markup.
export function rememberFocus(node) {
  const attributes = node?.getAttributeNames().filter(name => name.startsWith('data-')) ?? [];
  const selector = node?.id
    ? `#${CSS.escape(node.id)}`
    : attributes.map(name => `[${name}="${CSS.escape(node.getAttribute(name))}"]`).join('');

  return () => {
    const target = node?.isConnected ? node : selector && $(selector);
    if (!target || target === document.body || target.disabled) return false;
    target.focus();
    return document.activeElement === target;
  };
}
