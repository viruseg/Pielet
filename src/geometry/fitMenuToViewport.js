/**
 * Edge-aware геометрия: масштабирование меню у краёв viewport.
 * Чистая математика, без DOM.
 *
 * Когда круг меню выходит за границы viewport, пункты перераспределяются
 * по видимой дуге (`calculateVisibleArc`). Чтобы контент пунктов не
 * уменьшался, внешний радиус увеличивается так, чтобы площадь
 * bounding-прямоугольника видимой дуги равнялась площади прямоугольника
 * «полной дуги»: квадрата 2*outerRadius для полного круга либо номинального
 * bbox паттерна `availableArc` (положение на площадь не влияет).
 * Радиусы масштабируются пропорционально — форма кольца сохраняется.
 *
 * У «чистого» края (видимая дуга ≥ π, клип одной гранью) рост ограничен:
 * отклонение размера меню от конфигурации ≤ MAX_EDGE_DEVIATION_PX. В углах
 * (видимая дуга < π, две грани) лимит не применяется — площадь сохраняется
 * полностью.
 */

import { calculateVisibleArc } from './calculateVisibleArc.js';
import { calculateVisibleRect } from './calculateVisibleRect.js';

const TAU = Math.PI * 2;
const EPS = 1e-9;

/**
 * Верхняя граница поиска масштаба (× outerRadius). Защита от расходящихся случаев.
 * @type {number}
 */
const MAX_SCALE = 32;

/**
 * Максимальное отклонение размера меню (диаметра, 2·outerRadius) от конфигурации
 * у «чистого» края экрана (клип одной гранью, видимая дуга ≥ π), в px.
 * В углах (две грани, видимая дуга < π) лимит не применяется.
 * @type {number}
 */
export const MAX_EDGE_DEVIATION_PX = 10;

/**
 * Площадь bounding-прямоугольника дуги на круге радиуса `outerRadius`.
 * @param {number} centerX
 * @param {number} centerY
 * @param {number} outerRadius
 * @param {number} startAngle - начало дуги (рад)
 * @param {number} arc - длина дуги (рад)
 * @param {'clockwise' | 'counterclockwise'} direction
 * @returns {number}
 */
function bboxArea(centerX, centerY, outerRadius, startAngle, arc, direction) {
    const rect = calculateVisibleRect({ centerX, centerY, outerRadius, innerRadius: 0, startAngle, arc, direction });
    return rect.width * rect.height;
}

/**
 * Разрешает радиусы и видимую дугу меню с учётом краёв viewport.
 *
 * При полностью видимой дуге (или фолбэке в полный круг) возвращает исходные
 * радиусы и видимую дугу как есть. Если видимая дуга урезана краем и площадь
 * её bounding-прямоугольника меньше целевой, внешний радиус увеличивается
 * (бисекция), пока площади не сравняются; внутренний радиус, ширина кольца
 * и средний радиус масштабируются пропорционально.
 *
 * @param {object} options
 * @param {number} options.centerX - центр меню (clientX при open)
 * @param {number} options.centerY - центр меню (clientY при open)
 * @param {number} options.outerRadius - внешний радиус (конфигурация)
 * @param {number} options.innerRadius - внутренний радиус (конфигурация)
 * @param {number} options.ringWidth - ширина кольца (конфигурация)
 * @param {number} options.meanRadius - средний радиус (конфигурация)
 * @param {number} options.startAngle - начальный угол в градусах (конфигурация)
 * @param {'clockwise' | 'counterclockwise'} [options.direction] - направление развёртки
 * @param {number} options.viewportWidth - ширина viewport в CSS-пикселях
 * @param {number} options.viewportHeight - высота viewport в CSS-пикселях
 * @param {{ startAngle: number, arc: number } | null} [options.availableArc] - резолвнутая
 *   дуга паттерна (рад) либо null
 * @returns {{ outerRadius: number, innerRadius: number, ringWidth: number, meanRadius: number, startAngle: number, arc: number }}
 */
export function resolveViewportFit({ centerX, centerY, outerRadius, innerRadius, ringWidth, meanRadius, startAngle, direction = 'clockwise', viewportWidth, viewportHeight, availableArc = null }) {
    const visible = calculateVisibleArc({
        centerX, centerY, outerRadius, startAngle, direction, viewportWidth, viewportHeight, availableArc
    });
    const unscaled = () => ({ outerRadius, innerRadius, ringWidth, meanRadius, startAngle: visible.startAngle, arc: visible.arc });

    // Полный круг (целиком виден или фолбэк): целевая площадь уже достигнута.
    if (visible.arc >= TAU - EPS) return unscaled();

    // Цель — площадь прямоугольника «полной дуги»: квадрат 2*outerRadius для
    // полного круга, либо номинальный bbox паттерна (площадь не зависит от
    // положения, поэтому центр можно передать любой).
    const target = availableArc
        ? bboxArea(centerX, centerY, outerRadius, availableArc.startAngle, availableArc.arc, direction)
        : 4 * outerRadius * outerRadius;

    const area0 = bboxArea(centerX, centerY, outerRadius, visible.startAngle, visible.arc, direction);
    if (area0 >= target - EPS) return unscaled();

    // Площадь bbox видимой дуги монотонно растёт с радиусом (пока дуга не
    // выродилась в фолбэк полного круга). Ищем радиус, где площадь равна цели.
    let lo = outerRadius;
    let hi = outerRadius;
    while (hi < outerRadius * MAX_SCALE) {
        const v = calculateVisibleArc({ centerX, centerY, outerRadius: hi, startAngle, direction, viewportWidth, viewportHeight, availableArc });
        if (v.arc >= TAU - EPS) break; // фолбэк — дуга выродилась
        const a = bboxArea(centerX, centerY, hi, v.startAngle, v.arc, direction);
        if (a >= target) break;
        hi *= 2;
    }

    for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        const v = calculateVisibleArc({ centerX, centerY, outerRadius: mid, startAngle, direction, viewportWidth, viewportHeight, availableArc });
        const a = bboxArea(centerX, centerY, mid, v.startAngle, v.arc, direction);
        // Фолбэк (arc = TAU) даёт площадь 4·mid² ≥ target — уходит в верхнюю половину.
        if (a < target) lo = mid;
        else hi = mid;
    }

    const radius = (lo + hi) / 2;
    // У «чистого» края (видимая дуга ≥ π — клип одной гранью) рост меню
    // ограничивается: отклонение диаметра от конфигурации не больше
    // MAX_EDGE_DEVIATION_PX. В углах (видимая дуга < π) лимита нет — там
    // полное масштабирование под целевой bbox.
    const cappedRadius = visible.arc >= Math.PI ? outerRadius + MAX_EDGE_DEVIATION_PX / 2 : radius;
    const finalRadius = Math.min(radius, cappedRadius);
    const finalVisible = calculateVisibleArc({ centerX, centerY, outerRadius: finalRadius, startAngle, direction, viewportWidth, viewportHeight, availableArc });
    // Патологический случай: масштабирование упирается в фолбэк полного круга
    // раньше, чем площадь достигает цели, — возвращаем исходную геометрию.
    if (finalVisible.arc >= TAU - EPS) return unscaled();

    const scale = finalRadius / outerRadius;
    return {
        outerRadius: finalRadius,
        innerRadius: innerRadius * scale,
        ringWidth: ringWidth * scale,
        meanRadius: meanRadius * scale,
        startAngle: finalVisible.startAngle,
        arc: finalVisible.arc
    };
}