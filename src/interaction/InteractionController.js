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
        this._mode = interactionMode;
        this._button = BUTTON_CODES[button];
        this._buttonBits = BUTTON_BITS[button];
        this._centerX = centerX;
        this._centerY = centerY;
        this._geometry = geometry;
        this._onHover = onHover;
        this._onClose = onClose;
        this._onSelect = onSelect;
        this._submenuDelay = submenuDelay;
        this._onSubmenuOpen = onSubmenuOpen;
        this._hover = null;
        this._attached = false;
        this._openedAt = Date.now();
        this._lastPoint = null;
        this._submenuTimer = null;
        this._submenuIndex = null;

        this._onMove = this._onMove.bind(this);
        this._onUp = this._onUp.bind(this);
        this._onCancel = this._onCancel.bind(this);
        this._onContextMenu = this._onContextMenu.bind(this);
    }

    /**
     * Подключает глобальные слушатели (window).
     */
    attach() {
        if (this._attached) return;
        this._attached = true;
        window.addEventListener('pointermove', this._onMove);
        window.addEventListener('pointerup', this._onUp);
        window.addEventListener('pointercancel', this._onCancel);
        window.addEventListener('contextmenu', this._onContextMenu);
    }

    /**
     * Снимает все слушатели. После close() активный runtime не оставляет
     * глобальных слушателей.
     */
    detach() {
        if (!this._attached) return;
        this._attached = false;
        this._clearSubmenuTimer();
        window.removeEventListener('pointermove', this._onMove);
        window.removeEventListener('pointerup', this._onUp);
        window.removeEventListener('pointercancel', this._onCancel);
        window.removeEventListener('contextmenu', this._onContextMenu);
    }

    _hit(position) {
        return getSelectedSector({
            x: position.clientX,
            y: position.clientY,
            centerX: this._centerX,
            centerY: this._centerY,
            geometry: this._geometry
        });
    }

    _onMove(event) {
        const held = (event.buttons & this._buttonBits) !== 0;
        this._lastPoint = { x: event.clientX, y: event.clientY };
        const hit = this._hit(event);
        if (hit.region === 'outside') {
            this._clearSubmenuTimer();
            this._setHover(null);
            this._onClose();
            return;
        }
        // hold-режим: меню живёт, пока отслеживаемая кнопка удержана. Если кнопка
        // не зажата (например, сабменю открыто кнопкой, не совпадающей с его
        // config.button) — меню закрывается на первом же движении.
        if (this._mode === INTERACTION_MODES.HOLD && !held) {
            this._clearSubmenuTimer();
            this._onClose();
            return;
        }
        const hoverIndex = hit.region === 'sector' ? hit.itemIndex : null;
        const submenuItem = hoverIndex !== null && this._geometry.submenu != null && this._geometry.submenu[hoverIndex] === true;
        // Hover-задержка сабменю действует в hold-режиме, а также в click-режиме,
        // пока отслеживаемая кнопка удержана (меню работает как hold).
        if (submenuItem && this._submenuDelay > 0 && (this._mode === INTERACTION_MODES.HOLD || held)) {
            this._armSubmenuTimer(hoverIndex);
        } else {
            this._clearSubmenuTimer();
        }
        this._setHover(hoverIndex);
    }

    _onUp(event) {
        this._clearSubmenuTimer();
        // Меню реагирует только на отпускание отслеживаемой кнопки (config.button).
        if (event.button !== this._button) return;
        const hit = this._hit(event);
        if (hit.region === 'sector') {
            this._onSelect(hit.itemIndex, { x: event.clientX, y: event.clientY });
            return;
        }
        if (this._mode === INTERACTION_MODES.HOLD) {
            this._onClose();
            return;
        }
        // click-режим: отпускание того же клика, которым открыли меню,
        // не является «кликом мимо» — меню не закрывается.
        if (Date.now() - this._openedAt > CLICK_OPEN_GRACE_MS) {
            this._onClose();
        }
    }

    _onCancel() {
        this._clearSubmenuTimer();
        this._setHover(null);
        this._onClose();
    }

    _onContextMenu(event) {
        event.preventDefault();
    }

    /**
     * Ставит таймер открытия сабменю для пункта, если его ещё нет.
     * При смене пункта таймер перезапускается (задержка меряется от момента
     * наведения на текущий пункт).
     * @param {number} index
     */
    _armSubmenuTimer(index) {
        if (this._submenuTimer !== null && this._submenuIndex === index) return;
        this._clearSubmenuTimer();
        this._submenuIndex = index;
        this._submenuTimer = setTimeout(() => {
            this._submenuTimer = null;
            this._submenuIndex = null;
            if (this._lastPoint && this._onSubmenuOpen) {
                this._onSubmenuOpen(index, { ...this._lastPoint });
            }
        }, this._submenuDelay);
    }

    _clearSubmenuTimer() {
        if (this._submenuTimer !== null) {
            clearTimeout(this._submenuTimer);
            this._submenuTimer = null;
        }
        this._submenuIndex = null;
    }

    _setHover(index) {
        if (index === this._hover) return;
        this._hover = index;
        this._onHover(index);
    }
}