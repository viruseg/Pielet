/**
 * Публичные типы Pielet, выраженные через JSDoc @typedef.
 * Используются для генерации .d.ts и подсказок IDE.
 */

/**
 * Тип содержимого пункта меню.
 * - `none` — пустой сектор (не selectable, без hover, без action)
 * - `text` — текст, вписываемый в сектор автоматически
 * - `image` — изображение по URL, вписываемое с сохранением пропорций
 * - `node` — произвольный DOM Node, добавляется напрямую (без клонирования)
 * @typedef {'none' | 'text' | 'image' | 'node'} ContentType
 */

/**
 * Способ вписывания контента в сектор.
 * - `circle` — безопасная окружность: контент вписывается в квадрат
 *   внутри окружности, касающейся границ сектора; контент не поворачивается.
 * - `square` — прямоугольный бокс сектора; контент поворачивается вместе
 *   с сектором (левый край — у внутреннего радиуса, правый — у внешнего).
 * @typedef {'circle' | 'square'} Fit
 */

/**
 * Направление распределения пунктов меню.
 * @typedef {'clockwise' | 'counterclockwise'} Direction
 */

/**
 * Имя кнопки мыши (отслеживаемая кнопка меню).
 * - `left` — PointerEvent.button 0
 * - `middle` — PointerEvent.button 1
 * - `right` — PointerEvent.button 2
 * - `back` — PointerEvent.button 3
 * - `forward` — PointerEvent.button 4
 * @typedef {'left' | 'middle' | 'right' | 'back' | 'forward'} MouseButtonName
 */

/**
 * Режим поведения уже открытого меню.
 * - `hold` — выбор по pointerup кнопкой из `button`
 * - `click` — выбор по pointerup на selectable пункте кнопкой из `button`
 * @typedef {'hold' | 'click'} InteractionMode
 */

/**
 * Индикация пунктов-сабменю.
 * - `arc` — дуга у внутреннего радиуса (основание сектора)
 * - `chevron` — стрелка у внешнего края сектора, направленная радиально наружу
 * - `both` — и дуга, и стрелка (default)
 * Отдельного варианта без индикации нет: пункт-сабменю всегда помечается.
 * @typedef {'arc' | 'chevron' | 'both'} SubmenuIndicator
 */

/**
 * Имя части дуги для конфига `availableArc` (screen-углы: 0° = право,
 * 90° = низ, 180° = лево, 270° = верх).
 * - Половины: `'right'` [270°, 90°], `'bottom'` [0°, 180°], `'left'` [90°, 270°], `'top'` [180°, 360°]
 * - Четверти: `'top-right'` [270°, 360°], `'bottom-right'` [0°, 90°], `'bottom-left'` [90°, 180°], `'top-left'` [180°, 270°]
 * @typedef {'right' | 'bottom' | 'left' | 'top' | 'top-right' | 'bottom-right' | 'bottom-left' | 'top-left'} ArcPartName
 */

/**
 * Экземпляр кругового меню (см. `src/pielet.js`).
 * @typedef {import('./pielet.js').default} Pielet
 */

/**
 * Пункт меню.
 * @typedef {object} PieletItem
 * @property {ContentType} typeContent - тип содержимого
 * @property {string | Node} [content] - текст/URL для text/image, Node для node; игнорируется для none
 * @property {string} [id] - опциональный строковый идентификатор. Если не указан
 *   (или начинается с зарезервированного префикса `pielet-`) — генерируется
 *   автоматически при каждой нормализации в формате `pielet-<время>-<n>`.
 *   Этот id передаётся в `select` (event.detail.id) и первым аргументом в `action`.
 * @property {(id: string, menu: Pielet, coords: { x: number, y: number }) => void} [action] - вызывается после закрытия меню:
 *   первый аргумент — id пункта, второй — экземпляр меню, третий — координаты
 *   указателя (clientX/clientY) в момент клика по пункту. Игнорируется при `isSubMenu: true`.
 * @property {boolean} [keepOpen] - если true, выбор пункта в click-режиме не закрывает меню
 *   (select event и action по-прежнему вызываются). В hold-режиме флаг игнорируется.
 * @property {boolean} [isSubMenu] - если true, выбор пункта открывает сабменю `menu`
 *   вместо вызова `action`. Требует `typeContent` не `none` и наличие `menu`.
 *   В hold-режиме сабменю дополнительно открывается по hover-задержке `submenuDelay`.
 * @property {Pielet} [menu] - экземпляр меню, открываемый как сабменю этого пункта.
 *   Обязателен при `isSubMenu: true`.
 */

