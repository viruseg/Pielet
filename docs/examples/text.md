# Пример: текстовые пункты

`typeContent: 'text'` — текст растягивается так, чтобы заполнить доступную область сектора: шрифт подбирается максимальным, влезающим в бокс (без CSS-переменных шрифта; размер управляется автоматически).

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

## Способ вписывания: `fit`

По умолчанию `fit: 'circle'` — контент вписывается по безопасной окружности сектора и не поворачивается (текст всегда горизонтален):

```js
const circle = new Pielet({
  size: 280,
  fit: 'circle',
  items: [{ typeContent: 'text', content: 'Горизонтальный' }]
});
```

С `fit: 'square'` контент поворачивается вместе с сектором: левый край ложится к внутреннему радиусу меню, правый — к внешнему:

```js
const square = new Pielet({
  size: 280,
  fit: 'square',
  items: [{ typeContent: 'text', content: 'Вдоль сектора' }]
});
```