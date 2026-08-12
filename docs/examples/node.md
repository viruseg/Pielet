# Пример: произвольный DOM-узел (node)

`typeContent: 'node'` вставляет любой `Node` — SVG-иконку, канвас, спан с эмодзи.

```js
import Pielet from 'pielet';
import 'pielet/style.css';

function svgIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '28');
  svg.setAttribute('height', '28');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M12 2 L22 22 L12 16 L2 22 Z');
  path.setAttribute('fill', 'currentColor');
  svg.appendChild(path);
  return svg;
}

const menu = new Pielet({
  items: [
    { typeContent: 'node', content: svgIcon(), action: starAction }
  ]
});
```

Примечание:
- Узел вставляется как есть (перенос одного и того же узла в несколько меню не допускается — используйте отдельные узлы),
- узел помещается в контейнер `.pielet__content--node` с теми же ограничениями области сектора.