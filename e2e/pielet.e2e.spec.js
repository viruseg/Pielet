import { test, expect } from '@playwright/test';
import { SUBMENU_CHEVRON_MAX_SIZE, SUBMENU_CHEVRON_SIZE_RATIO, SUBMENU_CHEVRON_EXTERNAL_OFFSET_RATIO } from '../src/geometry/calculateSector.js';

const MENU_OPEN_TIMED_OUT = 5000;

async function openMenu(page, x, y) {
  await page.evaluate(([px, py]) => window.__menu.open(px, py), [x, y]);
  await page.waitForSelector('.pielet', { state: 'attached', timeout: MENU_OPEN_TIMED_OUT });
  await page.waitForTimeout(30);
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => window.__menu);
});

test('menu DOM lifecycle: open → DOM present, close → DOM removed', async ({ page }) => {
  await openMenu(page, 400, 400);
  await expect(page.locator('.pielet')).toHaveCount(1);
  await expect(page.locator('.pielet__item')).toHaveCount(6);
  // инертный центр: нода-хук присутствует, не перехватывает события (pointer-events: none)
  await expect(page.locator('.pielet__center')).toHaveCount(1);
  await page.evaluate(() => {
    const center = document.querySelector('.pielet__center');
    return {
      tag: center.tagName.toLowerCase(),
      pointerEvents: getComputedStyle(center).pointerEvents,
      width: center.style.width,
      height: center.style.height,
      left: center.style.left,
      top: center.style.top
    };
  }).then(({ tag, pointerEvents, width, height, left, top }) => {
    expect(tag).toBe('div');
    expect(pointerEvents).toBe('none');
    // центр = centerSize (72) в геометрии демо, отцентрован в корне меню
    expect(parseFloat(width)).toBe(72);
    expect(parseFloat(height)).toBe(72);
    const box = 120; // outerRadius демо = 120
    expect(parseFloat(left)).toBeCloseTo(box - 36, 6);
    expect(parseFloat(top)).toBeCloseTo(box - 36, 6);
  });
  await page.evaluate(() => window.__menu.close());
  await expect(page.locator('.pielet')).toHaveCount(0);
  await openMenu(page, 200, 200);
  await expect(page.locator('.pielet')).toHaveCount(1);
});

test('click selects the item under the pointer and runs its action', async ({ page }) => {
  await openMenu(page, 500, 400);
  const menu = page.locator('.pielet');
  await expect(menu).toHaveCount(1);
  // 6 items, первый сектор начинается с -90° (сверху) по часовой; цель — его середина (-60°)
  await page.mouse.move(540, 331);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForFunction(
    () => window.__lastAction && window.__lastAction.index === 0,
    null,
    { timeout: MENU_OPEN_TIMED_OUT }
  );
  const coords = await page.evaluate(() => window.__lastAction.coords);
  expect(coords).toEqual({ x: 540, y: 331 });
  await expect(page.locator('.pielet')).toHaveCount(0);
});

test('hold mode: pointer down at center opens, drag selects on release', async ({ page }) => {
  await page.selectOption('#mode', 'hold');
  await page.mouse.move(500, 400);
  await page.mouse.down();
  // меню открывается по кнопке мыши; далее перемещение на первый сектор (середина сверху-справа)
  await page.waitForSelector('.pielet', { state: 'attached', timeout: MENU_OPEN_TIMED_OUT });
  await page.mouse.move(540, 331, { steps: 5 });
  await page.mouse.up();
  await page.waitForFunction(
    () => window.__lastAction && window.__lastAction.index === 0,
    null,
    { timeout: MENU_OPEN_TIMED_OUT }
  );
});

test('hold mode: pressing and immediately releasing the button closes the menu', async ({ page }) => {
  await page.selectOption('#mode', 'hold');
  await page.mouse.move(500, 400);
  await page.mouse.down();
  await page.waitForSelector('.pielet', { state: 'attached', timeout: MENU_OPEN_TIMED_OUT });
  await page.mouse.up();
  await expect(page.locator('.pielet')).toHaveCount(0);
});

test('hold mode: a non-configured button (right) does not open the menu', async ({ page }) => {
  await page.selectOption('#mode', 'hold');
  await page.mouse.move(600, 400);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await expect(page.locator('.pielet')).toHaveCount(0);
});

