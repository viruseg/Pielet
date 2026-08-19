/**
 * Распределение пунктов по дуге и построение clip-path сектора.
 * Чистая математика, без DOM.
 */

import { DIRECTIONS, FITS } from '../config/constants.js';

/**
 * Точность (знаков после запятой) координат точек polygon/path в px.
 * @type {number}
 */
const CLIP_PRECISION = 2;

/**
 * Множитель безопасности области контента внутри сектора.
 * @type {number}
 */
export const CONTENT_BOX_FACTOR = 0.85;

/**
 * Отступ внешнего края контент-бокса от внешней дуги кольца (px) в square-fit.
 * Внутренний отступ остаётся симметричным от CONTENT_BOX_FACTOR (как раньше),
 * а внешний фиксируется минимальным: текст заполняет кольцо до внешнего края,
 * а не центрируется с равными отступами с обеих сторон.
 * @type {number}
 */
export const OUTER_CONTENT_INSET = 10;

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
 * Максимальная высота контент-бокса в квадратном секторе при заданной ширине.
 *
 * В square-fit бокс центрируется на `contentRadius` и поворачивается вместе
 * с сектором: ширина ложится вдоль радиуса, высота — вдоль хорды. Бокс
 * ограничен не прямоугольником, а клином сектора: его боковые грани (от
 * внутренней дуги к внешней) схлопываются к центру. Фиксированная высота
 * (хорда в центре бокса) не гарантирует, что углы бокса останутся внутри
 * клина — внутренний край бокса оказывается в более узкой части, и углы
 * вылезают за грань (визуально срезаются clip-path, страдает первая буква).
 *
 * Ограничение: верхняя грань клина (прямая между точками внутренней и внешней
 * дуг) в системе сектора — линия, по которой максимальная высота растёт с
 * удалением от центра. Самый узкий конец бокса — внутренний угол
 * (contentRadius − width/2); он и лимитирует высоту. Учитываются и внешний
 * угол, и внешняя дуга кольца.
 *
 * @param {object} sector - сектор (contentRadius, span, spanInner)
 * @param {number} innerRadius
 * @param {number} outerRadius
 * @param {number} contentWidth - фактическая ширина контента (px)
 * @returns {number} максимальная высота контента в px (0 — не помещается вовсе)
 */
