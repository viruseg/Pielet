// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { createContentContainer, fitText } from '../../../src/rendering/ContentRenderer.js';

const sector = { availWidth: 200, availHeight: 70 };

afterEach(() => {
  document.body.innerHTML = '';
});

describe('createContentContainer', () => {
  it('text: creates a div with the given text', () => {
    const el = createContentContainer({ typeContent: 'text', content: 'Open' }, sector);
    expect(el.tagName).toBe('DIV');
    expect(el.className).toBe('pielet__content--text');
    expect(el.textContent).toBe('Open');
  });

  it('text: constrains the box with max sizes only (no fixed width/height)', () => {
    const el = createContentContainer({ typeContent: 'text', content: 'Open' }, sector);
    expect(el.style.maxWidth).toBe('200px');
    expect(el.style.maxHeight).toBe('70px');
    expect(el.style.width).toBe('');
    expect(el.style.height).toBe('');
  });

  it('text: does not fit the font before mounting (fitText runs after DOM insertion)', () => {
    const el = createContentContainer({ typeContent: 'text', content: 'Open' }, sector);
    expect(el.style.fontSize).toBe('');
  });

  it('image: creates an img with a definite box (explicit width/height), never zero-sized', () => {
    const el = createContentContainer({ typeContent: 'image', content: '/icons/open.svg' }, sector);
    expect(el.tagName).toBe('IMG');
    expect(el.className).toBe('pielet__content--image');
    expect(el.getAttribute('src')).toBe('/icons/open.svg');
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('70px');
  });

  it('node: returns the very same node without cloning or modification', () => {
    const node = document.createElement('div');
    node.id = 'supplied';
    node.textContent = 'custom';
    const result = createContentContainer({ typeContent: 'node', content: node }, sector);
    expect(result).toBe(node);
    expect(node.id).toBe('supplied');
    expect(node.hasAttribute('class')).toBe(false);
    expect(node.textContent).toBe('custom');
  });

  it('none: returns null', () => {
    expect(createContentContainer({ typeContent: 'none' }, sector)).toBeNull();
  });
});

describe('fitText', () => {
  function makeBox() {
    const el = document.createElement('div');
    document.body.appendChild(el);
    return el;
  }

  // scrollWidth/scrollHeight линейно зависят от font-size, чтобы симулировать layout.
  function mockLinear(el, { w, h }) {
    Object.defineProperty(el, 'scrollWidth', {
      configurable: true,
      get() {
        return Math.round(w * Number(el.style.fontSize.slice(0, -2) || 0));
      }
    });
    Object.defineProperty(el, 'scrollHeight', {
      configurable: true,
      get() {
        return Math.round(h * Number(el.style.fontSize.slice(0, -2) || 0));
      }
    });
  }

  it('grows short text to fill the box (width or height becomes the limit)', () => {
    const el = makeBox();
    // высота ограничивает: 1.5 * size <= 70 -> size <= 46 (дробно 46.67 -> 46)
    mockLinear(el, { w: 0.5, h: 1.5 });
    fitText(el, 200, 70, 8, 24);
    const size = Number(el.style.fontSize.slice(0, -2));
    expect(size).toBeGreaterThan(8);
    expect(1.5 * size).toBeLessThanOrEqual(70);
    expect(0.5 * size).toBeLessThanOrEqual(200);
    // растёт до упора: следующий px уже выходит за высоту
    expect(1.5 * (size + 1)).toBeGreaterThan(70);
  });

  it('shrinks long text to the largest size that fits the box', () => {
    const el = makeBox();
    // ширина ограничивает: 3 * size <= 200 -> size <= 66 (дробно 66.67 -> 66)
    mockLinear(el, { w: 3, h: 0.4 });
    fitText(el, 200, 70, 8, 24);
    const size = Number(el.style.fontSize.slice(0, -2));
    expect(size).toBeGreaterThan(8);
    expect(3 * size).toBeLessThanOrEqual(200);
    expect(3 * (size + 1)).toBeGreaterThan(200);
  });

  it('never grows below the minimum font size when content overflows everything', () => {
    const el = makeBox();
    mockLinear(el, { w: 100, h: 100 });
    fitText(el, 10, 10, 8, 24);
    expect(Number(el.style.fontSize.slice(0, -2))).toBe(8);
  });

  it('keeps the minimum font size when the box is extremely small', () => {
    const el = makeBox();
    mockLinear(el, { w: 1, h: 1 });
    fitText(el, 2, 2, 8, 24);
    expect(Number(el.style.fontSize.slice(0, -2))).toBe(8);
  });
});