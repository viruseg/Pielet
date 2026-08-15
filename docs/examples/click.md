# Пример: базовое контекстное меню (click)

```js
import Pielet from 'pielet';
import 'pielet/style.css';

const menu = new Pielet({
  button: 'right', // меню открывается и управляется правой кнопкой
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

- Правая кнопка мыши открывает меню; `config.button` задан как `'right'`, поэтому меню выбирает и закрывает именно по правой кнопке.
- Движение указателя подсвечивает секторы; клик по сектору вызывает `action`.
- Клик вне меню или по центру — закрывает.