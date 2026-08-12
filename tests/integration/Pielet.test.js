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
    window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 300, clientY: 200 }));
    expect(document.querySelectorAll('.pielet__item--hover').length).toBe(0);
    // наведение на сектор 1 (text, справа) подсвечивает его
    window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 378, clientY: 300 }));
    expect(document.querySelectorAll('.pielet__item--hover').length).toBe(1);
    expect(document.querySelector('.pielet__item--hover').getAttribute('style')).toContain('clip-path');
    window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 300, clientY: 200 }));
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
    // сектор 0 начинается сверху при startAngle -90: указатель сверху от центра
    window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 300, clientY: 220 }));
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 300, clientY: 220 }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(log).toEqual(['select', 'close', 'action', 'dom-gone:true']);
    expect(document.body.querySelector('.pielet')).toBeNull();
  });

  it('closes (no select) on pointerup in the center or gap', async () => {
    const log = [];
    const action = vi.fn();
    menu = new Pielet({
      items: [
        { typeContent: 'text', content: 'A', action },
        { typeContent: 'text', content: 'B' }
      ]
    });
    menu.addEventListener('select', () => log.push('select'));
    menu.open(300, 300);
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 300, clientY: 300 }));
    expect(action).not.toHaveBeenCalled();
    expect(log).toEqual([]);
    await sleep(400);
    expect(document.body.querySelector('.pielet')).toBeNull();
    expect(menu.close).toBeDefined();
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

  it('opens another menu from an action without runtime conflicts', () => {
    menu = new Pielet({
      items: [{ typeContent: 'text', content: 'A', action: () => second.open(600, 150) }]
    });
    const second = new Pielet({ items: [{ typeContent: 'text', content: 'B' }] });
    menu.open(300, 300);
    window.dispatchEvent(new MouseEvent('pointerup', {
      bubbles: true,
      button: 0,
      clientX: 300,
      clientY: 250
    }));
    expect(document.body.querySelectorAll('.pielet')).toHaveLength(1);
    const secondEl = document.body.querySelector('.pielet');
    expect(secondEl.style.left).toBe('480px');
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