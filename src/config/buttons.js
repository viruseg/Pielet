/**
 * Именованные кнопки мыши для конфигурации Pielet.
 * Значение `config.button` задаётся текстовой константой, а здесь
 * сопоставляется с числовым `PointerEvent.button`.
 */

/**
 * Текстовая константа → числовой код PointerEvent.button.
 * @type {Readonly<Record<'left' | 'middle' | 'right' | 'back' | 'forward', number>>}
 */
export const BUTTON_CODES = Object.freeze({
    left: 0,
    middle: 1,
    right: 2,
    back: 3,
    forward: 4
});

/**
 * Текстовая константа → битовая маска PointerEvent.buttons.
 * Используется, чтобы определять, удержана ли отслеживаемая кнопка,
 * по событиям pointermove (без отдельного слушателя pointerdown).
 * @type {Readonly<Record<'left' | 'middle' | 'right' | 'back' | 'forward', number>>}
 */
export const BUTTON_BITS = Object.freeze({
    left: 1,
    middle: 4,
    right: 2,
    back: 8,
    forward: 16
});

/**
 * Допустимые текстовые имена кнопок.
 * @type {ReadonlySet<string>}
 */
export const BUTTON_NAMES = new Set(Object.keys(BUTTON_CODES));