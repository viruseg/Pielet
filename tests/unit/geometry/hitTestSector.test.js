import { describe, it, expect } from 'vitest';
import { getSelectedSector } from '../../../src/geometry/hitTestSector.js';
import { calculateSectorLayout } from '../../../src/geometry/calculateSector.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

function makeGeometry({
  n = 4,
  gap = 0,
  arcStart = 0,
  arcLength = TAU,
  direction = 'clockwise',
  selectable = null,
  outerRadius = 100,
  innerRadius = 30,
  closeDistance = 40
} = {}) {
  const { sectors } = calculateSectorLayout({
    itemCount: n,
    arcStart,
    arcLength,
    outerRadius,
    innerRadius,
    meanRadius: (outerRadius + innerRadius) / 2,
    ringWidth: outerRadius - innerRadius,
    gap,
    direction
  });
  return {
    outerRadius,
    innerRadius,
    closeDistance,
    arcStart,
    arcLength,
    direction,
    sectors,
    selectable: selectable ?? Array.from({ length: n }, () => true)
  };
}

const hit = (geometry, x, y, centerX = 100, centerY = 100) =>
  getSelectedSector({ x, y, centerX, centerY, geometry });

describe('getSelectedSector — regions', () => {
  const geometry = makeGeometry();

  it('center: distance close to 0', () => {
    expect(hit(geometry, 101, 100).region).toBe('center');
  });

  it('center: distance below innerRadius', () => {
    expect(hit(geometry, 100 + 15, 100).region).toBe('center');
  });

  it('outside: distance beyond outerRadius + closeDistance', () => {
    expect(hit(geometry, 100 + 141, 100).region).toBe('outside');
  });

  it('not outside: distance exactly outerRadius + closeDistance → still inside', () => {
    const r = hit(geometry, 100 + 140, 100);
    expect(r.region).not.toBe('outside');
    expect(r.region).toBe('sector');
    expect(r.itemIndex).toBe(0);
  });

  it('not outside: distance between outerRadius and closeDistance', () => {
    expect(hit(geometry, 100 + 130, 100).region).toBe('sector');
  });

  it('sector at 0° (first sector, startAngle 0, clockwise)', () => {
    const r = hit(geometry, 100 + 65, 100);
    expect(r.region).toBe('sector');
    expect(r.itemIndex).toBe(0);
  });

  it('sector at ~91° (clockwise → second sector)', () => {
    const angle = 91 * DEG;
    const r = hit(geometry, 100 + 65 * Math.cos(angle), 100 + 65 * Math.sin(angle));
    expect(r.itemIndex).toBe(1);
  });

  it('sector at ~280° (clockwise → last sector)', () => {
    const angle = 280 * DEG;
    const r = hit(geometry, 100 + 65 * Math.cos(angle), 100 + 65 * Math.sin(angle));
    expect(r.itemIndex).toBe(3);
  });
});

describe('getSelectedSector — boundaries and tie-break', () => {
  it('exactly on the boundary between sector 0 and sector 1 → earlier item wins', () => {
    const geometry = makeGeometry({ n: 4, gap: 0, arcStart: 0 });
    const angle = geometry.sectors[1].start; // точная граница 90°
    const r = hit(geometry, 100 + 65 * Math.cos(angle), 100 + 65 * Math.sin(angle));
    expect(r.region).toBe('sector');
    expect(r.itemIndex).toBe(0);
  });

  it('exactly on arcStart boundary → first sector wins', () => {
    const geometry = makeGeometry({ n: 4, gap: 0, arcStart: 0 });
    const r = hit(geometry, 100 + 65, 100);
    expect(r.itemIndex).toBe(0);
  });

  it('last boundary wraps to first sector', () => {
    const geometry = makeGeometry({ n: 4, gap: 0, arcStart: -90 * DEG });
    // последний сектор заканчивается на -90°, первый начинается там же
    const r = hit(geometry, 100, 100 - 65);
    expect(r.itemIndex).toBe(0);
  });

  it('single item: any ring direction selects it', () => {
    const geometry = makeGeometry({ n: 1 });
    expect(hit(geometry, 100 + 65 * Math.cos(1.2), 100 + 65 * Math.sin(1.2)).itemIndex).toBe(0);
    expect(hit(geometry, 100, 100 - 65).itemIndex).toBe(0);
    expect(hit(geometry, 100 - 65, 100).itemIndex).toBe(0);
  });
});

