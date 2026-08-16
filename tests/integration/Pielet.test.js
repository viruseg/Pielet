// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Pielet from '../../src/Pielet.js';

const items = [
  { typeContent: 'text', content: 'Open', action: vi.fn(() => {}) },
  { typeContent: 'text', content: 'Save' },
  { typeContent: 'none' },
  { typeContent: 'image', content: '/icons/delete.svg' }
];

function makeMenu(overrides = {}) {
  return new Pielet({ items, ...overrides });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let menu;

beforeEach(() => {
  vi.useRealTimers();
  menu = null;
});

afterEach(async () => {
  if (menu) {
    menu.close();
    await sleep(400);
  }
  document.body.innerHTML = '';
});

describe('Pielet.open', () => {
  it('creates the menu DOM in document.body', () => {
    menu = makeMenu();
    menu.open(300, 250);
    expect(document.body.querySelectorAll('.pielet')).toHaveLength(1);
    expect(document.body.querySelectorAll('.pielet__item')).toHaveLength(4);
  });

  it('positions the menu around the given center', () => {
    menu = makeMenu();
    menu.open(300, 250);
    const el = document.body.querySelector('.pielet');
    expect(el.style.left).toBe('180px');
    expect(el.style.top).toBe('130px');
    expect(el.style.width).toBe('240px');
  });

  it('fires the open event', () => {
    menu = makeMenu();
    const onOpen = vi.fn();
    menu.addEventListener('open', onOpen);
    menu.open(100, 100);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('passes the visible rect in detail', () => {
    menu = makeMenu();
    let rect;
    menu.addEventListener('open', (e) => {
      rect = e.detail.rect;
    });
    menu.open(300, 250);
    // дефолтный конфиг: size 240, centerSize 72 → outerRadius 120, innerRadius 36.
    // Меню целиком в viewport jsdom (1024×768) → rect = весь квадрат вокруг центра.
    expect(rect).toEqual({
      x: 180,
      y: 130,
      width: 240,
      height: 240,
      left: 180,
      top: 130,
      right: 420,
      bottom: 370
    });
  });

  it('throws on non-finite coordinates', () => {
    menu = makeMenu();
    expect(() => menu.open(NaN, 100)).toThrow(/coordinates/);
    expect(() => menu.open(100, Infinity)).toThrow(/coordinates/);
    expect(() => menu.open()).toThrow(/coordinates/);
  });

  it('creates no DOM at construction time', () => {
    const m = makeMenu();
    expect(document.body.querySelector('.pielet')).toBeNull();
    m.close();
  });
});

describe('Pielet.close', () => {
  it('removes the DOM after the close animation', async () => {
    menu = makeMenu();
    menu.open(100, 100);
    await sleep(30);
    const onClose = vi.fn();
    menu.addEventListener('close', onClose);
    menu.close();
    expect(document.body.querySelector('.pielet')).toBeTruthy();
    await sleep(400);
    expect(document.body.querySelector('.pielet')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when closed (no close event)', () => {
    menu = makeMenu();
    const onClose = vi.fn();
    menu.addEventListener('close', onClose);
    menu.close();
    menu.close();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('releases global listeners after close (pointermove ignored)', async () => {
    menu = makeMenu();
    menu.open(300, 300);
    await sleep(30);
    menu.close();
    await sleep(400);
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 350, clientY: 300 }));
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 350, clientY: 300 }));
    expect(document.body.querySelector('.pielet')).toBeNull();
  });

  it('can be reopened after close', async () => {
    menu = makeMenu();
    menu.open(100, 100);
    await sleep(30);
    menu.close();
    await sleep(400);
    menu.open(500, 400);
    expect(document.body.querySelectorAll('.pielet')).toHaveLength(1);
  });
});

