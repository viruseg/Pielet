/**
 * Рендеринг содержимого пунктов меню: text / image / node / none.
 * `node` добавляется без клонирования и модификации.
 * Визуальные параметры задаются CSS custom properties, не JS-конфигом.
 */

const MIN_FONT_SIZE = 8;
const MAX_FIT_ITERATIONS = 24;
const FIT_STEP_PX = 1;

/**
 * Ужимает шрифт текстового элемента, пока его содержимое не перестанет
 * выходить за доступную область (измерение через scrollWidth/scrollHeight).
 * Шрифт уменьшается равномерно, без растяжения по осям.
 *
 * @param {HTMLElement} el - текстовый элемент с установленным width/height
 * @param {number} availWidth
 * @param {number} availHeight
 * @param {number} baseFontSize - стартовый размер шрифта в px
 * @param {number} minFontSize - нижняя граница размера шрифта
 * @param {number} maxIterations - предохранитель от бесконечного цикла
 */
export function fitText(el, availWidth, availHeight, baseFontSize, minFontSize = MIN_FONT_SIZE, maxIterations = MAX_FIT_ITERATIONS) {
    let size = Math.max(baseFontSize, 1);
    el.style.fontSize = `${size}px`;
    for (let i = 0; i < maxIterations; i++) {
        if (el.scrollWidth <= availWidth && el.scrollHeight <= availHeight) break;
        if (size <= minFontSize) break;
        size = Math.max(size - FIT_STEP_PX, minFontSize);
        el.style.fontSize = `${size}px`;
    }
}

/**
 * Создаёт DOM-содержимое пункта меню.
 *
 * @param {import('../types.js').PieletItem} item
 * @param {{ availWidth: number, availHeight: number }} sector - сектор (доступная область)
 * @param {number} baseFontSize - базовый размер шрифта для text-пунктов
 * @returns {HTMLElement | Node | null} элемент для вставки в caption, либо null для `none`
 */
export function createContentContainer(item, sector, baseFontSize) {
    const { typeContent, content } = item;

    if (typeContent === 'text') {
        const el = document.createElement('div');
        el.className = 'pielet__content--text';
        el.style.maxWidth = `${sector.availWidth}px`;
        el.style.maxHeight = `${sector.availHeight}px`;
        el.textContent = content;
        fitText(el, sector.availWidth, sector.availHeight, baseFontSize);
        return el;
    }

    if (typeContent === 'image') {
        const img = document.createElement('img');
        img.className = 'pielet__content--image';
        img.setAttribute('src', content);
        img.style.maxWidth = `${sector.availWidth}px`;
        img.style.maxHeight = `${sector.availHeight}px`;
        return img;
    }

    if (typeContent === 'node') {
        return content;
    }

    return null;
}