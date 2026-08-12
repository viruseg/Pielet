/**
 * Edge-aware геометрия: определение видимой дуги внешней окружности меню
 * внутри viewport. Чистая математика, без DOM.
 *
 * Центр меню никогда не перемещается (open(x, y) фиксирует его).
 * Если круг выходит за границы viewport, пункты перераспределяются по
 * наибольшей непрерывной видимой дуге; если полезная дуга меньше
 * MIN_EDGE_REALLOCATION_ARC — используется обычная геометрия полного круга.
 */

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
 * Определяет видимую дугу внешней окружности меню в viewport.
 *
 * Возвращает `{ startAngle, arc }` в радианах. При обычном расположении
 * (круг целиком в viewport) возвращается полный круг с сохранением
 * исходного startAngle конфигурации. При edge-reflow первый пункт
 * переносится в начало выбранной непрерывной видимой дуги.
 *
 * @param {object} options
 * @param {number} options.centerX - центр меню (clientX при open)
 * @param {number} options.centerY - центр меню (clientY при open)
 * @param {number} options.outerRadius - внешний радиус меню
 * @param {number} options.startAngle - начальный угол в градусах (конфигурация)
 * @param {number} options.viewportWidth - ширина viewport в CSS-пикселях
 * @param {number} options.viewportHeight - высота viewport в CSS-пикселях
 * @returns {{ startAngle: number, arc: number }}
 */
export function calculateVisibleArc({ centerX, centerY, outerRadius, startAngle, viewportWidth, viewportHeight }) {
    const cfgStart = (startAngle * Math.PI) / 180;
    const full = { startAngle: cfgStart, arc: TAU };
    if (!(outerRadius > 0) || !(viewportWidth > 0) || !(viewportHeight > 0)) return full;

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
    if (intervals.length === 1 && intervals[0][1] - intervals[0][0] >= TAU - EPS) return full;

    /** @type {Array<[number, number]>} */
    let candidates = intervals;
    const first = intervals[0];
    const last = intervals[intervals.length - 1];
    if (intervals.length >= 2 && first[0] <= EPS && last[1] >= TAU - EPS) {
        const merged = [last[0], TAU + first[1]];
        candidates = [...intervals.slice(1, -1), merged];
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
            best = { startAngle: s, arc: len };
            bestDist = dist;
        }
    }
    return best ?? full;
}