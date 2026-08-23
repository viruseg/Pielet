/**
 * Pielet — библиотека круговых меню.
 *
 * Публичный API: `new Pielet(config)`, `menu.open(x, y)`, `menu.close()`.
 * Pielet не отвечает за то, когда и где вызывающий код решил открыть меню:
 * библиотека получает только координаты и управляет только поведением
 * уже открытого runtime. Одновременно может быть открыто только одно меню.
 *
 * @typedef {import('./types.js').PieletConfig} PieletConfig
 */

import { normalizeConfig } from './config/validateConfig.js';
import { BUTTON_CODES } from './config/buttons.js';
import { CONTENT_TYPES, INTERACTION_MODES } from './config/constants.js';
import { calculateMenuGeometry } from './geometry/calculateMenuGeometry.js';
import { resolveViewportFit } from './geometry/fitMenuToViewport.js';
import { resolveAvailableArc } from './geometry/availableArc.js';
import { calculateVisibleRect } from './geometry/calculateVisibleRect.js';
import { calculateSectorLayout } from './geometry/calculateSector.js';
import { InteractionController } from './interaction/InteractionController.js';
import { MenuRenderer } from './rendering/MenuRenderer.js';
import { acquireActiveMenu, releaseActiveMenu, getActiveMenu } from './lifecycle/ActiveMenuRegistry.js';

export class Pielet extends EventTarget {
    /** @type {MenuRenderer} */
    #renderer = new MenuRenderer();
    /** @type {null | { renderer: MenuRenderer, interaction: InteractionController }} */
    #runtime = null;
    /** @type {boolean} */
    #closeNotified = false;
    /** @type {() => void} */
    #viewportClose = () => this.#close(true);

    /**
     * Создаёт экземпляр кругового меню.
     * DOM не создаётся до первого `open()`.
     * @param {PieletConfig} [config] - конфигурация меню
     */
    constructor(config = {}) {
        super();
        this.config = normalizeConfig(config);
    }

    /**
     * Открывает меню в точке viewport (CSS-пиксели, как PointerEvent.clientX/clientY).
     * Перед открытием конфигурация перевалидируется и фиксируется snapshot,
     * изменения menu.config не влияют на уже открытое меню.
     * Если уже открыто другое меню (любого экземпляра) — оно закрывается.
     *
     * @param {number} x - координата центра меню по X
     * @param {number} y - координата центра меню по Y
     */
    open(x, y) {
        if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
            throw new Error('Pielet: open(x, y) requires finite client coordinates');
        }

        const config = normalizeConfig(this.config);
        this.config = config;

        if (this.#runtime) {
            this.#closeNotified = true;
            this.#close(true);
        }
        const previous = acquireActiveMenu(this);
        if (previous) previous.#close(true);

        this.#closeNotified = false;

        const base = calculateMenuGeometry(config);
        const { outerRadius, innerRadius, ringWidth, meanRadius, startAngle: arcStart, arc: arcLength } = resolveViewportFit({
            centerX: x,
            centerY: y,
            outerRadius: base.outerRadius,
            innerRadius: base.innerRadius,
            ringWidth: base.ringWidth,
            meanRadius: base.meanRadius,
            startAngle: config.startAngle,
            direction: config.direction,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            availableArc: config.availableArc ? resolveAvailableArc(config.availableArc) : null
        });

        const layout = calculateSectorLayout({
            itemCount: config.items.length,
            arcStart,
            arcLength,
            outerRadius,
            innerRadius,
            meanRadius,
            ringWidth,
            gap: config.gap,
            fit: config.fit,
            direction: config.direction
        });

        const geometry = {
            outerRadius,
            innerRadius,
            closeDistance: config.closeDistance,
            arcStart,
            arcLength,
            direction: config.direction,
            sectors: layout.sectors,
            selectable: config.items.map((item) => item.typeContent !== CONTENT_TYPES.NONE),
            submenu: config.items.map((item) => item.isSubMenu === true)
        };

        this.#renderer.mount({ centerX: x, centerY: y, geometry, items: config.items, unifyText: config.unifyText, submenuIndicator: config.submenuIndicator });

        const interaction = new InteractionController({
            interactionMode: config.interactionMode,
            button: config.button,
            centerX: x,
            centerY: y,
            geometry,
            onHover: (index) => this.#renderer.setHover(index),
            onClose: () => this.close(),
            onSelect: (index, point) => this.#select(config.items[index], index, point),
            submenuDelay: config.submenuDelay,
            onSubmenuOpen: (index, point) => this.#openSubmenu(config.items[index], point)
        });
        interaction.attach();

        this.#addViewportListeners();

