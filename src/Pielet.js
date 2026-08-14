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
import { calculateMenuGeometry } from './geometry/calculateMenuGeometry.js';
import { calculateVisibleArc } from './geometry/calculateVisibleArc.js';
import { calculateSectorLayout } from './geometry/calculateSector.js';
import { InteractionController } from './interaction/InteractionController.js';
import { MenuRenderer } from './rendering/MenuRenderer.js';
import { acquireActiveMenu, releaseActiveMenu } from './lifecycle/ActiveMenuRegistry.js';

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
        this._closeNotified = false;

        if (this._runtime) this._close(true);
        const previous = acquireActiveMenu(this);
        if (previous) previous._close(true);

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
            selectable: config.items.map((item) => item.typeContent !== 'none')
        };

        this._renderer.mount({ centerX: x, centerY: y, geometry, items: config.items });

        const interaction = new InteractionController({
            interactionMode: config.interactionMode,
            button: config.button,
            centerX: x,
            centerY: y,
            geometry,
            onHover: (index) => this._renderer.setHover(index),
            onClose: () => this.close(),
            onSelect: (index) => this._select(config.items[index], index)
        });
        interaction.attach();

        this._addViewportListeners();

        this._runtime = { renderer: this._renderer, interaction };
        this.dispatchEvent(new CustomEvent('open'));
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
                this.dispatchEvent(new CustomEvent('close'));
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
     * select несёт `detail.id` — строковый идентификатор пункта; тот же id
     * передаётся первым аргументом в `item.action`.
     * @param {import('./types.js').PieletItem} item
     * @param {number} index
     */
    _select(item, index) {
        void index;
        const id = item && typeof item.id === 'string' ? item.id : '';
        this.dispatchEvent(new CustomEvent('select', { detail: { id } }));
        this._close(true);
        if (item && typeof item.action === 'function') {
            const action = item.action;
            action(id);
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