/**
 * Управление pointer interaction открытого меню.
 * Не знает, как меню рисуется: получает геометрию, решает, что находится
 * под указателем, и вызывает колбэки onHover / onSelect / onClose.
 * Слушатели ставятся на window, чтобы ловить указатель за пределами DOM меню.
 */

import { getSelectedSector } from '../geometry/hitTestSector.js';
import { BUTTON_CODES, BUTTON_BITS } from '../config/buttons.js';
import { INTERACTION_MODES } from '../config/constants.js';

/**
 * Grace-окно (мс) после открытия: отпускание кнопки, которым завершается
 * клик, открывший меню, не считается «кликом мимо» и не закрывает его.
 * @type {number}
 */
const CLICK_OPEN_GRACE_MS = 300;

export class InteractionController {
    /** @type {'hold' | 'click'} */
    #mode;
    /** @type {number} */
    #button;
    /** @type {number} */
    #buttonBits;
    /** @type {number} */
    #centerX;
    /** @type {number} */
    #centerY;
    /** @type {object} */
    #geometry;
    /** @type {(index: number | null) => void} */
    #onHover;
    /** @type {() => void} */
    #onClose;
    /** @type {(index: number, point: { x: number, y: number }) => void} */
    #onSelect;
    /** @type {number} */
    #submenuDelay;
    /** @type {((index: number, point: { x: number, y: number }) => void) | undefined} */
    #onSubmenuOpen;
    /** @type {number | null} */
    #hover = null;
    /** @type {boolean} */
    #attached = false;
    /** @type {number} */
    #openedAt = Date.now();
    /** @type {{ x: number, y: number } | null} */
    #lastPoint = null;
    /** @type {ReturnType<typeof setTimeout> | null} */
    #submenuTimer = null;
    /** @type {number | null} */
    #submenuIndex = null;

    /** @type {(event: PointerEvent) => void} */
    #boundMove;
    /** @type {(event: PointerEvent) => void} */
    #boundUp;
    /** @type {(event: PointerEvent) => void} */
    #boundCancel;
    /** @type {(event: PointerEvent) => void} */
    #boundContextMenu;

    /**
     * @param {object} options
     * @param {'hold' | 'click'} options.interactionMode
     * @param {import('../types.js').MouseButtonName} options.button - отслеживаемая кнопка (текстовая константа)
     * @param {number} options.centerX
     * @param {number} options.centerY
     * @param {object} options.geometry - полная геометрия меню (для hit-теста)
     * @param {(index: number | null) => void} options.onHover - смена hover-пункта
     * @param {() => void} options.onClose - запрос закрытия меню
     * @param {(index: number, point: { x: number, y: number }) => void} options.onSelect - выбор пункта; point — координаты указателя в момент pointerup
     * @param {number} options.submenuDelay - задержка (мс) открытия сабменю при наведении; 0 отключает hover-открытие
     * @param {(index: number, point: { x: number, y: number }) => void} options.onSubmenuOpen - открытие сабменю по hover-задержке
     */
    constructor({ interactionMode, button, centerX, centerY, geometry, onHover, onClose, onSelect, submenuDelay = 0, onSubmenuOpen }) {
        this.#mode = interactionMode;
        this.#button = BUTTON_CODES[button];
        this.#buttonBits = BUTTON_BITS[button];
        this.#centerX = centerX;
        this.#centerY = centerY;
        this.#geometry = geometry;
        this.#onHover = onHover;
        this.#onClose = onClose;
        this.#onSelect = onSelect;
        this.#submenuDelay = submenuDelay;
        this.#onSubmenuOpen = onSubmenuOpen;

        this.#boundMove = this.#onMove.bind(this);
        this.#boundUp = this.#onUp.bind(this);
        this.#boundCancel = this.#onCancel.bind(this);
        this.#boundContextMenu = this.#onContextMenu.bind(this);
    }