describe('getSelectedSector — gap', () => {
  it('pointer in the gap between sectors → region gap', () => {
    const geometry = makeGeometry({ n: 4, gap: 8 });
    const gapMid = (geometry.sectors[0].end + geometry.sectors[1].start) / 2;
    const r = hit(geometry, 100 + 65 * Math.cos(gapMid), 100 + 65 * Math.sin(gapMid));
    expect(r.region).toBe('gap');
    expect(r.itemIndex).toBeNull();
  });

  it('pointer exactly on sector/gap boundary → sector wins (inclusive end, outer rim)', () => {
    const geometry = makeGeometry({ n: 4, gap: 8 });
    const angle = geometry.sectors[0].end;
    const r = hit(geometry, 100 + 100 * Math.cos(angle), 100 + 100 * Math.sin(angle));
    expect(r.region).toBe('sector');
    expect(r.itemIndex).toBe(0);
  });

  it('pointer exactly on next sector start → next sector wins (outer rim)', () => {
    const geometry = makeGeometry({ n: 4, gap: 8 });
    const angle = geometry.sectors[1].start;
    const r = hit(geometry, 100 + 100 * Math.cos(angle), 100 + 100 * Math.sin(angle));
    expect(r.itemIndex).toBe(1);
  });

  it('pointer in the gap on the INNER radius → region gap', () => {
    const geometry = makeGeometry({ n: 4, gap: 8 });
    const gapMid = (geometry.sectors[0].innerEnd + geometry.sectors[1].innerStart) / 2;
    const r = hit(geometry, 100 + 40 * Math.cos(gapMid), 100 + 40 * Math.sin(gapMid));
    expect(r.region).toBe('gap');
    expect(r.itemIndex).toBeNull();
  });

  it('pointer in sector on the inner radius → correct sector wins', () => {
    const geometry = makeGeometry({ n: 4, gap: 8 });
    const mid = geometry.sectors[2].mid;
    const r = hit(geometry, 100 + 40 * Math.cos(mid), 100 + 40 * Math.sin(mid));
    expect(r.region).toBe('sector');
    expect(r.itemIndex).toBe(2);
  });

  it('inner gap and outer gap both hold: mid-radius point is still a gap', () => {
    const geometry = makeGeometry({ n: 4, gap: 8 });
    const gapMid = (geometry.sectors[0].innerEnd + geometry.sectors[1].innerStart) / 2;
    const r = hit(geometry, 100 + 65 * Math.cos(gapMid), 100 + 65 * Math.sin(gapMid));
    expect(r.region).toBe('gap');
  });
});

describe('getSelectedSector — none items', () => {
  it('pointer over a none sector → region none, itemIndex preserved', () => {
    const geometry = makeGeometry({ n: 4, gap: 0, selectable: [true, false, true, true] });
    const angle = (geometry.sectors[1].start + geometry.sectors[1].end) / 2;
    const r = hit(geometry, 100 + 65 * Math.cos(angle), 100 + 65 * Math.sin(angle));
    expect(r.region).toBe('none');
    expect(r.itemIndex).toBe(1);
  });

  it('all none: every ring point is region none', () => {
    const geometry = makeGeometry({ n: 3, selectable: [false, false, false] });
    const r = hit(geometry, 100 + 65 * Math.cos(2.1), 100 + 65 * Math.sin(2.1));
    expect(r.region).toBe('none');
  });
});

describe('getSelectedSector — counterclockwise', () => {
  it('counterclockwise: point at top maps to first sector for startAngle -90°', () => {
    const geometry = makeGeometry({ arcStart: -90 * DEG, direction: 'counterclockwise' });
    const r = hit(geometry, 100, 100 - 65);
    expect(r.itemIndex).toBe(0);
  });

  it('counterclockwise: every sector hit at its unfolded mid on the mid radius', () => {
    const geometry = makeGeometry({ arcStart: -90 * DEG, direction: 'counterclockwise', n: 4 });
    // p = arcStart - theta: unfolded p_i = i * nominalSpan
    const nominalSpan = TAU / 4;
    for (let i = 0; i < 4; i++) {
      const p = i * nominalSpan + geometry.sectors[i].span / 2;
      const theta = geometry.arcStart - p;
      const r = hit(geometry, 100 + 65 * Math.cos(theta), 100 + 65 * Math.sin(theta));
      expect(r.itemIndex).toBe(i);
    }
  });

  it('counterclockwise: pointer between the last and first sector at mid radius → gap', () => {
    const geometry = makeGeometry({ arcStart: -90 * DEG, direction: 'counterclockwise', n: 4, gap: 8 });
    const p = 4 * (TAU / 4) - (4 / 100 - 0) / 2; // середина финального зазора
    const theta = geometry.arcStart - p;
    const r = hit(geometry, 100 + 65 * Math.cos(theta), 100 + 65 * Math.sin(theta));
    expect(r.region).toBe('gap');
  });
});

describe('getSelectedSector — edge reflow arcs', () => {
  it('works with a visible arc starting at 240° (left edge reflow)', () => {
    const geometry = makeGeometry({ n: 4, arcStart: 240 * DEG, arcLength: 240 * DEG, gap: 0 });
    const mid = geometry.arcStart + geometry.arcLength / 2;
    const r = hit(geometry, 100 + 65 * Math.cos(mid), 100 + 65 * Math.sin(mid));
    expect(r.region).toBe('sector');
  });
});