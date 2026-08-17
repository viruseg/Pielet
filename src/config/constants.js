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