test('demo: changing the button takes effect immediately for the next open', async ({ page }) => {
  await openMenu(page, 600, 400); // 'click' + 'left' по умолчанию
  await page.waitForTimeout(400); // grace-окно открывающего клика
  await page.mouse.click(600, 400); // клик в центр закрывает меню
  await expect(page.locator('.pielet')).toHaveCount(0);
  await page.selectOption('#button', 'right');
  // новая кнопка должна открывать меню сразу, без предварительного «прогрева» старой
  await page.mouse.move(600, 400);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await expect(page.locator('.pielet')).toHaveCount(1);
});

test('scrolling the page closes the open menu', async ({ page }) => {
  await page.evaluate(() => {
    const pad = document.createElement('div');
    pad.style.height = '4000px';
    document.body.appendChild(pad);
  });
  await openMenu(page, 500, 400);
  await page.mouse.wheel(0, 400);
  await expect(page.locator('.pielet')).toHaveCount(0);
});

test('resizing the viewport closes the open menu', async ({ page }) => {
  await openMenu(page, 500, 400);
  await page.setViewportSize({ width: 700, height: 500 });
  await expect(page.locator('.pielet')).toHaveCount(0);
});

test('moving the pointer beyond outerRadius + closeDistance closes the menu', async ({ page }) => {
  await openMenu(page, 500, 400);
  await page.mouse.move(500, 400 - 80);
  await page.mouse.move(900, 100, { steps: 3 });
  await expect(page.locator('.pielet')).toHaveCount(0);
});

test('two instances: only one menu DOM exists', async ({ page }) => {
  await page.evaluate(() => {
    window.__second = new window.Pielet({ items: [{ typeContent: 'text', content: 'B' }] });
    window.__menu = window.__second;
  });
  await openMenu(page, 300, 300);
  await page.evaluate(() => window.__menu.open(600, 600));
  await expect(page.locator('.pielet')).toHaveCount(1);
});

test('opening at a corner keeps the requested center (edge reflow)', async ({ page }) => {
  await openMenu(page, 60, 60);
  const box = await page.locator('.pielet').boundingBox();
  // outerRadius = size/2 = 120: корневой элемент должен начинаться в (60-120, 60-120)
  expect(box.x).toBeCloseTo(60 - 120, 1);
  expect(box.y).toBeCloseTo(60 - 120, 1);
  // центр меню не сдвинут: (60, 60) + 120 = (180, 180)
  expect(box.x + box.width / 2).toBeCloseTo(60, 1);
  expect(box.y + box.height / 2).toBeCloseTo(60, 1);
});

test('menu opens exactly at the viewport center', async ({ page }) => {
  const { vw, vh } = await page.evaluate(() => ({ vw: window.innerWidth, vh: window.innerHeight }));
  await openMenu(page, vw / 2, vh / 2);
  const box = await page.locator('.pielet').boundingBox();
  expect(box.x + box.width / 2).toBeCloseTo(vw / 2, 1);
  expect(box.y + box.height / 2).toBeCloseTo(vh / 2, 1);
});

for (const point of [
  { name: 'left edge', x: 80, y: 500 },
  { name: 'right edge', x: 1100, y: 500 },
  { name: 'top edge', x: 600, y: 80 },
  { name: 'bottom edge', x: 600, y: 700 },
  { name: 'top-left corner', x: 80, y: 80 },
  { name: 'top-right corner', x: 1100, y: 80 },
  { name: 'bottom-left corner', x: 80, y: 700 },
  { name: 'bottom-right corner', x: 1100, y: 700 }
]) {
  test(`opening at the ${point.name} anchors the requested center (x=${point.x}, y=${point.y})`, async ({ page }) => {
    await openMenu(page, point.x, point.y);
    const box = await page.locator('.pielet').boundingBox();
    expect(box.x + box.width / 2).toBeCloseTo(point.x, 1);
    expect(box.y + box.height / 2).toBeCloseTo(point.y, 1);
    expect(box.x).toBeCloseTo(point.x - 120, 1);
    expect(box.y).toBeCloseTo(point.y - 120, 1);
  });
}

