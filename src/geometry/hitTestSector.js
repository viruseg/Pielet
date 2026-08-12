/**
 * Математический hit-testing позиции указателя по геометрии меню.
 * DOM-hittest не используется как источник истины. Чистая математика.
 *
 * Для позиции указателя вычисляются декартово расстояние и угол,
 * затем угол нормализуется относительно arcStart/направления в диапазон
 * [0, 2π), после чего сектор ищется перебором в порядке массива items.
 * Границы секторов инклюзивны: при попадании точно на границу двух
 * соседних секторов выигрывает пункт, раньше стоящий в массиве (first match).
 */

const TAU = Math.PI * 2;
const EPS = 1e-9;

/**
 * @typedef {object} SectorHit
 * @property {'outside' | 'center' | 'gap' | 'none' | 'sector'} region
 * @property {number | null} itemIndex - индекс пункта для 'sector'/'none', иначе null
 */

/**
 * Определяет, что находится под указателем.
 *
 * - `outside` — дальше `outerRadius + closeDistance` (меню должно закрыться)
 * - `center` — центральная dead zone (меню закрывается при pointerup)
 * - `gap` — зазор между секторами (меню закрывается при pointerup)
 * - `none` — сектор не selectable пункта (меню закрывается при pointerup)
 * - `sector` — selectable пункт (выбирается при pointerup)
 *
 * @param {object} options
 * @param {number} options.x - clientX указателя
 * @param {number} options.y - clientY указателя
 * @param {number} options.centerX - центр меню
 * @param {number} options.centerY - центр меню
 * @param {object} options.geometry
 * @param {number} options.geometry.outerRadius
 * @param {number} options.geometry.innerRadius
 * @param {number} options.geometry.closeDistance
 * @param {number} options.geometry.arcStart - начало дуги в радианах
 * @param {number} options.geometry.arcLength - длина дуги в радианах
 * @param {'clockwise' | 'counterclockwise'} options.geometry.direction
 * @param {Array<{ relStart: number, span: number }>} options.geometry.sectors
 * @param {boolean[]} options.geometry.selectable - параллельный sectors массив
 * @returns {SectorHit}
 */
export function getSelectedSector({ x, y, centerX, centerY, geometry }) {
    const { outerRadius, innerRadius, closeDistance, arcStart, direction, sectors, selectable } = geometry;

    const dx = x - centerX;
    const dy = y - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist > outerRadius + closeDistance) return { region: 'outside', itemIndex: null };
    if (dist < innerRadius || dist === 0) return { region: 'center', itemIndex: null };

    const theta = Math.atan2(dy, dx);
    let p = theta - arcStart;
    if (direction === 'counterclockwise') p = arcStart - theta;
    p = ((p % TAU) + TAU) % TAU;

    for (let i = 0; i < sectors.length; i++) {
        const { relStart, span } = sectors[i];
        const start = ((relStart % TAU) + TAU) % TAU;
        if (p >= start - EPS && p <= start + span + EPS) {
            return {
                region: selectable[i] ? 'sector' : 'none',
                itemIndex: i
            };
        }
    }
    return { region: 'gap', itemIndex: null };
}