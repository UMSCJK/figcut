import { test, assert } from '../tools/testkit.mjs';
import { parseWordBoxes, textBoxesOnPage, readTextLayer } from '../src/pdf/textlayer.js';

const XHTML = `<page width="595" height="842">
  <word xMin="89.88" yMin="72.60" xMax="136.43" yMax="84.82">Questions</word>
  <word xMin="357.00" yMin="400.00" xMax="400.00" yMax="410.00">inside</word>
</page>`;

test('textlayer: 解析 poppler -bbox 的词框', () => {
  const words = parseWordBoxes(XHTML);
  assert(words.length === 2, '应解析出 2 个词');
  assert(words[0].text === 'Questions');
  assert(Math.abs(words[0].w - 46.55) < 0.01, '宽由 xMax-xMin 得出');
});

test('textlayer: 只留与框相交的词', () => {
  const words = parseWordBoxes(XHTML);
  const hit = textBoxesOnPage(words, { x: 350, y: 390, w: 100, h: 100 });
  assert(hit.length === 1 && hit[0].text === 'inside', JSON.stringify(hit));
  assert(textBoxesOnPage(words, { x: 0, y: 0, w: 50, h: 50 }).length === 0);
});

test('textlayer: pdf.js 文本层要从左下原点翻到左上原点', async () => {
  const page = {
    getViewport: () => ({ width: 595, height: 842 }),
    getTextContent: async () => ({
      items: [
        { str: 'A', transform: [1, 0, 0, 1, 40, 300], width: 8, height: 10 },
        { str: '  ', transform: [1, 0, 0, 1, 0, 0], width: 4, height: 10 },
      ],
    }),
  };
  const words = await readTextLayer(page);
  assert(words.length === 1, '空白要过滤掉');
  assert(words[0].x === 40, 'x 不变');
  assert(words[0].y === 842 - 310, 'y 必须翻转：实际 ' + words[0].y);
  assert(words[0].h === 10);
});