export function contentHeightLimit(sector, innerRadius, outerRadius, contentWidth) {
    const halfWidth = contentWidth / 2;
    const xInner = sector.contentRadius - halfWidth;
    const xOuter = sector.contentRadius + halfWidth;
    if (xInner < innerRadius || xOuter > outerRadius) return 0;

    let maxHalfHeight;
    if (sector.span >= TAU - EPS) {
        // Полное кольцо: боковых граней клина нет — бокс ограничен только кольцом.
        const outerCap = Math.sqrt(Math.max(0, outerRadius * outerRadius - xOuter * xOuter));
        const innerCap = xInner < innerRadius
            ? Math.sqrt(Math.max(0, innerRadius * innerRadius - xInner * xInner))
            : Infinity;
        maxHalfHeight = Math.min(outerCap, innerCap);
    } else {
        // Верхняя грань клина (в системе сектора, mid = 0): прямая между точками
        // внешней дуги (span/2) и внутренней дуги (spanInner/2).
        const ax = outerRadius * Math.cos(sector.span / 2);
        const ay = outerRadius * Math.sin(sector.span / 2);
        const bx = innerRadius * Math.cos(sector.spanInner / 2);
        const by = innerRadius * Math.sin(sector.spanInner / 2);
        const dx = bx - ax;
        if (Math.abs(dx) < 1e-9) return 0;
        const slope = (by - ay) / dx;
        const lineAt = (x) => ay + slope * (x - ax);

        maxHalfHeight = Math.min(lineAt(xInner), lineAt(xOuter));
        // Внешний угол не должен выходить за внешнюю дугу кольца.
        const outerArcLimit = Math.sqrt(Math.max(0, outerRadius * outerRadius - xOuter * xOuter));
        maxHalfHeight = Math.min(maxHalfHeight, outerArcLimit);
    }

    if (!Number.isFinite(maxHalfHeight) || maxHalfHeight <= 0) return 0;
    return 2 * maxHalfHeight * CONTENT_BOX_FACTOR;
}

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
export function calculateSectorLayout({ itemCount, arcStart, arcLength, outerRadius, innerRadius, meanRadius, ringWidth, gap, fit = FITS.CIRCLE, direction }) {
    const nominalSpan = arcLength / itemCount;
    const isSingle = itemCount === 1;
    const maxGapAngle = nominalSpan * MAX_GAP_FRACTION;
    const gapAngle = isSingle ? 0 : Math.min(gap / outerRadius, maxGapAngle);
    const gapAngleInner = isSingle ? 0 : Math.min(gap / innerRadius, maxGapAngle);
    const span = nominalSpan - gapAngle;
    const spanInner = nominalSpan - gapAngleInner;
    const dir = direction === DIRECTIONS.COUNTERCLOCKWISE ? -1 : 1;
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
        if (fit === FITS.CIRCLE) {
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
            // Внутренний край бокса оставлен на месте (симметричный отступ
            // от CONTENT_BOX_FACTOR), внешний прижат к внешней дуге на
            // OUTER_CONTENT_INSET — текст заполняет кольцо до внешнего края.
            const boxInner = innerRadius + (ringWidth * (1 - CONTENT_BOX_FACTOR)) / 2;
            const boxOuter = Math.max(outerRadius - OUTER_CONTENT_INSET, boxInner);
            contentRadius = (boxInner + boxOuter) / 2;
            availWidth = boxOuter - boxInner;
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
        `${(outerRadius + radius * Math.cos(angle)).toFixed(CLIP_PRECISION)}px ${(outerRadius + radius * Math.sin(angle)).toFixed(CLIP_PRECISION)}px`;

    const points = [];
    for (let k = 0; k <= segments; k++) {
        points.push(point(outerRadius, start + (span * k) / segments));
    }
    for (let k = segments; k >= 0; k--) {
        points.push(point(innerRadius, innerStartAngle + (innerSpan * k) / segments));
    }
    return `polygon(${points.join(', ')})`;
}

/**
 * Строит SVG path-полилинию дуги для индикатора сабменю у внутреннего
 * радиуса сектора. Координаты — в px квадрата размером 2*outerRadius
 * (центр квадрата — в центре кольца), как в buildSectorClipPath.
 * Использует innerStart/innerEnd, чтобы дуга не залезала в gap.
 *
 * @param {{ start: number, end: number, innerStart?: number, innerEnd?: number }} sector
 * @param {number} radius - радиус дуги (у внутреннего радиуса сектора)
 * @param {number} outerRadius
 * @returns {string} значение атрибута `d` SVG-элемента path
 */
export function buildSubmenuArcPath({ start, end, innerStart, innerEnd }, radius, outerRadius) {
    const startAngle = innerStart === undefined ? start : innerStart;
    const endAngle = innerEnd === undefined ? end : innerEnd;
    const span = endAngle - startAngle;
    if (span <= EPS) return '';
    const segments = Math.max(MIN_SEGMENTS, Math.min(MAX_SEGMENTS, Math.ceil(span * SEGMENTS_PER_RADIAN * 2)));
    const point = (angle) =>
        `${(outerRadius + radius * Math.cos(angle)).toFixed(CLIP_PRECISION)} ${(outerRadius + radius * Math.sin(angle)).toFixed(CLIP_PRECISION)}`;
    const points = [];
    for (let k = 0; k <= segments; k++) {
        points.push(point(startAngle + (span * k) / segments));
    }
    return `M ${points.join(' L ')}`;
}

/**
 * Максимальный размер шеврона индикатора сабменю (px) — сторона квадратного
 * бокса SVG-глифа. 14px при стандартном размере меню: глиф компактный, не
 * перетягивает на себя внимание от контента сектора.
 * @type {number}
 */
export const SUBMENU_CHEVRON_MAX_SIZE = 14;

/**
 * Доля ширины кольца, которую занимает шеврон: размер шеврона масштабируется
 * с меню, чтобы в узком кольце (например size=120/centerSize=24) он не
 * «съедал» сектор и не сливался с контентом.
 * @type {number}
 */
export const SUBMENU_CHEVRON_SIZE_RATIO = 0.18;

/**
 * Доля размера шеврона — вынос центра шеврона за внешний радиус кольца.
 * Шеврон «сидит» на внешнем крае сектора: центр — на 0.5·size за кольцом,
 * внутренняя кромка совпадает с внешним радиусом (входит в кольцо ровно на 0),
 * внешняя торчит за него на size. Положение от размера меню не зависит, стрелка
 * всегда указывает радиально наружу и остаётся радиально дальше контента:
 * контент-бокс при любом fit заканчивается на внешнем радиусе или ближе
 * (в circle-fit — на contentRadius + side/2 ≤ outerRadius, в square-fit —
 * внешний край прижат на OUTER_CONTENT_INSET внутрь кольца).
 * @type {number}
 */
export const SUBMENU_CHEVRON_EXTERNAL_OFFSET_RATIO = 0.5;

/**
 * Путь SVG-глифа шеврона индикатора сабменю — правая «стрелка» (как текстовый
 * '›'), но без метрического сдвига шрифта: глиф симметричен относительно
 * горизонтальной центральной линии бокса (в viewBox 0 0 24 24 это y = 12).
 * Благодаря этой симметрии визуальный центр глифа лежит на одной горизонтали
 * с центром бокса, поэтому шевроны на лучах mid=0 и mid=π (после поворота на
 * 180°) оказываются точно на одной линии — текстовый '›' смещал их визуально.
 * @type {string}
 */
export const SUBMENU_CHEVRON_PATH = 'M7 5 L17 12 L7 19';

/**
 * ViewBox SVG-глифа шеврона: квадрат 24×24, масштабируется к размеру шеврона.
 * @type {string}
 */
export const SUBMENU_CHEVRON_VIEWBOX = '0 0 24 24';

/**
 * Рассчитывает геометрию шеврона индикатора сабменю: размер (сторона квадратного
 * бокса SVG-глифа) — пропорционально ширине кольца с потолком
 * SUBMENU_CHEVRON_MAX_SIZE, центр — за внешним краем кольца на луче mid
 * (на 0.25·size дальше внешнего радиуса). Положение стабильно при любом размере
 * меню и не зависит от контента пункта: шеврон всегда радиально дальше контента
 * и указывает наружу — не сливается с ним ни в circle-, ни в square-fit.
 *
 * @param {number} mid - средний угол сектора (рад)
 * @param {number} outerRadius - внешний радиус кольца
 * @param {number} innerRadius - внутренний радиус кольца
 * @returns {{ x: number, y: number, radius: number, size: number, deg: number }}
 *   x/y — координаты центра шеврона в px квадрата 2*outerRadius (origin —
 *   верхний левый угол квадрата, центр кольца — (outerRadius, outerRadius)),
 *   radius — радиальное расстояние центра от центра меню (чуть больше outerRadius),
 *   size — сторона квадратного бокса шеврона (px), deg — угол поворота (градусы, радиально наружу)
 */
export function buildSubmenuChevron(mid, outerRadius, innerRadius) {
    const size = Math.min(SUBMENU_CHEVRON_MAX_SIZE, (outerRadius - innerRadius) * SUBMENU_CHEVRON_SIZE_RATIO);
    const radius = outerRadius + size * SUBMENU_CHEVRON_EXTERNAL_OFFSET_RATIO;
    return {
        x: outerRadius + radius * Math.cos(mid),
        y: outerRadius + radius * Math.sin(mid),
        radius,
        size,
        deg: (mid * 180) / Math.PI
    };
}