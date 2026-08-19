// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../../../src/config/defaults.js';
import { normalizeConfig, validateConfig } from '../../../src/config/validateConfig.js';

const validItems = [
  { typeContent: 'text', content: 'Open', action: () => {} },
  { typeContent: 'none' },
  { typeContent: 'image', content: '/icons/delete.svg' },
  { typeContent: 'node', content: document.createElement('div') }
];

const submenuStub = { open: () => {} };

describe('DEFAULT_CONFIG', () => {
  it('has exactly the documented defaults', () => {
    expect(DEFAULT_CONFIG).toEqual({
      size: 240,
      centerSize: 72,
      gap: 4,
      startAngle: -90,
      direction: 'clockwise',
      interactionMode: 'click',
      button: 'left',
      closeDistance: 48,
      fit: 'circle',
      unifyText: false,
      submenuDelay: 400,
      submenuIndicator: 'both'
    });
  });

  it('does not contain visual values', () => {
    expect(DEFAULT_CONFIG).not.toHaveProperty('background');
    expect(DEFAULT_CONFIG).not.toHaveProperty('opacity');
    expect(DEFAULT_CONFIG).not.toHaveProperty('transitionDuration');
  });
});

describe('normalizeConfig', () => {
  it('fills defaults for missing values', () => {
    const config = normalizeConfig({ items: [{ typeContent: 'text', content: 'A' }] });
    expect(config.size).toBe(240);
    expect(config.centerSize).toBe(72);
    expect(config.gap).toBe(4);
    expect(config.startAngle).toBe(-90);
    expect(config.direction).toBe('clockwise');
    expect(config.interactionMode).toBe('click');
    expect(config.button).toBe('left');
    expect(config.closeDistance).toBe(48);
    expect(config.fit).toBe('circle');
    expect(config.unifyText).toBe(false);
    expect(config.submenuDelay).toBe(400);
    expect(config.submenuIndicator).toBe('both');
  });

  it('keeps user values', () => {
    const config = normalizeConfig({
      size: 300,
      centerSize: 50,
      gap: 8,
      startAngle: 30,
      direction: 'counterclockwise',
      interactionMode: 'hold',
      button: 'right',
      closeDistance: 60,
      fit: 'square',
      unifyText: true,
      submenuDelay: 250,
      submenuIndicator: 'chevron',
      items: validItems
    });
    expect(config.size).toBe(300);
    expect(config.centerSize).toBe(50);
    expect(config.gap).toBe(8);
    expect(config.startAngle).toBe(30);
    expect(config.direction).toBe('counterclockwise');
    expect(config.interactionMode).toBe('hold');
    expect(config.button).toBe('right');
    expect(config.closeDistance).toBe(60);
    expect(config.fit).toBe('square');
    expect(config.unifyText).toBe(true);
    expect(config.submenuDelay).toBe(250);
    expect(config.submenuIndicator).toBe('chevron');
  });

  it('throws on an empty config object — items is required', () => {
    expect(() => normalizeConfig({})).toThrow(/items/);
  });
});

