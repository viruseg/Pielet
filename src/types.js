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
 * Экземпляр кругового меню (см. `src/Pielet.js`).
 * @typedef {import('./Pielet.js').default} Pielet
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
 * @property {(id: string, menu: Pielet) => void} [action] - вызывается после закрытия меню:
 *   первый аргумент — id пункта, второй — экземпляр меню, для которого вызван action
 * @property {boolean} [keepOpen] - если true, выбор пункта в click-режиме не закрывает меню
 *   (select event и action по-прежнему вызываются). В hold-режиме флаг игнорируется.
 */

/**
 * `detail` событий `open`, `close`, `select`. Все события — `CustomEvent`,
 * диспатчатся на самом экземпляре меню; `detail.menu` — экземпляр, для которого вызвано событие.
 * @typedef {object} PieletEventDetail
 * @property {Pielet} menu - экземпляр меню, для которого вызвано событие
 * @property {string} [id] - строковый id выбранного пункта (только `select`)
 * @property {object} [rect] - DOMRect-совместимый bounding rect видимой части меню (только `open`)
 */

/**
 * Конфигурация меню Pielet.
 * @typedef {object} PieletConfig
 * @property {number} size - внешний диаметр меню в CSS-пикселях (default 240)
 * @property {number} centerSize - диаметр центральной прозрачной области (default 72)
 * @property {number} gap - зазор между секторами в px по средней окружности (default 4)
 * @property {number} startAngle - угол начала первого пункта в градусах (default -90)
 * @property {Direction} direction - порядок распределения пунктов (default 'clockwise')
 * @property {InteractionMode} interactionMode - режим поведения меню (default 'click')
 * @property {MouseButtonName} button - отслеживаемая кнопка мыши (default 'left'). Меню реагирует только на неё
 * @property {number} closeDistance - доп. расстояние за внешним краем, после которого меню закрывается (default 48)
 * @property {Fit} fit - способ вписывания контента в сектор (default 'circle')
 * @property {PieletItem[]} items - пункты меню (обязательно, минимум один)
 */

export {};