/**
 * Edge-aware геометрия: определение видимой дуги внешней окружности меню
 * внутри viewport. Чистая математика, без DOM.
 *
 * Центр меню никогда не перемещается (open(x, y) фиксирует его).
 * Если круг выходит за границы viewport, пункты перераспределяются по
 * наибольшей непрерывной видимой дуге; если полезная дуга меньше
 * MIN_EDGE_REALLOCATION_ARC — используется обычная геометрия полного круга.
 */

import { DIRECTIONS } from '../config/constants.js';

const TAU = Math.PI * 2;
const EPS = 1e-9;

/**
 * Минимальная длина видимой дуги (в радианах), при которой выполняется
 * перераспределение пунктов. Меньше четверти круга — полная геометрия.
 * @type {number}
 */
export const MIN_EDGE_REALLOCATION_ARC = Math.PI / 2;

/**
 * Углы, где cos θ >= k (k в [-1, 1]).
 * @param {number} k
 * @returns {Array<[number, number]>}
 */
function cosAtLeast(k) {
    if (k <= -1) return [[0, TAU]];
    if (k >= 1) return [];
    const a = Math.acos(k);
    return [[TAU - a, TAU], [0, a]];
}

/**
 * Углы, где cos θ <= m (m в [-1, 1]).
 * @param {number} m
 * @returns {Array<[number, number]>}
 */
function cosAtMost(m) {
    if (m >= 1) return [[0, TAU]];
    if (m <= -1) return [];
    const a = Math.acos(m);
    return [[a, TAU - a]];
}

/**
 * Углы, где sin θ >= k (k в [-1, 1]).
 * @param {number} k
 * @returns {Array<[number, number]>}
 */
function sinAtLeast(k) {
    if (k <= -1) return [[0, TAU]];
    if (k >= 1) return [];
    const a = Math.asin(k);
    if (a >= 0) return [[a, Math.PI - a]];
    return [[0, Math.PI - a], [TAU + a, TAU]];
}

/**
 * Углы, где sin θ <= m (m в [-1, 1]).
 * @param {number} m
 * @returns {Array<[number, number]>}
 */
function sinAtMost(m) {
    if (m >= 1) return [[0, TAU]];
    if (m <= -1) return [];
    const a = Math.asin(m);
    if (a >= 0) return [[0, a], [Math.PI - a, TAU]];
    return [[Math.PI - a, TAU + a]];
}

/**
 * Сортирует и склеивает пересекающиеся интервалы.
 * @param {Array<[number, number]>} intervals
 * @returns {Array<[number, number]>}
 */
function mergeIntervals(intervals) {
    const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const [s, e] of sorted) {
        if (e - s <= EPS) continue;
        const last = out[out.length - 1];
        if (last && s <= last[1]) {
            last[1] = Math.max(last[1], e);
        } else {
            out.push([s, e]);
        }
    }
    return out;
}

/**
 * Пересечение двух наборов интервалов.
 * @param {Array<[number, number]>} a
 * @param {Array<[number, number]>} b
 * @returns {Array<[number, number]>}
 */
function intersectIntervals(a, b) {
    const out = [];
    for (const [s1, e1] of a) {
        for (const [s2, e2] of b) {
            const s = Math.max(s1, s2);
            const e = Math.min(e1, e2);
            if (e - s > EPS) out.push([s, e]);
        }
    }
    return mergeIntervals(out);
}

/**
 * Круговое расстояние между двумя углами (радианы).
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function circularDistance(a, b) {
    const raw = Math.abs(((a - b) % TAU) + TAU) % TAU;
    return Math.min(raw, TAU - raw);
}

/**
 * Ближайшая к `center` точка интервала [lo, hi] (unwrapped-координаты,
 * hi - lo <= TAU), с учётом периодичности углов по кругу.
 * @param {number} lo
 * @param {number} hi
 * @param {number} center
 * @returns {number}
 */
function clampToWindow(lo, hi, center) {
    let best = null;
    let bestDist = Infinity;
    for (const shift of [-TAU, 0, TAU]) {
        const p = center + shift;
        const c = Math.min(hi, Math.max(lo, p));
        const d = Math.abs(c - p);
        if (d < bestDist) {
            bestDist = d;
            best = c;
        }
    }
    return best;
}