/**
 * `detail` событий `open`, `close`, `select`. Все события — `CustomEvent`,
 * диспатчатся на самом экземпляре меню; `detail.menu` — экземпляр, для которого вызвано событие.
 * @typedef {object} PieletEventDetail
 * @property {Pielet} menu - экземпляр меню, для которого вызвано событие
 * @property {string} [id] - строковый id выбранного пункта (только `select`)
 * @property {{ x: number, y: number }} [coords] - координаты указателя (clientX/clientY) в момент клика по пункту (только `select`)
 * @property {{ x: number, y: number, width: number, height: number, left: number, top: number, right: number, bottom: number }} [rect] - DOMRect-совместимый bounding rect видимой части меню (только `open`)
 */

/**
 * Конфигурация меню Pielet. Все поля, кроме `items`, опциональны —
 * отсутствующие получают дефолты из `DEFAULT_CONFIG`.
 * @typedef {object} PieletConfig
 * @property {number} [size] - внешний диаметр меню в CSS-пикселях (default 240)
 * @property {number} [centerSize] - диаметр центральной прозрачной области (default 72)
 * @property {number} [gap] - зазор между секторами в px по средней окружности (default 4)
 * @property {number} [startAngle] - угол начала первого пункта в градусах (default -90)
 * @property {Direction} [direction] - порядок распределения пунктов (default 'clockwise')
 * @property {InteractionMode} [interactionMode] - режим поведения меню (default 'click')
 * @property {MouseButtonName} [button] - отслеживаемая кнопка мыши (default 'left'). Меню реагирует только на неё
 * @property {number} [closeDistance] - доп. расстояние за внешним краем, после которого меню закрывается (default 48)
 * @property {Fit} [fit] - способ вписывания контента в сектор (default 'circle')
 * @property {boolean} [unifyText] - выровнять размер шрифта всех text-пунктов по
 *   самому длинному тексту (наименьший влезающий шрифт). Действует только при
 *   fit 'square', в 'circle' игнорируется (default false)
 * @property {number} [submenuDelay] - задержка (мс) открытия сабменю при наведении
 *   на пункт с `isSubMenu: true`. Действует в hold-режиме и в click-режиме, пока
 *   отслеживаемая кнопка удержана (меню работает как hold). 0 отключает
 *   hover-открытие, оставляя только открытие по клику (default 400)
 * @property {SubmenuIndicator} [submenuIndicator] - индикация пунктов-сабменю:
 *   'arc' — дуга у внутреннего радиуса, 'chevron' — стрелка у внешнего края,
 *   'both' — и дуга, и стрелка. Варианта без индикации нет (default 'both')
 * @property {ArcPartName[]} [availableArc] - доступные для показа пунктов части дуги.
 *   Непустой массив имён половин/четвертей; объединение частей должно образовывать
 *   одну сплошную дугу (пересечения и полный круг допустимы, разрывы — ошибка
 *   конфигурации). По умолчанию (не задано) — полный круг. У краёв viewport дуга
 *   сдвигается/отзеркаливается в свободную часть экрана, при нехватке места — сужается
 *   до наибольшей видимой дуги.
 * @property {PieletItem[]} items - пункты меню (обязательно, минимум один)
 */

export {};