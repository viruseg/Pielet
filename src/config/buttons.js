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
 * Допустимые текстовые имена кнопок.
 * @type {ReadonlySet<string>}
 */
export const BUTTON_NAMES = new Set(Object.keys(BUTTON_CODES));