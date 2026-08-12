# Пример: базовое контекстное меню (click)

```js
import Pielet from 'pielet';
import 'pielet/style.css';

const menu = new Pielet({
  items: [
    { typeContent: 'text', content: 'Открыть', action: openFile },
    { typeContent: 'text', content: 'Сохранить', action: saveFile },
    { typeContent: 'text', content: 'Удалить', action: deleteFile }
  ]
});

document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  menu.open(e.clientX, e.clientY);
});
```

- Правая кнопка мыши открывает меню (click-режим выбирает любой кнопкой).
- Движение указателя подсвечивает секторы; клик по сектору вызывает `action`.
- Клик вне меню или по центру — закрывает.