/**
 * Отражательные варианты центра запрошенной дуги: натуральный и три зеркальных
 * (вертикальное — право↔лево, `θ → π − θ`; горизонтальное — верх↔низ, `θ → −θ`;
 * оба — противоположный угол, `θ → θ + π`). Дубли по углу отбрасываются,
 * приоритет сохраняется: натуральный < вертикальный < горизонтальный < оба.
 *
 * @param {{ startAngle: number, arc: number }} pattern - запрошенная дуга (радианы)
 * @returns {Array<number>} - центры дуги (нормализованы в [0, TAU))
 */
function mirrorCenters(pattern) {
    const norm = (a) => ((a % TAU) + TAU) % TAU;
    const center = norm(pattern.startAngle + pattern.arc / 2);
    const variants = [center, Math.PI - center, -center, center + Math.PI];
    const out = [];
    for (const v of variants) {
        const c = norm(v);
        if (!out.some((x) => circularDistance(x, c) < EPS)) out.push(c);
    }
    return out;
}

/**
 * Помещается ли дуга [start, start + arc] целиком внутри окна [s, e]
 * с учётом периодичности углов (окно может быть в merged-представлении
 * со сдвигом на TAU, а дуга — уходить в отрицательную область).
 * @param {number} s
 * @param {number} e
 * @param {number} start
 * @param {number} arc
 * @returns {boolean}
 */
function arcFitsInWindow(s, e, start, arc) {
    for (const k of [-1, 0, 1]) {
        if (s <= start + k * TAU + EPS && start + k * TAU + arc <= e + EPS) return true;
    }
    return false;
}

/**
 * Размещает запрошенную дугу целиком внутри одного из непрерывных видимых
 * окон. Сначала пробует идеальное размещение — натуральное положение либо
 * его отзеркаливание (клик у края экрана, включая углы); если ни одно
 * зеркало целиком не вмещается — компромисс: ближайшее к натуральному
 * центру допустимое положение. Возвращает `null`, если ни одно окно
 * не вмещает дугу целиком.
 *
 * @param {{ startAngle: number, arc: number }} pattern - запрошенная дуга (радианы)
 * @param {Array<[number, number]>} candidates - непрерывные видимые окна
 * @returns {{ start: number, end: number, arc: number } | null}
 */
function bestPatternPlacement(pattern, candidates) {
    const center = pattern.startAngle + pattern.arc / 2;
    const mirrors = mirrorCenters(pattern);

    // Фаза 1: идеальное размещение — натуральное либо зеркальное, целиком
    // лежащее в видимом окне. Лучший вариант — минимальное круговое
    // расстояние до натурального центра (натуральное всегда побеждает).
    let exact = null;
    let exactDist = Infinity;
    for (const [s, e] of candidates) {
        const wlen = e - s;
        if (wlen < pattern.arc - EPS) continue;
        if (wlen >= TAU - EPS) {
            return { start: center - pattern.arc / 2, end: center + pattern.arc / 2, arc: pattern.arc };
        }
        for (const c of mirrors) {
            const start = c - pattern.arc / 2;
            if (!arcFitsInWindow(s, e, start, pattern.arc)) continue;
            const dist = circularDistance(c, center);
            if (dist < exactDist - EPS) {
                exactDist = dist;
                exact = { start, end: start + pattern.arc, arc: pattern.arc };
            }
        }
    }
    if (exact) return exact;

    // Фаза 2: компромисс — ближайшее к натуральному центру допустимое положение.
    let best = null;
    let bestDist = Infinity;
    for (const [s, e] of candidates) {
        const wlen = e - s;
        if (wlen < pattern.arc - EPS) continue;
        if (wlen >= TAU - EPS) {
            return { start: center - pattern.arc / 2, end: center + pattern.arc / 2, arc: pattern.arc };
        }
        const c = clampToWindow(s + pattern.arc / 2, e - pattern.arc / 2, center);
        const dist = circularDistance(c, center);
        if (dist < bestDist - EPS) {
            bestDist = dist;
            best = { start: c - pattern.arc / 2, end: c + pattern.arc / 2, arc: pattern.arc };
        }
    }
    return best;
}

/**
 * Размещает запрошенную дугу в видимых окнах: целиком (сдвиг/отзеркаливание)
 * либо сужением до наибольшего окна; при отсутствии пригодного окна —
 * полная круговая геометрия.
 *
 * @param {{ startAngle: number, arc: number }} pattern
 * @param {Array<[number, number]>} candidates
 * @param {'clockwise' | 'counterclockwise'} direction
 * @param {{ startAngle: number, arc: number }} full - запасная полная геометрия
 * @returns {{ startAngle: number, arc: number }}
 */
