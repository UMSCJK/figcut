// 极简 CDP 客户端：起 headless Chrome，直连 DevTools 协议。
// 零依赖（node 自带 WebSocket + fetch），用来替代浏览器扩展做 UI 验证。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = process.env.FIGCUT_CHROME || 'google-chrome-stable';

export async function launch(opts = {}) {
  const port = opts.port || 9222 + Math.floor(Math.random() * 500);
  const profile = opts.profile || path.resolve('tmp/chrome-profile');
  fs.mkdirSync(profile, { recursive: true });

  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--no-first-run',
    '--disable-crash-reporter',
    '--user-data-dir=' + profile,
    '--remote-debugging-port=' + String(port),
    '--window-size=' + (opts.width || 1200) + ',' + (opts.height || 900),
    'about:blank',
  ];

  const proc = spawn(CHROME, args, { stdio: ['ignore', 'ignore', 'ignore'] });

  const deadline = Date.now() + 20000;
  let target = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json/list');
      const list = await res.json();
      target = list.find((t) => t.type === 'page');
      if (target) break;
    } catch (e) {
      // 还没起来
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  if (!target) {
    proc.kill('SIGKILL');
    throw new Error('Chrome 没起来（端口 ' + port + '）');
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let id = 0;
  const pending = new Map();
  const listeners = new Map();

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message + ' ' + JSON.stringify(msg.error.data || '')));
      else resolve(msg.result);
      return;
    }
    const fns = listeners.get(msg.method);
    if (fns) for (const fn of fns) fn(msg.params);
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const myId = ++id;
      pending.set(myId, { resolve, reject });
      ws.send(JSON.stringify({ id: myId, method, params }));
    });

  const once = (method, timeoutMs = 15000) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('等 ' + method + ' 超时')), timeoutMs);
      const fn = (params) => {
        clearTimeout(timer);
        const arr = listeners.get(method) || [];
        listeners.set(method, arr.filter((f) => f !== fn));
        resolve(params);
      };
      const arr = listeners.get(method) || [];
      arr.push(fn);
      listeners.set(method, arr);
    });

  await send('Page.enable');
  await send('Runtime.enable');
  // 关缓存：不然改了源码，页面还是旧的
  try {
    await send('Network.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true });
  } catch (e) {
    // 老 Chrome 无所谓
  }

  return {
    port,
    send,
    once,
    on(method, fn) {
      const arr = listeners.get(method) || [];
      arr.push(fn);
      listeners.set(method, arr);
    },
    async goto(url, waitUntil = 'load') {
      const loaded = once('Page.loadEventFired', 30000);
      await send('Page.navigate', { url });
      if (waitUntil !== 'none') await loaded;
    },
    async eval(expression) {
      const r = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      });
      if (r.exceptionDetails) {
        throw new Error('页面里抛错: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      }
      return r.result?.value;
    },
    async waitFor(expression, timeoutMs = 20000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (await this.eval(expression)) return true;
        await new Promise((r) => setTimeout(r, 150));
      }
      throw new Error('等条件超时: ' + expression);
    },
    async screenshot(outPath, opts2 = {}) {
      const r = await send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: !!opts2.fullPage,
      });
      fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
      fs.writeFileSync(outPath, Buffer.from(r.data, 'base64'));
      return outPath;
    },
    async mouse(type, x, y, extra = {}) {
      return send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, ...extra });
    },
    async close() {
      try {
        ws.close();
      } catch (e) {
        // ignore
      }
      proc.kill('SIGKILL');
    },
  };
}
