import { describe, it, expect } from 'vitest';
import { calculateVisibleRect } from '../../../src/geometry/calculateVisibleRect.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const near = (a, b, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);

function expectRect(actual, expected) {
  for (const key of ['x', 'y', 'width', 'height', 'left', 'top', 'right', 'bottom']) {
    near(actual[key], expected[key]);
  }
}

const call = (opts) =>
  calculateVisibleRect({
    centerX: 500,
    centerY: 400,
    outerRadius: 100,
    innerRadius: 40,
    startAngle: -90 * DEG,
    arc: TAU,
    direction: 'clockwise',
    ...opts
  });

describe('calculateVisibleRect — full circle', () => {
  it('returns the whole menu square with all DOMRect fields', () => {
    const r = call({});
    expectRect(r, { x: 400, y: 300, width: 200, height: 200, left: 400, top: 300, right: 600, bottom: 500 });
  });

  it('respects an arbitrary center', () => {
    const r = call({ centerX: 100, centerY: 200, outerRadius: 50, innerRadius: 20 });
    expectRect(r, { x: 50, y: 150, width: 100, height: 100, left: 50, top: 150, right: 150, bottom: 250 });
  });
});

describe('calculateVisibleRect — arcs', () => {
  it('bottom half (CW, [π, 2π]): full width, half height above center', () => {
    const r = call({ startAngle: 180 * DEG, arc: 180 * DEG });
    expectRect(r, { x: 400, y: 300, width: 200, height: 100, left: 400, top: 300, right: 600, bottom: 400 });
  });

  it('right half (CW, [0, π]): full width, half height below center', () => {
    const r = call({ startAngle: 0, arc: 180 * DEG });
    expectRect(r, { x: 400, y: 400, width: 200, height: 100, left: 400, top: 400, right: 600, bottom: 500 });
  });

  it('bottom-right quadrant (CW, [0, π/2])', () => {
    const r = call({ startAngle: 0, arc: 90 * DEG });
    expectRect(r, { x: 500, y: 400, width: 100, height: 100, left: 500, top: 400, right: 600, bottom: 500 });
  });

  it('top-left quadrant (CW, [π, 3π/2])', () => {
    const r = call({ startAngle: 180 * DEG, arc: 90 * DEG });
    expectRect(r, { x: 400, y: 300, width: 100, height: 100, left: 400, top: 300, right: 500, bottom: 400 });
  });

  it('counterclockwise wraps past 2π (CCW, [π, 2π] via startAngle=2π)', () => {
    const r = call({ startAngle: TAU, arc: 180 * DEG, direction: 'counterclockwise' });
    expectRect(r, { x: 400, y: 300, width: 200, height: 100, left: 400, top: 300, right: 600, bottom: 400 });
  });
});

describe('calculateVisibleRect — invariants', () => {
  it('innerRadius does not affect the bounding rect', () => {
    const withInner = call({});
    const withoutInner = call({ innerRadius: 0 });
    expectRect(withInner, withoutInner);
  });

  it('arc of full length covers the whole square regardless of direction', () => {
    const cw = call({});
    const ccw = call({ startAngle: 45 * DEG, direction: 'counterclockwise' });
    expectRect(cw, ccw);
  });
});