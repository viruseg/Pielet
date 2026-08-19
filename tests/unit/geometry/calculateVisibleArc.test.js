import { describe, it, expect } from 'vitest';
import { calculateVisibleArc } from '../../../src/geometry/calculateVisibleArc.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const base = { outerRadius: 100, startAngle: -90, viewportWidth: 1000, viewportHeight: 800 };

const near = (a, b, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('calculateVisibleArc — full circle visible', () => {
  it('returns config startAngle and full arc when fully visible', () => {
    const r = calculateVisibleArc({ ...base, centerX: 500, centerY: 400 });
    near(r.startAngle, -90 * DEG);
    near(r.arc, TAU);
  });

  it('returns config startAngle and full arc when the circle fits exactly', () => {
    const r = calculateVisibleArc({ ...base, centerX: 100, centerY: 100 });
    near(r.startAngle, -90 * DEG);
    near(r.arc, TAU);
  });
});

describe('calculateVisibleArc — single edge clipping', () => {
  it('left edge: visible arc wraps left side (240°)', () => {
    const r = calculateVisibleArc({ ...base, centerX: 50, centerY: 400 });
    near(r.startAngle, 240 * DEG, 1e-6);
    near(r.arc, 240 * DEG, 1e-6);
  });

  it('right edge: visible arc on the right (240° from 60°)', () => {
    const r = calculateVisibleArc({ ...base, centerX: 950, centerY: 400 });
    near(r.startAngle, 60 * DEG, 1e-6);
    near(r.arc, 240 * DEG, 1e-6);
  });

  it('top edge: visible arc wraps through top (240° from 330°)', () => {
    const r = calculateVisibleArc({ ...base, centerX: 500, centerY: 50 });
    near(r.startAngle, 330 * DEG, 1e-6);
    near(r.arc, 240 * DEG, 1e-6);
  });

  it('bottom edge: visible arc at the bottom (120° from 210°)', () => {
    const r = calculateVisibleArc({ ...base, centerX: 500, centerY: 850 });
    near(r.startAngle, 210 * DEG, 1e-6);
    near(r.arc, 120 * DEG, 1e-6);
  });
});

describe('calculateVisibleArc — corners', () => {
  it('top-left corner: quarter-ish arc through the corner (150° from 330°)', () => {
    const r = calculateVisibleArc({ ...base, centerX: 50, centerY: 50 });
    near(r.startAngle, 330 * DEG, 1e-6);
    near(r.arc, 150 * DEG, 1e-6);
  });

  it('bottom-right corner: arc on the lower-right side', () => {
    const r = calculateVisibleArc({ ...base, centerX: 950, centerY: 750 });
    const visibleLen = r.arc;
    expect(visibleLen).toBeGreaterThanOrEqual(Math.PI / 2);
    // центр меню не двигается — меняется только дуга; сидит в правом нижнем квадранте
    const mid = ((r.startAngle + r.arc / 2) % TAU + TAU) % TAU;
    near(mid, 225 * DEG, 1e-6);
  });
});

describe('calculateVisibleArc — degenerate cases', () => {
  it('menu larger than viewport with no visible arc → full geometry', () => {
    const r = calculateVisibleArc({ ...base, outerRadius: 900, centerX: 500, centerY: 400 });
    near(r.startAngle, -90 * DEG);
    near(r.arc, TAU);
  });

  it('visible arc smaller than MIN_EDGE_REALLOCATION_ARC → full geometry', () => {
    const r = calculateVisibleArc({
      outerRadius: 800, startAngle: -90, viewportWidth: 1000, viewportHeight: 800,
      centerX: 500, centerY: 100
    });
    near(r.startAngle, -90 * DEG);
    near(r.arc, TAU);
  });

  it('center exactly on the bottom edge → bottom half visible', () => {
    const r = calculateVisibleArc({ ...base, centerX: 500, centerY: 800 });
    near(r.startAngle, 180 * DEG, 1e-6);
    near(r.arc, 180 * DEG, 1e-6);
  });

  it('center outside viewport below → tangency → full geometry fallback', () => {
    const r = calculateVisibleArc({ ...base, centerX: 500, centerY: 900 });
    near(r.startAngle, -90 * DEG);
    near(r.arc, TAU);
  });

  it('arc never exceeds 2π', () => {
    const r = calculateVisibleArc({ ...base, centerX: 500, centerY: 400 });
    expect(r.arc).toBeLessThanOrEqual(TAU + 1e-9);
  });
});

describe('calculateVisibleArc — startAngle preservation', () => {
  it('keeps custom startAngle in rad when falling back to full circle', () => {
    const r = calculateVisibleArc({ ...base, startAngle: 45, centerX: 500, centerY: 400 });
    near(r.startAngle, 45 * DEG);
    near(r.arc, TAU);
  });
});

describe('calculateVisibleArc — counterclockwise edge reflow', () => {
  it('counterclockwise fully visible keeps config startAngle', () => {
    const r = calculateVisibleArc({ ...base, direction: 'counterclockwise', centerX: 500, centerY: 400 });
    near(r.startAngle, -90 * DEG);
    near(r.arc, TAU);
  });

  it('left edge: anchors the arc at the END so CCW sectors sweep inside the visible window', () => {
    const r = calculateVisibleArc({ ...base, direction: 'counterclockwise', centerX: 50, centerY: 400 });
    // видимое окно [240°, 480°]; CCW-полоса [startAngle - arc, startAngle] должна лежать в нём
    near(r.arc, 240 * DEG, 1e-6);
    near(r.startAngle, 480 * DEG, 1e-6);
  });

  it('top edge: swept band [startAngle - arc, startAngle] is fully visible', () => {
    const r = calculateVisibleArc({ ...base, direction: 'counterclockwise', centerX: 500, centerY: 50 });
    near(r.startAngle, 570 * DEG, 1e-6);
    near(r.arc, 240 * DEG, 1e-6);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const a = r.startAngle - r.arc * t;
      expect(Math.sin(a)).toBeGreaterThanOrEqual(-0.5 - 1e-9);
    }
  });
});

