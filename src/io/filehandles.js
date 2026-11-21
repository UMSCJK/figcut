// 记住最近打开的文件句柄（File System Access API + IndexedDB），
// 这样点「最近打开」能直接打开，而不是再弹一次选择框。
// 状态：已实现；不支持句柄的浏览器自动退回文件选择框。

const DB_NAME = 'figcut';
const STORE = 'handles';

function hasIdb() {
  return typeof indexedDB !== 'undefined';
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains('bytes')) db.createObjectStore('bytes');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function handleKey(name, size) {
  return String(name) + '|' + Number(size);
}

const BYTES_STORE = 'bytes';
const MAX_CACHED_BYTES = 40 * 1024 * 1024;

// 把 PDF 原字节缓存下来：浏览器不给文件句柄时（比如 file:// 打开），
// 最近文件仍然能直接打开，不用再弹选择框。
export async function cacheBytes(name, size, bytes) {
  if (!hasIdb() || !bytes || bytes.byteLength > MAX_CACHED_BYTES) return false;
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(BYTES_STORE, 'readwrite');
      tx.objectStore(BYTES_STORE).put(bytes, handleKey(name, size));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch (e) {
    return false;
  }
}

export async function readCachedBytes(name, size) {
  if (!hasIdb()) return null;
  try {
    const db = await openDb();
    const bytes = await new Promise((resolve, reject) => {
      const tx = db.transaction(BYTES_STORE, 'readonly');
      const req = tx.objectStore(BYTES_STORE).get(handleKey(name, size));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return bytes || null;
  } catch (e) {
    return null;
  }
}

export async function saveHandle(name, size, handle) {
  if (!handle || !hasIdb()) return false;
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(handle, handleKey(name, size));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch (e) {
    return false;
  }
}

export async function loadHandle(name, size) {
  if (!hasIdb()) return null;
  try {
    const db = await openDb();
    const handle = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(handleKey(name, size));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return handle;
  } catch (e) {
    return null;
  }
}

// 直接打开最近文件：拿到句柄就读，权限被拒就返回 null 让调用方退回选择框
export async function reopenRecent(entry) {
  const handle = await loadHandle(entry.name, entry.size);
  if (!handle) return null;
  try {
    const perm = handle.queryPermission ? await handle.queryPermission({ mode: 'read' }) : 'granted';
    if (perm !== 'granted') {
      const asked = handle.requestPermission ? await handle.requestPermission({ mode: 'read' }) : 'denied';
      if (asked !== 'granted') return null;
    }
    const file = await handle.getFile();
    if (!file) return null;
    return file;
  } catch (e) {
    return null;
  }
}

// 从最近列表踢掉时，把缓存字节和句柄一起删掉，别让 IndexedDB 无限长大
export async function forgetFile(name, size) {
  if (!hasIdb()) return false;
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE, BYTES_STORE], 'readwrite');
      tx.objectStore(STORE).delete(handleKey(name, size));
      tx.objectStore(BYTES_STORE).delete(handleKey(name, size));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch (e) {
    return false;
  }
}

// 依次尝试：句柄 → 本地缓存字节；都没有才返回 null
export async function openRecent(entry) {
  const viaHandle = await reopenRecent(entry);
  if (viaHandle) return viaHandle;
  const bytes = await readCachedBytes(entry.name, entry.size);
  if (bytes) {
    try {
      return new File([bytes], entry.name, { type: 'application/pdf' });
    } catch (e) {
      return null;
    }
  }
  return null;
}

export function hasPickHandle() {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
}

const LAST_KEY = '@last';

export async function saveLastHandle(handle) {
  if (!handle || !hasIdb()) return false;
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(handle, LAST_KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch (e) {
    return false;
  }
}

export async function loadLastHandle() {
  if (!hasIdb()) return null;
  try {
    const db = await openDb();
    const handle = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(LAST_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return handle;
  } catch (e) {
    return null;
  }
}

export async function pickWithHandle() {
  if (!hasPickHandle()) return null;
  try {
    // 从上次打开的文件所在目录开始，别又跳回「文档」
    const startIn = await loadLastHandle();
    const options = {
      types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
      multiple: false,
    };
    if (startIn) options.startIn = startIn;
    const [handle] = await window.showOpenFilePicker(options);
    if (!handle) return null;
    await saveLastHandle(handle);
    const file = await handle.getFile();
    return { file, handle };
  } catch (e) {
    return null; // 用户取消
  }
}
