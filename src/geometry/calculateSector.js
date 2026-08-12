/**
 * Распределение пунктов по дуге и построение clip-path сектора.
 * Чистая математика, без DOM.
 */

/**
 * Множитель безопасности области контента внутри сектора.
 * @type {number}
 */
const CONTENT_BOX_FACTOR = 0.85;

/**
 * Максимальная доля номинальной ширины сектора, которую может занять gap.
 * Уменьшает эффективный gap пропорционально, когда места не хватает:
 * пункты никогда не исчезают из-за недостатка места.
 * @type {number}
 */
const MAX_GAP_FRACTION = 0.5;

/**
 * Количество точек полигона на радиан дуги сектора (для clip-path).
 * @type {number}
 */
const SEGMENTS_PER_RADIAN = 12;

/**
 * Минимальное число сегментов на дугу clip-path.
 * @type {number}
 */
const MIN_SEGMENTS = 8;

/**
 * Максимальное число сегментов на дугу clip-path.
 * @type {number}
 */
const MAX_SEGMENTS = 96;

/**
 * Рассчитывает раскладку секторов по доступной дуге.
 *
 * Дуга делится поровну между всеми пунктами; между секторами вставляется
 * зазор `gap` (в px), переведённый в угол через средний радиус кольца.
 * Если угол зазора не помещается, он пропорционально уменьшается до
 * половины номинальной ширины сектора.
 *
 * @param {object} options
 * @param {number} options.itemCount - количество пунктов (N > 0)
 * @param {number} options.arcStart - начало дуги в радианах
 * @param {number} options.arcLength - длина доступной дуги в радианах (0 < arcLength <= 2π)
 * @param {number} options.outerRadius - внешний радиус кольца (gap в px переводится в угол по нему,
 *   чтобы точки на внешней дуге были ровно на `gap` px друг от друга)
 * @param {number} options.meanRadius - средний радиус кольца (для области контента)
 * @param {number} options.ringWidth - ширина кольца
 * @param {number} options.gap - зазор в CSS-пикселях (>= 0)
 * @param {'clockwise' | 'counterclockwise'} options.direction - порядок распределения
 * @returns {{ sectors: Array<{ start: number, end: number, relStart: number, span: number, mid: number, availWidth: number, availHeight: number }>, gapAngle: number }}
 */
export function calculateSectorLayout({ itemCount, arcStart, arcLength, outerRadius, meanRadius, ringWidth, gap, direction }) {
    const nominalSpan = arcLength / itemCount;
    const requestedGapAngle = gap / outerRadius;
    const maxGapAngle = nominalSpan * MAX_GAP_FRACTION;
    const gapAngle = Math.min(requestedGapAngle, maxGapAngle);
    const span = nominalSpan - gapAngle;
    const pitch = span + gapAngle;

    const sectors = [];
    for (let i = 0; i < itemCount; i++) {
        let start;
        let relStart;
        if (direction === 'counterclockwise') {
            start = arcStart - i * pitch - span;
            relStart = -i * pitch;
        } else {
            start = arcStart + i * pitch;
            relStart = i * pitch;
        }
        const end = start + span;
        sectors.push({
            start,
            end,
            relStart,
            span,
            mid: start + span / 2,
            availWidth: 2 * meanRadius * Math.sin(span / 2) * CONTENT_BOX_FACTOR,
            availHeight: ringWidth * CONTENT_BOX_FACTOR
        });
    }
    return { sectors, gapAngle };
}

/**
 * Строит CSS `clip-path` полигон кольцевого сектора для элемента-
 * квадрата размером 2*outerRadius, центр квадрата — в центре кольца.
 * Углы задаются в радианах (совпадают с мировыми, т.к. элемент не повёрнут).
 *
 * @param {{ start: number, end: number }} sector
 * @param {number} outerRadius
 * @param {number} innerRadius
 * @returns {string} значение CSS-свойства clip-path
 */
export function buildSectorClipPath({ start, end }, outerRadius, innerRadius) {
    const span = end - start;
    const segments = Math.max(MIN_SEGMENTS, Math.min(MAX_SEGMENTS, Math.ceil(span * SEGMENTS_PER_RADIAN)));
    const point = (radius, angle) =>
        `${(outerRadius + radius * Math.cos(angle)).toFixed(2)}px ${(outerRadius + radius * Math.sin(angle)).toFixed(2)}px`;

    const points = [];
    for (let k = 0; k <= segments; k++) {
        points.push(point(outerRadius, start + (span * k) / segments));
    }
    for (let k = segments; k >= 0; k--) {
        points.push(point(innerRadius, start + (span * k) / segments));
    }
    return `polygon(${points.join(', ')})`;
}