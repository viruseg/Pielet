/**
 * Менеджер DOM и CSS-состояния меню.
 * Не принимает решений о selection — только отрисовывает переданную
 * геометрию и применяет hover-состояния от InteractionController.
 * Визуальные параметры задаются CSS custom properties (src/styles/pielet.css).
 */

import { buildSectorClipPath, buildSectorOutlinePath, buildSubmenuArcPath, buildSubmenuChevron, contentHeightLimit, SUBMENU_CHEVRON_PATH, SUBMENU_CHEVRON_VIEWBOX } from '../geometry/calculateSector.js';
import { createContentContainer, fitText } from './ContentRenderer.js';
import { CONTENT_TYPES, SUBMENU_INDICATORS } from '../config/constants.js';

/**
 * Длительность закрытия (мс), используемая как фолбэк, когда длительность
 * перехода не удаётся получить из CSS (например, стили не подключены).
 * Должна соответствовать значению `--pielet-transition-duration` в pielet.css.
 * @type {number}
 */
const DEFAULT_CLOSE_DURATION_MS = 250;

/**
 * Запас (мс) сверх длительности перехода: если transitionend по backdrop-filter
 * секторов не сработает, DOM удаляется принудительно по этому таймеру.
 * @type {number}
 */
const CLOSE_FALLBACK_BUFFER_MS = 60;

