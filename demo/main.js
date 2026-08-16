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
  items: document.getElementById('items'),
  fit: document.getElementById('fit'),
  unifyText: document.getElementById('unifyText'),
  submenuDelay: document.getElementById('submenuDelay')
};

const labels = ['Open', 'Save', 'Copy', 'Cut', 'Rename', 'Delete', 'Share', 'Print', 'Zoom', 'Flip', 'Rotate', 'Pin'];
const emojis = ['📂', '💾', '📋', '✂️', '✏️', '🗑️', '📤', '🖨️', '🔍', '🔀', '🔄', '📌'];

// Сабменю: «Цвет» → палитра → «Основные» / «Пастельные» (двойная вложенность).
function pickColor(hex) {
  document.documentElement.style.setProperty('--pielet-background', hex);
}

function submenuAction(label, id, menu, coords) {
  window.__lastAction = { id, at: Date.now(), coords };
  const sameMenu = menu === window.__menu ? 'этот же экземпляр' : 'другой экземпляр';
  statusEl.textContent = `action: ${label} — id: ${id} — ${sameMenu} — точка: ${coords.x}, ${coords.y} — ${new Date().toLocaleTimeString()}`;
}

const basic = new Pielet({
  items: [
    { typeContent: 'text', content: 'Красный', id: 'palette-red', action: (id, menu, coords) => { pickColor('#e5484d'); submenuAction('Красный', id, menu, coords); } },
    { typeContent: 'text', content: 'Зелёный', id: 'palette-green', action: (id, menu, coords) => { pickColor('#2f9e63'); submenuAction('Зелёный', id, menu, coords); } },
    { typeContent: 'text', content: 'Синий', id: 'palette-blue', action: (id, menu, coords) => { pickColor('#3b82f6'); submenuAction('Синий', id, menu, coords); } }
  ]
});

const pastel = new Pielet({
  items: [
    { typeContent: 'text', content: 'Розовый', id: 'pastel-pink', action: (id, menu, coords) => { pickColor('#f472b6'); submenuAction('Розовый', id, menu, coords); } },
    { typeContent: 'text', content: 'Мятный', id: 'pastel-mint', action: (id, menu, coords) => { pickColor('#4ade80'); submenuAction('Мятный', id, menu, coords); } },
    { typeContent: 'text', content: 'Лаванда', id: 'pastel-lavender', action: (id, menu, coords) => { pickColor('#a78bfa'); submenuAction('Лаванда', id, menu, coords); } }
  ]
});

const palette = new Pielet({
  items: [
    { typeContent: 'text', content: 'Основные', id: 'palette-basic', isSubMenu: true, menu: basic },
    { typeContent: 'text', content: 'Пастельные', id: 'palette-pastel', isSubMenu: true, menu: pastel }
  ]
});

function assembleItems(count, fit) {
  const items = Array.from({ length: count }, (_, i) => {
    const label = labels[i % labels.length];
    // В circle-режиме контент не поворачивается, поэтому вместо надписей
    // удобнее смотреть на эмодзи; в square-режиме читаемые тексты наглядно
    // показывают поворот секторов.
    const content = fit === 'circle' ? emojis[i % emojis.length] : label;
    return {
      // первый пункт — явный id, остальные — автогенерация (префикс pielet-)
      id: i === 0 ? 'demo-open' : undefined,
      typeContent: 'text',
      content,
      action: (id, menu, coords) => {
        window.__lastAction = { index: i, content: label, id, at: Date.now(), coords };
        const sameMenu = menu === window.__menu ? 'этот же экземпляр' : 'другой экземпляр';
        statusEl.textContent = `action: ${label} (${i}) id: ${id} — ${sameMenu} — точка: ${coords.x}, ${coords.y} — ${new Date().toLocaleTimeString()}`;
      }
    };
  });
  // Пункт-сабменю: двойная вложенность «Цвет» → палитра → «Основные»/«Пастельные».
  items.push({
    typeContent: 'text',
    content: fit === 'circle' ? '🎨' : 'Цвет',
    id: 'demo-color',
    isSubMenu: true,
    menu: palette
  });
  return items;
}

const menu = new Pielet(readState());
window.__menu = menu;
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
  return {
    size: Number(controls.size.value),
    centerSize: Number(controls.centerSize.value),
    gap: Number(controls.gap.value),
    startAngle: Number(controls.startAngle.value),
    direction: controls.direction.value,
    interactionMode: controls.mode.value,
    button: controls.button.value,
    closeDistance: Number(controls.closeDistance.value),
    items: assembleItems(Number(controls.items.value), controls.fit.value),
    fit: controls.fit.value,
    unifyText: controls.unifyText.value === 'true',
    submenuDelay: Number(controls.submenuDelay.value)
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
    items: state.items,
    fit: state.fit,
    unifyText: state.unifyText,
    submenuDelay: state.submenuDelay
  });
  // Сабменю должны следовать за настройками демо (режим/кнопка/задержка),
  // чтобы hold-режим подхватывал зажатую кнопку и во вложенных меню.
  for (const sub of [palette, basic, pastel]) {
    sub.config.interactionMode = state.interactionMode;
    sub.config.button = button;
    sub.config.submenuDelay = state.submenuDelay;
  }
  menu.open(x, y);
}

document.addEventListener('pointerdown', (e) => {
  if (e.target.closest('#controls')) return;
  // Тач передаёт только основную кнопку (PointerEvent.button === 0), поэтому
  // селект button осмыслен лишь для мыши/пера — на таче всегда трактуем left.
  const button = e.pointerType === 'touch' ? 'left' : controls.button.value;
  if (e.button !== Pielet.BUTTONS[button]) return;
  // Любое открытое меню (включая сабменю) блокирует повторное открытие.
  if (document.querySelector('.pielet')) return;
  e.preventDefault();
  openAt(e.clientX, e.clientY, button);
});

document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

menu.addEventListener('open', (e) => {
  const { rect, menu: eventMenu } = e.detail;
  statusEl.textContent = `event: open — ${eventMenu.config.items.length} items — ${new Date().toLocaleTimeString()}`;
  console.log('Pielet open rect:', rect);
});
menu.addEventListener('select', (e) => {
  statusEl.textContent = `event: select — id: ${e.detail.id} — точка: ${e.detail.coords.x}, ${e.detail.coords.y} — ${new Date().toLocaleTimeString()}`;
});
menu.addEventListener('close', () => {
  statusEl.textContent = `event: close — menu removed from DOM — ${new Date().toLocaleTimeString()}`;
});