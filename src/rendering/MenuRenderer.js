/**
 * Менеджер DOM и CSS-состояния меню.
 * Не принимает решений о selection — только отрисовывает переданную
 * геометрию и применяет hover-состояния от InteractionController.
 * Визуальные параметры задаются CSS custom properties (src/styles/pielet.css).
 */

import { buildSectorClipPath } from '../geometry/calculateSector.js';
import { createContentContainer, fitText } from './ContentRenderer.js';

const DEFAULT_CLOSE_DURATION_MS = 250;

/**
 * Парсит длительность перехода CSS (первый токен), например '150ms' или '0.15s'.
 * @param {string} value
 * @returns {number} длительность в миллисекундах (0.15s → 150)
 */
function parseDuration(value) {
    if (!value || typeof value !== 'string') return DEFAULT_CLOSE_DURATION_MS;
    const token = value.split(',')[0].trim();
    const match = /^([\d.]+)(ms|s)$/.exec(token);
    if (!match) return DEFAULT_CLOSE_DURATION_MS;
    return Number(match[1]) * (match[2] === 's' ? 1000 : 1);
}

export class MenuRenderer {
    constructor() {
        /** @type {HTMLElement | null} */
        this._el = null;
        /** @type {HTMLElement[]} */
        this._itemEls = [];
        /** @type {HTMLElement[]} */
        this._captions = [];
        /** @type {Array<object>} */
        this._sectors = [];
        /** @type {boolean[]} */
        this._selectable = [];
        /** @type {number} */
        this._closeDuration = DEFAULT_CLOSE_DURATION_MS;
    }

    /**
     * Корневой элемент меню (null после закрытия).
     * @returns {HTMLElement | null}
     */
    get element() {
        return this._el;
    }

    /**
     * Строит и монтирует DOM меню в document.body.
     * Экземпляр не создаёт DOM до этого вызова.
     *
     * @param {object} options
     * @param {number} options.centerX
     * @param {number} options.centerY
     * @param {object} options.geometry - результат calculateMenuGeometry/calculateSectorLayout
     * @param {Array<object>} options.items - пункты меню
     */
    mount({ centerX, centerY, geometry, items }) {
        const { outerRadius, innerRadius, sectors } = geometry;
        const size = outerRadius * 2;

        const el = document.createElement('div');
        el.className = 'pielet';
        el.style.position = 'fixed';
        el.style.left = `${centerX - outerRadius}px`;
        el.style.top = `${centerY - outerRadius}px`;
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;

        if (this._el) this._el.remove();
        document.body.appendChild(el);
        this._el = el;
        this._closeDuration = parseDuration(this.getComputedDuration());

        this._itemEls = [];
        this._captions = [];
        this._sectors = sectors;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const sector = sectors[i];

            const itemEl = document.createElement('div');
            itemEl.className = 'pielet__item';
            if (item.typeContent === 'none') itemEl.classList.add('pielet__item--none');
            itemEl.style.clipPath = buildSectorClipPath(sector, outerRadius, innerRadius);

            let caption = null;
            let contentEl = null;
            if (item.typeContent !== 'none') {
                caption = document.createElement('div');
                caption.className = 'pielet__item-caption';
                caption.style.position = 'absolute';
                caption.style.left = `${outerRadius + sector.contentRadius * Math.cos(sector.mid)}px`;
                caption.style.top = `${outerRadius + sector.contentRadius * Math.sin(sector.mid)}px`;
                caption.style.transform = sector.rotate
                    ? `translate(-50%, -50%) rotate(${sector.mid * 180 / Math.PI + (sector.flip ? 180 : 0)}deg)`
                    : 'translate(-50%, -50%)';
                contentEl = createContentContainer(item, sector);
                if (contentEl) caption.appendChild(contentEl);
                itemEl.appendChild(caption);
            }
            this._captions.push(caption);

            el.appendChild(itemEl);
            this._itemEls.push(itemEl);

            // fitText требует, чтобы элемент был в DOM (scrollWidth/scrollHeight).
            if (item.typeContent === 'text' && contentEl) {
                fitText(contentEl, sector.availWidth, sector.availHeight);
            }
        }

        this._selectable = items.map((item) => item.typeContent !== 'none');

        setTimeout(() => {
            if (this._el === el) el.classList.add('pielet--open');
        }, 0);
    }

    /**
     * @returns {string} computed transition-duration корневого элемента
     */
    getComputedDuration() {
        try {
            return (this._el && window.getComputedStyle(this._el).transitionDuration) || '';
        } catch {
            return '';
        }
    }

    /**
     * Применяет hover-состояние к пункту (или сбрасывает всё).
     * @param {number | null} index - индекс selectable пункта или null
     */
    setHover(index) {
        for (let i = 0; i < this._itemEls.length; i++) {
            this._itemEls[i].classList.toggle('pielet__item--hover', i === index && this._selectable[i]);
        }
    }

    /**
     * Перерисовывает содержимое пункта «на месте» (тип содержимого тот же,
     * что и при mount). Заменяет контент внутри существующего caption.
     * No-op для none-пунктов и при отсутствии caption.
     * @param {number} index - индекс пункта
     * @param {import('../types.js').PieletItem} item - пункт с новым content
     */
    setItemContent(index, item) {
        const caption = this._captions[index];
        const sector = this._sectors[index];
        if (!caption || !sector) return;
        const contentEl = createContentContainer(item, sector);
        caption.replaceChildren(contentEl || '');
        // caption уже в DOM (перерисовка «на месте»), можно измерять сразу.
        if (item.typeContent === 'text' && contentEl) {
            fitText(contentEl, sector.availWidth, sector.availHeight);
        }
    }

    /**
     * Запускает анимацию закрытия (opacity → 0) и после завершения
     * удаляет DOM и вызывает onDone. Если меню не смонтировано — onDone сразу.
     * @param {() => void} onDone
     */
    animateClose(onDone) {
        if (!this._el) {
            onDone();
            return;
        }
        const el = this._el;
        el.classList.remove('pielet--open');

        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            el.removeEventListener('transitionend', onTransitionEnd);
            if (this._el === el) {
                this._el = null;
                this._itemEls = [];
                this._captions = [];
                this._sectors = [];
            }
            el.remove();
            onDone();
        };
        const onTransitionEnd = (event) => {
            if (event.target === el && event.propertyName === 'opacity') finish();
        };
        el.addEventListener('transitionend', onTransitionEnd);
        setTimeout(finish, this._closeDuration + 60);
    }

    /**
     * Удаляет DOM меню немедленно (без анимации).
     */
    unmount() {
        if (this._el) {
            this._el.remove();
            this._el = null;
            this._itemEls = [];
            this._captions = [];
            this._sectors = [];
        }
    }
}