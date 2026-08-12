# Пример: текстовые пункты

`typeContent: 'text'` — текст автоматически ужимается под область сектора (min 8px, шаг 1px).

```js
import Pielet from 'pielet';
import 'pielet/style.css';

const menu = new Pielet({
  size: 280,
  items: [
    { typeContent: 'text', content: 'Новый файл' },
    { typeContent: 'text', content: 'Открыть…' },
    { typeContent: 'text', content: 'Закрыть вкладку' }
  ]
});
```

Базовый размер шрифта берётся из CSS-переменной `--pielet-font-size` (по умолчанию 14px), если тема не подключена — из fallback.