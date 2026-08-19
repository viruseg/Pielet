import { describe, it, expect } from 'vitest';
import { resolveViewportFit } from '../../../src/geometry/fitMenuToViewport.js';
import { calculateVisibleRect } from '../../../src/geometry/calculateVisibleRect.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const OUTER = 120;
const INNER = 36;

const base = {
  outerRadius: OUTER,
  innerRadius: INNER,
  ringWidth: OUTER - INNER,
  meanRadius: (OUTER + INNER) / 2,
  startAngle: -90,
  direction: 'clockwise',
  viewportWidth: 1000,
  viewportHeight: 800
};

const near = (a, b, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

/** Площадь bounding-прямоугольника дуги (независимый модуль calculateVisibleRect). */
function bboxArea(centerX, centerY, outerRadius, startAngle, arc, direction) {
  const r = calculateVisibleRect({ centerX, centerY, outerRadius, innerRadius: 0, startAngle, arc, direction });
  return r.width * r.height;
}

const areaOf = (cx, cy, resolved) =>
  bboxArea(cx, cy, resolved.outerRadius, resolved.startAngle, resolved.arc, resolved.direction ?? 'clockwise');

const call = (opts) => resolveViewportFit({ ...base, ...opts });

describe('resolveViewportFit — menu fully visible', () => {
  it('keeps the config radii and the full circle arc', () => {
    const r = call({ centerX: 500, centerY: 400 });
    near(r.outerRadius, OUTER);
    near(r.innerRadius, INNER);
    near(r.ringWidth, OUTER - INNER);
    near(r.meanRadius, (OUTER + INNER) / 2);
    near(r.arc, TAU);
    near(r.startAngle, -90 * DEG);
  });

  it('keeps radii when the circle fits exactly (center on the viewport edge tangent)', () => {
    const r = call({ centerX: 120, centerY: 120 });
    near(r.outerRadius, OUTER);
    near(r.arc, TAU);
  });
});

describe('resolveViewportFit — edge reflow scales to preserve the arc bounding area', () => {
  const TARGET = 4 * OUTER * OUTER;

  it('left edge: growth capped at 5px radius (≤10px size deviation)', () => {
    const r = call({ centerX: 50, centerY: 400 });
    near(r.outerRadius, OUTER + 5);
    expect(r.outerRadius).toBeLessThanOrEqual(OUTER + 5);
    // у края площадь bbox не обязана дотягивать до 4R0² — рост ограничен
    expect(bboxArea(50, 400, r.outerRadius, r.startAngle, r.arc)).toBeLessThan(TARGET);
  });

  it('right edge: growth capped at 5px radius (≤10px size deviation)', () => {
    const r = call({ centerX: 950, centerY: 400 });
    near(r.outerRadius, OUTER + 5);
    expect(r.outerRadius).toBeLessThanOrEqual(OUTER + 5);
  });

  it('top edge: growth capped at 5px radius (≤10px size deviation)', () => {
    const r = call({ centerX: 500, centerY: 50 });
    near(r.outerRadius, OUTER + 5);
    expect(r.outerRadius).toBeLessThanOrEqual(OUTER + 5);
  });

  it('bottom-right corner: full area invariant (no cap for corners)', () => {
    const r = call({ centerX: 950, centerY: 750 });
    expect(r.outerRadius).toBeGreaterThan(OUTER + 5);
    expect(bboxArea(950, 750, r.outerRadius, r.startAngle, r.arc)).toBeCloseTo(TARGET, 0);
  });

  it('center exactly on the right edge: visible half is a plain edge → capped at R0+5', () => {
    const r = call({ centerX: 1000, centerY: 400 });
    near(r.outerRadius, OUTER + 5, 0.01);
    near(r.arc, Math.PI, 1e-6);
  });

  it('scales innerRadius, ringWidth and meanRadius proportionally', () => {
    const r = call({ centerX: 950, centerY: 750 });
    const s = r.outerRadius / OUTER;
    near(r.innerRadius, INNER * s);
    near(r.ringWidth, (OUTER - INNER) * s);
    near(r.meanRadius, ((OUTER + INNER) / 2) * s);
  });
});

describe('resolveViewportFit — fallback cases do not scale', () => {
  it('visible arc below MIN_EDGE_REALLOCATION_ARC → full geometry at config radius', () => {
    const r = call({ outerRadius: 800, centerX: 500, centerY: 100 });
    near(r.outerRadius, 800);
    near(r.arc, TAU);
  });

  it('center outside the viewport → full geometry at config radius', () => {
    const r = call({ centerX: 500, centerY: 900 });
    near(r.outerRadius, OUTER);
    near(r.arc, TAU);
  });

  it('menu larger than the viewport with no visible arc → config radius', () => {
    const r = call({ outerRadius: 900, centerX: 500, centerY: 400 });
    near(r.outerRadius, 900);
    near(r.arc, TAU);
  });
});

describe('resolveViewportFit — availableArc patterns', () => {
  const right = { startAngle: 3 * Math.PI / 2, arc: Math.PI };
  const topRight = { startAngle: 3 * Math.PI / 2, arc: Math.PI / 2 };

  it('pattern fully placed at center keeps the config radius', () => {
    const r = call({ centerX: 500, centerY: 400, availableArc: right });
    near(r.outerRadius, OUTER);
    near(r.arc, Math.PI);
  });

  it('pattern mirrored near an edge keeps the config radius (area already preserved)', () => {
    const r = call({ centerX: 1000, centerY: 400, availableArc: right });
    near(r.outerRadius, OUTER);
    near(r.arc, Math.PI);
  });

  it('shrunk half-pattern at a corner scales to its nominal bounding area (2R0²)', () => {
    const r = call({ centerX: 10, centerY: 10, availableArc: right });
    expect(r.outerRadius).toBeGreaterThan(OUTER);
    // целевая площадь — bbox паттерна при R0 (положение на площадь не влияет)
    const target = bboxArea(50, 50, OUTER, right.startAngle, right.arc, 'clockwise');
    near(areaOf(10, 10, r), target, 1);
  });

  it('shrunk quarter-pattern scales to its nominal bounding area (R0²)', () => {
    const r = call({ centerX: 10, centerY: 70, availableArc: topRight });
    expect(r.outerRadius).toBeGreaterThan(OUTER);
    const target = bboxArea(50, 50, OUTER, topRight.startAngle, topRight.arc, 'clockwise');
    near(areaOf(10, 70, r), target, 1);
  });

  it('arc never exceeds 2π and stays finite', () => {
    const r = call({ centerX: 950, centerY: 750, availableArc: topRight });
    expect(r.arc).toBeLessThanOrEqual(TAU + 1e-9);
    expect(Number.isFinite(r.outerRadius)).toBe(true);
  });
});

describe('resolveViewportFit — counterclockwise direction', () => {
  it('counterclockwise left edge is capped like a plain edge', () => {
    const r = call({ centerX: 50, centerY: 400, direction: 'counterclockwise' });
    near(r.outerRadius, OUTER + 5);
  });
});