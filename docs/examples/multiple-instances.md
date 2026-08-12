# Пример: несколько экземпляров

Несколько экземпляров допустимы — открытым может быть только один runtime. Открытие второго мгновенно закрывает первый (как системное контекстное меню).

```js
import Pielet from 'pielet';
import 'pielet/style.css';

const editorMenu = new Pielet({
  items: [{ typeContent: 'text', content: 'Открыть' }, { typeContent: 'text', content: 'Сохранить' }]
});
const fileMenu = new Pielet({
  items: [{ typeContent: 'text', content: 'Новый' }, { typeContent: 'text', content: 'Переименовать' }, { typeContent: 'none' }]
});

document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const targetInEditor = e.target.closest('#editor');
  const targetInFiles = e.target.closest('#file-list');
  if (targetInEditor) editorMenu.open(e.clientX, e.clientY);
  else if (targetInFiles) fileMenu.open(e.clientX, e.clientY);
});
```

- События `close` первого меню диспатчится; экземпляры остаются пригодными.
- Повторный `open()` того же экземпляра просто заменяет его runtime без дополнительного `close`.