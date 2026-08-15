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

    // Единственный пункт занимает всю дугу кольца (gap при N = 1 не рисуется):
    // любая точка кольца принадлежит его сектору. Обход граничного случая,
    // когда боковые грани полного круга вырождаются в одну линию и between()
    // по углам становится нестабильным.
    if (sectors.length === 1) {
        return { region: selectable[0] ? 'sector' : 'none', itemIndex: 0 };
    }

    const theta = Math.atan2(dy, dx);

    // Внешняя дуга сектора [start..end], внутренняя [innerStart..innerEnd] —
    // независимые угловые диапазоны. Боковые границы — прямые отрезки
    // (inner, innerStart)→(outer, start) и (inner, innerEnd)→(outer, end).
    // Для радиуса указателя ρ вычисляем точный угол каждой прямой-грани
    // (решение квадратного уравнения по |A + s·D| = ρ) — инклюзивные концы
    // совпадают с геометрией clip-path полигона.
    const edgeAngle = (fromAngle, toAngle, rho) => {
        const ax = Math.cos(fromAngle) * innerRadius;
        const ay = Math.sin(fromAngle) * innerRadius;
        const bx = Math.cos(toAngle) * outerRadius;
        const by = Math.sin(toAngle) * outerRadius;
        const dxe = bx - ax;
        const dye = by - ay;
        const a = dxe * dxe + dye * dye;
        const b = 2 * (ax * dxe + ay * dye);
        const c = ax * ax + ay * ay - rho * rho;
        // корни; выбираем тот, что на отрезке [0,1] (s=0 при rho=inner, s=1 при rho=outer);
        // если сегмент не достаёт до rho — берём ближайшую к rho вершину
        const disc = b * b - 4 * a * c;
        let s;
        if (disc >= 0) {
            const sqrtD = Math.sqrt(disc);
            const s1 = (-b - sqrtD) / (2 * a);
            const s2 = (-b + sqrtD) / (2 * a);
            if (s1 >= 0 && s1 <= 1) s = s1;
            else if (s2 >= 0 && s2 <= 1) s = s2;
            else if (s1 > 1 && s2 > 1) s = 1;
            else s = 0;
        } else {
            s = 0;
        }
        return Math.atan2(ay + s * dye, ax + s * dxe);
    };
    const between = (angle, lo, hi) => {
        if (lo <= hi) return angle >= lo - EPS && angle <= hi + EPS;
        return angle >= lo - EPS || angle <= hi + EPS;
    };

    for (let i = 0; i < sectors.length; i++) {
        const s = sectors[i];
        const lo = edgeAngle(s.innerStart, s.start, dist);
        const hi = edgeAngle(s.innerEnd, s.end, dist);
        if (between(theta, lo, hi)) {
            return { region: selectable[i] ? 'sector' : 'none', itemIndex: i };
        }
    }
    return { region: 'gap', itemIndex: null };
}