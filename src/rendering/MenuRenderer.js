/**
 * Менеджер DOM и CSS-состояния меню.
 * Не принимает решений о selection — только отрисовывает переданную
 * геометрию и применяет hover-состояния от InteractionController.
 * Визуальные параметры задаются CSS custom properties (src/styles/pielet.css).
 */

import { buildSectorClipPath } from '../geometry/calculateSector.js';
import { createContentContainer } from './ContentRenderer.js';

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
     * @param {number} options.baseFontSize - базовый размер шрифта для text-пунктов
     */
    mount({ centerX, centerY, geometry, items, baseFontSize: baseFontSizeOption }) {
        const { outerRadius, innerRadius, sectors } = geometry;
        const size = outerRadius * 2;
        const meanRadius = (outerRadius + innerRadius) / 2;

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

        const baseFontSize = baseFontSizeOption !== undefined
            ? baseFontSizeOption
            : this.getBaseFontSize();

        this._itemEls = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const sector = sectors[i];

            const itemEl = document.createElement('div');
            itemEl.className = 'pielet__item';
            if (item.typeContent === 'none') itemEl.classList.add('pielet__item--none');
            itemEl.style.clipPath = buildSectorClipPath(sector, outerRadius, innerRadius);

            if (item.typeContent !== 'none') {
                const caption = document.createElement('div');
                caption.className = 'pielet__item-caption';
                caption.style.position = 'absolute';
                caption.style.left = `${outerRadius + meanRadius * Math.cos(sector.mid)}px`;
                caption.style.top = `${outerRadius + meanRadius * Math.sin(sector.mid)}px`;
                caption.style.transform = 'translate(-50%, -50%)';
                const contentEl = createContentContainer(item, sector, baseFontSize);
                if (contentEl) caption.appendChild(contentEl);
                itemEl.appendChild(caption);
            }

            el.appendChild(itemEl);
            this._itemEls.push(itemEl);
        }

        this._selectable = items.map((item) => item.typeContent !== 'none');

        setTimeout(() => {
            if (this._el === el) el.classList.add('pielet--open');
        }, 0);
    }

    /**
     * Базовый размер шрифта text-пунктов из CSS переменной
     * `--pielet-font-size` (в px), иначе 14.
     * @returns {number}
     */
    getBaseFontSize() {
        try {
            const value = this._el && window.getComputedStyle(this._el).getPropertyValue('--pielet-font-size');
            const parsed = value && parseFloat(value);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : 14;
        } catch {
            return 14;
        }
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
        }
    }
}