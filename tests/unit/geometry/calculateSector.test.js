import { describe, it, expect } from 'vitest';
import { calculateMenuGeometry } from '../../../src/geometry/calculateMenuGeometry.js';
import { calculateSectorLayout, buildSectorClipPath, buildSubmenuArcPath, buildSubmenuChevron, SUBMENU_CHEVRON_PATH, SUBMENU_CHEVRON_VIEWBOX, SUBMENU_CHEVRON_MAX_SIZE, SUBMENU_CHEVRON_SIZE_RATIO, SUBMENU_CHEVRON_EXTERNAL_OFFSET_RATIO } from '../../../src/geometry/calculateSector.js';

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
  const base = {
    arcStart: 0, arcLength: TAU, meanRadius: 78, outerRadius: 120, innerRadius: 36, ringWidth: 84, gap: 4,
    direction: 'clockwise', fit: 'circle'
  };

  it('distributes 4 items evenly over the full circle', () => {
    const { sectors, gapAngle } = calculateSectorLayout({ ...base, itemCount: 4 });
    expect(sectors).toHaveLength(4);
    near(sectors[0].span, TAU / 4 - gapAngle, 1e-9);
    // зазор между соседями — ровно gapAngle, слоты равны
    near(sectors[1].start - sectors[0].end, gapAngle, 1e-9);
    near(sectors[3].end - sectors[0].start, TAU - gapAngle, 1e-9);
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
    const pitch = sectors[0].span + gapAngle;
    // сектор центрирован в своём слоте: видимая часть отступает от границ слота на gapAngle/2
    near(sectors[0].start, arcStart + gapAngle / 2);
    near(sectors[1].start - sectors[0].start, pitch);
    near(sectors[2].start - sectors[1].start, pitch);
    expect(sectors[0].mid).toBeGreaterThan(sectors[0].start);
  });

  it('lays sectors counterclockwise (decreasing angles)', () => {
    const arcStart = -Math.PI / 2;
    const { sectors, gapAngle } = calculateSectorLayout({ ...base, arcStart, direction: 'counterclockwise', itemCount: 3 });
    const pitch = sectors[0].span + gapAngle;
    near(sectors[0].end, arcStart - gapAngle / 2);
    near(sectors[1].end - sectors[0].end, -pitch);
    near(sectors[2].end - sectors[1].end, -pitch);
    expect(sectors[0].start).toBeLessThan(sectors[0].end);
  });

  it('converts gap in px to angle via the OUTER radius so the outer arc distance equals gap', () => {
    const { gapAngle, sectors } = calculateSectorLayout({ ...base, itemCount: 4 });
    near(gapAngle, 4 / 120, 1e-9);
    // точки на внешней дуге ровно на gap px друг от друга
    near((sectors[1].start - sectors[0].end) * 120, 4, 1e-9);
  });

  it('inner arc distance equals gap too (independent inner arc angles)', () => {
    const { sectors, gapAngleInner } = calculateSectorLayout({ ...base, itemCount: 4 });
    near(gapAngleInner, 4 / 36, 1e-9);
    near(sectors[0].spanInner, TAU / 4 - 4 / 36, 1e-9);
    near(sectors[1].spanInner, TAU / 4 - 4 / 36, 1e-9);
    // точки на ВНУТРЕННЕЙ дуге ровно на gap px друг от друга
    near((sectors[1].innerStart - sectors[0].innerEnd) * 36, 4, 1e-9);
  });

  it('inner and outer arcs share the same mid; inner span is narrower', () => {
    const { sectors } = calculateSectorLayout({ ...base, itemCount: 4 });
    near(sectors[0].mid, (sectors[0].start + sectors[0].end) / 2, 1e-9);
    near(sectors[0].mid, (sectors[0].innerStart + sectors[0].innerEnd) / 2, 1e-9);
    expect(sectors[0].spanInner).toBeLessThan(sectors[0].span);
    expect(sectors[0].innerStart).toBeGreaterThan(sectors[0].start);
    expect(sectors[0].innerEnd).toBeLessThan(sectors[0].end);
  });

  it('property: inner spans + N * gapAngleInner equal the available arc for any N', () => {
    for (let n = 1; n <= 12; n++) {
      const { sectors, gapAngleInner } = calculateSectorLayout({ ...base, itemCount: n });
      const sum = sectors.reduce((acc, s) => acc + s.spanInner, 0);
      near(sum + n * gapAngleInner, TAU, 1e-9);
    }
  });

  it('zero gap: inner and outer arcs coincide', () => {
    const { sectors } = calculateSectorLayout({ ...base, gap: 0, itemCount: 3 });
    near(sectors[0].spanInner, sectors[0].span, 1e-9);
    near(sectors[0].innerStart, sectors[0].start, 1e-9);
    near(sectors[0].innerEnd, sectors[0].end, 1e-9);
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

  it('circle fit: content box is an inscribed square of the safe zone', () => {
    const { sectors } = calculateSectorLayout({ ...base, itemCount: 4 });
    const r1 = (120 - 36) / 2;
    const r2 = (120 * Math.sin(sectors[0].span / 2)) / (1 + Math.sin(sectors[0].span / 2));
    const safe = Math.min(r1, r2);
    near(sectors[0].safeRadius, safe, 1e-9);
    near(sectors[0].contentRadius, 120 - safe, 1e-9);
    near(sectors[0].availWidth, safe * Math.SQRT2, 1e-9);
    near(sectors[0].availHeight, safe * Math.SQRT2, 1e-9);
    expect(sectors[0].rotate).toBe(false);
  });

  it('circle fit: side-limited sector uses r2 (many items)', () => {
    const { sectors } = calculateSectorLayout({ ...base, itemCount: 12 });
    const r1 = (120 - 36) / 2;
    const r2 = (120 * Math.sin(sectors[0].span / 2)) / (1 + Math.sin(sectors[0].span / 2));
    const safe = Math.min(r1, r2);
    expect(r2).toBeLessThan(r1);
    near(sectors[0].safeRadius, r2, 1e-9);
    near(sectors[0].contentRadius, 120 - r2, 1e-9);
    near(sectors[0].availWidth, safe * Math.SQRT2, 1e-9);
  });

  it('square fit: radial box rotated with the sector (chord/ring swapped)', () => {
    const { sectors } = calculateSectorLayout({ ...base, fit: 'square', itemCount: 4 });
    // после поворота ширина ложится вдоль радиуса (кольцо), высота — вдоль дуги (хорда)
    near(sectors[0].availWidth, 84 * 0.85, 1e-9);
    near(sectors[0].availHeight, 2 * 78 * Math.sin(sectors[0].span / 2) * 0.85, 1e-9);
    near(sectors[0].contentRadius, 78, 1e-9);
    expect(sectors[0].rotate).toBe(true);
  });

  it('square fit: single item full ring uses the diameter for the tangential extent', () => {
    const { sectors } = calculateSectorLayout({ ...base, fit: 'square', itemCount: 1 });
    near(sectors[0].availWidth, 84 * 0.85, 1e-9);
    near(sectors[0].availHeight, 2 * 78 * 0.85, 1e-9);
    expect(sectors[0].rotate).toBe(true);
  });

  it('square fit: flips captions in the left half of the circle so text reads from outer to inner', () => {
    const { sectors } = calculateSectorLayout({ ...base, fit: 'square', itemCount: 4 });
    // clockwise от 0: оси секторов на 45°, 135°, 225°, 315°
    near(sectors[0].mid, Math.PI / 4, 1e-9);
    expect(sectors[0].flip).toBe(false); // правая половина (cos > 0)
    expect(sectors[1].flip).toBe(true);  // левая половина (cos < 0)
    expect(sectors[2].flip).toBe(true);  // левая половина (cos < 0)
    expect(sectors[3].flip).toBe(false); // правая половина (cos > 0)
  });

  it('square fit: right-side sector at startAngle -90 stays unflipped, left-side flips', () => {
    const arcStart = -Math.PI / 2;
    const { sectors } = calculateSectorLayout({ ...base, fit: 'square', arcStart, itemCount: 2 });
    // оси секторов на 0° (справа) и 180° (слева)
    near(sectors[0].mid, 0, 1e-9);
    near(((sectors[1].mid % TAU) + TAU) % TAU, Math.PI, 1e-9);
    expect(sectors[0].flip).toBe(false);
    expect(sectors[1].flip).toBe(true);
  });

  it('circle fit: never flips content (it is not rotated)', () => {
    const { sectors } = calculateSectorLayout({ ...base, itemCount: 4 });
    for (const s of sectors) expect(s.flip).toBe(false);
  });

  it('computes relStart for hit testing (clockwise: positive offsets)', () => {
    const { sectors, gapAngle } = calculateSectorLayout({ ...base, itemCount: 4 });
    const stepq = sectors[0].span + gapAngle;
    near(sectors[0].relStart, 0);
    near(sectors[1].relStart, stepq);
    near(sectors[2].relStart, 2 * stepq);
  });

  it('computes relStart for hit testing (counterclockwise: positive offsets in unfolded p-space)', () => {
    const { sectors } = calculateSectorLayout({ ...base, direction: 'counterclockwise', itemCount: 4 });
    const stepq = sectors[0].span + 4 / 120; // gapAngle (внешний)
    near(sectors[0].relStart, 0);
    near(sectors[1].relStart, stepq);
    near(sectors[2].relStart, 2 * stepq);
  });
});

