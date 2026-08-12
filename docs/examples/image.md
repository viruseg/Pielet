# Пример: иконки из изображений (image)

```js
import Pielet from 'pielet';
import 'pielet/style.css';

const menu = new Pielet({
  items: [
    { typeContent: 'image', content: '/icons/copy.svg', action: copy },
    { typeContent: 'image', content: '/icons/cut.svg', action: cut },
    { typeContent: 'image', content: '/icons/trash.svg', action: remove }
  ]
});
```

`content` — URL строкой (подставляется как `src` в `<img>` со значением `object-fit` по умолчанию). Размер изображения ограничивается доступной областью сектора (`--pielet-*` переменные не управляют размером картинки — задавайте ширину/высоту стилями на `.pielet__content--image img` при необходимости).