// 框的增删改与工具模式
// 状态：已实现（纯逻辑：坐标一律 pt，不碰 DOM，可在 node 单测）。
// 已拍板：蓝框停在手画位置，不做任何吸附；白界只由导出框负责。

import { rectFromPoints, clampRect, hitTestRect, hitTestPoly, cornerAt, polyBounds, movePoly } from '../core/geometry.js';

export const TOOLS = ['select', 'rect', 'poly'];

export function createEditor(opts = {}) {
  return {
    tool: opts.tool || 'rect',
    page: opts.page || 1,
    pageW: opts.pageW || 595,
    pageH: opts.pageH || 842,
    regions: [],
    selectedId: null,
    draft: null,
    drag: null,
    nextId: 1,
  };
}

export function setTool(ed, tool) {
  if (!TOOLS.includes(tool)) throw new Error('未知工具: ' + tool);
  ed.tool = tool;
  ed.draft = null;
  ed.drag = null;
  return tool;
}

export function setPage(ed, page) {
  ed.page = page;
  ed.selectedId = null;
  ed.draft = null;
  ed.drag = null;
}

export function boundsOf(region) {
  return region.shape === 'poly' ? polyBounds(region.points) : region.rect;
}

export function regionAt(ed, pt) {
  for (let i = ed.regions.length - 1; i >= 0; i -= 1) {
    const r = ed.regions[i];
    if (r.page !== ed.page) continue;
    const hit = r.shape === 'poly' ? hitTestPoly(r.points, pt.x, pt.y, 2) : hitTestRect(r.rect, pt.x, pt.y, 2);
    if (hit) return r;
  }
  return null;
}

export function selected(ed) {
  return ed.regions.find((r) => r.id === ed.selectedId) || null;
}

export function addRegion(ed, region) {
  const r = { id: ed.nextId++, kind: 'stem', opt: null, q: '', note: '', page: ed.page, ...region };
  ed.regions.push(r);
  ed.selectedId = r.id;
  return r;
}

export function deleteSelection(ed) {
  if (ed.selectedId === null) return null;
  const idx = ed.regions.findIndex((r) => r.id === ed.selectedId);
  if (idx < 0) return null;
  const [gone] = ed.regions.splice(idx, 1);
  ed.selectedId = null;
  return gone;
}

// 方向键微移：Shift 1pt / Alt 10pt 由调用方换算好再传进来。
export function nudge(ed, dx, dy) {
  const r = selected(ed);
  if (!r) return null;
  if (r.shape === 'poly') {
    r.points = movePoly(r.points, dx, dy, ed.pageW, ed.pageH);
  } else {
    r.rect = clampRect({ x: r.rect.x + dx, y: r.rect.y + dy, w: r.rect.w, h: r.rect.h }, ed.pageW, ed.pageH);
  }
  return r;
}

// 边命中：把矩形拆成四条边，返回 'n' | 's' | 'w' | 'e'
export function edgeAt(rect, x, y, tol = 8) {
  const nearX = x >= rect.x - tol && x <= rect.x + rect.w + tol;
  const nearY = y >= rect.y - tol && y <= rect.y + rect.h + tol;
  if (!nearX || !nearY) return null;
  if (Math.abs(y - rect.y) <= tol) return 'n';
  if (Math.abs(y - (rect.y + rect.h)) <= tol) return 's';
  if (Math.abs(x - rect.x) <= tol) return 'w';
  if (Math.abs(x - (rect.x + rect.w)) <= tol) return 'e';
  return null;
}

// 顶点命中：返回索引
export function vertexAt(points, x, y, tol = 8) {
  for (let i = 0; i < points.length; i += 1) {
    if (Math.hypot(points[i].x - x, points[i].y - y) <= tol) return i;
  }
  return -1;
}

const HANDLE_TOL = 8;

// 任何工具下，先看能不能编辑已有框；空白处才用当前工具新建。
export function pointerDown(ed, pt) {
  const sel = selected(ed);
  if (sel && sel.page === ed.page) {
    if (sel.shape === 'rect') {
      const corner = cornerAt(sel.rect, pt.x, pt.y, HANDLE_TOL);
      if (corner) {
        ed.drag = { mode: 'resize', corner, start: { ...pt }, origin: { ...sel.rect }, target: sel };
        return { selection: sel.id, mode: 'resize' };
      }
      const edge = edgeAt(sel.rect, pt.x, pt.y, HANDLE_TOL);
      if (edge) {
        ed.drag = { mode: 'resize', edge, start: { ...pt }, origin: { ...sel.rect }, target: sel };
        return { selection: sel.id, mode: 'resize' };
      }
    } else {
      const vi = vertexAt(sel.points, pt.x, pt.y, HANDLE_TOL + 2);
      if (vi >= 0) {
        ed.drag = { mode: 'vertex', index: vi, start: { ...pt }, origin: sel.points.map((p) => ({ ...p })), target: sel };
        return { selection: sel.id, mode: 'vertex' };
      }
    }
  }

  const hit = regionAt(ed, pt);
  if (hit) {
    ed.selectedId = hit.id;
    ed.drag = {
      mode: 'move',
      start: { ...pt },
      origin: hit.shape === 'poly' ? hit.points.map((p) => ({ ...p })) : { ...hit.rect },
      target: hit,
    };
    return { selection: hit.id, mode: 'move' };
  }

  ed.selectedId = null;

  if (ed.tool === 'rect') {
    // 两次点击画矩形：第一次落角，第二次对角即成形（拖动也照样可用）
    if (ed.draft && ed.draft.shape === 'rect') {
      ed.draft.clicked = true;
      ed.draft.x1 = pt.x;
      ed.draft.y1 = pt.y;
      return { draft: true, second: true };
    }
    ed.draft = { shape: 'rect', x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y, clicked: false };
    return { draft: true };
  }

  if (ed.tool === 'poly') {
    if (!ed.draft || ed.draft.shape !== 'poly') ed.draft = { shape: 'poly', points: [{ x: pt.x, y: pt.y }] };
    else ed.draft.points.push({ x: pt.x, y: pt.y });
    return { draft: true, points: ed.draft.points.length };
  }

  return { selection: null };
}

