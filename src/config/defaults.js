/**
 * Центральный набор значений по умолчанию конфигурации Pielet.
 * Значения не должны дублироваться нигде в коде.
 * Визуальные значения по умолчанию живут исключительно в CSS.
 *
 * @typedef {import('../types.js').PieletConfig} PieletConfig
 */

/** @type {PieletConfig} */
export const DEFAULT_CONFIG = {
    size: 240,
    centerSize: 72,
    gap: 4,

    startAngle: -90,
    direction: 'clockwise',

    interactionMode: 'click',

    button: 'left',
    closeDistance: 48
};