describe('Pielet.config handling', () => {
  it('throws on invalid config at construction time', () => {
    expect(() => new Pielet({ items: [] })).toThrow(/Pielet config error/);
    expect(() => new Pielet({ items: [{ typeContent: 'text', content: '' }] })).toThrow(/Pielet config error/);
    expect(() => new Pielet()).toThrow(/Pielet config error/);
  });

  it('applies config changes on the next open', async () => {
    menu = makeMenu();
    menu.open(200, 200);
    await sleep(30);
    menu.close();
    await sleep(400);
    menu.config.size = 160;
    menu.config.centerSize = 40;
    menu.open(200, 200);
    const el = document.body.querySelector('.pielet');
    expect(el.style.width).toBe('160px');
  });

  it('re-validates config at open and throws on invalid mutation', () => {
    menu = makeMenu();
    menu.config.items = [];
    expect(() => menu.open(100, 100)).toThrow(/Pielet config error/);
  });

  it('close() without open does not leak', () => {
    menu = makeMenu();
    expect(() => menu.close()).not.toThrow();
  });
});

describe('Pielet selection pipeline', () => {
  it('hover never highlights a none sector (end-to-end)', () => {
    const menu2 = new Pielet({
      items: [
        { typeContent: 'none' },
        { typeContent: 'text', content: 'B' },
        { typeContent: 'none' },
        { typeContent: 'text', content: 'D' }
      ]
    });
    menu2.open(300, 300);
    // сектор 0 (none) наверху: pointermove туда не должен добавить hover
    window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 300, clientY: 220 }));
    expect(document.querySelectorAll('.pielet__item--hover').length).toBe(0);
    // наведение на середину сектора 1 (text, справа) подсвечивает его
    window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 356, clientY: 356 }));
    expect(document.querySelectorAll('.pielet__item--hover').length).toBe(1);
    expect(document.querySelector('.pielet__item--hover').getAttribute('style')).toContain('clip-path');
    window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 300, clientY: 220 }));
    expect(document.querySelectorAll('.pielet__item--hover').length).toBe(0);
    menu2.close();
  });

  it('runs select event → close → action in order, with DOM removed before action', async () => {
    const log = [];
    const action = vi.fn(() => {
      log.push('action');
      log.push(`dom-gone:${document.body.querySelector('.pielet') === null}`);
    });
    menu = new Pielet({ items: [{ typeContent: 'text', content: 'A', action }] });
    menu.addEventListener('select', () => log.push('select'));
    menu.addEventListener('close', () => log.push('close'));
    menu.open(300, 300);
    // единственный пункт занимает всё кольцо (gap при n=1 не рисуется): клик внизу всё ещё внутри сектора
    window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 301, clientY: 380 }));
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 301, clientY: 380 }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(log).toEqual(['select', 'close', 'action', 'dom-gone:true']);
    expect(document.body.querySelector('.pielet')).toBeNull();
  });

  it('click mode: pointerup in the center does NOT close the menu', () => {
    menu = makeMenu();
    menu.open(300, 300);
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 300, clientY: 300 }));
    expect(document.querySelector('.pielet')).toBeTruthy();
    menu.close();
  });

  it('click mode: a click outside an item closes the menu (after the open grace)', async () => {
    menu = makeMenu();
    menu.open(300, 300);
    await sleep(400);
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 300, clientY: 300 }));
    await sleep(400);
    expect(document.body.querySelector('.pielet')).toBeNull();
  });

  it('hold mode: pointerup in the center closes the menu without select', async () => {
    const action = vi.fn();
    menu = new Pielet({
      interactionMode: 'hold',
      button: 'left',
      items: [
        { typeContent: 'text', content: 'A', action },
        { typeContent: 'text', content: 'B' }
      ]
    });
    const log = [];
    menu.addEventListener('select', () => log.push('select'));
    menu.open(300, 300);
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 300, clientY: 300 }));
    expect(action).not.toHaveBeenCalled();
    expect(log).toEqual([]);
    await sleep(400);
    expect(document.body.querySelector('.pielet')).toBeNull();
  });

  it('hold mode: pointerup with the configured button over a sector selects and closes', async () => {
    const action = vi.fn();
    menu = new Pielet({ interactionMode: 'hold', items: [{ typeContent: 'text', content: 'A', action }] });
    menu.open(300, 300);
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 301, clientY: 380 }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('.pielet')).toBeNull();
  });

  it('hold mode: pointerup with a non-configured button is ignored', async () => {
    const action = vi.fn();
    menu = new Pielet({ interactionMode: 'hold', button: 'left', items: [{ typeContent: 'text', content: 'A', action }] });
    menu.open(300, 300);
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 2, clientX: 301, clientY: 380 }));
    expect(action).not.toHaveBeenCalled();
    expect(document.body.querySelector('.pielet')).toBeTruthy();
    menu.close();
    await sleep(400);
  });

  it('click mode: pointerup with a non-configured button does not select', async () => {
    const action = vi.fn();
    menu = new Pielet({ interactionMode: 'click', button: 'left', items: [{ typeContent: 'text', content: 'A', action }] });
    menu.open(300, 300);
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 2, clientX: 301, clientY: 380 }));
    expect(action).not.toHaveBeenCalled();
    expect(document.body.querySelector('.pielet')).toBeTruthy();
    menu.close();
    await sleep(400);
  });

  it('does not swallow exceptions from user action; menu closes and stays closed', () => {
    const boom = vi.fn(() => {
      throw new Error('user error');
    });
    const item = { typeContent: 'text', content: 'A', action: boom };
    menu = new Pielet({ items: [item] });
    menu.open(300, 300);
    expect(() => menu._select(item, 0)).toThrow('user error');
    expect(boom).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('.pielet')).toBeNull();
  });

  it('select event detail.id and action argument match an explicit item id', async () => {
    const action = vi.fn();
    let detailId = null;
    menu = new Pielet({ items: [{ typeContent: 'text', content: 'A', id: 'custom-a', action }] });
    menu.addEventListener('select', (e) => {
      detailId = e.detail.id;
    });
    menu.open(300, 300);
    window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 301, clientY: 380 }));
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 301, clientY: 380 }));
    expect(detailId).toBe('custom-a');
    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith('custom-a');
  });

  it('select event detail.id and action argument use the generated id', async () => {
    const action = vi.fn();
    let detailId = null;
    menu = new Pielet({ items: [{ typeContent: 'text', content: 'A', action }] });
    menu.addEventListener('select', (e) => {
      detailId = e.detail.id;
    });
    menu.open(300, 300);
    const itemId = menu.config.items[0].id;
    expect(itemId).toMatch(/^pielet-\d+-\d+$/);
    window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 301, clientY: 380 }));
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 301, clientY: 380 }));
    expect(detailId).toBe(itemId);
    expect(action).toHaveBeenCalledWith(itemId);
  });

  it('regenerates generated ids on each open while explicit ids stay stable', async () => {
    const action = vi.fn();
    menu = new Pielet({
      items: [
        { typeContent: 'text', content: 'A', action },
        { typeContent: 'text', content: 'B', id: 'stable' }
      ]
    });
    menu.open(300, 300);
    const firstGenerated = menu.config.items[0].id;
    expect(firstGenerated).toMatch(/^pielet-/);
    expect(menu.config.items[1].id).toBe('stable');
    menu.close();
    await sleep(400);
    menu.open(300, 300);
    expect(menu.config.items[0].id).toMatch(/^pielet-/);
    expect(menu.config.items[0].id).not.toBe(firstGenerated);
    expect(menu.config.items[1].id).toBe('stable');
  });

  it('opens another menu from an action without runtime conflicts', () => {
    menu = new Pielet({
      items: [{ typeContent: 'text', content: 'A', action: () => second.open(600, 150) }]
    });
    const second = new Pielet({ items: [{ typeContent: 'text', content: 'B' }] });
    menu.open(300, 300);
    window.dispatchEvent(new MouseEvent('pointerup', {
      bubbles: true,
      button: 0,
      clientX: 301,
      clientY: 380
    }));
    expect(document.body.querySelectorAll('.pielet')).toHaveLength(1);
    const secondEl = document.body.querySelector('.pielet');
    expect(secondEl.style.left).toBe('480px');
  });

  it('click mode: selecting a keepOpen item fires select and action but keeps the menu open', () => {
    const action = vi.fn();
    const log = [];
    menu = new Pielet({
      interactionMode: 'click',
      items: [
        { typeContent: 'text', content: 'Keep', keepOpen: true, action },
        { typeContent: 'text', content: 'Close' }
      ]
    });
    menu.addEventListener('select', () => log.push('select'));
    menu.addEventListener('close', () => log.push('close'));
    menu.open(300, 300);
    // сектор 0 (right half): клик на оси 0°
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 400, clientY: 300 }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(log).toEqual(['select']);
    expect(document.body.querySelector('.pielet')).toBeTruthy();
  });

  it('click mode: a regular item still closes the menu after a keepOpen selection', () => {
    const keepAction = vi.fn();
    const closeAction = vi.fn();
    menu = new Pielet({
      interactionMode: 'click',
      items: [
        { typeContent: 'text', content: 'Keep', keepOpen: true, action: keepAction },
        { typeContent: 'text', content: 'Close', action: closeAction }
      ]
    });
    menu.open(300, 300);
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 400, clientY: 300 }));
    expect(keepAction).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('.pielet')).toBeTruthy();
    // сектор 1 (bottom-left): клик на оси 180°
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 220, clientY: 300 }));
    expect(closeAction).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('.pielet')).toBeNull();
  });

  it('hold mode: keepOpen is ignored and the menu closes on select', () => {
    const action = vi.fn();
    menu = new Pielet({
      interactionMode: 'hold',
      items: [
        { typeContent: 'text', content: 'A', keepOpen: true, action },
        { typeContent: 'text', content: 'B' }
      ]
    });
    menu.open(300, 300);
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 400, clientY: 300 }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('.pielet')).toBeNull();
  });
});

