import Pielet from '../src/index.js';

const statusEl = document.getElementById('status');
const controls = {
  size: document.getElementById('size'),
  centerSize: document.getElementById('centerSize'),
  gap: document.getElementById('gap'),
  startAngle: document.getElementById('startAngle'),
  direction: document.getElementById('direction'),
  mode: document.getElementById('mode'),
  button: document.getElementById('button'),
  closeDistance: document.getElementById('closeDistance'),
  items: document.getElementById('items')
};

const labels = ['Open', 'Save', 'Copy', 'Cut', 'Rename', 'Delete', 'Share', 'Print', 'Zoom', 'Flip', 'Rotate', 'Pin'];

function assembleItems(count) {
  return Array.from({ length: count }, (_, i) => {
    const label = labels[i % labels.length];
    return {
      // первый пункт — явный id, остальные — автогенерация (префикс pielet-)
      id: i === 0 ? 'demo-open' : undefined,
      typeContent: i % 6 === 3 ? 'none' : 'text',
      content: label,
      action: (id) => {
        window.__lastAction = { index: i, content: label, id, at: Date.now() };
        statusEl.textContent = `action: ${label} (${i}) id: ${id} — ${new Date().toLocaleTimeString()}`;
      }
    };
  });
}

const menu = new Pielet(readState());
window.__menu = menu;
window.Pielet = Pielet;

let isOpen = false;

function syncValueLabels() {
  document.querySelectorAll('#controls output.value').forEach((out) => {
    const input = document.getElementById(out.dataset.for);
    if (input) out.textContent = input.value;
  });
}
Object.values(controls).forEach((el) => el.addEventListener('input', syncValueLabels));
syncValueLabels();

function readState() {
  return {
    size: Number(controls.size.value),
    centerSize: Number(controls.centerSize.value),
    gap: Number(controls.gap.value),
    startAngle: Number(controls.startAngle.value),
    direction: controls.direction.value,
    interactionMode: controls.mode.value,
    button: controls.button.value,
    closeDistance: Number(controls.closeDistance.value),
    items: assembleItems(Number(controls.items.value))
  };
}

function openAt(x, y, button = controls.button.value) {
  const state = readState();
  Object.assign(menu.config, {
    size: state.size,
    centerSize: state.centerSize,
    gap: state.gap,
    startAngle: state.startAngle,
    direction: state.direction,
    interactionMode: state.interactionMode,
    button,
    closeDistance: state.closeDistance,
    items: state.items
  });
  menu.open(x, y);
}

document.addEventListener('pointerdown', (e) => {
  if (e.target.closest('#controls')) return;
  // Тач передаёт только основную кнопку (PointerEvent.button === 0), поэтому
  // селект button осмыслен лишь для мыши/пера — на таче всегда трактуем left.
  const button = e.pointerType === 'touch' ? 'left' : controls.button.value;
  if (e.button !== Pielet.BUTTONS[button]) return;
  if (isOpen) return;
  e.preventDefault();
  openAt(e.clientX, e.clientY, button);
});

document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

menu.addEventListener('open', (e) => {
  isOpen = true;
  const { rect } = e.detail;
  statusEl.textContent = `event: open — ${menu.config.items.length} items — ${new Date().toLocaleTimeString()}`;
  console.log('Pielet open rect:', rect);
});
menu.addEventListener('select', (e) => {
  statusEl.textContent = `event: select — id: ${e.detail.id} — ${new Date().toLocaleTimeString()}`;
});
menu.addEventListener('close', () => {
  isOpen = false;
  statusEl.textContent = `event: close — menu removed from DOM — ${new Date().toLocaleTimeString()}`;
});