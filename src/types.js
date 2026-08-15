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
 * Пункт меню.
 * @typedef {object} PieletItem
 * @property {ContentType} typeContent - тип содержимого
 * @property {string | Node} [content] - текст/URL для text/image, Node для node; игнорируется для none
 * @property {string} [id] - опциональный строковый идентификатор. Если не указан
 *   (или начинается с зарезервированного префикса `pielet-`) — генерируется
 *   автоматически при каждой нормализации в формате `pielet-<время>-<n>`.
 *   Этот id передаётся в `select` (event.detail.id) и первым аргументом в `action`.
 * @property {(id: string) => void} [action] - вызывается с id пункта после полного закрытия меню
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
 * @property {PieletItem[]} items - пункты меню (обязательно, минимум один)
 */

export {};