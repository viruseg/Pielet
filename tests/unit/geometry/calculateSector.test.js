import { describe, it, expect } from 'vitest';
import { calculateMenuGeometry } from '../../../src/geometry/calculateMenuGeometry.js';
import { calculateSectorLayout, buildSectorClipPath } from '../../../src/geometry/calculateSector.js';

const TAU = Math.PI * 2;
const near = (a, b, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('calculateMenuGeometry', () => {
  it('computes radii from config', () => {
    const g = calculateMenuGeometry({ size: 240, centerSize: 72 });
    near(g.outerRadius, 120);
    near(g.innerRadius, 36);
    near(g.ringWidth, 84);
    near(g.meanRadius, 78);
  });

  it('handles thin ring', () => {
    const g = calculateMenuGeometry({ size: 100, centerSize: 90 });
    near(g.outerRadius, 50);
    near(g.innerRadius, 45);
    near(g.ringWidth, 5);
    near(g.meanRadius, 47.5);
  });
});

describe('calculateSectorLayout', () => {
  const base = { arcStart: 0, arcLength: TAU, meanRadius: 78, ringWidth: 84, gap: 4, direction: 'clockwise' };

  it('distributes 4 items evenly over the full circle', () => {
    const { sectors, gapAngle } = calculateSectorLayout({ ...base, itemCount: 4 });
    expect(sectors).toHaveLength(4);
    near(sectors[0].start, 0);
    near(sectors[0].span, TAU / 4 - gapAngle, 1e-9);
    near(sectors[1].start, sectors[0].end + gapAngle, 1e-9);
    near(sectors[3].end, TAU - gapAngle, 1e-9);
  });

  it('property: sum of spans + N * gapAngle equals available arc for any N', () => {
    for (let n = 1; n <= 12; n++) {
      const { sectors, gapAngle } = calculateSectorLayout({ ...base, itemCount: n });
      const sum = sectors.reduce((acc, s) => acc + s.span, 0);
      near(sum + n * gapAngle, TAU, 1e-9);
    }
  });

  it('property: sum of spans + N * gapAngle equals visible arc for any N', () => {
    for (let n = 1; n <= 12; n++) {
      const { sectors, gapAngle } = calculateSectorLayout({
        ...base, arcStart: Math.PI, arcLength: Math.PI / 2, itemCount: n
      });
      const sum = sectors.reduce((acc, s) => acc + s.span, 0);
      near(sum + n * gapAngle, Math.PI / 2, 1e-9);
    }
  });

  it('lays sectors clockwise from arcStart', () => {
    const arcStart = -Math.PI / 2;
    const { sectors, gapAngle } = calculateSectorLayout({ ...base, arcStart, itemCount: 3 });
    const stepq = sectors[0].span + gapAngle;
    near(sectors[0].start, arcStart);
    near(sectors[1].start, arcStart + stepq);
    near(sectors[2].start, arcStart + 2 * stepq);
    expect(sectors[0].mid).toBeGreaterThan(sectors[0].start);
  });

  it('lays sectors counterclockwise (decreasing angles)', () => {
    const arcStart = -Math.PI / 2;
    const { sectors, gapAngle } = calculateSectorLayout({ ...base, arcStart, direction: 'counterclockwise', itemCount: 3 });
    const stepq = sectors[0].span + gapAngle;
    near(sectors[0].end, arcStart);
    near(sectors[1].end, arcStart - stepq);
    near(sectors[2].end, arcStart - 2 * stepq);
    expect(sectors[0].start).toBeLessThan(sectors[0].end);
  });

  it('converts gap in px to angle via mean radius', () => {
    const { gapAngle } = calculateSectorLayout({ ...base, itemCount: 4 });
    near(gapAngle, 4 / 78, 1e-9);
  });

  it('shrinks gap proportionally when it does not fit', () => {
    const hugeGap = calculateSectorLayout({ ...base, gap: 500, itemCount: 8 });
    near(hugeGap.gapAngle, (TAU / 8) * 0.5, 1e-9);
    near(hugeGap.sectors[0].span, (TAU / 8) * 0.5, 1e-9);
    const sum = hugeGap.sectors.reduce((acc, s) => acc + s.span, 0);
    near(sum, TAU - 8 * hugeGap.gapAngle, 1e-9);
  });

  it('keeps sectors positive even with extreme gap', () => {
    const { sectors } = calculateSectorLayout({ ...base, gap: Number.MAX_SAFE_INTEGER, itemCount: 2 });
    expect(sectors.every((s) => s.span > 0)).toBe(true);
  });

  it('zero gap gives adjacent sectors without spacing', () => {
    const { gapAngle, sectors } = calculateSectorLayout({ ...base, gap: 0, itemCount: 3 });
    near(gapAngle, 0);
    near(sectors[1].start, sectors[0].end, 1e-9);
  });

  it('computes content box from mean radius and ring width', () => {
    const { sectors } = calculateSectorLayout({ ...base, itemCount: 4 });
    near(sectors[0].availWidth, 2 * 78 * Math.sin(sectors[0].span / 2) * 0.85, 1e-9);
    near(sectors[0].availHeight, 84 * 0.85, 1e-9);
    expect(sectors[0].availWidth).toBeGreaterThan(0);
    expect(sectors[0].availHeight).toBeGreaterThan(0);
  });

  it('computes relStart for hit testing (clockwise: positive offsets)', () => {
    const { sectors, gapAngle } = calculateSectorLayout({ ...base, itemCount: 4 });
    const stepq = sectors[0].span + gapAngle;
    near(sectors[0].relStart, 0);
    near(sectors[1].relStart, stepq);
    near(sectors[2].relStart, 2 * stepq);
  });

  it('computes relStart for hit testing (counterclockwise: negative offsets)', () => {
    const { sectors, gapAngle } = calculateSectorLayout({ ...base, direction: 'counterclockwise', itemCount: 4 });
    const stepq = sectors[0].span + gapAngle;
    near(sectors[0].relStart, 0);
    near(sectors[1].relStart, -stepq);
    near(sectors[2].relStart, -2 * stepq);
  });
});

describe('buildSectorClipPath', () => {
  it('returns a polygon with px points on outer and inner radii', () => {
    const sector = { start: 0, end: Math.PI / 2 };
    const path = buildSectorClipPath(sector, 120, 36);
    expect(path.startsWith('polygon(')).toBe(true);
    expect(path.endsWith('px)')).toBe(true);
    const nums = path.match(/[\d.]+px/g).map((s) => parseFloat(s));
    const points = [];
    for (let i = 0; i < nums.length; i += 2) points.push([nums[i], nums[i + 1]]);
    expect(points[0][0]).toBeCloseTo(240, 1);
    expect(points[0][1]).toBeCloseTo(120, 1);
    const last = points[points.length - 1];
    expect(last[0]).toBeCloseTo(156, 1);
    expect(last[1]).toBeCloseTo(120, 1);
    for (const [x, y] of points) {
      const d = Math.hypot(x - 120, y - 120);
      expect(d).toBeGreaterThanOrEqual(35.5);
      expect(d).toBeLessThanOrEqual(120.5);
    }
  });

  it('has at least 8 segments per arc', () => {
    const path = buildSectorClipPath({ start: 0, end: Math.PI / 2 }, 120, 36);
    const count = path.match(/px/g).length / 2;
    expect(count).toBeGreaterThanOrEqual(2 * 9);
  });

  it('handles sectors spanning across 2π', () => {
    const path = buildSectorClipPath({ start: 3 * Math.PI / 2, end: 3 * Math.PI / 2 + Math.PI / 4 }, 100, 20);
    expect(path.startsWith('polygon(')).toBe(true);
  });
});