describe('validateConfig errors', () => {
  const cases = [
    ['size <= 0', { size: 0 }],
    ['size negative', { size: -10 }],
    ['size NaN', { size: NaN }],
    ['centerSize <= 0', { centerSize: 0 }],
    ['centerSize negative', { centerSize: -5 }],
    ['centerSize >= size', { size: 120, centerSize: 240 }],
    ['centerSize NaN', { centerSize: NaN }],
    ['gap negative', { gap: -1 }],
    ['gap NaN', { gap: NaN }],
    ['startAngle NaN', { startAngle: NaN }],
    ['unknown direction', { direction: 'diagonal' }],
    ['unknown interactionMode', { interactionMode: 'doubleclick' }],
    ['button unknown name', { button: 'abc' }],
    ['button numeric', { button: 0 }],
    ['button wrong case', { button: 'LEFT' }],
    ['closeDistance negative', { closeDistance: -1 }],
    ['closeDistance NaN', { closeDistance: NaN }],
    ['unknown fit', { fit: 'ellipse' }],
    ['fit wrong case', { fit: 'Circle' }],
    ['unifyText string', { unifyText: 'yes' }],
    ['unifyText numeric', { unifyText: 1 }]
  ];

  for (const [label, partial] of cases) {
    it(`throws on ${label}`, () => {
      expect(() => validateConfig({ items: validItems, ...partial })).toThrow(/Pielet config error/);
    });
  }

  it('throws when items is missing', () => {
    expect(() => validateConfig({})).toThrow(/items/);
  });

  it('throws when items is empty', () => {
    expect(() => validateConfig({ items: [] })).toThrow(/items/);
  });

  it('throws when items is not an array', () => {
    expect(() => validateConfig({ items: 'nope' })).toThrow(/items/);
  });

  it('throws on unknown typeContent', () => {
    expect(() =>
      validateConfig({ items: [{ typeContent: 'html', content: '<b>x</b>' }] })
    ).toThrow(/typeContent/);
  });

  it('throws when text content is missing', () => {
    expect(() => validateConfig({ items: [{ typeContent: 'text' }] })).toThrow(/content/);
  });

  it('throws when text content is empty', () => {
    expect(() => validateConfig({ items: [{ typeContent: 'text', content: '' }] })).toThrow(/content/);
  });

  it('throws when image content is missing', () => {
    expect(() => validateConfig({ items: [{ typeContent: 'image' }] })).toThrow(/content/);
  });

  it('throws when node content is not a Node', () => {
    expect(() => validateConfig({ items: [{ typeContent: 'node', content: 'not a node' }] })).toThrow(/content/);
  });

  it('throws when action is not a function', () => {
    expect(() =>
      validateConfig({ items: [{ typeContent: 'text', content: 'A', action: 'click' }] })
    ).toThrow(/action/);
  });

  it('throws when keepOpen is not a boolean', () => {
    expect(() =>
      validateConfig({ items: [{ typeContent: 'text', content: 'A', keepOpen: 'yes' }] })
    ).toThrow(/keepOpen/);
  });

  it('throws when submenuDelay is negative', () => {
    expect(() => validateConfig({ items: validItems, submenuDelay: -1 })).toThrow(/submenuDelay/);
  });

  it('throws when submenuDelay is NaN', () => {
    expect(() => validateConfig({ items: validItems, submenuDelay: NaN })).toThrow(/submenuDelay/);
  });

  it('throws when submenuDelay is not a number', () => {
    expect(() => validateConfig({ items: validItems, submenuDelay: '400' })).toThrow(/submenuDelay/);
  });

  it('throws when submenuIndicator is unknown', () => {
    for (const bad of ['none', 'both-ish', 'arc chevron', 42, true, null]) {
      expect(() => validateConfig({ items: validItems, submenuIndicator: bad })).toThrow(/submenuIndicator/);
    }
  });

  it('throws when isSubMenu is not a boolean', () => {
    expect(() =>
      validateConfig({ items: [{ typeContent: 'text', content: 'A', isSubMenu: 'yes' }] })
    ).toThrow(/isSubMenu/);
  });

  it('throws when isSubMenu item has typeContent none', () => {
    expect(() =>
      validateConfig({ items: [{ typeContent: 'none', isSubMenu: true, menu: submenuStub }] })
    ).toThrow(/isSubMenu/);
  });

  it('throws when isSubMenu item has no menu', () => {
    expect(() =>
      validateConfig({ items: [{ typeContent: 'text', content: 'A', isSubMenu: true }] })
    ).toThrow(/menu/);
  });

  it('throws when isSubMenu item menu lacks an open function', () => {
    expect(() =>
      validateConfig({ items: [{ typeContent: 'text', content: 'A', isSubMenu: true, menu: { close: () => {} } }] })
    ).toThrow(/menu/);
  });
});

