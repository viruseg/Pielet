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
      button: 0,
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
    expect(config.button).toBe(0);
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
      button: 2,
      closeDistance: 60,
      items: validItems
    });
    expect(config.size).toBe(300);
    expect(config.centerSize).toBe(50);
    expect(config.gap).toBe(8);
    expect(config.startAngle).toBe(30);
    expect(config.direction).toBe('counterclockwise');
    expect(config.interactionMode).toBe('hold');
    expect(config.button).toBe(2);
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
    ['button negative', { button: -1 }],
    ['button too large', { button: 6 }],
    ['button float', { button: 1.5 }],
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

  it('accepts boundary sizes', () => {
    expect(() => validateConfig({ items: validItems, size: 240, centerSize: 239.9 })).not.toThrow();
    expect(() => validateConfig({ items: validItems, gap: 0, closeDistance: 0 })).not.toThrow();
  });

  it('normalizes items preserving order', () => {
    const items = [{ typeContent: 'text', content: 'first' }, { typeContent: 'none' }, { typeContent: 'text', content: 'last' }];
    const config = normalizeConfig({ items });
    expect(config.items.map((i) => i.content)).toEqual(['first', undefined, 'last']);
  });
});