test('menu larger than viewport still opens centered without errors', async ({ page }) => {
  await page.evaluate(async () => {
    window.__menu.close();
    window.__menu = new window.Pielet({
      size: 900,
      items: [{ typeContent: 'text', content: 'Big' }]
    });
    window.__menu.open(300, 200);
  });
  await page.waitForSelector('.pielet', { state: 'attached', timeout: MENU_OPEN_TIMED_OUT });
  const box = await page.locator('.pielet').boundingBox();
  expect(box.x + box.width / 2).toBeCloseTo(300, 1);
  expect(box.y + box.height / 2).toBeCloseTo(200, 1);
});

test('text items are always rendered on a single line (white-space: nowrap)', async ({ page }) => {
  await page.evaluate(() => {
    window.__wrap = new window.Pielet({
      items: [
        { typeContent: 'text', content: 'Some quite long label that would previously wrap' },
        { typeContent: 'text', content: 'Short' }
      ]
    });
    window.__wrap.open(400, 400);
  });
  await page.waitForSelector('.pielet', { state: 'attached', timeout: MENU_OPEN_TIMED_OUT });
  const styles = await page.evaluate(() => {
    const menu = document.querySelector('.pielet');
    return Array.from(menu.querySelectorAll('.pielet__content--text')).map((el) => getComputedStyle(el).whiteSpace);
  });
  expect(styles).toEqual(['nowrap', 'nowrap']);
  await page.evaluate(() => window.__wrap.close());
});

test('clicking the page opens the menu under the cursor (demo behavior)', async ({ page }) => {
  await page.mouse.move(411, 263);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForSelector('.pielet', { state: 'attached', timeout: MENU_OPEN_TIMED_OUT });
  const box = await page.locator('.pielet').boundingBox();
  expect(box.x + box.width / 2).toBeCloseTo(411, 1);
  expect(box.y + box.height / 2).toBeCloseTo(263, 1);
});

test('click mode: releasing the mouse button does not close the menu', async ({ page }) => {
  await openMenu(page, 400, 300);
  await page.mouse.move(400, 300);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(30);
  await expect(page.locator('.pielet')).toHaveCount(1);
});

test('click mode: clicking outside an item closes the menu', async ({ page }) => {
  await openMenu(page, 400, 300);
  await page.waitForTimeout(400);
  await page.mouse.click(400, 300);
  await expect(page.locator('.pielet')).toHaveCount(0);
});

test('click mode: clicking a none sector closes the menu without action', async ({ page }) => {
  // третий item демо — typeContent 'none' (i % 6 === 3): 6 items → none на индексе 3
  await openMenu(page, 500, 400);
  await page.waitForTimeout(400);
  const angle = -90 + (3 + 0.5) * (360 / 6); // центр третьего сектора (pitch 360/6)
  const rad = (angle * Math.PI) / 180;
  await page.mouse.click(500 + 80 * Math.cos(rad), 400 + 80 * Math.sin(rad));
  await expect(page.locator('.pielet')).toHaveCount(0);
});

test('context menu is suppressed while the menu is open', async ({ page }) => {
  await openMenu(page, 400, 400);
  const event = await page.evaluate(async () => {
    const obj = await new Promise((resolve) => {
      const handler = (e) => {
        window.removeEventListener('contextmenu', handler);
        resolve(e.defaultPrevented);
      };
      window.addEventListener('contextmenu', handler);
      window.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    });
    return obj;
  });
  expect(event).toBe(true);
});