        this.#runtime = { renderer: this.#renderer, interaction };
        const rect = calculateVisibleRect({
            centerX: x,
            centerY: y,
            outerRadius,
            innerRadius,
            startAngle: arcStart,
            arc: arcLength,
            direction: config.direction
        });
        this.dispatchEvent(new CustomEvent('open', { detail: { rect, menu: this } }));
    }

    /**
     * Закрывает меню (плавное исчезновение).
     * No-op, если меню не открыто. После закрытия не остаётся
     * DOM-элементов меню и глобальных слушателей.
     */
    close() {
        this.#close(false);
    }

    /**
     * Закрывает открытое меню (плавно, как `close()`), не требуя
     * ссылки на экземпляр. No-op, если ни одно меню не открыто.
     */
    static closeAll() {
        const menu = getActiveMenu();
        if (menu) {
            menu.close();
        }
    }

    /**
     * Меняет содержимое пункта меню по его `id` в живом открытом меню.
     * Тип нового содержимого должен совпадать с `typeContent`, заданным
     * при инициализации (сменить тип нельзя). Обновляет и DOM, и
     * `config.items[i].content` — следующее `open()` покажет новый контент.
     * Работает только пока меню открыто (типичный кейс — вызов из action
     * пункта с `keepOpen: true`).
     * @param {string} id - id пункта
     * @param {string | Node} content - новое содержимое (строка для text/image, Node для node)
     */
    setItemContent(id, content) {
        if (!this.#runtime) {
            throw new Error('Pielet: setItemContent(id, content) requires an open menu');
        }
        const index = this.config.items.findIndex((item) => item.id === id);
        if (index === -1) {
            throw new Error(`Pielet: setItemContent(id, content): no item with id "${id}"`);
        }
        const item = this.config.items[index];
        if (item.typeContent === CONTENT_TYPES.NONE) {
            throw new Error(`Pielet: setItemContent(id, content): item "${id}" has typeContent "none" and cannot be updated`);
        }
        if (item.typeContent === CONTENT_TYPES.TEXT || item.typeContent === CONTENT_TYPES.IMAGE) {
            if (typeof content !== 'string' || content.length === 0) {
                throw new Error(`Pielet: setItemContent(id, content): content must be a non-empty string for typeContent "${item.typeContent}"`);
            }
        } else if (!(content instanceof Node)) {
            throw new Error('Pielet: setItemContent(id, content): content must be a DOM Node for typeContent "node"');
        }
        item.content = content;
        this.#renderer.setItemContent(index, item);
    }

    /**
     * Внутреннее закрытие.
     * @param {boolean} immediate - true: мгновенное удаление DOM (выбор пункта,
     * viewport-изменения, открытие другого экземпляра); false: fade-out.
     */
    #close(immediate) {
        if (!this.#runtime) return;
        const runtime = this.#runtime;
        this.#runtime = null;
        this.#removeViewportListeners();
        runtime.interaction.detach();
        // Событие close диспатчится ДО любого разрушения DOM — пока меню ещё
        // видимо и находится в document (при плавном закрытии fade ещё не стартовал).
        if (!this.#closeNotified) {
            this.#closeNotified = true;
            this.dispatchEvent(new CustomEvent('close', { detail: { menu: this } }));
        }
        const teardown = () => {
            // Если за время fade меню уже переоткрыто этим же экземпляром,
            // реестр по-прежнему держит его — живое меню трогать не нужно.
            if (this.#runtime) return;
            if (immediate) {
                runtime.renderer.unmount();
            } else {
                runtime.renderer.animateClose(() => {});
            }
            releaseActiveMenu(this);
        };
        if (immediate) {
            teardown();
        } else {
            // Удаление DOM — отдельным promise, не блокирует вызывающий код
            // и стартует fade-анимацию только после события close.
            Promise.resolve().then(teardown);
        }
    }

    /**
     * Pipeline выбора пункта (спека §27):
     * select event → закрытие → удаление DOM/listeners → вызов action.
     * select несёт `detail.id` — строковый идентификатор пункта — `detail.menu`
     * и `detail.coords` — координаты указателя в момент клика по пункту;
     * тот же id первым аргументом, экземпляр меню вторым и координаты третьим
     * передаются в `item.action`.
     * Пункт с `keepOpen: true` не закрывает меню, но только в click-режиме:
     * в hold-режиме флаг игнорируется и меню закрывается как обычно.
     * Пункт с `isSubMenu: true` вместо action открывает сабменю (`item.menu`)
     * в точке клика; action игнорируется.
     * @param {import('./types.js').PieletItem} item
     * @param {number} index
     * @param {{ x: number, y: number }} [point] - координаты клика (clientX/clientY)
     */
    #select(item, index, point) {
        void index;
        const id = item && typeof item.id === 'string' ? item.id : '';
        const runtimeAtSelect = this.#runtime;
        this.dispatchEvent(new CustomEvent('select', { detail: { id, menu: this, coords: point } }));
        const keepOpen = this.config.interactionMode === INTERACTION_MODES.CLICK && item && item.keepOpen === true;
        if (!keepOpen && this.#runtime === runtimeAtSelect) {
            this.#close(true);
        }
        if (item && item.isSubMenu === true) {
            this.#openSubmenu(item, point);
            return;
        }
        if (item && typeof item.action === 'function') {
            const action = item.action;
            action(id, this, point);
        }
    }

    /**
     * Открывает сабменю пункта в заданной точке (clientX/clientY).
     * Используется обоими пайплайнами: click (выбор пункта) и hold
     * (hover-задержка из InteractionController). Для hold-пайплайна
     * select-событие и action не эмитятся — только открытие.
     * @param {import('./types.js').PieletItem} item
     * @param {{ x: number, y: number }} [point]
     */
    #openSubmenu(item, point) {
        if (!item || item.isSubMenu !== true) return;
        if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') return;
        const menu = item.menu;
        if (menu && typeof menu.open === 'function') {
            menu.open(point.x, point.y);
        }
    }

    #addViewportListeners() {
        window.addEventListener('resize', this.#viewportClose);
        document.addEventListener('scroll', this.#viewportClose, { capture: true, passive: true });
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', this.#viewportClose);
        }
    }

    #removeViewportListeners() {
        window.removeEventListener('resize', this.#viewportClose);
        document.removeEventListener('scroll', this.#viewportClose, { capture: true });
        if (window.visualViewport) {
            window.visualViewport.removeEventListener('resize', this.#viewportClose);
        }
    }
}

/**
 * Текстовые имена кнопок → числовой PointerEvent.button.
 * Нужен вызывающему коду, чтобы фильтровать pointerdown по отслеживаемой
 * кнопке меню, например: `e.button !== Pielet.BUTTONS[menu.config.button]`.
 */
Pielet.BUTTONS = BUTTON_CODES;