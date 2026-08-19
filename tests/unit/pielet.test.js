// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Pielet from '../../src/pielet.js';

function makeMenu(overrides = {}) {
  return new Pielet({
    items: [{ typeContent: 'text', content: 'Root' }],
    ...overrides
  });
}

describe('Pielet._openSubmenu', () => {
  let menu;

  beforeEach(() => {
    menu = makeMenu();
  });

  it('opens the submenu when the item is a submenu and the point is valid', () => {
    const sub = makeMenu();
    const openSpy = vi.spyOn(sub, 'open');
    const item = { typeContent: 'text', content: 'Sub', isSubMenu: true, menu: sub };
    menu._openSubmenu(item, { x: 10, y: 20 });
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(10, 20);
  });

  it('does nothing for a non-submenu item even with a valid point', () => {
    const sub = makeMenu();
    const openSpy = vi.spyOn(sub, 'open');
    const item = { typeContent: 'text', content: 'Leaf', menu: sub };
    menu._openSubmenu(item, { x: 10, y: 20 });
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('does nothing for an undefined item', () => {
    expect(() => menu._openSubmenu(undefined, { x: 10, y: 20 })).not.toThrow();
  });

  it('does nothing when the point is missing or non-numeric', () => {
    const sub = makeMenu();
    const openSpy = vi.spyOn(sub, 'open');
    const item = { typeContent: 'text', content: 'Sub', isSubMenu: true, menu: sub };
    menu._openSubmenu(item, undefined);
    menu._openSubmenu(item, null);
    menu._openSubmenu(item, { x: '10', y: 20 });
    menu._openSubmenu(item, { x: 10 });
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('does nothing when the submenu has no open method', () => {
    const item = { typeContent: 'text', content: 'Sub', isSubMenu: true, menu: {} };
    expect(() => menu._openSubmenu(item, { x: 10, y: 20 })).not.toThrow();
  });
});