function placePattern(pattern, candidates, direction, full) {
    const placed = bestPatternPlacement(pattern, candidates);
    if (placed) {
        return {
            startAngle: direction === DIRECTIONS.COUNTERCLOCKWISE ? placed.end : placed.start,
            arc: placed.arc
        };
    }
    let best = null;
    let bestLen = -1;
    for (const [s, e] of candidates) {
        const len = e - s;
        if (len < MIN_EDGE_REALLOCATION_ARC - EPS) continue;
        if (len > bestLen) {
            bestLen = len;
            best = { startAngle: direction === DIRECTIONS.COUNTERCLOCKWISE ? e : s, arc: len };
        }
    }
    return best ?? full;
}

/**
 * Определяет видимую дугу внешней окружности меню в viewport.
 *
 * Возвращает `{ startAngle, arc }` в радианах. При обычном расположении
 * (круг целиком в viewport) возвращается полный круг с сохранением
 * исходного startAngle конфигурации. При edge-reflow первый пункт
 * переносится в начало выбранной непрерывной видимой дуги.
 *
 * Если задан `availableArc` (резолвнутая дуга из частей конфига), пункты
 * размещаются по этой дуге, сдвинутой/отзеркаленной в свободную часть
 * экрана, а при нехватке места — суженной до наибольшего видимого окна.
 *
 * @param {object} options
 * @param {number} options.centerX - центр меню (clientX при open)
 * @param {number} options.centerY - центр меню (clientY при open)
 * @param {number} options.outerRadius - внешний радиус меню
 * @param {number} options.startAngle - начальный угол в градусах (конфигурация)
 * @param {'clockwise' | 'counterclockwise'} [options.direction] - направление развёртки секторов
 * @param {number} options.viewportWidth - ширина viewport в CSS-пикселях
 * @param {number} options.viewportHeight - высота viewport в CSS-пикселях
 * @param {{ startAngle: number, arc: number } | null} [options.availableArc] - запрошенная
 *   дуга в радианах (результат resolveAvailableArc) либо null
 * @returns {{ startAngle: number, arc: number }}
 */
export function calculateVisibleArc({ centerX, centerY, outerRadius, startAngle, direction = DIRECTIONS.CLOCKWISE, viewportWidth, viewportHeight, availableArc = null }) {
    const cfgStart = (startAngle * Math.PI) / 180;
    const full = { startAngle: cfgStart, arc: TAU };
    if (!(outerRadius > 0) || !(viewportWidth > 0) || !(viewportHeight > 0)) return full;

    const pattern = availableArc && availableArc.arc < TAU - EPS ? availableArc : null;

    let intervals = [[0, TAU]];
    const constraints = [
        cosAtLeast(-centerX / outerRadius),
        cosAtMost((viewportWidth - centerX) / outerRadius),
        sinAtLeast(-centerY / outerRadius),
        sinAtMost((viewportHeight - centerY) / outerRadius)
    ];
    for (const constraint of constraints) {
        intervals = intersectIntervals(intervals, constraint);
    }
    if (intervals.length === 0) return full;
    if (!pattern && intervals.length === 1 && intervals[0][1] - intervals[0][0] >= TAU - EPS) return full;

    /** @type {Array<[number, number]>} */
    let candidates = intervals;
    const first = intervals[0];
    const last = intervals[intervals.length - 1];
    if (intervals.length >= 2 && first[0] <= EPS && last[1] >= TAU - EPS) {
        const merged = [last[0], TAU + first[1]];
        candidates = [...intervals.slice(1, -1), merged];
    }

    if (pattern) {
        return placePattern(pattern, candidates, direction, full);
    }

    let best = null;
    let bestDist = Infinity;
    for (const [s, e] of candidates) {
        const len = e - s;
        if (len < MIN_EDGE_REALLOCATION_ARC - EPS) continue;
        const mid = (((s + len / 2) % TAU) + TAU) % TAU;
        const raw = Math.abs(mid - cfgStart);
        const dist = Math.min(raw, TAU - raw);
        if (dist < bestDist) {
            // CW-развёртка идёт от начала дуги вверх по углу;
            // CCW — от конца вниз, поэтому якорь для CCW — конец видимой дуги
            best = { startAngle: direction === DIRECTIONS.COUNTERCLOCKWISE ? e : s, arc: len };
            bestDist = dist;
        }
    }
    return best ?? full;
}