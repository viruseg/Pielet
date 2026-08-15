import { test, expect } from '@playwright/test';

const MENU_OPEN_TIMED_OUT = 5000;

async function openMenu(page, x, y) {
  await page.evaluate(([px, py]) => window.__menu.open(px, py), [x, y]);
  await page.waitForSelector('.pielet', { state: 'attached', timeout: MENU_OPEN_TIMED_OUT });
  await page.waitForTimeout(30);
}

async function openMenuDeferred(page, x, y) {
  await page.evaluate(([px, py]) => window.__menu.open(px, py), [x, y]);
  await page.waitForSelector('.pielet', { state: 'attached', timeout: MENU_OPEN_TIMED_OUT });
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => window.__menu);
});

test('menu DOM lifecycle: open → DOM present, close → DOM removed', async ({ page }) => {
  await openMenu(page, 400, 400);
  await expect(page.locator('.pielet')).toHaveCount(1);
  await expect(page.locator('.pielet__item')).toHaveCount(6);
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
  await expect(page.locator('.pielet')).toHaveCount(0);
});

test('hold mode: pointer down at center opens, drag selects on release', async ({ page }) => {
  await page.selectOption('#mode', 'hold');
  await openMenuDeferred(page, 500, 400);
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
  // третий item демо — typeContent 'none' (i % 6 === 3): 6 items → none на индексе 3
  await openMenu(page, 500, 400);
  await page.waitForTimeout(400);
  const angle = -90 + 3 * 60 + 30; // центр третьего сектора (60° pitch)
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