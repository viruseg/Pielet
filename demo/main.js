import Pielet from '../src/index.js';
import '../src/styles/pielet.css';

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

function assembleItems(count) {
  return Array.from({ length: count }, (_, i) => ({
    typeContent: i % 6 === 3 ? 'none' : 'text',
    content: labels[i % labels.length],
    action: () => {
      window.__lastAction = { index: i, content: labels[i % labels.length], at: Date.now() };
      statusEl.textContent = `action: ${labels[i % labels.length]} (${i}) — ${new Date().toLocaleTimeString()}`;
    }
  }));
}

const menu = new Pielet({
  size: Number(controls.size.value),
  centerSize: Number(controls.centerSize.value),
  gap: Number(controls.gap.value),
  startAngle: Number(controls.startAngle.value),
  direction: controls.direction.value,
  interactionMode: controls.mode.value,
  closeDistance: Number(controls.closeDistance.value),
  items: assembleItems(Number(controls.items.value))
});
window.__menu = menu;
window.__menuEl = null;
window.Pielet = Pielet;

function syncValueLabels() {
  document.querySelectorAll('#controls output.value').forEach((out) => {
    const input = document.getElementById(out.dataset.for);
    if (input) out.textContent = input.value;
  });
}
Object.values(controls).forEach((el) => el.addEventListener('input', syncValueLabels));
syncValueLabels();

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

function openAt(x, y) {
  const state = readState();
  Object.assign(menu.config, {
    size: state.size,
    centerSize: state.centerSize,
    gap: state.gap,
    startAngle: state.startAngle,
    direction: state.direction,
    interactionMode: state.mode,
    closeDistance: state.closeDistance,
    items: assembleItems(state.items)
  });
  menu.open(x, y);
  window.__menuEl = document.querySelector('.pielet');
  statusEl.textContent = `open(${Math.round(x)}, ${Math.round(y)}) — ${menu.config.items.length} items`;
}

document.addEventListener('pointerdown', (e) => {
  if (e.target.closest('#controls')) return;
  if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
  // меню открыто — оно само обрабатывает pointerdown/up (выбор пункта)
  if (document.querySelector('.pielet')) return;
  e.preventDefault();
  openAt(e.clientX, e.clientY);
});

document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
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

window.__openAt = openAt;