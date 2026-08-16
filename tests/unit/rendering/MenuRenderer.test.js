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

function makeGeometry({ itemCount = 4, arcStart = 0, arcLength = TAU, direction = 'clockwise', gap = 0, fit = 'circle' } = {}) {
  const outerRadius = 100;
  const innerRadius = 30;
  const { sectors } = calculateSectorLayout({
    itemCount,
    arcStart,
    arcLength,
    outerRadius: 100,
    innerRadius: 30,
    meanRadius: 65,
    ringWidth: 70,
    gap,
    fit,
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
    renderer.mount({ centerX: 200, centerY: 150, geometry: makeGeometry(), items });
    expect(renderer.element).toBeTruthy();
    expect(document.body.contains(renderer.element)).toBe(true);
    expect(renderer.element.className).toBe('pielet');
  });

  it('positions the element at center minus outer radius with size 2R', () => {
    renderer.mount({ centerX: 200, centerY: 150, geometry: makeGeometry(), items });
    expect(renderer.element.style.left).toBe('100px');
    expect(renderer.element.style.top).toBe('50px');
    expect(renderer.element.style.width).toBe('200px');
    expect(renderer.element.style.height).toBe('200px');
  });

  it('creates one item element per item', () => {
    renderer.mount({ centerX: 200, centerY: 150, geometry: makeGeometry(), items });
    const els = renderer.element.querySelectorAll('.pielet__item');
    expect(els).toHaveLength(4);
  });

  it('applies clip-path polygon to each sector item', () => {
    renderer.mount({ centerX: 200, centerY: 150, geometry: makeGeometry(), items });
    const els = renderer.element.querySelectorAll('.pielet__item');
    for (const el of els) {
      expect(el.style.clipPath.startsWith('polygon(')).toBe(true);
    }
  });

  it('creates a caption for text/image/node items and none for none-items', () => {
    renderer.mount({ centerX: 200, centerY: 150, geometry: makeGeometry(), items });
    const els = renderer.element.querySelectorAll('.pielet__item');
    expect(els[1].querySelector('.pielet__item-caption')).toBeNull();
    expect(els[0].querySelector('.pielet__item-caption .pielet__content--text')).toBeTruthy();
    expect(els[2].querySelector('.pielet__item-caption .pielet__content--image')).toBeTruthy();
  });

  it('marks none items with the --none class (no fill)', () => {
    renderer.mount({ centerX: 200, centerY: 150, geometry: makeGeometry(), items });
    const els = renderer.element.querySelectorAll('.pielet__item');
    expect(els[1].classList.contains('pielet__item--none')).toBe(true);
    expect(els[0].classList.contains('pielet__item--none')).toBe(false);
    expect(els[2].classList.contains('pielet__item--none')).toBe(false);
    expect(els[3].classList.contains('pielet__item--none')).toBe(false);
  });

  it('positions the caption on the content radius of its sector', () => {
    const geometry = makeGeometry();
    renderer.mount({ centerX: 200, centerY: 150, geometry, items });
    const els = renderer.element.querySelectorAll('.pielet__item');
    const caption = els[0].querySelector('.pielet__item-caption');
    const mid = geometry.sectors[0].mid;
    const contentRadius = geometry.sectors[0].contentRadius;
    expect(caption.style.left).toBe(`${100 + contentRadius * Math.cos(mid)}px`);
    expect(caption.style.top).toBe(`${100 + contentRadius * Math.sin(mid)}px`);
    expect(caption.style.transform).toContain('translate(-50%, -50%)');
  });

  it('circle fit: uses the safe-zone radius (contentRadius) even when it differs from meanRadius', () => {
    // 8 пунктов: боковые грани ограничивают сильнее, чем кольцо,
    // поэтому contentRadius != meanRadius (65) — тест ловит неверный радиус.
    const geometry = makeGeometry({ itemCount: 8 });
    expect(geometry.sectors[0].contentRadius).not.toBeCloseTo(65, 3);
    const eight = Array.from({ length: 8 }, (_, i) => ({ typeContent: 'text', content: `I${i}` }));
    renderer.mount({ centerX: 200, centerY: 150, geometry, items: eight });
    const caption = renderer.element.querySelector('.pielet__item-caption');
    const mid = geometry.sectors[0].mid;
    const contentRadius = geometry.sectors[0].contentRadius;
    expect(caption.style.left).toBe(`${100 + contentRadius * Math.cos(mid)}px`);
    expect(caption.style.top).toBe(`${100 + contentRadius * Math.sin(mid)}px`);
    // и не поворачивает контент в circle-режиме
    expect(caption.style.transform).not.toContain('rotate(');
  });

  it('square fit: rotates the caption together with the sector (rotate(mid))', () => {
    const geometry = makeGeometry({ fit: 'square' });
    renderer.mount({ centerX: 200, centerY: 150, geometry, items });
    const els = renderer.element.querySelectorAll('.pielet__item');
    const caption = els[0].querySelector('.pielet__item-caption');
    const mid = geometry.sectors[0].mid;
    const contentRadius = geometry.sectors[0].contentRadius;
    expect(caption.style.transform).toBe(`translate(-50%, -50%) rotate(${mid * 180 / Math.PI}deg)`);
    // позиция по contentRadius (для square = meanRadius)
    expect(caption.style.left).toBe(`${100 + contentRadius * Math.cos(mid)}px`);
    expect(caption.style.top).toBe(`${100 + contentRadius * Math.sin(mid)}px`);
  });

  it('square fit: flips captions in the left half so text reads from outer to inner', () => {
    const geometry = makeGeometry({ fit: 'square' });
    renderer.mount({ centerX: 200, centerY: 150, geometry, items });
    const els = renderer.element.querySelectorAll('.pielet__item');
    for (let i = 0; i < geometry.sectors.length; i++) {
      const caption = els[i].querySelector('.pielet__item-caption');
      if (!caption) continue;
      const { mid, flip } = geometry.sectors[i];
      const rot = mid * 180 / Math.PI + (flip ? 180 : 0);
      expect(caption.style.transform).toBe(`translate(-50%, -50%) rotate(${rot}deg)`);
    }
  });

  it('fits text font size after insertion into the DOM (no baseFontSize option)', () => {
    renderer.mount({ centerX: 200, centerY: 150, geometry: makeGeometry(), items });
    const textEls = renderer.element.querySelectorAll('.pielet__content--text');
    for (const el of textEls) {
      expect(el.style.fontSize).not.toBe('');
    }
  });

  it('2 items at startAngle -90: both captions sit on the horizontal line through the menu center', () => {
    const geometry = makeGeometry({ itemCount: 2, arcStart: -Math.PI / 2, gap: 4 });
    const two = [
      { typeContent: 'text', content: 'A' },
      { typeContent: 'text', content: 'B' }
    ];
    renderer.mount({ centerX: 200, centerY: 150, geometry, items: two });
    const caps = renderer.element.querySelectorAll('.pielet__item-caption');
    expect(caps).toHaveLength(2);
    expect(parseFloat(caps[0].style.top)).toBeCloseTo(100, 6);
    expect(parseFloat(caps[1].style.top)).toBeCloseTo(100, 6);
    expect(parseFloat(caps[0].style.left) + parseFloat(caps[1].style.left)).toBeCloseTo(200, 6);
  });

  it('single item at startAngle -90: caption sits on the arcStart ray (top of the menu)', () => {
    const geometry = makeGeometry({ itemCount: 1, arcStart: -Math.PI / 2, gap: 4 });
    const single = [{ typeContent: 'text', content: 'A' }];
    renderer.mount({ centerX: 200, centerY: 150, geometry, items: single });
    const caption = renderer.element.querySelector('.pielet__item-caption');
    const contentRadius = geometry.sectors[0].contentRadius;
    expect(caption.style.left).toBe(`${100 + contentRadius * Math.cos(-Math.PI / 2)}px`);
    expect(caption.style.top).toBe(`${100 + contentRadius * Math.sin(-Math.PI / 2)}px`);
    expect(parseFloat(caption.style.left)).toBeCloseTo(100, 6);
    expect(parseFloat(caption.style.top)).toBeCloseTo(100 - contentRadius, 6);
  });

  it('adds the open class asynchronously', async () => {
    vi.useFakeTimers();
    renderer.mount({ centerX: 200, centerY: 150, geometry: makeGeometry(), items });
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
      items: [{ typeContent: 'node', content: button }]
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
    renderer.mount({ centerX: 200, centerY: 150, geometry: makeGeometry(), items });
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

describe('MenuRenderer.setItemContent', () => {
  function mounted(geometry = makeGeometry()) {
    renderer.mount({ centerX: 200, centerY: 150, geometry, items });
    return renderer.element.querySelectorAll('.pielet__item');
  }

  it('replaces the text content of the item in place', () => {
    const els = mounted();
    renderer.setItemContent(0, { typeContent: 'text', content: 'Renamed' });
    const textEl = els[0].querySelector('.pielet__content--text');
    expect(textEl).toBeTruthy();
    expect(textEl.textContent).toBe('Renamed');
  });

  it('fits the new text font size after replacement (element is already in DOM)', () => {
    const els = mounted();
    renderer.setItemContent(0, { typeContent: 'text', content: 'Much longer label' });
    const textEl = els[0].querySelector('.pielet__content--text');
    expect(textEl.style.fontSize).not.toBe('');
  });

  it('replaces the image src of the item in place', () => {
    const els = mounted();
    renderer.setItemContent(2, { typeContent: 'image', content: '/icons/new.svg' });
    const img = els[2].querySelector('.pielet__content--image');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('/icons/new.svg');
  });

  it('replaces a node item without cloning and removes the old node', () => {
    const oldNode = document.createElement('span');
    oldNode.textContent = 'old';
    const nodeItems = [
      { typeContent: 'node', content: oldNode },
      { typeContent: 'text', content: 'B' }
    ];
    renderer.mount({ centerX: 200, centerY: 150, geometry: makeGeometry({ itemCount: 2 }), items: nodeItems });
    const replacement = document.createElement('strong');
    replacement.textContent = 'new';
    renderer.setItemContent(0, { typeContent: 'node', content: replacement });
    const caption = renderer.element.querySelectorAll('.pielet__item')[0].querySelector('.pielet__item-caption');
    expect(caption.contains(replacement)).toBe(true);
    expect(caption.contains(oldNode)).toBe(false);
    expect(oldNode.parentNode).toBeNull();
  });

  it('does not affect other items', () => {
    const els = mounted();
    renderer.setItemContent(0, { typeContent: 'text', content: 'Renamed' });
    expect(els[3].querySelector('.pielet__content--text').textContent).toBe('Save');
  });
});

describe('MenuRenderer.animateClose', () => {
  it('removes the open class, then removes the DOM and calls back once', async () => {
    vi.useFakeTimers();
    renderer.mount({ centerX: 200, centerY: 150, geometry: makeGeometry(), items });
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
    renderer.mount({ centerX: 200, centerY: 150, geometry: makeGeometry(), items });
    renderer.unmount();
    expect(document.body.querySelector('.pielet')).toBeNull();
    expect(renderer.element).toBeNull();
  });
});