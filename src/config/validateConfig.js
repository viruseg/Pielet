/**
 * Валидация и нормализация конфигурации Pielet.
 * Все ошибки выбрасываются как явные Error с осмысленными сообщениями.
 * Silent fallback при ошибочной конфигурации недопустим.
 */

import { DEFAULT_CONFIG } from './defaults.js';

const DIRECTIONS = new Set(['clockwise', 'counterclockwise']);
const INTERACTION_MODES = new Set(['hold', 'click']);
const CONTENT_TYPES = new Set(['none', 'text', 'image', 'node']);

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
    const { typeContent, content, action, id } = item;
    if (id !== undefined && (typeof id !== 'string' || id.length === 0)) {
        throw err(`items[${index}].id must be a non-empty string, got ${String(id)}`);
    }
    if (!CONTENT_TYPES.has(typeContent)) {
        throw err(`items[${index}].typeContent must be one of: none, text, image, node; got ${String(typeContent)}`);
    }
    if (typeContent === 'text' || typeContent === 'image') {
        if (typeof content !== 'string' || content.length === 0) {
            throw err(`items[${index}].content must be a non-empty string for typeContent "${typeContent}"`);
        }
    } else if (typeContent === 'node') {
        if (!(content instanceof Node)) {
            throw err(`items[${index}].content must be a DOM Node for typeContent "node"`);
        }
    }
    if (action !== undefined && typeof action !== 'function') {
        throw err(`items[${index}].action must be a function, got ${String(action)}`);
    }
}

/**
 * Валидирует конфигурацию.
 * Отсутствующие поля пропускаются (к ним применятся defaults в normalizeConfig),
 * обязательные поля (items) проверяются всегда.
 * @param {Record<string, unknown>} config
 */
export function validateConfig(config) {
    const { size, centerSize, gap, startAngle, direction, interactionMode, button, closeDistance, items } = config;

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
    if (button !== undefined) assertNumber(button, 'button', (v) => Number.isInteger(v) && v >= 0 && v <= 5, 'an integer between 0 and 5');
    if (closeDistance !== undefined) assertNumber(closeDistance, 'closeDistance', (v) => v >= 0, 'a non-negative number');

    if (direction !== undefined && !DIRECTIONS.has(direction)) {
        throw err(`direction must be "clockwise" or "counterclockwise", got ${String(direction)}`);
    }
    if (interactionMode !== undefined && !INTERACTION_MODES.has(interactionMode)) {
        throw err(`interactionMode must be "hold" or "click", got ${String(interactionMode)}`);
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
        items: config.items.map((item) => ({ ...item, id: resolveItemId(item) }))
    };
    return normalized;
}