    /**
     * Подключает глобальные слушатели (window).
     * @internal
     */
    attach() {
        if (this.#attached) return;
        this.#attached = true;
        window.addEventListener('pointermove', this.#boundMove);
        window.addEventListener('pointerup', this.#boundUp);
        window.addEventListener('pointercancel', this.#boundCancel);
        window.addEventListener('contextmenu', this.#boundContextMenu);
    }

    /**
     * Снимает все слушатели. После close() активный runtime не оставляет
     * глобальных слушателей.
     * @internal
     */
    detach() {
        if (!this.#attached) return;
        this.#attached = false;
        this.#clearSubmenuTimer();
        window.removeEventListener('pointermove', this.#boundMove);
        window.removeEventListener('pointerup', this.#boundUp);
        window.removeEventListener('pointercancel', this.#boundCancel);
        window.removeEventListener('contextmenu', this.#boundContextMenu);
    }

    #hit(position) {
        return getSelectedSector({
            x: position.clientX,
            y: position.clientY,
            centerX: this.#centerX,
            centerY: this.#centerY,
            geometry: this.#geometry
        });
    }

    #onMove(event) {
        const held = (event.buttons & this.#buttonBits) !== 0;
        this.#lastPoint = { x: event.clientX, y: event.clientY };

        // Выход за внешний радиус снимает hover, но меню пока живёт до
        // порога closeDistance — в grace-зоне пункт не подсвечивается.
        const dx = event.clientX - this.#centerX;
        const dy = event.clientY - this.#centerY;
        const dist = Math.hypot(dx, dy);
        if (dist > this.#geometry.outerRadius) {
            this.#clearSubmenuTimer();
            this.#setHover(null);
            if (dist > this.#geometry.outerRadius + this.#geometry.closeDistance) {
                this.#onClose();
            }
            return;
        }

        const hit = this.#hit(event);
        // hold-режим: меню живёт, пока отслеживаемая кнопка удержана. Если кнопка
        // не зажата (например, сабменю открыто кнопкой, не совпадающей с его
        // config.button) — меню закрывается на первом же движении.
        if (this.#mode === INTERACTION_MODES.HOLD && !held) {
            this.#clearSubmenuTimer();
            this.#onClose();
            return;
        }
        const hoverIndex = hit.region === 'sector' ? hit.itemIndex : null;
        const submenuItem = hoverIndex !== null && this.#geometry.submenu != null && this.#geometry.submenu[hoverIndex] === true;
        // Hover-задержка сабменю действует в hold-режиме, а также в click-режиме,
        // пока отслеживаемая кнопка удержана (меню работает как hold).
        if (submenuItem && this.#submenuDelay > 0 && (this.#mode === INTERACTION_MODES.HOLD || held)) {
            this.#armSubmenuTimer(hoverIndex);
        } else {
            this.#clearSubmenuTimer();
        }
        this.#setHover(hoverIndex);
    }

    #onUp(event) {
        this.#clearSubmenuTimer();
        // Меню реагирует только на отпускание отслеживаемой кнопки (config.button).
        if (event.button !== this.#button) return;
        const dx = event.clientX - this.#centerX;
        const dy = event.clientY - this.#centerY;
        // Клик в точке за внешним радиусом (grace-зона или дальше) — клик в пустое
        // место: закрывает меню без выбора. В click-режиме, как и для центра/зазора,
        // действует grace-окно открытия: отпускание кнопки, которой открыли меню,
        // меню не закрывает.
        if (Math.hypot(dx, dy) > this.#geometry.outerRadius) {
            if (this.#mode === INTERACTION_MODES.HOLD || Date.now() - this.#openedAt > CLICK_OPEN_GRACE_MS) {
                this.#onClose();
            }
            return;
        }
        const hit = this.#hit(event);
        if (hit.region === 'sector') {
            this.#onSelect(hit.itemIndex, { x: event.clientX, y: event.clientY });
            return;
        }
        if (this.#mode === INTERACTION_MODES.HOLD) {
            this.#onClose();
            return;
        }
        // click-режим: отпускание того же клика, которым открыли меню,
        // не является «кликом мимо» — меню не закрывается.
        if (Date.now() - this.#openedAt > CLICK_OPEN_GRACE_MS) {
            this.#onClose();
        }
    }

    #onCancel() {
        this.#clearSubmenuTimer();
        this.#setHover(null);
        this.#onClose();
    }

    #onContextMenu(event) {
        // Подавляем браузерное контекстное меню только для отслеживаемой
        // кнопки: меню, открытое левой кнопкой, не лишает страницу её
        // собственного правого клика.
        if (event.button === this.#button) {
            event.preventDefault();
        }
    }

    /**
     * Ставит таймер открытия сабменю для пункта, если его ещё нет.
     * При смене пункта таймер перезапускается (задержка меряется от момента
     * наведения на текущий пункт).
     * @param {number} index
     */
    #armSubmenuTimer(index) {
        if (this.#submenuTimer !== null && this.#submenuIndex === index) return;
        this.#clearSubmenuTimer();
        this.#submenuIndex = index;
        this.#submenuTimer = setTimeout(() => {
            this.#submenuTimer = null;
            this.#submenuIndex = null;
            if (this.#lastPoint && this.#onSubmenuOpen) {
                this.#onSubmenuOpen(index, { ...this.#lastPoint });
            }
        }, this.#submenuDelay);
    }

    #clearSubmenuTimer() {
        if (this.#submenuTimer !== null) {
            clearTimeout(this.#submenuTimer);
            this.#submenuTimer = null;
        }
        this.#submenuIndex = null;
    }

    #setHover(index) {
        if (index === this.#hover) return;
        this.#hover = index;
        this.#onHover(index);
    }
}