describe('Pielet.setItemContent', () => {
  it('updates the DOM and config content of a text item by id', () => {
    menu = new Pielet({ items: [{ typeContent: 'text', content: 'Old', id: 'item-a' }] });
    menu.open(300, 300);
    menu.setItemContent('item-a', 'New');
    const textEl = document.querySelector('.pielet__content--text');
    expect(textEl.textContent).toBe('New');
    expect(menu.config.items[0].content).toBe('New');
  });

  it('updates the image src of an image item by id', () => {
    menu = new Pielet({ items: [{ typeContent: 'image', content: '/a.png', id: 'img' }] });
    menu.open(300, 300);
    menu.setItemContent('img', '/b.png');
    const img = document.querySelector('.pielet__content--image');
    expect(img.getAttribute('src')).toBe('/b.png');
    expect(menu.config.items[0].content).toBe('/b.png');
  });

  it('replaces the node of a node item by id', () => {
    const oldNode = document.createElement('span');
    oldNode.textContent = 'old';
    menu = new Pielet({ items: [{ typeContent: 'node', content: oldNode, id: 'node' }] });
    menu.open(300, 300);
    const replacement = document.createElement('strong');
    replacement.textContent = 'new';
    menu.setItemContent('node', replacement);
    const caption = document.querySelector('.pielet__item-caption');
    expect(caption.contains(replacement)).toBe(true);
    expect(caption.contains(oldNode)).toBe(false);
  });

  it('throws when the menu is not open', () => {
    menu = new Pielet({ items: [{ typeContent: 'text', content: 'A', id: 'a' }] });
    expect(() => menu.setItemContent('a', 'B')).toThrow(/open menu/);
  });

  it('throws when the id is unknown', () => {
    menu = makeMenu();
    menu.open(300, 300);
    expect(() => menu.setItemContent('missing', 'X')).toThrow(/no item with id/i);
  });

  it('throws for a none item', () => {
    menu = makeMenu();
    menu.open(300, 300);
    const noneId = menu.config.items[2].id;
    expect(() => menu.setItemContent(noneId, 'X')).toThrow(/none/i);
  });

  it('throws when the new content type mismatches a text item', () => {
    menu = new Pielet({ items: [{ typeContent: 'text', content: 'A', id: 'a' }] });
    menu.open(300, 300);
    expect(() => menu.setItemContent('a', document.createElement('div'))).toThrow(/string/i);
  });

  it('throws when the new content is an empty string for a text item', () => {
    menu = new Pielet({ items: [{ typeContent: 'text', content: 'A', id: 'a' }] });
    menu.open(300, 300);
    expect(() => menu.setItemContent('a', '')).toThrow(/string/i);
  });

  it('throws when the new content type mismatches a node item', () => {
    menu = new Pielet({ items: [{ typeContent: 'node', content: document.createElement('span'), id: 'n' }] });
    menu.open(300, 300);
    expect(() => menu.setItemContent('n', 'not a node')).toThrow(/Node/i);
  });

  it('works from the action of a keepOpen item and leaves the menu open', () => {
    menu = new Pielet({
      interactionMode: 'click',
      items: [
        { typeContent: 'text', content: 'Old', id: 'keep', keepOpen: true, action: (id) => menu.setItemContent(id, 'New') },
        { typeContent: 'text', content: 'Other' }
      ]
    });
    menu.open(300, 300);
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 400, clientY: 300 }));
    const textEls = document.querySelectorAll('.pielet__content--text');
    expect(textEls[0].textContent).toBe('New');
    expect(document.body.querySelector('.pielet')).toBeTruthy();
  });
});

