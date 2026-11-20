#!/usr/bin/env python3
"""把 probe.mjs 的结果画出来：整页带框、以及导出框 + 边距的 1:1 裁切。"""
import argparse, json, pathlib
from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument('--ppm', required=True)
ap.add_argument('--json', required=True)
ap.add_argument('--out-dir', default='tmp/out')
ap.add_argument('--margin', type=float, default=8)
a = ap.parse_args()

data = json.load(open(a.json, encoding='utf-8'))
img = Image.open(a.ppm).convert('RGB')
s = data['pxPerPt']
rect = data['rect']
box = data['exportBox']

out = pathlib.Path(a.out_dir)
out.mkdir(parents=True, exist_ok=True)

# 1) 整页 + 手画框（蓝）+ 导出框（红）
page = img.copy()
d = ImageDraw.Draw(page)
d.rectangle([rect['x'] * s, rect['y'] * s, (rect['x'] + rect['w']) * s, (rect['y'] + rect['h']) * s], outline=(0, 90, 255), width=3)
d.rectangle([box['x'] * s, box['y'] * s, (box['x'] + box['w']) * s, (box['y'] + box['h']) * s], outline=(220, 40, 40), width=2)
scale = 900 / page.width
page.resize((900, int(page.height * scale)), Image.LANCZOS).save(out / 'page.png')

# 2) 导出框 + 边距，1:1
m = a.margin * s
l = max(0, (box['x'] - a.margin) * s)
t = max(0, (box['y'] - a.margin) * s)
r = min(img.width, (box['x'] + box['w'] + a.margin) * s)
b = min(img.height, (box['y'] + box['h'] + a.margin) * s)
crop = img.crop((int(l), int(t), int(r), int(b)))
crop.save(out / 'crop.png')

# 3) 四边像素检查：导出框最外那一行/列是否全白
px = img.load()
x0, y0 = round(box['x'] * s), round(box['y'] * s)
x1, y1 = round((box['x'] + box['w']) * s) - 1, round((box['y'] + box['h']) * s) - 1
def row_white(y, xa, xb):
    return all(min(px[x, y]) >= 250 for x in range(xa, xb + 1))
def col_white(x, ya, yb):
    return all(min(px[x, y]) >= 250 for y in range(ya, yb + 1))
print(json.dumps({
    'page': str(out / 'page.png'),
    'crop': str(out / 'crop.png'),
    'cropSize': list(crop.size),
    'edges': {
        'top': row_white(y0, x0, x1),
        'bottom': row_white(y1, x0, x1),
        'left': col_white(x0, y0, y1),
        'right': col_white(x1, y0, y1),
    },
}, ensure_ascii=False))
