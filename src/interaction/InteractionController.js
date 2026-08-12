/**
 * Управление pointer interaction открытого меню.
 * Не знает, как меню рисуется: получает геометрию, решает, что находится
 * под указателем, и вызывает колбэки onHover / onSelect / onClose.
 * Слушатели ставятся на window, чтобы ловить указатель за пределами DOM меню.
 */

import { getSelectedSector } from '../geometry/hitTestSector.js';

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
     * @param {number} options.button - кнопка для hold-режима (PointerEvent.button)
     * @param {number} options.centerX
     * @param {number} options.centerY
     * @param {object} options.geometry - полная геометрия меню (для hit-теста)
     * @param {(index: number | null) => void} options.onHover - смена hover-пункта
     * @param {() => void} options.onClose - запрос закрытия меню
     * @param {(index: number) => void} options.onSelect - выбор пункта
     */
    constructor({ interactionMode, button, centerX, centerY, geometry, onHover, onClose, onSelect }) {
        this._mode = interactionMode;
        this._button = button;
        this._centerX = centerX;
        this._centerY = centerY;
        this._geometry = geometry;
        this._onHover = onHover;
        this._onClose = onClose;
        this._onSelect = onSelect;
        this._hover = null;
        this._attached = false;
        this._openedAt = Date.now();

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
        const hit = this._hit(event);
        if (hit.region === 'outside') {
            this._setHover(null);
            this._onClose();
            return;
        }
        this._setHover(hit.region === 'sector' ? hit.itemIndex : null);
    }

    _onUp(event) {
        if (this._mode === 'hold' && event.button !== this._button) return;
        const hit = this._hit(event);
        if (hit.region === 'sector') {
            this._onSelect(hit.itemIndex);
            return;
        }
        if (this._mode === 'hold') {
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
        this._setHover(null);
        this._onClose();
    }

    _onContextMenu(event) {
        event.preventDefault();
    }

    _setHover(index) {
        if (index === this._hover) return;
        this._hover = index;
        this._onHover(index);
    }
}