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