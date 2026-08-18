/**
 * Рендеринг содержимого пунктов меню: text / image / node / none.
 * `node` добавляется без клонирования и модификации.
 * Визуальные параметры задаются CSS custom properties, не JS-конфигом.
 */

import { CONTENT_TYPES } from '../config/constants.js';

const MIN_FONT_SIZE = 1;
const MAX_FIT_ITERATIONS = 24;
const MAX_FONT_SIZE = 1024;

/**
 * Подбирает максимальный размер шрифта, при котором содержимое элемента
 * помещается в доступную область (вписывание с заполнением): короткий текст
 * растёт до границы бокса, длинный — ужимается. Измерение через
 * scrollWidth/scrollHeight (требует, чтобы элемент был в DOM).
 *
 * @param {HTMLElement} el - текстовый элемент с установленным maxWidth/maxHeight
 * @param {number} availWidth
 * @param {number} availHeight
 * @param {number} minFontSize - нижняя граница размера шрифта
 * @param {number} maxIterations - предохранитель от бесконечного цикла
 */
export function fitText(el, availWidth, availHeight, minFontSize = MIN_FONT_SIZE, maxIterations = MAX_FIT_ITERATIONS) {
    const fits = (size) => {
        el.style.fontSize = `${size}px`;
        return el.scrollWidth <= availWidth && el.scrollHeight <= availHeight;
    };

    if (!fits(minFontSize)) {
        el.style.fontSize = `${minFontSize}px`;
        return;
    }

    // Экспоненциальный подбор верхней границы, где текст перестаёт помещаться.
    let lo = minFontSize;
    let hi = Math.max(minFontSize, availWidth, availHeight);
    let iter = 0;
    while (fits(hi) && hi < MAX_FONT_SIZE && iter < maxIterations) {
        lo = hi;
        hi = Math.min(hi * 2, MAX_FONT_SIZE);
        iter++;
    }

    // Бинарный поиск максимального влезающего размера в [lo, hi].
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (fits(mid)) lo = mid;
        else hi = mid - 1;
    }
    el.style.fontSize = `${lo}px`;
}

/**
 * Создаёт DOM-содержимое пункта меню.
 *
 * @param {import('../types.js').PieletItem} item
 * @param {{ availWidth: number, availHeight: number }} sector - сектор (доступная область)
 * @returns {HTMLElement | Node | null} элемент для вставки в caption, либо null для `none`
 */
export function createContentContainer(item, sector) {
    const { typeContent, content } = item;

    if (typeContent === CONTENT_TYPES.TEXT) {
        const el = document.createElement('div');
        el.className = 'pielet__content--text';
        el.style.maxWidth = `${sector.availWidth}px`;
        el.style.maxHeight = `${sector.availHeight}px`;
        el.textContent = content;
        // fitText вызывается рендерером после вставки в DOM (нужны scrollWidth/scrollHeight).
        return el;
    }

    if (typeContent === CONTENT_TYPES.IMAGE) {
        const img = document.createElement('img');
        img.className = 'pielet__content--image';
        img.setAttribute('src', content);
        // Явный бокс сектора: без него img с нулевым intrinsic-размером
        // (например, SVG data-URI только с viewBox) схлопывается в 0×0.
        img.style.width = `${sector.availWidth}px`;
        img.style.height = `${sector.availHeight}px`;
        return img;
    }

    if (typeContent === CONTENT_TYPES.NODE) {
        return content;
    }

    return null;
}