describe('validateConfig valid inputs', () => {
  it('accepts none items without content', () => {
    expect(() => validateConfig({ items: [{ typeContent: 'none' }, { typeContent: 'none' }] })).not.toThrow();
  });

  it('ignores content for none items', () => {
    const config = normalizeConfig({ items: [{ typeContent: 'none', content: 'ignored' }] });
    expect(config.items[0].typeContent).toBe('none');
  });

  it('accepts missing action', () => {
    expect(() => validateConfig({ items: [{ typeContent: 'text', content: 'A' }] })).not.toThrow();
  });

  it('accepts every named mouse button', () => {
    for (const name of ['left', 'middle', 'right', 'back', 'forward']) {
      expect(() => validateConfig({ items: validItems, button: name })).not.toThrow();
      expect(normalizeConfig({ items: validItems, button: name }).button).toBe(name);
    }
  });

  it('accepts boundary sizes', () => {
    expect(() => validateConfig({ items: validItems, size: 240, centerSize: 239.9 })).not.toThrow();
    expect(() => validateConfig({ items: validItems, gap: 0, closeDistance: 0 })).not.toThrow();
  });

  it('accepts centerSize without size (defaults applied later in normalizeConfig)', () => {
    expect(() => validateConfig({ items: validItems, centerSize: 72 })).not.toThrow();
    expect(normalizeConfig({ items: validItems, centerSize: 72 }).size).toBe(240);
    expect(normalizeConfig({ items: validItems, centerSize: 72 }).centerSize).toBe(72);
  });

  it('keeps the less-than-size error message when size is present', () => {
    expect(() => validateConfig({ items: validItems, size: 120, centerSize: 121 }))
      .toThrow(/centerSize must be a number greater than 0 and less than size \(120\)/);
  });

  it('normalizes items preserving order', () => {
    const items = [{ typeContent: 'text', content: 'first' }, { typeContent: 'none' }, { typeContent: 'text', content: 'last' }];
    const config = normalizeConfig({ items });
    expect(config.items.map((i) => i.content)).toEqual(['first', undefined, 'last']);
  });

  it('accepts keepOpen as a boolean', () => {
    expect(() => validateConfig({ items: [{ typeContent: 'text', content: 'A', keepOpen: true }] })).not.toThrow();
    expect(() => validateConfig({ items: [{ typeContent: 'text', content: 'A', keepOpen: false }] })).not.toThrow();
  });

  it('accepts every named fit value', () => {
    for (const fit of ['circle', 'square']) {
      expect(() => validateConfig({ items: validItems, fit })).not.toThrow();
      expect(normalizeConfig({ items: validItems, fit }).fit).toBe(fit);
    }
  });

  it('accepts unifyText as a boolean and normalizes it', () => {
    expect(() => validateConfig({ items: validItems, unifyText: true })).not.toThrow();
    expect(() => validateConfig({ items: validItems, unifyText: false })).not.toThrow();
    expect(normalizeConfig({ items: validItems, unifyText: true }).unifyText).toBe(true);
    expect(normalizeConfig({ items: validItems, unifyText: false }).unifyText).toBe(false);
  });

  it('accepts submenuDelay of 0 (disables hover-open) and normalizes it', () => {
    expect(() => validateConfig({ items: validItems, submenuDelay: 0 })).not.toThrow();
    expect(normalizeConfig({ items: validItems, submenuDelay: 0 }).submenuDelay).toBe(0);
  });

  it('accepts every submenuIndicator value and normalizes it', () => {
    for (const value of ['arc', 'chevron', 'both']) {
      expect(() => validateConfig({ items: validItems, submenuIndicator: value })).not.toThrow();
      expect(normalizeConfig({ items: validItems, submenuIndicator: value }).submenuIndicator).toBe(value);
    }
  });

  it('accepts an isSubMenu item with a menu that has open', () => {
    const item = { typeContent: 'text', content: 'More', isSubMenu: true, menu: submenuStub };
    expect(() => validateConfig({ items: [item] })).not.toThrow();
    const config = normalizeConfig({ items: [item] });
    expect(config.items[0].isSubMenu).toBe(true);
    expect(config.items[0].menu).toBe(submenuStub);
  });

  it('accepts isSubMenu false without a menu', () => {
    expect(() =>
      validateConfig({ items: [{ typeContent: 'text', content: 'A', isSubMenu: false }] })
    ).not.toThrow();
  });

  it('normalizes items preserving isSubMenu and menu', () => {
    const config = normalizeConfig({ items: [{ typeContent: 'text', content: 'A', isSubMenu: true, menu: submenuStub }] });
    expect(config.items[0].isSubMenu).toBe(true);
    expect(config.items[0].menu).toBe(submenuStub);
  });

  it('normalizes items preserving keepOpen', () => {
    const config = normalizeConfig({ items: [{ typeContent: 'text', content: 'A', keepOpen: true }] });
    expect(config.items[0].keepOpen).toBe(true);
  });
});