test.describe('submenus (isSubMenu)', () => {
  async function installSubmenus(page, { parentMode = 'click', submenuMode = 'click' } = {}) {
    await page.evaluate(({ parentMode, submenuMode }) => {
      window.__leafAction = 0;
      window.__submenu = new window.Pielet({
        interactionMode: submenuMode,
        button: 'left',
        items: [
          { typeContent: 'text', content: 'Leaf', action: () => { window.__leafAction += 1; } }
        ]
      });
      window.__parent = new window.Pielet({
        interactionMode: parentMode,
        button: 'left',
        submenuDelay: 250,
        items: [
          { typeContent: 'text', content: 'More', isSubMenu: true, menu: window.__submenu },
          { typeContent: 'text', content: 'Other' }
        ]
      });
    }, { parentMode, submenuMode });
  }

  test('click: clicking a submenu item opens the submenu at the click point', async ({ page }) => {
    await installSubmenus(page);
    await page.evaluate(() => window.__parent.open(400, 400));
    await page.waitForSelector('.pielet', { state: 'attached', timeout: MENU_OPEN_TIMED_OUT });
    // клик по середине первого сектора (right half, угол 0°)
    await page.mouse.click(480, 400);
    await expect(page.locator('.pielet')).toHaveCount(1);
    const box = await page.locator('.pielet').boundingBox();
    expect(box.x + box.width / 2).toBeCloseTo(480, 1);
    expect(box.y + box.height / 2).toBeCloseTo(400, 1);
    await page.evaluate(() => window.__submenu.close());
  });

  test('click: the parent action of a submenu item is not called', async ({ page }) => {
    await page.evaluate(() => {
      window.__parentAction = 0;
      window.__submenu = new window.Pielet({ items: [{ typeContent: 'text', content: 'Leaf' }] });
      window.__parent = new window.Pielet({
        items: [
          { typeContent: 'text', content: 'More', isSubMenu: true, menu: window.__submenu, action: () => { window.__parentAction += 1; } },
          { typeContent: 'text', content: 'Other' }
        ]
      });
    });
    await page.evaluate(() => window.__parent.open(400, 400));
    await page.waitForSelector('.pielet', { state: 'attached', timeout: MENU_OPEN_TIMED_OUT });
    await page.mouse.click(480, 400);
    const parentAction = await page.evaluate(() => window.__parentAction);
    expect(parentAction).toBe(0);
    await page.evaluate(() => window.__submenu.close());
  });

  test('hold: hovering a submenu item for the delay opens the submenu while holding', async ({ page }) => {
    await installSubmenus(page, { parentMode: 'hold', submenuMode: 'hold' });
    await page.evaluate(() => window.__parent.open(400, 400));
    await page.waitForSelector('.pielet', { state: 'attached', timeout: MENU_OPEN_TIMED_OUT });
    // синтетическое удержание кнопки (buttons: 1) и наведение на первый сектор
    await page.evaluate(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, buttons: 1, clientX: 480, clientY: 400 }));
    });
    await page.waitForTimeout(500);
    await expect(page.locator('.pielet')).toHaveCount(1);
    const box = await page.locator('.pielet').boundingBox();
    expect(box.x + box.width / 2).toBeCloseTo(480, 1);
    expect(box.y + box.height / 2).toBeCloseTo(400, 1);
    // сабменю в hold-режиме с той же кнопкой: уход на сектор и отпускание выбирают
    await page.evaluate(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, buttons: 1, clientX: 560, clientY: 400 }));
      window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 560, clientY: 400 }));
    });
    await page.waitForFunction(() => window.__leafAction === 1, null, { timeout: MENU_OPEN_TIMED_OUT });
  });
});

test('chevron indicator: 14px at the default size (240/72)', async ({ page }) => {
  await page.evaluate(() => {
    window.__submenu = new window.Pielet({ items: [{ typeContent: 'text', content: 'Leaf' }] });
    window.__parent = new window.Pielet({
      items: [
        { typeContent: 'text', content: 'More', isSubMenu: true, menu: window.__submenu },
        { typeContent: 'text', content: 'Other' }
      ]
    });
    window.__parent.open(400, 400);
  });
  await page.waitForSelector('.pielet', { state: 'attached', timeout: MENU_OPEN_TIMED_OUT });
  const size = await page.evaluate(() => {
    const chevron = document.querySelector('.pielet__submenu-chevron');
    return parseFloat(chevron.getAttribute('width'));
  });
  expect(size).toBe(SUBMENU_CHEVRON_MAX_SIZE);
  await page.evaluate(() => window.__parent.close());
});

