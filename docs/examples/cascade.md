# Пример: каскадные меню

Каскад реализуется через `action`: перед открытием нового меню текущее уже закрыто (порядок: select → close → action), поэтому открытие следующего меню не конфликтует с реестром.

```js
import Pielet from 'pielet';
import 'pielet/style.css';

const rootMenu = new Pielet({
  items: [
    {
      typeContent: 'text',
      content: 'Вставить ▸',
      action: () => subMenu.open(pointerLastX, pointerLastY)
    },
    { typeContent: 'text', content: 'Копировать', action: copy }
  ]
});

const subMenu = new Pielet({
  items: [
    { typeContent: 'text', content: 'Как текст', action: pastePlain },
    { typeContent: 'text', content: 'Без форматирования', action: pasteKeep }
  ]
});

let pointerLastX = 0;
let pointerLastY = 0;
window.addEventListener('pointermove', (e) => {
  pointerLastX = e.clientX;
  pointerLastY = e.clientY;
});

document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  rootMenu.open(e.clientX, e.clientY);
});
```

Особенности:

- `action` вызывается после полного удаления DOM первого меню — в момент вызова `document.querySelector('.pielet') === null`.
- Меню каскада открывается там, где пользователь отпустил кнопку (если не менять позицию — передавайте сохранённую позицию указателя).
- Пиксельная позиция каскада выбирается вами: движение к следующему уровню можно привязать к границе сектора (см. `menu.config` для вычисления углов) или позиции указателя.