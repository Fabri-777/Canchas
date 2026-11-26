import { $ } from '../utils/dom.js';

let timer;

export function toast(message) {
  const region = $('#toast');
  region.textContent = message;
  clearTimeout(timer);
  timer = setTimeout(() => { region.textContent = ''; }, 5500);
}