describe('Pielet — counterclockwise near viewport edges', () => {
  function setViewport(width, height) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  }

  function clipPoints() {
    const menuEl = document.querySelector('.pielet');
    const originX = Number.parseInt(menuEl.style.left, 10);
    const originY = Number.parseInt(menuEl.style.top, 10);
    return Array.from(document.querySelectorAll('.pielet__item')).flatMap((el) => {
      const raw = el.style.clipPath;
      if (!raw || raw.slice(0, 8) !== 'polygon(') return [];
      const inner = raw.slice(raw.indexOf('(') + 1, raw.lastIndexOf(')'));
      return inner.split(',').map((t) => {
        const [x, y] = t.trim().split(' ').map(parseFloat);
        return [originX + x, originY + y];
      });
    });
  }

  it('counterclockwise near the left edge: all sector points stay inside the viewport', () => {
    setViewport(1024, 768);
    menu = new Pielet({ items, direction: 'counterclockwise' });
    menu.open(80, 384);
    const points = clipPoints();
    expect(points.length).toBeGreaterThan(0);
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1024);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(768);
    }
  });

  it('counterclockwise near the top edge: all sector points stay inside the viewport', () => {
    setViewport(1024, 768);
    menu = new Pielet({ items, direction: 'counterclockwise' });
    menu.open(512, 80);
    const points = clipPoints();
    expect(points.length).toBeGreaterThan(0);
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1024);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(768);
    }
  });
});

