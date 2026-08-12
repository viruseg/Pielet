# Архитектура Pielet

Pielet — библиотека из 10 модулей. Строгая граница: **геометрия — чистая математика без DOM**, JS-слой не знает про CSS, CSS не знает про JS.

## Слои

```
src/
  Pielet.js                      — публичный класс (EventTarget), оркестратор
  config/
    defaults.js                  — DEFAULT_CONFIG
    validateConfig.js            — normalizeConfig(config): валидация + слияние с дефолтами
  types.js                       — @typedef: ContentType, Direction, InteractionMode,
                                   PieletItem, PieletConfig
  geometry/                      — чистые функции, без DOM
    calculateMenuGeometry.js     — size/centerSize → outerRadius, innerRadius, ringWidth, meanRadius
    calculateVisibleArc.js       — видимая дуга в viewport (edge reflow)
    calculateSector.js           — раскладка секторов + clip-path (polygon)
    hitTestSector.js             — математический hit-testing указателя
  interaction/
    InteractionController.js     — pointermove/up/cancel/contextmenu на window
  lifecycle/
    ActiveMenuRegistry.js        — модульный реестр: одно открытое меню на страницу
  rendering/
    ContentRenderer.js           — текст (fit-to-box), image, node, none
    MenuRenderer.js              — DOM-монтаж, классы состояния, fade-out
  styles/
    pielet.css                   — тёмная тема, namespace .pielet
```

## Поток данных

```
open(x, y)
  └─ normalizeConfig (перевалидация + snapshot в menu.config)
  └─ acquireActiveMenu → предыдущее меню закрывается мгновенно
  └─ calculateMenuGeometry(config)
  └─ calculateVisibleArc({center, radius, viewport})   → {startAngle, arc}
  └─ calculateSectorLayout({arc, outerRadius, innerRadius, meanRadius, ringWidth, gap, direction})
    gap → угол по внешнему и внутреннему радиусу: points ровно на `gap` px друг от друга на обеих дугах;
  └─ MenuRenderer.mount({center, geometry, items})     → DOM в document.body
  └─ InteractionController.attach()                    → слушатели на window
  └─ слушатели viewport: window resize, document scroll (capture, passive),
    visualViewport resize → мгновенное закрытие
  └─ dispatch 'open'

pointer moves/up
  └─ getSelectedSector(x, y, geometry) → outside | center | gap | none | sector
  └─ hover: MenuRenderer.setHover(index | null)
  └─ select: dispatch 'select' → мгновенное закрытие → action()
close()
  └─ detach InteractionController, снять viewport-слушатели
  └─ fade-out opacity (transitionend + fallback по computed duration)
  └─ удаление DOM, releaseActiveMenu, dispatch 'close'
```

## Ключевые решения

### Единый runtime (ActiveMenuRegistry)

Модульный синглтон хранит текущее активное меню. `open()` второго экземпляра мгновенно закрывает первое. Это даёт поведение нативного контекстного меню без горизонтальных связей между экземплярами.

### Геометрия не знает DOM

`calculateMenuGeometry` / `calculateSectorLayout` / `calculateVisibleArc` / `getSelectedSector` принимают числа и возвращают числа. Все они покрыты юнит-тестами без jsdom. `buildSectorClipPath` — единственная функция слоя, возвращающая строку (полигон), и то чисто математическую.

### Edge reflow (§ видимая дуга)

Если круг выходит за края viewport, угол секторов вычисляется не от полного круга, а от наибольшей непрерывной дуги, видимой на экране; первый сектор переносится в начало дуги. Центр не смещается. При дуге < π/2 используется полная круговая геометрия. Реализация: пересечение угловых интервалов (± cos/sin ограничений от четырёх краёв), wrap-склейка дуги через 2π и выбор кандидата ближайшего к startAngle конфигурации.

### Hit-testing без DOM

Позиция указателя переводится в полярные координаты относительно центра и сравнивается с секторами. Границы инклюзивны с EPS 1e-9, при равенстве выигрывает первый по массиву. DOM-hittest (elementFromPoint) не используется вообще.

### Hover и события вне DOM

Все слушатели — на `window`, чтобы ловить указатель за пределами элемента меню. `pointer-events: none` на всём DOM меню: клики «сквозь» меню невозможны (меню не перехватывает события, все решения — математические).

### Пиксельная точность один-в-один

`open(x, y)` использует те же координаты, что и pointer events; анимации и hover-классы применяются без трансформаций-каскадов: элемент меню позиционируется вручную через left/top/width/height, дуги — через `clip-path` полигоны с точностью 2 знака после запятой.

### `action` вызывается после разбора DOM

Порядок: `select`-событие → мгновенное удаление DOM и слушателей → `action`. Исключения не подавляются. Это позволяет action открывать новое меню без конфликтов с закрывающимся.

### Мгновенное закрытие vs fade-out

- выбор пункта, scroll, resize, открытие другого меню → мгновенное удаление DOM;
- `close()` → fade-out (`--pielet-transition-duration`, fallback таймер duration+60ms).

## Тесты

- `tests/unit/<area>/` — jsdom только для interaction/rendering; geometry — pure node.
- `tests/integration/Pielet.test.js` — жизненный цикл класса.
- `e2e/pielet.e2e.spec.js` — Playwright против `demo/` (реальный браузер).