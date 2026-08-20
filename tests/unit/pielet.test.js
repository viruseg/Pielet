// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Pielet from '../../src/pielet.js';

function makeMenu(overrides = {}) {
  return new Pielet({
    items: [{ typeContent: 'text', content: 'Root' }],
    ...overrides
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Pielet — submenu opening (click pipeline)', () => {
  let menu;

  beforeEach(() => {
    menu = null;
  });

  afterEach(async () => {
    if (menu) {
      menu.close();
      await sleep(400);
    }
    document.body.innerHTML = '';
  });

  it('opens the submenu at the click coords when a submenu item is selected', () => {
    const sub = makeMenu();
    const openSpy = vi.spyOn(sub, 'open');
    menu = new Pielet({
      items: [{ typeContent: 'text', content: 'More', isSubMenu: true, menu: sub }]
    });
    menu.open(300, 300);
    window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 301, clientY: 380 }));
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 301, clientY: 380 }));
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(301, 380);
  });

  it('does not open a submenu when a plain item is selected', () => {
    const sub = makeMenu();
    const openSpy = vi.spyOn(sub, 'open');
    const action = vi.fn();
    menu = new Pielet({
      items: [{ typeContent: 'text', content: 'Leaf', action }]
    });
    menu.open(300, 300);
    window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 301, clientY: 380 }));
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 301, clientY: 380 }));
    expect(openSpy).not.toHaveBeenCalled();
    expect(action).toHaveBeenCalledTimes(1);
  });
});