export function pointerMove(ed, pt) {
  if (ed.draft && ed.draft.shape === 'rect') {
    ed.draft.x1 = pt.x;
    ed.draft.y1 = pt.y;
    return { draft: true };
  }

  if (!ed.drag) return null;
  const t = ed.drag.target;
  const dx = pt.x - ed.drag.start.x;
  const dy = pt.y - ed.drag.start.y;

  if (ed.drag.mode === 'move') {
    if (t.shape === 'poly') {
      const moved = movePoly(ed.drag.origin, dx, dy, ed.pageW, ed.pageH);
      t.points = moved;
    } else {
      t.rect = clampRect({ x: ed.drag.origin.x + dx, y: ed.drag.origin.y + dy, w: ed.drag.origin.w, h: ed.drag.origin.h }, ed.pageW, ed.pageH);
    }
    return { moved: true };
  }

  if (ed.drag.mode === 'vertex') {
    const idx = ed.drag.index;
    const pts = ed.drag.origin.map((p) => ({ x: p.x, y: p.y }));
    if (pts[idx]) {
      pts[idx] = {
        x: Math.min(Math.max(pt.x, 0), ed.pageW),
        y: Math.min(Math.max(pt.y, 0), ed.pageH),
      };
      t.points = pts;
    }
    return { vertex: true };
  }

  const o = ed.drag.origin;
  let left = o.x;
  let top = o.y;
  let right = o.x + o.w;
  let bottom = o.y + o.h;
  const corner = ed.drag.corner;
  const edge = ed.drag.edge;

  if (corner) {
    if (corner.includes('w')) left = Math.min(pt.x, right - 2);
    if (corner.includes('e')) right = Math.max(pt.x, left + 2);
    if (corner.includes('n')) top = Math.min(pt.y, bottom - 2);
    if (corner.includes('s')) bottom = Math.max(pt.y, top + 2);
  } else if (edge === 'n') {
    top = Math.min(pt.y, bottom - 2);
  } else if (edge === 's') {
    bottom = Math.max(pt.y, top + 2);
  } else if (edge === 'w') {
    left = Math.min(pt.x, right - 2);
  } else if (edge === 'e') {
    right = Math.max(pt.x, left + 2);
  }

  t.rect = clampRect({ x: left, y: top, w: right - left, h: bottom - top }, ed.pageW, ed.pageH);
  return { resized: true };
}

export function pointerUp(ed, pt) {
  if (ed.draft && ed.draft.shape === 'rect') {
    const moved = Math.hypot(pt.x - ed.draft.x0, pt.y - ed.draft.y0);
    // 点了一下没拖：等着点第二个对角点
    if (!ed.draft.clicked && moved < 2) return null;

    const r = rectFromPoints(ed.draft.x0, ed.draft.y0, ed.draft.x1, ed.draft.y1);
    ed.draft = null;
    if (!r) return null;
    return addRegion(ed, { shape: 'rect', rect: clampRect(r, ed.pageW, ed.pageH) });
  }

  if (ed.draft && ed.draft.shape === 'poly') {
    // 只有"点回首点"才闭合；否则继续加点（Enter 走 closePoly）
    const first = ed.draft.points[0];
    const nearFirst = Math.hypot(pt.x - first.x, pt.y - first.y) <= 8;
    if (nearFirst && ed.draft.points.length >= 4) {
      ed.draft.points.pop();
      return closePoly(ed);
    }
    return null;
  }

  if (ed.drag) {
    ed.drag = null;
    return { committed: true };
  }
  return null;
}

export function closePoly(ed) {
  if (!ed.draft || ed.draft.shape !== 'poly') return null;
  if (ed.draft.points.length < 3) {
    ed.draft = null;
    return null;
  }
  const points = ed.draft.points.map((p) => ({ x: p.x, y: p.y }));
  ed.draft = null;
  return addRegion(ed, { shape: 'poly', points });
}
