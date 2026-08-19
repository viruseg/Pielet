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
  submenuDelay: document.getElementById('submenuDelay'),
  submenuIndicator: document.getElementById('submenuIndicator'),
  availableArc: document.getElementById('availableArc')
};

const labels = ['Open', 'Save', 'Copy', 'Cut', 'Rename', 'Delete', 'Share', 'Print', 'Zoom', 'Flip', 'Rotate', 'Pin'];
const emojis = ['📂', '💾', '📋', '✂️', '✏️', '🗑️', '📤', '🖨️', '🔍', '🔀', '🔄', '📌'];

// Сабменю: «Цвет» → палитра → «Основные»/«Пастельные» (двойная вложенность).
// Контент сабменю следует за контролом fit, как в главном меню: circle →
// визуальный (SVG-квадраты цветов / эмодзи), square → текст.
function pickColor(hex) {
  document.documentElement.style.setProperty('--pielet-background', hex);
}

function submenuAction(label, id, menu, coords) {
  window.__lastAction = { id, at: Date.now(), coords };
  const sameMenu = menu === window.__menu ? 'the same instance' : 'another instance';
  statusEl.textContent = `action: ${label} — id: ${id} — ${sameMenu} — point: ${coords.x}, ${coords.y} — ${new Date().toLocaleTimeString()}`;
}

// SVG-квадрат с чёрной обводкой, залитый цветом пункта — image-контент
// (typeContent: 'image') цветовых сабменю в circle-режиме.
function colorSquareDataUri(hex) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="6" y="6" width="88" height="88" fill="${hex}" stroke="#000" stroke-width="8"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const BASIC_COLORS = [
  { name: 'Red', hex: '#e5484d', id: 'palette-red' },
  { name: 'Green', hex: '#2f9e63', id: 'palette-green' },
  { name: 'Blue', hex: '#3b82f6', id: 'palette-blue' }
];

const PASTEL_COLORS = [
  { name: 'Pink', hex: '#f472b6', id: 'pastel-pink' },
  { name: 'Mint', hex: '#4ade80', id: 'pastel-mint' },
  { name: 'Lavender', hex: '#a78bfa', id: 'pastel-lavender' }
];

function buildColorItems(colors, fit) {
  return colors.map(({ name, hex, id }) => ({
    typeContent: fit === 'circle' ? 'image' : 'text',
    content: fit === 'circle' ? colorSquareDataUri(hex) : name,
    id,
    action: (id, menu, coords) => { pickColor(hex); submenuAction(name, id, menu, coords); }
  }));
}

function buildPaletteItems(fit) {
  return [
    { typeContent: 'text', content: fit === 'circle' ? '🌈' : 'Basic', id: 'palette-basic', isSubMenu: true, menu: basic },
    { typeContent: 'text', content: fit === 'circle' ? '🌸' : 'Pastel', id: 'palette-pastel', isSubMenu: true, menu: pastel }
  ];
}

const basic = new Pielet({ items: buildColorItems(BASIC_COLORS, 'circle') });
const pastel = new Pielet({ items: buildColorItems(PASTEL_COLORS, 'circle') });
const palette = new Pielet({ items: buildPaletteItems('circle') });

// count — общее число пунктов меню, включая пункт-сабменю.
function assembleItems(count, fit) {
  const items = Array.from({ length: count - 1 }, (_, i) => {
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
        const sameMenu = menu === window.__menu ? 'the same instance' : 'another instance';
        statusEl.textContent = `action: ${label} (${i}) id: ${id} — ${sameMenu} — point: ${coords.x}, ${coords.y} — ${new Date().toLocaleTimeString()}`;
      }
    };
  });
  // Пункт-сабменю: двойная вложенность «Цвет» → палитра → «Основные»/«Пастельные».
  items.push({
    typeContent: 'text',
    content: fit === 'circle' ? '🎨' : 'Color',
    id: 'demo-color',
    isSubMenu: true,
    menu: palette
  });
  return items;
}

const menu = new Pielet(readState());
window.__menu = menu;
window.Pielet = Pielet;

function formatAvailableArc(value) {
  const parts = parseAvailableArc(value);
  return JSON.stringify(parts ?? []);
}

function syncValueLabels() {
  document.querySelectorAll('#controls output.value').forEach((out) => {
    const input = document.getElementById(out.dataset.for);
    if (!input) return;
    out.textContent = input.id === 'availableArc' ? formatAvailableArc(input.value) : input.value;
  });
}
Object.values(controls).forEach((el) => el.addEventListener('input', syncValueLabels));
syncValueLabels();

function parseAvailableArc(value) {
  if (!value) return undefined;
  return value.split(',').map((s) => s.trim());
}

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
    submenuDelay: Number(controls.submenuDelay.value),
    submenuIndicator: controls.submenuIndicator.value,
    availableArc: parseAvailableArc(controls.availableArc.value)
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
    submenuDelay: state.submenuDelay,
    submenuIndicator: state.submenuIndicator,
    availableArc: state.availableArc
  });
  // Сабменю должны следовать за всеми настройками демо (как главное меню),
  // чтобы hold-режим подхватывал зажатую кнопку, а fit/unifyText работали
  // и во вложенных меню. items у каждого сабменю свои.
  basic.config.items = buildColorItems(BASIC_COLORS, state.fit);
  pastel.config.items = buildColorItems(PASTEL_COLORS, state.fit);
  palette.config.items = buildPaletteItems(state.fit);
  for (const sub of [palette, basic, pastel]) {
    Object.assign(sub.config, {
      size: state.size,
      centerSize: state.centerSize,
      gap: state.gap,
      startAngle: state.startAngle,
      direction: state.direction,
      interactionMode: state.interactionMode,
      button,
      closeDistance: state.closeDistance,
      fit: state.fit,
      unifyText: state.unifyText,
      submenuDelay: state.submenuDelay,
      submenuIndicator: state.submenuIndicator,
      availableArc: state.availableArc
    });
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
  statusEl.textContent = `event: select — id: ${e.detail.id} — point: ${e.detail.coords.x}, ${e.detail.coords.y} — ${new Date().toLocaleTimeString()}`;
});
menu.addEventListener('close', () => {
  statusEl.textContent = `event: close — menu removed from DOM — ${new Date().toLocaleTimeString()}`;
});