import { test, assert } from '../tools/testkit.mjs';
import { openDocument, pageCount, pageSize } from '../src/pdf/document.js';

test('document: 没有 pdf.js 时明确报错', async () => {
  let threw = false;
  try {
    await openDocument({ url: 'x.pdf' }, { lib: null });
  } catch (e) {
    threw = e && e.name === 'FigcutError' && e.code === 'no-pdfjs';
  }
  assert(threw, '应抛 no-pdfjs');
});

test('document: 页数与页尺寸', async () => {
  const fake = {
    pdf: {
      numPages: 12,
      getPage: async () => ({ getViewport: () => ({ width: 595.276, height: 841.89, rotation: 0 }) }),
    },
    id: 'd1',
    pages: 12,
  };
  assert(pageCount(fake) === 12);
  const size = await pageSize(fake, 1);
  assert(Math.round(size.w) === 595 && Math.round(size.h) === 842, JSON.stringify(size));
});

test('document: openDocument 走 pdf.js 并带出 id', async () => {
  const lib = {
    GlobalWorkerOptions: {},
    getDocument: () => ({ promise: Promise.resolve({ numPages: 3 }) }),
  };
  const doc = await openDocument({ data: new Uint8Array([1]) }, { lib, id: 'doc-x' });
  assert(doc.id === 'doc-x' && doc.pages === 3);
});
