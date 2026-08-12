// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MenuRenderer } from '../../../src/rendering/MenuRenderer.js';
import { calculateSectorLayout } from '../../../src/geometry/calculateSector.js';

const TAU = Math.PI * 2;

const items = [
  { typeContent: 'text', content: 'Open' },
  { typeContent: 'none' },
  { typeContent: 'image', content: '/icons/delete.svg' },
  { typeContent: 'text', content: 'Save' }
];

function makeGeometry({ itemCount = 4, arcStart = 0, arcLength = TAU, direction = 'clockwise', gap = 0 } = {}) {
  const outerRadius = 100;
  const innerRadius = 30;
  const { sectors } = calculateSectorLayout({
    itemCount,
    arcStart,
    arcLength,
    outerRadius: 100,
    meanRadius: 65,
    ringWidth: 70,
    gap,
    direction
  });
  return { outerRadius, innerRadius, closeDistance: 40, arcStart, arcLength, direction, sectors };
}

let renderer;

beforeEach(() => {
  renderer = new MenuRenderer();
});

afterEach(() => {
  if (renderer.element) renderer.unmount();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('MenuRenderer.mount', () => {
  it('creates the menu element inside document.body', () => {
    renderer.mount({ centerX: 200, centerY: 150, geometry: makeGeometry(), items, baseFontSize: 14 });
    expect(renderer.element).toBeTruthy();
    expect(document.body.contains(renderer.element)).toBe(true);
    expect(renderer.element.className).toBe('pielet');
  });

  it('positions the element at center minus outer radius with size 2R', () => {
    renderer.mount({ centerX: 200, centerY: 150, geometry: makeGeometry(), items, baseFontSize: 14 });
    expect(renderer.element.style.left).toBe('100px');
    expect(renderer.element.style.top).toBe('50px');
    expect(renderer.element.style.width).toBe('200px');
    expect(renderer.element.style.height).toBe('200px');
  });

  it('creates one item element per item', () => {
    renderer.mount({ centerX: 200, centerY: 150, geometry: makeGeometry(), items, baseFontSize: 14 });
    const els = renderer.element.querySelectorAll('.pielet__item');
    expect(els).toHaveLength(4);
  });

  it('applies clip-path polygon to each sector item', () => {
    renderer.mount({ centerX: 200, centerY: 150, geometry: makeGeometry(), items, baseFontSize: 14 });
    const els = renderer.element.querySelectorAll('.pielet__item');
    for (const el of els) {
      expect(el.style.clipPath.startsWith('polygon(')).toBe(true);
    }
  });

  it('creates a caption for text/image/node items and none for none-items', () => {
    renderer.mount({ centerX: 200, centerY: 150, geometry: makeGeometry(), items, baseFontSize: 14 });
    const els = renderer.element.querySelectorAll('.pielet__item');
    expect(els[1].querySelector('.pielet__item-caption')).toBeNull();
    expect(els[0].querySelector('.pielet__item-caption .pielet__content--text')).toBeTruthy();
    expect(els[2].querySelector('.pielet__item-caption .pielet__content--image')).toBeTruthy();
  });

  it('marks none items with the --none class (no fill)', () => {
    renderer.mount({ centerX: 200, centerY: 150, geometry: makeGeometry(), items, baseFontSize: 14 });
    const els = renderer.element.querySelectorAll('.pielet__item');
    expect(els[1].classList.contains('pielet__item--none')).toBe(true);
    expect(els[0].classList.contains('pielet__item--none')).toBe(false);
    expect(els[2].classList.contains('pielet__item--none')).toBe(false);
    expect(els[3].classList.contains('pielet__item--none')).toBe(false);
  });

  it('positions the caption at the radial center of its sector', () => {
    const geometry = makeGeometry();
    renderer.mount({ centerX: 200, centerY: 150, geometry, items, baseFontSize: 14 });
    const els = renderer.element.querySelectorAll('.pielet__item');
    const caption = els[0].querySelector('.pielet__item-caption');
    const mid = geometry.sectors[0].mid;
    const meanRadius = (geometry.outerRadius + geometry.innerRadius) / 2;
    expect(caption.style.left).toBe(`${100 + meanRadius * Math.cos(mid)}px`);
    expect(caption.style.top).toBe(`${100 + meanRadius * Math.sin(mid)}px`);
    expect(caption.style.transform).toContain('translate(-50%, -50%)');
  });

  it('adds the open class asynchronously', async () => {
    vi.useFakeTimers();
    renderer.mount({ centerX: 200, centerY: 150, geometry: makeGeometry(), items, baseFontSize: 14 });
    expect(renderer.element.classList.contains('pielet--open')).toBe(false);
    await vi.advanceTimersByTimeAsync(20);
    expect(renderer.element.classList.contains('pielet--open')).toBe(true);
  });

  it('preserves DOM events of a user-provided node item', () => {
    const onClick = vi.fn();
    const button = document.createElement('button');
    button.addEventListener('click', onClick);
    renderer.mount({
      centerX: 200,
      centerY: 150,
      geometry: makeGeometry(),
      items: [{ typeContent: 'node', content: button }],
      baseFontSize: 14
    });
    const caption = renderer.element.querySelector('.pielet__item-caption');
    expect(caption).toBeTruthy();
    expect(caption.contains(button)).toBe(true);
    expect(button.parentNode).toBe(caption);
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.instances[0]).toBe(button);
  });
});

describe('MenuRenderer.setHover', () => {
  function mounted() {
    renderer.mount({ centerX: 200, centerY: 150, geometry: makeGeometry(), items, baseFontSize: 14 });
    return renderer.element.querySelectorAll('.pielet__item');
  }

  it('adds hover class to the given item only', () => {
    const els = mounted();
    renderer.setHover(2);
    expect(els[2].classList.contains('pielet__item--hover')).toBe(true);
    expect(els[0].classList.contains('pielet__item--hover')).toBe(false);
  });

  it('clears all hover when null', () => {
    const els = mounted();
    renderer.setHover(2);
    renderer.setHover(null);
    for (const el of els) expect(el.classList.contains('pielet__item--hover')).toBe(false);
  });

  it('never applies hover to a none item', () => {
    const els = mounted();
    renderer.setHover(1);
    expect(els[1].classList.contains('pielet__item--hover')).toBe(false);
    renderer.setHover(null);
  });
});

describe('MenuRenderer.animateClose', () => {
  it('removes the open class, then removes the DOM and calls back once', async () => {
    vi.useFakeTimers();
    renderer.mount({ centerX: 200, centerY: 150, geometry: makeGeometry(), items, baseFontSize: 14 });
    await vi.advanceTimersByTimeAsync(20);
    const onDone = vi.fn();
    renderer.animateClose(onDone);
    expect(renderer.element.classList.contains('pielet--open')).toBe(false);
    expect(document.body.contains(renderer.element)).toBe(true);
    await vi.advanceTimersByTimeAsync(400);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('.pielet')).toBeNull();
    expect(renderer.element).toBeNull();
  });

  it('calls back immediately when nothing is mounted', () => {
    const onDone = vi.fn();
    renderer.animateClose(onDone);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('unmount removes the DOM immediately', () => {
    renderer.mount({ centerX: 200, centerY: 150, geometry: makeGeometry(), items, baseFontSize: 14 });
    renderer.unmount();
    expect(document.body.querySelector('.pielet')).toBeNull();
    expect(renderer.element).toBeNull();
  });
});