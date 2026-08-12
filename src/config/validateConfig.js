/**
 * Валидация и нормализация конфигурации Pielet.
 * Все ошибки выбрасываются как явные Error с осмысленными сообщениями.
 * Silent fallback при ошибочной конфигурации недопустим.
 */

import { DEFAULT_CONFIG } from './defaults.js';

const DIRECTIONS = new Set(['clockwise', 'counterclockwise']);
const INTERACTION_MODES = new Set(['hold', 'click']);
const CONTENT_TYPES = new Set(['none', 'text', 'image', 'node']);

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
    const { typeContent, content, action } = item;
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
        items: config.items
    };
    return normalized;
}