describe('Pielet — single active menu across instances', () => {
  it('opening a second instance closes the first one (one DOM menu only)', async () => {
    const first = new Pielet({ items });
    const second = new Pielet({ items });
    const firstClosed = vi.fn();
    first.addEventListener('close', firstClosed);
    first.open(200, 200);
    expect(document.body.querySelectorAll('.pielet')).toHaveLength(1);
    second.open(600, 600);
    expect(document.body.querySelectorAll('.pielet')).toHaveLength(1);
    expect(firstClosed).toHaveBeenCalledTimes(1);
    menu = second;
  });

  it('reopening the same instance while open replaces the runtime', async () => {
    menu = makeMenu();
    menu.open(200, 200);
    menu.open(700, 100);
    await sleep(30);
    expect(document.body.querySelectorAll('.pielet')).toHaveLength(1);
    const el = document.body.querySelector('.pielet');
    expect(el.style.left).toBe('580px');
  });

  it('reopening while open replaces silently, final close emits a single close event', async () => {
    const onClose = vi.fn();
    menu = makeMenu();
    menu.addEventListener('close', onClose);
    menu.open(200, 200);
    menu.open(700, 100);
    expect(onClose).toHaveBeenCalledTimes(0);
    await sleep(30);
    menu.close();
    await sleep(400);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Pielet — viewport changes close the menu', () => {
  it('scroll closes the menu immediately', async () => {
    menu = makeMenu();
    menu.open(200, 200);
    await sleep(30);
    document.dispatchEvent(new Event('scroll'));
    expect(document.body.querySelector('.pielet')).toBeNull();
  });

  it('window resize closes the menu immediately', async () => {
    menu = makeMenu();
    menu.open(200, 200);
    await sleep(30);
    window.dispatchEvent(new Event('resize'));
    expect(document.body.querySelector('.pielet')).toBeNull();
  });

  it('closes on scroll and does not fire close twice', async () => {
    menu = makeMenu();
    const onClose = vi.fn();
    menu.addEventListener('close', onClose);
    menu.open(200, 200);
    await sleep(30);
    document.dispatchEvent(new Event('scroll'));
    document.dispatchEvent(new Event('scroll'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});