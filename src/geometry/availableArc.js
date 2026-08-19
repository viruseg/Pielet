/**
 * Резолв `availableArc` из именованных частей дуги в одну непрерывную дугу.
 * Чистая математика, без DOM.
 *
 * Части — четверти окружности (screen-углы: 0° = право, 90° = низ,
 * 180° = лево, 270° = верх). Валидированные комбинации всегда образуют
 * одну сплошную дугу (или полный круг → `null`).
 */

import { ARC_PARTS } from '../config/constants.js';

const QUARTER = Math.PI / 2;

/**
 * Начальные углы четвертей в радианах (screen: 0° — право).
 * Индексы совпадают с ARC_PARTS: 0 — top-right, 1 — bottom-right,
 * 2 — bottom-left, 3 — top-left.
 * @type {Array<number>}
 */
const CYCLE_START = [3 * QUARTER, 0, QUARTER, Math.PI];

/**
 * Преобразует массив частей дуги в непрерывную дугу.
 *
 * @param {string[]} parts - имена частей (предварительно валидированы конфигом)
 * @returns {{ startAngle: number, arc: number } | null}
 *   `{ startAngle, arc }` в радианах (unwrapped, arc < 2π) либо `null`,
 *   если части покрывают весь круг (или список пуст) — ограничения нет.
 */
export function resolveAvailableArc(parts) {
    const selected = new Set();
    for (const part of parts) {
        const tiles = ARC_PARTS[part];
        if (!tiles) return null;
        for (const t of tiles) selected.add(t);
    }
    if (selected.size === 0 || selected.size >= CYCLE_START.length) return null;

    // Начало непрерывного «прогона» четвертей: индекс, у которого
    // предшественник по циклу не выбран.
    let runStart = null;
    for (let i = 0; i < CYCLE_START.length; i++) {
        if (selected.has(i) && !selected.has((i + CYCLE_START.length - 1) % CYCLE_START.length)) {
            runStart = i;
            break;
        }
    }
    if (runStart === null) return null;

    return { startAngle: CYCLE_START[runStart], arc: selected.size * QUARTER };
}
