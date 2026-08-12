# Пример: пустые секторы-разделители (none)

`typeContent: 'none'` — сектор рисуется, но не подсвечивается, не выбирается и не имеет контента. Удобно для разделения групп или «пустого угла» у медленных действий.

```js
import Pielet from 'pielet';
import 'pielet/style.css';

const menu = new Pielet({
  gap: 4,
  items: [
    { typeContent: 'text', content: 'Копировать' },
    { typeContent: 'none' },              // разделитель
    { typeContent: 'text', content: 'Вставить' },
    { typeContent: 'none' }
  ]
});
```

- Hover-подсветка на `none`-сектор не применяется.
- Клик по `none`-сектору закрывает меню без `select`.