describe('item id handling', () => {
  it('assigns a generated id to items without id', () => {
    const config = normalizeConfig({ items: [{ typeContent: 'text', content: 'A' }] });
    expect(config.items[0].id).toMatch(/^pielet-\d+-\d+$/);
  });

  it('generated ids are unique within one normalization', () => {
    const config = normalizeConfig({
      items: [{ typeContent: 'text', content: 'A' }, { typeContent: 'text', content: 'B' }, { typeContent: 'none' }]
    });
    const ids = config.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^pielet-\d+-\d+$/));
  });

  it('preserves explicitly provided id', () => {
    const config = normalizeConfig({ items: [{ typeContent: 'text', content: 'A', id: 'copy' }] });
    expect(config.items[0].id).toBe('copy');
  });

  it('regenerates generated ids on each normalizeConfig call', () => {
    const items = [{ typeContent: 'text', content: 'A' }];
    const first = normalizeConfig({ items });
    const second = normalizeConfig({ items });
    expect(first.items[0].id).not.toBe(second.items[0].id);
  });

  it('does not mutate the source item objects', () => {
    const items = [{ typeContent: 'text', content: 'A' }];
    normalizeConfig({ items });
    expect(items[0]).not.toHaveProperty('id');
  });

  it('throws when id is empty', () => {
    expect(() =>
      validateConfig({ items: [{ typeContent: 'text', content: 'A', id: '' }] })
    ).toThrow(/id/);
  });

  it('throws when id is not a string', () => {
    expect(() =>
      validateConfig({ items: [{ typeContent: 'text', content: 'A', id: 1 }] })
    ).toThrow(/id/);
  });
});

describe('availableArc validation', () => {
  it('accepts every named half and quarter', () => {
    for (const part of ['right', 'bottom', 'left', 'top', 'top-right', 'bottom-right', 'bottom-left', 'top-left']) {
      expect(() => validateConfig({ items: validItems, availableArc: [part] })).not.toThrow();
    }
  });

  it('accepts overlapping parts that form a continuous arc', () => {
    expect(() => validateConfig({ items: validItems, availableArc: ['top', 'right'] })).not.toThrow();
    expect(() => validateConfig({ items: validItems, availableArc: ['right', 'bottom', 'top'] })).not.toThrow();
    expect(() => validateConfig({ items: validItems, availableArc: ['bottom-left', 'top-left'] })).not.toThrow();
  });

  it('accepts parts covering the full circle', () => {
    expect(() => validateConfig({ items: validItems, availableArc: ['right', 'left'] })).not.toThrow();
    expect(() => validateConfig({ items: validItems, availableArc: ['top', 'bottom'] })).not.toThrow();
    expect(() =>
      validateConfig({ items: validItems, availableArc: ['top-right', 'bottom-right', 'bottom-left', 'top-left'] })
    ).not.toThrow();
  });

  it('accepts repeated parts', () => {
    expect(() => validateConfig({ items: validItems, availableArc: ['right', 'right'] })).not.toThrow();
  });

  it('throws on disjoint parts', () => {
    expect(() => validateConfig({ items: validItems, availableArc: ['top-left', 'bottom-right'] })).toThrow(/availableArc/);
    expect(() => validateConfig({ items: validItems, availableArc: ['bottom-left', 'top-right'] })).toThrow(/availableArc/);
  });

  it('throws on an empty array', () => {
    expect(() => validateConfig({ items: validItems, availableArc: [] })).toThrow(/availableArc/);
  });

  it('throws on a non-array', () => {
    for (const bad of ['right', 1, true, { top: 1 }, null]) {
      expect(() => validateConfig({ items: validItems, availableArc: bad })).toThrow(/availableArc/);
    }
  });

  it('throws on unknown or non-string parts', () => {
    for (const bad of [['sideways'], ['Right'], ['top', 1]]) {
      expect(() => validateConfig({ items: validItems, availableArc: bad })).toThrow(/availableArc/);
    }
  });

  it('normalizes availableArc', () => {
    const config = normalizeConfig({ items: validItems, availableArc: ['top', 'right'] });
    expect(config.availableArc).toEqual(['top', 'right']);
  });

  it('leaves availableArc undefined when not provided', () => {
    const config = normalizeConfig({ items: validItems });
    expect(config.availableArc).toBeUndefined();
  });
});