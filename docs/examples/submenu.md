# Пример: сабменю

Пункт с `isSubMenu: true` открывает другое меню (`menu`) вместо вызова `action`. В click-режиме сабменю открывается кликом по пункту, в hold-режиме — наведением с задержкой `submenuDelay`.

```js
import Pielet from 'pielet';
import 'pielet/style.css';

// Сабменю — обычный экземпляр Pielet.
const colors = new Pielet({
  items: [
    { typeContent: 'text', content: 'Красный', action: () => setColor('#f00') },
    { typeContent: 'text', content: 'Зелёный', action: () => setColor('#0f0') },
    { typeContent: 'text', content: 'Синий', action: () => setColor('#00f') }
  ]
});

const menu = new Pielet({
  interactionMode: 'hold', // hold: сабменю открывается наведением
  button: 'left',
  submenuDelay: 400,      // задержка наведения до открытия сабменю (мс)
  items: [
    { typeContent: 'text', content: 'Цвет', isSubMenu: true, menu: colors },
    { typeContent: 'text', content: 'Сброс', action: () => setColor(null) }
  ]
});

document.addEventListener('pointerdown', (e) => {
  if (e.button !== Pielet.BUTTONS[menu.config.button]) return;
  e.preventDefault();
  menu.open(e.clientX, e.clientY);
});
```

- Клик (или клик-удержание в hold) по пункту «Цвет» открывает сабменю в точке указателя; `action` этого пункта игнорируется.
- `select`-событие на родителе при клике по сабменю-пункту эмитится как обычно.
- Если сабменю в hold-режиме с той же кнопкой, что и родитель, оно продолжает отслеживать зажатую кнопку и работает как обычное hold-меню.