describe('sector alignment: gap lines and content centers', () => {
  const DEG = Math.PI / 180;
  const base = {
    arcStart: 0, arcLength: TAU, meanRadius: 78, outerRadius: 120, innerRadius: 36, ringWidth: 84, gap: 4,
    direction: 'clockwise'
  };

  it('2 items at startAngle -90: content centers on the horizontal axis through the menu center', () => {
    const arcStart = -Math.PI / 2;
    const { sectors } = calculateSectorLayout({ ...base, arcStart, itemCount: 2 });
    near(sectors[0].mid, 0, 1e-9);
    near(sectors[1].mid, Math.PI, 1e-9);
  });

  it('2 items at startAngle -90: the gap is centered on the vertical line (90° and 270°)', () => {
    const arcStart = -Math.PI / 2;
    const { sectors } = calculateSectorLayout({ ...base, arcStart, itemCount: 2 });
    // зазор между секторами 0 и 1 симметричен относительно границы слотов (вертикальная линия 90°)
    const boundary = Math.PI / 2;
    near(sectors[0].end + sectors[1].start, 2 * boundary, 1e-9);
    near(sectors[0].innerEnd + sectors[1].innerStart, 2 * boundary, 1e-9);
    // «стык» сектор 1 → сектор 0 (через 2π) симметричен относительно 270°
    const wrap = (sectors[1].end + sectors[0].start + TAU) / 2;
    near(wrap % TAU, 3 * Math.PI / 2, 1e-9);
  });

  it('4 items at startAngle -90: every gap is centered on its slot boundary (vertical/horizontal lines)', () => {
    const arcStart = -Math.PI / 2;
    const { sectors } = calculateSectorLayout({ ...base, arcStart, itemCount: 4 });
    const pitch = TAU / 4;
    for (let i = 0; i < 4; i++) {
      const boundary = (arcStart + (i + 1) * pitch) % TAU;
      const s = sectors[i];
      const n = sectors[(i + 1) % 4];
      const outerSum = i < 3 ? s.end + n.start : s.end + n.start + TAU;
      const innerSum = i < 3 ? s.innerEnd + n.innerStart : s.innerEnd + n.innerStart + TAU;
      near((outerSum / 2) % TAU, boundary, 1e-6);
      near((innerSum / 2) % TAU, boundary, 1e-6);
    }
  });

  it('4 items at startAngle -90: content centers on slot axes (-45°, 45°, 135°, 225°)', () => {
    const arcStart = -Math.PI / 2;
    const { sectors } = calculateSectorLayout({ ...base, arcStart, itemCount: 4 });
    const expected = [-45, 45, 135, 225].map((d) => d * DEG);
    sectors.forEach((s, i) => near(s.mid, expected[i], 1e-9));
  });

  it('counterclockwise mirrors the alignment (2 items: centers on the horizontal axis)', () => {
    const arcStart = -Math.PI / 2;
    const { sectors } = calculateSectorLayout({ ...base, arcStart, direction: 'counterclockwise', itemCount: 2 });
    near(((sectors[0].mid % TAU) + TAU) % TAU, Math.PI, 1e-9);
    near(((sectors[1].mid % TAU) + TAU) % TAU, 0, 1e-9);
  });
});

