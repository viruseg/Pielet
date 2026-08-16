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
      closeDistance: 48
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
    ['centerSize >= size', { centerSize: 240 }],
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
    ['closeDistance NaN', { closeDistance: NaN }]
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

  it('normalizes items preserving order', () => {
    const items = [{ typeContent: 'text', content: 'first' }, { typeContent: 'none' }, { typeContent: 'text', content: 'last' }];
    const config = normalizeConfig({ items });
    expect(config.items.map((i) => i.content)).toEqual(['first', undefined, 'last']);
  });

  it('accepts keepOpen as a boolean', () => {
    expect(() => validateConfig({ items: [{ typeContent: 'text', content: 'A', keepOpen: true }] })).not.toThrow();
    expect(() => validateConfig({ items: [{ typeContent: 'text', content: 'A', keepOpen: false }] })).not.toThrow();
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