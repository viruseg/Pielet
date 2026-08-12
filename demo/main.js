import Pielet from '../src/index.js';
import '../src/styles/pielet.css';

const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');
const controls = {
  size: document.getElementById('size'),
  centerSize: document.getElementById('centerSize'),
  gap: document.getElementById('gap'),
  startAngle: document.getElementById('startAngle'),
  direction: document.getElementById('direction'),
  mode: document.getElementById('mode'),
  closeDistance: document.getElementById('closeDistance'),
  items: document.getElementById('items')
};

const labels = ['Open', 'Save', 'Copy', 'Cut', 'Rename', 'Delete', 'Share', 'Print', 'Zoom', 'Flip', 'Rotate', 'Pin'];

function buildMenu() {
  const itemCount = Number(controls.items.value);
  const items = Array.from({ length: itemCount }, (_, i) => ({
    typeContent: i % 6 === 3 ? 'none' : 'text',
    content: labels[i % labels.length],
    action: () => {
      window.__lastAction = { index: i, content: labels[i % labels.length], at: Date.now() };
      statusEl.textContent = `action: ${labels[i % labels.length]} (${i}) — ${new Date().toLocaleTimeString()}`;
    }
  }));
  return new Pielet({
    size: Number(controls.size.value),
    centerSize: Number(controls.centerSize.value),
    gap: Number(controls.gap.value),
    startAngle: Number(controls.startAngle.value),
    direction: controls.direction.value,
    interactionMode: controls.mode.value,
    closeDistance: Number(controls.closeDistance.value),
    items
  });
}

let menu = buildMenu();
window.__menu = menu;
window.__menuEl = null;
window.Pielet = Pielet;

function readState() {
  const state = {
    size: Number(controls.size.value),
    centerSize: Number(controls.centerSize.value),
    gap: Number(controls.gap.value),
    startAngle: Number(controls.startAngle.value),
    direction: controls.direction.value,
    mode: controls.mode.value,
    closeDistance: Number(controls.closeDistance.value),
    items: Number(controls.items.value)
  };
  window.__demoState = state;
  return state;
}

const points = {
  center: () => [innerWidth / 2, innerHeight / 2],
  top: () => [innerWidth / 2, 80],
  bottom: () => [innerWidth / 2, innerHeight - 80],
  left: () => [80, innerHeight / 2],
  right: () => [innerWidth - 80, innerHeight / 2],
  'top-left': () => [80, 80],
  'top-right': () => [innerWidth - 80, 80],
  'bottom-left': () => [80, innerHeight - 80],
  'bottom-right': () => [innerWidth - 80, innerHeight - 80],
  random: () => [Math.floor(80 + Math.random() * (innerWidth - 160)), Math.floor(80 + Math.random() * (innerHeight - 160))]
};

document.querySelectorAll('#buttons button').forEach((button) => {
  button.addEventListener('click', () => {
    menu.close();
    readState();
    menu = buildMenu();
    window.__menu = menu;
    const [x, y] = points[button.dataset.point]();
    menu.open(x, y);
    window.__menuEl = document.querySelector('.pielet');
    statusEl.textContent = `open(${x}, ${y}) — ${menu.config.items.length} items`;
  });
});

menu.addEventListener('open', () => {
  window.__menuEl = document.querySelector('.pielet');
});
menu.addEventListener('select', () => {
  window.__menuEl = document.querySelector('.pielet');
});

window.addEventListener('resize', () => {
  window.__demoState = readState();
});