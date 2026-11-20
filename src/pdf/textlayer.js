// 文本层：把词的坐标读出来（文字不算笔画，只用来让出边界）
// 状态：已实现。parseWordBoxes 是纯函数，poppler 的 -bbox 输出和 pdf.js 都能喂。

export function parseWordBoxes(xhtml) {
  const out = [];
  const re = /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g;
  let m;
  while ((m = re.exec(xhtml)) !== null) {
    const x = Number(m[1]);
    const y = Number(m[2]);
    out.push({
      x,
      y,
      w: Number(m[3]) - x,
      h: Number(m[4]) - y,
      text: m[5],
    });
  }
  return out;
}

// 只留和框有交集的词，减少 pushTextOut 的扫描量。
export function textBoxesOnPage(words, rect) {
  return words.filter(
    (t) => t.x < rect.x + rect.w && t.x + t.w > rect.x && t.y < rect.y + rect.h && t.y + t.h > rect.y
  );
}

// 浏览器侧：pdf.js 给的是页面用户空间（左下原点、y 向上），
// 我们的掩膜是左上原点、y 向下，这里必须翻一次，否则文字框整个上下颠倒。
export async function readTextLayer(page) {
  const viewport = page.getViewport({ scale: 1 });
  const pageH = viewport.height;
  const content = await page.getTextContent();
  return content.items
    .filter((it) => it.str && it.str.trim())
    .map((it) => ({
      x: it.transform[4],
      y: pageH - (it.transform[5] + it.height),
      w: it.width,
      h: it.height,
      text: it.str,
    }));
}
