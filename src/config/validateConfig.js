/**
 * Валидация и нормализация конфигурации Pielet.
 * Все ошибки выбрасываются как явные Error с осмысленными сообщениями.
 * Silent fallback при ошибочной конфигурации недопустим.
 */

import { DEFAULT_CONFIG } from './defaults.js';
import { BUTTON_NAMES } from './buttons.js';
import { ARC_PART_NAMES, ARC_PARTS, CONTENT_TYPES, DIRECTIONS, FITS, INTERACTION_MODES, SUBMENU_INDICATORS } from './constants.js';

const DIRECTIONS_SET = new Set(Object.values(DIRECTIONS));
const INTERACTION_MODES_SET = new Set(Object.values(INTERACTION_MODES));
const CONTENT_TYPES_SET = new Set(Object.values(CONTENT_TYPES));
const FITS_SET = new Set(Object.values(FITS));
const SUBMENU_INDICATORS_SET = new Set(Object.values(SUBMENU_INDICATORS));

/**
 * Префикс автоматически генерируемых id пунктов.
 * Резервируется: пользовательские id не должны начинаться с него.
 * @type {string}
 */
const ID_PREFIX = 'pielet-';

/**
 * Счётчик генерируемых id, растёт на протяжении жизни страницы.
 * Вместе с Date.now() гарантирует уникальность id в рамках страницы.
 * @type {number}
 */
let generatedIdCounter = 0;

/**
 * Генерирует id пункта меню.
 * @returns {string}
 */
function generateItemId() {
    return `${ID_PREFIX}${Date.now()}-${generatedIdCounter++}`;
}

/**
 * Проверяет, что id похож на сгенерированный библиотекой (начинается с ID_PREFIX).
 * @param {unknown} id
 * @returns {boolean}
 */
function isGeneratedId(id) {
    return typeof id === 'string' && id.startsWith(ID_PREFIX);
}

/**
 * Возвращает id пункта: явно заданный пользователем (непустой, не под префиксом)
 * или заново сгенерированный.
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
function resolveItemId(item) {
    if (typeof item.id === 'string' && item.id.length > 0 && !isGeneratedId(item.id)) {
        return item.id;
    }
    return generateItemId();
}

function err(message) {
    return new Error(`Pielet config error: ${message}`);
}

function assertNumber(value, name, predicate, description) {
    if (typeof value !== 'number' || !Number.isFinite(value) || !predicate(value)) {
        throw err(`${name} must be ${description}, got ${String(value)}`);
    }
}

/**
 * Проверяет один пункт меню.
 * @param {unknown} item
 * @param {number} index
 */
function validateItem(item, index) {
    if (typeof item !== 'object' || item === null) {
        throw err(`items[${index}] must be an object, got ${String(item)}`);
    }
    const { typeContent, content, action, id, keepOpen, isSubMenu, menu } = item;
    if (id !== undefined && (typeof id !== 'string' || id.length === 0)) {
        throw err(`items[${index}].id must be a non-empty string, got ${String(id)}`);
    }
    if (keepOpen !== undefined && typeof keepOpen !== 'boolean') {
        throw err(`items[${index}].keepOpen must be a boolean, got ${String(keepOpen)}`);
    }
    if (isSubMenu !== undefined && typeof isSubMenu !== 'boolean') {
        throw err(`items[${index}].isSubMenu must be a boolean, got ${String(isSubMenu)}`);
    }
    if (!CONTENT_TYPES_SET.has(typeContent)) {
        throw err(`items[${index}].typeContent must be one of: ${Array.from(CONTENT_TYPES_SET).join(', ')}; got ${String(typeContent)}`);
    }
    if (typeContent === CONTENT_TYPES.TEXT || typeContent === CONTENT_TYPES.IMAGE) {
        if (typeof content !== 'string' || content.length === 0) {
            throw err(`items[${index}].content must be a non-empty string for typeContent "${typeContent}"`);
        }
    } else if (typeContent === CONTENT_TYPES.NODE) {
        if (!(content instanceof Node)) {
            throw err(`items[${index}].content must be a DOM Node for typeContent "node"`);
        }
    }
    if (isSubMenu === true) {
        if (typeContent === CONTENT_TYPES.NONE) {
            throw err(`items[${index}].isSubMenu cannot be true for typeContent "none"`);
        }
        if (typeof menu !== 'object' || menu === null || typeof menu.open !== 'function') {
            throw err(`items[${index}].menu must be a Pielet instance (object with open) when isSubMenu is true`);
        }
    }
    if (action !== undefined && typeof action !== 'function') {
        throw err(`items[${index}].action must be a function, got ${String(action)}`);
    }
}

/**
 * Валидирует `availableArc`: непустой массив известных частей дуги,
 * объединение которых образует одну сплошную дугу на окружности
 * (разрешены перенос через 0° и полный круг, пересечения не считаются ошибкой).
 * @param {unknown} value
 */
