/**
 * Edge-aware геометрия: bounding rect видимой части меню в client-координатах.
 * Чистая математика, без DOM.
 *
 * Видимая часть меню — кольцевой сектор (annulus sector) между innerRadius и
 * outerRadius по видимой дуге [startAngle, startAngle ± arc]. Bounding rect
 * этого сектора определяется только внешним радиусом: экстремумы cos/sin на
 * угловом интервале достигаются при ρ = outerRadius, поэтому innerRadius
 * на результат не влияет.
 *
 * Возвращает plain-объект, совместимый с DOMRect: x, y, width, height,
 * left, top, right, bottom (left = x, top = y).
 */

import { DIRECTIONS } from '../config/constants.js';

const TAU = Math.PI * 2;
const EPS = 1e-9;

/**
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @returns {{ x: number, y: number, width: number, height: number, left: number, top: number, right: number, bottom: number }}
 */
function rectFrom(x, y, width, height) {
    return { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height };
}

/**
 * Определяет bounding rect видимой части меню.
 *
 * @param {object} options
 * @param {number} options.centerX - центр меню (clientX при open)
 * @param {number} options.centerY - центр меню (clientY при open)
 * @param {number} options.outerRadius - внешний радиус меню
 * @param {number} options.innerRadius - внутренний радиус меню (не влияет на bbox)
 * @param {number} options.startAngle - начало видимой дуги в радианах
 * @param {number} options.arc - длина видимой дуги в радианах
 * @param {'clockwise' | 'counterclockwise'} [options.direction] - направление развёртки
 * @returns {{ x: number, y: number, width: number, height: number, left: number, top: number, right: number, bottom: number }}
 */
export function calculateVisibleRect({ centerX, centerY, outerRadius, innerRadius, startAngle, arc, direction = DIRECTIONS.CLOCKWISE }) {
    void innerRadius;
    if (!(outerRadius > 0)) {
        return rectFrom(centerX, centerY, 0, 0);
    }
    if (arc >= TAU - EPS) {
        return rectFrom(centerX - outerRadius, centerY - outerRadius, outerRadius * 2, outerRadius * 2);
    }

    const dir = direction === DIRECTIONS.COUNTERCLOCKWISE ? -1 : 1;
    const end = startAngle + dir * arc;
    const a0 = Math.min(startAngle, end);
    const a1 = Math.max(startAngle, end);

    const candidates = [a0, a1];
    const critical = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    for (const k of critical) {
        const n = Math.floor((a0 - k) / TAU);
        for (let delta = -1; delta <= 1; delta++) {
            const t = k + TAU * (n + delta);
            if (t >= a0 - EPS && t <= a1 + EPS) candidates.push(t);
        }
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const t of candidates) {
        const c = Math.cos(t);
        const s = Math.sin(t);
        if (c < minX) minX = c;
        if (c > maxX) maxX = c;
        if (s < minY) minY = s;
        if (s > maxY) maxY = s;
    }

    const left = centerX + minX * outerRadius;
    const right = centerX + maxX * outerRadius;
    const top = centerY + minY * outerRadius;
    const bottom = centerY + maxY * outerRadius;
    return rectFrom(left, top, right - left, bottom - top);
}