describe('calculateSectorLayout — single item (itemCount === 1)', () => {
  const base = {
    arcStart: 0, arcLength: TAU, meanRadius: 78, outerRadius: 120, innerRadius: 36, ringWidth: 84, gap: 4,
    direction: 'clockwise', fit: 'circle'
  };

  it('draws no gap: gapAngle and gapAngleInner are 0 even with gap > 0', () => {
    const { gapAngle, gapAngleInner } = calculateSectorLayout({ ...base, itemCount: 1 });
    near(gapAngle, 0, 1e-9);
    near(gapAngleInner, 0, 1e-9);
  });

  it('the single sector covers the whole available arc', () => {
    const { sectors } = calculateSectorLayout({ ...base, itemCount: 1 });
    near(sectors[0].span, TAU, 1e-9);
    near(sectors[0].spanInner, TAU, 1e-9);
    near(sectors[0].start, base.arcStart, 1e-9);
    near(sectors[0].end, base.arcStart + TAU, 1e-9);
    near(sectors[0].innerStart, base.arcStart, 1e-9);
    near(sectors[0].innerEnd, base.arcStart + TAU, 1e-9);
  });

  it('single item with a partial arc (edge reflow) covers exactly that arc', () => {
    const { sectors } = calculateSectorLayout({ ...base, arcLength: Math.PI / 2, itemCount: 1 });
    near(sectors[0].span, Math.PI / 2, 1e-9);
    near(sectors[0].start, 0, 1e-9);
    near(sectors[0].end, Math.PI / 2, 1e-9);
  });

  it('content mid sits on the arcStart ray: at startAngle -90 the label is on top', () => {
    const arcStart = -Math.PI / 2;
    const { sectors } = calculateSectorLayout({ ...base, arcStart, itemCount: 1 });
    near(sectors[0].mid, arcStart, 1e-9);
    near(sectors[0].mid, -Math.PI / 2, 1e-9);
  });

  it('full ring gives a full-diameter content box instead of a degenerate chord', () => {
    const { sectors } = calculateSectorLayout({ ...base, itemCount: 1 });
    // circle fit: безопасная зона ограничена только кольцом (r2 вырождается)
    near(sectors[0].safeRadius, (120 - 36) / 2, 1e-9);
    near(sectors[0].contentRadius, 78, 1e-9);
    near(sectors[0].availWidth, ((120 - 36) / 2) * Math.SQRT2, 1e-9);
    expect(sectors[0].availWidth).toBeGreaterThan(0);
  });

  it('partial arc keeps the side-limited safe zone for circle fit', () => {
    const { sectors } = calculateSectorLayout({ ...base, arcLength: 4 * Math.PI / 3, itemCount: 1 });
    const span = sectors[0].span;
    const r2 = (120 * Math.sin(span / 2)) / (1 + Math.sin(span / 2));
    const r1 = (120 - 36) / 2;
    const safe = Math.min(r1, r2);
    near(sectors[0].safeRadius, safe, 1e-9);
    near(sectors[0].availWidth, safe * Math.SQRT2, 1e-9);
  });
});