test('chevron indicator: responsive size and position at the outer rim clear of content (size=120, centerSize=24)', async ({ page }) => {
  await page.evaluate(() => {
    window.__submenu = new window.Pielet({ items: [{ typeContent: 'text', content: 'Leaf' }] });
    window.__parent = new window.Pielet({
      size: 120,
      centerSize: 24,
      items: [
        { typeContent: 'text', content: 'More', isSubMenu: true, menu: window.__submenu },
        { typeContent: 'text', content: 'Other' }
      ]
    });
    window.__parent.open(400, 400);
  });
  await page.waitForSelector('.pielet', { state: 'attached', timeout: MENU_OPEN_TIMED_OUT });
  const geo = await page.evaluate(() => {
    const menu = document.querySelector('.pielet');
    const item = menu.querySelector('.pielet__item--submenu');
    const chevron = menu.querySelector('.pielet__submenu-chevron');
    const caption = item.querySelector('.pielet__item-caption');
    const chevronBox = chevron.getBoundingClientRect();
    const captionBox = caption.getBoundingClientRect();
    const menuBox = menu.getBoundingClientRect();
    const cx = menuBox.x + menuBox.width / 2;
    const cy = menuBox.y + menuBox.height / 2;
    return {
      size: parseFloat(chevron.getAttribute('width')),
      chevronRadius: Math.hypot(chevronBox.x + chevronBox.width / 2 - cx, chevronBox.y + chevronBox.height / 2 - cy),
      captionRadius: Math.hypot(captionBox.x + captionBox.width / 2 - cx, captionBox.y + captionBox.height / 2 - cy),
      outerRadius: menuBox.width / 2
    };
  });
  // ring 48 → 48*SIZE_RATIO (пропорционально кольцу, не фиксированный потолок)
  expect(geo.size).toBeCloseTo(48 * SUBMENU_CHEVRON_SIZE_RATIO, 1);
  // шеврон «сидит» на внешнем крае кольца (центр = outerRadius + size*EXTERNAL_OFFSET_RATIO),
  // радиально дальше контента — не сливается ни при каком fit
  expect(geo.chevronRadius).toBeCloseTo(60 + geo.size * SUBMENU_CHEVRON_EXTERNAL_OFFSET_RATIO, 1);
  expect(geo.chevronRadius).toBeGreaterThan(geo.captionRadius);
  expect(geo.chevronRadius - geo.size / 2).toBeCloseTo(geo.outerRadius - geo.size * (0.5 - SUBMENU_CHEVRON_EXTERNAL_OFFSET_RATIO), 1);
  await page.evaluate(() => window.__parent.close());
});

test('square fit: chevron stays at the outer rim, clear of the rotated content (no visible overlap)', async ({ page }) => {
  await page.evaluate(() => {
    window.__submenu = new window.Pielet({ items: [{ typeContent: 'text', content: 'Leaf' }] });
    // 6 пунктов + сабменю-пункт на индексе 5 (mid ≈ 240° — повёрнутый, как «Цвет» в демо)
    const items = ['Один', 'Два', 'Три', 'Четыре', 'Пять'].map((content) => ({ typeContent: 'text', content }));
    items.push({ typeContent: 'text', content: 'Цвет', isSubMenu: true, menu: window.__submenu });
    window.__sq = new window.Pielet({ fit: 'square', items });
    window.__sq.open(400, 400);
  });
  await page.waitForSelector('.pielet', { state: 'attached', timeout: MENU_OPEN_TIMED_OUT });
  const r = await page.evaluate(() => {
    const menu = document.querySelector('.pielet');
    const item = menu.querySelector('.pielet__item--submenu');
    const chevron = menu.querySelector('.pielet__submenu-chevron');
    const caption = item.querySelector('.pielet__item-caption');
    const chevronBox = chevron.getBoundingClientRect();
    const captionBox = caption.getBoundingClientRect();
    const menuBox = menu.getBoundingClientRect();
    const cx = menuBox.x + menuBox.width / 2;
    const cy = menuBox.y + menuBox.height / 2;
    const size = parseFloat(chevron.getAttribute('width'));
    const chevronRadius = Math.hypot(chevronBox.x + chevronBox.width / 2 - cx, chevronBox.y + chevronBox.height / 2 - cy);
    const captionRadius = Math.hypot(captionBox.x + captionBox.width / 2 - cx, captionBox.y + captionBox.height / 2 - cy);
    // шеврон повёрнут так, что его высота ложится вдоль радиуса; контент
    // square-сектора — шириной вдоль радиуса (offsetWidth/offsetHeight — до transform)
    return {
      size,
      chevronRadius,
      chevronInner: chevronRadius - size / 2,
      captionOuter: captionRadius + caption.offsetWidth / 2,
      outerRadius: menuBox.width / 2
    };
  });
  expect(r.size).toBe(SUBMENU_CHEVRON_MAX_SIZE);
  // контент всегда внутри кольца; шеврон «сидит» на внешнем крае (центр на
  // EXTERNAL_OFFSET_RATIO·size за ним): внутренняя кромка бокса ровно на
  // внешнем радиусе, а видимый глиф стрелки остаётся радиально за контентом
  expect(r.captionOuter).toBeLessThan(r.outerRadius);
  expect(r.chevronRadius).toBeGreaterThan(r.captionOuter);
  expect(r.chevronInner).toBeCloseTo(r.outerRadius - r.size * (0.5 - SUBMENU_CHEVRON_EXTERNAL_OFFSET_RATIO), 1);
  expect(r.chevronInner).toBeGreaterThan(r.captionOuter - 2);
  await page.evaluate(() => window.__sq.close());
});

