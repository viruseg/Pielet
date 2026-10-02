/**
 * Pielet — библиотека круговых меню.
 *
 * Публичный API: `new Pielet(config)`, `menu.open(x, y)`,
 * `menu.openSubmenu(x, y, handoff)`, `menu.close()`, `menu.setItemContent(id, content)`.
 * Pielet не отвечает за то, когда и где вызывающий код решил открыть меню:
 * библиотека получает только координаты и управляет только поведением
 * уже открытого runtime. Одновременно может быть открыто только одно меню.
 *
 * `menu.open(x, y)` и `menu.openSubmenu(x, y, handoff)` — одна точка входа с
 * необязательным перекрытием кнопки показа; `Pielet` открывается как чужое сабменю
 * ровно так же, как открывает чужое сам.
 *
 * @typedef {import('./types.js').PieletConfig} PieletConfig
 */

import { normalizeConfig } from './config/validateConfig.js';
import { BUTTON_CODES, BUTTON_NAMES } from './config/buttons.js';
import { CONTENT_TYPES, INTERACTION_MODES } from './config/constants.js';
import { calculateMenuGeometry } from './geometry/calculateMenuGeometry.js';
import { resolveViewportFit } from './geometry/fitMenuToViewport.js';
import { resolveAvailableArc } from './geometry/availableArc.js';
import { calculateVisibleRect } from './geometry/calculateVisibleRect.js';
import { calculateSectorLayout } from './geometry/calculateSector.js';
import { InteractionController } from './interaction/InteractionController.js';
import { MenuRenderer } from './rendering/MenuRenderer.js';
import { acquireActiveMenu, releaseActiveMenu, getActiveMenu } from './lifecycle/ActiveMenuRegistry.js';

/**
 * Кнопка показа из переданного описания жеста.
 *
 * Проверяется по форме, а не по смыслу: негодное значение молча превратилось бы в
 * показ без жеста, и меню открылось бы, но его отпускание закрывать не стало бы —
 * то есть автор передал handoff, а меню вело себя как при его отсутствии.
 *
 * **Отсутствие перекрытия — это `undefined`, а не `null`.** Показы различаются
 * тремя состояниями, и `null` среди них уже занят: «жест держит не названная
 * кнопка», который наблюдаем иначе, чем показ по кнопке конфигурации. Свести
 * эти два случая к одному `null` значило бы подменить чужую кнопку своей.
 *
 * @param {unknown} handoff третий аргумент `openSubmenu`, как его передал вызывающий.
 * @returns {import('./types.js').MouseButtonName | null | undefined} кнопка показа,
 *   `null` при не названной кнопке, `undefined` когда показа без жеста.
 * @throws {Error} на негодном значении.
 */
function buttonOfHandoff(handoff) {
    if (handoff === undefined) {
        return undefined;
    }
    if (typeof handoff !== 'object' || handoff === null || Array.isArray(handoff)) {
        throw new Error('Pielet: openSubmenu(x, y, handoff) requires handoff to be undefined or an object');
    }
    const { button, held } = /** @type {Record<string, unknown>} */ (handoff);
    if (typeof held !== 'boolean') {
        throw new Error('Pielet: openSubmenu(x, y, handoff) requires handoff.held to be a boolean');
    }
    if (held === false) {
        return undefined;
    }
    if (button === null) {
        return null;
    }
    if (typeof button !== 'string' || !BUTTON_NAMES.has(button)) {
        throw new Error('Pielet: openSubmenu(x, y, handoff) requires handoff.button to be null or one of left, middle, right, back, forward');
    }
    return /** @type {import('./types.js').MouseButtonName} */ (button);
}

