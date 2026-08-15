# Pielet

Лёгкая библиотека круговых (радиальных) контекстных меню для браузера. Ноль зависимостей, чистый ESM, тёмная тема из коробки.

- Раскладка секторов, hover, hit-testing и поведение при выходе за край экрана — чистая математика без DOM.
- Один открытый runtime на страницу (браузерный паттерн context menu), кросс-экземплярная гарантия «одно меню».
- Стили — только через CSS custom properties, темы переопределяются без копирования библиотечных стилей.
- Отрисовка — DOM + CSS `clip-path`.

## Быстрый старт

```html
<link rel="stylesheet" href="src/styles/pielet.css" />
```

```js
import Pielet from 'pielet.js';

const menu = new Pielet({
  items: [
    { typeContent: 'text', content: 'Открыть', action: () => openFile() },
    { typeContent: 'text', content: 'Сохранить' },
    { typeContent: 'none' }
  ]
});

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  menu.open(e.clientX, e.clientY);
});
```

## API

| Член | Описание |
| --- | --- |
| `new Pielet(config)` | Создаёт экземпляр. Конфигурация нормализуется и валидируется. DOM не создаётся до `open()`. |
| `menu.config` | Живой объект конфигурации. Изменения применяются при следующем `open()`. |
| `menu.open(x, y)` | Открывает меню с центром в точке viewport (clientX/clientY). Выбрасывает ошибку на нечисловых координатах. |
| `menu.close()` | Плавно закрывает меню. No-op, если меню закрыто. |
| События | `open`, `close` — `CustomEvent` без `detail`; `select` — с `detail: { id }`, диспатчатся на экземпляре (`EventTarget`). |
| `menu.config.items[i].action` | Вызывается после полного закрытия меню (DOM и слушатели уже убраны), с одним аргументом — `id` пункта (строка). |

Исключения из `action` пробрасываются в консоль (не проглатываются); меню при этом остаётся закрытым и пригодным к переиспользованию.

## События

Экземпляр реализует `EventTarget`. События `open` и `close` — `CustomEvent` без `detail`; `select` несёт `detail: { id }` — строковый идентификатор выбранного пункта. Все диспатчатся на самом экземпляре:

```js
const menu = new Pielet({ items: [{ typeContent: 'text', content: 'Открыть' }] });

menu.addEventListener('open', () => {
  console.log('меню открыто и готово к взаимодействию');
});
menu.addEventListener('close', () => {
  console.log('меню закрыто и удалено из DOM');
});
menu.addEventListener('select', (e) => {
  console.log('выбран сектор с id', e.detail.id);
});
```

Порядок при выборе пункта: `select` → `close` → вызов `action`.

## Конфигурация

| Поле | По умолчанию | Описание |
| --- | --- | --- |
| `size` | `240` | Внешний диаметр меню в px (включая кольцо). |
| `centerSize` | `72` | Диаметр центральной dead zone (клик по центру закрывает меню). |
| `gap` | `4` | Зазор между секторами в px (не рисуется, если пункт всего один). |
| `startAngle` | `-90` | Угол первого сектора в градусах (правый край — 0°, верх — -90°). При одном пункте — угол, на котором центрируется контент. |
| `direction` | `'clockwise'` | `'clockwise'` \| `'counterclockwise'`. |
| `interactionMode` | `'click'` | `'click'` \| `'hold'`. В hold-режиме меню живёт, пока удержана кнопка из `button`. |
| `button` | `'left'` | Отслеживаемая кнопка: `'left'` \| `'middle'` \| `'right'` \| `'back'` \| `'forward'`. Меню выбирает/закрывается только по её отпусканию (и в hold, и в click). |
| `closeDistance` | `48` | Дополнительный радиус вокруг меню: выход указателя за него закрывает меню. |
| `items` | — (обязательно) | Массив пунктов `PieletItem`, непустой. |

### PieletItem

| Поле | Описание |
| --- | --- |
| `typeContent` | `'text'` \| `'image'` \| `'node'` \| `'none'`. `'none'` — пустой (некликабельный и неhover-ящийся) сектор-разделитель. |
| `content` | Строка для text/image, `Node` (например, `SVGElement`) для node. |
| `id` | Опциональный строковый идентификатор. Если не указан — генерируется автоматически при каждом `open()` в формате `pielet-<время>-<n>` (префикс `pielet-` зарезервирован). Передаётся в `select` (`event.detail.id`) и первым аргументом в `action`. |
| `action` | Опциональная функция `(id) => {}`, вызываемая при выборе. |

## Кастомизация темы

Определите переменные до загрузки стилей либо на `:root`, либо на любом родителе (переменные наследуются):

```css
:root {
  --pielet-background: #2d2f36;        /* фон сектора */
  --pielet-background-hover: #43475a;  /* hover-подсветка */
  --pielet-opacity: 0.97;              /* непрозрачность меню */
  --pielet-color: #f2f2f4;             /* цвет текста/иконок */
  --pielet-font-size: 14px;            /* базовый размер шрифта text-пунктов */
  --pielet-transition-duration: 150ms; /* длительность появления/закрытия */
  --pielet-transition-easing: cubic-bezier(0.2, 0.6, 0.3, 1);
  --pielet-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
}
```

Все стили ограничены namespace `.pielet` — глобальных правил нет.

## Поведение у края экрана

Если круг меню выходит за границы viewport, пункты перераспределяются по наибольшей непрерывной видимой дуге (край «съедает» недоступные секторы). Если видимая дуга меньше четверти круга — используется геометрия полного круга. Центр меню никогда не перемещается.

Меню немедленно закрывается при `scroll` (в любом контейнере), `resize` окна и `visualViewport.resize`.

## Требования к браузеру

Любой современный браузер с поддержкой Pointer Events, `clip-path` и CSS custom properties (Chrome/Edge 80+, Firefox 70+, Safari 14+).

## Демо

```bash
npm run dev:demo
```

Откройте http://localhost:5173/demo/, либо смотрите примеры в `docs/examples/`.

## Разработка

```bash
npm install       # install
npm test          # unit + integration (vitest)
npm run test:e2e  # end-to-end (Playwright, chromium)
npm run build     # dist/pielet.js + dist/pielet.css + dist/*.d.ts
npx vite          # run
```

## Лицензия

MIT