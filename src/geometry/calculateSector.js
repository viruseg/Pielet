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

/** Полный угол в радианах. @type {number} */
const TAU = Math.PI * 2;

/** Эпсилон для сравнения углов с полным кругом. @type {number} */
const EPS = 1e-9;

/**
 * Рассчитывает раскладку секторов по доступной дуге.
 *
 * Дуга делится поровну между всеми пунктами; между секторами вставляется
 * зазор `gap` (в px), переведённый в угол через средний радиус кольца.
 * Если угол зазора не помещается, он пропорционально уменьшается до
 * половины номинальной ширины сектора. При единственном пункте зазор
 * не нужен (сектор занимает всю доступную дугу), а контент центрируется
 * на луче `arcStart` (для startAngle=-90 текст стоит сверху меню).
 *
 * @param {object} options
 * @param {number} options.itemCount - количество пунктов (N > 0)
 * @param {number} options.arcStart - начало дуги в радианах
 * @param {number} options.arcLength - длина доступной дуги в радианах (0 < arcLength <= 2π)
 * @param {number} options.outerRadius - внешний радиус кольца
 * @param {number} options.innerRadius - внутренний радиус кольца
 * @param {number} options.meanRadius - средний радиус кольца (для области контента)
 * @param {number} options.ringWidth - ширина кольца
 * @param {number} options.gap - зазор в CSS-пикселях (>= 0): длина дуги зазора
 *   между соседними пунктами РАВНА gap на внешней и на внутренней дуге
 *   (угловые диапазоны дуг считаются независимо); при N = 1 игнорируется
 * @param {'circle' | 'square'} options.fit - способ вписывания контента в сектор
 * @param {'clockwise' | 'counterclockwise'} options.direction - порядок распределения
 * @returns {{ sectors: Array<{ start: number, end: number, innerStart: number, innerEnd: number, relStart: number, span: number, spanInner: number, mid: number, safeRadius: number, contentRadius: number, availWidth: number, availHeight: number, rotate: boolean, flip: boolean }>, gapAngle: number, gapAngleInner: number }}
 */
export function calculateSectorLayout({ itemCount, arcStart, arcLength, outerRadius, innerRadius, meanRadius, ringWidth, gap, fit = 'circle', direction }) {
    const nominalSpan = arcLength / itemCount;
    const isSingle = itemCount === 1;
    const maxGapAngle = nominalSpan * MAX_GAP_FRACTION;
    const gapAngle = isSingle ? 0 : Math.min(gap / outerRadius, maxGapAngle);
    const gapAngleInner = isSingle ? 0 : Math.min(gap / innerRadius, maxGapAngle);
    const span = nominalSpan - gapAngle;
    const spanInner = nominalSpan - gapAngleInner;
    const dir = direction === 'counterclockwise' ? -1 : 1;
    // Полное кольцо: хорда дуги вырождается в 0, контент ограничен диаметром.
    const isFullRing = isSingle && arcLength >= TAU - EPS;

    const sectors = [];
    for (let i = 0; i < itemCount; i++) {
        let start, end, innerStart, innerEnd, mid;
        if (isSingle) {
            // Единственный сектор занимает всю дугу целиком, контент
            // центрируется на луче arcStart (для startAngle=-90 — сверху).
            mid = arcStart;
            start = arcStart;
            end = arcStart + arcLength;
            innerStart = arcStart;
            innerEnd = arcStart + arcLength;
        } else {
            // mid — ось слота (центр номинальной доли дуги): сектор симметричен
            // относительно границы соседних слотов, поэтому gap-линии и центры
            // контента лежат ровно на радиальных осях слотов
            mid = arcStart + dir * (i * nominalSpan + nominalSpan / 2);
            start = mid - span / 2;
            end = mid + span / 2;
            innerStart = mid - spanInner / 2;
            innerEnd = mid + spanInner / 2;
        }

        let safeRadius, contentRadius, availWidth, availHeight, rotate, flip;
        if (fit === 'circle') {
            // Безопасная зона — окружность, касающаяся границ сектора:
            // r1 ограничена кольцом (внутренний/внешний радиус),
            // r2 — боковыми гранями сектора. Для полного кольца r2 вырождается.
            const r1 = (outerRadius - innerRadius) / 2;
            const r2 = isFullRing
                ? Infinity
                : (outerRadius * Math.sin(span / 2)) / (1 + Math.sin(span / 2));
            safeRadius = Math.min(r1, r2);
            contentRadius = outerRadius - safeRadius;
            // Вписанный квадрат: диагональ равна диаметру безопасной окружности.
            const side = safeRadius * Math.SQRT2;
            availWidth = side;
            availHeight = side;
            rotate = false;
            flip = false;
        } else {
            // Прямоугольный бокс сектора, поворачивается вместе с сектором:
            // после поворота ширина ложится вдоль радиуса (кольцо),
            // высота — вдоль дуги (хорда на среднем радиусе).
            contentRadius = meanRadius;
            availWidth = ringWidth * CONTENT_BOX_FACTOR;
            availHeight = isFullRing
                ? 2 * meanRadius * CONTENT_BOX_FACTOR
                : 2 * meanRadius * Math.sin(span / 2) * CONTENT_BOX_FACTOR;
            rotate = true;
            // В левой половине круга поворот на mid переворачивает контент
            // «кверху ногами» (ось сектора смотрит влево). Дополнительный
            // разворот на 180° делает текст читаемым: от внешнего края к внутреннему.
            flip = Math.cos(mid) < 0;
        }

        sectors.push({
            start,
            end,
            innerStart,
            innerEnd,
            relStart: i * nominalSpan,
            span,
            spanInner,
            mid,
            safeRadius,
            contentRadius,
            availWidth,
            availHeight,
            rotate,
            flip
        });
    }
    return { sectors, gapAngle, gapAngleInner };
}

/**
 * Строит CSS `clip-path` полигон кольцевого сектора для элемента-
 * квадрата размером 2*outerRadius, центр квадрата — в центре кольца.
 * Углы задаются в радианах (совпадают с мировыми, т.к. элемент не повёрнут).
 *
 * @param {{ start: number, end: number, innerStart?: number, innerEnd?: number }} sector
 * @param {number} outerRadius
 * @param {number} innerRadius
 * @returns {string} значение CSS-свойства clip-path
 */
export function buildSectorClipPath({ start, end, innerStart, innerEnd }, outerRadius, innerRadius) {
    const span = end - start;
    const innerStartAngle = innerStart === undefined ? start : innerStart;
    const innerEndAngle = innerEnd === undefined ? end : innerEnd;
    const innerSpan = innerEndAngle - innerStartAngle;
    const segments = Math.max(MIN_SEGMENTS, Math.min(MAX_SEGMENTS, Math.ceil(span * SEGMENTS_PER_RADIAN)));
    const point = (radius, angle) =>
        `${(outerRadius + radius * Math.cos(angle)).toFixed(2)}px ${(outerRadius + radius * Math.sin(angle)).toFixed(2)}px`;

    const points = [];
    for (let k = 0; k <= segments; k++) {
        points.push(point(outerRadius, start + (span * k) / segments));
    }
    for (let k = segments; k >= 0; k--) {
        points.push(point(innerRadius, innerStartAngle + (innerSpan * k) / segments));
    }
    return `polygon(${points.join(', ')})`;
}