export class Pielet extends EventTarget {
    /** @type {MenuRenderer} */
    #renderer = new MenuRenderer();
    /** @type {null | { renderer: MenuRenderer, interaction: InteractionController }} */
    #runtime = null;
    /** @type {boolean} */
    #closeNotified = false;
    /**
     * Кнопка, которую отслеживает текущий показ. Обычно это `config.button`,
     * но `openSubmenu(x, y, handoff)` перекрывает её на время показа, и поле
     * хранит именно то, чем показ живёт: перекрытая кнопка передаётся дальше
     * сабменю, иначе цепочка владения жестом рвалась бы на первом звене.
     * @type {import('./types.js').MouseButtonName | null}
     */
    #runtimeButton = null;
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
        this.#openMenu(x, y, undefined);
    }

    /**
     * Показ с необязательным перекрытием кнопки: тело `open`, а `buttonOverride`
     * задаёт, какую кнопку отслеживает именно этот показ.
     *
     * Перекрытие живёт один показ: конфигурация читается заново на каждом `open`,
     * и перекрытый показ следующим же показом сменяется. Поэтому `menu.config`
     * остаётся единственным местом, где автор объявляет свою кнопку, и запись
     * туда из handoff была бы второй правдой о том же самом.
     *
     * @param {number} x - координата центра меню по X
     * @param {number} y - координата центра меню по Y
     * @param {import('./types.js').MouseButtonName | null | undefined} buttonOverride кнопка
     *   показа из handoff; `undefined` — перекрытия нет, `null` — отслеживается любая
     *   кнопка. Различие обязательно: свести оба к `null` значило бы подменить
     *   переданную кнопку кнопкой конфигурации.
     */
    #openMenu(x, y, buttonOverride) {
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

        const button = buttonOverride === undefined ? config.button : buttonOverride;
        const interaction = new InteractionController({
            interactionMode: config.interactionMode,
            button,
            centerX: x,
            centerY: y,
            geometry,
            onHover: (index) => this.#renderer.setHover(index),
            onClose: () => this.close(),
            onSelect: (index, point) => this.#select(config.items[index], index, point),
            submenuDelay: config.submenuDelay,
            onSubmenuOpen: (index, point) => this.#showSubmenu(config.items[index], point)
        });
        interaction.attach();

        this.#addViewportListeners();

        this.#runtime = { renderer: this.#renderer, interaction };
        this.#runtimeButton = button;
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
     * Открывает меню как сабменю в точке viewport.
     *
     * Контракт `PieletItem.menu` описывает один способ открытия для всех объектов,
     * а не только для экземпляров Pielet, и этим способом является он. Третий
     * аргумент — описание живого жеста, которым нас открыли: при `held: true` показ
     * вооружает жест удержания на `button` и отпускание этой кнопки его закрывает,
     * поэтому кнопка конфигурации ребёнка не обязана совпадать с той, которой его
     * открыли. `interactionMode` при этом не меняется: handoff передаёт жест, а не
     * политику показа.
     *
     * Без handoff и при `held: false` поведение прежнее, то есть тождественно `open`.
     *
     * @param {number} x - координата центра меню по X
     * @param {number} y - координата центра меню по Y
     * @param {import('./types.js').SubmenuHandoff} [handoff] - описание живого жеста
     * @throws {Error} если координаты не являются конечными числами, а также если
     *   `handoff` задан, но не отвечает форме `SubmenuHandoff`
     */
    openSubmenu(x, y, handoff) {
        const button = buttonOfHandoff(handoff);
        if (button === undefined) {
            // Показа без перекрытия `open` остаётся единственным путём, а не второй
            // копией того же тела: без handoff перекрывать нечего, и вызывающий код,
            // подменявший `open`, должен видеть и этот показ.
            this.open(x, y);
            return;
        }
        this.#openMenu(x, y, button);
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
     * в точке клика; action игнорируется. Открытие по клику работает только
     * в click-режиме: в hold-режиме сабменю открывается наведением, а к моменту
     * разбора отпускания кнопка уже не зажата, и закрывать открытое нечем.
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
            if (this.config.interactionMode !== INTERACTION_MODES.HOLD) {
                this.#showSubmenu(item, point);
            }
            return;
        }
        if (item && typeof item.action === 'function') {
            const action = item.action;
            action(id, this, point);
        }
    }

    /**
     * Открывает сабменю пункта в точке указателя.
     * Используется обоими пайплайнами: click (выбор пункта) и hold
     * (hover-задержка из InteractionController). Для hold-пайплайна
     * select-событие и action не эмитятся — только открытие.
     *
     * Кольцо закрывается здесь, а не внутри `open` сабменю: у Pielet-сабменю это
     * делает реестр активных меню, но чужое меню в реестр не встаёт, и кольцо
     * осталось бы висеть под ним. Закрытие выполняется и для пункта с
     * `keepOpen: true` — тот же пункт не может одновременно держать меню
     * открытым и заменить его сабменю. Повторный вызов в click-пайплайне
     * безвреден: `#close` у уже закрытого меню ничего не делает.
     * @param {import('./types.js').PieletItem} item
     * @param {{ x: number, y: number }} [point]
     */
    #showSubmenu(item, point) {
        if (!item || item.isSubMenu !== true) return;
        if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') return;
        const menu = item.menu;
        if (menu === null || typeof menu !== 'object') return;
        // `openSubmenu` проверяется первым: у меню с собственным контрактом открытия
        // `open(x, y)` может значить не то же, что у Pielet. У экземпляра Pielet
        // оба метода тождественны, так что порядок проверки на нём безразличен.
        let open = null;
        if (typeof menu.openSubmenu === 'function') {
            open = menu.openSubmenu;
        } else if (typeof menu.open === 'function') {
            open = menu.open;
        }
        if (!open) return;
        // Описание жеста собирается ДО закрытия: `#close` обнуляет `#runtime`, а
        // читать состояние закрытого показа уже нечем. Само кольцо при этом уходит
        // раньше ребёнка — чужое меню в реестр активных не встаёт, и оставленное
        // кольцо висело бы под ним.
        //
        // Кнопка берётся из `#runtimeButton`, а не из `config.button`: показ, открытый
        // как чужое сабменю, отслеживает переданную ему кнопку, и передавать дальше
        // надо её, иначе цепочка владения жестом рвётся на первом звене.
        const runtime = this.#runtime;
        const handoff = {
            button: this.#runtimeButton,
            held: runtime !== null && runtime.interaction.buttonHeld
        };
        this.#close(true);
        // Откат на `open(x, y)` получает те же три аргумента: третий у него
        // отсутствует, и это ровно то поведение, ради которого он и запасной.
        open.call(menu, point.x, point.y, handoff);
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