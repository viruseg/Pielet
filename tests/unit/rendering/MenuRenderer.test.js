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

function makeGeometry({ itemCount = 4, arcStart = 0, arcLength = TAU, direction = 'clockwise', gap = 0, fit = 'circle', outerRadius = 100, innerRadius = 30 } = {}) {
  const { sectors } = calculateSectorLayout({
    itemCount,
    arcStart,
    arcLength,
    outerRadius,
    innerRadius,
    meanRadius: (outerRadius + innerRadius) / 2,
    ringWidth: outerRadius - innerRadius,
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

// jsdom не считает layout: моким scrollWidth/scrollHeight так, чтобы они
// зависели от font-size и длины текста (длинный текст => меньший влезающий шрифт).
function mockTextLayout({ widthPerChar = 0.6, lineHeight = 1.5 } = {}) {
  const proto = HTMLElement.prototype;
  const origW = Object.getOwnPropertyDescriptor(proto, 'scrollWidth');
  const origH = Object.getOwnPropertyDescriptor(proto, 'scrollHeight');
  Object.defineProperty(proto, 'scrollWidth', {
    configurable: true,
    get() {
      const size = parseFloat(this.style.fontSize) || 0;
      const len = (this.textContent || '').length;
      return Math.round(size * len * widthPerChar);
    }
  });
  Object.defineProperty(proto, 'scrollHeight', {
    configurable: true,
    get() {
      const size = parseFloat(this.style.fontSize) || 0;
      return Math.round(size * lineHeight);
    }
  });
  return () => {
    if (origW) Object.defineProperty(proto, 'scrollWidth', origW);
    else delete proto.scrollWidth;
    if (origH) Object.defineProperty(proto, 'scrollHeight', origH);
    else delete proto.scrollHeight;
  };
}

function textSizes(root) {
  return Array.from(root.querySelectorAll('.pielet__content--text')).map(
    (el) => parseFloat(el.style.fontSize)
  );
}

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

describe('MenuRenderer.unifyText (fit square)', () => {
  const textItems = [
    { typeContent: 'text', content: 'Open' },
    { typeContent: 'text', content: 'Save' },
    { typeContent: 'text', content: 'A much longer label' }
  ];

  it('mount with unifyText: all text items share the smallest fitted font size', () => {
    const restore = mockTextLayout();
    try {
      renderer.mount({
        centerX: 200,
        centerY: 150,
        geometry: makeGeometry({ fit: 'square', itemCount: textItems.length }),
        items: textItems,
        unifyText: true
      });
      const sizes = textSizes(renderer.element);
      expect(sizes).toHaveLength(3);
      // все шрифты одинаковые
      expect(new Set(sizes).size).toBe(1);
      // и равны самому маленькому индивидуальному размеру (у самого длинного текста)
      expect(sizes[0]).toBe(Math.min(...sizes));
    } finally {
      restore();
    }
  });

  it('mount without unifyText: text items keep their individual fitted sizes', () => {
    const restore = mockTextLayout();
    try {
      renderer.mount({
        centerX: 200,
        centerY: 150,
        geometry: makeGeometry({ fit: 'square', itemCount: textItems.length }),
        items: textItems
      });
      const sizes = textSizes(renderer.element);
      expect(sizes).toHaveLength(3);
      // длинный текст ужался сильнее короткого
      expect(sizes[0]).toBeGreaterThan(sizes[2]);
      expect(sizes[1]).toBeGreaterThan(sizes[2]);
    } finally {
      restore();
    }
  });

  it('unifyText is ignored in fit circle mode', () => {
    const restore = mockTextLayout();
    try {
      renderer.mount({
        centerX: 200,
        centerY: 150,
        geometry: makeGeometry({ itemCount: textItems.length }),
        items: textItems,
        unifyText: true
      });
      const sizes = textSizes(renderer.element);
      expect(sizes).toHaveLength(3);
      expect(sizes[0]).toBeGreaterThan(sizes[2]);
      expect(sizes[1]).toBeGreaterThan(sizes[2]);
    } finally {
      restore();
    }
  });

  it('setItemContent re-unifies all text items when unifyText is active', () => {
    const restore = mockTextLayout();
    try {
      renderer.mount({
        centerX: 200,
        centerY: 150,
        geometry: makeGeometry({ fit: 'square', itemCount: textItems.length }),
        items: textItems,
        unifyText: true
      });
      // заменяем короткий текст на самый длинный — минимум должен уменьшиться
      renderer.setItemContent(0, { typeContent: 'text', content: 'An extremely long label here' });
      const sizes = textSizes(renderer.element);
      expect(new Set(sizes).size).toBe(1);
      expect(sizes[0]).toBeLessThan(16);
    } finally {
      restore();
    }
  });

  it('setItemContent does not re-unify when unifyText is off', () => {
    const restore = mockTextLayout();
    try {
      renderer.mount({
        centerX: 200,
        centerY: 150,
        geometry: makeGeometry({ fit: 'square', itemCount: textItems.length }),
        items: textItems
      });
      renderer.setItemContent(0, { typeContent: 'text', content: 'An extremely long label here' });
      const sizes = textSizes(renderer.element);
      // пункт 0 ужался, остальные не тронуты (разные размеры)
      expect(sizes[0]).toBeLessThan(sizes[1]);
      expect(new Set(sizes).size).toBeGreaterThan(1);
    } finally {
      restore();
    }
  });
});

describe('MenuRenderer submenu indicators', () => {
  const submenuItems = [
    { typeContent: 'text', content: 'More', isSubMenu: true },
    { typeContent: 'text', content: 'Plain' },
    { typeContent: 'image', content: '/icons/x.svg', isSubMenu: true },
    { typeContent: 'text', content: 'Other' }
  ];

  function mountWith(indicator) {
    renderer.mount({
      centerX: 200,
      centerY: 150,
      geometry: makeGeometry(),
      items: submenuItems,
      submenuIndicator: indicator
    });
    return Array.from(renderer.element.querySelectorAll('.pielet__item'));
  }

  it('default (both): arc in submenu items, chevron on the menu root (outside the sector clip-path)', () => {
    const itemEls = mountWith('both');
    for (const index of [0, 2]) {
      expect(itemEls[index].querySelector('.pielet__submenu-arc')).toBeTruthy();
    }
    for (const index of [1, 3]) {
      expect(itemEls[index].querySelector('.pielet__submenu-arc')).toBeNull();
    }
    // шеврон крепится к корню меню, а не к itemEl: clip-path сектора
    // срезает всё за внешним краем кольца
    const chevrons = renderer.element.querySelectorAll('.pielet__submenu-chevron');
    expect(chevrons).toHaveLength(2);
    expect(itemEls[0].querySelector('.pielet__submenu-chevron')).toBeNull();
    expect(renderer.element.contains(chevrons[0])).toBe(true);
  });

  it('submenuIndicator "arc": renders only the arc', () => {
    const itemEls = mountWith('arc');
    expect(itemEls[0].querySelector('.pielet__submenu-arc')).toBeTruthy();
    expect(itemEls[0].querySelector('.pielet__submenu-chevron')).toBeNull();
    expect(itemEls[1].querySelector('.pielet__submenu-arc')).toBeNull();
  });

  it('submenuIndicator "chevron": renders only the chevron on the menu root', () => {
    const itemEls = mountWith('chevron');
    expect(itemEls[0].querySelector('.pielet__submenu-arc')).toBeNull();
    expect(itemEls[0].querySelector('.pielet__submenu-chevron')).toBeNull();
    // оба сабменю-пункта (0 и 2) получают шеврон, обычные — нет
    const chevrons = renderer.element.querySelectorAll('.pielet__submenu-chevron');
    expect(chevrons).toHaveLength(2);
    expect(chevrons[0].textContent).toBe('›');
  });

  it('arc element is an SVG with a non-empty path', () => {
    const itemEls = mountWith('both');
    const svg = itemEls[0].querySelector('.pielet__submenu-arc');
    expect(svg.tagName.toLowerCase()).toBe('svg');
    const path = svg.querySelector('path');
    expect(path).toBeTruthy();
    expect(path.getAttribute('d')).toBeTruthy();
    expect(path.getAttribute('stroke')).toBeTruthy();
  });

  it('indicators do not affect caption content', () => {
    const itemEls = mountWith('both');
    const caption = itemEls[0].querySelector('.pielet__item-caption');
    expect(caption.querySelector('.pielet__content--text').textContent).toBe('More');
  });

  it('sizes the chevron proportionally to the ring width (28px cap) and positions it at the outer rim', () => {
    // makeGeometry: outer 100 / inner 30 → ring 70 → size = min(28, 25.2) = 25.2
    const itemEls = mountWith('both');
    const chevron = renderer.element.querySelector('.pielet__submenu-chevron');
    const size = parseFloat(chevron.style.fontSize);
    expect(size).toBeCloseTo(25.2, 5);
    // центр шеврона: outerRadius + size*0.25, вдоль mid (для 4 пунктов cw от 0: mid = π/4)
    // left/top задаются в координатах корня меню (origin — верхний левый угол меню)
    const centerRadius = 100 + size * 0.25;
    const mid = Math.PI / 4;
    expect(parseFloat(chevron.style.left)).toBeCloseTo(100 + centerRadius * Math.cos(mid), 3);
    expect(parseFloat(chevron.style.top)).toBeCloseTo(100 + centerRadius * Math.sin(mid), 3);
    expect(chevron.style.transform).toMatch(/rotate\(45(\.\d+)?deg\)/);
  });

  it('keeps the chevron at the outer rim, radially clear of the caption content (size=120/centerSize=24)', () => {
    // outer 60 / inner 12 → ring 48 → size = 17.28, центр на радиусе 60 + 4.32 = 64.32
    renderer.mount({
      centerX: 300,
      centerY: 300,
      geometry: makeGeometry({ itemCount: 4, outerRadius: 60, innerRadius: 12 }),
      items: submenuItems,
      submenuIndicator: 'both'
    });
    const itemEls = Array.from(renderer.element.querySelectorAll('.pielet__item'));
    const chevron = renderer.element.querySelector('.pielet__submenu-chevron');
    const caption = itemEls[0].querySelector('.pielet__item-caption');

    const chevronRadius = Math.hypot(parseFloat(chevron.style.left) - 60, parseFloat(chevron.style.top) - 60);
    const captionRadius = Math.hypot(parseFloat(caption.style.left) - 60, parseFloat(caption.style.top) - 60);

    expect(parseFloat(chevron.style.fontSize)).toBeCloseTo(17.28, 5);
    // шеврон «сидит» на внешнем крае кольца (центр на 0.25·size за ним)
    expect(chevronRadius).toBeCloseTo(64.32, 3);
    expect(chevronRadius).toBeGreaterThan(60);
    expect(chevronRadius - 17.28 / 2).toBeCloseTo(60 - 17.28 * 0.25, 3);
    // радиально дальше от центра, чем контент (не сливается)
    expect(chevronRadius).toBeGreaterThan(captionRadius);
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