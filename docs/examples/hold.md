# Пример: hold-режим (удержание кнопки)

Удержание кнопки мыши (или тача) открывает меню, движение без отпускания подсвечивает сектор, отпускание выбирает.

```js
import Pielet from 'pielet';
import 'pielet/style.css';

const menu = new Pielet({
  interactionMode: 'hold',
  button: 'left',
  items: [
    { typeContent: 'text', content: 'Копировать', action: copy },
    { typeContent: 'text', content: 'Вырезать', action: cut },
    { typeContent: 'text', content: 'Вставить', action: paste }
  ]
});

document.addEventListener('pointerdown', (e) => {
  // открываем меню только отслеживаемой кнопкой конфига
  if (e.button !== Pielet.BUTTONS[menu.config.button]) return;
  e.preventDefault();
  menu.open(e.clientX, e.clientY);
});
```

В hold-режиме меню живёт, пока отслеживаемая кнопка удерживается: движение без отпускания подсвечивает сектор, отпускание на секторе выбирает пункт, отпускание вне сектора закрывает меню. `pointerup` любой другой кнопки игнорируется — например, отпускание правой кнопки (кнопки 2) не выберет пункт, если `button` задан как `'left'`.

Для правой кнопки задайте `button: 'right'` (именно она будет отслеживаться при открытии, выборе и закрытии).