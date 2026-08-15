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
  return Array.from({ length: count }, (_, i) => ({
    // первый пункт — явный id, остальные — автогенерация (префикс pielet-)
    id: i === 0 ? 'demo-open' : undefined,
    typeContent: i % 6 === 3 ? 'none' : 'text',
    content: labels[i % labels.length],
    action: (id) => {
      window.__lastAction = { index: i, content: labels[i % labels.length], id, at: Date.now() };
      statusEl.textContent = `action: ${labels[i % labels.length]} (${i}) id: ${id} — ${new Date().toLocaleTimeString()}`;
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
  button: controls.button.value,
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
    button: controls.button.value,
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
    button: state.button,
    closeDistance: state.closeDistance,
    items: assembleItems(state.items)
  });
  menu.open(x, y);
}

document.addEventListener('pointerdown', (e) => {
  if (e.target.closest('#controls')) return;
  if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
  // меню открывается только отслеживаемой кнопкой конфига; селект читаем напрямую —
  // menu.config.button обновляется лишь при openAt(), и после смены кнопки был бы устаревшим
  if (e.button !== Pielet.BUTTONS[controls.button.value]) return;
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
  statusEl.textContent = `event: open — ${menu.config.items.length} items — ${new Date().toLocaleTimeString()}`;
});
menu.addEventListener('select', (e) => {
  window.__menuEl = document.querySelector('.pielet');
  statusEl.textContent = `event: select — id: ${e.detail.id} — ${new Date().toLocaleTimeString()}`;
});
menu.addEventListener('close', () => {
  window.__menuEl = null;
  statusEl.textContent = `event: close — menu removed from DOM — ${new Date().toLocaleTimeString()}`;
});

window.addEventListener('resize', () => {
  window.__demoState = readState();
});

window.__openAt = openAt;