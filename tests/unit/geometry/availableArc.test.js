import { describe, it, expect } from 'vitest';
import { resolveAvailableArc } from '../../../src/geometry/availableArc.js';

const TAU = Math.PI * 2;
const HALF = Math.PI;
const QUARTER = Math.PI / 2;

const near = (a, b, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('resolveAvailableArc', () => {
  it('resolves each single half', () => {
    near(resolveAvailableArc(['right']).startAngle, 3 * QUARTER);
    near(resolveAvailableArc(['right']).arc, HALF);
    near(resolveAvailableArc(['bottom']).startAngle, 0);
    near(resolveAvailableArc(['bottom']).arc, HALF);
    near(resolveAvailableArc(['left']).startAngle, QUARTER);
    near(resolveAvailableArc(['left']).arc, HALF);
    near(resolveAvailableArc(['top']).startAngle, HALF);
    near(resolveAvailableArc(['top']).arc, HALF);
  });

  it('resolves each single quarter', () => {
    near(resolveAvailableArc(['top-right']).startAngle, 3 * QUARTER);
    near(resolveAvailableArc(['top-right']).arc, QUARTER);
    near(resolveAvailableArc(['bottom-right']).startAngle, 0);
    near(resolveAvailableArc(['bottom-right']).arc, QUARTER);
    near(resolveAvailableArc(['bottom-left']).startAngle, QUARTER);
    near(resolveAvailableArc(['bottom-left']).arc, QUARTER);
    near(resolveAvailableArc(['top-left']).startAngle, HALF);
    near(resolveAvailableArc(['top-left']).arc, QUARTER);
  });

  it('merges overlapping parts into one arc', () => {
    const r = resolveAvailableArc(['top', 'right']);
    near(r.startAngle, HALF);
    near(r.arc, 3 * QUARTER);
  });

  it('merges clockwise-adjacent parts', () => {
    const r = resolveAvailableArc(['bottom-left', 'top-left']);
    near(r.startAngle, QUARTER);
    near(r.arc, HALF);
  });

  it('dedupes repeated parts', () => {
    const r = resolveAvailableArc(['right', 'right']);
    near(r.startAngle, 3 * QUARTER);
    near(r.arc, HALF);
  });

  it('returns null for the full circle', () => {
    expect(resolveAvailableArc(['right', 'left'])).toBeNull();
    expect(resolveAvailableArc(['top', 'bottom'])).toBeNull();
    expect(resolveAvailableArc(['top-right', 'bottom-right', 'bottom-left', 'top-left'])).toBeNull();
    expect(resolveAvailableArc(['top', 'right', 'left'])).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(resolveAvailableArc([])).toBeNull();
  });
});