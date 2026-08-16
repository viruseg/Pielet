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
import { calculateMenuGeometry } from './geometry/calculateMenuGeometry.js';
import { calculateVisibleArc } from './geometry/calculateVisibleArc.js';
import { calculateVisibleRect } from './geometry/calculateVisibleRect.js';
import { calculateSectorLayout } from './geometry/calculateSector.js';
import { InteractionController } from './interaction/InteractionController.js';
import { MenuRenderer } from './rendering/MenuRenderer.js';
import { acquireActiveMenu, releaseActiveMenu, getActiveMenu } from './lifecycle/ActiveMenuRegistry.js';

export default class Pielet extends EventTarget {
    /**
     * Создаёт экземпляр кругового меню.
     * DOM не создаётся до первого `open()`.
     * @param {PieletConfig} [config] - конфигурация меню
     */
    constructor(config = {}) {
        super();
        this.config = normalizeConfig(config);
        this._renderer = new MenuRenderer();
        this._runtime = null;
        this._closeNotified = false;
        this._viewportClose = () => this._close(true);
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

        if (this._runtime) {
            this._closeNotified = true;
            this._close(true);
        }
        const previous = acquireActiveMenu(this);
        if (previous) previous._close(true);

        this._closeNotified = false;

        const { outerRadius, innerRadius, ringWidth, meanRadius } = calculateMenuGeometry(config);

        const visible = calculateVisibleArc({
            centerX: x,
            centerY: y,
            outerRadius,
            startAngle: config.startAngle,
            direction: config.direction,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight
        });

        const layout = calculateSectorLayout({
            itemCount: config.items.length,
            arcStart: visible.startAngle,
            arcLength: visible.arc,
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
            arcStart: visible.startAngle,
            arcLength: visible.arc,
            direction: config.direction,
            sectors: layout.sectors,
            selectable: config.items.map((item) => item.typeContent !== 'none'),
            submenu: config.items.map((item) => item.isSubMenu === true)
        };

        this._renderer.mount({ centerX: x, centerY: y, geometry, items: config.items, unifyText: config.unifyText });

        const interaction = new InteractionController({
            interactionMode: config.interactionMode,
            button: config.button,
            centerX: x,
            centerY: y,
            geometry,
            onHover: (index) => this._renderer.setHover(index),
            onClose: () => this.close(),
            onSelect: (index, point) => this._select(config.items[index], index, point),
            submenuDelay: config.submenuDelay,
            onSubmenuOpen: (index, point) => this._openSubmenu(config.items[index], point)
        });
        interaction.attach();

        this._addViewportListeners();

        this._runtime = { renderer: this._renderer, interaction };
        const rect = calculateVisibleRect({
            centerX: x,
            centerY: y,
            outerRadius,
            innerRadius,
            startAngle: visible.startAngle,
            arc: visible.arc,
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
        this._close(false);
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
        if (!this._runtime) {
            throw new Error('Pielet: setItemContent(id, content) requires an open menu');
        }
        const index = this.config.items.findIndex((item) => item.id === id);
        if (index === -1) {
            throw new Error(`Pielet: setItemContent(id, content): no item with id "${id}"`);
        }
        const item = this.config.items[index];
        if (item.typeContent === 'none') {
            throw new Error(`Pielet: setItemContent(id, content): item "${id}" has typeContent "none" and cannot be updated`);
        }
        if (item.typeContent === 'text' || item.typeContent === 'image') {
            if (typeof content !== 'string' || content.length === 0) {
                throw new Error(`Pielet: setItemContent(id, content): content must be a non-empty string for typeContent "${item.typeContent}"`);
            }
        } else if (!(content instanceof Node)) {
            throw new Error('Pielet: setItemContent(id, content): content must be a DOM Node for typeContent "node"');
        }
        item.content = content;
        this._renderer.setItemContent(index, item);
    }

    /**
     * Внутреннее закрытие.
     * @param {boolean} immediate - true: мгновенное удаление DOM (выбор пункта,
     * viewport-изменения, открытие другого экземпляра); false: fade-out.
     */
    _close(immediate) {
        if (!this._runtime) return;
        const runtime = this._runtime;
        this._runtime = null;
        this._removeViewportListeners();
        runtime.interaction.detach();
        const finish = () => {
            releaseActiveMenu(this);
            if (!this._closeNotified) {
                this._closeNotified = true;
                this.dispatchEvent(new CustomEvent('close', { detail: { menu: this } }));
            }
        };
        if (immediate) {
            runtime.renderer.unmount();
            finish();
        } else {
            runtime.renderer.animateClose(finish);
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
    _select(item, index, point) {
        void index;
        const id = item && typeof item.id === 'string' ? item.id : '';
        this.dispatchEvent(new CustomEvent('select', { detail: { id, menu: this, coords: point } }));
        const keepOpen = this.config.interactionMode === 'click' && item && item.keepOpen === true;
        if (!keepOpen) {
            this._close(true);
        }
        if (item && item.isSubMenu === true) {
            this._openSubmenu(item, point);
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
    _openSubmenu(item, point) {
        if (!item || item.isSubMenu !== true) return;
        if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') return;
        const menu = item.menu;
        if (menu && typeof menu.open === 'function') {
            menu.open(point.x, point.y);
        }
    }

    _addViewportListeners() {
        window.addEventListener('resize', this._viewportClose);
        document.addEventListener('scroll', this._viewportClose, { capture: true, passive: true });
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', this._viewportClose);
        }
    }

    _removeViewportListeners() {
        window.removeEventListener('resize', this._viewportClose);
        document.removeEventListener('scroll', this._viewportClose, { capture: true });
        if (window.visualViewport) {
            window.visualViewport.removeEventListener('resize', this._viewportClose);
        }
    }
}

/**
 * Текстовые имена кнопок → числовой PointerEvent.button.
 * Нужен вызывающему коду, чтобы фильтровать pointerdown по отслеживаемой
 * кнопке меню, например: `e.button !== Pielet.BUTTONS[menu.config.button]`.
 */
Pielet.BUTTONS = BUTTON_CODES;