test('submenu items: content positions are identical to equivalent plain items', async ({ page }) => {
  await page.evaluate(() => {
    window.__submenu = new window.Pielet({ items: [{ typeContent: 'text', content: 'Leaf' }] });
    window.__plain = new window.Pielet({
      items: [
        { typeContent: 'text', content: 'Один' },
        { typeContent: 'text', content: 'Два' }
      ]
    });
    window.__withsub = new window.Pielet({
      items: [
        { typeContent: 'text', content: 'Один', isSubMenu: true, menu: window.__submenu },
        { typeContent: 'text', content: 'Два' }
      ]
    });
    window.__plain.open(400, 400);
  });
  await page.waitForSelector('.pielet', { state: 'attached', timeout: MENU_OPEN_TIMED_OUT });
  const readCenters = () =>
    page.evaluate(() => {
      const menus = document.querySelectorAll('.pielet');
      const menu = menus[menus.length - 1];
      return Array.from(menu.querySelectorAll('.pielet__item-caption')).map((c) => {
        const b = c.getBoundingClientRect();
        return [b.x + b.width / 2, b.y + b.height / 2];
      });
    });
  const plain = await readCenters();
  await page.evaluate(() => window.__plain.close());
  await page.waitForTimeout(350);
  await page.evaluate(() => window.__withsub.open(400, 400));
  await page.waitForSelector('.pielet', { state: 'attached', timeout: MENU_OPEN_TIMED_OUT });
  const withsub = await readCenters();
  expect(withsub).toEqual(plain);
  await page.evaluate(() => window.__withsub.close());
});

test('palette case: content and chevron of both submenu items sit on one horizontal line', async ({ page }) => {
  await page.evaluate(() => {
    window.__submenu = new window.Pielet({ items: [{ typeContent: 'text', content: 'Красный' }] });
    window.__palette = new window.Pielet({
      items: [
        { typeContent: 'text', content: 'Основные', isSubMenu: true, menu: window.__submenu },
        { typeContent: 'text', content: 'Пастельные', isSubMenu: true, menu: window.__submenu }
      ]
    });
    window.__palette.open(400, 400);
  });
  await page.waitForSelector('.pielet', { state: 'attached', timeout: MENU_OPEN_TIMED_OUT });
  const dy = await page.evaluate(() => {
    const menu = document.querySelector('.pielet');
    const menuBox = menu.getBoundingClientRect();
    const cy = menuBox.y + menuBox.height / 2;
    const caps = Array.from(menu.querySelectorAll('.pielet__item-caption'));
    // измеряем визуальный центр ГЛИФА (path), а не бокса svg: у текстового '›'
    // метрики шрифта смещали глиф и ломали горизонтальное выравнивание
    const glyphs = Array.from(menu.querySelectorAll('.pielet__submenu-chevron path'));
    const dyOf = (el) => {
      const b = el.getBoundingClientRect();
      return (b.y + b.height / 2) - cy;
    };
    return { capDy: caps.map(dyOf), chevDy: glyphs.map(dyOf) };
  });
  // контент и глиф шеврона обоих пунктов — на одной горизонтальной линии (Y центра меню)
  expect(dy.capDy).toHaveLength(2);
  expect(dy.chevDy).toHaveLength(2);
  for (const d of [...dy.capDy, ...dy.chevDy]) expect(Math.abs(d)).toBeLessThan(1);
  await page.evaluate(() => window.__palette.close());
});

