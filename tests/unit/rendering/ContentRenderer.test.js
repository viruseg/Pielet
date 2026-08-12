// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { createContentContainer, fitText } from '../../../src/rendering/ContentRenderer.js';

const sector = { availWidth: 200, availHeight: 70 };

afterEach(() => {
  document.body.innerHTML = '';
});

describe('createContentContainer', () => {
  it('text: creates a div with the given text', () => {
    const el = createContentContainer({ typeContent: 'text', content: 'Open' }, sector, 14);
    expect(el.tagName).toBe('DIV');
    expect(el.className).toBe('pielet__content--text');
    expect(el.textContent).toBe('Open');
  });

  it('text: sizes the box to the available area', () => {
    const el = createContentContainer({ typeContent: 'text', content: 'Open' }, sector, 14);
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('70px');
  });

  it('text: starts at the base font size', () => {
    const el = createContentContainer({ typeContent: 'text', content: 'Open' }, sector, 33);
    expect(el.style.fontSize).toBe('33px');
  });

  it('image: creates an img with src and contain-fit constraints', () => {
    const el = createContentContainer({ typeContent: 'image', content: '/icons/open.svg' }, sector, 14);
    expect(el.tagName).toBe('IMG');
    expect(el.className).toBe('pielet__content--image');
    expect(el.getAttribute('src')).toBe('/icons/open.svg');
    expect(el.style.maxWidth).toBe('200px');
    expect(el.style.maxHeight).toBe('70px');
  });

  it('node: returns the very same node without cloning or modification', () => {
    const node = document.createElement('div');
    node.id = 'supplied';
    node.textContent = 'custom';
    const result = createContentContainer({ typeContent: 'node', content: node }, sector, 14);
    expect(result).toBe(node);
    expect(node.id).toBe('supplied');
    expect(node.hasAttribute('class')).toBe(false);
    expect(node.textContent).toBe('custom');
  });

  it('none: returns null', () => {
    expect(createContentContainer({ typeContent: 'none' }, sector, 14)).toBeNull();
  });
});

describe('fitText', () => {
  function makeBox(availWidth, availHeight) {
    const el = document.createElement('div');
    el.style.cssText = `width: ${availWidth}px; height: ${availHeight}px; overflow: hidden;`;
    el.textContent = 'Some long label text';
    document.body.appendChild(el);
    return el;
  }

  it('shrinks font while content overflows, down to the minimum', () => {
    const el = makeBox(200, 70);
    Object.defineProperty(el, 'scrollWidth', { value: 500, configurable: true });
    Object.defineProperty(el, 'scrollHeight', { value: 400, configurable: true });
    fitText(el, 200, 70, 20, 8, 24);
    expect(el.style.fontSize).toBe('8px');
  });

  it('shrinks only until content fits', () => {
    const el = makeBox(200, 70);
    // шрифт 12px помещается при 10px, не при 12 и 11
    let fc = 0;
    Object.defineProperty(el, 'scrollWidth', {
      configurable: true,
      get() {
        fc++;
        return Number(this.style.fontSize.slice(0, -2)) > 10 ? 400 : 180;
      }
    });
    Object.defineProperty(el, 'scrollHeight', {
      configurable: true,
      get() {
        return Number(this.style.fontSize.slice(0, -2)) > 10 ? 300 : 60;
      }
    });
    fitText(el, 200, 70, 12, 8, 24);
    expect(el.style.fontSize).toBe('10px');
    expect(fc).toBeLessThan(8);
  });

  it('keeps the base size when content already fits', () => {
    const el = makeBox(200, 70);
    Object.defineProperty(el, 'scrollWidth', { value: 100, configurable: true });
    Object.defineProperty(el, 'scrollHeight', { value: 40, configurable: true });
    fitText(el, 200, 70, 18, 8, 24);
    expect(el.style.fontSize).toBe('18px');
  });

  it('never goes below the minimum font size', () => {
    const el = makeBox(10, 10);
    Object.defineProperty(el, 'scrollWidth', { value: 5000, configurable: true });
    Object.defineProperty(el, 'scrollHeight', { value: 5000, configurable: true });
    fitText(el, 10, 10, 16, 8, 24);
    expect(Number(el.style.fontSize.slice(0, -2))).toBeGreaterThanOrEqual(8);
  });

  it('stops after max iterations', () => {
    const el = makeBox(1, 1);
    let reads = 0;
    Object.defineProperty(el, 'scrollWidth', {
      configurable: true,
      get() {
        reads++;
        return 999999;
      }
    });
    Object.defineProperty(el, 'scrollHeight', {
      configurable: true,
      get() {
        return 999999;
      }
    });
    fitText(el, 1, 1, 30, 1, 5);
    expect(Number(el.style.fontSize.slice(0, -2))).toBe(25);
    expect(reads).toBe(5);
  });
});