/** Отступ дуги индикатора сабменю от внутреннего радиуса сектора (px). */
const SUBMENU_ARC_INSET = 3;
/** Толщина дуги индикатора (px). */
const SUBMENU_ARC_STROKE = 2.5;
/** Толщина штриха шеврона индикатора сабменю (px). */
const SUBMENU_CHEVRON_STROKE = 2;

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
    /** @type {HTMLElement | null} */
    #el = null;
    /** @type {HTMLElement[]} */
    #itemEls = [];
    /** @type {HTMLElement[]} */
    #captions = [];
    /** @type {Array<object>} */
    #sectors = [];
    /** @type {boolean[]} */
    #selectable = [];
    /** @type {Array<Element | null>} */
    #outlinePaths = [];
    /** @type {Array<object>} */
    #items = [];
    /** @type {boolean} */
    #unifyText = false;
    /** @type {number} */
    #outerRadius = 0;
    /** @type {number} */
    #innerRadius = 0;
    /** @type {number} */
    #closeDuration = DEFAULT_CLOSE_DURATION_MS;

    /**
     * Корневой элемент меню (null после закрытия).
     * @returns {HTMLElement | null}
     * @internal
     */
    get element() {
        return this.#el;
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
     * @param {boolean} [options.unifyText] - выровнять шрифт text-пунктов
     *   по наименьшему влезающему размеру (только при fit 'square')
     * @param {'arc' | 'chevron' | 'both'} [options.submenuIndicator] - индикация
     *   пунктов-сабменю (arc — дуга у внутреннего радиуса, chevron — стрелка на внешнем крае кольца)
     * @internal
     */
    mount({ centerX, centerY, geometry, items, unifyText = false, submenuIndicator = SUBMENU_INDICATORS.BOTH }) {
        const { outerRadius, innerRadius, sectors } = geometry;
        const size = outerRadius * 2;

        const el = document.createElement('div');
        el.className = 'pielet';
        el.style.position = 'fixed';
        el.style.left = `${centerX - outerRadius}px`;
        el.style.top = `${centerY - outerRadius}px`;
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;

        // Центральная область (dead zone, `centerSize`). Инертный div-хук без
        // внешнего вида: юзер библиотеки стилизует центр через `.pielet__center`.
        // Геометрия — инлайн (зависит от innerRadius), pointer-events — в CSS.
        const center = document.createElement('div');
        center.className = 'pielet__center';
        center.setAttribute('aria-hidden', 'true');
        center.style.position = 'absolute';
        center.style.left = `${outerRadius - innerRadius}px`;
        center.style.top = `${outerRadius - innerRadius}px`;
        center.style.width = `${innerRadius * 2}px`;
        center.style.height = `${innerRadius * 2}px`;
        el.appendChild(center);

        if (this.#el) this.#el.remove();
        document.body.appendChild(el);
        this.#el = el;
        this.#closeDuration = parseDuration(this.#getComputedDuration());

        this.#itemEls = [];
        this.#captions = [];
        this.#sectors = sectors;
        this.#items = items;
        this.#unifyText = unifyText;
        this.#outerRadius = outerRadius;
        this.#innerRadius = innerRadius;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const sector = sectors[i];

            const itemEl = document.createElement('div');
            itemEl.className = 'pielet__item';
            if (item.typeContent === CONTENT_TYPES.NONE) itemEl.classList.add('pielet__item--none');
            if (item.isSubMenu === true) itemEl.classList.add('pielet__item--submenu');
            itemEl.style.clipPath = buildSectorClipPath(sector, outerRadius, innerRadius);

            if (item.isSubMenu === true) {
                this.#appendSubmenuIndicators(el, itemEl, sector, outerRadius, innerRadius, size, submenuIndicator);
            }

            let caption = null;
            let contentEl = null;
            if (item.typeContent !== CONTENT_TYPES.NONE) {
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
            this.#captions.push(caption);

            el.appendChild(itemEl);
            this.#itemEls.push(itemEl);
        }

        // Обводка hover-пункта: отдельный SVG-слой поверх секторов. Клапаны
        // (clip-path) секторов срезали бы border/outline по контуру клина,
        // поэтому контур рисуется контуром path в корне меню, вне клипа.
        // Как и hover-фон, показывается только для selectable пунктов.
        const outlineSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        outlineSvg.setAttribute('class', 'pielet__outlines');
        outlineSvg.setAttribute('aria-hidden', 'true');
        outlineSvg.setAttribute('width', `${size}px`);
        outlineSvg.setAttribute('height', `${size}px`);
        outlineSvg.style.position = 'absolute';
        outlineSvg.style.top = '0';
        outlineSvg.style.left = '0';
        this.#outlinePaths = new Array(items.length).fill(null);
        for (let i = 0; i < items.length; i++) {
            if (items[i].typeContent === CONTENT_TYPES.NONE) continue;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'pielet__outline');
            path.setAttribute('d', buildSectorOutlinePath(sectors[i], outerRadius, innerRadius));
            outlineSvg.appendChild(path);
            this.#outlinePaths[i] = path;
        }
        el.appendChild(outlineSvg);

        // fitText требует, чтобы элемент был в DOM (scrollWidth/scrollHeight),
        // поэтому выравнивание выполняется после монтирования всех пунктов.
        this.#fitTextItems(items);

        this.#selectable = items.map((item) => item.typeContent !== CONTENT_TYPES.NONE);

        setTimeout(() => {
            if (this.#el === el) el.classList.add('pielet--open');
        }, 0);
    }

    /**
     * Добавляет индикаторы сабменю. Дуга — в пункт (до caption, чтобы контент
     * отрисовывался поверх). Шеврон — в корень меню: он «сидит» на внешнем крае
     * кольца и наполовину выходит за него, а clip-path сектора срезает всё за
     * внешним радиусом — в itemEl внешняя часть была бы невидима. Ни один
     * индикатор не влияет на fitText: caption и его содержимое не затрагиваются.
     *
     * @param {HTMLElement} el - корневой элемент меню (для шеврона)
     * @param {HTMLElement} itemEl - элемент сектора (для дуги)
     * @param {object} sector - геометрия сектора
     * @param {number} outerRadius
     * @param {number} innerRadius
     * @param {number} size - размер квадрата меню (2*outerRadius)
     * @param {'arc' | 'chevron' | 'both'} submenuIndicator
     */
    #appendSubmenuIndicators(el, itemEl, sector, outerRadius, innerRadius, size, submenuIndicator) {
        if (submenuIndicator === SUBMENU_INDICATORS.ARC || submenuIndicator === SUBMENU_INDICATORS.BOTH) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'pielet__submenu-arc');
            svg.setAttribute('width', `${size}px`);
            svg.setAttribute('height', `${size}px`);
            svg.setAttribute('aria-hidden', 'true');
            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = '0';
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', 'var(--pielet-submenu-indicator)');
            path.setAttribute('stroke-width', String(SUBMENU_ARC_STROKE));
            path.setAttribute('d', buildSubmenuArcPath(sector, innerRadius + SUBMENU_ARC_INSET, outerRadius));
            svg.appendChild(path);
            itemEl.appendChild(svg);
        }
        if (submenuIndicator === SUBMENU_INDICATORS.CHEVRON || submenuIndicator === SUBMENU_INDICATORS.BOTH) {
            // Шеврон — SVG-глиф (не текст '›'): у текстового глифа метрики
            // шрифта смещают визуальный центр относительно бокса, и парные
            // шевроны (mid=0 и mid=π, после поворота на 180°) визуально уходят
            // с общей горизонтальной линии. SVG-глиф симметричен относительно
            // центра бокса, поэтому выравнивание точное.
            const g = buildSubmenuChevron(sector.mid, outerRadius, innerRadius);
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'pielet__submenu-chevron');
            svg.setAttribute('aria-hidden', 'true');
            svg.setAttribute('viewBox', SUBMENU_CHEVRON_VIEWBOX);
            svg.setAttribute('width', `${g.size}px`);
            svg.setAttribute('height', `${g.size}px`);
            svg.style.position = 'absolute';
            svg.style.left = `${g.x}px`;
            svg.style.top = `${g.y}px`;
            svg.style.transform = `translate(-50%, -50%) rotate(${g.deg}deg)`;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', SUBMENU_CHEVRON_PATH);
            path.setAttribute('fill', 'currentColor');
            path.setAttribute('stroke', 'currentColor');
            path.setAttribute('stroke-width', String(SUBMENU_CHEVRON_STROKE));
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(path);
            el.appendChild(svg);
        }
    }

    /**
     * @returns {string} computed transition-duration корневого элемента
     */
    #getComputedDuration() {
        try {
            return (this.#el && window.getComputedStyle(this.#el).transitionDuration) || '';
        } catch {
            return '';
        }
    }

    /**
     * Применяет hover-состояние к пункту (или сбрасывает всё).
     * @param {number | null} index - индекс selectable пункта или null
     * @internal
     */
    setHover(index) {
        for (let i = 0; i < this.#itemEls.length; i++) {
            const on = i === index && this.#selectable[i];
            this.#itemEls[i].classList.toggle('pielet__item--hover', on);
            if (this.#outlinePaths[i]) this.#outlinePaths[i].classList.toggle('pielet__outline--visible', on);
        }
    }

    /**
     * Вписывает текст всех text-пунктов в их боксы (fitText). Если `unifyText`
     * активен — дополнительно выравнивает шрифт: все text-пункты получают
     * наименьший из влезающих размеров (размер пункта с самым длинным текстом).
     * Требует, чтобы все пункты были в DOM.
     * @param {Array<object>} items
     */
    #fitTextItems(items) {
        const textItems = [];
        // unifyText действует только при fit 'square' (секторы с rotate).
        const squareFit = items.length > 0 && this.#sectors[0] && this.#sectors[0].rotate;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const sector = this.#sectors[i];
            const contentEl = this.#captions[i] && this.#captions[i].querySelector('.pielet__content--text');
            if (item.typeContent === CONTENT_TYPES.TEXT && sector && contentEl) {
                if (sector.rotate) {
                    // Square-fit: высота бокса зависит от ширины текста — углы бокса
                    // не должны вылезать за боковые грани клина (у внутреннего края
                    // клин уже, и фиксированная высота-хорда обрезала первую букву).
                    fitText(contentEl, sector.availWidth, (width) => contentHeightLimit(sector, this.#innerRadius, this.#outerRadius, width));
                } else {
                    fitText(contentEl, sector.availWidth, sector.availHeight);
                }
                textItems.push({ el: contentEl });
            }
        }

        if (this.#unifyText && squareFit && textItems.length > 1) {
            let min = Infinity;
            for (const { el } of textItems) {
                const size = parseFloat(el.style.fontSize);
                if (Number.isFinite(size)) min = Math.min(min, size);
            }
            if (Number.isFinite(min)) {
                for (const { el } of textItems) {
                    el.style.fontSize = `${min}px`;
                }
            }
        }
    }

    /**
     * Перерисовывает содержимое пункта «на месте» (тип содержимого тот же,
     * что и при mount). Заменяет контент внутри существующего caption.
     * No-op для none-пунктов и при отсутствии caption.
     * @param {number} index - индекс пункта
     * @param {import('../types.js').PieletItem} item - пункт с новым content
     * @internal
     */
    setItemContent(index, item) {
        const caption = this.#captions[index];
        const sector = this.#sectors[index];
        if (!caption || !sector) return;
        const contentEl = createContentContainer(item, sector);
        caption.replaceChildren(contentEl || '');
        // caption уже в DOM (перерисовка «на месте»), можно измерять сразу.
        this.#items[index] = item;
        this.#fitTextItems(this.#items);
    }

    /**
     * Запускает анимацию закрытия (blur стекла → 0, фон → прозрачный) и после
     * завершения удаляет DOM и вызывает onDone. Если меню не смонтировано — onDone сразу.
     * @param {() => void} onDone
     * @internal
     */
    animateClose(onDone) {
        if (!this.#el) {
            onDone();
            return;
        }
        const el = this.#el;
        el.classList.remove('pielet--open');

        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            el.removeEventListener('transitionend', onTransitionEnd);
            if (this.#el === el) {
                this.#el = null;
                this.#itemEls = [];
                this.#captions = [];
                this.#sectors = [];
                this.#items = [];
            }
            el.remove();
            onDone();
        };
        const onTransitionEnd = (event) => {
            if (event.target === el && event.propertyName === 'opacity') finish();
        };
        el.addEventListener('transitionend', onTransitionEnd);
        setTimeout(finish, this.#closeDuration + CLOSE_FALLBACK_BUFFER_MS);
    }

    /**
     * Удаляет DOM меню немедленно (без анимации).
     * @internal
     */
    unmount() {
        if (this.#el) {
            this.#el.remove();
            this.#el = null;
            this.#itemEls = [];
            this.#captions = [];
            this.#sectors = [];
            this.#items = [];
            this.#outlinePaths = [];
        }
    }
}