function validateAvailableArc(value) {
    if (!Array.isArray(value) || value.length === 0) {
        throw err('availableArc must be a non-empty array of arc part names');
    }
    const selected = new Set();
    for (const part of value) {
        if (typeof part !== 'string' || !ARC_PARTS[part]) {
            throw err(`availableArc contains unknown arc part ${JSON.stringify(part)}; allowed: ${ARC_PART_NAMES.join(', ')}`);
        }
        for (const tile of ARC_PARTS[part]) selected.add(tile);
    }
    const sorted = [...selected].sort((a, b) => a - b);
    // Четверти образуют цикл из 4 позиций; сплошная дуга = не более одного
    // «разрыва» (diff !== 1) на циклическом обходе выбранных четвертей.
    const gaps = sorted.reduce((count, _cur, i) => {
        const diff = (sorted[(i + 1) % sorted.length] - sorted[i] + 4) % 4;
        return count + (diff !== 1 ? 1 : 0);
    }, 0);
    if (gaps > 1) {
        throw err(`availableArc parts must form a single continuous arc without gaps; got a disjoint set (${value.join(', ')})`);
    }
}

/**
 * Валидирует конфигурацию.
 * Отсутствующие поля пропускаются (к ним применятся defaults в normalizeConfig),
 * обязательные поля (items) проверяются всегда.
 * @param {Record<string, unknown>} config
 */
export function validateConfig(config) {
    const { size, centerSize, gap, startAngle, direction, interactionMode, button, closeDistance, items, fit, unifyText, submenuDelay, submenuIndicator, availableArc } = config;

    if (!Array.isArray(items)) {
        throw err(`items must be a non-empty array, got ${String(items)}`);
    }
    if (items.length === 0) {
        throw err('items must contain at least one item');
    }
    items.forEach(validateItem);

    if (size !== undefined) assertNumber(size, 'size', (v) => v > 0, 'a positive number');
    if (centerSize !== undefined) assertNumber(centerSize, 'centerSize', (v) => v > 0 && v < size, `a number greater than 0 and less than size (${size})`);
    if (gap !== undefined) assertNumber(gap, 'gap', (v) => v >= 0, 'a non-negative number');
    if (startAngle !== undefined) assertNumber(startAngle, 'startAngle', () => true, 'a finite number');
    if (button !== undefined && !BUTTON_NAMES.has(button)) {
        throw err(`button must be one of: ${Array.from(BUTTON_NAMES).join(', ')}; got ${String(button)}`);
    }
    if (closeDistance !== undefined) assertNumber(closeDistance, 'closeDistance', (v) => v >= 0, 'a non-negative number');
    if (submenuDelay !== undefined) assertNumber(submenuDelay, 'submenuDelay', (v) => v >= 0, 'a non-negative number');

    if (fit !== undefined && !FITS_SET.has(fit)) {
        throw err(`fit must be one of: ${Array.from(FITS_SET).join(', ')}; got ${String(fit)}`);
    }

    if (unifyText !== undefined && typeof unifyText !== 'boolean') {
        throw err(`unifyText must be a boolean, got ${String(unifyText)}`);
    }

    if (submenuIndicator !== undefined && !SUBMENU_INDICATORS_SET.has(submenuIndicator)) {
        throw err(`submenuIndicator must be one of: ${Array.from(SUBMENU_INDICATORS_SET).join(', ')}; got ${String(submenuIndicator)}`);
    }

    if (availableArc !== undefined) validateAvailableArc(availableArc);

    if (direction !== undefined && !DIRECTIONS_SET.has(direction)) {
        throw err(`direction must be one of: ${Array.from(DIRECTIONS_SET).join(', ')}; got ${String(direction)}`);
    }
    if (interactionMode !== undefined && !INTERACTION_MODES_SET.has(interactionMode)) {
        throw err(`interactionMode must be one of: ${Array.from(INTERACTION_MODES_SET).join(', ')}; got ${String(interactionMode)}`);
    }
}

/**
 * Собирает конфигурацию: применятет defaults и валидирует результат.
 * Возвращает новый объект; исходный не изменяется.
 * @param {object} rawConfig
 * @returns {import('../types.js').PieletConfig}
 */
export function normalizeConfig(rawConfig = {}) {
    const config = { ...DEFAULT_CONFIG, ...rawConfig };
    validateConfig(config);
    /** @type {import('../types.js').PieletConfig} */
    const normalized = {
        size: config.size,
        centerSize: config.centerSize,
        gap: config.gap,
        startAngle: config.startAngle,
        direction: config.direction,
        interactionMode: config.interactionMode,
        button: config.button,
        closeDistance: config.closeDistance,
        fit: config.fit,
        unifyText: config.unifyText,
        submenuDelay: config.submenuDelay,
        submenuIndicator: config.submenuIndicator,
        availableArc: config.availableArc,
        items: config.items.map((item) => ({ ...item, id: resolveItemId(item) }))
    };
    return normalized;
}