describe('calculateVisibleArc — availableArc pattern placement', () => {
  it('fully visible: pattern sits at its natural position', () => {
    const r = calculateVisibleArc({ ...base, centerX: 500, centerY: 400, availableArc: { startAngle: 3 * Math.PI / 2, arc: Math.PI } });
    near(r.startAngle, 3 * Math.PI / 2);
    near(r.arc, Math.PI);
  });

  it('fully visible: top-left quarter', () => {
    const r = calculateVisibleArc({ ...base, centerX: 500, centerY: 400, availableArc: { startAngle: Math.PI, arc: Math.PI / 2 } });
    near(r.startAngle, Math.PI);
    near(r.arc, Math.PI / 2);
  });

  it('right half near the right edge → mirrored into the left half', () => {
    // центр на правом крае: видна левая половина [π/2, 3π/2]
    const r = calculateVisibleArc({ ...base, centerX: 1000, centerY: 400, availableArc: { startAngle: 3 * Math.PI / 2, arc: Math.PI } });
    near(r.startAngle, Math.PI / 2, 1e-6);
    near(r.arc, Math.PI, 1e-6);
  });

  it('bottom half near the bottom edge → mirrored into the top half', () => {
    // центр на нижнем крае: видна верхняя половина [π, 2π]
    const r = calculateVisibleArc({ ...base, centerX: 500, centerY: 800, availableArc: { startAngle: 0, arc: Math.PI } });
    near(r.startAngle, Math.PI, 1e-6);
    near(r.arc, Math.PI, 1e-6);
  });

  it('right half near the right edge (not flush) → perfect mirror into the left half', () => {
    // центр на 50px правее границы круга (950 + 100 > 1000): видимое окно [π/3, 5π/3];
    // натуральное положение (0°) не влезает, но зеркало (180°) влезает идеально
    const r = calculateVisibleArc({ ...base, centerX: 950, centerY: 400, availableArc: { startAngle: 3 * Math.PI / 2, arc: Math.PI } });
    near(r.startAngle, Math.PI / 2, 1e-6);
    near(r.arc, Math.PI, 1e-6);
  });

  it('bottom half near the bottom edge (not flush) → perfect horizontal mirror into the top half', () => {
    // центр на 50px ниже границы круга: видимое окно [5π/6, 13π/6] в merged-представлении;
    // горизонтальное зеркало (верх, 270°) влезает идеально
    const r = calculateVisibleArc({ ...base, centerX: 500, centerY: 750, availableArc: { startAngle: 0, arc: Math.PI } });
    near(r.startAngle, Math.PI, 1e-6);
    near(r.arc, Math.PI, 1e-6);
  });

  it('corner click + corner pattern → both-axis mirror into the opposite corner', () => {
    // клик в верхне-правом углу, паттерн «верх-право» (центр 315°); единственное
    // идеальное размещение — зеркало по обеим осям (135°), дуга [π/2, π]
    const r = calculateVisibleArc({ ...base, centerX: 950, centerY: 50, availableArc: { startAngle: 3 * Math.PI / 2, arc: Math.PI / 2 } });
    near(r.startAngle, Math.PI / 2, 1e-6);
    near(r.arc, Math.PI / 2, 1e-6);
  });

  it('mirror preferred over a closer compromise placement', () => {
    // видимое окно [π/3, 5π/3] допускает компромиссный центр 5π/6 (ближе к 0°),
    // но идеальное зеркало (π) должно выиграть
    const r = calculateVisibleArc({ ...base, centerX: 950, centerY: 400, availableArc: { startAngle: 3 * Math.PI / 2, arc: Math.PI } });
    const mid = ((r.startAngle + r.arc / 2) % TAU + TAU) % TAU;
    near(mid, Math.PI, 1e-6);
  });

  it('no window fits the whole pattern → shrink to the largest visible window', () => {
    // угловой клик (50, 50): видимая дуга [11π/6, 8π/3] длиной 5π/6; паттерн 3π/2 не помещается → сужение
    const r = calculateVisibleArc({ ...base, centerX: 50, centerY: 50, availableArc: { startAngle: Math.PI, arc: 3 * Math.PI / 2 } });
    near(r.startAngle, 11 * Math.PI / 6, 1e-6);
    near(r.arc, 5 * Math.PI / 6, 1e-6);
  });

  it('counterclockwise anchors the pattern at its end', () => {
    const r = calculateVisibleArc({ ...base, direction: 'counterclockwise', centerX: 1000, centerY: 400, availableArc: { startAngle: 3 * Math.PI / 2, arc: Math.PI } });
    near(r.startAngle, 3 * Math.PI / 2, 1e-6);
    near(r.arc, Math.PI, 1e-6);
  });

  it('center outside the viewport → full geometry fallback', () => {
    const r = calculateVisibleArc({ ...base, centerX: 500, centerY: 900, availableArc: { startAngle: 3 * Math.PI / 2, arc: Math.PI } });
    near(r.startAngle, -90 * DEG);
    near(r.arc, TAU);
  });

  it('full-circle pattern equals default behavior (config startAngle preserved)', () => {
    const r = calculateVisibleArc({ ...base, centerX: 500, centerY: 400, availableArc: { startAngle: 0, arc: TAU } });
    near(r.startAngle, -90 * DEG);
    near(r.arc, TAU);
  });
});