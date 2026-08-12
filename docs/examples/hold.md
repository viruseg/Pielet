# Пример: hold-режим (удержание кнопки)

Удержание кнопки мыши (или тача) открывает меню, движение без отпускания подсвечивает сектор, отпускание выбирает.

```js
import Pielet from 'pielet';
import 'pielet/style.css';

const menu = new Pielet({
  interactionMode: 'hold',
  button: 0, // PointerEvent.button
  items: [
    { typeContent: 'text', content: 'Копировать', action: copy },
    { typeContent: 'text', content: 'Вырезать', action: cut },
    { typeContent: 'text', content: 'Вставить', action: paste }
  ]
});

document.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  menu.open(e.clientX, e.clientY);
});
```

В hold-режиме выбор игнорирует `pointerup` с другими кнопками: отпускание правой кнопки (кнопки 2), например, не выберет пункт.