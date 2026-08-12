/**
 * Базовая геометрия меню: радиусы кольца.
 * Чистая математика, без DOM.
 *
 * @typedef {import('../types.js').PieletConfig} PieletConfig
 */

/**
 * Вычисляет радиусы меню из конфигурации.
 * @param {Pick<PieletConfig, 'size' | 'centerSize'>} config
 * @returns {{ outerRadius: number, innerRadius: number, ringWidth: number, meanRadius: number }}
 */
export function calculateMenuGeometry({ size, centerSize }) {
    const outerRadius = size / 2;
    const innerRadius = centerSize / 2;
    const ringWidth = (size - centerSize) / 2;
    const meanRadius = (outerRadius + innerRadius) / 2;
    return { outerRadius, innerRadius, ringWidth, meanRadius };
}