test('4 submenu items at startAngle -135: chevron glyphs — two on a horizontal line, two on a vertical line', async ({ page }) => {
  await page.evaluate(() => {
    window.__sub = new window.Pielet({ items: [{ typeContent: 'text', content: 'Leaf' }] });
    window.__four = new window.Pielet({
      startAngle: -135,
      items: Array.from({ length: 4 }, (_, i) => ({
        typeContent: 'text',
        content: `S${i}`,
        isSubMenu: true,
        menu: window.__sub
      }))
    });
    window.__four.open(400, 400);
  });
  await page.waitForSelector('.pielet', { state: 'attached', timeout: MENU_OPEN_TIMED_OUT });
  const res = await page.evaluate(() => {
    const menu = document.querySelector('.pielet');
    const menuBox = menu.getBoundingClientRect();
    const cx = menuBox.x + menuBox.width / 2;
    const cy = menuBox.y + menuBox.height / 2;
    const glyphs = Array.from(menu.querySelectorAll('.pielet__submenu-chevron path')).map((p) => {
      const b = p.getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    });
    return { glyphs, cx, cy };
  });
  // mid секторов: -90° (0), 0° (1), 90° (2), 180° (3)
  expect(res.glyphs).toHaveLength(4);
  // вертикальная пара (0 и 2) — на одной вертикали; горизонтальная пара (1 и 3) — на одной горизонтали
  expect(Math.abs(res.glyphs[0].x - res.glyphs[2].x)).toBeLessThan(1);
  expect(Math.abs(res.glyphs[1].y - res.glyphs[3].y)).toBeLessThan(1);
  // и стоят на осях центра меню: горизонтальная пара на Y центра, вертикальная — на X центра
  expect(Math.abs(res.glyphs[1].y - res.cy)).toBeLessThan(1);
  expect(Math.abs(res.glyphs[3].y - res.cy)).toBeLessThan(1);
  expect(Math.abs(res.glyphs[0].x - res.cx)).toBeLessThan(1);
  expect(Math.abs(res.glyphs[2].x - res.cx)).toBeLessThan(1);
  await page.evaluate(() => window.__four.close());
});

test('demo: the «Цвет» item opens a double-nested submenu chain (Цвет → Основные → Красный)', async ({ page }) => {
  await openMenu(page, 500, 400);
  // 6 items демо: последний сектор (индекс 5) — пункт «Цвет» (isSubMenu)
  const colorItem = (() => {
    const angle = -90 + (5 + 0.5) * (360 / 6);
    const rad = (angle * Math.PI) / 180;
    return { x: 500 + 80 * Math.cos(rad), y: 400 + 80 * Math.sin(rad) };
  })();
  await page.mouse.click(colorItem.x, colorItem.y);
  await page.waitForTimeout(50);
  await expect(page.locator('.pielet')).toHaveCount(1);
  let box = await page.locator('.pielet').boundingBox();
  expect(box.x + box.width / 2).toBeCloseTo(colorItem.x, 1);
  expect(box.y + box.height / 2).toBeCloseTo(colorItem.y, 1);

  // в сабменю 2 пункта; первый («Основные», угол 0°) — снова сабменю
  const subX = colorItem.x + 80;
  const subY = colorItem.y;
  await page.mouse.click(subX, subY);
  await page.waitForTimeout(50);
  await expect(page.locator('.pielet')).toHaveCount(1);
  box = await page.locator('.pielet').boundingBox();
  expect(box.x + box.width / 2).toBeCloseTo(subX, 1);
  expect(box.y + box.height / 2).toBeCloseTo(subY, 1);

  // вложенное меню: 3 пункта; первый («Красный», середина сектора -30°) применяет цвет
  const basicAngle = -30;
  const basicRad = (basicAngle * Math.PI) / 180;
  await page.mouse.click(subX + 80 * Math.cos(basicRad), subY + 80 * Math.sin(basicRad));
  await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--pielet-background').trim() === '#e5484d');
  await expect(page.locator('.pielet')).toHaveCount(0);
});

test.describe('touch devices', () => {
  test.use({ hasTouch: true });

  test('touch: tap opens the menu even with a non-primary button selected', async ({ page }) => {
    await page.selectOption('#button', 'right');
    await page.touchscreen.tap(500, 400);
    await expect(page.locator('.pielet')).toHaveCount(1);
  });

  test('touch: tap on a sector selects the item', async ({ page }) => {
    await page.touchscreen.tap(500, 400);
    await expect(page.locator('.pielet')).toHaveCount(1);
    await page.touchscreen.tap(540, 331);
    await page.waitForFunction(
      () => window.__lastAction && window.__lastAction.index === 0,
      null,
      { timeout: MENU_OPEN_TIMED_OUT }
    );
    await expect(page.locator('.pielet')).toHaveCount(0);
  });
});