describe('buildSectorClipPath', () => {
  it('returns a polygon with px points on outer and inner radii', () => {
    const sector = { start: 0, end: Math.PI / 2, innerStart: 0, innerEnd: Math.PI / 2 };
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

  it('inner arc uses innerStart/innerEnd angles (scant sector inner bounds)', () => {
    const sector = { start: 0, end: Math.PI / 2, innerStart: Math.PI / 8, innerEnd: 3 * Math.PI / 8 };
    const path = buildSectorClipPath(sector, 120, 36);
    const nums = path.match(/[\d.]+px/g).map((s) => parseFloat(s));
    const points = [];
    for (let i = 0; i < nums.length; i += 2) points.push([nums[i], nums[i + 1]]);
    // внутренняя дуга рисуется от innerEnd к innerStart (обратное направление)
    const half = Math.floor(points.length / 2);
    const firstInner = points[half];
    expect(Math.hypot(firstInner[0] - 120, firstInner[1] - 120)).toBeCloseTo(36, 1);
    expect(Math.atan2(firstInner[1] - 120, firstInner[0] - 120)).toBeCloseTo(3 * Math.PI / 8, 2);
    const last = points[points.length - 1];
    expect(Math.hypot(last[0] - 120, last[1] - 120)).toBeCloseTo(36, 1);
    expect(Math.atan2(last[1] - 120, last[0] - 120)).toBeCloseTo(Math.PI / 8, 2);
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

describe('buildSubmenuArcPath', () => {
  const arcPoints = (d) => {
    const nums = d.match(/-?[\d.]+/g).map(Number);
    const pts = [];
    for (let i = 0; i < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    return pts;
  };

  it('draws a polyline arc at the requested radius from start to end', () => {
    const sector = { start: 0, end: Math.PI / 2, innerStart: 0, innerEnd: Math.PI / 2 };
    const d = buildSubmenuArcPath(sector, 39, 120);
    expect(d.startsWith('M ')).toBe(true);
    const pts = arcPoints(d);
    expect(pts.length).toBeGreaterThanOrEqual(9);
    for (const [x, y] of pts) {
      expect(Math.hypot(x - 120, y - 120)).toBeCloseTo(39, 1);
    }
    // первая точка — под углом start (0° → справа), последняя — под углом end
    expect(pts[0][0]).toBeCloseTo(159, 1);
    expect(pts[0][1]).toBeCloseTo(120, 1);
    expect(Math.atan2(pts[pts.length - 1][1] - 120, pts[pts.length - 1][0] - 120)).toBeCloseTo(Math.PI / 2, 2);
  });

  it('uses innerStart/innerEnd angles when provided', () => {
    const sector = { start: 0, end: Math.PI / 2, innerStart: Math.PI / 8, innerEnd: 3 * Math.PI / 8 };
    const pts = arcPoints(buildSubmenuArcPath(sector, 39, 120));
    expect(Math.atan2(pts[0][1] - 120, pts[0][0] - 120)).toBeCloseTo(Math.PI / 8, 2);
    expect(Math.atan2(pts[pts.length - 1][1] - 120, pts[pts.length - 1][0] - 120)).toBeCloseTo(3 * Math.PI / 8, 2);
  });

  it('returns an empty path for a degenerate span', () => {
    expect(buildSubmenuArcPath({ start: 0, end: 1e-12 }, 39, 120)).toBe('');
  });
});

describe('buildSubmenuChevron', () => {
  it('sizes the chevron proportionally to the ring width, capped at SUBMENU_CHEVRON_MAX_SIZE', () => {
    // default ring (240/72): 84 * SIZE_RATIO = 15.12 -> cap at MAX_SIZE
    expect(buildSubmenuChevron(0, 120, 36).size).toBe(SUBMENU_CHEVRON_MAX_SIZE);
    // size=120/centerSize=24 ring: 48 * SIZE_RATIO = 8.64
    expect(buildSubmenuChevron(0, 60, 12).size).toBeCloseTo((60 - 12) * SUBMENU_CHEVRON_SIZE_RATIO, 5);
    // very wide ring: capped
    expect(buildSubmenuChevron(0, 240, 10).size).toBe(SUBMENU_CHEVRON_MAX_SIZE);
  });

  it('places the chevron center just outside the outer radius (at the rim)', () => {
    // центр шеврона: outerRadius + size*EXTERNAL_OFFSET_RATIO — чуть за внешним краем кольца
    const g = buildSubmenuChevron(0, 60, 12);
    expect(g.radius).toBeCloseTo(60 + g.size * SUBMENU_CHEVRON_EXTERNAL_OFFSET_RATIO, 5);
    expect(g.radius).toBeGreaterThan(60);
    expect(g.x).toBeCloseTo(60 + g.radius, 5);
    expect(g.y).toBeCloseTo(60, 5);
  });

  it('keeps the chevron outside the rim: inner edge flush with the outer radius, outer edge beyond it', () => {
    // центр — на EXTERNAL_OFFSET_RATIO·size за кольцом, поэтому
    // radius − size/2 == outerRadius − size*(0.5 − EXTERNAL_OFFSET_RATIO)
    for (const [outer, inner] of [[120, 36], [60, 12], [240, 10], [90, 30]]) {
      const g = buildSubmenuChevron(Math.PI / 5, outer, inner);
      expect(g.radius - g.size / 2).toBeCloseTo(outer - g.size * (0.5 - SUBMENU_CHEVRON_EXTERNAL_OFFSET_RATIO), 5);
      expect(g.radius - g.size / 2).toBeLessThanOrEqual(outer);
      expect(g.radius + g.size / 2).toBeGreaterThan(outer);
    }
  });

  it('points the chevron radially outward along the sector mid angle', () => {
    const mid = Math.PI / 3;
    const g = buildSubmenuChevron(mid, 100, 30);
    expect(g.deg).toBeCloseTo((mid * 180) / Math.PI, 5);
    const dir = Math.atan2(g.y - 100, g.x - 100);
    expect(dir).toBeCloseTo(mid, 5);
    expect(g.x).toBeCloseTo(100 + g.radius * Math.cos(mid), 5);
    expect(g.y).toBeCloseTo(100 + g.radius * Math.sin(mid), 5);
  });
});

describe('buildSubmenuChevron — alignment of chevron centers across sectors', () => {
  const base = {
    arcStart: 0, arcLength: TAU, meanRadius: 78, outerRadius: 120, innerRadius: 36, ringWidth: 84, gap: 4,
    direction: 'clockwise'
  };

  it('2 items at startAngle -90: both chevrons lie on the horizontal line (same y = menu center)', () => {
    const { sectors } = calculateSectorLayout({ ...base, arcStart: -Math.PI / 2, itemCount: 2 });
    const a = buildSubmenuChevron(sectors[0].mid, 120, 36);
    const b = buildSubmenuChevron(sectors[1].mid, 120, 36);
    expect(a.y).toBeCloseTo(b.y, 9);
    expect(a.y).toBeCloseTo(120, 9);
  });

  for (const fit of ['circle', 'square']) {
    it(`4 items at startAngle -135 (fit=${fit}): two chevrons on the horizontal line, two on the vertical line`, () => {
      const arcStart = (-135 * Math.PI) / 180;
      const { sectors } = calculateSectorLayout({ ...base, fit, arcStart, itemCount: 4 });
      const chevrons = sectors.map((s) => buildSubmenuChevron(s.mid, 120, 36));
      // mid секторов: -90° (0), 0° (1), 90° (2), 180° (3)
      // вертикальная пара (0 и 2) — одинаковый X, горизонтальная пара (1 и 3) — одинаковый Y
      expect(chevrons[0].x).toBeCloseTo(chevrons[2].x, 9);
      expect(chevrons[1].y).toBeCloseTo(chevrons[3].y, 9);
      // все четыре центра — на одном радиальном расстоянии (одна окружность)
      const radii = chevrons.map((c) => Math.hypot(c.x - 120, c.y - 120));
      for (const r of radii) expect(r).toBeCloseTo(chevrons[0].radius, 9);
    });
  }

  it('chevron geometry does not depend on fit (identical x/y/size for the same sectors)', () => {
    const arcStart = (-135 * Math.PI) / 180;
    const circle = calculateSectorLayout({ ...base, fit: 'circle', arcStart, itemCount: 4 });
    const square = calculateSectorLayout({ ...base, fit: 'square', arcStart, itemCount: 4 });
    for (let i = 0; i < 4; i++) {
      const c = buildSubmenuChevron(circle.sectors[i].mid, 120, 36);
      const s = buildSubmenuChevron(square.sectors[i].mid, 120, 36);
      expect(s).toEqual(c);
    }
  });
});

describe('SUBMENU_CHEVRON_PATH — SVG glyph geometry (replaces text chevron "›")', () => {
  const nums = () => SUBMENU_CHEVRON_PATH.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const pts = () => {
    const n = nums();
    const out = [];
    for (let i = 0; i < n.length; i += 2) out.push([n[i], n[i + 1]]);
    return out;
  };

  it('is symmetric about the horizontal center line of the viewBox (guarantees visual y-alignment of the horizontally-paired chevrons)', () => {
    // Текстовый глиф '›' имеет метрический сдвиг внутри своего бокса, поэтому
    // шевроны на mid=0 и mid=π визуально уходят с общей горизонтальной линии.
    // SVG-глиф должен быть симметричен относительно горизонтальной оси бокса,
    // тогда его визуальный центр лежит точно на линии (как и у бокса).
    const [vx, vy, vw, vh] = SUBMENU_CHEVRON_VIEWBOX.split(' ').map(Number);
    const cy = vy + vh / 2;
    const points = pts();
    expect(points.length).toBeGreaterThanOrEqual(3);
    for (const [x, y] of points) {
      if (Math.abs(y - cy) < 1e-9) continue; // точка на оси — сама себе пара
      const mirrored = points.some(([mx, my]) => Math.abs(mx - x) < 1e-9 && Math.abs(my - (2 * cy - y)) < 1e-9);
      expect(mirrored).toBe(true);
    }
  });

  it('stays inside the viewBox with room for the stroke (not clipped by the svg box)', () => {
    const [vx, vy, vw, vh] = SUBMENU_CHEVRON_VIEWBOX.split(' ').map(Number);
    const n = nums();
    for (let i = 0; i < n.length; i++) {
      expect(n[i]).toBeGreaterThanOrEqual(vx);
      expect(n[i]).toBeLessThanOrEqual(vx + vw);
    }
    // и рисуется «вправо» (вершина правее точек основания — узнаваемый шеврон)
    const xs = n.filter((_, i) => i % 2 === 0);
    expect(Math.max(...xs)).toBe(xs[1]);
  });
});