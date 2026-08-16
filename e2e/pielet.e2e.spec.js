import { test, expect } from '@playwright/test';

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
  await expect(page.locator('.pielet__item')).toHaveCount(7);
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
  // третий item демо — typeContent 'none' (i % 6 === 3): 7 items → none на индексе 3
  await openMenu(page, 500, 400);
  await page.waitForTimeout(400);
  const angle = -90 + (3 + 0.5) * (360 / 7); // центр третьего сектора (pitch 360/7)
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

test('demo: the «Цвет» item opens a double-nested submenu chain (Цвет → Основные → Красный)', async ({ page }) => {
  await openMenu(page, 500, 400);
  // 7 items демо: последний сектор (индекс 6) — пункт «Цвет» (isSubMenu)
  const colorItem = (() => {
    const angle = -90 + (6 + 0.5) * (360 / 7);
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