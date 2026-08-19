/**
 * Доменные константы Pielet: единственный источник строковых значений,
 * используемых в конфигурации и рантайме (типы контента, режимы поведения,
 * способы вписывания, направления, варианты индикации сабменю).
 * Значения не должны дублироваться в коде — только ссылки на эти объекты.
 */

/**
 * Типы содержимого пункта меню.
 * @type {Readonly<Record<'NONE' | 'TEXT' | 'IMAGE' | 'NODE', 'none' | 'text' | 'image' | 'node'>>}
 */
export const CONTENT_TYPES = Object.freeze({
    NONE: 'none',
    TEXT: 'text',
    IMAGE: 'image',
    NODE: 'node'
});

/**
 * Режимы поведения уже открытого меню.
 * @type {Readonly<Record<'HOLD' | 'CLICK', 'hold' | 'click'>>}
 */
export const INTERACTION_MODES = Object.freeze({
    HOLD: 'hold',
    CLICK: 'click'
});

/**
 * Способы вписывания контента в сектор.
 * @type {Readonly<Record<'CIRCLE' | 'SQUARE', 'circle' | 'square'>>}
 */
export const FITS = Object.freeze({
    CIRCLE: 'circle',
    SQUARE: 'square'
});

/**
 * Направления распределения пунктов меню.
 * @type {Readonly<Record<'CLOCKWISE' | 'COUNTERCLOCKWISE', 'clockwise' | 'counterclockwise'>>}
 */
export const DIRECTIONS = Object.freeze({
    CLOCKWISE: 'clockwise',
    COUNTERCLOCKWISE: 'counterclockwise'
});

/**
 * Варианты индикации пунктов-сабменю.
 * @type {Readonly<Record<'ARC' | 'CHEVRON' | 'BOTH', 'arc' | 'chevron' | 'both'>>}
 */
export const SUBMENU_INDICATORS = Object.freeze({
    ARC: 'arc',
    CHEVRON: 'chevron',
    BOTH: 'both'
});

/**
 * Части дуги для конфига `availableArc` — именованные фрагменты окружности.
 * Значения — индексы четвертей в порядке по часовой стрелке, начиная с
 * верхне-правой: 0 — top-right [270°, 360°], 1 — bottom-right [0°, 90°],
 * 2 — bottom-left [90°, 180°], 3 — top-left [180°, 270°] (0° = право, 90° = низ).
 * @type {Readonly<Record<string, ReadonlyArray<number>>>}
 */
export const ARC_PARTS = Object.freeze({
    right: Object.freeze([0, 1]),
    bottom: Object.freeze([1, 2]),
    left: Object.freeze([2, 3]),
    top: Object.freeze([3, 0]),
    'top-right': Object.freeze([0]),
    'bottom-right': Object.freeze([1]),
    'bottom-left': Object.freeze([2]),
    'top-left': Object.freeze([3])
});

/**
 * Имена частей дуги для `availableArc` (для сообщений об ошибках валидации).
 * @type {ReadonlyArray<string>}
 */
export const ARC_PART_NAMES = Object.freeze(Object.keys(ARC_PARTS));